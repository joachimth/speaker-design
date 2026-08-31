import { describe, it, expect } from 'vitest'
import {
  CABINET_PRESETS,
  calcPortTuning,
  calcPortLengthForTuning,
  scoreWooferForCabinet,
  scoreTweeterForCabinet,
  recommendSystemForCabinet,
  buildMiniDspConfig,
  type CabinetSpec,
} from '../cabinetMatch'
import { calcInternalVolume } from '../thieleSmall'
import { SEED_DRIVERS } from '@/data/seedDrivers'
import { suggestCrossover } from '../autoDesign'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const KUDOS_X2 = CABINET_PRESETS.find((p) => p.name === 'Kudos X2')!.spec

const SMALL_SEALED: CabinetSpec = {
  name: 'Small Sealed',
  height: 300,
  width: 180,
  depth: 250,
  wallThickness: 18,
  portDiameter: 0,
  portLength: 0,
  numPorts: 1,
  portPosition: 'front',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calcPortTuning', () => {
  it('calculates tuning frequency from port dimensions', () => {
    const vb = calcInternalVolume(KUDOS_X2.width, KUDOS_X2.height, KUDOS_X2.depth, KUDOS_X2.wallThickness)
    const fb = calcPortTuning(70, 250, 1, vb)
    // Kudos X2: ~17.5L internal, port Ø70 × 250mm
    // Expected: roughly 40-55 Hz range
    expect(fb).toBeGreaterThan(30)
    expect(fb).toBeLessThan(70)
  })

  it('returns higher tuning for shorter port', () => {
    const vb = 20
    const fbShort = calcPortTuning(60, 100, 1, vb)
    const fbLong = calcPortTuning(60, 300, 1, vb)
    expect(fbShort).toBeGreaterThan(fbLong)
  })

  it('returns higher tuning for larger diameter', () => {
    const vb = 20
    const fbSmall = calcPortTuning(50, 200, 1, vb)
    const fbLarge = calcPortTuning(100, 200, 1, vb)
    expect(fbLarge).toBeGreaterThan(fbSmall)
  })

  it('handles multiple ports', () => {
    const vb = 20
    const fb1 = calcPortTuning(60, 200, 1, vb)
    const fb2 = calcPortTuning(60, 200, 2, vb)
    // More ports = more area = higher tuning for same length
    expect(fb2).toBeGreaterThan(fb1)
  })
})

describe('calcPortLengthForTuning', () => {
  it('returns a positive port length', () => {
    const len = calcPortLengthForTuning(60, 1, 20, 40)
    expect(len).toBeGreaterThan(0)
  })

  it('returns longer port for lower tuning', () => {
    const lenHigh = calcPortLengthForTuning(60, 1, 20, 50)
    const lenLow = calcPortLengthForTuning(60, 1, 20, 30)
    expect(lenLow).toBeGreaterThan(lenHigh)
  })
})

describe('scoreWooferForCabinet', () => {
  it('scores a small woofer for a small cabinet', () => {
    const woofer = SEED_DRIVERS.find((d) => d.type === 'woofer' || d.type === 'midrange')!
    const vb = calcInternalVolume(SMALL_SEALED.width, SMALL_SEALED.height, SMALL_SEALED.depth, SMALL_SEALED.wallThickness)
    const score = scoreWooferForCabinet(woofer, SMALL_SEALED, vb)
    expect(score.overallScore).toBeGreaterThanOrEqual(0)
    expect(score.overallScore).toBeLessThanOrEqual(100)
    expect(score.reasons.length).toBeGreaterThan(0)
  })

  it('flags physical misfit for oversized driver', () => {
    // Find a large woofer
    const largeWoofer = SEED_DRIVERS.find((d) => d.dimensions?.overallDiameter && d.dimensions.overallDiameter > 300)
    if (largeWoofer) {
      const vb = calcInternalVolume(SMALL_SEALED.width, SMALL_SEALED.height, SMALL_SEALED.depth, SMALL_SEALED.wallThickness)
      const score = scoreWooferForCabinet(largeWoofer, SMALL_SEALED, vb)
      expect(score.physicalFit).toBe(false)
      expect(score.warnings.length).toBeGreaterThan(0)
    }
  })

  it('produces sealed and ported Vb estimates when T/S params available', () => {
    const woofer = SEED_DRIVERS.find((d) => d.tsParams.vas && d.tsParams.qts)!
    const vb = calcInternalVolume(SMALL_SEALED.width, SMALL_SEALED.height, SMALL_SEALED.depth, SMALL_SEALED.wallThickness)
    const score = scoreWooferForCabinet(woofer, SMALL_SEALED, vb)
    expect(score.sealedVb).toBeDefined()
    expect(score.portedVb).toBeDefined()
  })
})

describe('scoreTweeterForCabinet', () => {
  it('scores a tweeter for a cabinet with crossover frequency', () => {
    const tweeter = SEED_DRIVERS.find((d) => d.type === 'tweeter')!
    const score = scoreTweeterForCabinet(tweeter, KUDOS_X2, 2000)
    expect(score.overallScore).toBeGreaterThanOrEqual(0)
    expect(score.overallScore).toBeLessThanOrEqual(100)
  })

  it('warns when crossover is below tweeter Fs', () => {
    const tweeter = SEED_DRIVERS.find((d) => d.type === 'tweeter')!
    const lowXo = Math.round(tweeter.tsParams.fs * 0.5)
    const score = scoreTweeterForCabinet(tweeter, KUDOS_X2, lowXo)
    expect(score.warnings.length).toBeGreaterThan(0)
    expect(score.qtsScore).toBeLessThan(0.5)
  })
})

describe('recommendSystemForCabinet', () => {
  it('recommends a 2-way system for Kudos X2', () => {
    const rec = recommendSystemForCabinet(SEED_DRIVERS, KUDOS_X2, 2)
    expect(rec.cabinet.name).toBe('Kudos X2')
    expect(rec.internalVolume).toBeGreaterThan(0)
    expect(rec.wooferScore.driver).toBeDefined()
    expect(rec.tweeterScore.driver).toBeDefined()
    expect(rec.crossover.bands.length).toBe(2)
    expect(rec.miniDspConfig.outputs.length).toBe(2)
    expect(rec.reasoning.length).toBeGreaterThan(3)
  })

  it('produces MiniDSP config with crossover, delay, gain, and PEQ', () => {
    const rec = recommendSystemForCabinet(SEED_DRIVERS, KUDOS_X2, 2)
    const wooferOut = rec.miniDspConfig.outputs.find((o) => o.role === 'woofer')!
    expect(wooferOut).toBeDefined()
    expect(wooferOut.lowpassFreq).toBeGreaterThan(0)
    expect(wooferOut.delay).toBeGreaterThanOrEqual(0)
    // Baffle step compensation PEQ should be present
    expect(wooferOut.peq.length).toBeGreaterThan(0)
    const hasLowShelf = wooferOut.peq.some((p) => p.type === 'low_shelf')
    expect(hasLowShelf).toBe(true)

    const tweeterOut = rec.miniDspConfig.outputs.find((o) => o.role === 'tweeter')!
    expect(tweeterOut).toBeDefined()
    expect(tweeterOut.highpassFreq).toBeGreaterThan(0)
  })

  it('estimates port tuning for ported cabinets', () => {
    const rec = recommendSystemForCabinet(SEED_DRIVERS, KUDOS_X2, 2)
    const portLine = rec.reasoning.find((r) => r.includes('Port tuning'))
    expect(portLine).toBeDefined()
  })

  it('handles sealed cabinets without port', () => {
    const rec = recommendSystemForCabinet(SEED_DRIVERS, SMALL_SEALED, 2)
    expect(rec.reasoning.some((r) => r.includes('Lukket kabinet'))).toBe(true)
  })

  it('can recommend 3-way systems', () => {
    const rec = recommendSystemForCabinet(SEED_DRIVERS, KUDOS_X2, 3)
    expect(rec.ways).toBe(3)
    // May or may not find a midrange, but should not crash
    expect(rec.crossover.bands.length).toBeGreaterThanOrEqual(2)
  })
})

describe('buildMiniDspConfig', () => {
  it('builds config from crossover suggestion', () => {
    const woofer = SEED_DRIVERS.find((d) => d.type === 'woofer' || d.type === 'midrange')!
    const tweeter = SEED_DRIVERS.find((d) => d.type === 'tweeter')!
    const xo = suggestCrossover([woofer, tweeter], 2)
    const config = buildMiniDspConfig(xo, KUDOS_X2, [woofer, tweeter])

    expect(config.plugin).toBe('2way Advanced')
    expect(config.sampleRate).toBe(48)
    expect(config.outputs.length).toBe(2)
    expect(config.inputGain).toBe(-4)
  })

  it('assigns correct output labels', () => {
    const woofer = SEED_DRIVERS.find((d) => d.type === 'woofer')!
    const tweeter = SEED_DRIVERS.find((d) => d.type === 'tweeter')!
    const xo = suggestCrossover([woofer, tweeter], 2)
    const config = buildMiniDspConfig(xo, KUDOS_X2, [woofer, tweeter])

    expect(config.outputs[0]!.label).toBe('Output A')
    expect(config.outputs[1]!.label).toBe('Output B')
  })
})

describe('CABINET_PRESETS', () => {
  it('includes Kudos X2 preset', () => {
    const kudos = CABINET_PRESETS.find((p) => p.name === 'Kudos X2')
    expect(kudos).toBeDefined()
    expect(kudos!.spec.height).toBe(720)
    expect(kudos!.spec.width).toBe(165)
    expect(kudos!.spec.depth).toBe(205)
    expect(kudos!.spec.portDiameter).toBe(70)
    expect(kudos!.spec.portLength).toBe(250)
  })

  it('includes Custom preset', () => {
    expect(CABINET_PRESETS.find((p) => p.name === 'Custom')).toBeDefined()
  })
})
