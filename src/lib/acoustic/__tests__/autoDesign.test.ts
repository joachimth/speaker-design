import { describe, it, expect } from 'vitest';
import {
  suggestCrossover,
  suggestCabinet,
  suggestBaffle,
  suggestSystem,
  pistonDiameter,
  directivityLimit,
  acousticCenterDepth,
  usableRange,
} from '../autoDesign';
import type { Driver, ThieleSmallParams } from '@/types';
import { SEED_DRIVERS } from '@/data/seedDrivers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findDriver(id: string): Driver {
  const d = SEED_DRIVERS.find((d) => d.id === id);
  if (!d) throw new Error(`Driver ${id} not found in seed data`);
  return d;
}

function makeDriver(overrides: Partial<Driver> & { id: string }): Driver {
  const baseTs: ThieleSmallParams = {
    fs: 50, re: 6.2, qms: 2.0, qes: 0.5, qts: 0.4, vas: 30,
    sensitivity: 88, xmax: 5, sd: 120, imp: 8,
  };
  return {
    id: overrides.id,
    manufacturer: overrides.manufacturer ?? 'Test',
    model: overrides.model ?? 'Driver',
    type: overrides.type ?? 'woofer',
    tsParams: { ...baseTs, ...overrides.tsParams },
    dimensions: overrides.dimensions,
    frequencyResponse: overrides.frequencyResponse,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('pistonDiameter', () => {
  it('calculates from Sd', () => {
    const d = makeDriver({ id: 't1', tsParams: { sd: 120, fs: 50, re: 6, qms: 2, qes: 0.5, qts: 0.4, vas: 30, sensitivity: 88, xmax: 5, imp: 8 } });
    const dia = pistonDiameter(d);
    // Sd=120 cm² → r=sqrt(120/π)=6.18cm → d=123.7mm
    expect(dia).toBeCloseTo(123.7, 0);
  });

  it('falls back to overallDiameter × 0.82 when Sd missing', () => {
    const d = makeDriver({ id: 't2', tsParams: { sd: 0, fs: 50, re: 6, qms: 2, qes: 0.5, qts: 0.4, vas: 30, sensitivity: 88, xmax: 5, imp: 8 }, dimensions: { overallDiameter: 180, cutoutDiameter: 165, mountingDepth: 80 } });
    const dia = pistonDiameter(d);
    expect(dia).toBeCloseTo(147.6, 0);
  });
});

describe('directivityLimit', () => {
  it('returns higher frequency for smaller diameter', () => {
    const small = directivityLimit(25);   // 1" tweeter
    const large = directivityLimit(170);  // 8" woofer
    expect(small).toBeGreaterThan(large);
  });

  it('gives ~1.3 kHz for 170mm piston', () => {
    expect(directivityLimit(170)).toBeCloseTo(1284, -1);
  });
});

describe('acousticCenterDepth', () => {
  it('returns larger depth for woofer than tweeter', () => {
    const woofer = makeDriver({ id: 'w', type: 'woofer' });
    const tweeter = makeDriver({ id: 't', type: 'tweeter' });
    expect(acousticCenterDepth(woofer)).toBeGreaterThan(acousticCenterDepth(tweeter));
  });

  it('refines estimate from mountingDepth when available', () => {
    const d = makeDriver({
      id: 'd',
      type: 'woofer',
      dimensions: { overallDiameter: 200, cutoutDiameter: 185, mountingDepth: 120 },
    });
    const depth = acousticCenterDepth(d);
    expect(depth).toBeGreaterThan(30);
    expect(depth).toBeLessThan(140);
  });
});

describe('usableRange', () => {
  it('returns 0 lower bound for woofers', () => {
    const d = makeDriver({ id: 'w', type: 'woofer', tsParams: { fs: 30, re: 6, qms: 2, qes: 0.4, qts: 0.33, vas: 60, sensitivity: 86, xmax: 8, sd: 220, imp: 8 } });
    const r = usableRange(d);
    expect(r.min).toBe(0);
    expect(r.max).toBeGreaterThan(500);
  });

  it('returns Fs×1.5 lower bound for tweeters', () => {
    const d = makeDriver({ id: 't', type: 'tweeter', tsParams: { fs: 1000, re: 4.5, qms: 1.5, qes: 0.8, qts: 0.53, vas: 0.05, sensitivity: 92, xmax: 0.5, sd: 5, imp: 4 } });
    const r = usableRange(d);
    expect(r.min).toBeCloseTo(1500, 0);
    expect(r.max).toBeGreaterThan(5000);
  });
});

// ---------------------------------------------------------------------------
// suggestCrossover
// ---------------------------------------------------------------------------

describe('suggestCrossover', () => {
  it('returns empty with fewer than 2 drivers', () => {
    const result = suggestCrossover([findDriver('seed-vifa-bc25tg15-04')], 2);
    expect(result.bands).toHaveLength(0);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('suggests 2-way crossover with valid frequencies', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestCrossover([woofer, tweeter], 2);

    expect(result.bands).toHaveLength(2);
    expect(result.crossoverPoints).toHaveLength(1);

    const xo = result.crossoverPoints[0]!.freq;
    // Should be between 1500 and 3500 for a 5.75" + 1" tweeter
    expect(xo).toBeGreaterThanOrEqual(1500);
    expect(xo).toBeLessThanOrEqual(3500);

    // Low band: lowpass = xo, highpass = 0
    expect(result.bands[0]!.lowpassFreq).toBe(xo);
    expect(result.bands[0]!.highpassFreq).toBe(0);

    // High band: highpass = xo, lowpass = 0
    expect(result.bands[1]!.highpassFreq).toBe(xo);
    expect(result.bands[1]!.lowpassFreq).toBe(0);
  });

  it('assigns gain relative to least sensitive driver', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');   // 90 dB
    const tweeter = findDriver('seed-vifa-bc25tg15-04');    // 93.9 dB
    const result = suggestCrossover([woofer, tweeter], 2);

    // Woofer is less sensitive (90), so gain = 0
    // Tweeter is more sensitive (93.9), so gain = 90 - 93.9 = -3.9
    const wooferBand = result.bands.find((b) => b.driverId === woofer.id);
    const tweeterBand = result.bands.find((b) => b.driverId === tweeter.id);

    expect(wooferBand!.gain).toBeCloseTo(0, 0);
    expect(tweeterBand!.gain).toBeLessThan(0);
    expect(tweeterBand!.gain).toBeCloseTo(-3.9, 0);
  });

  it('applies delay to tweeter relative to woofer', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestCrossover([woofer, tweeter], 2);

    const wooferBand = result.bands.find((b) => b.driverId === woofer.id);
    const tweeterBand = result.bands.find((b) => b.driverId === tweeter.id);

    // Woofer has deeper acoustic center → 0 delay (reference)
    expect(wooferBand!.delay).toBeGreaterThanOrEqual(0);
    // Tweeter should have positive delay to align with woofer
    expect(tweeterBand!.delay).toBeGreaterThan(wooferBand!.delay);
  });

  it('suggests 3-way with two crossover points', () => {
    const woofer = findDriver('seed-wavecor-wf168wa01');
    const mid = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestCrossover([woofer, mid, tweeter], 3);

    expect(result.bands).toHaveLength(3);
    expect(result.crossoverPoints).toHaveLength(2);

    // Lower crossover should be lower than upper crossover
    const [xo1, xo2] = result.crossoverPoints;
    expect(xo1!.freq).toBeLessThan(xo2!.freq);

    // Mid band has both HP and LP
    const midBand = result.bands.find((b) => b.driverId === mid.id);
    expect(midBand!.highpassFreq).toBe(xo1!.freq);
    expect(midBand!.lowpassFreq).toBe(xo2!.freq);
  });

  it('protects tweeter from being crossed too low', () => {
    // Create a tweeter with very low Fs to test the safety check
    const lowFsTweeter = makeDriver({
      id: 'low-fs-tweeter',
      type: 'tweeter',
      tsParams: { fs: 500, re: 4.5, qms: 1.5, qes: 0.8, qts: 0.53, vas: 0.1, sensitivity: 90, xmax: 0.5, sd: 8, imp: 4 },
    });
    const bigWoofer = makeDriver({
      id: 'big-woofer',
      type: 'woofer',
      tsParams: { fs: 30, re: 6, qms: 2, qes: 0.35, qts: 0.3, vas: 80, sensitivity: 87, xmax: 8, sd: 350, imp: 8 },
    });

    const result = suggestCrossover([bigWoofer, lowFsTweeter], 2);
    const xo = result.crossoverPoints[0]!.freq;
    // Should be at least 500 * 1.2 = 600
    expect(xo).toBeGreaterThanOrEqual(600);
  });

  it('uses LR4 as default crossover type', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestCrossover([woofer, tweeter], 2);

    expect(result.bands.every((b) => b.lowpassType === 'LR4' || b.lowpassFreq === 0)).toBe(true);
    expect(result.bands.every((b) => b.highpassType === 'LR4' || b.highpassFreq === 0)).toBe(true);
  });

  it('sets polarity 0 for LR4 (even order)', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestCrossover([woofer, tweeter], 2);

    expect(result.bands.every((b) => b.polarity === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// suggestCabinet
// ---------------------------------------------------------------------------

describe('suggestCabinet', () => {
  it('suggests sealed cabinet with valid dimensions', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const result = suggestCabinet(woofer, 'sealed');

    expect(result.type).toBe('sealed');
    expect(result.sealed).toBeDefined();
    expect(result.dimensions.width).toBeGreaterThan(100);
    expect(result.dimensions.height).toBeGreaterThan(result.dimensions.width);
    expect(result.internalVolume).toBeGreaterThan(0);

    // Internal volume should be close to target Vb
    if (result.sealed) {
      const ratio = result.internalVolume / result.sealed.vb;
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1.3);
    }
  });

  it('suggests ported cabinet with port dimensions', () => {
    const woofer = findDriver('seed-wavecor-wf168wa01');
    const result = suggestCabinet(woofer, 'ported');

    expect(result.type).toBe('ported');
    expect(result.ported).toBeDefined();
    expect(result.portLength).toBeGreaterThan(0);
    expect(result.dimensions.width).toBeGreaterThan(100);
  });

  it('baffle width is large enough for driver', () => {
    const woofer = findDriver('seed-scanspeak-22w-8851t00');
    const result = suggestCabinet(woofer, 'sealed');

    const driverDia = woofer.dimensions?.overallDiameter ?? 200;
    expect(result.dimensions.baffleWidth).toBeGreaterThanOrEqual(driverDia + 40);
  });

  it('open baffle returns baffle-only dimensions', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const result = suggestCabinet(woofer, 'open_baffle');

    expect(result.type).toBe('open_baffle');
    expect(result.internalVolume).toBe(0);
    expect(result.dimensions.baffleWidth).toBeGreaterThan(0);
    expect(result.dimensions.baffleHeight).toBeGreaterThan(result.dimensions.baffleWidth);
  });

  it('wall thickness scales with volume', () => {
    const smallDriver = findDriver('seed-sb-acoustics-sb12nrx25-4');
    const largeDriver = findDriver('seed-scanspeak-22w-8851t00');

    const smallCabinet = suggestCabinet(smallDriver, 'sealed');
    const largeCabinet = suggestCabinet(largeDriver, 'sealed');

    // Large cabinet should have >= wall thickness
    expect(largeCabinet.dimensions.wallThickness).toBeGreaterThanOrEqual(smallCabinet.dimensions.wallThickness);
  });
});

// ---------------------------------------------------------------------------
// suggestBaffle
// ---------------------------------------------------------------------------

describe('suggestBaffle', () => {
  it('returns default with no drivers', () => {
    const result = suggestBaffle([], []);
    expect(result.width).toBe(300);
    expect(result.fStep).toBeGreaterThan(0);
  });

  it('width accommodates largest driver', () => {
    const woofer = findDriver('seed-wavecor-wf168wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestBaffle([woofer, tweeter], [2000]);

    const maxDia = Math.max(
      woofer.dimensions?.overallDiameter ?? 0,
      tweeter.dimensions?.overallDiameter ?? 0,
    );
    expect(result.width).toBeGreaterThanOrEqual(maxDia + 40);
  });

  it('baffle step is below lowest crossover', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const xoFreq = 2000;
    const result = suggestBaffle([woofer, tweeter], [xoFreq]);

    expect(result.fStep).toBeLessThan(xoFreq);
  });

  it('height accommodates all stacked drivers', () => {
    const woofer = findDriver('seed-wavecor-wf168wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestBaffle([woofer, tweeter], [2000]);

    const totalDriverHeight =
      (woofer.dimensions?.overallDiameter ?? 0) +
      (tweeter.dimensions?.overallDiameter ?? 0);
    expect(result.height).toBeGreaterThan(totalDriverHeight);
  });

  it('roundover is reasonable', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestBaffle([woofer, tweeter], [2000]);

    expect(result.roundoverRadius).toBeGreaterThan(0);
    expect(result.roundoverRadius).toBeLessThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// suggestSystem
// ---------------------------------------------------------------------------

describe('suggestSystem', () => {
  it('combines crossover + cabinet + baffle', () => {
    const woofer = findDriver('seed-wavecor-wf146wa01');
    const tweeter = findDriver('seed-vifa-bc25tg15-04');
    const result = suggestSystem([woofer, tweeter], 2, 'sealed');

    expect(result.crossover.bands).toHaveLength(2);
    expect(result.cabinet.type).toBe('sealed');
    expect(result.baffle.width).toBeGreaterThan(0);
    expect(result.baffle.height).toBeGreaterThan(0);

    // Baffle step should be below the crossover frequency
    const xo = result.crossover.crossoverPoints[0]!.freq;
    expect(result.baffle.fStep).toBeLessThan(xo);
  });
});
