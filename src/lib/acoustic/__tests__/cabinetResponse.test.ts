import { describe, it, expect } from 'vitest';
import { calcCabinetResponse } from '../cabinetResponse';
import { generateFrequencies } from '../thieleSmall';
import type { Driver } from '@/types';
import { SEED_DRIVERS } from '@/data/seedDrivers';

function findDriver(id: string): Driver {
  const d = SEED_DRIVERS.find((d) => d.id === id);
  if (!d) throw new Error(`Driver ${id} not found`);
  return d;
}

const FREQS = generateFrequencies(20, 20000, 12);

describe('calcCabinetResponse', () => {
  it('returns flat zero for missing T/S params', () => {
    const d: Driver = {
      id: 'empty',
      manufacturer: 'X',
      model: 'Y',
      type: 'woofer',
      tsParams: { fs: 0, re: 0, qms: 0, qes: 0, qts: 0, vas: 0, sensitivity: 0, xmax: 0, sd: 0, imp: 0 },
      createdAt: 0,
      updatedAt: 0,
    };
    const result = calcCabinetResponse(d, 'sealed', FREQS);
    expect(result.response.every((p) => p.magnitude === 0)).toBe(true);
  });

  // --- Sealed ---
  describe('sealed', () => {
    it('produces boost near Fc and roll-off below', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'sealed', FREQS, 300, 0.707);

      const fc = result.params.fc!;
      const fcIdx = result.response.findIndex((p) => p.freq >= fc);
      const lowIdx = result.response.findIndex((p) => p.freq >= 20);

      // Near Fc: should have some boost (positive loading)
      expect(result.response[fcIdx]!.magnitude).toBeGreaterThan(-2);
      // At 20 Hz: should be negative (roll-off)
      expect(result.response[lowIdx]!.magnitude).toBeLessThan(-3);
    });

    it('reports Fc, F3, Qtc, Vb params', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'sealed', FREQS, 300, 0.707);
      expect(result.params.fc).toBeGreaterThan(0);
      expect(result.params.f3).toBeGreaterThan(0);
      expect(result.params.qtc).toBeCloseTo(0.707, 2);
      expect(result.params.vb).toBeGreaterThan(0);
    });

    it('approaches 0 dB at high frequencies', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'sealed', FREQS, 300, 0.707);
      const hfIdx = result.response.findIndex((p) => p.freq >= 5000);
      expect(Math.abs(result.response[hfIdx]!.magnitude)).toBeLessThan(2);
    });
  });

  // --- Ported ---
  describe('ported', () => {
    it('produces boost between Fb and Fs, roll-off far below Fb', () => {
      const woofer = findDriver('seed-wavecor-wf168wa01');
      const result = calcCabinetResponse(woofer, 'ported', FREQS);

      const fb = result.params.fb!;
      const fs = woofer.tsParams.fs;

      // Between Fb and Fs: ported extends bass (positive loading)
      const midIdx = result.response.findIndex((p) => p.freq >= (fb + fs) / 2);
      expect(result.response[midIdx]!.magnitude).toBeGreaterThan(-1);

      // Far below Fb: steep roll-off (24 dB/oct)
      const lowFreqs = generateFrequencies(2, 50, 12);
      const lowResult = calcCabinetResponse(woofer, 'ported', lowFreqs);
      const veryLowIdx = lowResult.response.findIndex((p) => p.freq >= 3);
      expect(lowResult.response[veryLowIdx]!.magnitude).toBeLessThan(-5);
    });

    it('reports Fb, F3, Vb params', () => {
      const woofer = findDriver('seed-wavecor-wf168wa01');
      const result = calcCabinetResponse(woofer, 'ported', FREQS);
      expect(result.params.fb).toBeGreaterThan(0);
      expect(result.params.f3).toBeGreaterThan(0);
      expect(result.params.vb).toBeGreaterThan(0);
    });

    it('ported roll-off is steeper than sealed at very low frequencies', () => {
      const woofer = findDriver('seed-wavecor-wf168wa01');
      const lowFreqs = generateFrequencies(2, 50, 12);
      const sealed = calcCabinetResponse(woofer, 'sealed', lowFreqs);
      const ported = calcCabinetResponse(woofer, 'ported', lowFreqs);

      // At very low freq (well below Fb), ported 24 dB/oct drops faster than sealed 12 dB/oct
      const s3 = sealed.response.find((p) => p.freq >= 3)!.magnitude;
      const p3 = ported.response.find((p) => p.freq >= 3)!.magnitude;
      expect(p3).toBeLessThan(s3);
    });
  });

  // --- Transmission line ---
  describe('transmission_line', () => {
    it('produces boost near Fs and roll-off below', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'transmission_line', FREQS);

      const fs = woofer.tsParams.fs;
      const fsIdx = result.response.findIndex((p) => p.freq >= fs);
      const lowIdx = result.response.findIndex((p) => p.freq >= 20);

      // Near Fs: should have some boost
      expect(result.response[fsIdx]!.magnitude).toBeGreaterThan(-3);
      // At 20 Hz: roll-off
      expect(result.response[lowIdx]!.magnitude).toBeLessThan(-3);
    });

    it('reports line length', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'transmission_line', FREQS);
      expect(result.params.lineLength).toBeGreaterThan(0);
    });

    it('approaches 0 dB at high frequencies', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'transmission_line', FREQS);
      const hfIdx = result.response.findIndex((p) => p.freq >= 5000);
      expect(Math.abs(result.response[hfIdx]!.magnitude)).toBeLessThan(2);
    });
  });

  // --- Open baffle ---
  describe('open_baffle', () => {
    it('produces only attenuation (no boost)', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'open_baffle', FREQS, 300);

      // Open baffle should never produce positive loading (no cabinet gain)
      const maxMag = Math.max(...result.response.map((p) => p.magnitude));
      expect(maxMag).toBeLessThanOrEqual(0.5);
    });

    it('roll-off frequency depends on baffle width', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const narrow = calcCabinetResponse(woofer, 'open_baffle', FREQS, 200);
      const wide = calcCabinetResponse(woofer, 'open_baffle', FREQS, 500);

      // Narrow baffle: more attenuation at low freq (dipole cancellation starts higher)
      const narrow30 = narrow.response.find((p) => p.freq >= 30)!.magnitude;
      const wide30 = wide.response.find((p) => p.freq >= 30)!.magnitude;
      expect(narrow30).toBeLessThan(wide30);
    });

    it('approaches 0 dB at high frequencies', () => {
      const woofer = findDriver('seed-wavecor-wf146wa01');
      const result = calcCabinetResponse(woofer, 'open_baffle', FREQS, 300);
      const hfIdx = result.response.findIndex((p) => p.freq >= 5000);
      expect(Math.abs(result.response[hfIdx]!.magnitude)).toBeLessThan(1);
    });
  });

  // --- General ---
  it('returns response array matching input frequencies', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const result = calcCabinetResponse(woofer, 'sealed', FREQS);
    expect(result.response).toHaveLength(FREQS.length);
    expect(result.response[0]!.freq).toBe(FREQS[0]);
    expect(result.response[result.response.length - 1]!.freq).toBe(FREQS[FREQS.length - 1]);
  });

  it('includes a human-readable description', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const result = calcCabinetResponse(woofer, 'sealed', FREQS);
    expect(result.description.length).toBeGreaterThan(10);
    expect(result.description).toContain('Sealed');
  });
});
