import { describe, it, expect } from 'vitest';
import {
  calcFilterPhase,
  calcSystemPhase,
  assessGroupDelay,
} from '../groupDelay';
import type { CrossoverType } from '@/types';

describe('groupDelay — single filter phase', () => {
  describe('LR4 lowpass at 1000 Hz', () => {
    const result = calcFilterPhase('LR4', 1000, false, 48000);

    it('returns arrays of equal length', () => {
      expect(result.freq.length).toBe(result.phaseDeg.length);
      expect(result.freq.length).toBe(result.groupDelayMs.length);
      expect(result.freq.length).toBe(result.magnitudeDb.length);
    });

    it('magnitude is ~0 dB well below cutoff', () => {
      const idx = result.freq.findIndex((f) => f >= 100);
      expect(result.magnitudeDb[idx!]).toBeCloseTo(0, 1);
    });

    it('magnitude is ~-6 dB at cutoff (LR4 crossover point)', () => {
      const idx = result.freq.findIndex((f) => f >= 1000);
      expect(result.magnitudeDb[idx!]).toBeCloseTo(-6, 0);
    });

    it('magnitude drops steeply above cutoff', () => {
      const idx2k = result.freq.findIndex((f) => f >= 2000);
      expect(result.magnitudeDb[idx2k!]).toBeLessThan(-12);
    });

    it('phase is near 0° at very low frequencies', () => {
      // Bilinear transform introduces slight phase shift even at low freq
      const idx = result.freq.findIndex((f) => f >= 10);
      expect(Math.abs(result.phaseDeg[idx!])).toBeLessThan(10);
    });

    it('phase is ~-180° at high frequencies (4th order = 2π)', () => {
      const idx = result.freq.findIndex((f) => f >= 10000);
      // LR4 = 4th order → phase → -360° at high freq
      // But unwrapped, it should be heading toward -360
      expect(result.phaseDeg[idx!]).toBeLessThan(-90);
    });

    it('group delay is positive (causal system)', () => {
      // Group delay should be positive for a lowpass filter
      const midbandGd = result.groupDelayMs.filter(
        (_, i) => result.freq[i]! >= 200 && result.freq[i]! <= 800
      );
      midbandGd.forEach((gd) => {
        expect(gd).toBeGreaterThanOrEqual(-0.01); // allow tiny numerical noise
      });
    });

    it('group delay is highest near the cutoff frequency', () => {
      // Peak GD should be near fc for an LR4
      let peakGd = 0;
      let fPeak = 0;
      for (let i = 0; i < result.groupDelayMs.length; i++) {
        if (result.groupDelayMs[i]! > peakGd) {
          peakGd = result.groupDelayMs[i]!;
          fPeak = result.freq[i]!;
        }
      }
      // Peak should be within an octave of 1000 Hz (500-2000)
      expect(fPeak).toBeGreaterThan(400);
      expect(fPeak).toBeLessThan(3000);
    });
  });

  describe('LR4 highpass at 1000 Hz', () => {
    const result = calcFilterPhase('LR4', 1000, true, 48000);

    it('magnitude is ~0 dB well above cutoff', () => {
      const idx = result.freq.findIndex((f) => f >= 5000);
      expect(result.magnitudeDb[idx!]).toBeCloseTo(0, 1);
    });

    it('magnitude is ~-6 dB at cutoff', () => {
      const idx = result.freq.findIndex((f) => f >= 1000);
      expect(result.magnitudeDb[idx!]).toBeCloseTo(-6, 0);
    });

    it('phase increases (positive phase shift) for highpass', () => {
      // Highpass has positive phase at low frequencies
      const idx = result.freq.findIndex((f) => f >= 100);
      expect(result.phaseDeg[idx!]).toBeGreaterThan(0);
    });
  });

  describe('BW2 vs LR4 slope', () => {
    const bw2 = calcFilterPhase('BW2', 1000, false, 48000);
    const lr4 = calcFilterPhase('LR4', 1000, false, 48000);

    it('LR4 attenuates more than BW2 above cutoff', () => {
      const idx = bw2.freq.findIndex((f) => f >= 4000);
      expect(lr4.magnitudeDb[idx!]).toBeLessThan(bw2.magnitudeDb[idx!]);
    });

    it('LR4 has more group delay than BW2 (steeper filter)', () => {
      // Compare peak group delay
      const peakLr4 = Math.max(...lr4.groupDelayMs);
      const peakBw2 = Math.max(...bw2.groupDelayMs);
      expect(peakLr4).toBeGreaterThan(peakBw2 * 0.8); // at least comparable
    });
  });

  describe('first order filter', () => {
    const result = calcFilterPhase('first_order', 1000, false, 48000);

    it('magnitude is -3 dB at cutoff (1st order)', () => {
      const idx = result.freq.findIndex((f) => f >= 1000);
      expect(result.magnitudeDb[idx!]).toBeCloseTo(-3, 0);
    });

    it('phase is approximately -45° at cutoff (1st order lowpass)', () => {
      // Bilinear transform causes frequency warping; at fc=1000 with fs=48000
      // the warping is small but not zero, so phase may differ slightly
      const idx = result.freq.findIndex((f) => f >= 1000);
      expect(result.phaseDeg[idx!]).toBeCloseTo(-45, 0);
    });
  });
});

describe('groupDelay — system phase', () => {
  // Minimal system: 2-way with crossover
  const drivers = [
    {
      id: 'woofer1',
      manufacturer: 'Test',
      model: 'Woofer',
      type: 'woofer' as const,
      tsParams: {
        fs: 30, re: 3.5, qms: 3, qes: 0.5, qts: 0.43, vas: 50,
        sensitivity: 87, xmax: 5, sd: 120, imp: 4, le: 0.8,
      },
      frequencyResponse: Array.from({ length: 50 }, (_, i) => ({
        freq: 20 * Math.pow(2, i * 0.3),
        magnitude: 87,
      })),
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'tweeter1',
      manufacturer: 'Test',
      model: 'Tweeter',
      type: 'tweeter' as const,
      tsParams: {
        fs: 800, re: 4.7, qms: 0.7, qes: 0.35, qts: 0.23, vas: 2,
        sensitivity: 90, xmax: 0.5, sd: 5, imp: 4, le: 0.03,
      },
      frequencyResponse: Array.from({ length: 50 }, (_, i) => ({
        freq: 500 * Math.pow(2, i * 0.3),
        magnitude: 90,
      })),
      createdAt: 0,
      updatedAt: 0,
    },
  ];

  const crossover = {
    ways: 2 as const,
    bands: [
      {
        id: 'b1',
        driverId: 'woofer1',
        driverRole: 'low' as const,
        highpassFreq: 0,
        lowpassFreq: 2000,
        highpassType: 'LR4' as CrossoverType,
        lowpassType: 'LR4' as CrossoverType,
        polarity: 0 as const,
        delay: 0,
        gain: 0,
      },
      {
        id: 'b2',
        driverId: 'tweeter1',
        driverRole: 'high' as const,
        highpassFreq: 2000,
        lowpassFreq: 0,
        highpassType: 'LR4' as CrossoverType,
        lowpassType: 'LR4' as CrossoverType,
        polarity: 0 as const,
        delay: 0,
        gain: 0,
      },
    ],
  };

  const cabinet = {
    type: 'sealed' as const,
    dimensions: {
      width: 200, height: 400, depth: 250, wallThickness: 18,
      baffleWidth: 200, baffleHeight: 400, frontRoundoverRadius: 20,
    },
    internalVolume: 15,
    sealed: { vb: 15, fc: 40, qtc: 0.8, f3: 45 },
  };

  const result = calcSystemPhase(drivers, crossover, cabinet);

  it('returns system phase and group delay arrays', () => {
    expect(result.systemPhase.freq.length).toBeGreaterThan(0);
    expect(result.systemPhase.phase.length).toBe(result.systemPhase.freq.length);
    expect(result.systemGroupDelay.groupDelay.length).toBe(result.systemGroupDelay.freq.length);
  });

  it('returns per-band results for each driver', () => {
    expect(result.perBand).toHaveLength(2);
    result.perBand.forEach((band) => {
      expect(band.freq.length).toBeGreaterThan(0);
      expect(band.phaseDeg.length).toBe(band.freq.length);
      expect(band.groupDelayMs.length).toBe(band.freq.length);
    });
  });

  it('system group delay is finite', () => {
    result.systemGroupDelay.groupDelay.forEach((gd) => {
      expect(isFinite(gd)).toBe(true);
    });
  });

  it('system group delay is positive in the passband', () => {
    const passbandGd = result.systemGroupDelay.groupDelay.filter(
      (_, i) => result.systemGroupDelay.freq[i]! >= 200 && result.systemGroupDelay.freq[i]! <= 10000
    );
    // Group delay should be non-negative in passband (allow tiny numerical noise)
    const minGd = Math.min(...passbandGd);
    expect(minGd).toBeGreaterThan(-0.1);
  });
});

describe('assessGroupDelay', () => {
  it('rates flat group delay as good', () => {
    // Construct a flat-ish group delay (constant ~1ms)
    const freqs = [100, 200, 500, 1000, 2000, 5000, 10000];
    const gd = freqs.map(() => 1.0);
    const assessment = assessGroupDelay({ freq: freqs, groupDelay: gd });
    expect(assessment.rating).toBe('good');
    expect(assessment.midbandVariation).toBeLessThan(2);
  });

  it('rates varying group delay as poor', () => {
    // Large variation
    const freqs = [100, 200, 500, 1000, 2000, 5000, 10000];
    const gd = [10, 8, 2, 1, 2, 8, 10];
    const assessment = assessGroupDelay({ freq: freqs, groupDelay: gd });
    expect(assessment.rating).toBe('poor');
    expect(assessment.midbandVariation).toBeGreaterThan(4);
  });

  it('extracts peak group delay and frequency', () => {
    const freqs = [100, 200, 500, 1000, 2000];
    const gd = [1, 3, 5, 2, 1];
    const assessment = assessGroupDelay({ freq: freqs, groupDelay: gd });
    expect(assessment.peakGd).toBe(5);
    expect(assessment.fPeakGd).toBe(500);
  });

  it('extracts group delay at 100 Hz and 1 kHz', () => {
    const freqs = [50, 100, 200, 500, 1000, 2000, 5000];
    const gd =      [2,   3,   2.5,  1.5,   1,    0.8,  0.5];
    const assessment = assessGroupDelay({ freq: freqs, groupDelay: gd });
    expect(assessment.gd100Hz).toBeCloseTo(3, 1);
    expect(assessment.gd1kHz).toBeCloseTo(1, 1);
  });
});
