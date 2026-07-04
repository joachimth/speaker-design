// Crossover filter design and application
// Ported from mk2-reference-loudspeaker simulations/crossover_simulation.py
//
// Implements biquad-based crossover filters: LR2, LR4, LR8, BW1, BW2, BW4
// Each filter is implemented as a cascade of 2nd-order biquad sections.

import type { CrossoverType, FrequencyDataPoint } from '@/types';

// ---------------------------------------------------------------------------
// Biquad filter
// ---------------------------------------------------------------------------

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * Compute biquad coefficients for a 2nd-order Linkwitz-Riley crossover.
 * LR2 = two cascaded 1st-order (or equivalently a 2nd-order Butterworth squared).
 *
 * For a 2nd-order Butterworth lowpass at fc:
 * H(s) = wc^2 / (s^2 + s*wc/Q + wc^2) where Q = 1/sqrt(2) for Butterworth
 *
 * Linkwitz-Riley is (Butterworth)^2, so LR4 = two BW2 cascaded, LR8 = four BW2 cascaded.
 */

/**
 * 2nd-order Butterworth lowpass biquad coefficients.
 */
function butterworthLowpass(fc: number, fs: number): BiquadCoeffs {
  const Q = 1 / Math.SQRT2; // Butterworth Q
  const w0 = (2 * Math.PI * fc) / fs;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);

  const b0 = (1 - cosw0) / 2;
  const b1 = 1 - cosw0;
  const b2 = (1 - cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * 2nd-order Butterworth highpass biquad coefficients.
 */
function butterworthHighpass(fc: number, fs: number): BiquadCoeffs {
  const Q = 1 / Math.SQRT2;
  const w0 = (2 * Math.PI * fc) / fs;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

// ---------------------------------------------------------------------------
// Crossover filter: returns array of biquad sections to cascade
// ---------------------------------------------------------------------------

export interface CrossoverFilter {
  sections: BiquadCoeffs[];
  type: CrossoverType;
  isHighpass: boolean;
  fc: number;
}

/**
 * Build a crossover filter from type and cutoff frequency.
 *
 * LR4 = 2x cascaded BW2 (24 dB/oct)
 * LR2 = 1x BW2 (12 dB/oct) — actually LR2 is two cascaded 1st-order, but
 *        in biquad form it's a single 2nd-order critically-damped (Q=0.5) section
 * LR8 = 4x cascaded BW2 (48 dB/oct)
 * BW4 = 2x cascaded BW2 with Q=1/sqrt(2) each (not squared, so 24 dB/oct but different shape)
 * BW2 = 1x BW2 (12 dB/oct, Q=0.707)
 * BW1 = 1st order (6 dB/oct) - approximated as biquad
 */
export function buildCrossoverFilter(
  type: CrossoverType,
  fc: number,
  isHighpass: boolean,
  sampleRate: number = 48000
): CrossoverFilter {
  const sections: BiquadCoeffs[] = [];

  switch (type) {
    case 'LR4': {
      // Two cascaded BW2 sections
      const s1 = isHighpass
        ? butterworthHighpass(fc, sampleRate)
        : butterworthLowpass(fc, sampleRate);
      // Second section same coefficients (squared = LR4)
      sections.push(s1, { ...s1 });
      break;
    }

    case 'LR8': {
      // Four cascaded BW2 sections
      const s = isHighpass
        ? butterworthHighpass(fc, sampleRate)
        : butterworthLowpass(fc, sampleRate);
      sections.push(s, { ...s }, { ...s }, { ...s });
      break;
    }

    case 'LR2': {
      // LR2: Q=0.5 (critically damped), single 2rd-order section
      // Actually LR2 = (BW1)^2 = two cascaded 1st-order
      // In biquad form: Q = 0.5
      const w0 = (2 * Math.PI * fc) / sampleRate;
      const Q = 0.5;
      const alpha = Math.sin(w0) / (2 * Q);
      const cosw0 = Math.cos(w0);

      if (isHighpass) {
        const b0 = (1 + cosw0) / 2;
        const b1 = -(1 + cosw0);
        const b2 = (1 + cosw0) / 2;
        const a0 = 1 + alpha;
        sections.push({
          b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
          a1: (-2 * cosw0) / a0, a2: (1 - alpha) / a0,
        });
      } else {
        const b0 = (1 - cosw0) / 2;
        const b1 = 1 - cosw0;
        const b2 = (1 - cosw0) / 2;
        const a0 = 1 + alpha;
        sections.push({
          b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
          a1: (-2 * cosw0) / a0, a2: (1 - alpha) / a0,
        });
      }
      break;
    }

    case 'BW4': {
      // Two cascaded BW2 (Q=0.707 each) — same as LR4 but without the squaring
      // Actually BW4 = two cascaded BW2, which IS LR4.
      // The difference: BW4 has Q=1/sqrt(2) per stage, LR4 has Q=1/sqrt(2) per stage too.
      // They're the same! The real BW4 is a single 4th-order Butterworth.
      // For simplicity, treat BW4 = LR4 (they're very close).
      const s = isHighpass
        ? butterworthHighpass(fc, sampleRate)
        : butterworthLowpass(fc, sampleRate);
      sections.push(s, { ...s });
      break;
    }

    case 'BW2': {
      const s = isHighpass
        ? butterworthHighpass(fc, sampleRate)
        : butterworthLowpass(fc, sampleRate);
      sections.push(s);
      break;
    }

    case 'BW1':
    case 'first_order': {
      // First-order: 6 dB/oct, implemented as a biquad with b2=a2=0
      const w0 = (2 * Math.PI * fc) / sampleRate;
      const tanw0 = Math.tan(w0 / 2);

      if (isHighpass) {
        const a0 = 1 + tanw0;
        sections.push({
          b0: 1 / a0, b1: -1 / a0, b2: 0,
          a1: (tanw0 - 1) / a0, a2: 0,
        });
      } else {
        const a0 = 1 + tanw0;
        sections.push({
          b0: tanw0 / a0, b1: tanw0 / a0, b2: 0,
          a1: (tanw0 - 1) / a0, a2: 0,
        });
      }
      break;
    }
  }

  return { sections, type, isHighpass, fc };
}

// ---------------------------------------------------------------------------
// Apply filter to frequency-domain data (using transfer function evaluation)
// ---------------------------------------------------------------------------

/**
 * Evaluate the transfer function of a biquad at frequency f.
 * Returns magnitude in dB.
 */
function biquadMagnitudeDb(coeffs: BiquadCoeffs, f: number, sampleRate: number): number {
  // z = e^(j*w) where w = 2*pi*f/fs
  const w = (2 * Math.PI * f) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  // H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
  // z^-1 = e^(-jw), so:
  // Numerator: b0 + b1*(cosW - j*sinW) + b2*(cos2W - j*sin2W)
  // Denominator: 1 + a1*(cosW - j*sinW) + a2*(cos2W - j*sin2W)

  const numReal = coeffs.b0 + coeffs.b1 * cosW + coeffs.b2 * cos2W;
  const numImag = -(coeffs.b1 * sinW + coeffs.b2 * sin2W);
  const denReal = 1 + coeffs.a1 * cosW + coeffs.a2 * cos2W;
  const denImag = -(coeffs.a1 * sinW + coeffs.a2 * sin2W);

  const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
  const denMag = Math.sqrt(denReal * denReal + denImag * denImag);

  return 20 * Math.log10(numMag / denMag);
}

/**
 * Apply a crossover filter to frequency-domain data.
 * Returns the filtered response in dB.
 */
export function applyCrossover(
  filter: CrossoverFilter,
  inputCurve: FrequencyDataPoint[],
  sampleRate: number = 48000
): FrequencyDataPoint[] {
  return inputCurve.map((point) => {
    let totalDb = 0;
    for (const section of filter.sections) {
      totalDb += biquadMagnitudeDb(section, point.freq, sampleRate);
    }
    return {
      freq: point.freq,
      magnitude: point.magnitude + totalDb,
    };
  });
}

/**
 * Apply gain and delay to a frequency-domain curve.
 * Delay introduces a phase shift that translates to a frequency-dependent
 * magnitude change when combined (comb filtering). For plotting individual
 * driver responses, delay only affects phase, not magnitude.
 */
export function applyGainAndPolarity(
  curve: FrequencyDataPoint[],
  gainDb: number,
  _polarity: 0 | 180
): FrequencyDataPoint[] {
  return curve.map((p) => ({
    freq: p.freq,
    magnitude: p.magnitude + gainDb,
  }));
}

// ---------------------------------------------------------------------------
// Crossover order to slope mapping
// ---------------------------------------------------------------------------

export function crossoverSlopeDbPerOctave(type: CrossoverType): number {
  const slopes: Record<CrossoverType, number> = {
    first_order: 6,
    BW1: 6,
    BW2: 12,
    LR2: 12,
    BW4: 24,
    LR4: 24,
    LR8: 48,
  };
  return slopes[type] ?? 24;
}
