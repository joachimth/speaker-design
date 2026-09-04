// Comprehensive integration test: 3-way design with EQ filters
//
// Tests the full pipeline:
//   1. EQ biquad generation (low-shelf, high-shelf, peaking)
//   2. Simulation with EQ applied (optimizer + worker paths share same logic)
//   3. Phase computation includes EQ phase
//   4. Auto-optimizer preserves EQ filters across iterations
//   5. Biquad export includes EQ filter sections
//   6. EQ filters affect the summed response measurably

import { describe, it, expect } from 'vitest';
import {
  lowShelfBiquad,
  highShelfBiquad,
  peakingBiquad,
  buildEqBiquad,
  applyEqBiquad,
  eqBiquadPhaseRad,
} from '../crossover';
import {
  simulateOnAxisWithBands,
  scoreFromBands,
  optimizeForPreferenceScore,
} from '../preferenceOptimizer';
import { exportBiquads, exportBiquadsJSON, export4x10HD } from '../biquadExport';
import { SEED_DRIVERS } from '@/data/seedDrivers';
import { generateFrequencies } from '../thieleSmall';
import type { DesignBand, DesignState, EQFilter } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WOOFER_ID = 'seed-sb-acoustics-sb34nrx75-6';   // 12" subwoofer
const MID_ID = 'seed-scanspeak-15w-4434g00';          // 5.5" midrange
const TWEETER_ID = 'seed-scanspeak-h2606-920000';     // 1" tweeter

const drivers = SEED_DRIVERS;

function make3WayBands(eqFilters?: EQFilter[][]): DesignBand[] {
  return [
    {
      driverId: WOOFER_ID,
      role: 'low',
      lowpassFreq: 500,
      lowpassType: 'LR4',
      highpassFreq: 0,
      highpassType: 'LR4',
      gain: 0,
      polarity: 0,
      delay: 0,
      eqFilters: eqFilters?.[0],
    },
    {
      driverId: MID_ID,
      role: 'mid',
      lowpassFreq: 2500,
      lowpassType: 'LR4',
      highpassFreq: 500,
      highpassType: 'LR4',
      gain: -3,
      polarity: 0,
      delay: 0.1,
      eqFilters: eqFilters?.[1],
    },
    {
      driverId: TWEETER_ID,
      role: 'high',
      lowpassFreq: 0,
      lowpassType: 'LR4',
      highpassFreq: 2500,
      highpassType: 'LR4',
      gain: -6,
      polarity: 0,
      delay: 0.12,
      eqFilters: eqFilters?.[2],
    },
  ];
}

const BAFFLE_W = 320;
const BAFFLE_H = 900;
const SAMPLE_RATE = 48000;
const freqs = generateFrequencies(20, 20000, 12);

const testDesign: DesignState = {
  ways: 3,
  bands: make3WayBands(),
  baffleWidth: BAFFLE_W,
  baffleHeight: BAFFLE_H,
  roundoverRadius: 40,
  roomParams: {
    dimensions: { length: 6.5, width: 5.5, height: 2.7 },
    rt60: 0.6,
    speakerDistanceFromFront: 0.5,
    speakerDistanceFromSide: 1,
    speakerHeight: 1.2,
    listeningDistance: 3,
  },
  smoothingFraction: 3,
  cabinetType: 'sealed',
  portFb: null,
  portVb: null,
  portDiameter: 60,
  numPorts: 1,
};

// ---------------------------------------------------------------------------
// 1. EQ Biquad Generation (RBJ Cookbook)
// ---------------------------------------------------------------------------

describe('EQ biquad generation (RBJ cookbook)', () => {
  const fs = SAMPLE_RATE;

  describe('lowShelfBiquad', () => {
    it('produces unity gain at DC when gain is 0', () => {
      const b = lowShelfBiquad(200, 0, 0.707, fs);
      // At DC (z=1), H(z) = (b0+b1+b2)/(1+a1+a2) should be 1 (0 dB)
      const num = b.b0 + b.b1 + b.b2;
      const den = 1 + b.a1 + b.a2;
      expect(20 * Math.log10(Math.abs(num / den))).toBeCloseTo(0, 2);
    });

    it('produces +6 dB boost at DC for +6 dB gain', () => {
      const b = lowShelfBiquad(200, 6, 0.707, fs);
      // H(z=1) = (b0+b1+b2) / (1+a1+a2) should be ~2x in voltage (+6dB)
      const num = b.b0 + b.b1 + b.b2;
      const den = 1 + b.a1 + b.a2;
      const magDb = 20 * Math.log10(Math.abs(num / den));
      expect(magDb).toBeCloseTo(6, 1);
    });

    it('produces -6 dB cut at DC for -6 dB gain', () => {
      const b = lowShelfBiquad(200, -6, 0.707, fs);
      const num = b.b0 + b.b1 + b.b2;
      const den = 1 + b.a1 + b.a2;
      const magDb = 20 * Math.log10(Math.abs(num / den));
      expect(magDb).toBeCloseTo(-6, 1);
    });

    it('approaches 0 dB at high frequencies', () => {
      const b = lowShelfBiquad(200, 6, 0.707, fs);
      // At Nyquist (f=fs/2), z=-1, H(z) = (b0-b1+b2)/(1-a1+a2)
      const num = b.b0 - b.b1 + b.b2;
      const den = 1 - b.a1 + b.a2;
      const magDb = 20 * Math.log10(Math.abs(num / den));
      expect(magDb).toBeCloseTo(0, 1);
    });
  });

  describe('highShelfBiquad', () => {
    it('produces unity gain at DC when gain is 0', () => {
      const b = highShelfBiquad(3000, 0, 0.707, fs);
      const num = b.b0 + b.b1 + b.b2;
      const den = 1 + b.a1 + b.a2;
      expect(20 * Math.log10(Math.abs(num / den))).toBeCloseTo(0, 1);
    });

    it('produces +4 dB boost at HF for +4 dB gain', () => {
      const b = highShelfBiquad(3000, 4, 0.707, fs);
      // At Nyquist
      const num = b.b0 - b.b1 + b.b2;
      const den = 1 - b.a1 + b.a2;
      const magDb = 20 * Math.log10(Math.abs(num / den));
      expect(magDb).toBeCloseTo(4, 1);
    });

    it('produces -3 dB cut at HF for -3 dB gain', () => {
      const b = highShelfBiquad(3000, -3, 0.707, fs);
      const num = b.b0 - b.b1 + b.b2;
      const den = 1 - b.a1 + b.a2;
      const magDb = 20 * Math.log10(Math.abs(num / den));
      expect(magDb).toBeCloseTo(-3, 1);
    });
  });

  describe('peakingBiquad', () => {
    it('produces unity gain at DC and Nyquist', () => {
      const b = peakingBiquad(1000, 6, 1.0, fs);
      // DC
      const numDC = b.b0 + b.b1 + b.b2;
      const denDC = 1 + b.a1 + b.a2;
      expect(20 * Math.log10(Math.abs(numDC / denDC))).toBeCloseTo(0, 1);
      // Nyquist
      const numNyq = b.b0 - b.b1 + b.b2;
      const denNyq = 1 - b.a1 + b.a2;
      expect(20 * Math.log10(Math.abs(numNyq / denNyq))).toBeCloseTo(0, 1);
    });

    it('produces +5 dB at center frequency', () => {
      const fc = 1000;
      const b = peakingBiquad(fc, 5, 2.0, fs);
      // At f=fc, the peaking filter should be at maximum gain
      const w = (2 * Math.PI * fc) / fs;
      const cosW = Math.cos(w);
      const sinW = Math.sin(w);
      const cos2W = Math.cos(2 * w);
      const sin2W = Math.sin(2 * w);
      const numReal = b.b0 + b.b1 * cosW + b.b2 * cos2W;
      const numImag = -(b.b1 * sinW + b.b2 * sin2W);
      const denReal = 1 + b.a1 * cosW + b.a2 * cos2W;
      const denImag = -(b.a1 * sinW + b.a2 * sin2W);
      const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
      const denMag = Math.sqrt(denReal * denReal + denImag * denImag);
      const magDb = 20 * Math.log10(numMag / denMag);
      expect(magDb).toBeCloseTo(5, 1);
    });

    it('produces -4 dB cut at center frequency', () => {
      const fc = 2000;
      const b = peakingBiquad(fc, -4, 1.5, fs);
      const w = (2 * Math.PI * fc) / fs;
      const cosW = Math.cos(w);
      const sinW = Math.sin(w);
      const cos2W = Math.cos(2 * w);
      const sin2W = Math.sin(2 * w);
      const numReal = b.b0 + b.b1 * cosW + b.b2 * cos2W;
      const numImag = -(b.b1 * sinW + b.b2 * sin2W);
      const denReal = 1 + b.a1 * cosW + b.a2 * cos2W;
      const denImag = -(b.a1 * sinW + b.a2 * sin2W);
      const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
      const denMag = Math.sqrt(denReal * denReal + denImag * denImag);
      const magDb = 20 * Math.log10(numMag / denMag);
      expect(magDb).toBeCloseTo(-4, 1);
    });
  });

  describe('buildEqBiquad', () => {
    it('dispatches to correct builder', () => {
      const ls = buildEqBiquad('low_shelf', 200, 6, 0.707, fs);
      const hs = buildEqBiquad('high_shelf', 3000, 4, 0.707, fs);
      const pk = buildEqBiquad('peaking', 1000, 5, 1.0, fs);
      // All should be valid biquads (not unity)
      expect(ls.b0).not.toBe(1);
      expect(hs.b0).not.toBe(1);
      expect(pk.b0).not.toBe(1);
    });

    it('returns unity for 0 dB gain', () => {
      const ls = buildEqBiquad('low_shelf', 200, 0, 0.707, fs);
      expect(ls.b0).toBeCloseTo(1, 5);
    });
  });

  describe('applyEqBiquad', () => {
    it('modifies the curve at the target frequency', () => {
      const curve = freqs.map((f) => ({ freq: f, magnitude: 0 }));
      const biquad = buildEqBiquad('peaking', 1000, 10, 1.0, fs);
      const filtered = applyEqBiquad(biquad, curve, fs);

      // Find the point closest to 1000 Hz
      const idx = freqs.findIndex((f) => f >= 1000);
      expect(filtered[idx]!.magnitude).toBeGreaterThan(8); // should be near +10 dB

      // Far from 1000 Hz should be near 0
      const lowIdx = freqs.findIndex((f) => f >= 50);
      expect(Math.abs(filtered[lowIdx]!.magnitude)).toBeLessThan(1);
    });
  });

  describe('eqBiquadPhaseRad', () => {
    it('returns 0 at DC for unity gain filter', () => {
      const biquad = buildEqBiquad('peaking', 1000, 0, 1.0, fs);
      const phase = eqBiquadPhaseRad(biquad, 10, fs);
      expect(phase).toBeCloseTo(0, 4);
    });

    it('returns non-zero phase for non-unity gain', () => {
      const biquad = buildEqBiquad('peaking', 1000, 6, 1.0, fs);
      const phase = eqBiquadPhaseRad(biquad, 500, fs);
      expect(Math.abs(phase)).toBeGreaterThan(0.01);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Simulation with EQ applied
// ---------------------------------------------------------------------------

describe('Simulation with EQ filters', () => {
  const eqFilters: EQFilter[][] = [
    // Band 0 (woofer): low-shelf +3 dB @ 80 Hz Q0.7 (bass boost)
    [{
      id: 'eq-ls-1',
      kind: 'low_shelf',
      freq: 80,
      gain: 3,
      q: 0.707,
      enabled: true,
    }],
    // Band 1 (midrange): PEQ -3 dB @ 1500 Hz Q2 (dip correction)
    [{
      id: 'eq-peq-1',
      kind: 'peaking',
      freq: 1500,
      gain: -3,
      q: 2.0,
      enabled: true,
    }],
    // Band 2 (tweeter): high-shelf -2 dB @ 8000 Hz Q0.7 (treble tilt)
    [{
      id: 'eq-hs-1',
      kind: 'high_shelf',
      freq: 8000,
      gain: -2,
      q: 0.707,
      enabled: true,
    }],
  ];

  it('simulateOnAxisWithBands applies EQ and changes summed response', () => {
    const bandsNoEq = make3WayBands();
    const bandsWithEq = make3WayBands(eqFilters);

    const resultNoEq = simulateOnAxisWithBands(
      bandsNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const resultWithEq = simulateOnAxisWithBands(
      bandsWithEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    // The summed responses should differ — EQ changes magnitudes
    let maxDiff = 0;
    for (let i = 0; i < freqs.length; i++) {
      const diff = Math.abs(resultWithEq.summed[i]!.magnitude - resultNoEq.summed[i]!.magnitude);
      maxDiff = Math.max(maxDiff, diff);
    }
    expect(maxDiff).toBeGreaterThan(0.5); // EQ should produce measurable difference
  });

  it('scoreFromBands returns different score with vs without EQ', () => {
    const bandsNoEq = make3WayBands();
    const bandsWithEq = make3WayBands(eqFilters);

    const scoreNoEq = scoreFromBands(
      bandsNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const scoreWithEq = scoreFromBands(
      bandsWithEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    // Scores should differ (EQ changes response → changes NBD, smoothness)
    expect(scoreWithEq.score).not.toBeCloseTo(scoreNoEq.score, 1);
  });

  it('disabled EQ filters have no effect', () => {
    const disabledEq: EQFilter[][] = [
      [{ id: 'eq-off', kind: 'low_shelf', freq: 80, gain: 10, q: 0.707, enabled: false }],
      [],
      [],
    ];
    const bandsNoEq = make3WayBands();
    const bandsDisabledEq = make3WayBands(disabledEq);

    const resultNoEq = simulateOnAxisWithBands(
      bandsNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const resultDisabledEq = simulateOnAxisWithBands(
      bandsDisabledEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    // Disabled filter should produce identical response
    for (let i = 0; i < freqs.length; i++) {
      expect(resultDisabledEq.summed[i]!.magnitude).toBeCloseTo(
        resultNoEq.summed[i]!.magnitude, 5,
      );
    }
  });

  it('0 dB gain EQ filters have no effect', () => {
    const zeroGainEq: EQFilter[][] = [
      [{ id: 'eq-zero', kind: 'peaking', freq: 1000, gain: 0, q: 1.0, enabled: true }],
      [],
      [],
    ];
    const bandsNoEq = make3WayBands();
    const bandsZeroEq = make3WayBands(zeroGainEq);

    const resultNoEq = simulateOnAxisWithBands(
      bandsNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const resultZeroEq = simulateOnAxisWithBands(
      bandsZeroEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    for (let i = 0; i < freqs.length; i++) {
      expect(resultZeroEq.summed[i]!.magnitude).toBeCloseTo(
        resultNoEq.summed[i]!.magnitude, 5,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Phase computation includes EQ phase
// ---------------------------------------------------------------------------

describe('EQ phase in simulation', () => {
  it('EQ filter adds phase to the complex sum', () => {
    // A PEQ filter at the crossover frequency will shift phase there
    const eqAtXo: EQFilter[][] = [
      [],
      [{ id: 'eq-phase', kind: 'peaking', freq: 500, gain: 6, q: 1.0, enabled: true }],
      [],
    ];
    const bandsNoEq = make3WayBands();
    const bandsWithEq = make3WayBands(eqAtXo);

    const resultNoEq = simulateOnAxisWithBands(
      bandsNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const resultWithEq = simulateOnAxisWithBands(
      bandsWithEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    // At the crossover (500 Hz) the phase shift should change the sum magnitude
    const xoIdx = freqs.findIndex((f) => f >= 500);
    const diff = Math.abs(resultWithEq.summed[xoIdx]!.magnitude - resultNoEq.summed[xoIdx]!.magnitude);
    expect(diff).toBeGreaterThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// 4. Auto-optimizer preserves EQ filters
// ---------------------------------------------------------------------------

describe('Auto-optimizer with EQ filters', () => {
  const eqFilters: EQFilter[][] = [
    [{ id: 'eq-preserve-1', kind: 'low_shelf', freq: 100, gain: 3, q: 0.707, enabled: true }],
    [{ id: 'eq-preserve-2', kind: 'peaking', freq: 1200, gain: -2, q: 2.0, enabled: true }],
    [{ id: 'eq-preserve-3', kind: 'high_shelf', freq: 6000, gain: -1, q: 0.707, enabled: true }],
  ];

  it('optimizer preserves existing EQ filters in output', () => {
    const bandsWithEq = make3WayBands(eqFilters);
    const result = optimizeForPreferenceScore({
      bands: bandsWithEq,
      drivers,
      ways: 3,
      baffleWidth: BAFFLE_W,
      baffleHeight: BAFFLE_H,
      cabinetType: 'sealed',
      portFb: 0,
      portVb: 0,
      portDiameter: 60,
      numPorts: 1,
    });

    // All EQ filters should still be present in the optimized bands
    expect(result.optimizedBands[0]!.eqFilters).toBeDefined();
    expect(result.optimizedBands[0]!.eqFilters).toHaveLength(1);
    expect(result.optimizedBands[0]!.eqFilters![0]!.id).toBe('eq-preserve-1');

    expect(result.optimizedBands[1]!.eqFilters).toBeDefined();
    expect(result.optimizedBands[1]!.eqFilters).toHaveLength(1);
    expect(result.optimizedBands[1]!.eqFilters![0]!.id).toBe('eq-preserve-2');

    expect(result.optimizedBands[2]!.eqFilters).toBeDefined();
    expect(result.optimizedBands[2]!.eqFilters).toHaveLength(1);
    expect(result.optimizedBands[2]!.eqFilters![0]!.id).toBe('eq-preserve-3');
  });

  it('optimizer runs to completion with EQ and produces valid score', () => {
    const bandsWithEq = make3WayBands(eqFilters);
    const result = optimizeForPreferenceScore({
      bands: bandsWithEq,
      drivers,
      ways: 3,
      baffleWidth: BAFFLE_W,
      baffleHeight: BAFFLE_H,
      cabinetType: 'sealed',
      portFb: 0,
      portVb: 0,
      portDiameter: 60,
      numPorts: 1,
    });

    expect(result.afterScore.score).toBeGreaterThan(0);
    expect(result.afterScore.score).toBeLessThanOrEqual(10);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('optimizer with EQ produces different result than without', () => {
    const bandsNoEq = make3WayBands();
    const bandsWithEq = make3WayBands(eqFilters);

    const resultNoEq = optimizeForPreferenceScore({
      bands: bandsNoEq,
      drivers,
      ways: 3,
      baffleWidth: BAFFLE_W,
      baffleHeight: BAFFLE_H,
      cabinetType: 'sealed',
      portFb: 0,
      portVb: 0,
      portDiameter: 60,
      numPorts: 1,
    });

    const resultWithEq = optimizeForPreferenceScore({
      bands: bandsWithEq,
      drivers,
      ways: 3,
      baffleWidth: BAFFLE_W,
      baffleHeight: BAFFLE_H,
      cabinetType: 'sealed',
      portFb: 0,
      portVb: 0,
      portDiameter: 60,
      numPorts: 1,
    });

    // The optimized crossover/gain/delay should differ because
    // EQ changes the starting response shape
    expect(resultWithEq.afterScore.score).not.toBeCloseTo(resultNoEq.afterScore.score, 1);
  });
});

// ---------------------------------------------------------------------------
// 5. Biquad export includes EQ filter sections
// ---------------------------------------------------------------------------

describe('Biquad export with EQ filters', () => {
  const eqFilters: EQFilter[][] = [
    [{ id: 'eq-export-ls', kind: 'low_shelf', freq: 80, gain: 3, q: 0.707, enabled: true }],
    [{ id: 'eq-export-peq', kind: 'peaking', freq: 1500, gain: -3, q: 2.0, enabled: true }],
    [{ id: 'eq-export-hs', kind: 'high_shelf', freq: 8000, gain: -2, q: 0.707, enabled: true }],
  ];

  const designWithEq: DesignState = {
    ...testDesign,
    bands: make3WayBands(eqFilters),
  };

  describe('exportBiquads (2x4 format)', () => {
    const result = exportBiquads(designWithEq);

    it('includes EQ filter sections in band list', () => {
      const eqBands = result.bands.filter((b) =>
        b.filterType === 'low_shelf' || b.filterType === 'high_shelf' || b.filterType === 'peaking',
      );
      expect(eqBands).toHaveLength(3); // one EQ per band
    });

    it('labels EQ filters with type, freq, gain, Q', () => {
      const lsBand = result.bands.find((b) => b.filterType === 'low_shelf');
      expect(lsBand).toBeDefined();
      expect(lsBand!.label).toContain('Low Shelf');
      expect(lsBand!.label).toContain('80');
      expect(lsBand!.label).toContain('+3');
      expect(lsBand!.fc).toBe(80);
    });

    it('includes EQ coefficients in text output', () => {
      expect(result.text).toContain('Low Shelf');
      expect(result.text).toContain('High Shelf');
      expect(result.text).toContain('PEQ');
    });

    it('each EQ section has exactly 1 biquad section', () => {
      const eqBands = result.bands.filter((b) =>
        b.filterType === 'low_shelf' || b.filterType === 'high_shelf' || b.filterType === 'peaking',
      );
      for (const b of eqBands) {
        expect(b.sections).toHaveLength(1);
      }
    });
  });

  describe('exportBiquadsJSON', () => {
    const json = exportBiquadsJSON(designWithEq);
    const parsed = JSON.parse(json);

    it('includes EQ filter entries in JSON', () => {
      const eqBands = parsed.bands.filter((b: any) =>
        b.filterType === 'low_shelf' || b.filterType === 'high_shelf' || b.filterType === 'peaking',
      );
      expect(eqBands).toHaveLength(3);
    });

    it('EQ entries have Q23 hex coefficients', () => {
      const peqBand = parsed.bands.find((b: any) => b.filterType === 'peaking');
      expect(peqBand).toBeDefined();
      expect(peqBand.sections[0].q23hex).toBeDefined();
      expect(peqBand.sections[0].q23hex.b0).toMatch(/^0x[0-9a-f]{6}$/);
    });
  });

  describe('export4x10HD', () => {
    const result = export4x10HD(designWithEq);

    it('includes EQ filters per output', () => {
      const out0 = result.outputs[0]!;
      expect(out0.eqFilters).toBeDefined();
      expect(out0.eqFilters).toHaveLength(1);
      expect(out0.eqFilters![0]!.kind).toBe('low_shelf');

      const out1 = result.outputs[1]!;
      expect(out1.eqFilters).toBeDefined();
      expect(out1.eqFilters![0]!.kind).toBe('peaking');

      const out2 = result.outputs[2]!;
      expect(out2.eqFilters).toBeDefined();
      expect(out2.eqFilters![0]!.kind).toBe('high_shelf');
    });

    it('includes EQ in text output', () => {
      expect(result.text).toContain('EQ Filters');
      expect(result.text).toContain('low_shelf');
      expect(result.text).toContain('peaking');
      expect(result.text).toContain('high_shelf');
    });

    it('includes EQ in JSON output', () => {
      const parsed = JSON.parse(result.json);
      const out0 = parsed.outputs[0];
      expect(out0.eqFilters).toBeDefined();
      expect(out0.eqFilters).toHaveLength(1);
      expect(out0.eqFilters[0].kind).toBe('low_shelf');
      expect(out0.eqFilters[0].sections[0].q23hex).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. EQ only applied to bands with active crossover filters
// ---------------------------------------------------------------------------

describe('EQ only on bands with active crossover', () => {
  it('EQ on band without crossover has no effect on simulation', () => {
    // Band 2 (tweeter) with highpass at 0 = no active crossover
    const bandsNoXo: DesignBand[] = [
      {
        driverId: WOOFER_ID, role: 'low',
        lowpassFreq: 500, lowpassType: 'LR4',
        highpassFreq: 0, highpassType: 'LR4',
        gain: 0, polarity: 0, delay: 0,
      },
      {
        driverId: MID_ID, role: 'mid',
        lowpassFreq: 2500, lowpassType: 'LR4',
        highpassFreq: 500, highpassType: 'LR4',
        gain: -3, polarity: 0, delay: 0.1,
      },
      {
        driverId: TWEETER_ID, role: 'high',
        lowpassFreq: 0, lowpassType: 'LR4',
        highpassFreq: 0, highpassType: 'LR4', // NO highpass = no active crossover
        gain: -6, polarity: 0, delay: 0.12,
        // EQ should be ignored since no active crossover
        eqFilters: [{ id: 'eq-ignored', kind: 'peaking', freq: 5000, gain: 20, q: 1.0, enabled: true }],
      },
    ];

    const bandsNoXoNoEq: DesignBand[] = bandsNoXo.map((b) => ({ ...b, eqFilters: undefined }));

    const resultWithEq = simulateOnAxisWithBands(
      bandsNoXo, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );
    const resultWithoutEq = simulateOnAxisWithBands(
      bandsNoXoNoEq, drivers, freqs, BAFFLE_W, BAFFLE_H, 'sealed', 0, 0, 60, 1,
    );

    // Since band 2 has no active crossover, its EQ should be ignored
    for (let i = 0; i < freqs.length; i++) {
      expect(resultWithEq.summed[i]!.magnitude).toBeCloseTo(
        resultWithoutEq.summed[i]!.magnitude, 5,
      );
    }
  });
});
