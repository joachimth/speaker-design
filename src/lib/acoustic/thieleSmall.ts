// Thiele-Small parameter calculations
// Ported from mk2-reference-loudspeaker simulation knowledge
//
// Reference: docs/ACOUSTIC_MODELS.md
// All formulas from standard loudspeaker engineering references:
// - Small, "Direct-Radiator Loudspeaker System Analysis" (1972)
// - Bullock, "Box System Programs"
// - Dickason, "Loudspeaker Design Cookbook"

import type {
  ThieleSmallParams,
  SealedAlignment,
  TransmissionLineAlignment,
  CabinetType,
} from '@/types';

// ---------------------------------------------------------------------------
// Sealed box
// ---------------------------------------------------------------------------

/**
 * Calculate sealed box alignment.
 *
 * Qtc target: 0.707 = maximally flat (Butterworth)
 *             < 0.707 = overdamped (better transient, less bass)
 *             > 0.707 = underdamped (more bass, peakier)
 *             1.0 = Chebyshev (C4 alignment, maximally extended)
 */
export function calcSealed(ts: ThieleSmallParams, qtcTarget: number): SealedAlignment {
  const { fs, qts, vas } = ts;
  void fs; // fs used in Fc calculation below

  // Box volume: Vb = Vas * (Qtc/Qts)^2 - 1 ... but the standard formula is:
  // Vb = Vas / ((Qtc/Qts)^2 - 1)
  const ratio = qtcTarget / qts;
  const vb = vas / (ratio * ratio - 1);

  // System resonance: Fc = Fs * (Qtc / Qts)
  const fc = fs * (qtcTarget / qts);

  // -3dB frequency for sealed box
  // For Qtc <= 0.707: F3 = Fc * sqrt( (Qtc^2 / (1 - Qtc^2)) + ... )
  // Simplified: F3 depends on Qtc
  const f3 = calcSealedF3(fc, qtcTarget);

  return {
    vb,
    fc,
    qtc: qtcTarget,
    f3,
  };
}

/**
 * Calculate F3 for a sealed box given Fc and Qtc.
 * Uses the standard approximation.
 */
export function calcSealedF3(fc: number, qtc: number): number {
  if (qtc <= 0) return fc;
  // For Qtc = 0.707, F3 = Fc
  // For Qtc < 0.707, F3 > Fc (roll-off starts earlier)
  // For Qtc > 0.707, F3 < Fc (but with a peak)
  const ratio = Math.sqrt(
    (qtc * qtc - 0.5) / (qtc * qtc) + Math.sqrt((qtc * qtc - 0.5) ** 2 / (qtc ** 4) + 0.25)
  );
  return fc * (ratio > 0 ? ratio : 1);
}

/**
 * Generate the sealed box frequency response curve.
 * Returns normalized response in dB.
 */
export function sealedResponse(
  _ts: ThieleSmallParams,
  alignment: SealedAlignment,
  frequencies: number[]
): number[] {
  const { qtc, fc } = alignment;
  const fn2 = frequencies.map((f) => (f / fc) ** 2);
  const fn4 = fn2.map((f2) => f2 * f2);

  return fn4.map((_f4, i) => {
    const denom = fn4[i] + fn2[i] * (qtc * qtc - 1) + 1;
    const mag = Math.sqrt(1 / denom);
    return 20 * Math.log10(mag);
  });
}

// ---------------------------------------------------------------------------
// Ported (bass reflex) box
// ---------------------------------------------------------------------------

export interface PortedDesignParams {
  alignmentType: 'SBB4' | 'SC4' | 'QB3' | 'C4' | 'BB4';
  vb: number;  // Box volume [L]
  fb: number;  // Tuning frequency [Hz]
  f3: number;  // -3dB frequency [Hz]
}

/**
 * Calculate ported box alignment.
 *
 * Uses the Thiele alignments based on Qts:
 * - Qts < 0.38: QB3 (quasi third-order Butterworth) - best for low Qts
 * - Qts 0.38-0.55: SC4 / SBB4 - moderate
 * - Qts > 0.55: C4 / BB4 - high Qts (less common)
 */
export function calcPorted(ts: ThieleSmallParams): PortedDesignParams {
  const { fs, qts, vas } = ts;

  // Simplified alignment selection
  let alignmentType: PortedDesignParams['alignmentType'];
  let vb: number;
  let fb: number;

  if (qts < 0.38) {
    // QB3 alignment
    alignmentType = 'QB3';
    const k = 1.0 + 0.5 * qts; // simplified
    vb = vas * 0.5 * k;
    fb = fs * (1.0 + 0.3 * (1.0 / qts - 2.5));
  } else if (qts < 0.55) {
    // SBB4 / SC4
    alignmentType = 'SBB4';
    vb = vas * (20 * qts * qts);
    fb = fs * (0.38 + 0.5 * qts);
  } else {
    // C4 alignment (high Qts - generally not recommended)
    alignmentType = 'C4';
    vb = vas * (2.5 * qts * qts);
    fb = fs * 0.9;
  }

  // Clamp to reasonable values
  vb = Math.max(2, Math.min(vb, 500));
  fb = Math.max(10, Math.min(fb, 200));

  // Estimate F3 (simplified): typically 0.5-0.8x Fs for ported
  const f3 = fs * (qts < 0.38 ? 0.6 : qts < 0.55 ? 0.7 : 0.85);

  return { alignmentType, vb, fb, f3 };
}

/**
 * Calculate port dimensions for a given tuning.
 *
 * Port resonance: fb = c / (2π) * sqrt(A / (L + 0.847 * sqrt(π * A)))
 * where A = port cross-sectional area, L = port length, c = speed of sound
 *
 * Rearranged: L = (c / (2π * fb))^2 * A / Vb - 1.732 * sqrt(A/π)
 * Simplified port length formula:
 * L = (23562.5 * D^2 / (fb^2 * Vb)) - 1.732 * D  (D in mm, Vb in L)
 */
export function calcPort(
  vb: number,
  fb: number,
  portDiameter: number,
  numPorts: number = 1
): { portLength: number; portDiameter: number } {
  const c = 343000; // speed of sound [mm/s]
  const areaPerPort = Math.PI * (portDiameter / 2) ** 2; // [mm²]
  const totalArea = areaPerPort * numPorts;

  // Port length: L = (c / (2π * fb))^2 * A / Vb_m3 - 1.732 * sqrt(A/π)
  // Vb in m³: Vb * 1e-6 (L → mm³ → m³ is Vb * 1e6 mm³ → /1e9 = Vb*1e-3 m³)
  const vbM3 = vb * 1e-3; // L → m³
  const totalAreaM2 = totalArea * 1e-6; // mm² → m²

  const term1 = (c / 1000 / (2 * Math.PI * fb)) ** 2 * totalAreaM2 / vbM3;
  const term2 = 0.847 * Math.sqrt(totalAreaM2 / Math.PI);
  const portLength = (term1 - term2) * 1000; // m → mm

  return {
    portLength: Math.max(20, portLength),
    portDiameter,
  };
}

/**
 * Generate ported box frequency response.
 * Uses the 4th-order high-pass filter model.
 */
export function portedResponse(
  _ts: ThieleSmallParams,
  design: PortedDesignParams,
  frequencies: number[]
): number[] {
  const { qts, fs } = _ts;
  const { fb } = design;

  const s = frequencies.map((f) => f / fb);
  const s2 = s.map((x) => x * x);
  const s4 = s2.map((x) => x * x);

  const h = fb / fs;
  const a = (fb / fs) ** 2;
  const q = qts;

  // 4th-order system response (simplified Thiele model)
  const val = s4.map((s4v, i) => {
    const s2v = s2[i];
    const num = s4v;
    const denom = s4v + (1 / (h * h) + h * h * (a - 1) - 1) * s2v / q + 1;
    return 20 * Math.log10(Math.sqrt(num / denom));
  });

  return val;
}

// ---------------------------------------------------------------------------
// Transmission line
// ---------------------------------------------------------------------------

export function calcTransmissionLine(ts: ThieleSmallParams): TransmissionLineAlignment {
  const { fs, sd } = ts;
  void sd; // sd used in lineArea below

  // Line length = 1/4 wavelength of Fs, adjusted for stuffing
  // Quarter wavelength: L = c / (4 * fs)
  const c = 343000; // [mm/s]
  let lineLength = c / (4 * fs);

  // Stuffing typically reduces effective speed of sound by ~15-30%
  // Use a stuffing factor of ~0.8 for moderate stuffing
  lineLength = lineLength * 0.85;

  // Line area: typically 1-3x Sd
  const sdMm2 = sd * 100; // cm² → mm²
  const lineArea = sdMm2 * 1.5;

  return {
    lineLength: Math.round(lineLength),
    lineArea: Math.round(lineArea),
    taperRatio: 3.0, // 3:1 taper is common
    stuffing: 15, // g/L moderate stuffing
  };
}

// ---------------------------------------------------------------------------
// Cabinet type recommendation
// ---------------------------------------------------------------------------

export interface CabinetRecommendation {
  recommended: CabinetType;
  reason: string;
  alternatives: { type: CabinetType; reason: string }[];
}

export function recommendCabinetType(ts: ThieleSmallParams): CabinetRecommendation {
  const { qts } = ts;

  // Qts-based recommendation
  if (qts < 0.3) {
    return {
      recommended: 'ported',
      reason: `Lav Qts (${qts.toFixed(3)}) - horn/ported alignment giver bedst bas-udstrækning. QB3 alignment anbefales.`,
      alternatives: [
        { type: 'transmission_line', reason: 'Transmission line kan give glattere respons ved lav Qts' },
        { type: 'sealed', reason: 'Sealed kræver meget lille volumen, men F3 bliver høj' },
      ],
    };
  }

  if (qts >= 0.3 && qts < 0.4) {
    return {
      recommended: 'ported',
      reason: `Qts ${qts.toFixed(3)} i det optimale område for ported (SBB4/QB3 alignment). God bas-udstrækning med acceptabelt volumen.`,
      alternatives: [
        { type: 'sealed', reason: 'Sealed giver strammere bas, men F3 bliver højere' },
        { type: 'transmission_line', reason: 'TL giver glattere overgang, men kræver større kabinet' },
      ],
    };
  }

  if (qts >= 0.4 && qts < 0.6) {
    return {
      recommended: 'sealed',
      reason: `Qts ${qts.toFixed(3)} vejer mod sealed. Qtc 0.707 giver fladest respons. Ported er muligt men kræver større volumen.`,
      alternatives: [
        { type: 'ported', reason: 'Portet med SC4 alignment - større volumen, men dybere bas' },
        { type: 'transmission_line', reason: 'TL muligt, men line bliver lang ved lav Fs' },
      ],
    };
  }

  // Qts >= 0.6
  return {
    recommended: 'sealed',
    reason: `Høj Qts (${qts.toFixed(3)}) - sealed er bedst. Ported vil give ujævn respons. Åben baffel også en mulighed for full-range.`,
    alternatives: [
      { type: 'open_baffle', reason: 'Åben baffel for full-range med høj Qts - eliminerer kabinet-resonanser' },
      { type: 'ported', reason: 'Portet muligt (C4 alignment) men respons bliver peaked' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Internal volume calculation
// ---------------------------------------------------------------------------

export function calcInternalVolume(
  width: number,
  height: number,
  depth: number,
  wallThickness: number,
  bracingFactor: number = 0.85 // 15% volume lost to bracing, driver, etc.
): number {
  const iw = width - 2 * wallThickness;
  const ih = height - 2 * wallThickness;
  const id = depth - 2 * wallThickness;
  const volumeMM3 = iw * ih * id * bracingFactor;
  return volumeMM3 / 1_000_000; // mm³ → L
}

// ---------------------------------------------------------------------------
// Frequency array generation
// ---------------------------------------------------------------------------

export function generateFrequencies(
  start: number = 10,
  end: number = 20000,
  pointsPerOctave: number = 24
): number[] {
  const freqs: number[] = [];
  const ratio = Math.pow(2, 1 / pointsPerOctave);
  let f = start;
  while (f <= end) {
    freqs.push(Math.round(f * 1000) / 1000);
    f *= ratio;
  }
  return freqs;
}

// ---------------------------------------------------------------------------
// Max SPL calculation
// ---------------------------------------------------------------------------

export function calcMaxSpl(ts: ThieleSmallParams, power: number): number {
  const { sensitivity } = ts;

  // Max SPL at Xmax: SPL = sensitivity + 10*log10(power) + peak headroom
  // Displacement-limited SPL at frequency f:
  // SPL_d = 94 + 20*log10(2*Xmax*Sd*2πf / (c * sqrt(power_rating))) ...
  // Simplified: use sensitivity + power gain
  const powerGain = 10 * Math.log10(power);
  return sensitivity + powerGain;
}
