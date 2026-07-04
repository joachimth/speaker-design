// Directivity estimation and spinorama calculation
// Ported from mk2-reference-loudspeaker simulations/directivity_estimate.py,
// vertical_polar_map.py, polar_response.py, vertical_lobing.py
//
// Models:
// - Piston directivity: circular piston in infinite baffle
// - Array directivity: vertical CBT-style lobing for multi-driver
// - Spinorama: CEA-2034 standard curves
//
// Reference: Keele, "Directivity of Acoustic Radiators" + CEA-2034

import type {
  FrequencyDataPoint,
  SystemResponseResult,
  PolarResult,
} from '@/types';

const C = 343000; // speed of sound [mm/s]

// ---------------------------------------------------------------------------
// Piston directivity
// ---------------------------------------------------------------------------

/**
 * Calculate the directivity of a circular piston in an infinite baffle.
 *
 * The far-field pressure at angle θ from a circular piston of radius a:
 * P(θ) = 2 * J1(k*a*sin(θ)) / (k*a*sin(θ))
 *
 * where k = 2πf/c, a = piston radius, J1 = Bessel function of first kind.
 *
 * For small ka (low freq or small piston): P ≈ 1 (omnidirectional)
 * For large ka: pattern narrows with sidelobes.
 */
export function pistonDirectivity(
  freq: number,
  angle: number, // [degrees]
  pistonDiameter: number // [mm]
): number {
  const radius = pistonDiameter / 2;
  const k = (2 * Math.PI * freq) / C;
  const sinTheta = Math.sin((angle * Math.PI) / 180);

  if (sinTheta === 0) return 1; // on-axis

  const x = k * radius * sinTheta;

  // Bessel function J1 approximation
  const j1 = besselJ1(x);

  const value = (2 * j1) / x;
  return value;
}

/**
 * Bessel function of the first kind, order 1.
 * Uses series expansion for small x and asymptotic for large x.
 */
function besselJ1(x: number): number {
  if (Math.abs(x) < 8) {
    // Series: J1(x) = sum of (-1)^n * (x/2)^(2n+1) / (n! * (n+1)!)
    let sum = 0;
    const x2 = (x / 2) ** 2;
    let term = x / 2; // n=0 term
    sum = term;
    for (let n = 1; n < 20; n++) {
      term *= -x2 / (n * (n + 1));
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    return sum;
  } else {
    // Asymptotic expansion
    const ax = Math.abs(x);
    const z = 8 / ax;
    const y = z * z;
    const xx = ax - 2.356194491; // 3π/4

    // Coefficients for J1
    const p1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
    const p2 = 1.0 + y * (0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6))));

    const result = Math.sqrt(0.636619772 / ax) *
      (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);

    return x < 0 ? -result : result;
  }
}

// ---------------------------------------------------------------------------
// Off-axis response from a driver
// ---------------------------------------------------------------------------

/**
 * Calculate off-axis frequency response for a single driver.
 * Combines the on-axis response with piston directivity.
 */
export function offAxisResponse(
  onAxis: FrequencyDataPoint[],
  angle: number,
  pistonDiameter: number
): FrequencyDataPoint[] {
  return onAxis.map((point) => {
    const directivity = pistonDirectivity(point.freq, angle, pistonDiameter);
    const dbChange = 20 * Math.log10(Math.max(directivity, 1e-6));
    return {
      freq: point.freq,
      magnitude: point.magnitude + dbChange,
    };
  });
}

// ---------------------------------------------------------------------------
// Spinorama (CEA-2034) calculation
// ---------------------------------------------------------------------------

/**
 * Calculate CEA-2034 spinorama curves from horizontal + vertical off-axis data.
 *
 * Standard curves:
 * - On-Axis: 0° H, 0° V
 * - Listening Window: average of ±10° H/V (9 points)
 * - Early Reflections: average of specific angles
 * - Sound Power: weighted average of all angles
 * - Directivity Index: On-axis - Sound Power
 * - Predicted In-Room: weighted combination
 *
 * For simulation (not measurement), we compute these from the directivity model.
 */
export function calcSpinorama(
  onAxis: FrequencyDataPoint[],
  driverDiameter: number, // [mm] - effective piston diameter
  _baffleWidth: number,
  _baffleHeight: number
): SystemResponseResult {
  const freq = onAxis.map((p) => p.freq);

  // Generate off-axis responses at standard CEA-2034 angles
  const horizontalAngles = [-80, -70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80];
  const verticalAngles = [-80, -70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80];

  // Listening Window: ±10° H, ±10° V
  const lwAngles = [
    { h: 0, v: 0 }, { h: 10, v: 0 }, { h: -10, v: 0 },
    { h: 0, v: 10 }, { h: 0, v: -10 },
    { h: 10, v: 10 }, { h: -10, v: 10 }, { h: 10, v: -10 }, { h: -10, v: -10 },
  ];

  // Early Reflections angles (simplified CEA-2034)
  const erAngles = [
    { h: 0, v: 0 }, { h: 30, v: 0 }, { h: -30, v: 0 },
    { h: 0, v: 30 }, { h: 0, v: -30 },
    { h: 60, v: 0 }, { h: -60, v: 0 },
    { h: 0, v: 60 }, { h: 0, v: -60 },
    { h: 40, v: 20 }, { h: -40, v: 20 }, { h: 40, v: -20 }, { h: -40, v: -20 },
  ];

  // Sound Power: all angles with weighting
  const spAngles: { h: number; v: number; w: number }[] = [];
  for (const h of horizontalAngles) {
    for (const v of verticalAngles) {
      // Weight by sin(v) (solid angle weighting)
      const weight = Math.cos((v * Math.PI) / 180);
      spAngles.push({ h, v, w: weight });
    }
  }

  // Calculate each curve
  const onAxisDb = onAxis.map((p) => p.magnitude);

  // Listening Window
  const listeningWindow = freq.map((_f, i) => {
    let sum = 0;
    for (const a of lwAngles) {
      const hDir = pistonDirectivity(_f, a.h, driverDiameter);
      const vDir = pistonDirectivity(_f, a.v, driverDiameter);
      sum += onAxis[i]!.magnitude + 20 * Math.log10(Math.max(hDir * vDir, 1e-6));
    }
    return sum / lwAngles.length;
  });

  // Early Reflections
  const earlyReflections = freq.map((_f, i) => {
    let sum = 0;
    for (const a of erAngles) {
      const hDir = pistonDirectivity(_f, a.h, driverDiameter);
      const vDir = pistonDirectivity(_f, a.v, driverDiameter);
      sum += onAxis[i]!.magnitude + 20 * Math.log10(Math.max(hDir * vDir, 1e-6));
    }
    return sum / erAngles.length;
  });

  // Sound Power
  let totalWeight = 0;
  spAngles.forEach((a) => (totalWeight += a.w));
  const soundPower = freq.map((f, i) => {
    let sum = 0;
    for (const a of spAngles) {
      const hDir = pistonDirectivity(f, a.h, driverDiameter);
      const vDir = pistonDirectivity(f, a.v, driverDiameter);
      sum += (onAxis[i]!.magnitude + 20 * Math.log10(Math.max(hDir * vDir, 1e-6))) * a.w;
    }
    return sum / totalWeight;
  });

  // Directivity Index
  const directivityIndex = freq.map((_f, i) => onAxisDb[i]! - soundPower[i]!);

  // Predicted In-Room Response (simplified)
  const predictedInRoom = freq.map((_f, i) => {
    return 0.5 * onAxisDb[i]! + 0.3 * earlyReflections[i]! + 0.2 * soundPower[i]!;
  });

  return {
    freq,
    onAxis: onAxisDb,
    listeningWindow,
    earlyReflections,
    soundPower,
    directivityIndex,
    predictedInRoom,
  };
}

// ---------------------------------------------------------------------------
// Polar diagram calculation
// ---------------------------------------------------------------------------

/**
 * Calculate polar response for a single driver at a given frequency set.
 *
 * @param onAxis - on-axis frequency response
 * @param angles - array of angles [degrees]
 * @param driverDiameter - effective piston diameter [mm]
 * @param frequencies - specific frequencies to plot
 * @returns PolarResult with [freq][angle] → dB
 */
export function calcPolar(
  onAxis: FrequencyDataPoint[],
  angles: number[],
  driverDiameter: number,
  frequencies: number[]
): PolarResult {
  const data: number[][] = [];

  for (const f of frequencies) {
    // Find on-axis magnitude at this frequency (interpolate)
    const onAxisDb = interpolateMagnitude(onAxis, f);
    const row: number[] = [];
    for (const angle of angles) {
      const dir = pistonDirectivity(f, angle, driverDiameter);
      row.push(onAxisDb + 20 * Math.log10(Math.max(dir, 1e-6)));
    }
    data.push(row);
  }

  return { frequencies, angles, data };
}

// ---------------------------------------------------------------------------
// Vertical lobing analysis
// ---------------------------------------------------------------------------

/**
 * Calculate vertical lobing for a multi-driver system with given center-to-center
 * spacing and crossover frequency.
 *
 * Lobing occurs when the center-to-center distance between drivers approaches
 * 1 wavelength at the crossover frequency. The first null occurs at:
 * θ_null = arcsin(λ / (2 * d)) where d = C-C distance, λ = c/f
 *
 * @param ccDistance - center-to-center distance [mm]
 * @param crossoverFreq - crossover frequency [Hz]
 * @param frequencies - frequency array
 * @param angles - vertical angles [degrees]
 */
export function calcVerticalLobing(
  ccDistance: number,
  crossoverFreq: number,
  frequencies: number[],
  angles: number[]
): number[][] {
  const data: number[][] = [];

  for (const f of frequencies) {
    const wavelength = C / f;
    const row: number[] = [];
    for (const angle of angles) {
      const sinTheta = Math.sin((angle * Math.PI) / 180);
      // Two-source interference pattern
  const pathDiff = ccDistance * sinTheta;
      const phaseDiff = (2 * Math.PI * pathDiff) / wavelength;

      // Sum of two sources with 0 or π phase (depends on crossover type)
      // For LR4 (even order), sources are in-phase
      const magnitude = Math.abs(Math.cos(phaseDiff / 2));
      const db = 20 * Math.log10(Math.max(magnitude, 1e-6));

      // Weight by frequency proximity to crossover
      const xoverWeight = Math.exp(-Math.abs(Math.log(f / crossoverFreq)) * 2);
      row.push(db * xoverWeight);
    }
    data.push(row);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Helper: interpolate magnitude at a specific frequency
// ---------------------------------------------------------------------------

function interpolateMagnitude(curve: FrequencyDataPoint[], freq: number): number {
  if (curve.length === 0) return 0;
  if (freq <= curve[0]!.freq) return curve[0]!.magnitude;
  if (freq >= curve[curve.length - 1]!.freq) return curve[curve.length - 1]!.magnitude;

  // Binary search for the bracketing points
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
