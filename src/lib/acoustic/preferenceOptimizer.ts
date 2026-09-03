// Auto-optimizer: adjust crossover frequencies, gains, delays, and polarity
// to maximize the Harman/Olive preference score.
//
// Uses coordinate descent with multi-resolution steps:
//   1. Coarse sweep of crossover frequencies (find best XO points)
//   2. Fine-tune gains (sensitivity matching + flatness)
//   3. Fine-tune delays (phase alignment at XO points)
//   4. Try polarity inversions (0/180 for each band)
//
// The optimizer re-simulates the full system at each trial and computes
// the preference score from the spinorama of the summed on-axis response.

import type {
  Driver,
  DesignBand,
  FrequencyDataPoint,
  CabinetType,
} from '@/types';
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, filterPhaseRad } from './crossover';
import { calcCabinetResponse } from './cabinetResponse';
import { calcBaffleStep } from './baffle';
import { calcSpinorama } from './directivity';
import { computePreferenceScore, type PreferenceScoreResult } from './preferenceScore';
import { generateFrequencies } from './thieleSmall';
import { pistonDiameter, acousticCenterDepth } from './autoDesign';

const SAMPLE_RATE = 48000;

export interface OptimizationParams {
  bands: DesignBand[];
  drivers: Driver[];
  ways: 2 | 3 | 4;
  baffleWidth: number;
  baffleHeight: number;
  cabinetType: string;
  portFb: number;
  portVb: number;
  portDiameter: number;
  numPorts: number;
  /** Max deviation from initial crossover freq (fraction, e.g. 0.5 = ±50%) */
  xoRangeFraction?: number;
  /** Max deviation from initial gain (dB) */
  gainRangeDb?: number;
  /** Max delay to try (ms) */
  maxDelayMs?: number;
}

export interface OptimizationResult {
  /** Optimized bands */
  optimizedBands: DesignBand[];
  /** Original bands */
  originalBands: DesignBand[];
  /** Score before optimization */
  beforeScore: PreferenceScoreResult;
  /** Score after optimization */
  afterScore: PreferenceScoreResult;
  /** Improvement in score */
  improvement: number;
  /** Human-readable reasoning steps (Danish) */
  reasoning: string[];
}

// ---------------------------------------------------------------------------
// Core: simulate on-axis from bands + drivers, return spinorama + score
// ---------------------------------------------------------------------------

// Interpolate a curve to a target frequency grid (log-space linear interp)
function resampleToFreqs(
  src: FrequencyDataPoint[],
  freqs: number[],
): FrequencyDataPoint[] {
  if (src.length === 0) return freqs.map((f) => ({ freq: f, magnitude: 0 }));
  return freqs.map((f) => {
    // Find surrounding points
    let db: number | undefined;
    for (let i = 0; i < src.length; i++) {
      if (src[i]!.freq >= f) {
        if (i === 0) { db = src[0]!.magnitude; break; }
        const p0 = src[i - 1]!;
        const p1 = src[i]!;
        const t = (Math.log(f) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq));
        db = p0.magnitude + t * (p1.magnitude - p0.magnitude);
        break;
      }
    }
    if (db === undefined) db = src[src.length - 1]!.magnitude;
    return { freq: f, magnitude: db };
  });
}

export function simulateOnAxis(
  bands: DesignBand[],
  drivers: Driver[],
  freqs: number[],
  baffleWidth: number,
  baffleHeight: number,
  cabinetType: string,
  portFb: number,
  portVb: number,
  portDiameter: number,
  numPorts: number,
): FrequencyDataPoint[] {
  const baffleStepResult = calcBaffleStep(baffleWidth, baffleHeight, freqs);
  const fStep = 343000 / (2 * Math.max(baffleWidth, baffleHeight));
  const fStep3x = fStep * 3;

  const bandCurves: { curve: FrequencyDataPoint[]; band: DesignBand; filters: { lp: ReturnType<typeof buildCrossoverFilter> | null; hp: ReturnType<typeof buildCrossoverFilter> | null } }[] = [];

  for (const band of bands) {
    const driver = drivers.find((d) => d.id === band.driverId);
    if (!driver) continue;

    const driverCount = band.driverCount ?? 1;
    const hasRealResponse = !!driver.frequencyResponse && driver.frequencyResponse.length > 0;
    const countGainDb = 10 * Math.log10(driverCount);

    let curve: FrequencyDataPoint[];
    if (hasRealResponse && driver.frequencyResponse) {
      // Resample driver's own frequency response to the freqs grid
      // so cabinet/baffle/crossover/sum all index correctly
      curve = resampleToFreqs(driver.frequencyResponse, freqs);
    } else {
      const sens = driver.tsParams?.sensitivity ?? 0;
      curve = freqs.map((f) => ({ freq: f, magnitude: sens + countGainDb }));
    }

    if (driverCount > 1 && hasRealResponse) {
      curve = curve.map((p) => ({ freq: p.freq, magnitude: p.magnitude + countGainDb }));
    }

    const driverType = driver.type;
    const isLowDriver = driverType === 'woofer' || driverType === 'subwoofer';
    const isMidDriver = driverType === 'midrange' || driverType === 'fullrange';

    if (isLowDriver && driver) {
      const effDriver = driverCount > 1 && driver.tsParams?.vas
        ? { ...driver, tsParams: { ...driver.tsParams, vas: driver.tsParams.vas * driverCount } }
        : driver;
      const cabinetResp = calcCabinetResponse(
        effDriver,
        cabinetType as CabinetType,
        freqs,
        baffleWidth,
        0.707,
        cabinetType === 'ported' ? { fb: portFb || undefined, vb: portVb || undefined, portDiameter, numPorts } : undefined,
      );
      curve = curve.map((p, i) => ({
        freq: p.freq,
        magnitude: p.magnitude + (cabinetResp.response[i]?.magnitude ?? 0),
      }));
    }

    if (isLowDriver || isMidDriver) {
      curve = curve.map((p, i) => {
        let bsFactor = baffleStepResult.response[i] ?? 0;
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep));
          bsFactor *= (1 - t);
        }
        return { freq: p.freq, magnitude: p.magnitude + bsFactor };
      });
    }

    let lpFilter: ReturnType<typeof buildCrossoverFilter> | null = null;
    let hpFilter: ReturnType<typeof buildCrossoverFilter> | null = null;

    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      lpFilter = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false, SAMPLE_RATE);
      curve = applyCrossover(lpFilter, curve, SAMPLE_RATE);
    }
    if (band.highpassFreq > 0) {
      hpFilter = buildCrossoverFilter(band.highpassType, band.highpassFreq, true, SAMPLE_RATE);
      curve = applyCrossover(hpFilter, curve, SAMPLE_RATE);
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity);

    bandCurves.push({ curve, band, filters: { lp: lpFilter, hp: hpFilter } });
  }

  // Complex voltage sum with filter phase + polarity + delay
  const summed = freqs.map((f, fi) => {
    let sumReal = 0;
    let sumImag = 0;
    for (const bc of bandCurves) {
      const db = bc.curve[fi]!.magnitude;
      const mag = Math.pow(10, db / 20);

      let phase = 0;
      if (bc.filters.hp) phase += filterPhaseRad(bc.filters.hp, f, SAMPLE_RATE);
      if (bc.filters.lp) phase += filterPhaseRad(bc.filters.lp, f, SAMPLE_RATE);
      if (bc.band.polarity === 180) phase += Math.PI;
      if (bc.band.delay > 0) phase += -2 * Math.PI * f * bc.band.delay * 0.001;

      sumReal += mag * Math.cos(phase);
      sumImag += mag * Math.sin(phase);
    }
    const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    return { freq: f, magnitude: 20 * Math.log10(mag + 1e-10) };
  });

  return summed;
}

export function scoreFromBands(
  bands: DesignBand[],
  drivers: Driver[],
  freqs: number[],
  baffleWidth: number,
  baffleHeight: number,
  cabinetType: string,
  portFb: number,
  portVb: number,
  portDiameter: number,
  numPorts: number,
): PreferenceScoreResult {
  const onAxis = simulateOnAxis(
    bands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  // Use the largest driver diameter for directivity (most conservative)
  let maxDiameter = 100;
  for (const band of bands) {
    const driver = drivers.find((d) => d.id === band.driverId);
    if (driver) {
      const dia = pistonDiameter(driver);
      if (dia > maxDiameter) maxDiameter = dia;
    }
  }

  const spinorama = calcSpinorama(onAxis, maxDiameter, baffleWidth, baffleHeight);
  return computePreferenceScore(spinorama);
}

// ---------------------------------------------------------------------------
// Auto-delay computation (acoustic center alignment)
// ---------------------------------------------------------------------------

function computeAutoDelays(bands: DesignBand[], drivers: Driver[]): number[] {
  // Acoustic center depth for each band's driver
  const depths = bands.map((band) => {
    const driver = drivers.find((d) => d.id === band.driverId);
    if (!driver) return 0;
    return acousticCenterDepth(driver);
  });

  // Reference: deepest acoustic center (woofer is furthest back)
  const maxDepth = Math.max(...depths);
  // Delay = (maxDepth - thisDepth) / speed_of_sound [ms]
  // speed of sound = 343000 mm/s
  return depths.map((d) => Math.round(((maxDepth - d) / 343000) * 1000 * 100) / 100);
}

// ---------------------------------------------------------------------------
// Main optimizer
// ---------------------------------------------------------------------------

export function optimizeForPreferenceScore(params: OptimizationParams): OptimizationResult {
  const {
    bands: initialBands,
    drivers,
    ways,
    baffleWidth,
    baffleHeight,
    cabinetType,
    portFb,
    portVb,
    portDiameter,
    numPorts,
    xoRangeFraction = 0.5,
    gainRangeDb = 10,
    maxDelayMs = 5,
  } = params;

  const reasoning: string[] = [];
  const freqs = generateFrequencies(20, 20000, 12);

  // Score the initial setup
  const beforeScore = scoreFromBands(
    initialBands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  reasoning.push(`Start score: ${beforeScore.score}/10 (NBD_ON=${beforeScore.nbdOnAxis}, NBD_PIR=${beforeScore.nbdPredInRoom}, LFX=${beforeScore.lfxHz}Hz, SM_PIR=${beforeScore.smPredInRoom}).`);

  let bestBands = initialBands.map((b) => ({ ...b }));
  let bestScore = beforeScore.score;

  // --- Phase 1: Auto-delay (acoustic center alignment) ---
  const autoDelays = computeAutoDelays(initialBands, drivers);
  reasoning.push(`Auto-delay beregnet fra akustisk centrum: [${autoDelays.map((d) => d.toFixed(2)).join(', ')}] ms.`);

  {
    const trialBands = bestBands.map((b, i) => ({ ...b, delay: autoDelays[i] ?? 0 }));
    const trialScore = scoreFromBands(
      trialBands, drivers, freqs,
      baffleWidth, baffleHeight,
      cabinetType, portFb, portVb, portDiameter, numPorts,
    );
    if (trialScore.score > bestScore) {
      bestScore = trialScore.score;
      bestBands = trialBands;
      reasoning.push(`Auto-delay forbedret score til ${trialScore.score.toFixed(1)}.`);
    }
  }

  // --- Phase 2: Polarity optimization (try 0/180 for each band) ---
  // Lower band (woofer) polarity is kept as-is (reference).
  // Try inverting upper bands.
  for (let b = 1; b < ways; b++) {
    const trialBands = bestBands.map((bb, i) =>
      i === b ? { ...bb, polarity: (bb.polarity === 0 ? 180 : 0) as 0 | 180 } : bb,
    );
    const trialScore = scoreFromBands(
      trialBands, drivers, freqs,
      baffleWidth, baffleHeight,
      cabinetType, portFb, portVb, portDiameter, numPorts,
    );
    if (trialScore.score > bestScore) {
      bestScore = trialScore.score;
      bestBands = trialBands;
      reasoning.push(`Polaritet bånd ${b + 1} -> ${trialBands[b]!.polarity}° forbedret score til ${trialScore.score.toFixed(1)}.`);
    }
  }

  // --- Phase 3: Crossover frequency optimization (coarse then fine) ---
  // For each crossover point (between band i and i+1), sweep the frequency
  const xoSteps = [1.0, 0.5, 0.25, 0.1]; // fractions of current value as step size
  const crossoverPoints: { lowerIdx: number; upperIdx: number; initialFreq: number }[] = [];

  for (let i = 0; i < ways - 1; i++) {
    const lower = bestBands[i]!;
    const xoFreq = lower.lowpassFreq > 0 ? lower.lowpassFreq : bestBands[i + 1]!.highpassFreq;
    if (xoFreq > 0) {
      crossoverPoints.push({ lowerIdx: i, upperIdx: i + 1, initialFreq: xoFreq });
    }
  }

  for (const stepFrac of xoSteps) {
    let improvedThisRound = false;

    for (const xo of crossoverPoints) {
      const step = Math.max(10, xo.initialFreq * stepFrac * 0.1);
      const fMin = xo.initialFreq * (1 - xoRangeFraction);
      const fMax = xo.initialFreq * (1 + xoRangeFraction);

      let bestXoFreq = bestBands[xo.lowerIdx]!.lowpassFreq > 0
        ? bestBands[xo.lowerIdx]!.lowpassFreq
        : bestBands[xo.upperIdx]!.highpassFreq;
      let bestXoScore = bestScore;

      for (let f = fMin; f <= fMax + 1e-9; f += step) {
        const trialBands = bestBands.map((bb, i) => {
          if (i === xo.lowerIdx) return { ...bb, lowpassFreq: Math.round(f) };
          if (i === xo.upperIdx) return { ...bb, highpassFreq: Math.round(f) };
          return bb;
        });
        const trialScore = scoreFromBands(
          trialBands, drivers, freqs,
          baffleWidth, baffleHeight,
          cabinetType, portFb, portVb, portDiameter, numPorts,
        );
        if (trialScore.score > bestXoScore + 0.01) {
          bestXoScore = trialScore.score;
          bestXoFreq = Math.round(f);
        }
      }

      if (bestXoScore > bestScore + 0.01) {
        bestBands = bestBands.map((bb, i) => {
          if (i === xo.lowerIdx) return { ...bb, lowpassFreq: bestXoFreq };
          if (i === xo.upperIdx) return { ...bb, highpassFreq: bestXoFreq };
          return bb;
        });
        bestScore = bestXoScore;
        improvedThisRound = true;
      }
    }

    if (!improvedThisRound && stepFrac === xoSteps[xoSteps.length - 1]) {
      reasoning.push(`Delefrekvens-optimering konvergeret.`);
    }
  }

  reasoning.push(`Delefrekvenser: ${crossoverPoints.map((xo) => {
    const f = bestBands[xo.lowerIdx]!.lowpassFreq > 0 ? bestBands[xo.lowerIdx]!.lowpassFreq : bestBands[xo.upperIdx]!.highpassFreq;
    return `${f} Hz`;
  }).join(', ')}.`);

  // --- Phase 4: Gain optimization (coordinate descent) ---
  const gainStep = 0.5;
  const maxGainPasses = 4;

  for (let pass = 0; pass < maxGainPasses; pass++) {
    let improvedThisPass = false;

    for (let b = 0; b < ways; b++) {
      let bestGain = bestBands[b]!.gain;
      let bestGainScore = bestScore;

      const scanStart = Math.max(initialBands[b]!.gain - gainRangeDb, bestBands[b]!.gain - 6);
      const scanEnd = Math.min(initialBands[b]!.gain + gainRangeDb, bestBands[b]!.gain + 6);

      for (let g = scanStart; g <= scanEnd + 1e-9; g += gainStep) {
        const trialBands = bestBands.map((bb, i) => i === b ? { ...bb, gain: Math.round(g * 10) / 10 } : bb);
        const trialScore = scoreFromBands(
          trialBands, drivers, freqs,
          baffleWidth, baffleHeight,
          cabinetType, portFb, portVb, portDiameter, numPorts,
        );
        if (trialScore.score > bestGainScore + 0.005) {
          bestGainScore = trialScore.score;
          bestGain = Math.round(g * 10) / 10;
        }
      }

      if (Math.abs(bestGain - bestBands[b]!.gain) > 0.05) {
        bestBands[b]!.gain = bestGain;
        bestScore = bestGainScore;
        improvedThisPass = true;
      }
    }

    if (!improvedThisPass) {
      reasoning.push(`Gain-optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
  }

  reasoning.push(`Optimeret gains: [${bestBands.map((b) => b.gain.toFixed(1)).join(', ')}] dB.`);

  // --- Phase 5: Fine delay optimization ---
  const delayStep = 0.05; // 50 µs resolution
  for (let pass = 0; pass < 3; pass++) {
    let improvedThisPass = false;

    for (let b = 0; b < ways; b++) {
      let bestDelay = bestBands[b]!.delay;
      let bestDelayScore = bestScore;

      const scanStart = Math.max(0, bestBands[b]!.delay - 0.5);
      const scanEnd = Math.min(maxDelayMs, bestBands[b]!.delay + 0.5);

      for (let d = scanStart; d <= scanEnd + 1e-9; d += delayStep) {
        const trialBands = bestBands.map((bb, i) => i === b ? { ...bb, delay: Math.round(d * 100) / 100 } : bb);
        const trialScore = scoreFromBands(
          trialBands, drivers, freqs,
          baffleWidth, baffleHeight,
          cabinetType, portFb, portVb, portDiameter, numPorts,
        );
        if (trialScore.score > bestDelayScore + 0.005) {
          bestDelayScore = trialScore.score;
          bestDelay = Math.round(d * 100) / 100;
        }
      }

      if (Math.abs(bestDelay - bestBands[b]!.delay) > 0.01) {
        bestBands[b]!.delay = bestDelay;
        bestScore = bestDelayScore;
        improvedThisPass = true;
      }
    }

    if (!improvedThisPass) {
      reasoning.push(`Delay-optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
  }

  reasoning.push(`Optimeret delays: [${bestBands.map((b) => b.delay.toFixed(2)).join(', ')}] ms.`);

  // --- Final score ---
  const afterScore = scoreFromBands(
    bestBands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  const improvement = afterScore.score - beforeScore.score;

  reasoning.push(`Slut score: ${afterScore.score}/10 (forbedring ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} point).`);

  return {
    optimizedBands: bestBands,
    originalBands: initialBands.map((b) => ({ ...b })),
    beforeScore,
    afterScore,
    improvement,
    reasoning,
  };
}
