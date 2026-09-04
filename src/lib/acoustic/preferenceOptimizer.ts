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
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, filterPhaseRad, buildEqBiquad, applyEqBiquad, eqBiquadPhaseRad, type BiquadCoeffs } from './crossover';
import { calcCabinetResponse } from './cabinetResponse';
import { calcBaffleStep, calcBaffleStepCompensation } from './baffle';
import { calcSpinoramaMultiDriver } from './directivity';
import { computePreferenceScore, type PreferenceScoreResult } from './preferenceScore';
import { generateFrequencies } from './thieleSmall';
import { pistonDiameter, acousticCenterDepth, usableRange } from './autoDesign';

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
export function resampleToFreqs(
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
  return simulateOnAxisWithBands(bands, drivers, freqs, baffleWidth, baffleHeight, cabinetType, portFb, portVb, portDiameter, numPorts).summed;
}

/** Per-band curve data for multi-driver spinorama */
export interface BandCurveData {
  curve: number[];
  diameter: number;
}

/** Simulate on-axis and return per-band curves for multi-driver directivity */
export function simulateOnAxisWithBands(
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
): { summed: FrequencyDataPoint[]; bandCurves: BandCurveData[] } {
  const baffleStepResult = calcBaffleStep(baffleWidth, baffleHeight, freqs);
  // fStep must match calcBaffleStep's internal calculation (uses baffleWidth,
  // NOT Math.max(width, height)). Mismatch caused midrange fade-out at wrong freq.
  const fStep = 343000 / (2 * baffleWidth);
  const fStep3x = fStep * 3;
  // Baffle step compensation: +6 dB low-shelf at fStep, applied to woofer
  // and midrange channels. Any real active speaker includes this EQ in the
  // crossover/DSP. Without it, the response has a -6 dB dip in the 200-600 Hz
  // region that the gain optimizer cannot fix (band 0 gain locked at 0).
  const baffleComp = calcBaffleStepCompensation(fStep, 6, freqs);

  const bandCurves: { curve: FrequencyDataPoint[]; band: DesignBand; filters: { lp: ReturnType<typeof buildCrossoverFilter> | null; hp: ReturnType<typeof buildCrossoverFilter> | null; eqs: BiquadCoeffs[] } }[] = [];

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
        let compFactor = baffleComp[i] ?? 0;
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep));
          bsFactor *= (1 - t);
          compFactor *= (1 - t);
        }
        // Net effect: baffle step loss + compensation = ~0 dB (flat)
        return { freq: p.freq, magnitude: p.magnitude + bsFactor + compFactor };
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

    // Apply per-band EQ filters (low-shelf, high-shelf, PEQ)
    // Only for bands with active crossover filters in this design
    const hasActiveXover = (band.lowpassFreq > 0 && band.lowpassFreq < 20000) || (band.highpassFreq > 0);
    const eqBiquads: BiquadCoeffs[] = [];
    if (hasActiveXover && band.eqFilters) {
      for (const eq of band.eqFilters) {
        if (!eq.enabled || eq.gain === 0) continue;
        const biquad = buildEqBiquad(eq.kind, eq.freq, eq.gain, eq.q, SAMPLE_RATE);
        eqBiquads.push(biquad);
        curve = applyEqBiquad(biquad, curve, SAMPLE_RATE);
      }
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity);

    bandCurves.push({ curve, band, filters: { lp: lpFilter, hp: hpFilter, eqs: eqBiquads } });
  }

  // Complex voltage sum with filter phase + polarity + delay + EQ phase
  const summed = freqs.map((f, fi) => {
    let sumReal = 0;
    let sumImag = 0;
    for (const bc of bandCurves) {
      const db = bc.curve[fi]!.magnitude;
      const mag = Math.pow(10, db / 20);

      let phase = 0;
      if (bc.filters.hp) phase += filterPhaseRad(bc.filters.hp, f, SAMPLE_RATE);
      if (bc.filters.lp) phase += filterPhaseRad(bc.filters.lp, f, SAMPLE_RATE);
      for (const eqBiquad of bc.filters.eqs) {
        phase += eqBiquadPhaseRad(eqBiquad, f, SAMPLE_RATE);
      }
      if (bc.band.polarity === 180) phase += Math.PI;
      if (bc.band.delay > 0) phase += -2 * Math.PI * f * bc.band.delay * 0.001;

      sumReal += mag * Math.cos(phase);
      sumImag += mag * Math.sin(phase);
    }
    const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    return { freq: f, magnitude: 20 * Math.log10(mag + 1e-10) };
  });

  // Build per-band curve data for multi-driver spinorama
  const bandCurveData: BandCurveData[] = bandCurves.map((bc) => ({
    curve: bc.curve.map((p) => p.magnitude),
    diameter: pistonDiameter(drivers.find((d) => d.id === bc.band.driverId) ?? drivers[0]!),
  }));

  return { summed, bandCurves: bandCurveData };
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
  const { bandCurves } = simulateOnAxisWithBands(
    bands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  // Per-band directivity: each driver through its own piston diameter
  // + baffle diffraction effect. Matches UI's calcSpinoramaMultiDriver.
  const spinorama = calcSpinoramaMultiDriver(bandCurves, freqs, baffleWidth, baffleHeight);
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
// XO sanity: crossover frequency must be within both drivers' usable ranges.
// A tweeter with Fs=1000Hz has usableRange.min=1500Hz — crossing at 100Hz
// would destroy it. A woofer has usableRange.max = directivity limit.
// ---------------------------------------------------------------------------

function getXoLimits(
  lowerDriver: Driver | undefined,
  upperDriver: Driver | undefined,
): { fMin: number; fMax: number } {
  // Default wide range if drivers not found
  let fMin = 20;
  let fMax = 20000;

  if (lowerDriver) {
    const lowerRange = usableRange(lowerDriver);
    // XO must be below the lower driver's directivity limit
    fMax = Math.min(fMax, lowerRange.max);
  }
  if (upperDriver) {
    const upperRange = usableRange(upperDriver);
    // XO must be above the upper driver's Fs-based minimum
    fMin = Math.max(fMin, upperRange.min);
  }

  // Ensure valid range (at least 1 octave wide)
  if (fMin >= fMax) {
    const center = Math.sqrt(fMin * Math.max(fMax, 1));
    fMin = center / 1.414;
    fMax = center * 1.414;
  }

  return { fMin, fMax };
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
    xoRangeFraction = 0.8,
    gainRangeDb = 15,
    maxDelayMs = 10,
  } = params;

  const reasoning: string[] = [];
  const freqs = generateFrequencies(20, 20000, 12);

  // Force band 0 (woofer) gain to 0 — it's the reference.
  // All other bands are adjusted relative to it (attenuation only).
  initialBands[0]!.gain = 0;

  // Score the initial setup
  const beforeScore = scoreFromBands(
    initialBands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  reasoning.push(`Start score: ${beforeScore.score}/10 (NBD_ON=${beforeScore.nbdOnAxis}, NBD_PIR=${beforeScore.nbdPredInRoom}, LFX=${beforeScore.lfxHz}Hz, SM_PIR=${beforeScore.smPredInRoom}).`);

  let bestBands = initialBands.map((b) => ({ ...b }));
  // Ensure band 0 gain stays 0 in bestBands
  bestBands[0]!.gain = 0;
  let bestScore = beforeScore.score;

  // --- Phase 0: Coarse grid search over crossover frequencies ---
  // Coordinate descent can get stuck in local optima. A coarse grid
  // search over XO frequencies finds the best starting basin before
  // the fine coordinate descent refines it.
  // Each XO point is constrained to the overlap of both drivers' usable ranges.
  {
    const xoConfigs: { freqs: number[]; indices: number[] }[] = [];
    const numXoPoints = ways - 1;
    if (numXoPoints > 0) {
      const grid = [200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 8000];

      // Compute XO limits for each crossover point
      const xoLimits: { fMin: number; fMax: number }[] = [];
      for (let i = 0; i < numXoPoints; i++) {
        const lowerDriver = drivers.find((d) => d.id === bestBands[i]!.driverId);
        const upperDriver = drivers.find((d) => d.id === bestBands[i + 1]!.driverId);
        xoLimits.push(getXoLimits(lowerDriver, upperDriver));
      }

      // Filter grid points by XO limits for each point
      const validGrids: number[][] = xoLimits.map((lim) =>
        grid.filter((f) => f >= lim.fMin && f <= lim.fMax),
      );

      if (numXoPoints === 1) {
        for (const f of validGrids[0]!) xoConfigs.push({ freqs: [f], indices: [0] });
      } else if (numXoPoints === 2) {
        for (const f1 of validGrids[0]!) {
          for (const f2 of validGrids[1]!) {
            if (f2 > f1 * 1.5) xoConfigs.push({ freqs: [f1, f2], indices: [0, 1] });
          }
        }
      }
    }

    let bestGridScore = bestScore;
    let bestGridBands = bestBands;

    for (const config of xoConfigs) {
      // For each XO point, set lowpassFreq on the lower band and
      // highpassFreq on the upper band. A band between two XO points
      // (e.g. midrange in 3-way) gets BOTH: highpass from XO below
      // and lowpass from XO above. Must NOT return early — accumulate.
      const trialBands = bestBands.map((b, i) => {
        const result = { ...b };
        for (let xi = 0; xi < config.indices.length; xi++) {
          if (i === config.indices[xi]) result.lowpassFreq = config.freqs[xi]!;
          if (i === config.indices[xi]! + 1) result.highpassFreq = config.freqs[xi]!;
        }
        return result;
      });
      const trialScore = scoreFromBands(
        trialBands, drivers, freqs,
        baffleWidth, baffleHeight,
        cabinetType, portFb, portVb, portDiameter, numPorts,
      );
      if (trialScore.score > bestGridScore) {
        bestGridScore = trialScore.score;
        bestGridBands = trialBands;
      }
    }

    if (bestGridScore > bestScore + 0.05) {
      bestBands = bestGridBands;
      bestScore = bestGridScore;
      reasoning.push(`Grid-søgning fundet bedre startpunkt: score ${bestGridScore.toFixed(1)}.`);
    }
  }

  // --- Phase 1: Auto-delay (acoustic center alignment) ---
  // Always apply as a physical baseline correction, not conditional on
  // score improvement. The acoustic center offset is a physical fact —
  // the drivers' voice coils are at different depths. Delaying the
  // shallower drivers so their acoustic centers align is correct
  // regardless of whether the preference score rewards it. The fine
  // delay optimization (Phase 5) can then tune from this baseline.
  const autoDelays = computeAutoDelays(initialBands, drivers);
  reasoning.push(`Auto-delay sat fra akustisk centrum: [${autoDelays.map((d) => d.toFixed(2)).join(', ')}] ms.`);
  bestBands = bestBands.map((b, i) => ({ ...b, delay: autoDelays[i] ?? 0 }));
  // Re-score from the new baseline
  bestScore = scoreFromBands(
    bestBands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  ).score;

  // --- Phases 2-5: iterate until convergence ---
  // Each phase can affect the optimum of the others, so we loop
  // the whole block until no phase improves the score anymore.
  const maxOuterIterations = 8;
  let outerIter = 0;

  for (; outerIter < maxOuterIterations; outerIter++) {
    let improvedThisIteration = false;

  // --- Phase 2: Polarity optimization (exhaustive search) ---
  // Band 0 (woofer) polarity is the reference (kept as-is).
  // For N bands, there are 2^(N-1) polarity combinations for the upper
  // bands. Single-band-at-a-time can miss the case where inverting TWO
  // bands is better than inverting either one alone (common in 3-way
  // where both XO points benefit from mid inversion but not tweeter
  // alone, or vice versa). Exhaustive search is cheap: 4 combos for
  // 3-way, 8 for 4-way.
  {
    const numUpperBands = ways - 1;
    const numCombos = 1 << numUpperBands; // 2^(ways-1)
    for (let combo = 1; combo < numCombos; combo++) { // skip 0 (all default)
      const trialBands = bestBands.map((b, i) => {
        if (i === 0) return b; // band 0 is reference
        const bit = (combo >> (i - 1)) & 1;
        const newPol: 0 | 180 = bit ? 180 : 0;
        return { ...b, polarity: newPol };
      });
      const trialScore = scoreFromBands(
        trialBands, drivers, freqs,
        baffleWidth, baffleHeight,
        cabinetType, portFb, portVb, portDiameter, numPorts,
      );
      if (trialScore.score > bestScore + 0.005) {
        bestScore = trialScore.score;
        bestBands = trialBands;
        improvedThisIteration = true;
        if (outerIter === 0) {
          const polStr = trialBands.map((b) => `${b.polarity}°`).join(', ');
          reasoning.push(`Polaritet [${polStr}] forbedret score til ${trialScore.score.toFixed(1)}.`);
        }
      }
    }
  }

  // --- Phase 3: Crossover frequency optimization (coarse then fine) ---
  const xoSteps = [1.0, 0.5, 0.25, 0.1]; // fractions of current value as step size

  // Recompute crossover points from current best each iteration
  const crossoverPoints: { lowerIdx: number; upperIdx: number; centerFreq: number }[] = [];
  for (let i = 0; i < ways - 1; i++) {
    const lower = bestBands[i]!;
    const xoFreq = lower.lowpassFreq > 0 ? lower.lowpassFreq : bestBands[i + 1]!.highpassFreq;
    if (xoFreq > 0) {
      crossoverPoints.push({ lowerIdx: i, upperIdx: i + 1, centerFreq: xoFreq });
    }
  }

  for (const stepFrac of xoSteps) {
    let improvedThisRound = false;

    for (const xo of crossoverPoints) {
      // Use current center, not stale initial
      const currentCenter = bestBands[xo.lowerIdx]!.lowpassFreq > 0
        ? bestBands[xo.lowerIdx]!.lowpassFreq
        : bestBands[xo.upperIdx]!.highpassFreq;
      const step = Math.max(10, currentCenter * stepFrac * 0.1);

      // XO sanity: clamp to both drivers' usable ranges
      const lowerDriver = drivers.find((d) => d.id === bestBands[xo.lowerIdx]!.driverId);
      const upperDriver = drivers.find((d) => d.id === bestBands[xo.upperIdx]!.driverId);
      const { fMin: xoLoMin, fMax: xoLoMax } = getXoLimits(lowerDriver, upperDriver);

      // Use currentCenter (updated each stepFrac) not stale xo.centerFreq
      const fMin = Math.max(20, currentCenter * (1 - xoRangeFraction), xoLoMin);
      const fMax = Math.min(20000, currentCenter * (1 + xoRangeFraction), xoLoMax);

      let bestXoFreq = currentCenter;
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
        improvedThisIteration = true;
      }
    }

    if (!improvedThisRound && stepFrac === xoSteps[xoSteps.length - 1]) {
      if (outerIter === 0) reasoning.push(`Delefrekvens-optimering konvergeret.`);
    }
  }

  if (outerIter === 0) {
    reasoning.push(`Delefrekvenser: ${crossoverPoints.map((xo) => {
      const f = bestBands[xo.lowerIdx]!.lowpassFreq > 0 ? bestBands[xo.lowerIdx]!.lowpassFreq : bestBands[xo.upperIdx]!.highpassFreq;
      return `${f} Hz`;
    }).join(', ')}.`);
  }

  // --- Phase 4: Gain optimization (coordinate descent, attenuation only) ---
  const gainStep = 0.5;
  const maxGainPasses = 6;

  for (let pass = 0; pass < maxGainPasses; pass++) {
    let improvedThisPass = false;

    for (let b = 0; b < ways; b++) {
      // Band 0 (woofer) is locked at gain 0 — it's the reference.
      // All other bands are adjusted relative to it (attenuation only).
      if (b === 0) continue;

      let bestGain = bestBands[b]!.gain;
      let bestGainScore = bestScore;

      // Only attenuate (lower gain), never boost — per Joachim's rule.
      // If a driver is too quiet, the others are reduced instead.
      // Band 0 stays at 0, so all adjustments are relative to woofer.
      const scanStart = Math.max(-gainRangeDb, bestBands[b]!.gain - 10);
      const scanEnd = Math.min(0, bestBands[b]!.gain + 0);

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
        improvedThisIteration = true;
      }
    }

    if (!improvedThisPass) {
      if (outerIter === 0) reasoning.push(`Gain-optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
  }

  if (outerIter === 0) {
    reasoning.push(`Optimeret gains: [${bestBands.map((b) => b.gain.toFixed(1)).join(', ')}] dB.`);
  }

  // --- Phase 5: Fine delay optimization ---
  const delayStep = 0.05; // 50 µs resolution
  for (let pass = 0; pass < 6; pass++) {
    let improvedThisPass = false;

    for (let b = 0; b < ways; b++) {
      let bestDelay = bestBands[b]!.delay;
      let bestDelayScore = bestScore;

      // Wide scan on first pass, narrow on subsequent
      const scanRange = pass === 0 ? 2.0 : 0.5;
      const scanStart = Math.max(0, bestBands[b]!.delay - scanRange);
      const scanEnd = Math.min(maxDelayMs, bestBands[b]!.delay + scanRange);

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
        improvedThisIteration = true;
      }
    }

    if (!improvedThisPass) {
      if (outerIter === 0) reasoning.push(`Delay-optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
  }

  if (outerIter === 0) {
    reasoning.push(`Optimeret delays: [${bestBands.map((b) => b.delay.toFixed(2)).join(', ')}] ms.`);
  }

    if (!improvedThisIteration) {
      reasoning.push(`Optimering konvergeret efter ${outerIter + 1} iteration(er).`);
      break;
    }
  }

  if (outerIter === maxOuterIterations) {
    reasoning.push(`Optimering stoppede efter max ${maxOuterIterations} iterationer.`);
  }

  // --- Final score ---
  const afterScore = scoreFromBands(
    bestBands, drivers, freqs,
    baffleWidth, baffleHeight,
    cabinetType, portFb, portVb, portDiameter, numPorts,
  );

  const improvement = afterScore.score - beforeScore.score;

  reasoning.push(`Slut score: ${afterScore.score}/10 (forbedring ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} point).`);

  // --- Cabinet and driver improvement suggestions ---
  // The optimizer does NOT change cabinet design or driver selection.
  // But it can suggest improvements based on what it observed.
  if (afterScore.lfxHz > 80) {
    reasoning.push(`💡 Lavfrekvent udvidelse (LFX=${afterScore.lfxHz.toFixed(0)}Hz) kunne forbedres med et større kabinet eller ported design. Prøv Cabinet Match → Optimer kabinet.`);
  }
  if (afterScore.nbdOnAxis > 1.5) {
    reasoning.push(`💡 On-axis ujævnhed (NBD=${afterScore.nbdOnAxis.toFixed(2)}) kan tyde på at en driver har breakup eller ujævn frekvensgang. Overvej en anden driver i det pågældende bånd.`);
  }
  if (afterScore.nbdPredInRoom > 1.5) {
    reasoning.push(`💡 In-room ujævnhed (NBD_PIR=${afterScore.nbdPredInRoom.toFixed(2)}) kan reduceres ved at ændre delefilter-hældning (LR4→LR8) eller prøve en driver med bedre off-axis opførsel.`);
  }
  if (afterScore.smPredInRoom < 0.8 && afterScore.score < 7) {
    reasoning.push(`💡 Lav glathed (SM=${afterScore.smPredInRoom.toFixed(2)}) kan indikere driver-resonanser. En driver med jævnere frekvensgang kan give en højere samlet score.`);
  }

  // --- Phase coherence report at crossover points ---
  // Report any remaining phase mismatch at each XO point. For 3-way
  // systems with LR4, the midrange's outer filter adds phase at the
  // inner XO point that can't be fully corrected by delay/polarity.
  // This is a known limitation of symmetric LR4 in 3-way designs.
  {
    const SAMPLE_RATE = 48000;
    for (let i = 0; i < ways - 1 && i < bestBands.length - 1; i++) {
      const lower = bestBands[i]!;
      const upper = bestBands[i + 1]!;
      const xoFreq = lower.lowpassFreq > 0 ? lower.lowpassFreq : upper.highpassFreq;
      if (xoFreq <= 0) continue;

      // Compute phase for lower band at XO
      let lowerPhase = 0;
      if (lower.lowpassFreq > 0 && lower.lowpassFreq < 20000) {
        const lp = buildCrossoverFilter(lower.lowpassType, lower.lowpassFreq, false, SAMPLE_RATE);
        lowerPhase += filterPhaseRad(lp, xoFreq, SAMPLE_RATE);
      }
      if (lower.highpassFreq > 0) {
        const hp = buildCrossoverFilter(lower.highpassType, lower.highpassFreq, true, SAMPLE_RATE);
        lowerPhase += filterPhaseRad(hp, xoFreq, SAMPLE_RATE);
      }
      if (lower.polarity === 180) lowerPhase += Math.PI;
      if (lower.delay > 0) lowerPhase += -2 * Math.PI * xoFreq * lower.delay * 0.001;
      // EQ filter phase
      if (lower.eqFilters) {
        for (const eq of lower.eqFilters) {
          if (!eq.enabled || eq.gain === 0) continue;
          const eqBiquad = buildEqBiquad(eq.kind, eq.freq, eq.gain, eq.q, SAMPLE_RATE);
          lowerPhase += eqBiquadPhaseRad(eqBiquad, xoFreq, SAMPLE_RATE);
        }
      }

      // Compute phase for upper band at XO
      let upperPhase = 0;
      if (upper.lowpassFreq > 0 && upper.lowpassFreq < 20000) {
        const lp = buildCrossoverFilter(upper.lowpassType, upper.lowpassFreq, false, SAMPLE_RATE);
        upperPhase += filterPhaseRad(lp, xoFreq, SAMPLE_RATE);
      }
      if (upper.highpassFreq > 0) {
        const hp = buildCrossoverFilter(upper.highpassType, upper.highpassFreq, true, SAMPLE_RATE);
        upperPhase += filterPhaseRad(hp, xoFreq, SAMPLE_RATE);
      }
      if (upper.polarity === 180) upperPhase += Math.PI;
      if (upper.delay > 0) upperPhase += -2 * Math.PI * xoFreq * upper.delay * 0.001;
      // EQ filter phase
      if (upper.eqFilters) {
        for (const eq of upper.eqFilters) {
          if (!eq.enabled || eq.gain === 0) continue;
          const eqBiquad = buildEqBiquad(eq.kind, eq.freq, eq.gain, eq.q, SAMPLE_RATE);
          upperPhase += eqBiquadPhaseRad(eqBiquad, xoFreq, SAMPLE_RATE);
        }
      }

      let diffDeg = Math.abs((lowerPhase - upperPhase) * 180 / Math.PI);
      diffDeg = ((diffDeg % 360) + 540) % 360 - 180;
      diffDeg = Math.abs(diffDeg);

      const roleLabels = ['Bas', 'Mellem', 'Mellem 2', 'Diskant'];
      const label = `${roleLabels[lower.role === 'low' ? 0 : lower.role === 'mid' ? 1 : lower.role === 'mid2' ? 2 : 3]} → ${roleLabels[upper.role === 'low' ? 0 : upper.role === 'mid' ? 1 : upper.role === 'mid2' ? 2 : 3]}`;
      if (diffDeg > 60) {
        reasoning.push(`⚠️ Fasefejl ${diffDeg.toFixed(0)}° ved ${label} @ ${xoFreq.toFixed(0)}Hz. For 3-vejs med LR4 kan mellemtone's lowpass (fra XO2) skabe faseafvigelse ved XO1 der ikke fuldt ud kan korrigeres med delay/polaritet. Overvej asymmetrisk delefilter (stejlere lowpass på mellemtone) eller offset XO frekvenser.`);
      }
    }
  }

  return {
    optimizedBands: bestBands,
    originalBands: initialBands.map((b) => ({ ...b })),
    beforeScore,
    afterScore,
    improvement,
    reasoning,
  };
}
