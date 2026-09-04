// Shared band simulation logic — single source of truth for processing
// driver responses through cabinet, baffle step, crossover filters, EQ,
// gain/polarity, and complex voltage summation.
//
// Used by:
//   - preferenceOptimizer.ts (imports simulateOnAxisWithBands)
//   - simulationWorker.ts (imports processBands + complexSum)
//
// This ensures the optimizer and the simulation worker compute identical
// curves — the recurring source of score-vs-display mismatches.

import type {
  Driver,
  DesignBand,
  FrequencyDataPoint,
  CabinetType,
  CrossoverType,
} from '@/types';
import {
  buildCrossoverFilter,
  applyCrossover,
  applyGainAndPolarity,
  filterPhaseRad,
  buildEqBiquad,
  applyEqBiquad,
  eqBiquadPhaseRad,
  type CrossoverFilter,
  type BiquadCoeffs,
} from './crossover';
import { calcCabinetResponse } from './cabinetResponse';
import { calcBaffleStep, calcBaffleStepCompensation } from './baffle';
import { pistonDiameter, acousticCenterDepth } from './autoDesign';

export const SHARED_SAMPLE_RATE = 48000;

export interface BandFilters {
  lp: CrossoverFilter | null;
  hp: CrossoverFilter | null;
  eqs: BiquadCoeffs[];
}

export interface ProcessedBand {
  band: DesignBand;
  driverId: string;
  curve: FrequencyDataPoint[];
  hasRealResponse: boolean;
  filters: BandFilters;
}

/**
 * Resample a frequency response curve to a target frequency grid
 * using log-space linear interpolation.
 */
export function resampleToFreqs(
  src: FrequencyDataPoint[],
  freqs: number[],
): FrequencyDataPoint[] {
  if (src.length === 0) return freqs.map((f) => ({ freq: f, magnitude: 0 }));
  return freqs.map((f) => {
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

/**
 * Process a single band: resample driver response, apply cabinet response,
 * baffle step + compensation, crossover filters, EQ filters, gain/polarity.
 * Returns the processed curve and the filter objects (for phase computation).
 */
export function processBand(
  band: DesignBand,
  driver: Driver | undefined,
  freqs: number[],
  baffleStepResult: ReturnType<typeof calcBaffleStep>,
  baffleComp: number[],
  fStep: number,
  fStep3x: number,
  cabinetType: string,
  portFb: number,
  portVb: number,
  portDiameter: number,
  numPorts: number,
  baffleWidth: number = 300,
): { curve: FrequencyDataPoint[]; filters: BandFilters; hasRealResponse: boolean } | null {
  if (!driver) return null;

  const driverCount = band.driverCount ?? 1;
  const hasRealResponse = !!driver.frequencyResponse && driver.frequencyResponse.length > 0;
  const countGainDb = 10 * Math.log10(driverCount);

  let curve: FrequencyDataPoint[];
  if (hasRealResponse && driver.frequencyResponse) {
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

  if (isLowDriver) {
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
      return { freq: p.freq, magnitude: p.magnitude + bsFactor + compFactor };
    });
  }

  // Crossover filters
  let lpFilter: CrossoverFilter | null = null;
  let hpFilter: CrossoverFilter | null = null;

  if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
    lpFilter = buildCrossoverFilter(band.lowpassType as CrossoverType, band.lowpassFreq, false, SHARED_SAMPLE_RATE);
    curve = applyCrossover(lpFilter, curve, SHARED_SAMPLE_RATE);
  }
  if (band.highpassFreq > 0) {
    hpFilter = buildCrossoverFilter(band.highpassType as CrossoverType, band.highpassFreq, true, SHARED_SAMPLE_RATE);
    curve = applyCrossover(hpFilter, curve, SHARED_SAMPLE_RATE);
  }

  // EQ filters (only on bands with active crossover)
  const hasActiveXover = (band.lowpassFreq > 0 && band.lowpassFreq < 20000) || (band.highpassFreq > 0);
  const eqBiquads: BiquadCoeffs[] = [];
  if (hasActiveXover && band.eqFilters) {
    for (const eq of band.eqFilters) {
      if (!eq.enabled || eq.gain === 0) continue;
      const biquad = buildEqBiquad(eq.kind, eq.freq, eq.gain, eq.q, SHARED_SAMPLE_RATE);
      eqBiquads.push(biquad);
      curve = applyEqBiquad(biquad, curve, SHARED_SAMPLE_RATE);
    }
  }

  curve = applyGainAndPolarity(curve, band.gain, band.polarity);

  return { curve, filters: { lp: lpFilter, hp: hpFilter, eqs: eqBiquads }, hasRealResponse };
}

/**
 * Complex voltage summation of processed band curves.
 * Each band contributes: magnitude * e^(j * totalPhase)
 * where totalPhase = filterPhase(LP+HP) + EQPhase + polarity(π) + delay(-2πf*delay)
 */
export function complexSum(
  processedBands: ProcessedBand[],
  freqs: number[],
  sampleRate: number = SHARED_SAMPLE_RATE,
): FrequencyDataPoint[] {
  return freqs.map((f, fi) => {
    let sumReal = 0;
    let sumImag = 0;
    for (const pb of processedBands) {
      const db = pb.curve[fi]?.magnitude ?? 0;
      const mag = Math.pow(10, db / 20);

      let phase = 0;
      if (pb.filters.hp) phase += filterPhaseRad(pb.filters.hp, f, sampleRate);
      if (pb.filters.lp) phase += filterPhaseRad(pb.filters.lp, f, sampleRate);
      for (const eqBiquad of pb.filters.eqs) {
        phase += eqBiquadPhaseRad(eqBiquad, f, sampleRate);
      }
      if (pb.band.polarity === 180) phase += Math.PI;
      if (pb.band.delay > 0) phase += -2 * Math.PI * f * pb.band.delay * 0.001;

      sumReal += mag * Math.cos(phase);
      sumImag += mag * Math.sin(phase);
    }
    const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    return { freq: f, magnitude: 20 * Math.log10(mag + 1e-10) };
  });
}

/**
 * Full simulation: process all bands and complex-sum them.
 * Returns both the summed on-axis response and per-band curve data
 * (for directivity / spinorama computation).
 */
export interface BandCurveData {
  curve: number[];
  diameter: number;
}

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
): { summed: FrequencyDataPoint[]; bandCurves: BandCurveData[]; processedBands: ProcessedBand[] } {
  const baffleStepResult = calcBaffleStep(baffleWidth, baffleHeight, freqs);
  const fStep = 343000 / (2 * baffleWidth);
  const fStep3x = fStep * 3;
  const baffleCompDb = Math.abs(baffleStepResult.response[0] ?? 6);
  const baffleComp = calcBaffleStepCompensation(fStep, baffleCompDb, freqs);

  const processedBands: ProcessedBand[] = [];

  for (const band of bands) {
    const driver = drivers.find((d) => d.id === band.driverId);
    const result = processBand(
      band, driver, freqs,
      baffleStepResult, baffleComp,
      fStep, fStep3x,
      cabinetType, portFb, portVb, portDiameter, numPorts,
      baffleWidth,
    );
    if (!result) continue;
    processedBands.push({
      band,
      driverId: band.driverId,
      curve: result.curve,
      hasRealResponse: result.hasRealResponse,
      filters: result.filters,
    });
  }

  const summed = complexSum(processedBands, freqs);

  const bandCurves: BandCurveData[] = processedBands.map((pb) => {
    const driver = drivers.find((d) => d.id === pb.band.driverId) ?? drivers[0]!;
    return {
      curve: pb.curve.map((p) => p.magnitude),
      diameter: pistonDiameter(driver),
    };
  });

  return { summed, bandCurves, processedBands };
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

// Re-export for backward compatibility
export { acousticCenterDepth };
