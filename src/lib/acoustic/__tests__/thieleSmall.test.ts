import { describe, it, expect } from 'vitest'
import {
  calcSealed,
  calcPorted,
  calcPort,
  calcTransmissionLine,
  recommendCabinetType,
  calcInternalVolume,
  generateFrequencies,
  calcMaxSpl,
} from '@/lib/acoustic/thieleSmall'
import type { ThieleSmallParams } from '@/types'

// Test driver: typical 8" woofer
const testDriver: ThieleSmallParams = {
  fs: 32,
  re: 5.8,
  qms: 6.5,
  qes: 0.42,
  qts: 0.39,
  vas: 52,
  sensitivity: 85.5,
  xmax: 7.0,
  sd: 208,
  imp: 8,
}

describe('Thiele-Small calculations', () => {
  it('calcSealed produces valid alignment for Qtc 0.707', () => {
    const result = calcSealed(testDriver, 0.707)
    expect(result.qtc).toBe(0.707)
    expect(result.vb).toBeGreaterThan(0)
    expect(result.fc).toBeGreaterThan(testDriver.fs) // Fc > Fs for sealed
    expect(result.f3).toBeGreaterThan(0)
  })

  it('calcSealed Qtc 1.0 gives smaller volume than 0.707', () => {
    const r0707 = calcSealed(testDriver, 0.707)
    const r10 = calcSealed(testDriver, 1.0)
    expect(r10.vb).toBeLessThan(r0707.vb) // Higher Qtc = smaller box
  })

  it('calcPorted produces valid alignment', () => {
    const result = calcPorted(testDriver)
    expect(result.vb).toBeGreaterThan(0)
    expect(result.fb).toBeGreaterThan(0)
    expect(result.f3).toBeGreaterThan(0)
    expect(result.alignmentType).toBeDefined()
  })

  it('calcPort calculates port length', () => {
    const result = calcPort(50, 35, 60, 1)
    expect(result.portLength).toBeGreaterThan(0)
    expect(result.portDiameter).toBe(60)
  })

  it('calcTransmissionLine calculates line length', () => {
    const result = calcTransmissionLine(testDriver)
    expect(result.lineLength).toBeGreaterThan(0)
    expect(result.lineArea).toBeGreaterThan(0)
    // Quarter wavelength of 32Hz: 343000/(4*32) = 2680mm, reduced by stuffing
    expect(result.lineLength).toBeLessThan(2700)
    expect(result.lineLength).toBeGreaterThan(2000)
  })

  it('recommendCabinetType recommends ported for low Qts', () => {
    const lowQts = { ...testDriver, qts: 0.25 }
    const rec = recommendCabinetType(lowQts)
    expect(rec.recommended).toBe('ported')
  })

  it('recommendCabinetType recommends sealed for high Qts', () => {
    const highQts = { ...testDriver, qts: 0.7 }
    const rec = recommendCabinetType(highQts)
    expect(rec.recommended).toBe('sealed')
  })

  it('calcInternalVolume calculates correctly', () => {
    // 320x1080x370 with 22mm walls, 85% bracing factor
    const vol = calcInternalVolume(320, 1080, 370, 22, 0.85)
    // Internal: 276x1036x326 = 93,124,416 mm³ * 0.85 = 79,155,754 mm³ = 79.2 L
    expect(vol).toBeGreaterThan(70)
    expect(vol).toBeLessThan(90)
  })

  it('generateFrequencies produces log-spaced array', () => {
    const freqs = generateFrequencies(20, 20000, 12)
    expect(freqs[0]).toBe(20)
    expect(freqs[freqs.length - 1]).toBeLessThanOrEqual(20000)
    // 10 octaves * 12 points = ~120 points
    expect(freqs.length).toBeGreaterThan(100)
  })

  it('calcMaxSpl adds power gain to sensitivity', () => {
    const spl = calcMaxSpl(testDriver, 100)
    // 85.5 + 10*log10(100) = 85.5 + 20 = 105.5
    expect(spl).toBeCloseTo(105.5, 0)
  })
})
