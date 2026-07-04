import { describe, it, expect } from 'vitest'
import {
  buildCrossoverFilter,
  applyCrossover,
  crossoverSlopeDbPerOctave,
} from '@/lib/acoustic/crossover'
import type { FrequencyDataPoint, CrossoverType } from '@/types'

// Flat response curve at 90dB
function flatCurve(freqs: number[], level: number = 90): FrequencyDataPoint[] {
  return freqs.map((f) => ({ freq: f, magnitude: level }))
}

const testFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

describe('Crossover filters', () => {
  it('LR4 lowpass attenuates above cutoff', () => {
    const filter = buildCrossoverFilter('LR4', 1000, false)
    const input = flatCurve(testFreqs)
    const output = applyCrossover(filter, input)

    // At 1000Hz (cutoff): should be ~-6dB (LR4 is -6dB at crossover)
    const atCutoff = output.find((p) => p.freq === 1000)!
    expect(atCutoff.magnitude).toBeLessThan(input[0]!.magnitude)

    // Well above cutoff: should be heavily attenuated
    const at10k = output.find((p) => p.freq === 10000)!
    expect(at10k.magnitude).toBeLessThan(atCutoff.magnitude)

    // Well below cutoff: should be nearly unchanged
    const at100 = output.find((p) => p.freq === 100)!
    expect(at100.magnitude).toBeCloseTo(90, 0)
  })

  it('LR4 highpass attenuates below cutoff', () => {
    const filter = buildCrossoverFilter('LR4', 1000, true)
    const input = flatCurve(testFreqs)
    const output = applyCrossover(filter, input)

    // Well below cutoff: should be heavily attenuated
    const at100 = output.find((p) => p.freq === 100)!
    expect(at100.magnitude).toBeLessThan(80)

    // Well above cutoff: should be nearly unchanged
    const at10k = output.find((p) => p.freq === 10000)!
    expect(at10k.magnitude).toBeCloseTo(90, 0)
  })

  it('LR2 has gentler slope than LR4', () => {
    const lr2 = buildCrossoverFilter('LR2', 1000, false)
    const lr4 = buildCrossoverFilter('LR4', 1000, false)
    const input = flatCurve(testFreqs)

    const out2 = applyCrossover(lr2, input)
    const out4 = applyCrossover(lr4, input)

    // At 2000Hz (1 octave above cutoff): LR4 should attenuate more
    const at2k_lr2 = out2.find((p) => p.freq === 2000)!
    const at2k_lr4 = out4.find((p) => p.freq === 2000)!
    expect(at2k_lr4.magnitude).toBeLessThan(at2k_lr2.magnitude)
  })

  it('crossoverSlopeDbPerOctave returns correct slopes', () => {
    expect(crossoverSlopeDbPerOctave('first_order')).toBe(6)
    expect(crossoverSlopeDbPerOctave('BW2')).toBe(12)
    expect(crossoverSlopeDbPerOctave('LR2')).toBe(12)
    expect(crossoverSlopeDbPerOctave('LR4')).toBe(24)
    expect(crossoverSlopeDbPerOctave('LR8')).toBe(48)
  })
})
