// Automatic design suggestions: crossover, cabinet, and baffle optimization.
//
// Given a set of drivers, this module computes:
//   - Optimal crossover frequencies, filter types, gain, delay, and polarity
//   - Cabinet type + dimensions from Thiele-Small parameters
//   - Optimal front baffle size based on driver diameters and crossover points
//
// All formulas use standard loudspeaker engineering references:
//   - Small (1972), Dickason (Loudspeaker Design Cookbook)
//   - Olson (1969), D'Appolito (Testing Loudspeakers)
//   - Keele, "Low-Frequency Loudspeaker Assessment"

import type {
  Driver,
  DriverType,
  CrossoverType,
  CabinetType,
  CabinetDimensions,
  SealedAlignment,
  FrequencyDataPoint,
} from '@/types';
import {
  calcSealed,
  calcPorted,
  calcPort,
  calcTransmissionLine,
  calcInternalVolume,
  type PortedDesignParams,
} from './thieleSmall';
import { baffleStepFrequency } from './baffle';
import { calcInRoomResponse, type RoomAcousticsParams } from './roomAcoustics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Speed of sound [mm/s] */
const C = 343000;

/** Piston directivity -3 dB on-axis frequency factor: f = FACTOR / diameter_mm */
const DIRECTIVITY_FACTOR = 218300;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface CrossoverBandSuggestion {
  driverId: string;
  role: 'low' | 'mid' | 'mid2' | 'high';
  lowpassFreq: number;
  lowpassType: CrossoverType;
  highpassFreq: number;
  highpassType: CrossoverType;
  gain: number;
  polarity: 0 | 180;
  delay: number;
}

export interface CrossoverPointInfo {
  freq: number;
  type: CrossoverType;
  lowerRole: string;
  upperRole: string;
}

export interface CrossoverSuggestion {
  ways: 2 | 3 | 4;
  bands: CrossoverBandSuggestion[];
  crossoverPoints: CrossoverPointInfo[];
  reasoning: string[];
}

export interface CabinetSuggestionResult {
  type: CabinetType;
  dimensions: CabinetDimensions;
  sealed?: SealedAlignment;
  ported?: PortedDesignParams;
  portLength?: number;
  internalVolume: number;
  reasoning: string[];
}

export interface BaffleSuggestionResult {
  width: number;
  height: number;
  roundoverRadius: number;
  fStep: number;
  reasoning: string[];
}

export interface SystemSuggestion {
  crossover: CrossoverSuggestion;
  cabinet: CabinetSuggestionResult;
  baffle: BaffleSuggestionResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Piston diameter from Sd (effective piston area) or dimensions fallback.
 * Returns diameter in mm.
 */
export function pistonDiameter(driver: Driver): number {
  const sd = driver.tsParams?.sd;
  if (sd && sd > 0) {
    // Sd in cm² → radius in cm → diameter in mm
    return 2 * Math.sqrt(sd / Math.PI) * 10;
  }
  const od = driver.dimensions?.overallDiameter;
  if (od && od > 0) return od * 0.82;
  return 100; // fallback
}

/**
 * Piston directivity -3 dB on-axis frequency.
 * Above this frequency the driver starts to beam (narrow directivity).
 */
export function directivityLimit(diameterMm: number): number {
  return DIRECTIVITY_FACTOR / diameterMm;
}

/**
 * Estimate the acoustic center depth behind the baffle plane [mm].
 *
 * The acoustic center is approximately at the voice-coil rest position.
 * Without detailed geometry, we use type-based defaults refined by
 * mounting depth when available.
 */
export function acousticCenterDepth(driver: Driver): number {
  const defaults: Record<DriverType, number> = {
    tweeter: 10,
    fullrange: 25,
    midrange: 30,
    woofer: 55,
    subwoofer: 75,
  };
  const base = defaults[driver.type] ?? 40;

  if (driver.dimensions?.mountingDepth && driver.dimensions.mountingDepth > 0) {
    // Acoustic center ≈ 35% of mounting depth from baffle plane
    const estimated = driver.dimensions.mountingDepth * 0.35;
    return Math.max(base * 0.5, Math.min(estimated, base * 2.5));
  }
  return base;
}

/**
 * Usable frequency range for a driver in a crossover context.
 *
 * Lower bound: 1.5× Fs for tweeters (must be above resonance for flat response),
 *              1.3× Fs for midranges, 0 for woofers/subwoofers (cabinet sets LF).
 * Upper bound: piston directivity -3 dB point (beaming onset).
 */
export function usableRange(driver: Driver): { min: number; max: number } {
  const fs = driver.tsParams.fs;
  const dia = pistonDiameter(driver);
  const dirLimit = directivityLimit(dia);

  let min: number;
  switch (driver.type) {
    case 'tweeter':
      min = fs * 1.5;
      break;
    case 'midrange':
    case 'fullrange':
      min = fs * 1.3;
      break;
    default:
      min = 0; // woofer/subwoofer: no lower limit from driver alone
  }

  return { min, max: dirLimit };
}

/**
 * Interpolate a frequency response curve at a given frequency.
 */
function interpolateAt(curve: FrequencyDataPoint[], freq: number): number {
  if (curve.length === 0) return 0;
  if (freq <= curve[0]!.freq) return curve[0]!.magnitude;
  if (freq >= curve[curve.length - 1]!.freq) return curve[curve.length - 1]!.magnitude;
  let lo = 0, hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (curve[mid]!.freq < freq) lo = mid;
    else hi = mid;
  }
  const p0 = curve[lo]!, p1 = curve[hi]!;
  const t = (Math.log(freq) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq));
  return p0.magnitude + t * (p1.magnitude - p0.magnitude);
}

/**
 * Try to find the intersection of two frequency response curves in a
 * given frequency range. Returns the crossing frequency or null.
 *
 * Both curves are normalised to their own mean in the search range so
 * the comparison is about relative shape, not absolute level.
 */
function findResponseIntersection(
  lower: FrequencyDataPoint[],
  upper: FrequencyDataPoint[],
  rangeMin: number,
  rangeMax: number,
): number | null {
  if (lower.length < 2 || upper.length < 2) return null;

  // Collect normalised values at log-spaced sample frequencies
  const sampleFreqs: number[] = [];
  const lowerVals: number[] = [];
  const upperVals: number[] = [];

  const fStart = Math.max(rangeMin, Math.max(lower[0]!.freq, upper[0]!.freq));
  const fEnd = Math.min(rangeMax, Math.min(lower[lower.length - 1]!.freq, upper[upper.length - 1]!.freq));
  if (fStart >= fEnd) return null;

  const nSamples = 200;
  const logStart = Math.log(fStart);
  const logEnd = Math.log(fEnd);
  for (let i = 0; i <= nSamples; i++) {
    const f = Math.exp(logStart + (logEnd - logStart) * (i / nSamples));
    sampleFreqs.push(f);
    lowerVals.push(interpolateAt(lower, f));
    upperVals.push(interpolateAt(upper, f));
  }

  // Normalise to mean
  const lowerMean = lowerVals.reduce((a, b) => a + b, 0) / lowerVals.length;
  const upperMean = upperVals.reduce((a, b) => a + b, 0) / upperVals.length;
  const lowerNorm = lowerVals.map((v) => v - lowerMean);
  const upperNorm = upperVals.map((v) => v - upperMean);

  // Find sign change in (lowerNorm - upperNorm)
  for (let i = 0; i < sampleFreqs.length - 1; i++) {
    const diff0 = lowerNorm[i]! - upperNorm[i]!;
    const diff1 = lowerNorm[i + 1]! - upperNorm[i + 1]!;
    if (diff0 === 0) return sampleFreqs[i]!;
    if (diff0 * diff1 < 0) {
      // Linear interpolation in log-freq space
      const t = diff0 / (diff0 - diff1);
      const logF = Math.log(sampleFreqs[i]!) + t * (Math.log(sampleFreqs[i + 1]!) - Math.log(sampleFreqs[i]!));
      return Math.exp(logF);
    }
  }
  return null;
}

/**
 * Round to a "nice" crossover frequency.
 */
function niceRound(freq: number): number {
  if (freq < 500) return Math.round(freq / 10) * 10;
  if (freq < 2000) return Math.round(freq / 50) * 50;
  return Math.round(freq / 100) * 100;
}

/**
 * Geometric mean of two frequencies.
 */
function geoMean(a: number, b: number): number {
  return Math.sqrt(a * b);
}

/**
 * Clamp a value to a range.
 */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Crossover suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest a complete crossover configuration from a set of drivers.
 *
 * The drivers are assigned to bands by type (woofer→low, mid→mid, tweeter→high),
 * crossover frequencies are computed from usable frequency ranges and optionally
 * refined by measured frequency response intersections, gain is set to match
 * sensitivities, and delay is estimated from acoustic centre offsets.
 *
 * @param drivers  The selected drivers (2-4 units). Must include at least
 *                 one tweeter and one woofer/midrange.
 * @param ways     Number of ways (2, 3, or 4).
 * @returns Crossover suggestion with bands, crossover points, and reasoning.
 */
export function suggestCrossover(
  drivers: Driver[],
  ways: 2 | 3 | 4,
): CrossoverSuggestion {
  const reasoning: string[] = [];
  const validDrivers = drivers.filter((d) => d && d.id);

  if (validDrivers.length < 2) {
    reasoning.push('Mindst 2 enheder skal vælges for at foreslå delefilter.');
    return { ways, bands: [], crossoverPoints: [], reasoning };
  }

  // Assign drivers to roles by type
  const sorted = assignRoles(validDrivers, ways);
  if (sorted.length < 2) {
    reasoning.push('Kunne ikke tildele roller — brug for mindst en bas og en diskant.');
    return { ways, bands: [], crossoverPoints: [], reasoning };
  }

  // Default crossover type: LR4 (24 dB/oct, in-phase at crossover)
  const defaultType: CrossoverType = 'LR4';
  reasoning.push(`Standard delefilter-type: LR4 (24 dB/okt, i fase ved deling).`);

  // Compute crossover frequencies between adjacent bands
  const crossoverPoints: CrossoverPointInfo[] = [];
  const bandUpperLimits: number[] = []; // lowpass freq for each band
  const bandLowerLimits: number[] = [];  // highpass freq for each band

  for (let i = 0; i < sorted.length; i++) {
    bandUpperLimits.push(0);
    bandLowerLimits.push(0);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const lower = sorted[i]!;
    const upper = sorted[i + 1]!;
    const lowerRange = usableRange(lower);
    const upperRange = usableRange(upper);

    // Overlap region where both drivers are usable
    const overlapMin = Math.max(lowerRange.min, upperRange.min);
    const overlapMax = Math.min(lowerRange.max, upperRange.max);

    let xoFreq: number;

    if (overlapMin < overlapMax) {
      // There is an overlap — try to refine with measured response data
      const intersection =
        lower.frequencyResponse && upper.frequencyResponse
          ? findResponseIntersection(
              lower.frequencyResponse,
              upper.frequencyResponse,
              overlapMin,
              overlapMax,
            )
          : null;

      if (intersection && intersection >= overlapMin && intersection <= overlapMax) {
        xoFreq = niceRound(intersection);
        reasoning.push(
          `${roleLabel(sorted[i]!.type)}→${roleLabel(sorted[i + 1]!.type)}: ` +
          `${xoFreq} Hz (fundet ved krydsning af målte frekvensrespons).`,
        );
      } else {
        xoFreq = niceRound(geoMean(overlapMin, overlapMax));
        reasoning.push(
          `${roleLabel(sorted[i]!.type)}→${roleLabel(sorted[i + 1]!.type)}: ` +
          `${xoFreq} Hz (midtpunkt af brugbart område ${overlapMin.toFixed(0)}-${overlapMax.toFixed(0)} Hz).`,
        );
      }
    } else {
      // No overlap — force a crossover at the geometric mean of the gap
      xoFreq = niceRound(geoMean(lowerRange.max, upperRange.min));
      reasoning.push(
        `${roleLabel(sorted[i]!.type)}→${roleLabel(sorted[i + 1]!.type)}: ` +
        `${xoFreq} Hz (TVUNGET — ingen overlap, juster manuelt!).`,
      );
    }

    // Safety: tweeter must not be crossed below Fs × 1.2
    if (upper.type === 'tweeter' && xoFreq < upper.tsParams.fs * 1.2) {
      xoFreq = niceRound(upper.tsParams.fs * 1.2);
      reasoning.push(`Justet til ${xoFreq} Hz for at beskytte diskant (min ${upper.tsParams.fs} Hz Fs).`);
    }

    bandUpperLimits[i] = xoFreq;
    bandLowerLimits[i + 1] = xoFreq;
    crossoverPoints.push({
      freq: xoFreq,
      type: defaultType,
      lowerRole: roleLabel(lower.type),
      upperRole: roleLabel(upper.type),
    });
  }

  // Gain: reference = least sensitive driver, attenuate more sensitive ones
  const sensitivities = sorted.map((d) => d.tsParams.sensitivity);
  const refSens = Math.min(...sensitivities);
  reasoning.push(
    `Gain reference: laveste følsomhed = ${refSens.toFixed(1)} dB. ` +
    `Mere følsomme enheder dæmpes.`,
  );

  // Delay: estimate from acoustic centre depth
  const depths = sorted.map(acousticCenterDepth);
  const maxDepth = Math.max(...depths);
  reasoning.push(
    `Delay: akustisk centrum estimeret fra enhedstype og monteringsdybde. ` +
    `Maksimal dybde = ${maxDepth.toFixed(0)} mm.`,
  );

  // Polarity: 0° for even-order (LR4), 180° for odd-order on alternate bands
  const isEvenOrder = defaultType === 'LR4' || defaultType === 'LR2' || defaultType === 'LR8' || defaultType === 'BW4' || defaultType === 'BW2';

  // Build band suggestions
  const bands: CrossoverBandSuggestion[] = sorted.map((driver, i) => {
    const gain = refSens - driver.tsParams.sensitivity;
    const delay = (maxDepth - depths[i]!) / C * 1000; // ms
    const polarity: 0 | 180 = (!isEvenOrder && i % 2 === 1) ? 180 : 0;

    return {
      driverId: driver.id,
      role: getRole(i, ways),
      lowpassFreq: bandUpperLimits[i]!,
      lowpassType: defaultType,
      highpassFreq: bandLowerLimits[i]!,
      highpassType: defaultType,
      gain: Math.round(gain * 10) / 10,
      polarity,
      delay: Math.round(delay * 100) / 100,
    };
  });

  return { ways, bands, crossoverPoints, reasoning };
}

// ---------------------------------------------------------------------------
// Role assignment
// ---------------------------------------------------------------------------

/**
 * Assign drivers to crossover bands by type, ordered low → high.
 */
function assignRoles(drivers: Driver[], ways: 2 | 3 | 4): Driver[] {
  const typePriority: Record<DriverType, number> = {
    subwoofer: 0,
    woofer: 1,
    fullrange: 2,
    midrange: 2,
    tweeter: 3,
  };

  // Sort by type priority (low → high frequency)
  const sorted = [...drivers].sort((a, b) => {
    const pa = typePriority[a.type] ?? 2;
    const pb = typePriority[b.type] ?? 2;
    if (pa !== pb) return pa - pb;
    // Same type: sort by Fs (lower Fs = lower band)
    return a.tsParams.fs - b.tsParams.fs;
  });

  // Take the first `ways` drivers
  return sorted.slice(0, ways);
}

/**
 * Get role label for band index.
 */
function getRole(index: number, ways: 2 | 3 | 4): 'low' | 'mid' | 'mid2' | 'high' {
  if (ways === 2) {
    return index === 0 ? 'low' : 'high';
  }
  if (ways === 3) {
    if (index === 0) return 'low';
    if (index === 1) return 'mid';
    return 'high';
  }
  // 4-way
  if (index === 0) return 'low';
  if (index === 1) return 'mid';
  if (index === 2) return 'mid2';
  return 'high';
}

function roleLabel(type: DriverType): string {
  const labels: Record<DriverType, string> = {
    woofer: 'Bas',
    subwoofer: 'Sub',
    midrange: 'Mellem',
    fullrange: 'Fullrange',
    tweeter: 'Diskant',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// Cabinet suggestion
// ---------------------------------------------------------------------------

/** Aspect ratio for internal dimensions (W:D:H) — avoids coincident standing waves */
const CABINET_RATIO = { w: 1.0, d: 1.3, h: 1.7 };
const RATIO_PRODUCT = CABINET_RATIO.w * CABINET_RATIO.d * CABINET_RATIO.h;

/**
 * Suggest cabinet dimensions for a driver and cabinet type.
 *
 * Uses Thiele-Small parameters to compute the required internal volume,
 * then derives external dimensions using a non-cubic aspect ratio that
 * avoids standing-wave coincidences.
 *
 * @param driver  The woofer/subwoofer driver for the cabinet.
 * @param type    Cabinet type (sealed, ported, transmission_line, open_baffle).
 * @returns Cabinet suggestion with dimensions, alignment, and reasoning.
 */
export function suggestCabinet(
  driver: Driver,
  type: CabinetType,
): CabinetSuggestionResult {
  const reasoning: string[] = [];
  const ts = driver.tsParams;

  // Open baffle: no volume calculation
  if (type === 'open_baffle') {
    const maxDia = pistonDiameter(driver);
    const baffleW = Math.round(maxDia + 100);
    const baffleH = Math.round(maxDia * 3 + 100);
    reasoning.push('Åben baffel: ingen kabinetvolumen. Baffelstørrelse baseret på enhedsdiameter.');
    return {
      type,
      dimensions: {
        width: baffleW,
        height: baffleH,
        depth: 0,
        wallThickness: 0,
        baffleWidth: baffleW,
        baffleHeight: baffleH,
        frontRoundoverRadius: Math.min(30, Math.round(baffleW * 0.08)),
      },
      internalVolume: 0,
      reasoning,
    };
  }

  // Transmission line: use existing calculator
  if (type === 'transmission_line') {
    const tl = calcTransmissionLine(ts);
    const depth = Math.round(tl.lineLength / 3); // folded line approx
    const width = Math.round(Math.sqrt(tl.lineArea / 3) * 10); // line cross-section
    const height = Math.round(tl.lineLength + 200); // total height with fold
    reasoning.push(
      `Transmission line: line længde = ${tl.lineLength} mm (¼ bølgelængde af Fs ${ts.fs} Hz, ` +
      `korrigeret for stuffing). Foldet design: D=${depth}mm, W=${width}mm, H=${height}mm.`,
    );
    return {
      type,
      dimensions: {
        width,
        height,
        depth,
        wallThickness: 22,
        baffleWidth: width,
        baffleHeight: height,
        frontRoundoverRadius: 19,
      },
      internalVolume: calcInternalVolume(width, height, depth, 22),
      reasoning,
    };
  }

  // Sealed or ported: compute Vb from T/S params
  let vb: number;
  let sealed: SealedAlignment | undefined;
  let ported: PortedDesignParams | undefined;
  let portLength: number | undefined;

  if (type === 'sealed') {
    sealed = calcSealed(ts, 0.707);
    vb = sealed.vb;
    reasoning.push(
      `Sealed: Qtc=0.707 (Butterworth, maksimalt flad). Vb=${vb.toFixed(1)}L, Fc=${sealed.fc.toFixed(0)}Hz, F3=${sealed.f3.toFixed(0)}Hz.`,
    );
  } else {
    // ported
    ported = calcPorted(ts);
    vb = ported.vb;
    reasoning.push(
      `Ported: ${ported.alignmentType} alignment. Vb=${vb.toFixed(1)}L, Fb=${ported.fb.toFixed(0)}Hz, F3=${ported.f3?.toFixed(0) || '—'}Hz.`,
    );
    // Default port: 60mm diameter, 1 port
    const port = calcPort(vb, ported.fb, 60, 1);
    portLength = port.portLength;
    reasoning.push(`Port: Ø60mm × 1, længde=${portLength.toFixed(0)}mm.`);
  }

  // Derive dimensions from Vb
  // Internal volume needs to account for bracing (85% factor in calcInternalVolume)
  // So: W × D × H × 0.85 = Vb × 1e6 (mm³)
  // W × D × H = Vb × 1e6 / 0.85
  const targetInternalMm3 = (vb * 1e6) / 0.85;
  const x = Math.cbrt(targetInternalMm3 / RATIO_PRODUCT);

  let iW = Math.round(x * CABINET_RATIO.w);
  let iD = Math.round(x * CABINET_RATIO.d);
  let iH = Math.round(x * CABINET_RATIO.h);

  // Ensure baffle is wide enough for the driver
  const driverDia = driver.dimensions?.overallDiameter ?? pistonDiameter(driver);
  const minBaffleWidth = Math.round(driverDia + 50);
  if (iW < minBaffleWidth) {
    // Adjust: keep volume by increasing depth
    const oldProduct = iW * iD * iH;
    iW = minBaffleWidth;
    const remaining = oldProduct / iW;
    // Keep D:H ratio = 1.3:1.7
    iD = Math.round(Math.sqrt(remaining * (CABINET_RATIO.d / CABINET_RATIO.h)));
    iH = Math.round(iD * (CABINET_RATIO.h / CABINET_RATIO.d));
    reasoning.push(`Baffel bredde øget til ${iW}mm for at rumme enhed (Ø${driverDia.toFixed(0)}mm).`);
  }

  // Wall thickness based on volume
  const wallThickness = vb < 25 ? 18 : vb < 80 ? 22 : 25;
  reasoning.push(`Vægtykkelse: ${wallThickness}mm (${vb < 25 ? 'kompakt' : vb < 80 ? 'mellem' : 'stort'} kabinet).`);

  // Round to nearest 5mm
  iW = Math.round(iW / 5) * 5;
  iD = Math.round(iD / 5) * 5;
  iH = Math.round(iH / 5) * 5;

  const extW = iW + 2 * wallThickness;
  const extD = iD + 2 * wallThickness;
  const extH = iH + 2 * wallThickness;

  const actualVolume = calcInternalVolume(extW, extH, extD, wallThickness);

  return {
    type,
    dimensions: {
      width: extW,
      height: extH,
      depth: extD,
      wallThickness,
      baffleWidth: extW,
      baffleHeight: extH,
      frontRoundoverRadius: Math.min(25, Math.round(extW * 0.06)),
    },
    sealed,
    ported,
    portLength,
    internalVolume: actualVolume,
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Baffle suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest optimal front baffle dimensions based on the selected drivers
 * and crossover frequencies.
 *
 * The baffle must:
 *   1. Be wide enough to fit all drivers with adequate edge clearance
 *   2. Have a baffle step frequency below the lowest crossover point
 *      (so the crossover region operates in 2π half-space)
 *   3. Be tall enough to stack all drivers with spacing
 *   4. Have edge roundover to minimise diffraction
 *
 * @param drivers        All drivers in the system.
 * @param crossoverFreqs Crossover frequencies (lowpass of each band + 0 for top).
 *                       If empty, a default target is used.
 */
export function suggestBaffle(
  drivers: Driver[],
  crossoverFreqs: number[] = [],
): BaffleSuggestionResult {
  const reasoning: string[] = [];
  const validDrivers = drivers.filter((d) => d && d.id);

  if (validDrivers.length === 0) {
    return { width: 300, height: 900, roundoverRadius: 19, fStep: 572, reasoning: ['Ingen enheder valgt — standard baffel.'] };
  }

  // 1. Minimum width from largest driver diameter
  const overallDiameters = validDrivers.map((d) => d.dimensions?.overallDiameter ?? pistonDiameter(d));
  const maxOverall = Math.max(...overallDiameters);
  const minWidth = Math.round(maxOverall + 50); // 25mm clearance each side
  reasoning.push(`Min. baffelbredde: ${minWidth}mm (største enhed Ø${maxOverall.toFixed(0)}mm + 50mm margin).`);

  // 2. Target baffle step frequency
  const positiveXo = crossoverFreqs.filter((f) => f > 0);
  let targetFStep: number;

  if (positiveXo.length > 0) {
    const lowestXo = Math.min(...positiveXo);
    targetFStep = lowestXo * 0.6; // 60% of lowest crossover
    reasoning.push(
      `Målbaffelstep: ${targetFStep.toFixed(0)}Hz (60% af laveste deling ${lowestXo}Hz ` +
      `— sikrer 2π i deleområdet).`,
    );
  } else {
    // No crossover info: estimate from woofer Fs
    const woofer = validDrivers.find((d) => d.type === 'woofer' || d.type === 'subwoofer');
    if (woofer) {
      targetFStep = Math.min(woofer.tsParams.fs * 3, 500);
      reasoning.push(`Målbaffelstep: ${targetFStep.toFixed(0)}Hz (estimeret fra bas Fs ${woofer.tsParams.fs}Hz).`);
    } else {
      targetFStep = 400;
      reasoning.push(`Målbaffelstep: ${targetFStep.toFixed(0)}Hz (standard for boghylde uden bas).`);
    }
  }

  // 3. Ideal width from baffle step: W = c / (2 × f_step)
  const idealWidth = Math.round(C / (2 * targetFStep));

  // 4. Choose width: must be ≥ minWidth, prefer idealWidth but clamp
  let width = Math.max(minWidth, idealWidth);
  width = clamp(width, 150, 600);
  width = Math.round(width / 5) * 5;

  const fStep = baffleStepFrequency(width);
  const baffleTypeNote = width > 400
    ? '(bred baffel — velegnet til gulvhøjttaler).'
    : '(smal baffel — god direktivitet, velegnet til boghylde).';
  reasoning.push(
    `Valgt baffelbredde: ${width}mm → baffelstep ved ${fStep.toFixed(0)}Hz. ${baffleTypeNote}`,
  );

  // 5. Height: stack drivers vertically + margins
  // Sort by type: tweeter on top, then mid, then woofer at bottom
  const typeOrder: Record<DriverType, number> = {
    tweeter: 0,
    midrange: 1,
    fullrange: 1,
    woofer: 2,
    subwoofer: 3,
  };
  const sorted = [...validDrivers].sort((a, b) => (typeOrder[a.type] ?? 2) - (typeOrder[b.type] ?? 2));

  let stackHeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    const dia = sorted[i]!.dimensions?.overallDiameter ?? pistonDiameter(sorted[i]!);
    stackHeight += dia;
    if (i < sorted.length - 1) {
      stackHeight += 30; // 30mm between drivers
    }
  }
  const height = Math.round((stackHeight + 80) / 5) * 5; // 40mm top + bottom margin
  reasoning.push(`Baffelhøjde: ${height}mm (stak af ${sorted.length} enheder + margin).`);

  // 6. Roundover: reduce edge diffraction
  const roundover = Math.min(30, Math.round(width * 0.08));
  reasoning.push(`Afrunding: ${roundover}mm (reducerer kant-diffraktion).`);

  return { width, height, roundoverRadius: roundover, fStep, reasoning };
}

// ---------------------------------------------------------------------------
// Combined system suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest a complete system design: crossover + cabinet + baffle.
 *
 * @param drivers     All selected drivers (2-4 units).
 * @param ways        Number of ways.
 * @param cabinetType Desired cabinet type.
 */
export function suggestSystem(
  drivers: Driver[],
  ways: 2 | 3 | 4,
  cabinetType: CabinetType,
): SystemSuggestion {
  const crossover = suggestCrossover(drivers, ways);
  const xoFreqs = crossover.bands.map((b) => b.lowpassFreq);
  const baffle = suggestBaffle(drivers, xoFreqs);

  // Find the woofer/subwoofer for cabinet design
  const woofer = drivers.find((d) => d.type === 'woofer' || d.type === 'subwoofer')
    ?? drivers.find((d) => d.type === 'midrange' || d.type === 'fullrange')
    ?? drivers[0]!;
  const cabinet = suggestCabinet(woofer, cabinetType);

  return { crossover, cabinet, baffle };
}

// ===========================================================================
// Auto-tuning: optimize per-band gains to flatten the in-room response
// ===========================================================================

export interface RoomOptimizationResult {
  /** Optimized gain per band [dB] */
  optimizedGains: number[];
  /** Original gains [dB] */
  originalGains: number[];
  /** Standard deviation of in-room response before optimization [dB] */
  beforeFlatness: number;
  /** Standard deviation of in-room response after optimization [dB] */
  afterFlatness: number;
  /** Improvement in flatness [dB] */
  improvement: number;
  /** Target level (mean SPL) after optimization [dB] */
  targetLevel: number;
  /** Human-readable reasoning lines */
  reasoning: string[];
}

/**
 * Sum a set of band curves (with per-band gain and polarity) into a single
 * frequency-response curve via voltage summation.
 *
 * @param bandCurves  Each band's curve at the band's base level (gain already
 *                    may or may not be applied — see bandGains).
 * @param bandGains   Per-band gain in dB to apply on top of each curve.
 * @param polarities  Per-band polarity (0 or 180).
 * @returns Summed frequency-response points.
 */
function sumBands(
  bandCurves: FrequencyDataPoint[][],
  bandGains: number[],
  polarities: (0 | 180)[],
): FrequencyDataPoint[] {
  if (bandCurves.length === 0) return [];
  const freqs = bandCurves[0]!.map((p) => p.freq);
  return freqs.map((f, i) => {
    let sumLinear = 0;
    for (let b = 0; b < bandCurves.length; b++) {
      const curve = bandCurves[b]!;
      const db = curve[i]!.magnitude + bandGains[b]!;
      const sign = polarities[b] === 180 ? -1 : 1;
      sumLinear += sign * Math.pow(10, db / 20);
    }
    return { freq: f, magnitude: 20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)) };
  });
}

/**
 * Standard deviation of dB values over a target frequency range, weighted
 * equally per frequency point. Lower = flatter.
 */
function flatnessScore(
  curve: FrequencyDataPoint[],
  fMin: number,
  fMax: number,
): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return Infinity;
  const mean = inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
  const variance = inRange.reduce((a, p) => a + (p.magnitude - mean) ** 2, 0) / inRange.length;
  return Math.sqrt(variance);
}

/**
 * Composite cost function: flatness (std dev) + penalty for large gain
 * excursions. This prevents the optimizer from driving gains to extremes
 * while still finding meaningful flatness improvements.
 *
 * @param curve        The in-room response curve to evaluate.
 * @param fMin         Lower bound of target range [Hz].
 * @param fMax         Upper bound of target range [Hz].
 * @param trialGains   The gains being tried [dB per band].
 * @param initialGains The original gains [dB per band].
 */
function costFunction(
  curve: FrequencyDataPoint[],
  fMin: number,
  fMax: number,
  trialGains: number[],
  initialGains: number[],
): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return Infinity;
  const mean = inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
  const variance = inRange.reduce((a, p) => a + (p.magnitude - mean) ** 2, 0) / inRange.length;
  const stdDev = Math.sqrt(variance);
  // Penalise large gain excursions from initial: 0.01× the sum of squared deltas
  // Very low weight: allows ±3-5 dB adjustments, only discourages ±10 dB extremes
  let gainPenalty = 0;
  for (let i = 0; i < trialGains.length; i++) {
    const delta = trialGains[i]! - initialGains[i]!;
    gainPenalty += delta * delta;
  }
  gainPenalty *= 0.01;
  return stdDev + gainPenalty;
}

/**
 * Optimize per-band gains to flatten the simulated in-room response.
 *
 * Uses coordinate descent: for each band, scan a range of gain values and
 * pick the one that minimises the standard deviation of the smoothed
 * in-room response over the target frequency range. The room acoustics
 * model (boundary gain + modes + smoothing) is applied at each evaluation
 * so the optimiser works on the actual predicted in-room curve.
 *
 * @param bandCurvesZero    Each band's processed curve with gain=0 applied
 *                          (crossover + baffle step + cabinet loading done,
 *                          gain/polarity NOT applied). Curves share the same
 *                          frequency grid.
 * @param polarities        Per-band polarity (0 or 180), fixed during optimisation.
 * @param initialGains      Starting gains [dB] per band.
 * @param roomParams        Room acoustics parameters for the in-room model.
 * @param smoothingFraction Fractional-octave smoothing (1, 3, 6, 12).
 * @param fMin              Lower bound of target flatness range [Hz].
 * @param fMax              Upper bound of target flatness range [Hz].
 * @returns Optimisation result with optimized gains, flatness metrics, reasoning.
 */
export function optimizeGainsForRoom(
  bandCurvesZero: FrequencyDataPoint[][],
  polarities: (0 | 180)[],
  initialGains: number[],
  roomParams: RoomAcousticsParams,
  smoothingFraction: number = 3,
  fMin: number = 80,
  fMax: number = 8000,
): RoomOptimizationResult {
  const reasoning: string[] = [];
  const nBands = bandCurvesZero.length;

  if (nBands === 0 || nBands !== initialGains.length) {
    reasoning.push('Antal bånd matcher ikke — optimering ikke mulig.');
    return {
      optimizedGains: initialGains.slice(),
      originalGains: initialGains.slice(),
      beforeFlatness: Infinity,
      afterFlatness: Infinity,
      improvement: 0,
      targetLevel: 0,
      reasoning,
    };
  }

  // Baseline: current gains, compute in-room flatness
  const baselineSum = sumBands(bandCurvesZero, initialGains, polarities);
  const baselineInRoom = calcInRoomResponse(baselineSum, roomParams, smoothingFraction);
  const beforeScore = flatnessScore(baselineInRoom.inRoomResponse, fMin, fMax);
  const targetMean = meanInRange(baselineInRoom.inRoomResponse, fMin, fMax);
  reasoning.push(
    `Start: in-room fladheds-score (std dev) = ${beforeScore.toFixed(2)} dB ` +
    `over ${fMin}-${fMax} Hz, gennemsnit ${targetMean.toFixed(1)} dB.`,
  );

  // Coordinate descent: optimise each band's gain in turn, repeat passes
  // Constraints: gain limited to ±10 dB from initial value (realistic DSP range)
  const GAIN_CLAMP = 10;
  let bestGains = initialGains.slice();
  const gainStep = 0.5; // dB resolution
  const maxPasses = 5;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improvedThisPass = false;

    for (let band = 0; band < nBands; band++) {
      let bestBandGain = bestGains[band]!;
      let bestBandCost = Infinity;

      // Scan gain within ±6 dB of current, but clamped to ±GAIN_CLAMP of initial
      const scanStart = Math.max(
        initialGains[band]! - GAIN_CLAMP,
        bestGains[band]! - 6,
      );
      const scanEnd = Math.min(
        initialGains[band]! + GAIN_CLAMP,
        bestGains[band]! + 6,
      );
      for (let g = scanStart; g <= scanEnd + 1e-9; g += gainStep) {
        const trialGains = bestGains.slice();
        trialGains[band] = g;
        const trialSum = sumBands(bandCurvesZero, trialGains, polarities);
        const trialInRoom = calcInRoomResponse(trialSum, roomParams, smoothingFraction);
        const cost = costFunction(trialInRoom.inRoomResponse, fMin, fMax, trialGains, initialGains);
        if (cost < bestBandCost - 1e-9) {
          bestBandCost = cost;
          bestBandGain = g;
        }
      }

      if (Math.abs(bestBandGain - bestGains[band]!) > 1e-9) {
        bestGains[band] = Math.round(bestBandGain * 10) / 10;
        improvedThisPass = true;
      }
    }

    if (!improvedThisPass) {
      reasoning.push(`Optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
    if (pass === maxPasses - 1) {
      reasoning.push(`Maks antal passager (${maxPasses}) nået.`);
    }
  }

  // Final evaluation
  const optimizedSum = sumBands(bandCurvesZero, bestGains, polarities);
  const optimizedInRoom = calcInRoomResponse(optimizedSum, roomParams, smoothingFraction);
  const afterScore = flatnessScore(optimizedInRoom.inRoomResponse, fMin, fMax);
  const afterMean = meanInRange(optimizedInRoom.inRoomResponse, fMin, fMax);
  const improvement = beforeScore - afterScore;

  reasoning.push(
    `Optimeret gains: [${bestGains.map((g) => g.toFixed(1)).join(', ')}] dB.`,
  );
  reasoning.push(
    `Resultat: fladheds-score ${afterScore.toFixed(2)} dB ` +
    `(forbedring ${improvement.toFixed(2)} dB), gennemsnit ${afterMean.toFixed(1)} dB.`,
  );

  // Per-band delta
  for (let b = 0; b < nBands; b++) {
    const delta = bestGains[b]! - initialGains[b]!;
    if (Math.abs(delta) > 0.05) {
      reasoning.push(`Bånd ${b + 1}: gain ${initialGains[b]!.toFixed(1)} → ${bestGains[b]!.toFixed(1)} dB (Δ${delta > 0 ? '+' : ''}${delta.toFixed(1)}).`);
    }
  }

  return {
    optimizedGains: bestGains,
    originalGains: initialGains.slice(),
    beforeFlatness: beforeScore,
    afterFlatness: afterScore,
    improvement,
    targetLevel: afterMean,
    reasoning,
  };
}

/** Mean magnitude over a frequency range. */
function meanInRange(curve: FrequencyDataPoint[], fMin: number, fMax: number): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return 0;
  return inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
}
