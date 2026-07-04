// Baffle step and edge diffraction
// Ported from mk2-reference-loudspeaker simulations/baffle_step.py concept
//
// The baffle step occurs when the wavelength becomes smaller than the baffle
// dimension. Below the step, sound radiates omnidirectionally (4π). Above it,
// radiation narrows to 2π (front hemisphere only). This causes a +6dB rise
// from low to high frequencies on a finite baffle.
//
// Model: Olson's spherical source diffraction model + edge diffraction
// Reference: Olson, "Dynamical Analogies" + Backman's diffraction model

import type { BaffleStepResult } from '@/types';

// Speed of sound [mm/s]
const C = 343000;

/**
 * Calculate baffle step response using the Olson model.
 *
 * The baffle step frequency is approximately:
 * f_step = c / (2 * baffle_width) ... where the wavelength equals the baffle width.
 * The transition is gradual, centered around f_step.
 *
 * Model: The response transitions from -6dB (4π) to 0dB (2π) around f_step.
 * We use a first-order shelf filter approximation:
 * H(f) = 1 / sqrt(1 + (f_step / f)^(2*n))
 * where n controls the steepness (typically n=1 for a gradual transition).
 *
 * Edge diffraction ripples are added using a simplified model:
 * The path difference between direct sound and edge-diffracted sound causes
 * constructive/destructive interference at frequencies where the path
 * difference equals multiples of half-wavelengths.
 */
export function calcBaffleStep(
  baffleWidth: number,
  baffleHeight: number,
  frequencies: number[]
): BaffleStepResult {
  // Baffle step frequency (approximate): use the average dimension
  const avgBaffle = (baffleWidth + baffleHeight) / 2;
  const fStep = C / (2 * Math.PI * avgBaffle); // circular baffle approximation

  // Main baffle step: gradual -6dB → 0dB shelf
  // At low freq (ratio << 1): response ≈ -6dB (4π radiation)
  // At high freq (ratio >> 1): response ≈ 0dB (2π radiation)
  const response = frequencies.map((f) => {
    // Shelf filter: transitions from -6dB to 0dB
    const ratio = f / fStep;
    // -6 * 1/(sqrt(1 + ratio^2)) gives -6dB at DC, 0dB at high freq
    const shelfDb = -6 / Math.sqrt(1 + ratio * ratio);

    // Edge diffraction ripple
    // The first ripple peak occurs at roughly f = c / (baffle_dimension)
    // Amplitude depends on edge sharpness (roundover radius)
    const rippleAmp = 1.5; // dB, typical for sharp edges
    const rippleFreq = C / baffleWidth;
    const ripplePhase = (2 * Math.PI * f) / rippleFreq;

    // Multiple edge diffraction sources (4 edges of rectangular baffle)
    const ripple1 = rippleAmp * Math.cos(ripplePhase) * Math.exp(-f / (rippleFreq * 4));
    const rippleFreq2 = C / baffleHeight;
    const ripple2 = rippleAmp * Math.cos((2 * Math.PI * f) / rippleFreq2) * Math.exp(-f / (rippleFreq2 * 4));

    return shelfDb + ripple1 * 0.3 + ripple2 * 0.3;
  });

  return { freq: frequencies, response };
}

/**
 * Calculate baffle step compensation filter.
 *
 * This is a shelving filter that boosts the low frequencies by up to 6dB
 * to compensate for the baffle step loss.
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
    // Low-shelf: full boost below fStep, tapering to 0dB above
    const shelf = compensationDb * (1 / Math.sqrt(1 + ratio * ratio));
    return shelf;
  });
}

/**
 * Get the baffle step frequency for a given baffle dimension.
 */
export function baffleStepFrequency(baffleWidth: number, baffleHeight: number): number {
  const avg = (baffleWidth + baffleHeight) / 2;
  return C / (2 * Math.PI * avg);
}

/**
 * Calculate the effect of front-edge roundovers on baffle diffraction.
 *
 * Larger roundover radius → smoother transition, less ripple.
 * Rule of thumb: roundover should be at least 1/4 wavelength at the
 * highest frequency of interest for the driver on the baffle.
 */
export function roundoverEffect(
  roundoverRadius: number,
  frequencies: number[]
): number[] {
  // The roundover reduces diffraction ripple above a certain frequency
  // where the wavelength becomes comparable to the roundover radius.
  const fRoundover = C / (4 * roundoverRadius);

  return frequencies.map((f) => {
    // Damping factor: reduces ripple above fRoundover
    const damping = 1 / (1 + (f / fRoundover) ** 2);
    return damping;
  });
}
