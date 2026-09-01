// Loudspeaker electrical impedance simulation
//
// Models the driver's electrical input impedance as seen by the amplifier,
// including free-air, sealed-box, and ported-box enclosures.
//
// The impedance model uses the standard electromechanical analogy:
//
//   Z_e(jw) = R_e + jw*L_e + (BL)^2 / Z_m(jw)
//
// where Z_m(jw) is the mechanical impedance of the driver + enclosure:
//
//   Free-air:  Z_m = R_ms + jw*M_ms + 1/(jw*C_ms)
//   Sealed:    Z_m = R_ms + jw*M_ms + 1/(jw*(C_ms + C_ab))
//   Ported:    adds the port mass and box compliance in parallel
//
// All formulas from:
//   - Small, "Direct-Radiator Loudspeaker System Analysis" (1972)
//   - Beranek & Mellow, "Acoustics: Sound Fields and Transducers"
//   - Dickason, "Loudspeaker Design Cookbook"

import type {
  ThieleSmallParams,
  CabinetType,
  ImpedanceDataPoint,
} from '@/types';
import { generateFrequencies } from './thieleSmall';

// ---------------------------------------------------------------------------
// Complex number helpers
// ---------------------------------------------------------------------------

interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / denom, im: (a.im * b.re - a.re * b.im) / denom };
}

function cMag(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cPhase(a: Complex): number {
  return Math.atan2(a.im, a.re) * (180 / Math.PI);
}

// ---------------------------------------------------------------------------
// Derive mechanical parameters from T/S if not explicitly provided
// ---------------------------------------------------------------------------

interface MechParams {
  rMs: number;  // Mechanical resistance [N·s/m]
  mMs: number;  // Moving mass [kg]
  cMs: number;  // Mechanical compliance [m/N]
  bl: number;   // Force factor [N/A]
  re: number;   // DC resistance [Ω]
  le: number;   // Voice coil inductance [H]
}

function deriveMechParams(ts: ThieleSmallParams): MechParams {
  const { fs, qms, qes, re, le, bl, mms, cms } = ts;

  // Always anchor on Fs as the measured resonance frequency.
  // Cms and Mms must satisfy: Fs = 1/(2π*sqrt(Mms*Cms)), but manufacturer
  // data often has inconsistent values. We trust Fs and derive Cms from it.
  const omegaS = 2 * Math.PI * fs;

  // Mms in kg (provided in g)
  let mMsKg: number;
  if (mms && mms > 0) {
    mMsKg = mms / 1000;
  } else if (cms && cms > 0) {
    // Derive Mms from Fs and Cms: Mms = 1/(ωs² * Cms)
    mMsKg = 1 / (omegaS * omegaS * (cms / 1000));
  } else if (bl && bl > 0 && qes > 0) {
    // Derive: Mms = BL^2 / (Re * omega_s * Qes)
    mMsKg = (bl * bl) / (re * omegaS * qes);
  } else {
    mMsKg = 0.02; // 20g fallback
  }

  // ALWAYS derive Cms from Fs and Mms to guarantee resonance at Fs.
  // Manufacturer Cms values are frequently inconsistent with stated Fs.
  const cMsMPerN = 1 / (omegaS * omegaS * mMsKg);

  // Rms from Qms: Rms = omega_s * Mms / Qms
  const rMs = (omegaS * mMsKg) / qms;

  // BL: derive if not provided
  // Bl = sqrt(Re * omega_s * Qes * Mms)
  const blVal = bl && bl > 0
    ? bl
    : Math.sqrt(re * omegaS * qes * mMsKg);

  // Le in H (provided in mH)
  const leH = le ? le / 1000 : 0;

  return {
    rMs,
    mMs: mMsKg,
    cMs: cMsMPerN,
    bl: blVal,
    re,
    le: leH,
  };
}

// ---------------------------------------------------------------------------
// Free-air impedance
// ---------------------------------------------------------------------------

/**
 * Calculate free-air impedance at a single frequency.
 *
 * Z_e = Re + jw*Le + (BL)^2 / Z_m
 *
 * Z_m = Rms + jw*Mms + 1/(jw*Cms)
 */
function freeAirImpedanceAt(
  omega: number,
  mech: MechParams
): { magnitude: number; phase: number } {
  const { rMs, mMs, cMs, bl, re, le } = mech;

  // Z_m = Rms + jw*Mms + 1/(jw*Cms)
  // 1/(jw*Cms) = -j/(w*Cms)
  const zMech: Complex = {
    re: rMs,
    im: omega * mMs - 1 / (omega * cMs),
  };

  // (BL)^2 / Z_m
  const blSquared = bl * bl;
  const motionalImp = cDiv({ re: blSquared, im: 0 }, zMech);

  // Z_e = Re + jw*Le + motional impedance
  const zE = cAdd(
    cAdd({ re: re, im: omega * le }, motionalImp),
    { re: 0, im: 0 }
  );

  return {
    magnitude: cMag(zE),
    phase: cPhase(zE),
  };
}

// ---------------------------------------------------------------------------
// Sealed-box impedance
// ---------------------------------------------------------------------------

/**
 * Calculate sealed-box impedance at a single frequency.
 *
 * The box adds an additional compliance C_ab in series with C_ms
 * (mechanically, the air spring is in parallel with the driver suspension
 * from the diaphragm's perspective, but in the impedance analogy it appears
 * as a modified total compliance).
 *
 * C_total = C_ms * C_ab / (C_ms + C_ab)  (series compliance)
 *
 * For sealed box: C_ab = V_ab / (rho * c^2 * Sd^2)
 * where V_ab is the box volume in m³.
 */
function sealedImpedanceAt(
  omega: number,
  mech: MechParams,
  boxVolumeL: number,
  sd: number
): { magnitude: number; phase: number } {
  const { rMs, mMs, cMs, bl, re, le } = mech;

  // Box compliance: C_ab = Vb / (rho0 * c^2 * Sd^2)
  // rho0 = 1.2 kg/m³, c = 343 m/s
  const rho0 = 1.2;
  const c = 343;
  const vbM3 = boxVolumeL / 1000; // L → m³
  const sdM2 = sd / 10000; // cm² → m²
  const cAb = vbM3 / (rho0 * c * c * sdM2 * sdM2);

  // Total compliance (series): C_total = Cms * Cab / (Cms + Cab)
  const cTotal = (cMs * cAb) / (cMs + cAb);

  // Z_m = Rms + jw*Mms + 1/(jw*C_total)
  const zMech: Complex = {
    re: rMs,
    im: omega * mMs - 1 / (omega * cTotal),
  };

  const blSquared = bl * bl;
  const motionalImp = cDiv({ re: blSquared, im: 0 }, zMech);

  const zE = cAdd({ re: re, im: omega * le }, motionalImp);

  return {
    magnitude: cMag(zE),
    phase: cPhase(zE),
  };
}

// ---------------------------------------------------------------------------
// Ported-box impedance
// ---------------------------------------------------------------------------

/**
 * Calculate ported-box impedance at a single frequency.
 *
 * The box compliance Cab and port mass Mport form a Helmholtz resonator.
 * Acoustically, they are in SERIES: diaphragm → Cab (box air spring) →
 * Mport (port air mass) → atmosphere. The suspension Cms is in PARALLEL
 * with this series branch (both are paths from diaphragm to ground).
 *
 * The coupling between the driver mass-spring resonance (Fs) and the
 * Helmholtz resonance (fb) splits the system into two coupled resonances,
 * producing the characteristic double-peak impedance curve with a dip
 * at fb between the peaks.
 *
 * Z_bp_mech = Sd² * (1/(jw*Cab_ac) + jw*Mport_ac + Rport_ac)
 * Z_susp = 1/(jw*Cms)
 * Z_load = Z_susp || Z_bp_mech
 * Z_m = Rms + jw*Mms + Z_load
 * Z_e = Re + jw*Le + (BL)² / Z_m
 */
function portedImpedanceAt(
  omega: number,
  mech: MechParams,
  boxVolumeL: number,
  fb: number,
  sd: number
): { magnitude: number; phase: number } {
  const { rMs, mMs, cMs, bl, re, le } = mech;

  const rho0 = 1.2;
  const c = 343;
  const vbM3 = boxVolumeL / 1000;
  const sdM2 = sd / 10000; // cm² → m²

  // Acoustic compliance of box: Cab_ac = Vb / (ρ₀ * c²)
  const cAbAc = vbM3 / (rho0 * c * c);

  // Port acoustic mass from tuning: fb = (1/2π) * sqrt(1/(Cab_ac * Mport_ac))
  const omegaB = 2 * Math.PI * fb;
  const mPortAc = 1 / (omegaB * omegaB * cAbAc);

  // Port losses: small fraction of critical damping
  const rPortAc = 0.03 * omegaB * mPortAc;

  // Series box+port acoustic impedance: Z_bp_ac = 1/(jw*Cab) + jw*Mport + Rport
  // = -j/(w*Cab) + jw*Mport + Rport
  const zBpAcoustic: Complex = {
    re: rPortAc,
    im: -1 / (omega * cAbAc) + omega * mPortAc,
  };

  // Convert to mechanical: Z_bp_mech = Sd² * Z_bp_ac
  const sdM2Sq = sdM2 * sdM2;
  const zBpMech: Complex = {
    re: zBpAcoustic.re * sdM2Sq,
    im: zBpAcoustic.im * sdM2Sq,
  };

  // Driver suspension compliance (mechanical): Z_susp = 1/(jw*Cms)
  const zSusp: Complex = { re: 0, im: -1 / (omega * cMs) };

  // Total mechanical load: suspension || box+port (parallel)
  const zLoad = cDiv(cMul(zSusp, zBpMech), cAdd(zSusp, zBpMech));

  // Z_m = Rms + jw*Mms + Z_load
  const zMech = cAdd(
    { re: rMs, im: omega * mMs },
    zLoad
  );

  const blSquared = bl * bl;
  const motionalImp = cDiv({ re: blSquared, im: 0 }, zMech);

  const zE = cAdd({ re: re, im: omega * le }, motionalImp);

  return {
    magnitude: cMag(zE),
    phase: cPhase(zE),
  };
}

// ---------------------------------------------------------------------------
// Public API: calculate impedance curve
// ---------------------------------------------------------------------------

export interface ImpedanceResult {
  freq: number[];
  magnitude: number[];  // [Ω]
  phase: number[];      // [degrees]
}

export interface ImpedanceParams {
  ts: ThieleSmallParams;
  cabinetType: CabinetType;
  /** Box volume [L] — required for sealed/ported */
  boxVolume?: number;
  /** Port tuning frequency [Hz] — required for ported */
  fb?: number;
  /** Start frequency [Hz] */
  fStart?: number;
  /** End frequency [Hz] */
  fEnd?: number;
  /** Points per octave */
  pointsPerOctave?: number;
}

/**
 * Calculate the electrical impedance curve of a driver in a given enclosure.
 *
 * Returns magnitude in ohms and phase in degrees across a log-spaced frequency range.
 */
export function calcImpedance(params: ImpedanceParams): ImpedanceResult {
  const {
    ts,
    cabinetType,
    boxVolume,
    fb,
    fStart = 10,
    fEnd = 20000,
    pointsPerOctave = 24,
  } = params;

  const mech = deriveMechParams(ts);
  const frequencies = generateFrequencies(fStart, fEnd, pointsPerOctave);
  const sd = ts.sd;

  const magnitude: number[] = [];
  const phase: number[] = [];

  for (const f of frequencies) {
    const omega = 2 * Math.PI * f;
    let result: { magnitude: number; phase: number };

    switch (cabinetType) {
      case 'sealed':
        result = sealedImpedanceAt(omega, mech, boxVolume || 50, sd);
        break;
      case 'ported':
        if (fb && fb > 0) {
          result = portedImpedanceAt(omega, mech, boxVolume || 50, fb, sd);
        } else {
          result = sealedImpedanceAt(omega, mech, boxVolume || 50, sd);
        }
        break;
      case 'open_baffle':
      case 'transmission_line':
        // For open baffle and TL, free-air is the closest simple model
        result = freeAirImpedanceAt(omega, mech);
        break;
      default:
        result = freeAirImpedanceAt(omega, mech);
    }

    magnitude.push(result.magnitude);
    phase.push(result.phase);
  }

  return { freq: frequencies, magnitude, phase };
}

// ---------------------------------------------------------------------------
// Key impedance metrics
// ---------------------------------------------------------------------------

export interface ImpedanceMetrics {
  /** Peak impedance [Ω] */
  zMax: number;
  /** Frequency at peak [Hz] */
  fMax: number;
  /** Minimum impedance above resonance [Ω] */
  zMin: number;
  /** Frequency at minimum [Hz] */
  fMin: number;
  /** DC resistance [Ω] */
  re: number;
  /** Nominal impedance [Ω] */
  nominal: number;
  /** Phase angle at minimum impedance [degrees] */
  phaseAtMin: number;
  /** Worst-case phase angle [degrees] (most negative) */
  phaseMin: number;
  /** Frequency at worst phase [Hz] */
  fPhaseMin: number;
}

/**
 * Extract key impedance metrics from a calculated impedance curve.
 */
export function impedanceMetrics(
  result: ImpedanceResult,
  ts: ThieleSmallParams
): ImpedanceMetrics {
  const { freq, magnitude, phase } = result;

  // Peak impedance (resonance)
  let zMax = 0;
  let fMax = 0;
  for (let i = 0; i < magnitude.length; i++) {
    if (magnitude[i]! > zMax) {
      zMax = magnitude[i]!;
      fMax = freq[i]!;
    }
  }

  // Minimum impedance above resonance (typically in the midrange)
  // Search above 2× resonance frequency
  const searchStart = freq.findIndex((f) => f > fMax * 2);
  let zMin = Infinity;
  let fMin = 0;
  let phaseAtMin = 0;
  const startIdx = searchStart >= 0 ? searchStart : Math.floor(freq.length / 2);
  for (let i = startIdx; i < magnitude.length; i++) {
    if (magnitude[i]! < zMin) {
      zMin = magnitude[i]!;
      fMin = freq[i]!;
      phaseAtMin = phase[i]!;
    }
  }

  // Worst-case phase angle (most negative)
  let phaseMin = 0;
  let fPhaseMin = 0;
  for (let i = 0; i < phase.length; i++) {
    if (phase[i]! < phaseMin) {
      phaseMin = phase[i]!;
      fPhaseMin = freq[i]!;
    }
  }

  // Nominal impedance: the minimum impedance in the usable band,
  // but not lower than 80% of Re (sanity floor)
  const nominal = Math.max(zMin, ts.re * 0.8);

  return {
    zMax,
    fMax,
    zMin,
    fMin,
    re: ts.re,
    nominal,
    phaseAtMin,
    phaseMin,
    fPhaseMin,
  };
}

// ---------------------------------------------------------------------------
// Convert to ImpedanceDataPoint[] for storage/display compatibility
// ---------------------------------------------------------------------------

export function toImpedanceDataPoints(result: ImpedanceResult): ImpedanceDataPoint[] {
  return result.freq.map((f, i) => ({
    freq: f,
    magnitude: result.magnitude[i]!,
    phase: result.phase[i]!,
  }));
}
