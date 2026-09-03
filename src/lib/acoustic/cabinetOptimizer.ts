// Cabinet optimizer: given a set of drivers, find the cabinet dimensions
// and port tuning that maximize the Harman/Olive preference score.
//
// Sweeps:
//   - Cabinet internal volume (affects bass extension and F3)
//   - Port tuning frequency Fb (for ported cabinets)
//   - Cabinet type (sealed vs ported)
//
// Uses the preference score (NBD, LFX, SM) to evaluate each configuration.
// The optimizer builds a DesignBand set, simulates the on-axis response,
// and scores it.

import type {
  Driver,
  DesignBand,
  CabinetType,
  CrossoverType,
} from '@/types';
import { scoreFromBands } from './preferenceOptimizer';
import type { PreferenceScoreResult } from './preferenceScore';
import { generateFrequencies } from './thieleSmall';
import { calcCabinetResponse } from './cabinetResponse';
import { suggestCrossover, acousticCenterDepth } from './autoDesign';
import type { CabinetSpec } from './cabinetMatch';

export interface CabinetOptimizationParams {
  /** Selected drivers (2 or 3) to optimize for */
  drivers: Driver[];
  /** Number of ways (2 or 3) */
  ways: 2 | 3;
  /** Baffle width constraint [mm] (driver must fit) */
  baffleWidth: number;
  /** Baffle height constraint [mm] */
  baffleHeight: number;
  /** Wall thickness [mm] */
  wallThickness?: number;
  /** Number of woofers */
  wooferCount?: number;
  /** Crossover type to use */
  crossoverType?: CrossoverType;
}

export interface CabinetOptimizationResult {
  /** Best cabinet type found */
  bestCabinetType: CabinetType;
  /** Best internal volume [L] */
  bestVolume: number;
  /** Best port tuning frequency [Hz] (0 if sealed) */
  bestPortFb: number;
  /** Best cabinet spec */
  bestSpec: CabinetSpec;
  /** Best bands configuration */
  bestBands: DesignBand[];
  /** Score with the best cabinet */
  bestScore: PreferenceScoreResult;
  /** Score with the initial/baseline cabinet (sealed, default volume) */
  baselineScore: PreferenceScoreResult;
  /** Improvement in score */
  improvement: number;
  /** All trial results for visualization */
  trials: {
    cabinetType: CabinetType;
    volume: number;
    portFb: number;
    score: number;
    f3: number;
  }[];
  /** Human-readable reasoning (Danish) */
  reasoning: string[];
}

const DEFAULT_WALL_THICKNESS = 18;

// ---------------------------------------------------------------------------
// Build bands from drivers + cabinet params
// ---------------------------------------------------------------------------

function buildBands(
  drivers: Driver[],
  ways: 2 | 3,
  crossoverType: CrossoverType,
  wooferCount: number,
): DesignBand[] {
  const xoSuggestion = suggestCrossover(drivers, ways);
  const autoDelays = computeAutoDelays(drivers);

  const bands: DesignBand[] = [];
  for (let i = 0; i < ways && i < drivers.length; i++) {
    const driver = drivers[i]!;
    const xoPoint = xoSuggestion.crossoverPoints.find((cp) =>
      cp.lowerRole === driver.type || cp.upperRole === driver.type,
    );

    const isLow = i === 0;
    const isHigh = i === ways - 1;

    bands.push({
      driverId: driver.id,
      role: isLow ? 'low' : isHigh ? 'high' : 'mid',
      driverCount: isLow ? wooferCount : 1,
      lowpassFreq: isHigh ? 0 : (xoPoint?.freq ?? 2000),
      lowpassType: crossoverType,
      highpassFreq: isLow ? 0 : (xoPoint?.freq ?? 2000),
      highpassType: crossoverType,
      gain: 0,
      polarity: 0,
      delay: autoDelays[i] ?? 0,
    });
  }

  return bands;
}

function computeAutoDelays(drivers: Driver[]): number[] {
  const depths = drivers.map((d) => acousticCenterDepth(d));
  const maxDepth = Math.max(...depths);
  return depths.map((d) => Math.round(((maxDepth - d) / 343000) * 1000 * 100) / 100);
}

// ---------------------------------------------------------------------------
// Estimate F3 for a given cabinet config
// ---------------------------------------------------------------------------

function estimateF3(
  driver: Driver,
  cabinetType: CabinetType,
  volume: number, // [L]
  portFb: number,
  wooferCount: number,
): number {
  const freqs = generateFrequencies(10, 500, 12);
  const effDriver = wooferCount > 1 && driver.tsParams?.vas
    ? { ...driver, tsParams: { ...driver.tsParams, vas: driver.tsParams.vas * wooferCount } }
    : driver;

  const cabinetResp = calcCabinetResponse(
    effDriver,
    cabinetType,
    freqs,
    200, // baffle width placeholder
    0.707,
    cabinetType === 'ported' ? { fb: portFb || undefined, vb: volume || undefined } : undefined,
  );

  // Find -3dB point
  const baseline = cabinetResp.response[0]?.magnitude ?? 0;
  for (let i = 0; i < freqs.length; i++) {
    const db = cabinetResp.response[i]?.magnitude ?? 0;
    if (db < baseline - 3) {
      return freqs[i]!;
    }
  }
  return freqs[0]!;
}

// ---------------------------------------------------------------------------
// Main optimizer
// ---------------------------------------------------------------------------

export function optimizeCabinetForDrivers(
  params: CabinetOptimizationParams,
): CabinetOptimizationResult {
  const {
    drivers,
    ways,
    baffleWidth,
    baffleHeight,
    wallThickness = DEFAULT_WALL_THICKNESS,
    wooferCount = 1,
    crossoverType = 'LR4',
  } = params;

  const reasoning: string[] = [];
  const freqs = generateFrequencies(20, 20000, 12);
  const trials: CabinetOptimizationResult['trials'] = [];

  // Get woofer's Vas and Fs for volume range estimation
  const woofer = drivers[0]!;
  const vas = woofer.tsParams?.vas ?? 10; // liters
  const fs = woofer.tsParams?.fs ?? 40;

  // Volume range: 0.3× to 3× Vas (reasonable bracket)
  const volMin = Math.max(2, vas * 0.3);
  const volMax = Math.min(200, vas * 3);
  const volSteps = [2.0, 1.0, 0.5]; // L resolution, coarse to fine

  // Port tuning range: 0.5× to 1.5× Fs (for ported)
  const fbMin = fs * 0.5;
  const fbMax = fs * 1.5;
  const fbSteps = [10, 5, 2]; // Hz resolution

  // --- Baseline: sealed at Vas volume ---
  const baselineVol = vas;
  const baselineBands = buildBands(
    drivers, ways, crossoverType,
    wooferCount,
  );
  const baselineScore = scoreFromBands(
    baselineBands, drivers, freqs,
    baffleWidth, baffleHeight,
    'sealed', 0, baselineVol, 0, wooferCount,
  );

  reasoning.push(`Baseline: lukket kabinet ${baselineVol.toFixed(1)} L, score ${baselineScore.score}/10, LFX ${baselineScore.lfxHz} Hz.`);

  let bestScore = baselineScore;
  let bestCabinetType: CabinetType = 'sealed';
  let bestVolume = baselineVol;
  let bestPortFb = 0;
  let bestBands = baselineBands;
  let bestF3 = estimateF3(woofer, 'sealed', baselineVol, 0, wooferCount);

  trials.push({
    cabinetType: 'sealed',
    volume: baselineVol,
    portFb: 0,
    score: baselineScore.score,
    f3: bestF3,
  });

  // --- Phase 1: Coarse volume sweep for sealed ---
  for (const volStep of volSteps) {
    let improvedThisRound = false;

    for (let vol = volMin; vol <= volMax + 1e-9; vol += volStep) {
      const trialBands = buildBands(
    drivers, ways, crossoverType,
    wooferCount,
  );
      const trialScore = scoreFromBands(
        trialBands, drivers, freqs,
        baffleWidth, baffleHeight,
        'sealed', 0, vol, 0, wooferCount,
      );
      const trialF3 = estimateF3(woofer, 'sealed', vol, 0, wooferCount);

      trials.push({
        cabinetType: 'sealed',
        volume: Math.round(vol * 10) / 10,
        portFb: 0,
        score: trialScore.score,
        f3: trialF3,
      });

      if (trialScore.score > bestScore.score + 0.02) {
        bestScore = trialScore;
        bestCabinetType = 'sealed';
        bestVolume = Math.round(vol * 10) / 10;
        bestPortFb = 0;
        bestBands = trialBands;
        bestF3 = trialF3;
        improvedThisRound = true;
      }
    }

    if (!improvedThisRound && volStep === volSteps[volSteps.length - 1]) {
      reasoning.push(`Lukket volumen-optimering konvergeret.`);
    }
  }

  reasoning.push(`Bedste lukket: ${bestVolume.toFixed(1)} L, score ${bestScore.score.toFixed(1)}, F3 ${bestF3.toFixed(0)} Hz.`);

  // --- Phase 2: Ported cabinet sweep (volume × port tuning) ---
  let bestPortedScore = bestScore;
  let bestPortedVol = bestVolume;
  let bestPortedFb = 0;
  let bestPortedBands = bestBands;
  let bestPortedF3 = bestF3;

  for (const volStep of volSteps) {
    for (const fbStep of fbSteps) {
      let improvedThisRound = false;

      for (let vol = volMin; vol <= volMax + 1e-9; vol += volStep) {
        for (let fb = fbMin; fb <= fbMax + 1e-9; fb += fbStep) {
          const trialBands = buildBands(
    drivers, ways, crossoverType,
    wooferCount,
  );
          const trialScore = scoreFromBands(
            trialBands, drivers, freqs,
            baffleWidth, baffleHeight,
            'ported', fb, vol, 0, wooferCount,
          );
          const trialF3 = estimateF3(woofer, 'ported', vol, fb, wooferCount);

          trials.push({
            cabinetType: 'ported',
            volume: Math.round(vol * 10) / 10,
            portFb: Math.round(fb),
            score: trialScore.score,
            f3: trialF3,
          });

          if (trialScore.score > bestPortedScore.score + 0.02) {
            bestPortedScore = trialScore;
            bestPortedVol = Math.round(vol * 10) / 10;
            bestPortedFb = Math.round(fb);
            bestPortedBands = trialBands;
            bestPortedF3 = trialF3;
            improvedThisRound = true;
          }
        }
      }

      if (!improvedThisRound && volStep === volSteps[volSteps.length - 1] && fbStep === fbSteps[fbSteps.length - 1]) {
        reasoning.push(`Ported optimering konvergeret.`);
      }
    }
  }

  if (bestPortedScore.score > bestScore.score + 0.02) {
    bestScore = bestPortedScore;
    bestCabinetType = 'ported';
    bestVolume = bestPortedVol;
    bestPortFb = bestPortedFb;
    bestBands = bestPortedBands;
    bestF3 = bestPortedF3;
    reasoning.push(`Ported vandt: ${bestPortedVol.toFixed(1)} L @ ${bestPortedFb} Hz, score ${bestPortedScore.score.toFixed(1)}, F3 ${bestPortedF3.toFixed(0)} Hz.`);
  } else {
    reasoning.push(`Lukket kabinet er bedst (${bestScore.score.toFixed(1)} vs ported ${bestPortedScore.score.toFixed(1)}).`);
  }

  // Build best cabinet spec
  const depth = bestCabinetType === 'ported'
    ? Math.round(bestVolume * 1000 / (baffleWidth * baffleHeight) * 10) / 10 + wallThickness * 2
    : Math.round(bestVolume * 1000 / (baffleWidth * baffleHeight) * 10) / 10 + wallThickness * 2;

  const bestSpec: CabinetSpec = {
    name: `Optimeret (${bestCabinetType === 'sealed' ? 'lukket' : 'port'})`,
    height: baffleHeight,
    width: baffleWidth,
    depth: Math.round(depth),
    wallThickness,
    portDiameter: bestCabinetType === 'ported' ? 60 : 0,
    portLength: bestCabinetType === 'ported' ? 150 : 0,
    numPorts: 1,
    portPosition: 'rear',
    wooferCount,
  };

  const improvement = bestScore.score - baselineScore.score;

  reasoning.push(`Optimeret kabinet: ${bestCabinetType === 'sealed' ? 'lukket' : 'port'} ${bestVolume.toFixed(1)} L${bestPortFb > 0 ? ` @ ${bestPortFb} Hz` : ''}.`);
  reasoning.push(`Score: ${baselineScore.score}/10 → ${bestScore.score}/10 (${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} point).`);
  reasoning.push(`Bass extension: ${baselineScore.lfxHz} Hz → ${bestScore.lfxHz} Hz, F3 ${bestF3.toFixed(0)} Hz.`);
  reasoning.push(`Dimensioner: ${baffleHeight}×${baffleWidth}×${Math.round(depth)}mm (H×B×D).`);

  // Sort trials by score for display
  trials.sort((a, b) => b.score - a.score);

  return {
    bestCabinetType,
    bestVolume,
    bestPortFb,
    bestSpec,
    bestBands,
    bestScore,
    baselineScore,
    improvement,
    trials: trials.slice(0, 30), // top 30 for display
    reasoning,
  };
}
