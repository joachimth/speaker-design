import { describe, it, expect } from 'vitest'
import {
  exportBiquads,
  exportBiquadsJSON,
  exportSingleFilter,
  toQ23Hex,
} from '@/lib/acoustic/biquadExport'
import { buildCrossoverFilter } from '@/lib/acoustic/crossover'
import type { DesignState } from '@/types'

// ---------------------------------------------------------------------------
// Test design state: 2-way LR4 at 2000 Hz
// ---------------------------------------------------------------------------

const design2way: DesignState = {
  ways: 2,
  bands: [
    {
      driverId: 'seed-sb-acoustics-sb34nrx75-6',
      role: 'low',
      lowpassFreq: 2000,
      lowpassType: 'LR4',
      highpassFreq: 0,
      highpassType: 'LR4',
      gain: 0,
      polarity: 0,
      delay: 0,
    },
    {
      driverId: 'seed-sb26stac-c000-4',
      role: 'high',
      lowpassFreq: 0,
      lowpassType: 'LR4',
      highpassFreq: 2000,
      highpassType: 'LR4',
      gain: 0,
      polarity: 0,
      delay: 0,
    },
  ],
  baffleWidth: 320,
  baffleHeight: 900,
  roundoverRadius: 40,
  roomParams: {
    dimensions: { length: 6, width: 4, height: 2.7 },
    rt60: 0.4,
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
}

// ---------------------------------------------------------------------------
// Q23 hex conversion
// ---------------------------------------------------------------------------

describe('toQ23Hex', () => {
  it('converts 0 to 0x000000', () => {
    expect(toQ23Hex(0)).toBe('0x000000')
  })

  it('converts 1.0 to 0x7fffff (max positive, clamped)', () => {
    // 1.0 * 0x800000 = 0x800000 which exceeds signed max, clamps to 0x7fffff
    expect(toQ23Hex(1.0)).toBe('0x7fffff')
  })

  it('converts -1.0 to 0x800000 (wraps to unsigned)', () => {
    // -1.0 in Q23 signed = -0x800000, unsigned = 0x800000
    expect(toQ23Hex(-1.0)).toBe('0x800000')
  })

  it('converts 0.5 to 0x400000', () => {
    expect(toQ23Hex(0.5)).toBe('0x400000')
  })

  it('converts -0.5 to 0xc00000', () => {
    // -0.5 * 0x800000 = -0x400000, unsigned = 0x400000 + 0x800000 = 0xC00000
    expect(toQ23Hex(-0.5)).toBe('0xc00000')
  })

  it('clamps values above range', () => {
    expect(toQ23Hex(5.0)).toBe('0x7fffff')
  })

  it('clamps values below range', () => {
    expect(toQ23Hex(-5.0)).toBe('0x800000')
  })
})

// ---------------------------------------------------------------------------
// exportSingleFilter
// ---------------------------------------------------------------------------

describe('exportSingleFilter', () => {
  it('LR4 lowpass produces 2 biquad sections', () => {
    const { filter, sections, text } = exportSingleFilter('LR4', 2000, false, 48000)
    expect(filter.sections.length).toBe(2)
    expect(sections.length).toBe(2)
    expect(text).toContain('Section 1')
    expect(text).toContain('Section 2')
  })

  it('LR8 lowpass produces 4 biquad sections', () => {
    const { sections } = exportSingleFilter('LR8', 2000, false, 48000)
    expect(sections.length).toBe(4)
  })

  it('BW2 lowpass produces 1 biquad section', () => {
    const { sections } = exportSingleFilter('BW2', 2000, false, 48000)
    expect(sections.length).toBe(1)
  })

  it('first_order produces 1 biquad section with b2=a2=0', () => {
    const { sections } = exportSingleFilter('first_order', 2000, false, 48000)
    expect(sections.length).toBe(1)
    expect(Math.abs(sections[0]!.b2)).toBe(0)
    expect(Math.abs(sections[0]!.a2)).toBe(0)
  })

  it('MiniDSP a1/a2 are negated from internal convention', () => {
    const filter = buildCrossoverFilter('LR4', 2000, false, 48000)
    const { sections } = exportSingleFilter('LR4', 2000, false, 48000)
    // Internal a1 is negative (for lowpass), MiniDSP a1 should be positive
    expect(sections[0]!.a1).toBe(-filter.sections[0]!.a1)
    expect(sections[0]!.a2).toBe(-filter.sections[0]!.a2)
  })

  it('text output contains 5 coefficients per section', () => {
    const { text } = exportSingleFilter('LR4', 2000, false, 48000)
    const sectionLine = text.split('\n').find((l) => !l.startsWith('#') && l.includes(','))
    expect(sectionLine).toBeDefined()
    const parts = sectionLine!.split(',').map((s) => parseFloat(s.trim()))
    expect(parts.length).toBe(5)
    // All should be valid numbers
    for (const p of parts) {
      expect(isNaN(p)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// exportBiquads (full design)
// ---------------------------------------------------------------------------

describe('exportBiquads', () => {
  it('2-way LR4 produces 2 band exports (lowpass + highpass)', () => {
    const result = exportBiquads(design2way, 48000)
    expect(result.bands.length).toBe(2)
    // Low band has lowpass only
    expect(result.bands[0]!.isHighpass).toBe(false)
    expect(result.bands[0]!.label).toContain('Lowpass')
    // High band has highpass only
    expect(result.bands[1]!.isHighpass).toBe(true)
    expect(result.bands[1]!.label).toContain('Highpass')
  })

  it('each LR4 band has 2 biquad sections', () => {
    const result = exportBiquads(design2way, 48000)
    expect(result.bands[0]!.sections.length).toBe(2)
    expect(result.bands[1]!.sections.length).toBe(2)
  })

  it('text output contains sample rate and format info', () => {
    const result = exportBiquads(design2way, 48000)
    expect(result.text).toContain('48000')
    expect(result.text).toContain('b0, b1, b2, a1, a2')
    expect(result.text).toContain('Q23 hex')
  })

  it('text output contains band labels and driver IDs', () => {
    const result = exportBiquads(design2way, 48000)
    expect(result.text).toContain('Bas')
    expect(result.text).toContain('Diskant')
    expect(result.text).toContain('seed-sb-acoustics-sb34nrx75-6')
  })

  it('handles 3-way design', () => {
    const design3way: DesignState = {
      ...design2way,
      ways: 3,
      bands: [
        { driverId: 'drv1', role: 'low', lowpassFreq: 300, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
        { driverId: 'drv2', role: 'mid', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 300, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
        { driverId: 'drv3', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
      ],
    }
    const result = exportBiquads(design3way, 48000)
    // Low: 1 LP, Mid: 1 LP + 1 HP, High: 1 HP = 4 band exports
    expect(result.bands.length).toBe(4)
    // Mid band has both LP and HP
    const midLP = result.bands.find((b) => b.role === 'mid' && !b.isHighpass)!
    const midHP = result.bands.find((b) => b.role === 'mid' && b.isHighpass)!
    expect(midLP).toBeDefined()
    expect(midHP).toBeDefined()
    expect(midLP.fc).toBe(2000)
    expect(midHP.fc).toBe(300)
  })

  it('respects custom sample rate', () => {
    const result = exportBiquads(design2way, 96000)
    expect(result.sampleRate).toBe(96000)
    expect(result.text).toContain('96000')
    // Coefficients should differ from 48 kHz version
    const result48 = exportBiquads(design2way, 48000)
    expect(result.bands[0]!.sections[0]!.b0).not.toBe(result48.bands[0]!.sections[0]!.b0)
  })

  it('skips bands with no active filters', () => {
    const designNoFilter: DesignState = {
      ...design2way,
      bands: [
        { driverId: 'drv1', role: 'low', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
        { driverId: 'drv2', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
      ],
    }
    const result = exportBiquads(designNoFilter, 48000)
    expect(result.bands.length).toBe(0)
  })

  it('includes gain, polarity and delay in band export', () => {
    const designWithGain: DesignState = {
      ...design2way,
      bands: [
        { ...design2way.bands[0]!, gain: -3.5, polarity: 180, delay: 0.15 },
        { ...design2way.bands[1]!, gain: 2.0, polarity: 0, delay: 0.05 },
      ],
    }
    const result = exportBiquads(designWithGain, 48000)
    expect(result.bands[0]!.gainDb).toBe(-3.5)
    expect(result.bands[0]!.polarity).toBe(180)
    expect(result.bands[0]!.delayMs).toBe(0.15)
    expect(result.bands[1]!.gainDb).toBe(2.0)
    expect(result.text).toContain('-3.5 dB')
    expect(result.text).toContain('180°')
  })
})

// ---------------------------------------------------------------------------
// exportBiquadsJSON
// ---------------------------------------------------------------------------

describe('exportBiquadsJSON', () => {
  it('produces valid JSON with correct structure', () => {
    const json = exportBiquadsJSON(design2way, 48000)
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe('minidsp-biquad')
    expect(parsed.version).toBe(1)
    expect(parsed.sampleRate).toBe(48000)
    expect(parsed.bands.length).toBe(2)
    expect(parsed.bands[0].sections.length).toBe(2)
    expect(parsed.bands[0].sections[0].q23hex).toBeDefined()
    expect(parsed.bands[0].sections[0].q23hex.b0).toMatch(/^0x[0-9a-f]{6}$/)
  })

  it('JSON contains all 5 coefficients per section', () => {
    const json = exportBiquadsJSON(design2way, 48000)
    const parsed = JSON.parse(json)
    const sec = parsed.bands[0].sections[0]
    expect(sec).toHaveProperty('b0')
    expect(sec).toHaveProperty('b1')
    expect(sec).toHaveProperty('b2')
    expect(sec).toHaveProperty('a1')
    expect(sec).toHaveProperty('a2')
  })
})
