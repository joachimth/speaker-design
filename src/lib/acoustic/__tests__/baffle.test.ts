import { describe, it, expect } from 'vitest'
import { calcBaffleStep, baffleStepFrequency, calcBaffleStepCompensation } from '@/lib/acoustic/baffle'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'

describe('Baffle step', () => {
  it('baffleStepFrequency returns reasonable value for typical baffle', () => {
    const f = baffleStepFrequency(320, 1080)
    // Average dimension = 700mm, f = c/(2*pi*700) ≈ 78 Hz
    expect(f).toBeGreaterThan(50)
    expect(f).toBeLessThan(150)
  })

  it('calcBaffleStep returns -6dB at low frequencies', () => {
    const freqs = generateFrequencies(10, 10000, 12)
    const result = calcBaffleStep(320, 1080, freqs)

    // At very low freq (10Hz), should be close to -6dB
    const lowDb = result.response[0]!
    expect(lowDb).toBeLessThan(-3)

    // At high freq (10kHz), should be close to 0dB
    const highDb = result.response[result.response.length - 1]!
    expect(highDb).toBeGreaterThan(-2)
  })

  it('calcBaffleStepCompensation provides boost at low frequencies', () => {
    const freqs = [10, 50, 100, 500, 1000, 5000]
    const fStep = 100
    const comp = calcBaffleStepCompensation(fStep, 6, freqs)

    // At 10Hz (well below fStep): close to full 6dB boost
    expect(comp[0]).toBeGreaterThan(5)

    // At 5000Hz (well above fStep): close to 0dB
    expect(comp[5]).toBeLessThan(1)
  })

  it('larger baffle has lower step frequency', () => {
    const small = baffleStepFrequency(200, 400)
    const large = baffleStepFrequency(600, 1200)
    expect(large).toBeLessThan(small)
  })
})
