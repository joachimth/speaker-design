import { describe, it, expect } from 'vitest';
import {
  calcRoomModes,
  calcSchroederFreq,
  calcRoomGain,
  smoothFractionalOctave,
  calcInRoomResponse,
  ROOM_PRESETS,
  DEFAULT_ROOM_PARAMS,
  type RoomAcousticsParams,
  type RoomDimensions,
} from '../roomAcoustics';
import { generateFrequencies } from '../thieleSmall';
import type { FrequencyDataPoint } from '@/types';

// ---------------------------------------------------------------------------
// Room modes
// ---------------------------------------------------------------------------

describe('calcRoomModes', () => {
  const dims: RoomDimensions = { length: 5.0, width: 4.0, height: 2.4 };

  it('calculates the fundamental axial mode along the longest dimension', () => {
    const modes = calcRoomModes(dims, 500);
    // First axial: f = c / (2 × L) = 343 / 10 = 34.3 Hz
    const firstAxial = modes.find((m) => m.indices[0] === 1 && m.indices[1] === 0 && m.indices[2] === 0);
    expect(firstAxial).toBeDefined();
    expect(firstAxial!.freq).toBeCloseTo(34.3, 0);
  });

  it('calculates the width axial mode', () => {
    const modes = calcRoomModes(dims, 500);
    const widthAxial = modes.find((m) => m.indices[0] === 0 && m.indices[1] === 1 && m.indices[2] === 0);
    expect(widthAxial).toBeDefined();
    expect(widthAxial!.freq).toBeCloseTo(42.875, 0); // 343 / (2 × 4)
  });

  it('calculates the height axial mode', () => {
    const modes = calcRoomModes(dims, 500);
    const heightAxial = modes.find((m) => m.indices[0] === 0 && m.indices[1] === 0 && m.indices[2] === 1);
    expect(heightAxial).toBeDefined();
    expect(heightAxial!.freq).toBeCloseTo(71.458, 0); // 343 / (2 × 2.4)
  });

  it('classifies modes by type correctly', () => {
    const modes = calcRoomModes(dims, 300);
    const axials = modes.filter((m) => m.type === 'axial');
    const tangential = modes.filter((m) => m.type === 'tangential');
    const oblique = modes.filter((m) => m.type === 'oblique');

    expect(axials.length).toBeGreaterThan(0);
    expect(tangential.length).toBeGreaterThan(0);
    expect(oblique.length).toBeGreaterThan(0);

    // Axial strength = 1.0, tangential = 0.5, oblique = 0.25
    expect(axials.every((m) => m.strength === 1.0)).toBe(true);
    expect(tangential.every((m) => m.strength === 0.5)).toBe(true);
    expect(oblique.every((m) => m.strength === 0.25)).toBe(true);
  });

  it('does not return modes above maxFreq', () => {
    const modes = calcRoomModes(dims, 100);
    expect(modes.every((m) => m.freq <= 100)).toBe(true);
  });

  it('does not include the DC mode (0,0,0)', () => {
    const modes = calcRoomModes(dims, 500);
    const dc = modes.find((m) => m.indices[0] === 0 && m.indices[1] === 0 && m.indices[2] === 0);
    expect(dc).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Schroeder frequency
// ---------------------------------------------------------------------------

describe('calcSchroederFreq', () => {
  it('returns higher frequency for smaller room at same RT60', () => {
    const smallRoom = calcSchroederFreq(30, 0.5);
    const largeRoom = calcSchroederFreq(100, 0.5);
    expect(smallRoom).toBeGreaterThan(largeRoom);
  });

  it('returns higher frequency for longer RT60 at same volume', () => {
    const shortRt = calcSchroederFreq(50, 0.3);
    const longRt = calcSchroederFreq(50, 0.8);
    expect(longRt).toBeGreaterThan(shortRt);
  });

  it('typical living room: ~150-250 Hz', () => {
    // V=54 m³, RT60=0.5: f_s = 2000 * sqrt(0.5/54) = 192 Hz
    const fs = calcSchroederFreq(54, 0.5);
    expect(fs).toBeGreaterThan(150);
    expect(fs).toBeLessThan(250);
  });

  it('handles edge cases gracefully', () => {
    expect(calcSchroederFreq(0, 0.5)).toBe(1000);
    expect(calcSchroederFreq(50, 0)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Room boundary gain
// ---------------------------------------------------------------------------

describe('calcRoomGain', () => {
  const params: RoomAcousticsParams = {
    dimensions: { length: 5, width: 4, height: 2.4 },
    rt60: 0.5,
    speakerDistanceFromFront: 0.5,
    speakerDistanceFromSide: 1.0,
    speakerHeight: 1.0,
    listeningDistance: 3.5,
  };

  it('returns positive gain at low frequencies', () => {
    const freqs = [20, 30, 50];
    const gain = calcRoomGain(freqs, params);
    expect(gain.every((p) => p.magnitude > 0)).toBe(true);
  });

  it('approaches 0 dB at high frequencies', () => {
    const freqs = [5000, 10000, 20000];
    const gain = calcRoomGain(freqs, params);
    // At HF, gain should be near 0 (less than 1 dB)
    expect(gain.every((p) => p.magnitude < 1.0)).toBe(true);
  });

  it('adds ~+3 dB per boundary at very low frequencies', () => {
    const freqs = [5]; // well below all boundary transition frequencies
    const gain = calcRoomGain(freqs, params);
    // 3 boundaries × 3 dB = 9 dB max (but 5 Hz is not quite DC)
    expect(gain[0]!.magnitude).toBeGreaterThan(7);
    expect(gain[0]!.magnitude).toBeLessThanOrEqual(9);
  });

  it('gain increases with fewer boundary distances (closer to walls)', () => {
    const freqs = [50];
    const farFromWalls: RoomAcousticsParams = {
      ...params,
      speakerDistanceFromFront: 2.0,
      speakerDistanceFromSide: 2.0,
      speakerHeight: 1.5,
    };
    const closeToWalls: RoomAcousticsParams = {
      ...params,
      speakerDistanceFromFront: 0.2,
      speakerDistanceFromSide: 0.3,
      speakerHeight: 0.5,
    };
    const farGain = calcRoomGain(freqs, farFromWalls);
    const closeGain = calcRoomGain(freqs, closeToWalls);
    expect(closeGain[0]!.magnitude).toBeGreaterThan(farGain[0]!.magnitude);
  });
});

// ---------------------------------------------------------------------------
// Fractional-octave smoothing
// ---------------------------------------------------------------------------

describe('smoothFractionalOctave', () => {
  it('preserves the average level', () => {
    const curve: FrequencyDataPoint[] = [
      { freq: 100, magnitude: 80 },
      { freq: 200, magnitude: 82 },
      { freq: 400, magnitude: 78 },
      { freq: 800, magnitude: 81 },
      { freq: 1600, magnitude: 79 },
    ];
    const smoothed = smoothFractionalOctave(curve, 3);
    // Mean of original and smoothed should be similar
    const origMean = curve.reduce((a, p) => a + p.magnitude, 0) / curve.length;
    const smoothMean = smoothed.reduce((a, p) => a + p.magnitude, 0) / smoothed.length;
    expect(smoothMean).toBeCloseTo(origMean, 0);
  });

  it('reduces peak-to-peak variation', () => {
    // Create a curve with sharp spikes
    const freqs = generateFrequencies(100, 5000, 48);
    const curve: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 80 + (Math.random() > 0.5 ? 10 : -10),
    }));
    const smoothed = smoothFractionalOctave(curve, 3);

    const origRange = Math.max(...curve.map((p) => p.magnitude)) - Math.min(...curve.map((p) => p.magnitude));
    const smoothRange = Math.max(...smoothed.map((p) => p.magnitude)) - Math.min(...smoothed.map((p) => p.magnitude));
    expect(smoothRange).toBeLessThan(origRange);
  });

  it('returns the same number of points', () => {
    const curve: FrequencyDataPoint[] = generateFrequencies(100, 10000, 12).map((f) => ({
      freq: f,
      magnitude: 80,
    }));
    const smoothed = smoothFractionalOctave(curve, 3);
    expect(smoothed).toHaveLength(curve.length);
  });

  it('handles very short curves', () => {
    const curve: FrequencyDataPoint[] = [{ freq: 100, magnitude: 80 }];
    const smoothed = smoothFractionalOctave(curve, 3);
    expect(smoothed).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Full in-room response
// ---------------------------------------------------------------------------

describe('calcInRoomResponse', () => {
  const params: RoomAcousticsParams = DEFAULT_ROOM_PARAMS;

  it('returns all expected fields', () => {
    const freqs = generateFrequencies(20, 20000, 12);
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 85, // flat 85 dB
    }));

    const result = calcInRoomResponse(onAxis, params);

    expect(result.inRoomResponse).toHaveLength(onAxis.length);
    expect(result.roomGain).toHaveLength(onAxis.length);
    expect(result.inRoomRaw).toHaveLength(onAxis.length);
    expect(result.modes.length).toBeGreaterThan(0);
    expect(result.schroederFreq).toBeGreaterThan(100);
    expect(result.schroederFreq).toBeLessThan(500);
    expect(result.volume).toBeCloseTo(54, 0); // 5 × 4.5 × 2.4
  });

  it('in-room response is higher than free-field at low frequencies', () => {
    const freqs = generateFrequencies(20, 20000, 12);
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 85,
    }));

    const result = calcInRoomResponse(onAxis, params);

    // At 30 Hz, in-room should be boosted by room gain
    const idx30 = result.inRoomResponse.findIndex((p) => p.freq >= 30);
    expect(idx30).toBeGreaterThan(0);
    expect(result.inRoomResponse[idx30]!.magnitude).toBeGreaterThan(85);
  });

  it('in-room response approaches free-field at high frequencies', () => {
    const freqs = generateFrequencies(20, 20000, 12);
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 85,
    }));

    const result = calcInRoomResponse(onAxis, params);

    // At 10 kHz, room gain is negligible
    const idx10k = result.inRoomResponse.findIndex((p) => p.freq >= 10000);
    expect(idx10k).toBeGreaterThan(0);
    const diff = Math.abs(result.inRoomResponse[idx10k]!.magnitude - 85);
    expect(diff).toBeLessThan(2);
  });

  it('raw in-room has more variation than smoothed', () => {
    const freqs = generateFrequencies(20, 500, 48); // dense below Schroeder
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 85,
    }));

    const result = calcInRoomResponse(onAxis, params);

    const rawRange = Math.max(...result.inRoomRaw.map((p) => p.magnitude))
      - Math.min(...result.inRoomRaw.map((p) => p.magnitude));
    const smoothRange = Math.max(...result.inRoomResponse.map((p) => p.magnitude))
      - Math.min(...result.inRoomResponse.map((p) => p.magnitude));
    expect(rawRange).toBeGreaterThanOrEqual(smoothRange);
  });
});

// ---------------------------------------------------------------------------
// Room presets
// ---------------------------------------------------------------------------

describe('ROOM_PRESETS', () => {
  it('has 3 presets', () => {
    expect(ROOM_PRESETS).toHaveLength(3);
  });

  it('presets have increasing volume', () => {
    const volumes = ROOM_PRESETS.map((p) =>
      p.params.dimensions.length * p.params.dimensions.width * p.params.dimensions.height
    );
    expect(volumes[0]!).toBeLessThan(volumes[1]!);
    expect(volumes[1]!).toBeLessThan(volumes[2]!);
  });

  it('DEFAULT_ROOM_PARAMS is the standard stue', () => {
    expect(DEFAULT_ROOM_PARAMS.dimensions.length).toBe(5.0);
    expect(DEFAULT_ROOM_PARAMS.dimensions.width).toBe(4.5);
    expect(DEFAULT_ROOM_PARAMS.dimensions.height).toBe(2.4);
  });
});
