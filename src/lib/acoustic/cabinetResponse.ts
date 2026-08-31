// Cabinet low-frequency response calculation.
//
// Applies the cabinet loading effect to a driver's free-air response.
// Each cabinet type shapes the low frequencies differently:
//
// - Sealed: 2nd-order high-pass roll-off (12 dB/oct) below Fc
// - Ported: 4th-order high-pass roll-off (24 dB/oct) below Fb, with
//   extended flat response above Fb down to Fb
// - Transmission line: 3rd-order high-pass (~18 dB/oct) below ~0.85×Fs
// - Open baffle: dipole cancellation causes 18 dB/oct roll-off below
//   the frequency where the baffle dimension equals λ/2
//
// The cabinet response is ADDITIVE: it returns a dB curve to be added
// to the driver's free-air response. The driver's own roll-off (from Fs)
// is already in the frequency response data, so the cabinet response
// represents the ADDITIONAL loading effect = system_response - free_air_response.
//
// Reference: Small (1972), Bullock, Dickason (LDC), Olson (1969)

import type {
  Driver,
  CabinetType,
  FrequencyDataPoint,
  ThieleSmallParams,
  SealedAlignment,
} from '@/types';
import { calcSealed, calcPorted, calcPort, calcTransmissionLine } from './thieleSmall';
import type { PortedDesignParams } from './thieleSmall';

// Speed of sound [mm/s]
const C = 343000;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CabinetResponseResult {
  /** dB curve to ADD to driver's free-air response */
  response: FrequencyDataPoint[];
  /** The cabinet type used */
  type: CabinetType;
  /** Key parameters for display */
  params: {
    f3?: number;
    fc?: number;
    fb?: number;
    vb?: number;
    qtc?: number;
    lineLength?: number;
    portLength?: number;
    portDiameter?: number;
    numPorts?: number;
  };
  /** Human-readable description */
  description: string;
}

// ---------------------------------------------------------------------------
// Correct sealed/free-air high-pass magnitude
// ---------------------------------------------------------------------------

/**
 * 2nd-order high-pass magnitude at frequency f.
 *
 * |H|² = fn⁴ / (fn⁴ + fn²×(1/Q² - 2) + 1)  where fn = f/fc
 *
 * At f=fc: |H| = Q / sqrt(1) → for Q=1/√2, |H| = 1/√2 (-3 dB)
 * At f<<fc: |H| ~ fn² → 12 dB/oct roll-off
 * At f>>fc: |H| → 1 (0 dB)
 */
function hp2MagnitudeDb(f: number, fc: number, q: number): number {
  if (fc <= 0 || q <= 0) return 0;
  const fn = f / fc;
  const fn2 = fn * fn;
  const fn4 = fn2 * fn2;
  const denom = fn4 + fn2 * (1 / (q * q) - 2) + 1;
  const mag2 = fn4 / Math.max(denom, 1e-10);
  return 20 * Math.log10(Math.sqrt(Math.max(mag2, 1e-10)));
}

/**
 * 4th-order Butterworth high-pass magnitude at frequency f.
 *
 * |H|² = fn⁸ / (fn⁸ + 1)  where fn = f/fc
 *
 * At f=fc: |H| = 1/√2 (-3 dB)
 * At f<<fc: |H| ~ fn⁴ → 24 dB/oct roll-off
 * At f>>fc: |H| → 1 (0 dB)
 */
function hp4MagnitudeDb(f: number, fc: number): number {
  if (fc <= 0) return 0;
  const fn = f / fc;
  const fn4 = fn * fn * fn * fn;
  const fn8 = fn4 * fn4;
  const mag2 = fn8 / (fn8 + 1);
  return 20 * Math.log10(Math.sqrt(Math.max(mag2, 1e-10)));
}

/**
 * 3rd-order high-pass magnitude at frequency f.
 *
 * |H|² = fn⁶ / (fn⁶ + 1)  where fn = f/fc
 *
 * At f=fc: |H| = 1/√2 (-3 dB)
 * At f<<fc: |H| ~ fn³ → 18 dB/oct roll-off
 * At f>>fc: |H| → 1 (0 dB)
 */
function hp3MagnitudeDb(f: number, fc: number): number {
  if (fc <= 0) return 0;
  const fn = f / fc;
  const fn3 = fn * fn * fn;
  const fn6 = fn3 * fn3;
  const mag2 = fn6 / (fn6 + 1);
  return 20 * Math.log10(Math.sqrt(Math.max(mag2, 1e-10)));
}

// ---------------------------------------------------------------------------
// Cabinet loading calculations
// ---------------------------------------------------------------------------

/**
 * Sealed cabinet loading.
 *
 * The sealed box raises the system resonance from Fs to Fc and creates
 * a 12 dB/oct roll-off below Fc. The loading effect is:
 *   loading(f) = HP2(f, Fc, Qtc) - HP2(f, Fs, Qts)
 *
 * This is positive around Fc (cabinet resonance boost) and negative
 * well below Fc (faster roll-off than free air).
 */
function calcSealedLoading(
  ts: ThieleSmallParams,
  qtcTarget: number,
  frequencies: number[],
): { response: FrequencyDataPoint[]; alignment: SealedAlignment } {
  const alignment = calcSealed(ts, qtcTarget);

  const response = frequencies.map((f) => {
    const sealedDb = hp2MagnitudeDb(f, alignment.fc, alignment.qtc);
    const freeAirDb = hp2MagnitudeDb(f, ts.fs, ts.qts);
    return { freq: f, magnitude: sealedDb - freeAirDb };
  });

  return { response, alignment };
}

/**
 * Ported cabinet loading.
 *
 * The ported system extends the flat response down to Fb (below Fs),
 * then rolls off at 24 dB/oct. The loading effect is:
 *   loading(f) = HP4(f, Fb) - HP2(f, Fs, Qts)
 *
 * This is positive between Fb and Fs (port extends bass), and negative
 * below Fb (steeper roll-off than free air).
 *
 * @param overrideFb  Optional user-specified tuning frequency. When provided,
 *                    the box volume from calcPorted is kept but Fb is replaced.
 * @param overrideVb  Optional user-specified box volume [L]. When provided,
 *                    replaces the alignment volume.
 */
function calcPortedLoading(
  ts: ThieleSmallParams,
  frequencies: number[],
  overrideFb?: number,
  overrideVb?: number,
): { response: FrequencyDataPoint[]; design: PortedDesignParams } {
  const design = calcPorted(ts);
  if (overrideFb && overrideFb > 0) design.fb = overrideFb;
  if (overrideVb && overrideVb > 0) design.vb = overrideVb;

  const response = frequencies.map((f) => {
    const portedDb = hp4MagnitudeDb(f, design.fb);
    const freeAirDb = hp2MagnitudeDb(f, ts.fs, ts.qts);
    return { freq: f, magnitude: portedDb - freeAirDb };
  });

  return { response, design };
}

/**
 * Transmission line loading.
 *
 * The TL provides a quarter-wave resonance near Fs that reinforces bass
 * output, with a gentler 18 dB/oct roll-off below the line's effective
 * cutoff (~0.85×Fs adjusted for stuffing).
 *
 *   loading(f) = HP3(f, 0.85×Fs) - HP2(f, Fs, Qts)
 *
 * This is positive around Fs (line resonance boost) and negative below
 * the cutoff (18 dB/oct, gentler than ported's 24 dB/oct).
 */
function calcTransmissionLineLoading(
  ts: ThieleSmallParams,
  frequencies: number[],
): { response: FrequencyDataPoint[]; lineLength: number } {
  const tl = calcTransmissionLine(ts);
  const effectiveCutoff = ts.fs * 0.85; // adjusted for stuffing

  const response = frequencies.map((f) => {
    const tlDb = hp3MagnitudeDb(f, effectiveCutoff);
    const freeAirDb = hp2MagnitudeDb(f, ts.fs, ts.qts);
    return { freq: f, magnitude: tlDb - freeAirDb };
  });

  return { response, lineLength: tl.lineLength };
}

/**
 * Open baffle dipole loading.
 *
 * An open baffle allows rear radiation to wrap around and cancel the front
 * at low frequencies. The dipole response is a 3rd-order high-pass (18 dB/oct)
 * at the dipole frequency f_d = c / (2 × baffle_width).
 *
 * Unlike sealed/ported/TL, there is no cabinet resonance boost — only
 * attenuation. The loading is purely negative below f_d.
 *
 *   loading(f) = HP3(f, f_dipole) - 0 dB
 *
 * (No free-air subtraction needed — the dipole effect is an absolute
 * attenuation, not a relative loading.)
 */
function calcOpenBaffleLoading(
  baffleWidth: number,
  frequencies: number[],
): FrequencyDataPoint[] {
  const fDipole = C / (2 * baffleWidth);

  return frequencies.map((f) => {
    const dipoleDb = hp3MagnitudeDb(f, fDipole);
    return { freq: f, magnitude: dipoleDb };
  });
}

// ---------------------------------------------------------------------------
// Main: calculate cabinet response
// ---------------------------------------------------------------------------

/**
 * Calculate the cabinet loading effect for a driver.
 *
 * Returns a dB curve to be ADDED to the driver's free-air frequency response.
 * The curve represents how the cabinet modifies the low-frequency output.
 *
 * @param driver       The woofer/subwoofer driver
 * @param type         Cabinet type
 * @param frequencies  Frequency array [Hz]
 * @param baffleWidth  Baffle width [mm] (used for open baffle dipole)
 * @param qtcTarget    Target Qtc for sealed (default 0.707)
 * @param portTuning   Optional port tuning override for ported cabinets:
 *                     { fb?: number (tuning freq), vb?: number (box volume L),
 *                       portDiameter?: number (mm), numPorts?: number }.
 *                     When fb/vb are omitted, the auto-calculated alignment is used.
 *                     portDiameter/numPorts only affect the displayed port length.
 */
export function calcCabinetResponse(
  driver: Driver,
  type: CabinetType,
  frequencies: number[],
  baffleWidth: number = 300,
  qtcTarget: number = 0.707,
  portTuning?: {
    fb?: number;
    vb?: number;
    portDiameter?: number;
    numPorts?: number;
  },
): CabinetResponseResult {
  const ts = driver.tsParams;

  if (!ts || !ts.fs || !ts.qts) {
    return {
      response: frequencies.map((f) => ({ freq: f, magnitude: 0 })),
      type,
      params: {},
      description: 'Ingen T/S parametre — kabinet-respons ikke beregnet.',
    };
  }

  switch (type) {
    case 'sealed': {
      const { response, alignment } = calcSealedLoading(ts, qtcTarget, frequencies);
      return {
        response,
        type,
        params: {
          fc: alignment.fc,
          f3: alignment.f3,
          qtc: alignment.qtc,
          vb: alignment.vb,
        },
        description: `Sealed: Qtc=${alignment.qtc.toFixed(3)}, Fc=${alignment.fc.toFixed(0)}Hz, F3=${alignment.f3.toFixed(0)}Hz, Vb=${alignment.vb.toFixed(1)}L. 12 dB/okt rul-af under Fc.`,
      };
    }

    case 'ported': {
      const { response, design } = calcPortedLoading(
        ts,
        frequencies,
        portTuning?.fb,
        portTuning?.vb,
      );

      // Calculate port dimensions if requested
      const portDiameter = portTuning?.portDiameter ?? 60;
      const numPorts = portTuning?.numPorts ?? 1;
      const portLen = calcPort(design.vb, design.fb, portDiameter, numPorts).portLength;

      return {
        response,
        type,
        params: {
          fb: design.fb,
          f3: design.f3,
          vb: design.vb,
          portLength: portLen,
          portDiameter,
          numPorts,
        },
        description: `Ported: ${design.alignmentType}, Fb=${design.fb.toFixed(0)}Hz, F3=${design.f3?.toFixed(0) || '—'}Hz, Vb=${design.vb.toFixed(1)}L. Port Ø${portDiameter}mm × ${numPorts}, længde ${portLen.toFixed(0)}mm. 24 dB/okt rul-af under Fb.`,
      };
    }

    case 'transmission_line': {
      const { response, lineLength } = calcTransmissionLineLoading(ts, frequencies);
      return {
        response,
        type,
        params: { lineLength },
        description: `Transmission line: line længde=${lineLength}mm (¼λ ved Fs=${ts.fs}Hz). ~18 dB/okt rul-af, blødere end ported.`,
      };
    }

    case 'open_baffle': {
      const fDipole = C / (2 * baffleWidth);
      const response = calcOpenBaffleLoading(baffleWidth, frequencies);
      return {
        response,
        type,
        params: { f3: fDipole },
        description: `Åben baffel: dipole frekvens=${fDipole.toFixed(0)}Hz (baffel ${baffleWidth}mm). 18 dB/okt dipole rul-af. Ingen kabinet-forstærkning.`,
      };
    }

    default:
      return {
        response: frequencies.map((f) => ({ freq: f, magnitude: 0 })),
        type,
        params: {},
        description: 'Ukendt kabinet type.',
      };
  }
}
