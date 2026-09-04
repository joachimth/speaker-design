// Baffle step and edge diffraction
//
// A driver on a finite baffle transitions from 4π (omnidirectional) radiation
// at low frequencies to 2π (half-space) radiation at high frequencies. This
// causes an apparent ~6dB SPL increase in the on-axis response as frequency
// rises — equivalently, a -6dB loss at low frequencies relative to the high-
// frequency 2π reference.
//
// Model: First-order low-shelf filter.
//   loss(f) = -6 / (1 + (f/f_step)^2)
//
// This gives:
//   -6 dB at DC     (-6 dB loss = 4π radiation)
//   -3 dB at f_step
//    0 dB at HF      (0 dB loss = 2π, infinite-baffle reference)
//
// The transition has a 6 dB/octave slope (first-order characteristic).
//
// Baffle step frequency (rectangular baffle, standard model):
//   f_step = c / (2 * baffle_width)
// where the baffle width is the limiting dimension (shortest edge distance).
//
// Reference: Olson, "Direct Radiator Loudspeaker Enclosures" (JAES 1969);
//            D'Appolito, "Testing Loudspeakers"; Keele, "Low-Frequency
//            Loudspeaker Assessment."

import type { BaffleStepResult } from '@/types';

// Speed of sound [mm/s]
const C = 343000;

/**
 * Calculate baffle step loss using a first-order low-shelf model.
 *
 * The response transitions smoothly from -6dB at DC (4π radiation) to 0dB
 * at high frequencies (2π half-space). The -3dB point is at f_step, which
 * depends primarily on the baffle width (shortest edge).
 *
 * The baffle step affects ONLY drivers below ~2× f_step. Above that, the
 * effect is negligible (<1dB). In practice, this primarily affects woofers
 * and lower-midrange drivers — tweeters operate well above f_step.
 *
 * When driverXOffset and driverYPos are provided, the effective baffle
 * dimension is computed as the minimum distance from the driver to any
 * baffle edge (doubled, since the model uses c/(2*d)). An off-center driver
 * has a shorter effective baffle dimension, raising f_step and reducing the
 * baffle step loss at a given frequency. This matches the physical reality
 * that a driver near a baffle edge transitions to 2π radiation at higher
 * frequencies.
 *
 * @param driverXOffset  Horizontal offset from baffle center [mm] (0 = center)
 * @param driverYPos     Vertical position from baffle top [mm] (optional)
 */
export function calcBaffleStep(
  baffleWidth: number,
  _baffleHeight: number,
  frequencies: number[],
  driverXOffset?: number,
  driverYPos?: number,
): BaffleStepResult {
  // Compute the effective baffle dimension.
  // For a centered driver: effective = baffleWidth (standard model).
  // For an off-center driver: effective = 2 × min distance to any edge.
  let effectiveWidth = baffleWidth;

  if (driverXOffset !== undefined && driverXOffset !== 0) {
    const distLeft = baffleWidth / 2 + driverXOffset;
    const distRight = baffleWidth / 2 - driverXOffset;
    const minHoriz = Math.min(distLeft, distRight);
    // Use the smaller of: baffle width, or 2× nearest horizontal edge distance
    effectiveWidth = Math.min(baffleWidth, 2 * minHoriz);
  }

  if (driverYPos !== undefined && _baffleHeight > 0) {
    const distTop = driverYPos;
    const distBottom = _baffleHeight - driverYPos;
    const minVert = Math.min(distTop, distBottom);
    // Take the overall minimum across both dimensions
    effectiveWidth = Math.min(effectiveWidth, 2 * minVert);
  }

  // Baffle step frequency: f_step = c / (2 * effective_width)
  const fStep = C / (2 * effectiveWidth);

  // First-order low-shelf: -6 / (1 + (f/f_step)^2)
  // This is a proper 6dB/octave shelf with correct asymptotic behavior.
  const response = frequencies.map((f) => {
    const ratio = f / fStep;
    return -6 / (1 + ratio * ratio);
  });

  return { freq: frequencies, response };
}

/**
 * Calculate baffle step compensation (low-shelf boost).
 *
 * This produces a +6dB boost at low frequencies, tapering to 0dB above
 * f_step, intended to flatten the on-axis response. The compensation is
 * a first-order low-shelf filter.
 *
 * In practice, apply this to woofer (and optionally mid) channels only.
 * Applying it to a tweeter that operates well above f_step would boost
 * frequencies where no compensation is needed.
 *
 * @param fStep - baffle step frequency [Hz]
 * @param compensationDb - amount of compensation (0 = none, 6 = full)
 * @param frequencies - frequency array
 * @returns compensation curve in dB
 */
export function calcBaffleStepCompensation(
  fStep: number,
  compensationDb: number,
  frequencies: number[]
): number[] {
  return frequencies.map((f) => {
    const ratio = f / fStep;
    // First-order low-shelf boost: full at DC, tapering to 0 at HF
    return compensationDb / (1 + ratio * ratio);
  });
}

/**
 * Get the baffle step frequency for a given baffle width.
 *
 * Uses the rectangular baffle model: f_step = c / (2 * width)
 */
export function baffleStepFrequency(baffleWidth: number): number {
  return C / (2 * baffleWidth);
}

/**
 * Calculate the effect of front-edge roundovers on baffle diffraction.
 */
export function roundoverEffect(
  roundoverRadius: number,
  frequencies: number[]
): number[] {
  const fRoundover = C / (4 * roundoverRadius);
  return frequencies.map((f) => 1 / (1 + (f / fRoundover) ** 2));
}
