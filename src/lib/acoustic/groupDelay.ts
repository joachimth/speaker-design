// Phase response and group delay calculation
//
// Computes the phase response of crossover filters and the combined system,
// then derives group delay (the negative derivative of phase with respect
// to frequency).
//
// Group delay is a key indicator of transient fidelity:
//   - Flat (constant) group delay = good transient response
//   - Peaks in group delay = smearing/ringing at those frequencies
//   - High group delay at low frequencies is normal (crossover + box roll-off)
//   - High group delay at crossover frequencies indicates phase misalignment
//
// The phase of each biquad section is computed from the transfer function
// H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
// evaluated at z = e^(jw) on the unit circle.

import type {
  FrequencyDataPoint,
  CrossoverType,
} from '@/types';
import {
  buildCrossoverFilter,
  biquadPhaseRad,
  filterPhaseRad,
  type BiquadCoeffs,
} from './crossover';
import { generateFrequencies } from './thieleSmall';

// ---------------------------------------------------------------------------
// Biquad phase evaluation
// ---------------------------------------------------------------------------

// biquadPhaseRad and filterPhaseRad are now imported from ./crossover

// ---------------------------------------------------------------------------
// Phase unwrapping
// ---------------------------------------------------------------------------

/**
 * Unwrap phase to remove 2π discontinuities.
 * Assumes the input is in radians and produces a continuous phase curve.
 */
function unwrapPhase(phases: number[]): number[] {
  if (phases.length === 0) return [];
  const unwrapped: number[] = [phases[0]!];
  let offset = 0;

  for (let i = 1; i < phases.length; i++) {
    const diff = phases[i]! - phases[i - 1]!;
    // If the jump is more than π, adjust
    if (diff > Math.PI) {
      offset -= 2 * Math.PI;
    } else if (diff < -Math.PI) {
      offset += 2 * Math.PI;
    }
    unwrapped.push(phases[i]! + offset);
  }

  return unwrapped;
}

// ---------------------------------------------------------------------------
// Group delay calculation
// ---------------------------------------------------------------------------

/**
 * Calculate group delay from unwrapped phase.
 *
 * Group delay = -dφ/dω = -dφ/df * (1/(2π))
 *
 * We compute the numerical derivative of the unwrapped phase (in radians)
 * with respect to frequency (in Hz), then negate and divide by 2π to get
 * seconds. Result is converted to milliseconds.
 *
 * Uses central differences for interior points, forward/backward at edges.
 */
function groupDelayFromPhase(
  freqs: number[],
  unwrappedPhaseRad: number[]
): number[] {
  const n = freqs.length;
  if (n < 2) return unwrappedPhaseRad.map(() => 0);

  const gd: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let dPhi: number;
    let dF: number;

    if (i === 0) {
      // Forward difference
      dPhi = unwrappedPhaseRad[1]! - unwrappedPhaseRad[0]!;
      dF = freqs[1]! - freqs[0]!;
    } else if (i === n - 1) {
      // Backward difference
      dPhi = unwrappedPhaseRad[n - 1]! - unwrappedPhaseRad[n - 2]!;
      dF = freqs[n - 1]! - freqs[n - 2]!;
    } else {
      // Central difference
      dPhi = unwrappedPhaseRad[i + 1]! - unwrappedPhaseRad[i - 1]!;
      dF = freqs[i + 1]! - freqs[i - 1]!;
    }

    // Group delay = -dφ/dω = -dφ/(2π df)  [seconds]
    // → milliseconds: × 1000
    if (Math.abs(dF) < 1e-10) {
      gd[i] = 0;
    } else {
      gd[i] = (-dPhi / (2 * Math.PI * dF)) * 1000; // ms
    }
  }

  return gd;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PhaseResult {
  freq: number[];         // [Hz]
  phase: number[];        // [degrees, unwrapped]
}

export interface GroupDelayResult {
  freq: number[];         // [Hz]
  groupDelay: number[];   // [ms]
}

export interface FilterPhaseResult {
  freq: number[];
  magnitudeDb: number[];  // [dB]
  phaseDeg: number[];     // [degrees, unwrapped]
  groupDelayMs: number[]; // [ms]
}

// ---------------------------------------------------------------------------
// Crossover filter phase and group delay
// ---------------------------------------------------------------------------

/**
 * Calculate the phase response and group delay of a single crossover filter.
 *
 * @param type Crossover type (LR4, BW2, etc.)
 * @param fc Cutoff frequency [Hz]
 * @param isHighpass true for highpass, false for lowpass
 * @param sampleRate Digital sample rate [Hz]
 * @param freqs Frequency array [Hz], or undefined to auto-generate
 */
export function calcFilterPhase(
  type: CrossoverType,
  fc: number,
  isHighpass: boolean,
  sampleRate: number = 48000,
  freqs?: number[]
): FilterPhaseResult {
  const frequencies = freqs ?? generateFrequencies(10, 20000, 24);
  const filter = buildCrossoverFilter(type, fc, isHighpass, sampleRate);

  // Phase in radians per frequency
  const phasesRad = frequencies.map((f) => filterPhaseRad(filter, f, sampleRate));
  const unwrapped = unwrapPhase(phasesRad);

  // Magnitude in dB (re-evaluate for completeness)
  const magnitudeDb = frequencies.map((f) => {
    let totalDb = 0;
    for (const section of filter.sections) {
      totalDb += biquadMagnitudeDb(section, f, sampleRate);
    }
    return totalDb;
  });

  // Group delay
  const gdMs = groupDelayFromPhase(frequencies, unwrapped);

  return {
    freq: frequencies,
    magnitudeDb,
    phaseDeg: unwrapped.map((p) => (p * 180) / Math.PI),
    groupDelayMs: gdMs,
  };
}

// ---------------------------------------------------------------------------
// System-level phase and group delay
// ---------------------------------------------------------------------------

import type { Driver, Crossover, Cabinet } from '@/types';
import { applyCrossover, applyGainAndPolarity } from './crossover';
import { calcBaffleStep, baffleStepFrequency } from './baffle';

/**
 * Calculate the combined system phase and group delay.
 *
 * This computes the phase of each driver's filtered response (crossover +
 * baffle step + gain) and sums them as a coherent voltage sum, then derives
 * the group delay of the total system.
 *
 * Note: individual driver phase responses from measured frequency data are
 * not available (we only have magnitude data). The phase computed here is
 * the *crossover filter phase* — i.e., the phase shift introduced by the
 * crossover network. This is the dominant contribution to system group delay
 * variation and is the standard way to evaluate crossover time alignment.
 */
export function calcSystemPhase(
  drivers: Driver[],
  crossover: Crossover,
  cabinet: Cabinet,
  sampleRate: number = 48000
): { systemPhase: PhaseResult; systemGroupDelay: GroupDelayResult; perBand: FilterPhaseResult[] } {
  const frequencies = generateFrequencies(20, 20000, 12);

  const baffleW = cabinet.dimensions.baffleWidth || cabinet.dimensions.width;
  const baffleH = cabinet.dimensions.baffleHeight || cabinet.dimensions.height;
  const fStep = baffleStepFrequency(baffleW);
  const fStep3x = fStep * 3;
  const baffleStep = calcBaffleStep(baffleW, baffleH, frequencies);

  const perBand: FilterPhaseResult[] = [];
  const bandPhasesRad: number[][] = [];
  const bandMagnitudesLinear: number[][] = [];

  for (const band of crossover.bands) {
    const driver = drivers.find((d) => d.id === band.driverId);
    if (!driver || !driver.frequencyResponse) continue;

    // Get driver on-axis response
    let curve: FrequencyDataPoint[] = [...driver.frequencyResponse];

    // Apply baffle step (same logic as simulateSystem)
    const isLowDriver = driver.type === 'woofer' || driver.type === 'subwoofer';
    const isMidDriver = driver.type === 'midrange';

    if (isLowDriver || isMidDriver) {
      curve = curve.map((p, i) => {
        let bsFactor = baffleStep.response[i] ?? 0;
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep));
          bsFactor *= (1 - t);
        }
        return { freq: p.freq, magnitude: p.magnitude + bsFactor };
      });
    }

    // Apply crossover filters (magnitude)
    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const lpFilter = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false);
      curve = applyCrossover(lpFilter, curve, sampleRate);
    }
    if (band.highpassFreq > 0) {
      const hpFilter = buildCrossoverFilter(band.highpassType, band.highpassFreq, true);
      curve = applyCrossover(hpFilter, curve, sampleRate);
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity);

    // Compute the filter phase for this band's crossover
    // We need the combined phase of all filter sections applied to this band
    const allFilterSections: BiquadCoeffs[] = [];
    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const lpFilter = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false, sampleRate);
      allFilterSections.push(...lpFilter.sections);
    }
    if (band.highpassFreq > 0) {
      const hpFilter = buildCrossoverFilter(band.highpassType, band.highpassFreq, true, sampleRate);
      allFilterSections.push(...hpFilter.sections);
    }

    // Compute phase for each frequency
    const phasesRad = frequencies.map((f) => {
      let totalPhase = 0;
      for (const section of allFilterSections) {
        totalPhase += biquadPhaseRad(section, f, sampleRate);
      }
      // Add polarity inversion (180° = π radians)
      if (band.polarity === 180) {
        totalPhase += Math.PI;
      }
      // Add delay phase shift: φ = -2π * f * delay
      if (band.delay > 0) {
        totalPhase += -2 * Math.PI * f * band.delay * 0.001; // delay in ms → s
      }
      return totalPhase;
    });

    // Magnitude in linear (from the processed curve, interpolated to our frequency grid)
    // Polarity is applied as a π phase shift below, NOT as a sign flip here
    const magsLinear = frequencies.map((f) => {
      const db = interpolateDbAt(curve, f);
      return Math.pow(10, db / 20);
    });

    bandPhasesRad.push(phasesRad);
    bandMagnitudesLinear.push(magsLinear);

    // Per-band result (for individual display)
    const unwrappedBand = unwrapPhase(phasesRad);
    perBand.push({
      freq: frequencies,
      magnitudeDb: magsLinear.map((m) => 20 * Math.log10(Math.max(Math.abs(m), 1e-10))),
      phaseDeg: unwrappedBand.map((p) => (p * 180) / Math.PI),
      groupDelayMs: groupDelayFromPhase(frequencies, unwrappedBand),
    });
  }

  // Sum bands coherently (complex voltage sum)
  // Each band contributes: magnitude_linear * e^(j*phase)
  const systemComplex = frequencies.map((_f, i) => {
    let sumReal = 0;
    let sumImag = 0;
    for (let b = 0; b < bandPhasesRad.length; b++) {
      const mag = bandMagnitudesLinear[b]![i]!;
      const ph = bandPhasesRad[b]![i]!;
      sumReal += mag * Math.cos(ph);
      sumImag += mag * Math.sin(ph);
    }
    return { re: sumReal, im: sumImag };
  });

  // System phase = atan2(sumImag, sumReal)
  const systemPhaseRad = systemComplex.map((c) => Math.atan2(c.im, c.re));
  const unwrappedSystem = unwrapPhase(systemPhaseRad);

  const systemGroupDelay = groupDelayFromPhase(frequencies, unwrappedSystem);

  return {
    systemPhase: {
      freq: frequencies,
      phase: unwrappedSystem.map((p) => (p * 180) / Math.PI),
    },
    systemGroupDelay: {
      freq: frequencies,
      groupDelay: systemGroupDelay,
    },
    perBand,
  };
}

// ---------------------------------------------------------------------------
// Helper: interpolate dB at a frequency
// ---------------------------------------------------------------------------

function interpolateDbAt(curve: FrequencyDataPoint[], freq: number): number {
  if (curve.length === 0) return 0;
  if (freq <= curve[0]!.freq) return curve[0]!.magnitude;
  if (freq >= curve[curve.length - 1]!.freq) return curve[curve.length - 1]!.magnitude;

  let lo = 0;
  let hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (curve[mid]!.freq < freq) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const p0 = curve[lo]!;
  const p1 = curve[hi]!;
  const t = (Math.log(freq) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq));
  return p0.magnitude + t * (p1.magnitude - p0.magnitude);
}

// ---------------------------------------------------------------------------
// Helper: biquad magnitude (duplicated from crossover.ts to avoid circular import)
// ---------------------------------------------------------------------------

function biquadMagnitudeDb(coeffs: BiquadCoeffs, f: number, sampleRate: number): number {
  const w = (2 * Math.PI * f) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  const numReal = coeffs.b0 + coeffs.b1 * cosW + coeffs.b2 * cos2W;
  const numImag = -(coeffs.b1 * sinW + coeffs.b2 * sin2W);
  const denReal = 1 + coeffs.a1 * cosW + coeffs.a2 * cos2W;
  const denImag = -(coeffs.a1 * sinW + coeffs.a2 * sin2W);

  const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
  const denMag = Math.sqrt(denReal * denReal + denImag * denImag);

  return 20 * Math.log10(numMag / denMag);
}

// ---------------------------------------------------------------------------
// Group delay quality assessment
// ---------------------------------------------------------------------------

export interface GroupDelayAssessment {
  /** Peak group delay [ms] */
  peakGd: number;
  /** Frequency at peak [Hz] */
  fPeakGd: number;
  /** Group delay at 100 Hz [ms] */
  gd100Hz: number;
  /** Group delay at 1 kHz [ms] */
  gd1kHz: number;
  /** Group delay variation in midband (200 Hz - 2 kHz) [ms] */
  midbandVariation: number;
  /** Assessment: 'good' | 'acceptable' | 'poor' */
  rating: 'good' | 'acceptable' | 'poor';
  /** Human-readable description */
  description: string;
}

/**
 * Assess group delay quality.
 *
 * Rule of thumb:
 *   - < 2 ms variation in midband = good
 *   - 2-4 ms = acceptable
 *   - > 4 ms = poor (audible smearing)
 */
export function assessGroupDelay(gd: GroupDelayResult): GroupDelayAssessment {
  const { freq, groupDelay } = gd;

  // Peak
  let peakGd = 0;
  let fPeakGd = 0;
  for (let i = 0; i < groupDelay.length; i++) {
    if (groupDelay[i]! > peakGd) {
      peakGd = groupDelay[i]!;
      fPeakGd = freq[i]!;
    }
  }

  // Values at specific frequencies
  const gdAt = (target: number): number => {
    const idx = freq.findIndex((f) => f >= target);
    if (idx < 0) return groupDelay[groupDelay.length - 1] ?? 0;
    return groupDelay[idx]!;
  };

  const gd100Hz = gdAt(100);
  const gd1kHz = gdAt(1000);

  // Midband variation (200 Hz - 2 kHz)
  const midbandGd = groupDelay.filter((_, i) => freq[i]! >= 200 && freq[i]! <= 2000);
  const midbandMin = midbandGd.length > 0 ? Math.min(...midbandGd) : 0;
  const midbandMax = midbandGd.length > 0 ? Math.max(...midbandGd) : 0;
  const midbandVariation = midbandMax - midbandMin;

  // Rating
  let rating: 'good' | 'acceptable' | 'poor';
  let description: string;

  if (midbandVariation < 2) {
    rating = 'good';
    description = `Flad gruppetid i mellemtonen (${midbandVariation.toFixed(1)} ms variation). God transient-gengivelse.`;
  } else if (midbandVariation < 4) {
    rating = 'acceptable';
    description = `Moderat gruppetid-variation (${midbandVariation.toFixed(1)} ms i mellemtonen). Acceptabel, men kan forbedres med tidsjustering.`;
  } else {
    rating = 'poor';
    description = `Stor gruppetid-variation (${midbandVariation.toFixed(1)} ms i mellemtonen). Hørbar smearing af transienter. Overvej tidsjustering af enheder eller stejlere delefilter.`;
  }

  return {
    peakGd,
    fPeakGd,
    gd100Hz,
    gd1kHz,
    midbandVariation,
    rating,
    description,
  };
}
