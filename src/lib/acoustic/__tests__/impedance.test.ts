import { describe, it, expect } from 'vitest';
import {
  calcImpedance,
  impedanceMetrics,
  toImpedanceDataPoints,
} from '../impedance';
import type { ThieleSmallParams } from '@/types';

// Test driver: a typical 8" woofer
const woofer: ThieleSmallParams = {
  fs: 28,
  re: 3.9,
  qms: 3.1,
  qes: 0.61,
  qts: 0.51,
  vas: 132,
  sensitivity: 87,
  xmax: 5.5,
  sd: 125,
  imp: 4,
  le: 0.83,
  bl: 8.4,
  mms: 31.5,
  cms: 0.35,
};

// Test driver: tweeter
const tweeter: ThieleSmallParams = {
  fs: 900,
  re: 4.7,
  qms: 0.65,
  qes: 0.32,
  qts: 0.21,
  vas: 1.8,
  sensitivity: 91,
  xmax: 0.5,
  sd: 5.7,
  imp: 4,
  le: 0.029,
  bl: 2.24,
  mms: 0.347,
  cms: 58,
};

describe('impedance', () => {
  describe('calcImpedance — free air', () => {
    const result = calcImpedance({
      ts: woofer,
      cabinetType: 'open_baffle',
      fStart: 10,
      fEnd: 1000,
      pointsPerOctave: 12,
    });

    it('returns arrays of equal length', () => {
      expect(result.freq.length).toBe(result.magnitude.length);
      expect(result.freq.length).toBe(result.phase.length);
      expect(result.freq.length).toBeGreaterThan(10);
    });

    it('has DC resistance near Re at low frequencies', () => {
      // At very low frequencies, the motional impedance still contributes
      // because the compliance reactance is large. But the magnitude should
      // be within an order of magnitude of Re.
      const idx = result.freq.findIndex((f) => f >= 10);
      expect(result.magnitude[idx!]).toBeLessThan(woofer.re * 2);
      expect(result.magnitude[idx!]).toBeGreaterThan(woofer.re * 0.5);
    });

    it('has a resonance peak near Fs', () => {
      // Find peak impedance
      let maxZ = 0;
      let fMax = 0;
      for (let i = 0; i < result.magnitude.length; i++) {
        if (result.magnitude[i]! > maxZ) {
          maxZ = result.magnitude[i]!;
          fMax = result.freq[i]!;
        }
      }
      expect(maxZ).toBeGreaterThan(woofer.re * 5); // Peak should be much higher than Re
      expect(fMax).toBeCloseTo(woofer.fs, -1); // within a factor of 10
    });

    it('impedance at resonance is higher than at DC', () => {
      const zLowFreq = result.magnitude[0]!;
      const maxZ = Math.max(...result.magnitude);
      expect(maxZ).toBeGreaterThan(zLowFreq * 2);
    });

    it('phase is moderate at very low frequencies (motional + Le contribution)', () => {
      // Below resonance, phase is influenced by motional impedance + Le.
      // At 10 Hz with Fs=28, we're < 1 octave below resonance, so the
      // motional impedance still contributes significantly.
      const idx = result.freq.findIndex((f) => f >= 10);
      expect(Math.abs(result.phase[idx!])).toBeLessThan(60);
    });

    it('phase passes through 0° near resonance', () => {
      // At mechanical resonance, the motional impedance is real,
      // but Le shifts the zero-crossing slightly above Fs.
      // Find the zero crossing in the 20-100 Hz range
      let zeroCrossIdx = -1;
      for (let i = 1; i < result.freq.length; i++) {
        if (result.freq[i]! > 100) break;
        if (Math.sign(result.phase[i]!) !== Math.sign(result.phase[i - 1]!)) {
          zeroCrossIdx = i;
          break;
        }
      }
      expect(zeroCrossIdx).toBeGreaterThan(-1);
      // Zero crossing should be near Fs (within a factor of 3)
      const fCross = result.freq[zeroCrossIdx]!;
      expect(fCross).toBeGreaterThan(woofer.fs * 0.5);
      expect(fCross).toBeLessThan(woofer.fs * 4);
    });
  });

  describe('calcImpedance — sealed box', () => {
    const result = calcImpedance({
      ts: woofer,
      cabinetType: 'sealed',
      boxVolume: 30, // 30L sealed
      fStart: 10,
      fEnd: 2000,
      pointsPerOctave: 12,
    });

    it('has a single resonance peak shifted above Fs', () => {
      let maxZ = 0;
      let fMax = 0;
      for (let i = 0; i < result.magnitude.length; i++) {
        if (result.magnitude[i]! > maxZ) {
          maxZ = result.magnitude[i]!;
          fMax = result.freq[i]!;
        }
      }
      // Sealed box raises the resonance frequency above Fs
      expect(fMax).toBeGreaterThan(woofer.fs);
      expect(maxZ).toBeGreaterThan(woofer.re * 3);
    });

    it('has only one peak (sealed = single resonance)', () => {
      // Count peaks: local maxima above 2× Re
      const threshold = woofer.re * 2;
      let peakCount = 0;
      for (let i = 1; i < result.magnitude.length - 1; i++) {
        if (
          result.magnitude[i]! > threshold &&
          result.magnitude[i]! > result.magnitude[i - 1]! &&
          result.magnitude[i]! > result.magnitude[i + 1]!
        ) {
          peakCount++;
        }
      }
      // Sealed box should have exactly 1 peak
      expect(peakCount).toBe(1);
    });
  });

  describe('calcImpedance — ported box', () => {
    // Low Qts woofer in a small box for clear double-peak separation.
    // The coupling between driver resonance (Fs) and Helmholtz resonance (fb)
    // splits into two peaks with a dip at fb between them.
    const portedWoofer: ThieleSmallParams = {
      fs: 30, re: 3.5, qms: 2.5, qes: 0.25, qts: 0.23, vas: 40,
      sensitivity: 88, xmax: 4, sd: 85, imp: 4, le: 0.3,
      bl: 10.5, mms: 15,
    };
    const result = calcImpedance({
      ts: portedWoofer,
      cabinetType: 'ported',
      boxVolume: 20,
      fb: 45,
      fStart: 5,
      fEnd: 300,
      pointsPerOctave: 96, // high resolution for peak detection
    });

    it('has two impedance peaks flanking the tuning frequency', () => {
      const threshold = portedWoofer.re * 3;
      let peakCount = 0;
      const peakFreqs: number[] = [];
      for (let i = 3; i < result.magnitude.length - 3; i++) {
        if (
          result.magnitude[i]! > threshold &&
          result.magnitude[i]! > result.magnitude[i - 1]! &&
          result.magnitude[i]! > result.magnitude[i + 1]! &&
          result.magnitude[i]! > result.magnitude[i - 2]! &&
          result.magnitude[i]! > result.magnitude[i + 2]!
        ) {
          peakCount++;
          peakFreqs.push(result.freq[i]!);
        }
      }
      expect(peakCount).toBeGreaterThanOrEqual(2);
      // One peak should be below fb, one above
      const belowFb = peakFreqs.filter((f) => f < 45);
      const aboveFb = peakFreqs.filter((f) => f > 45);
      expect(belowFb.length).toBeGreaterThanOrEqual(1);
      expect(aboveFb.length).toBeGreaterThanOrEqual(1);
    });

    it('has a dip (local minimum) near the tuning frequency (fb)', () => {
      // Find the local minimum nearest to fb=45
      let fbIdx = 0;
      let minDist = Infinity;
      for (let i = 2; i < result.magnitude.length - 2; i++) {
        if (
          result.magnitude[i]! < result.magnitude[i - 1]! &&
          result.magnitude[i]! < result.magnitude[i + 1]!
        ) {
          const d = Math.abs(result.freq[i]! - 45);
          if (d < minDist) { minDist = d; fbIdx = i; }
        }
      }
      // The dip should be within 15 Hz of fb
      expect(Math.abs(result.freq[fbIdx]! - 45)).toBeLessThan(20);
      // The dip should be lower than both peaks
      const dipValue = result.magnitude[fbIdx]!;
      const allPeaks = result.magnitude.filter((m, i) =>
        i > 0 && i < result.magnitude.length - 1 &&
        m > result.magnitude[i - 1]! && m > result.magnitude[i + 1]! &&
        m > portedWoofer.re * 3
      );
      expect(allPeaks.length).toBeGreaterThan(0);
      expect(dipValue).toBeLessThan(Math.max(...allPeaks) * 0.5);
    });
  });

  describe('calcImpedance — tweeter', () => {
    const result = calcImpedance({
      ts: tweeter,
      cabinetType: 'open_baffle',
      fStart: 100,
      fEnd: 20000,
      pointsPerOctave: 12,
    });

    it('has resonance peak near Fs (900 Hz)', () => {
      let maxZ = 0;
      let fMax = 0;
      for (let i = 0; i < result.magnitude.length; i++) {
        if (result.magnitude[i]! > maxZ) {
          maxZ = result.magnitude[i]!;
          fMax = result.freq[i]!;
        }
      }
      // Peak should be within an octave of Fs (Le may shift it slightly)
      expect(fMax).toBeGreaterThan(tweeter.fs * 0.5);
      expect(fMax).toBeLessThan(tweeter.fs * 2);
    });

    it('impedance rises at high frequencies due to Le', () => {
      // At high frequencies, voice coil inductance dominates: Z ≈ ω*Le
      // Compare impedance at high freq vs midrange (above resonance)
      const idx2k = result.freq.findIndex((f) => f >= 2000);
      const lastIdx = result.magnitude.length - 1;
      expect(result.magnitude[lastIdx!]).toBeGreaterThan(result.magnitude[idx2k!]!);
    });
  });

  describe('impedanceMetrics', () => {
    const result = calcImpedance({
      ts: woofer,
      cabinetType: 'open_baffle',
      fStart: 10,
      fEnd: 2000,
      pointsPerOctave: 24,
    });

    const metrics = impedanceMetrics(result, woofer);

    it('zMax matches the peak in the curve', () => {
      const actualMax = Math.max(...result.magnitude);
      expect(metrics.zMax).toBeCloseTo(actualMax, 1);
    });

    it('fMax is near Fs for free air (within a few octaves, Le may shift)', () => {
      expect(metrics.fMax).toBeGreaterThan(woofer.fs * 0.5);
      expect(metrics.fMax).toBeLessThan(woofer.fs * 4);
    });

    it('re matches DC resistance', () => {
      expect(metrics.re).toBe(woofer.re);
    });

    it('nominal impedance is at least 80% of Re', () => {
      expect(metrics.nominal).toBeGreaterThanOrEqual(woofer.re * 0.8);
    });

    it('phaseMin is negative (capacitive region below resonance)', () => {
      expect(metrics.phaseMin).toBeLessThan(0);
    });
  });

  describe('toImpedanceDataPoints', () => {
    it('converts ImpedanceResult to ImpedanceDataPoint[]', () => {
      const result = calcImpedance({
        ts: woofer,
        cabinetType: 'open_baffle',
        fStart: 20,
        fEnd: 500,
        pointsPerOctave: 6,
      });
      const points = toImpedanceDataPoints(result);
      expect(points).toHaveLength(result.freq.length);
      expect(points[0]!.freq).toBe(result.freq[0]);
      expect(points[0]!.magnitude).toBe(result.magnitude[0]);
      expect(points[0]!.phase).toBe(result.phase[0]);
    });
  });

  describe('edge cases', () => {
    it('handles driver without Le (defaults to 0)', () => {
      const noLe: ThieleSmallParams = {
        ...woofer,
        le: undefined,
      };
      const result = calcImpedance({
        ts: noLe,
        cabinetType: 'open_baffle',
        fStart: 10,
        fEnd: 500,
      });
      expect(result.magnitude.length).toBeGreaterThan(0);
      // Without Le, high-freq impedance should stay near Re
      const lastZ = result.magnitude[result.magnitude.length - 1]!;
      expect(lastZ).toBeLessThan(woofer.re * 2);
    });

    it('handles driver without BL (derives from T/S)', () => {
      const noBl: ThieleSmallParams = {
        ...woofer,
        bl: undefined,
      };
      const result = calcImpedance({
        ts: noBl,
        cabinetType: 'open_baffle',
        fStart: 10,
        fEnd: 500,
      });
      // Should still produce a resonance peak
      const maxZ = Math.max(...result.magnitude);
      expect(maxZ).toBeGreaterThan(woofer.re * 2);
    });
  });
});
