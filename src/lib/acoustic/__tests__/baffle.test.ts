import { describe, it, expect } from 'vitest'
import { calcBaffleStep, baffleStepFrequency, calcBaffleStepCompensation } from '@/lib/acoustic/baffle'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'

describe('Baffle step', () => {
  it('baffleStepFrequency returns correct value for typical baffle', () => {
    // 320mm wide baffle → f_step = 343 / (2 * 0.32) = 535.9 Hz
    const f = baffleStepFrequency(320)
    expect(f).toBeCloseTo(535.9, 0)
  })

  it('wider baffle has lower step frequency', () => {
    const small = baffleStepFrequency(200)  // 857 Hz
    const large = baffleStepFrequency(600)  // 286 Hz
    expect(large).toBeLessThan(small)
  })

  it('calcBaffleStep returns -6dB at low frequencies', () => {
    const freqs = [10, 20, 50]
    const result = calcBaffleStep(320, 1080, freqs)

    // At very low freq (10Hz), should be very close to -6dB
    expect(result.response[0]).toBeCloseTo(-6, 1)

    // All three low values should be near -6dB
    for (const r of result.response) {
      expect(r).toBeLessThan(-5)
    }
  })

  it('calcBaffleStep returns -3dB at f_step', () => {
    const fStep = baffleStepFrequency(320)  // ~536 Hz
    const result = calcBaffleStep(320, 1080, [fStep])

    // At f_step: -6 / (1 + 1²) = -3 dB
    expect(result.response[0]).toBeCloseTo(-3, 1)
  })

  it('calcBaffleStep returns ~0dB at high frequencies', () => {
    const result = calcBaffleStep(320, 1080, [5000, 10000, 20000])

    // At 5kHz: ratio ≈ 9.3, -6/(1+87) ≈ -0.07 dB
    expect(result.response[0]).toBeGreaterThan(-0.5)
    expect(result.response[2]).toBeGreaterThan(-0.1)
  })

  it('calcBaffleStepCompensation provides boost at low frequencies', () => {
    const freqs = [10, 50, 100, 500, 1000, 5000]
    const fStep = 536
    const comp = calcBaffleStepCompensation(fStep, 6, freqs)

    // At 10Hz (well below fStep): close to full 6dB boost
    expect(comp[0]).toBeGreaterThan(5.9)

    // At 5000Hz (well above fStep): close to 0dB
    expect(comp[5]).toBeLessThan(0.5)
  })

  it('calcBaffleStepCompensation matches baffle step loss shape', () => {
    // Compensation should approximately equal -loss (inverted)
    const freqs = generateFrequencies(20, 20000, 12)
    const bs = calcBaffleStep(320, 1080, freqs)
    const comp = calcBaffleStepCompensation(
      baffleStepFrequency(320), 6, freqs
    )

    // At DC: loss ≈ -6dB, compensation ≈ +6dB
    expect(bs.response[0]).toBeCloseTo(-6, 1)
    expect(comp[0]).toBeCloseTo(6, 1)
  })

  it('returns correct freq array', () => {
    const freqs = [20, 100, 1000]
    const result = calcBaffleStep(320, 1080, freqs)
    expect(result.freq).toEqual(freqs)
  })
})
