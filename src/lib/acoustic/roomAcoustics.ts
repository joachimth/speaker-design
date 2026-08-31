// Room acoustics simulation: in-room frequency response prediction.
//
// Models the transformation from free-field (anechoic) response to the
// response measured in a real listening room. Three key phenomena:
//
// 1. Room boundary gain (low-frequency reinforcement)
//    Below the frequency where the wavelength becomes comparable to room
//    dimensions, the room transitions from a free-field environment to a
//    pressure chamber. Each nearby boundary (floor, ceiling, walls) adds
//    approximately +3 dB. The cumulative "room gain" rises at ~3 dB/octave
//    below ~200-300 Hz, reaching +9 to +12 dB at the lowest frequencies.
//
// 2. Room modes (standing waves)
//    Between parallel surfaces, standing waves create pressure peaks and
//    nulls. Axial modes (one dimension) are strongest. Tangential (two
//    dimensions) and oblique (three dimensions) are progressively weaker.
//    Mode density increases with frequency; above the Schroeder frequency
//    the modal overlap is sufficient that the response smooths out.
//
// 3. Reverberant field + fractional-octave smoothing
//    Above the Schroeder frequency the response is dominated by the
//    statistically uniform reverberant field. A real measurement with
//    1/3-octave (or finer) smoothing reveals the trend rather than
//    individual mode peaks.
//
// References:
//   - Beranek, "Acoustics" (1954), Ch. 10-11
//   - Toole, "Sound Reproduction" (2008), Ch. 3-4
//   - Cox & D'Antonio, "Acoustic Absorbers and Diffusers" (2009)
//   - Schroeder, "Computational Architectural Acoustics" (1980)

import type { FrequencyDataPoint } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Speed of sound [m/s] */
const C = 343;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RoomDimensions {
  length: number; // [m] (front-to-back)
  width: number;  // [m] (side-to-side)
  height: number; // [m] (floor-to-ceiling)
}

export interface RoomMode {
  freq: number;      // [Hz]
  type: 'axial' | 'tangential' | 'oblique';
  indices: [number, number, number]; // [nL, nW, nH]
  /** Relative strength: axial=1.0, tangential=0.5, oblique=0.25 */
  strength: number;
}

export interface RoomAcousticsParams {
  dimensions: RoomDimensions;
  /** Reverberation time RT60 [seconds] */
  rt60: number;
  /** Speaker distance from front wall [m] */
  speakerDistanceFromFront: number;
  /** Speaker distance from side wall [m] */
  speakerDistanceFromSide: number;
  /** Speaker height from floor (acoustic center) [m] */
  speakerHeight: number;
  /** Listening position from front wall [m] */
  listeningDistance: number;
}

export interface RoomAcousticsResult {
  /** Predicted in-room response (smoothed) */
  inRoomResponse: FrequencyDataPoint[];
  /** Room gain curve (boundary reinforcement, dB) */
  roomGain: FrequencyDataPoint[];
  /** Unsmoothed in-room response (with modal peaks/dips) */
  inRoomRaw: FrequencyDataPoint[];
  /** Calculated room modes up to Schroeder frequency */
  modes: RoomMode[];
  /** Schroeder frequency [Hz] */
  schroederFreq: number;
  /** Room volume [m³] */
  volume: number;
  /** 1/3-octave smoothed free-field for comparison */
  smoothedFreeField: FrequencyDataPoint[];
}

// ---------------------------------------------------------------------------
// Room modes
// ---------------------------------------------------------------------------

/**
 * Calculate room modes up to a maximum frequency.
 *
 * Modal frequencies: f = (c/2) * sqrt((n/L)² + (m/W)² + (p/H)²)
 *
 * Mode type depends on how many indices are non-zero:
 *   - 1 non-zero: axial (strongest)
 *   - 2 non-zero: tangential (half strength)
 *   - 3 non-zero: oblique (quarter strength)
 */
export function calcRoomModes(
  dimensions: RoomDimensions,
  maxFreq: number,
  maxIndex: number = 10,
): RoomMode[] {
  const { length: L, width: W, height: H } = dimensions;
  const modes: RoomMode[] = [];

  for (let n = 0; n <= maxIndex; n++) {
    for (let m = 0; m <= maxIndex; m++) {
      for (let p = 0; p <= maxIndex; p++) {
        if (n === 0 && m === 0 && p === 0) continue; // skip DC

        const f = (C / 2) * Math.sqrt(
          (n / L) ** 2 + (m / W) ** 2 + (p / H) ** 2
        );

        if (f > maxFreq || f < 0.5) continue;

        const nonZero = (n > 0 ? 1 : 0) + (m > 0 ? 1 : 0) + (p > 0 ? 1 : 0);
        const type: RoomMode['type'] =
          nonZero === 1 ? 'axial' : nonZero === 2 ? 'tangential' : 'oblique';
        const strength = nonZero === 1 ? 1.0 : nonZero === 2 ? 0.5 : 0.25;

        modes.push({ freq: f, type, indices: [n, m, p], strength });
      }
    }
  }

  return modes.sort((a, b) => a.freq - b.freq);
}

// ---------------------------------------------------------------------------
// Schroeder frequency
// ---------------------------------------------------------------------------

/**
 * Calculate the Schroeder frequency: the frequency above which modal
 * overlap is sufficient for statistical (reverberant) treatment.
 *
 * f_s = 2000 * sqrt(RT60 / V)  [Hz]
 *
 * where V is room volume [m³] and RT60 is reverberation time [s].
 *
 * Below f_s, individual modes dominate; above f_s, the reverberant
 * field is statistically uniform.
 */
export function calcSchroederFreq(volume: number, rt60: number): number {
  if (volume <= 0 || rt60 <= 0) return 1000;
  return 2000 * Math.sqrt(rt60 / volume);
}

// ---------------------------------------------------------------------------
// Room boundary gain
// ---------------------------------------------------------------------------

/**
 * Calculate the low-frequency boundary gain from room surfaces.
 *
 * A loudspeaker near room boundaries receives reinforcement because the
 * boundary creates an image source. Each surface adds ~+3 dB when the
 * speaker is within λ/4 of the surface.
 *
 * The gain transitions from 0 dB at high frequencies (where wavelengths
 * are small compared to distances) to the full boundary gain at low
 * frequencies (where wavelengths are large).
 *
 * For a typical floor-standing speaker:
 *   - Floor: always present (+3 dB below ~150 Hz for 1m height)
 *   - Front wall: +3 dB below f_front = c/(4×d_front)
 *   - Side wall: +3 dB below f_side = c/(4×d_side)
 *
 * Total gain = sum of individual boundary contributions, each modelled
 * as a first-order shelf that ramps from 0 dB (HF) to +3 dB (LF).
 *
 * Reference: Allison, "The Influence of Room Boundaries on Loudspeaker
 * Power Output" (JAES 1974).
 */
export function calcRoomGain(
  frequencies: number[],
  params: RoomAcousticsParams,
): FrequencyDataPoint[] {
  const { speakerDistanceFromFront, speakerDistanceFromSide, speakerHeight } = params;

  // Each boundary contributes a first-order low-shelf: +3dB at LF, 0dB at HF
  // Transition frequency: f_b = c / (4 × distance)
  // The shelf is -3dB at f_b (half-power point of the transition)
  const boundaries = [
    { distance: speakerHeight,             label: 'floor' },
    { distance: speakerDistanceFromFront,  label: 'front' },
    { distance: speakerDistanceFromSide,   label: 'side' },
  ].filter((b) => b.distance > 0);

  return frequencies.map((f) => {
    let gainDb = 0;
    for (const b of boundaries) {
      const fB = C / (4 * b.distance);
      // First-order shelf: gain = 3 / (1 + (f/fB)²)
      // At f=0: +3dB, at f=fB: +1.5dB, at f→∞: 0dB
      gainDb += 3 / (1 + (f / fB) ** 2);
    }
    return { freq: f, magnitude: gainDb };
  });
}

// ---------------------------------------------------------------------------
// Modal response
// ---------------------------------------------------------------------------

/**
 * Calculate the modal transfer function at the listening position.
 *
 * Each mode is modelled as a damped resonance:
 *   H_mode(f) = 1 / sqrt((1 - (f/fn)²)² + (fn / (Q × fn))²)
 *
 * Simplified to: peak of strength × Q at fn, decaying with bandwidth fn/Q.
 *
 * The modal response adds peaks (and dips between peaks) to the response
 * below the Schroeder frequency. Above f_s, modal density is high enough
 * that the response smooths out.
 *
 * @param frequencies  Frequency array [Hz]
 * @param modes        Room modes
 * @param schroeder    Schroeder frequency [Hz]
 * @param rt60         Reverberation time [s] — determines modal Q
 */
function calcModalResponse(
  frequencies: number[],
  modes: RoomMode[],
  schroeder: number,
  rt60: number,
): number[] {
  // Modal Q from RT60: Q = fn × π × RT60 / 3.91 (from decay time)
  // Higher RT60 → higher Q → sharper peaks
  // Cap Q at 50 to avoid numerical issues
  const qFactor = Math.PI * Math.max(rt60, 0.1) / 3.91;

  return frequencies.map((f) => {
    let totalGain = 0;

    for (const mode of modes) {
      if (mode.freq > schroeder * 1.5) continue;

      const fn = mode.freq;
      const Q = Math.min(50, fn * qFactor);

      // Damped resonance magnitude
      const ratio = f / fn;
      const denom = Math.sqrt((1 - ratio * ratio) ** 2 + (ratio / Q) ** 2);
      const mag = 1 / Math.max(denom, 0.01);

      // Scale by mode strength and taper above Schroeder
      const schroederTaper = f < schroeder
        ? 1
        : Math.max(0, 1 - (f - schroeder) / schroeder);

      totalGain += mode.strength * (mag - 1) * schroederTaper;
    }

    // Convert to dB: modal gain relative to flat
    return 20 * Math.log10(Math.max(1 + totalGain * 0.3, 0.01));
  });
}

// ---------------------------------------------------------------------------
// Fractional-octave smoothing
// ---------------------------------------------------------------------------

/**
 * Apply fractional-octave smoothing to a frequency response curve.
 *
 * This simulates what a real measurement microphone + analyzer would show
 * in a room: the fine comb-filter structure is averaged out, revealing
 * the underlying trend.
 *
 * @param curve     Input frequency response
 * @param fraction  Smoothing fraction (3 = 1/3 octave, 6 = 1/6, 1 = full octave)
 * @returns Smoothed curve
 */
export function smoothFractionalOctave(
  curve: FrequencyDataPoint[],
  fraction: number = 3,
): FrequencyDataPoint[] {
  if (curve.length < 3) return curve;

  // Convert to log-freq space for uniform spacing in octaves
  const logFreqs = curve.map((p) => Math.log(p.freq));

  // Smoothing bandwidth in octaves: 1/fraction on each side
  const halfBand = 1 / (2 * fraction);

  return curve.map((point, i) => {
    const centerLog = logFreqs[i]!;
    const minLog = centerLog - halfBand;
    const maxLog = centerLog + halfBand;

    // Find all points within the smoothing band
    let sum = 0;
    let count = 0;
    for (let j = 0; j < curve.length; j++) {
      if (logFreqs[j]! >= minLog && logFreqs[j]! <= maxLog) {
        sum += curve[j]!.magnitude;
        count++;
      }
    }

    return {
      freq: point.freq,
      magnitude: count > 0 ? sum / count : point.magnitude,
    };
  });
}

// ---------------------------------------------------------------------------
// Full in-room response calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the predicted in-room response from a free-field on-axis curve.
 *
 * Combines:
 *   1. Free-field system response (the anechoic on-axis)
 *   2. Room boundary gain (low-freq boost from floor/walls)
 *   3. Modal response (peaks and dips from standing waves)
 *   4. Fractional-octave smoothing (what you'd actually measure)
 *
 * @param onAxis    Free-field on-axis system response [dB]
 * @param params    Room parameters
 * @param freqs     Frequency array [Hz] (should match onAxis)
 * @returns Room acoustics result with smoothed in-room, raw in-room, room gain, modes
 */
export function calcInRoomResponse(
  onAxis: FrequencyDataPoint[],
  params: RoomAcousticsParams,
  smoothingFraction: number = 3,
): RoomAcousticsResult {
  const { dimensions, rt60 } = params;
  const volume = dimensions.length * dimensions.width * dimensions.height;
  const schroeder = calcSchroederFreq(volume, rt60);
  const frequencies = onAxis.map((p) => p.freq);

  // 1. Room boundary gain
  const roomGain = calcRoomGain(frequencies, params);

  // 2. Modal response (peaks/dips)
  const modes = calcRoomModes(dimensions, schroeder * 1.2, 8);
  const modalDb = calcModalResponse(frequencies, modes, schroeder, rt60);

  // 3. Combine: free-field + room gain + modal variation
  const inRoomRaw: FrequencyDataPoint[] = onAxis.map((p, i) => ({
    freq: p.freq,
    magnitude: p.magnitude + roomGain[i]!.magnitude + modalDb[i]!,
  }));

  // 4. Smooth the combined response
  const inRoomResponse = smoothFractionalOctave(inRoomRaw, smoothingFraction);

  // 5. Also smooth the free-field for comparison
  const smoothedFreeField = smoothFractionalOctave(onAxis, smoothingFraction);

  return {
    inRoomResponse,
    roomGain,
    inRoomRaw,
    modes,
    schroederFreq: schroeder,
    volume,
    smoothedFreeField,
  };
}

// ---------------------------------------------------------------------------
// Standard room presets
// ---------------------------------------------------------------------------

export interface RoomPreset {
  name: string;
  description: string;
  params: RoomAcousticsParams;
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    name: 'Lille stue',
    description: '3.5 × 4.0 m, 2.4 m loft. Typisk lejlighed.',
    params: {
      dimensions: { length: 4.0, width: 3.5, height: 2.4 },
      rt60: 0.4,
      speakerDistanceFromFront: 0.5,
      speakerDistanceFromSide: 0.8,
      speakerHeight: 1.0,
      listeningDistance: 3.0,
    },
  },
  {
    name: 'Standard stue',
    description: '4.5 × 5.0 m, 2.4 m loft. Typisk parcelhus.',
    params: {
      dimensions: { length: 5.0, width: 4.5, height: 2.4 },
      rt60: 0.5,
      speakerDistanceFromFront: 0.6,
      speakerDistanceFromSide: 1.0,
      speakerHeight: 1.0,
      listeningDistance: 3.5,
    },
  },
  {
    name: 'Stor stue',
    description: '5.5 × 6.5 m, 2.7 m loft. Åben plan / villa.',
    params: {
      dimensions: { length: 6.5, width: 5.5, height: 2.7 },
      rt60: 0.6,
      speakerDistanceFromFront: 0.8,
      speakerDistanceFromSide: 1.2,
      speakerHeight: 1.1,
      listeningDistance: 4.5,
    },
  },
];

export const DEFAULT_ROOM_PARAMS: RoomAcousticsParams = ROOM_PRESETS[1]!.params;
