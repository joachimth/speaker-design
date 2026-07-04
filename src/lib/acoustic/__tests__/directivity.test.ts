import { describe, it, expect } from 'vitest'
import {
  pistonDirectivity,
  calcSpinorama,
  calcPolar,
} from '@/lib/acoustic/directivity'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import type { FrequencyDataPoint } from '@/types'

describe('Directivity', () => {
  it('pistonDirectivity returns 1 on-axis', () => {
    const dir = pistonDirectivity(1000, 0, 100)
    expect(dir).toBe(1)
  })

  it('pistonDirectivity narrows at high frequencies', () => {
    const lowFreq = pistonDirectivity(100, 45, 100)
    const highFreq = pistonDirectivity(10000, 45, 100)
    // At high freq, off-axis should be more attenuated
    expect(highFreq).toBeLessThan(lowFreq)
  })

  it('pistonDirectivity is symmetric (±angle)', () => {
    const pos = pistonDirectivity(5000, 30, 100)
    const neg = pistonDirectivity(5000, -30, 100)
    expect(pos).toBeCloseTo(neg, 5)
  })

  it('calcSpinorama returns all 6 curves', () => {
    const freqs = generateFrequencies(100, 10000, 6)
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 90,
    }))
    const result = calcSpinorama(onAxis, 100, 320, 1080)

    expect(result.freq).toEqual(freqs)
    expect(result.onAxis).toHaveLength(freqs.length)
    expect(result.listeningWindow).toHaveLength(freqs.length)
    expect(result.earlyReflections).toHaveLength(freqs.length)
    expect(result.soundPower).toHaveLength(freqs.length)
    expect(result.directivityIndex).toHaveLength(freqs.length)
    expect(result.predictedInRoom).toHaveLength(freqs.length)
  })

  it('calcSpinorama on-axis equals input', () => {
    const freqs = [100, 1000, 10000]
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 90,
    }))
    const result = calcSpinorama(onAxis, 100, 320, 1080)
    result.onAxis.forEach((v) => expect(v).toBeCloseTo(90, 5))
  })

  it('calcSpinorama sound power <= on-axis', () => {
    const freqs = [100, 1000, 5000, 10000]
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 90,
    }))
    const result = calcSpinorama(onAxis, 150, 320, 1080)
    result.soundPower.forEach((v, i) => {
      expect(v).toBeLessThanOrEqual(result.onAxis[i]! + 0.1)
    })
  })

  it('calcPolar returns grid data', () => {
    const freqs = generateFrequencies(100, 10000, 6)
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: 90,
    }))
    const angles = [-90, -45, 0, 45, 90]
    const polarFreqs = [100, 1000, 10000]
    const result = calcPolar(onAxis, angles, 100, polarFreqs)

    expect(result.angles).toEqual(angles)
    expect(result.frequencies).toEqual(polarFreqs)
    expect(result.data).toHaveLength(polarFreqs.length)
    expect(result.data[0]).toHaveLength(angles.length)
  })
})
