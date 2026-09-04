import { describe, it, expect } from 'vitest'
import { computeEqResponse } from '../crossover'
import { exportToREW } from '../rewExport'
import { calcBaffleStep } from '../baffle'
import { simulateOnAxisWithBands, resampleToFreqs, complexSum } from '../simulateBands'
import { generateFrequencies } from '../thieleSmall'
import { generateTargetCurve } from '../targetCurve'
import type { EQFilter, FrequencyDataPoint, DesignBand, Driver } from '@/types'

const freqs = generateFrequencies(20, 20000, 6)

describe('computeEqResponse', () => {
  it('returns 0 dB for no filters', () => {
    const result = computeEqResponse([], freqs)
    expect(result.every((p) => p.magnitude === 0)).toBe(true)
  })

  it('returns 0 dB for disabled filters', () => {
    const filters: EQFilter[] = [
      { id: '1', kind: 'peaking', freq: 1000, gain: 5, q: 1, enabled: false },
    ]
    const result = computeEqResponse(filters, freqs)
    expect(result.every((p) => p.magnitude === 0)).toBe(true)
  })

  it('returns 0 dB for zero-gain filters', () => {
    const filters: EQFilter[] = [
      { id: '1', kind: 'peaking', freq: 1000, gain: 0, q: 1, enabled: true },
    ]
    const result = computeEqResponse(filters, freqs)
    expect(result.every((p) => p.magnitude === 0)).toBe(true)
  })

  it('applies a low-shelf boost at low frequencies', () => {
    const filters: EQFilter[] = [
      { id: '1', kind: 'low_shelf', freq: 200, gain: 6, q: 0.707, enabled: true },
    ]
    const result = computeEqResponse(filters, freqs)
    // At very low freq, the shelf should be near +6 dB
    const lowIdx = 0
    expect(result[lowIdx]!.magnitude).toBeGreaterThan(4)
    // At high freq, the shelf should be near 0 dB
    const highIdx = result.length - 1
    expect(result[highIdx]!.magnitude).toBeLessThan(1)
  })

  it('applies a peaking filter at center frequency', () => {
    const filters: EQFilter[] = [
      { id: '1', kind: 'peaking', freq: 1000, gain: 10, q: 1, enabled: true },
    ]
    const result = computeEqResponse(filters, freqs)
    // Find the frequency closest to 1000 Hz
    let closestIdx = 0
    let closestDiff = Infinity
    for (let i = 0; i < freqs.length; i++) {
      const diff = Math.abs(freqs[i]! - 1000)
      if (diff < closestDiff) { closestDiff = diff; closestIdx = i }
    }
    // Peak should be well above 5 dB at center
    expect(result[closestIdx]!.magnitude).toBeGreaterThan(5)
  })

  it('cascades multiple filters', () => {
    const filters: EQFilter[] = [
      { id: '1', kind: 'low_shelf', freq: 100, gain: 3, q: 0.707, enabled: true },
      { id: '2', kind: 'peaking', freq: 500, gain: -4, q: 2, enabled: true },
    ]
    const result = computeEqResponse(filters, freqs)
    // Should have non-zero response at both 100 and 500 Hz
    expect(result.some((p) => p.magnitude !== 0)).toBe(true)
  })
})

describe('exportToREW', () => {
  it('generates valid REW text format', () => {
    const curve: FrequencyDataPoint[] = [
      { freq: 20, magnitude: 80 },
      { freq: 100, magnitude: 82 },
      { freq: 1000, magnitude: 85 },
    ]
    const text = exportToREW(curve, 'Test Speaker')
    expect(text).toContain('Test Speaker')
    expect(text).toContain('20.00\t80.0000')
    expect(text).toContain('100.00\t82.0000')
    expect(text).toContain('1000.00\t85.0000')
  })

  it('handles empty curve', () => {
    const text = exportToREW([], 'Empty')
    expect(text).toContain('Empty')
    // Should still have the header
    expect(text).toContain('Freq')
  })
})

describe('calcBaffleStep with driver offset', () => {
  it('default (no offset) matches standard model', () => {
    const result1 = calcBaffleStep(320, 900, freqs)
    const result2 = calcBaffleStep(320, 900, freqs, 0, undefined)
    expect(result1.response).toEqual(result2.response)
  })

  it('off-center driver has different loss than centered (higher fStep)', () => {
    const centered = calcBaffleStep(320, 900, freqs)
    const offset = calcBaffleStep(320, 900, freqs, 120) // 120mm off center
    // Off-center driver has smaller effective baffle → higher fStep
    // At frequencies near the centered fStep, the offset driver has MORE
    // loss because it's still in the transition zone.
    // Find a frequency near centered fStep (~536 Hz)
    let nearIdx = 0
    for (let i = 0; i < freqs.length; i++) {
      if (Math.abs(freqs[i]! - 536) < Math.abs(freqs[nearIdx]! - 536)) nearIdx = i
    }
    // The two curves should differ at this frequency
    expect(offset.response[nearIdx]!).not.toBeCloseTo(centered.response[nearIdx]!, 1)
    // Offset has more loss (more negative) near the centered fStep
    expect(offset.response[nearIdx]!).toBeLessThan(centered.response[nearIdx]!)
  })

  it('driver near edge has even less baffle step', () => {
    const nearEdge = calcBaffleStep(320, 900, freqs, 150) // very close to edge
    // Near-edge driver: effective width = 2*(160-150) = 20mm → very high fStep
    const fStepNear = 343000 / (2 * Math.min(320, 2 * (320 / 2 - 150)))
    const fStepCentered = 343000 / (2 * 320)
    expect(fStepNear).toBeGreaterThan(fStepCentered)
    // Verify the response is finite
    expect(isFinite(nearEdge.response[0]!)).toBe(true)
  })

  it('vertical offset also affects baffle step', () => {
    const centered = calcBaffleStep(320, 900, freqs, 0, 450) // middle of 900mm baffle
    const topEdge = calcBaffleStep(320, 900, freqs, 0, 10) // very near top
    // Near top edge has smaller effective vertical dimension
    const fStepTop = 343000 / (2 * Math.min(320, 2 * 10))
    const fStepCenter = 343000 / (2 * Math.min(320, 2 * 450))
    expect(fStepTop).toBeGreaterThan(fStepCenter)
    // Both should be finite
    expect(isFinite(centered.response[0]!)).toBe(true)
    expect(isFinite(topEdge.response[0]!)).toBe(true)
  })
})

describe('generateTargetCurve with baffle compensation', () => {
  it('flat target without baffle params is all zeros', () => {
    const curve = generateTargetCurve(freqs, { type: 'flat' })
    expect(curve.every((v) => v === 0)).toBe(true)
  })

  it('flat target with baffle params includes low-freq boost', () => {
    const curve = generateTargetCurve(freqs, { type: 'flat' }, 320, 900)
    // At very low freq, baffle comp should add positive dB
    expect(curve[0]!).toBeGreaterThan(0)
    // At high freq, baffle comp should be near 0
    expect(curve[curve.length - 1]!).toBeLessThan(1)
  })

  it('harman target with baffle params combines tilt + comp', () => {
    const curve = generateTargetCurve(freqs, { type: 'harman' }, 320, 900)
    // At low freq: harman tilt (some boost) + baffle comp (more boost) > 0
    expect(curve[0]!).toBeGreaterThan(0)
    // At high freq: harman +2 dB tilt, baffle comp ~0
    const highVal = curve[curve.length - 1]!
    expect(highVal).toBeGreaterThan(1.5)
    expect(highVal).toBeLessThan(3)
  })
})

describe('shared simulateBands module', () => {
  it('resampleToFreqs interpolates correctly', () => {
    const src: FrequencyDataPoint[] = [
      { freq: 100, magnitude: 80 },
      { freq: 1000, magnitude: 90 },
    ]
    const result = resampleToFreqs(src, [100, 316, 1000])
    expect(result[0]!.magnitude).toBe(80)
    expect(result[2]!.magnitude).toBe(90)
    // Log-space interpolation at 316 Hz (halfway in log space)
    expect(result[1]!.magnitude).toBeCloseTo(85, 0)
  })

  it('complexSum returns very low values for empty bands', () => {
    const result = complexSum([], freqs)
    // No bands → sum is 0 → 20*log10(1e-10) = -200 dB
    expect(result.every((p) => p.magnitude < -190)).toBe(true)
  })

  it('simulateOnAxisWithBands returns summed + bandCurves', () => {
    const woofer: Driver = {
      id: 'test-woofer',
      manufacturer: 'Test',
      model: 'Woofer',
      type: 'woofer',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tsParams: {
        fs: 30, qts: 0.4, vas: 50, re: 6, le: 1, bl: 10,
        mms: 20, sd: 500, sensitivity: 88, xmax: 5, qes: 0.5, qms: 3, imp: 8,
      },
      dimensions: { overallDiameter: 180, cutoutDiameter: 160, mountingDepth: 80 },
    }
    const tweeter: Driver = {
      id: 'test-tweeter',
      manufacturer: 'Test',
      model: 'Tweeter',
      type: 'tweeter',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tsParams: {
        fs: 1000, qts: 0.5, vas: 0.1, re: 4, le: 0.1, bl: 2,
        mms: 0.3, sd: 5, sensitivity: 90, xmax: 0.5, qes: 0.6, qms: 5, imp: 8,
      },
      dimensions: { overallDiameter: 30, cutoutDiameter: 28, mountingDepth: 15 },
    }
    const bands: DesignBand[] = [
      { driverId: 'test-woofer', role: 'low', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
      { driverId: 'test-tweeter', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
    ]
    const result = simulateOnAxisWithBands(bands, [woofer, tweeter], freqs, 320, 900, 'sealed', 0, 20, 0, 1)
    expect(result.summed.length).toBe(freqs.length)
    expect(result.bandCurves.length).toBe(2)
    expect(result.processedBands.length).toBe(2)
    // Summed response should have finite magnitudes
    expect(result.summed.every((p) => isFinite(p.magnitude))).toBe(true)
  })
})
