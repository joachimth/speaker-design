import { describe, it, expect } from 'vitest';
import {
  calcNBD,
  calcSmoothness,
  calcLFX,
  calcLFQ,
  prefRating,
  computePreferenceScore,
} from '../preferenceScore';
import { calcSpinorama } from '../directivity';
import type { FrequencyDataPoint } from '@/types';

// Helper: generate a flat curve at a given dB level
function flatCurve(freqs: number[], level: number): FrequencyDataPoint[] {
  return freqs.map((f) => ({ freq: f, magnitude: level }));
}

// Helper: generate frequencies log-spaced
function logFreqs(min: number, max: number, points: number): number[] {
  const result: number[] = [];
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  for (let i = 0; i < points; i++) {
    result.push(Math.pow(10, logMin + (i / (points - 1)) * (logMax - logMin)));
  }
  return result;
}

describe('preferenceScore', () => {
  const freqs = logFreqs(20, 20000, 200);

  describe('calcNBD', () => {
    it('returns 0 for a perfectly flat curve', () => {
      const db = freqs.map(() => 80);
      const nbd = calcNBD(freqs, db);
      expect(nbd).toBeCloseTo(0, 5);
    });

    it('returns positive value for a noisy curve', () => {
      const db = freqs.map((_f, i) => 80 + Math.sin(i * 0.5) * 3);
      const nbd = calcNBD(freqs, db);
      expect(nbd).toBeGreaterThan(0);
      expect(nbd).toBeLessThan(10);
    });

    it('ignores data outside 100 Hz - 12 kHz', () => {
      const db = freqs.map((f) => {
        if (f < 100 || f > 12000) return 80 + 20; // big deviations outside range
        return 80;
      });
      const nbd = calcNBD(freqs, db);
      expect(nbd).toBeCloseTo(0, 5);
    });
  });

  describe('calcSmoothness', () => {
    it('returns ~1 for a perfectly flat curve', () => {
      const db = freqs.map(() => 80);
      const sm = calcSmoothness(freqs, db);
      expect(sm).toBeCloseTo(1, 3);
    });

    it('returns ~1 for a linear-sloped curve (perfect line fit)', () => {
      const db = freqs.map((f) => 80 + Math.log(f) * 2);
      const sm = calcSmoothness(freqs, db);
      expect(sm).toBeCloseTo(1, 3);
    });

    it('returns <1 for a noisy curve', () => {
      const db = freqs.map((_f, i) => 80 + Math.sin(i * 1.5) * 5);
      const sm = calcSmoothness(freqs, db);
      expect(sm).toBeLessThan(0.9);
      expect(sm).toBeGreaterThan(0);
    });

    it('only uses 100 Hz - 16 kHz range', () => {
      const db = freqs.map((f) => {
        if (f < 100 || f > 16000) return 80 + 50;
        return 80;
      });
      const sm = calcSmoothness(freqs, db);
      expect(sm).toBeCloseTo(1, 3);
    });
  });

  describe('calcLFX', () => {
    it('finds the -6dB point in sound power below 300 Hz', () => {
      // LW flat at 80 dB. SP drops below 300 Hz.
      const lwDb = freqs.map(() => 80);
      const spDb = freqs.map((f) => (f < 50 ? 74 : 80)); // -6 dB at 50 Hz
      const lfxLog = calcLFX(freqs, lwDb, freqs, spDb);
      const lfxHz = Math.pow(10, lfxLog);
      expect(lfxHz).toBeCloseTo(50, -1); // within 10 Hz (log-spaced grid)
    });

    it('defaults to 300 Hz if SP never drops to -6dB', () => {
      const lwDb = freqs.map(() => 80);
      const spDb = freqs.map(() => 80); // never drops
      const lfxLog = calcLFX(freqs, lwDb, freqs, spDb);
      const lfxHz = Math.pow(10, lfxLog);
      expect(lfxHz).toBeCloseTo(300, 0);
    });
  });

  describe('calcLFQ', () => {
    it('returns 0 when LW and SP are identical', () => {
      const db = freqs.map(() => 80);
      const lfxLog = Math.log10(50);
      const lfq = calcLFQ(freqs, db, freqs, db, lfxLog);
      expect(lfq).toBeCloseTo(0, 5);
    });

    it('returns positive value when LW and SP diverge', () => {
      const lwDb = freqs.map(() => 80);
      const spDb = freqs.map((f) => (f < 300 ? 76 : 80)); // 4 dB divergence in bass
      const lfxLog = Math.log10(50);
      const lfq = calcLFQ(freqs, lwDb, freqs, spDb, lfxLog);
      expect(lfq).toBeGreaterThan(0);
    });
  });

  describe('prefRating', () => {
    it('computes the Olive formula correctly', () => {
      // Score = 12.69 - 2.49*0.3 - 2.99*0.25 - 4.31*log10(40) + 2.32*0.95
      const nbdOn = 0.3;
      const nbdPir = 0.25;
      const lfx = Math.log10(40); // ~1.602
      const smPir = 0.95;
      const score = prefRating(nbdOn, nbdPir, lfx, smPir);
      const expected = 12.69 - 2.49 * 0.3 - 2.99 * 0.25 - 4.31 * lfx + 2.32 * 0.95;
      expect(score).toBeCloseTo(expected, 5);
    });

    it('gives higher score for lower LFX (better bass extension)', () => {
      const nbdOn = 0.3;
      const nbdPir = 0.25;
      const smPir = 0.95;
      const scoreLowBass = prefRating(nbdOn, nbdPir, Math.log10(80), smPir);
      const scoreDeepBass = prefRating(nbdOn, nbdPir, Math.log10(30), smPir);
      expect(scoreDeepBass).toBeGreaterThan(scoreLowBass);
    });

    it('gives higher score for lower NBD (flatter response)', () => {
      const lfx = Math.log10(40);
      const smPir = 0.95;
      const scoreRough = prefRating(0.5, 0.4, lfx, smPir);
      const scoreFlat = prefRating(0.1, 0.1, lfx, smPir);
      expect(scoreFlat).toBeGreaterThan(scoreRough);
    });

    it('gives higher score for higher SM (smoother response)', () => {
      const nbdOn = 0.3;
      const nbdPir = 0.25;
      const lfx = Math.log10(40);
      const scoreRough = prefRating(nbdOn, nbdPir, lfx, 0.5);
      const scoreSmooth = prefRating(nbdOn, nbdPir, lfx, 0.95);
      expect(scoreSmooth).toBeGreaterThan(scoreRough);
    });
  });

  describe('computePreferenceScore', () => {
    it('computes a full score from a spinorama result', () => {
      const onAxis = flatCurve(freqs, 85);
      const spinorama = calcSpinorama(onAxis, 100, 200, 300);
      const result = computePreferenceScore(spinorama);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(15);
      expect(result.nbdOnAxis).toBeGreaterThanOrEqual(0);
      expect(result.smPredInRoom).toBeGreaterThan(0);
      expect(result.smPredInRoom).toBeLessThanOrEqual(1);
      expect(result.lfxHz).toBeGreaterThan(0);
    });

    it('gives a better score for a flat curve than a noisy one', () => {
      const flatOnAxis = flatCurve(freqs, 85);
      const noisyOnAxis: FrequencyDataPoint[] = freqs.map((f, i) => ({
        freq: f,
        magnitude: 85 + Math.sin(i * 2) * 8,
      }));

      const flatSpin = calcSpinorama(flatOnAxis, 100, 200, 300);
      const noisySpin = calcSpinorama(noisyOnAxis, 100, 200, 300);

      const flatResult = computePreferenceScore(flatSpin);
      const noisyResult = computePreferenceScore(noisySpin);

      expect(flatResult.score).toBeGreaterThan(noisyResult.score);
    });

    it('scoreWithSub is >= score (perfect subwoofer helps)', () => {
      const onAxis = flatCurve(freqs, 85);
      const spinorama = calcSpinorama(onAxis, 100, 200, 300);
      const result = computePreferenceScore(spinorama);
      expect(result.scoreWithSub).toBeGreaterThanOrEqual(result.score);
    });
  });
});