// Cabinet matching: given a specific cabinet, recommend drivers that fit
// and suggest a complete active crossover configuration for MiniDSP.
//
// Given a cabinet with known dimensions and port specs, this module:
//   - Scores every woofer/midbass in the catalog for physical + volume fit
//   - Scores tweeters for physical fit + crossover compatibility
//   - Recommends the best 2-way (or 3-way) driver combination
//   - Produces a MiniDSP configuration: crossover frequencies, filter types,
//     delay, gain, polarity, and PEQ/low-shelf/high-shelf suggestions
//
// Physical fit: cutout diameter < baffle width, mounting depth < cabinet depth.
// Volume fit: sealed Vb (at Qtc 0.707) and ported Vb compared to internal volume.
// PEQ suggestions: baffle step compensation, woofer breakup notches, tweeter Fs
// protection, room boundary gain compensation.

import type {
  Driver,
  DriverType,
  CrossoverType,
  FrequencyDataPoint,
} from '@/types';
import { calcSealed, calcPorted, calcPort, calcInternalVolume } from './thieleSmall';
import {
  suggestCrossover,
  pistonDiameter,
  acousticCenterDepth,
  usableRange,
  type CrossoverSuggestion,
} from './autoDesign';
import { baffleStepFrequency } from './baffle';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface CabinetSpec {
  name: string;
  height: number;        // [mm] external
  width: number;         // [mm] external front baffle width
  depth: number;         // [mm] external
  wallThickness: number; // [mm]
  portDiameter: number;  // [mm] (0 = sealed / no port)
  portLength: number;    // [mm]
  numPorts: number;
  portPosition: 'bottom' | 'front' | 'rear' | 'side';
  midChamberVolume?: number; // [L] sealed mid chamber volume (0/undefined = single chamber)
  wooferCount?: number;      // number of woofers sharing the bass chamber (default 1)
  wooferMounting?: 'front' | 'sides'; // where woofers are mounted (default 'front')
}

export interface PeqSuggestion {
  type: 'low_shelf' | 'high_shelf' | 'peak' | 'notch';
  freq: number;   // [Hz]
  gain: number;   // [dB]
  q: number;      // Q factor
  description: string;
}

export interface MiniDspOutput {
  label: string;          // e.g. "Output A"
  role: 'woofer' | 'mid' | 'tweeter';
  driverId: string;
  driverName: string;
  driverCount?: number;   // number of identical drivers (e.g. 2 for push-pull)
  highpassFreq: number;   // [Hz] (0 = none)
  highpassType: CrossoverType;
  lowpassFreq: number;    // [Hz] (0 = none / full range)
  lowpassType: CrossoverType;
  delay: number;          // [ms]
  gain: number;           // [dB]
  polarity: 0 | 180;
  peq: PeqSuggestion[];
}

export interface MiniDspConfig {
  plugin: string;         // e.g. "2way Advanced"
  sampleRate: 48 | 96;
  inputGain: number;      // [dB]
  outputs: MiniDspOutput[];
}

export interface DriverFitScore {
  driver: Driver;
  fits: boolean;
  physicalFit: boolean;
  volumeScore: number;     // 0-1, how well Vb matches internal volume
  qtsScore: number;        // 0-1
  overallScore: number;    // 0-100
  sealedVb?: number;
  portedVb?: number;
  portedFb?: number;
  portedF3?: number;
  reasons: string[];
  warnings: string[];
}

export interface SystemRecommendation {
  cabinet: CabinetSpec;
  internalVolume: number;
  ways: 2 | 3;
  wooferScore: DriverFitScore;
  tweeterScore: DriverFitScore;
  midScore?: DriverFitScore;
  crossover: CrossoverSuggestion;
  miniDspConfig: MiniDspConfig;
  reasoning: string[];
}

// ---------------------------------------------------------------------------
// Cabinet presets
// ---------------------------------------------------------------------------

export const CABINET_PRESETS: { name: string; spec: CabinetSpec }[] = [
  {
    name: 'Kudos X2',
    spec: {
      name: 'Kudos X2',
      height: 720,
      width: 165,
      depth: 205,
      wallThickness: 18,
      portDiameter: 70,
      portLength: 250,
      numPorts: 1,
      portPosition: 'bottom',
    },
  },
  {
    name: 'Custom',
    spec: {
      name: 'Custom',
      height: 400,
      width: 200,
      depth: 300,
      wallThickness: 18,
      portDiameter: 60,
      portLength: 150,
      numPorts: 1,
      portPosition: 'front',
    },
  },
  {
    name: 'MK2 Reference',
    spec: {
      name: 'MK2 Reference',
      height: 1080,
      width: 300,
      depth: 370,
      wallThickness: 22,
      portDiameter: 0,    // sealed
      portLength: 0,
      numPorts: 1,
      portPosition: 'bottom',
      midChamberVolume: 5.7,  // ~5.7L sealed mid chamber
      wooferCount: 2,          // 2x GRS 8SW-4HE-8 push-push
      wooferMounting: 'sides', // push-push: one woofer per side panel
    },
  },
  {
    name: 'MK3 Reference',
    spec: {
      name: 'MK3 Reference',
      height: 1180,
      width: 300,
      depth: 420,
      wallThickness: 22,
      portDiameter: 0,    // sealed
      portLength: 0,
      numPorts: 1,
      portPosition: 'bottom',
      midChamberVolume: 13,   // ~13L sealed mid chamber
      wooferCount: 2,          // 2x push-push
      wooferMounting: 'sides', // push-push: one woofer per side panel
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = 343000; // speed of sound [mm/s]

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Interpolate a frequency response curve at a given frequency. */
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
 * Find significant peaks in a frequency response curve within a range.
 * Returns peaks as {freq, magnitude, prominence} sorted by prominence.
 */
function findPeaks(
  curve: FrequencyDataPoint[],
  fMin: number,
  fMax: number,
  minProminence: number = 3,
): { freq: number; magnitude: number; prominence: number }[] {
  if (curve.length < 5) return [];
  const peaks: { freq: number; magnitude: number; prominence: number }[] = [];

  // Sample at log-spaced frequencies
  const nSamples = 300;
  const logStart = Math.log(Math.max(fMin, curve[0]!.freq));
  const logEnd = Math.log(Math.min(fMax, curve[curve.length - 1]!.freq));
  if (logEnd <= logStart) return [];

  const samples: { f: number; db: number }[] = [];
  for (let i = 0; i <= nSamples; i++) {
    const f = Math.exp(logStart + (logEnd - logStart) * (i / nSamples));
    samples.push({ f, db: interpolateAt(curve, f) });
  }

  for (let i = 2; i < samples.length - 2; i++) {
    if (
      samples[i]!.db > samples[i - 1]!.db &&
      samples[i]!.db > samples[i + 1]!.db &&
      samples[i]!.db > samples[i - 2]!.db &&
      samples[i]!.db > samples[i + 2]!.db
    ) {
      // Prominence: how much it sticks above the local average
      const window = samples.slice(Math.max(0, i - 10), Math.min(samples.length, i + 10));
      const localAvg = window.reduce((a, s) => a + s.db, 0) / window.length;
      const prominence = samples[i]!.db - localAvg;
      if (prominence >= minProminence) {
        peaks.push({
          freq: samples[i]!.f,
          magnitude: samples[i]!.db,
          prominence,
        });
      }
    }
  }

  return peaks.sort((a, b) => b.prominence - a.prominence);
}

// ---------------------------------------------------------------------------
// Driver scoring
// ---------------------------------------------------------------------------

/**
 * Score a woofer/midbass driver for fit in a given cabinet.
 *
 * Checks:
 * - Physical: cutout diameter fits baffle width, mounting depth fits cabinet depth
 * - Volume: sealed Vb and ported Vb close to cabinet internal volume
 * - Qts: suitability for sealed vs ported given the volume ratio
 */
export function scoreWooferForCabinet(
  driver: Driver,
  cabinet: CabinetSpec,
  internalVolume: number,
  driverCount: number = 1,
): DriverFitScore {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ts = driver.tsParams;

  // Physical fit
  const cutout = driver.dimensions?.cutoutDiameter ?? pistonDiameter(driver) * 1.1;
  const mountDepth = driver.dimensions?.mountingDepth ?? 0;
  const mounting = cabinet.wooferMounting ?? 'front';

  // For side-mounted woofers (push-push), the cutout must fit the side panel
  // (depth × height) and mounting depth must fit within cabinet width
  const panelWidth = mounting === 'sides' ? cabinet.depth : cabinet.width;
  const availableDepth = mounting === 'sides'
    ? cabinet.width - 2 * cabinet.wallThickness  // depth goes across cabinet width
    : cabinet.depth - cabinet.wallThickness - 20;

  const cutoutFits = cutout < panelWidth - 10; // 10mm margin
  const depthFits = mountDepth === 0 || mountDepth < availableDepth;
  const physicalFit = cutoutFits && depthFits;

  if (!cutoutFits) {
    warnings.push(`Cutout Ø${cutout.toFixed(0)}mm > panelbredde ${panelWidth}mm (margin 10mm).`);
  }
  if (!depthFits && mountDepth > 0) {
    warnings.push(`Monteringsdybde ${mountDepth}mm > tilgængelig dybde ${availableDepth.toFixed(0)}mm.`);
  }

  // Volume fit
  let sealedVb: number | undefined;
  let portedVb: number | undefined;
  let portedFb: number | undefined;
  let portedF3: number | undefined;
  let volumeScore = 0;

  if (ts.vas && ts.qts && ts.qts > 0) {
    try {
      // For N identical drivers sharing one enclosure: Vas_total = N × Vas_single
      const effectiveTs = driverCount > 1
        ? { ...ts, vas: ts.vas * driverCount }
        : ts;
      const sealed = calcSealed(effectiveTs, 0.707);
      sealedVb = sealed.vb;
      const ported = calcPorted(effectiveTs);
      portedVb = ported.vb;
      portedFb = ported.fb;
      portedF3 = ported.f3;

      // Score: how close is the design Vb to the actual internal volume?
      // Use the relevant type based on whether the cabinet has a port
      const hasPort = cabinet.portDiameter > 0 && cabinet.portLength > 0;
      const designVb = hasPort ? portedVb : sealedVb;
      const ratio = internalVolume / designVb;

      if (ratio >= 0.5 && ratio <= 2.0) {
        // Good fit: within 2x of design volume
        const deviation = Math.abs(Math.log2(ratio));
        volumeScore = clamp(1 - deviation / 2, 0.3, 1);
        reasons.push(
          `${hasPort ? 'Ported' : 'Sealed'} Vb=${designVb.toFixed(1)}L vs kabinet ${internalVolume.toFixed(1)}L (ratio ${ratio.toFixed(2)}).`,
        );
      } else if (ratio >= 0.3 && ratio <= 3.0) {
        volumeScore = clamp(1 - Math.abs(Math.log2(ratio)) / 3, 0.1, 0.5);
        reasons.push(
          `${hasPort ? 'Ported' : 'Sealed'} Vb=${designVb.toFixed(1)}L vs kabinet ${internalVolume.toFixed(1)}L — acceptabel men ikke optimal.`,
        );
      } else {
        volumeScore = 0.1;
        warnings.push(
          `${hasPort ? 'Ported' : 'Sealed'} Vb=${designVb.toFixed(1)}L vs kabinet ${internalVolume.toFixed(1)}L — dårlig match.`,
        );
      }
    } catch {
      volumeScore = 0.2;
      warnings.push('Kunne ikke beregne kabinetvolumen for denne enhed.');
    }
  } else {
    volumeScore = 0.3;
    warnings.push('Manglende T/S parametre (Vas/Qts) — volumen-vurdering upålidelig.');
  }

  // Qts suitability
  let qtsScore = 0.5;
  if (ts.qts) {
    const hasPort = cabinet.portDiameter > 0 && cabinet.portLength > 0;
    if (hasPort) {
      // Ported: best Qts 0.30-0.45
      if (ts.qts >= 0.30 && ts.qts <= 0.45) {
        qtsScore = 1.0;
        reasons.push(`Qts=${ts.qts.toFixed(3)} optimal for ported.`);
      } else if (ts.qts >= 0.25 && ts.qts <= 0.55) {
        qtsScore = 0.6;
        reasons.push(`Qts=${ts.qts.toFixed(3)} acceptabel for ported.`);
      } else {
        qtsScore = 0.2;
        warnings.push(`Qts=${ts.qts.toFixed(3)} uden for ported område (0.30-0.45).`);
      }
    } else {
      // Sealed: best Qts 0.40-0.70
      if (ts.qts >= 0.40 && ts.qts <= 0.70) {
        qtsScore = 1.0;
        reasons.push(`Qts=${ts.qts.toFixed(3)} optimal for sealed.`);
      } else if (ts.qts >= 0.30 && ts.qts <= 0.85) {
        qtsScore = 0.6;
        reasons.push(`Qts=${ts.qts.toFixed(3)} acceptabel for sealed.`);
      } else {
        qtsScore = 0.3;
        warnings.push(`Qts=${ts.qts.toFixed(3)} uden for sealed område (0.40-0.70).`);
      }
    }
  }

  // Overall score (weighted)
  const physicalPenalty = physicalFit ? 1.0 : 0.3;
  const overallScore = Math.round(
    clamp(
      (volumeScore * 0.4 + qtsScore * 0.3 + physicalPenalty * 0.3) * 100,
      0,
      100,
    ),
  );

  return {
    driver,
    fits: physicalFit && volumeScore > 0.15,
    physicalFit,
    volumeScore,
    qtsScore,
    overallScore,
    sealedVb,
    portedVb,
    portedFb,
    portedF3,
    reasons,
    warnings,
  };
}

/**
 * Score a tweeter for physical fit in a given cabinet.
 *
 * Tweeters don't need volume matching — just physical fit + usable range
 * compatibility with the likely crossover frequency.
 */
export function scoreTweeterForCabinet(
  driver: Driver,
  cabinet: CabinetSpec,
  crossoverFreq: number,
): DriverFitScore {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ts = driver.tsParams;

  // Physical fit
  const cutout = driver.dimensions?.cutoutDiameter ?? pistonDiameter(driver) * 1.1;
  const cutoutFits = cutout < cabinet.width - 10;
  const physicalFit = cutoutFits;

  if (!cutoutFits) {
    warnings.push(`Cutout Ø${cutout.toFixed(0)}mm > baffelbredde ${cabinet.width}mm.`);
  }

  // Crossover compatibility: tweeter must be usable above crossoverFreq
  let volumeScore = 0.5; // not used for tweeters, placeholder
  let qtsScore = 0.5;

  if (crossoverFreq > 0) {
    const safeMin = ts.fs * 1.5; // crossover should be at least 1.5x Fs
    if (crossoverFreq >= safeMin) {
      qtsScore = 1.0;
      reasons.push(`Deling ${crossoverFreq}Hz > Fs×1.5 (${safeMin.toFixed(0)}Hz) — diskant beskyttet.`);
    } else if (crossoverFreq >= ts.fs * 1.2) {
      qtsScore = 0.5;
      warnings.push(`Deling ${crossoverFreq}Hz tæt på Fs (${ts.fs}Hz) — brug stejlere filter (LR4+).`);
    } else {
      qtsScore = 0.1;
      warnings.push(`Deling ${crossoverFreq}Hz < Fs (${ts.fs}Hz) — diskant i fare!`);
    }
  }

  // Directivity match: tweeter piston diameter should be small enough
  // that it's still omnidirectional at the crossover frequency
  const dia = pistonDiameter(driver);
  const dirLimit = C / (dia * 3); // -3dB at 3× diameter wavelength
  if (crossoverFreq > 0 && crossoverFreq < dirLimit) {
    reasons.push(`Diskant diameter ${dia.toFixed(0)}mm — direktivitet OK ved ${crossoverFreq}Hz.`);
    qtsScore = Math.min(1.0, qtsScore + 0.1);
  } else if (crossoverFreq > 0) {
    warnings.push(`Diskant begynder at være direktiv ved ${crossoverFreq}Hz (grænse ${dirLimit.toFixed(0)}Hz).`);
  }

  const overallScore = Math.round(
    clamp(
      (qtsScore * 0.5 + (physicalFit ? 0.5 : 0.15) * 0.5) * 100,
      0,
      100,
    ),
  );

  return {
    driver,
    fits: physicalFit && qtsScore > 0.2,
    physicalFit,
    volumeScore,
    qtsScore,
    overallScore,
    reasons,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// PEQ suggestion engine
// ---------------------------------------------------------------------------

/**
 * Generate PEQ suggestions for the woofer channel.
 *
 * Suggestions:
 * 1. Baffle step compensation: low shelf or peak at fStep = c/(2×baffleWidth)
 * 2. Woofer breakup modes: notch filters for peaks above crossover
 * 3. Room boundary gain: low shelf at ~50-80 Hz
 */
function suggestWooferPeq(
  driver: Driver,
  cabinet: CabinetSpec,
  crossoverFreq: number,
): PeqSuggestion[] {
  const peq: PeqSuggestion[] = [];
  const ts = driver.tsParams;

  // 1. Baffle step compensation
  // The baffle step frequency: fStep = c / (2 × baffleWidth)
  // Below this frequency, radiation transitions from 2π (half-space) to 4π (full-space),
  // causing a ~3-6 dB level drop. In an active system this is corrected with EQ.
  const baffleW = cabinet.width;
  const fStep = baffleStepFrequency(baffleW);

  // Baffle step compensation: low shelf at fStep, +3 dB (half of the 6 dB step)
  // In an active system we can fully correct the 6 dB step, but +3-4 dB is more
  // natural sounding and leaves room for room gain at the low end
  peq.push({
    type: 'low_shelf',
    freq: Math.round(fStep),
    gain: 3,
    q: 0.7,
    description: `Baffeltrin kompensation: +3 dB ved ${Math.round(fStep)} Hz (baffelbredde ${baffleW}mm). Kompenserer for 4π→2π overgang.`,
  });

  // 2. Woofer breakup modes — scan frequency response for peaks above crossover
  if (driver.frequencyResponse && driver.frequencyResponse.length > 5 && crossoverFreq > 0) {
    const peaks = findPeaks(driver.frequencyResponse, crossoverFreq * 0.8, 20000, 3);
    // Take top 2 peaks
    for (const peak of peaks.slice(0, 2)) {
      const notchGain = -Math.round(Math.min(peak.prominence + 1, 8));
      peq.push({
        type: 'notch',
        freq: Math.round(peak.freq),
        gain: notchGain,
        q: 2.0,
        description: `Udstyringsresonans (breakup) ved ${Math.round(peak.freq)} Hz: ${notchGain} dB notch (Q=2). Reducerer forvrængning.`,
      });
    }
  }

  // 3. Room boundary gain compensation
  // In a typical room, boundary gain adds ~3-6 dB below ~100 Hz.
  // If the cabinet is ported and tuned low, this can cause boominess.
  // A gentle low shelf cut can tame this — but only suggest it if ported.
  const hasPort = cabinet.portDiameter > 0 && cabinet.portLength > 0;
  if (hasPort && ts.fs && ts.fs < 50) {
    peq.push({
      type: 'low_shelf',
      freq: 50,
      gain: -2,
      q: 0.8,
      description: `Rum-grænse korrigering: -2 dB ved 50 Hz. Reducerer boomy bas fra rum-forstærkning med ported kabinet.`,
    });
  }

  return peq;
}

/**
 * Generate PEQ suggestions for the tweeter channel.
 *
 * Suggestions:
 * 1. Tweeter Fs resonance notch (if crossover is close to Fs)
 * 2. High-frequency response smoothing (notches for peaks above 10kHz)
 * 3. High shelf for air/sparkle if tweeter rolls off above 15kHz
 */
function suggestTweeterPeq(
  driver: Driver,
  crossoverFreq: number,
): PeqSuggestion[] {
  const peq: PeqSuggestion[] = [];
  const ts = driver.tsParams;

  // 1. Fs protection notch — if crossover is within 1.5x of Fs
  if (ts.fs && crossoverFreq > 0 && crossoverFreq < ts.fs * 2) {
    peq.push({
      type: 'notch',
      freq: Math.round(ts.fs),
      gain: -6,
      q: 3.0,
      description: `Diskant Fs resonans ved ${ts.fs} Hz: -6 dB notch (Q=3). Beskytter mod resonans når delefilter er tæt på Fs.`,
    });
  }

  // 2. High-frequency response smoothing
  if (driver.frequencyResponse && driver.frequencyResponse.length > 5) {
    const peaks = findPeaks(driver.frequencyResponse, 5000, 25000, 3);
    for (const peak of peaks.slice(0, 2)) {
      const notchGain = -Math.round(Math.min(peak.prominence + 1, 6));
      peq.push({
        type: 'notch',
        freq: Math.round(peak.freq),
        gain: notchGain,
        q: 2.5,
        description: `Højfrekvent spids ved ${Math.round(peak.freq)} Hz: ${notchGain} dB notch (Q=2.5). Gør diskanten glattere.`,
      });
    }

    // 3. Check if tweeter rolls off above 15 kHz — suggest high shelf
    const hfLevel = interpolateAt(driver.frequencyResponse, 15000);
    const midLevel = interpolateAt(driver.frequencyResponse, 5000);
    const hfDrop = midLevel - hfLevel;
    if (hfDrop > 4) {
      peq.push({
        type: 'high_shelf',
        freq: 12000,
        gain: Math.round(Math.min(hfDrop * 0.7, 5)),
        q: 0.7,
        description: `Højfrekvens boost: +${Math.round(Math.min(hfDrop * 0.7, 5))} dB ved 12 kHz. Kompenserer for fald over 15 kHz (luft/sparkle).`,
      });
    }
  }

  return peq;
}

// ---------------------------------------------------------------------------
// MiniDSP configuration builder
// ---------------------------------------------------------------------------

/**
 * Build a complete MiniDSP configuration from a crossover suggestion and
 * selected drivers, including PEQ/low-shelf/high-shelf recommendations.
 *
 * Assumes MiniDSP 2x4 HD or 2x4 Advanced plugin at 48 kHz sample rate.
 */
export function buildMiniDspConfig(
  crossover: CrossoverSuggestion,
  cabinet: CabinetSpec,
  drivers: Driver[],
): MiniDspConfig {
  const outputs: MiniDspOutput[] = [];
  const outputLabels = ['Output A', 'Output B', 'Output C', 'Output D'];

  // Find acoustic center depths for delay calculation
  const depths = crossover.bands.map((band) => {
    const driver = drivers.find((d) => d.id === band.driverId);
    return driver ? acousticCenterDepth(driver) : 40;
  });
  const maxDepth = Math.max(...depths, 1);

  // Input gain: -4 dB typical (headroom for EQ boosts)
  const inputGain = -4;

  for (let i = 0; i < crossover.bands.length; i++) {
    const band = crossover.bands[i]!;
    const driver = drivers.find((d) => d.id === band.driverId);
    if (!driver) continue;

    const role = band.role === 'high' ? 'tweeter' : band.role === 'mid' || band.role === 'mid2' ? 'mid' : 'woofer';
    const delay = ((maxDepth - depths[i]!) / C) * 1000; // ms

    // Generate PEQ suggestions based on role
    let peq: PeqSuggestion[] = [];
    if (role === 'woofer') {
      const xoFreq = band.lowpassFreq > 0 ? band.lowpassFreq : 2000;
      peq = suggestWooferPeq(driver, cabinet, xoFreq);
    } else if (role === 'tweeter') {
      const xoFreq = band.highpassFreq > 0 ? band.highpassFreq : 2000;
      peq = suggestTweeterPeq(driver, xoFreq);
    } else {
      // midrange: baffle step partial + breakup notches
      const xoHigh = band.lowpassFreq > 0 ? band.lowpassFreq : 3000;
      if (driver.frequencyResponse && driver.frequencyResponse.length > 5) {
        const peaks = findPeaks(driver.frequencyResponse, xoHigh * 0.8, 20000, 3);
        for (const peak of peaks.slice(0, 1)) {
          const notchGain = -Math.round(Math.min(peak.prominence + 1, 6));
          peq.push({
            type: 'notch',
            freq: Math.round(peak.freq),
            gain: notchGain,
            q: 2.0,
            description: `Mellemton breakup ved ${Math.round(peak.freq)} Hz: ${notchGain} dB notch.`,
          });
        }
      }
    }

    outputs.push({
      label: outputLabels[i] ?? `Output ${i + 1}`,
      role,
      driverId: driver.id,
      driverName: `${driver.manufacturer} ${driver.model}`,
      driverCount: role === 'woofer' ? (cabinet.wooferCount ?? 1) : 1,
      highpassFreq: band.highpassFreq,
      highpassType: band.highpassType,
      lowpassFreq: band.lowpassFreq,
      lowpassType: band.lowpassType,
      delay: Math.round(delay * 100) / 100,
      gain: band.gain,
      polarity: band.polarity,
      peq,
    });
  }

  const pluginName = crossover.ways === 2 ? '2way Advanced' : crossover.ways === 3 ? '3way Advanced' : '4way Advanced';

  return {
    plugin: pluginName,
    sampleRate: 48,
    inputGain,
    outputs,
  };
}

// ---------------------------------------------------------------------------
// System recommendation
// ---------------------------------------------------------------------------

/**
 * Recommend a complete driver + crossover + MiniDSP configuration for a
 * specific cabinet.
 *
 * @param allDrivers  All drivers in the catalog
 * @param cabinet     The target cabinet specification
 * @param ways        2-way or 3-way (default 2)
 * @returns System recommendation with best driver pairing + MiniDSP config
 */
export function recommendSystemForCabinet(
  allDrivers: Driver[],
  cabinet: CabinetSpec,
  ways: 2 | 3 = 2,
): SystemRecommendation {
  const reasoning: string[] = [];

  // Calculate internal volume
  const totalVolume = calcInternalVolume(
    cabinet.width,
    cabinet.height,
    cabinet.depth,
    cabinet.wallThickness,
  );
  const midChamber = cabinet.midChamberVolume ?? 0;
  const wooferCount = cabinet.wooferCount ?? 1;
  const bassVolume = Math.max(0, totalVolume - midChamber);

  reasoning.push(`Kabinet: ${cabinet.name}, ${cabinet.height}×${cabinet.width}×${cabinet.depth}mm, væg ${cabinet.wallThickness}mm.`);
  reasoning.push(`Intern volumen: ${totalVolume.toFixed(1)} L.`);
  if (midChamber > 0) {
    reasoning.push(`Lukket mellemkammer: ${midChamber.toFixed(1)} L. Bass volumen: ${bassVolume.toFixed(1)} L.`);
  }
  if (wooferCount > 1) {
    const mountDesc = (cabinet.wooferMounting ?? 'front') === 'sides' ? ' push-push (én per langside)' : '';
    reasoning.push(`${wooferCount} bas-enheder${mountDesc} (Vas ×${wooferCount}).`);
  }
  if (cabinet.portDiameter > 0 && cabinet.portLength > 0) {
    reasoning.push(`Port: Ø${cabinet.portDiameter}mm × ${cabinet.portLength}mm, ${cabinet.numPorts} stk (${cabinet.portPosition}).`);
    // Calculate port tuning from dimensions
    const portTuning = calcPortTuning(cabinet.portDiameter, cabinet.portLength, cabinet.numPorts, bassVolume);
    reasoning.push(`Port tuning (estimeret): ${portTuning.toFixed(0)} Hz.`);
  } else {
    reasoning.push(`Lukket kabinet (ingen port).`);
  }

  // Score all woofers/midbass drivers against the BASS volume
  const scoringVolume = midChamber > 0 ? bassVolume : totalVolume;
  const wooferTypes: DriverType[] = ways === 3
    ? ['woofer', 'midrange', 'subwoofer']
    : ['woofer', 'midrange', 'fullrange', 'subwoofer'];
  const wooferCandidates = allDrivers.filter((d) => wooferTypes.includes(d.type));
  const wooferScores = wooferCandidates
    .map((d) => scoreWooferForCabinet(d, cabinet, scoringVolume, wooferCount))
    .filter((s) => s.fits)
    .sort((a, b) => b.overallScore - a.overallScore);

  if (wooferScores.length === 0) {
    reasoning.push('Ingen enheder passer til kabinettet — justér dimensioner eller udvid kataloget.');
    // Return a minimal result with the first available drivers as fallback
    const fallbackWoofer = allDrivers.find((d) => d.type === 'woofer' || d.type === 'midrange') ?? allDrivers[0]!;
    const fallbackTweeter = allDrivers.find((d) => d.type === 'tweeter') ?? allDrivers[1]!;
    const fallbackDrivers = [fallbackWoofer, fallbackTweeter];
    const fallbackXo = suggestCrossover(fallbackDrivers, 2);
    return {
      cabinet,
      internalVolume: totalVolume,
      ways,
      wooferScore: scoreWooferForCabinet(fallbackWoofer, cabinet, scoringVolume, wooferCount),
      tweeterScore: scoreTweeterForCabinet(fallbackTweeter, cabinet, 2000),
      crossover: fallbackXo,
      miniDspConfig: buildMiniDspConfig(fallbackXo, cabinet, fallbackDrivers),
      reasoning: [...reasoning, 'Fald tilbage til første tilgængelige enheder (ingen fit fundet).'],
    };
  }

  const bestWoofer = wooferScores[0]!;
  reasoning.push(`Bedste bas/mellemtone: ${bestWoofer.driver.manufacturer} ${bestWoofer.driver.model} (score ${bestWoofer.overallScore}/100).`);

  // Estimate crossover frequency to find compatible tweeter
  const wooferRange = usableRange(bestWoofer.driver);
  const estXoFreq = Math.min(wooferRange.max, 3000); // don't cross too high

  // Score tweeters
  const tweeterCandidates = allDrivers.filter((d) => d.type === 'tweeter');
  const tweeterScores = tweeterCandidates
    .map((d) => scoreTweeterForCabinet(d, cabinet, estXoFreq))
    .filter((s) => s.fits)
    .sort((a, b) => b.overallScore - a.overallScore);

  if (tweeterScores.length === 0) {
    reasoning.push('Ingen diskant passer — bruger første tilgængelige.');
  }

  const bestTweeter = tweeterScores[0] ?? {
    driver: tweeterCandidates[0] ?? allDrivers.find((d) => d.type === 'tweeter') ?? allDrivers[0]!,
    fits: false,
    physicalFit: false,
    volumeScore: 0,
    qtsScore: 0,
    overallScore: 0,
    reasons: [],
    warnings: ['Ingen passende diskant fundet.'],
  };

  // For 3-way: find a midrange
  let midScore: DriverFitScore | undefined;
  let selectedDrivers: Driver[];

  if (ways === 3) {
    const midCandidates = allDrivers.filter(
      (d) => d.type === 'midrange' || d.type === 'fullrange',
    );
    // Score midrange against the mid chamber volume if present, else total volume
    const midScoringVolume = midChamber > 0 ? midChamber : totalVolume;
    const midScores = midCandidates
      .map((d) => scoreWooferForCabinet(d, cabinet, midScoringVolume))
      .filter((s) => s.fits && s.driver.id !== bestWoofer.driver.id)
      .sort((a, b) => b.overallScore - a.overallScore);

    if (midScores.length > 0) {
      midScore = midScores[0];
      selectedDrivers = [bestWoofer.driver, midScore.driver, bestTweeter.driver];
      reasoning.push(`Mellemtone: ${midScore.driver.manufacturer} ${midScore.driver.model} (score ${midScore.overallScore}/100).`);
    } else {
      // Fall back to 2-way — adjust so handoff stays consistent
      reasoning.push('Ingen mellemtone fundet — fald tilbage til 2-vejs.');
      selectedDrivers = [bestWoofer.driver, bestTweeter.driver];
    }
  } else {
    selectedDrivers = [bestWoofer.driver, bestTweeter.driver];
  }

  // Build crossover suggestion — use effectiveWays to handle 3→2 fallback
  const effectiveWays = (midScore ? 3 : 2) as 2 | 3;
  const crossover = suggestCrossover(selectedDrivers, effectiveWays);
  reasoning.push(...crossover.reasoning);

  // Build MiniDSP config
  const miniDspConfig = buildMiniDspConfig(crossover, cabinet, selectedDrivers);

  // Add port tuning note if applicable
  if (cabinet.portDiameter > 0 && bestWoofer.portedFb) {
    const portTuning = calcPortTuning(cabinet.portDiameter, cabinet.portLength, cabinet.numPorts, bassVolume);
    const fbDelta = portTuning - bestWoofer.portedFb;
    if (Math.abs(fbDelta) > 5) {
      reasoning.push(
        `Port tuning ${portTuning.toFixed(0)}Hz vs ideal ${bestWoofer.portedFb.toFixed(0)}Hz (Δ${fbDelta > 0 ? '+' : ''}${fbDelta.toFixed(0)}Hz). ` +
        `${Math.abs(fbDelta) > 15 ? 'Stor afvigelse — overvej at justere portlængde.' : 'Acceptabel afvigelse.'}`,
      );
    }
  }

  return {
    cabinet,
    internalVolume: totalVolume,
    ways: effectiveWays,
    wooferScore: bestWoofer,
    tweeterScore: bestTweeter,
    midScore,
    crossover,
    miniDspConfig,
    reasoning,
  };
}

/**
 * Calculate port tuning frequency from port dimensions and box volume.
 *
 * fb = (c / 2π) × sqrt(A / (Vb × (L + 0.847 × sqrt(π × A))))
 *
 * @param portDiameter  [mm]
 * @param portLength    [mm]
 * @param numPorts      number of ports
 * @param vb            box volume [L]
 * @returns tuning frequency [Hz]
 */
export function calcPortTuning(
  portDiameter: number,
  portLength: number,
  numPorts: number,
  vb: number,
): number {
  const c = 343000; // [mm/s]
  const areaPerPort = Math.PI * (portDiameter / 2) ** 2; // [mm²]
  const totalArea = areaPerPort * numPorts; // [mm²]
  const vbMm3 = vb * 1e6; // L → mm³

  // fb = (c / 2π) × sqrt(A / (Vb × (L + 0.847 × sqrt(π × A))))
  const endCorrection = 0.847 * Math.sqrt(totalArea / Math.PI);
  const effectiveLength = portLength + endCorrection;

  const fb = (c / (2 * Math.PI)) * Math.sqrt(totalArea / (vbMm3 * effectiveLength));
  return fb;
}

/**
 * Calculate the port length needed for a target tuning frequency.
 * Uses the same formula as calcPort but returns the result directly.
 */
export function calcPortLengthForTuning(
  portDiameter: number,
  numPorts: number,
  vb: number,
  fb: number,
): number {
  const port = calcPort(vb, fb, portDiameter, numPorts);
  return port.portLength;
}
