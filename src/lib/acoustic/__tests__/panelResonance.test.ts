import { describe, it, expect } from 'vitest'
import {
  PANEL_MATERIALS,
  panelFundamental,
  effectiveLossFactor,
  panelQ,
  panelDecayMs,
  standingWave,
  evaluatePanel,
  cabinetBoardCost,
} from '@/lib/acoustic/panelResonance'

const mdf = PANEL_MATERIALS.mdf
const ply = PANEL_MATERIALS.birch_ply
const pine = PANEL_MATERIALS.pine

// mk3 side panel free span: depth 420mm x height 1180mm
const A = 420
const B = 1180

describe('panelFundamental', () => {
  it('rises with thickness (t^3 stiffness)', () => {
    const f12 = panelFundamental(mdf, 12, A, B)
    const f25 = panelFundamental(mdf, 25, A, B)
    expect(f25).toBeGreaterThan(f12)
    // Doubling-ish thickness roughly doubles frequency (f ~ t)
    expect(f25 / f12).toBeGreaterThan(1.8)
  })

  it('MDF 18mm side panel lands in the low hundreds of Hz', () => {
    const f = panelFundamental(mdf, 18, A, B)
    expect(f).toBeGreaterThan(110)
    expect(f).toBeLessThan(160)
  })

  it('plywood is much stiffer than MDF at equal thickness', () => {
    const fMdf = panelFundamental(mdf, 22, A, B)
    const fPly = panelFundamental(ply, 22, A, B)
    // ~5x stiffness -> ~1.7x frequency
    expect(fPly / fMdf).toBeGreaterThan(1.5)
  })

  it('pine beats MDF on frequency AND is lighter', () => {
    const fMdf = panelFundamental(mdf, 22, A, B)
    const fPine = panelFundamental(pine, 22, A, B)
    expect(fPine).toBeGreaterThan(fMdf)
  })

  it('shorter free span (from bracing) raises frequency', () => {
    const full = panelFundamental(ply, 22, A, B)
    const twoFields = panelFundamental(ply, 22, A, B / 2)
    const threeFields = panelFundamental(ply, 22, A, B / 3)
    expect(twoFields).toBeGreaterThan(full)
    expect(threeFields).toBeGreaterThan(twoFields)
  })
})

describe('damping', () => {
  it('bitumen and CLD raise the loss factor above bare', () => {
    const bare = effectiveLossFactor(ply, 'none')
    const bit = effectiveLossFactor(ply, 'bitumen')
    const cld = effectiveLossFactor(ply, 'cld')
    expect(bit).toBeGreaterThan(bare)
    expect(cld).toBeGreaterThan(bit)
  })

  it('Q is the inverse of loss factor', () => {
    expect(panelQ(0.02)).toBeCloseTo(50, 5)
    expect(panelQ(0.15)).toBeCloseTo(6.667, 2)
  })

  it('higher damping shortens decay time', () => {
    const f = 289
    const bare = panelDecayMs(f, effectiveLossFactor(ply, 'none'))
    const cld = panelDecayMs(f, effectiveLossFactor(ply, 'cld'))
    expect(cld).toBeLessThan(bare)
    // CLD should cut ringing by roughly an order of magnitude
    expect(bare / cld).toBeGreaterThan(5)
  })

  it('damping does NOT change the resonance frequency', () => {
    // frequency depends only on geometry+material stiffness, not treatment
    const f = panelFundamental(ply, 22, A, B)
    // evaluate with two treatments, frequency must be identical
    const bare = evaluatePanel({
      material: ply, thickness_mm: 22, spanA_mm: A, spanB_mm: B, braces: 0, treatment: 'none',
    })
    const cld = evaluatePanel({
      material: ply, thickness_mm: 22, spanA_mm: A, spanB_mm: B, braces: 0, treatment: 'cld',
    })
    expect(bare.fundamentalHz).toBeCloseTo(f, 5)
    expect(cld.fundamentalHz).toBeCloseTo(f, 5)
    expect(cld.decayMs).toBeLessThan(bare.decayMs)
  })
})

describe('standingWave', () => {
  it('55cm chamber -> ~312 Hz', () => {
    expect(standingWave(550)).toBeCloseTo(311.8, 0)
  })
  it('is independent of any wall property (pure air dimension)', () => {
    expect(standingWave(420)).toBeCloseTo(408.3, 0)
  })
})

describe('evaluatePanel', () => {
  it('bracing turns a poor panel into a good one', () => {
    const undivided = evaluatePanel({
      material: ply, thickness_mm: 15, spanA_mm: A, spanB_mm: B, braces: 0, treatment: 'none',
    })
    const braced = evaluatePanel({
      material: ply, thickness_mm: 15, spanA_mm: A, spanB_mm: B, braces: 3, treatment: 'none',
    })
    expect(braced.fundamentalHz).toBeGreaterThan(undivided.fundamentalHz)
    expect(braced.fieldHeight_mm).toBeCloseTo(B / 4, 5)
  })

  it('driver-bearing panel is held to a stricter floor', () => {
    // same physical panel: ~375 Hz clears the plain floor (300) comfortably
    // but sits just under the driver-bearing floor (380).
    const common = { material: ply, thickness_mm: 15, spanA_mm: A, spanB_mm: B, braces: 2, treatment: 'none' as const }
    const plain = evaluatePanel({ ...common, driverBearing: false })
    const bearing = evaluatePanel({ ...common, driverBearing: true })
    expect(bearing.fundamentalHz).toBeCloseTo(plain.fundamentalHz, 5)
    expect(plain.verdict).toBe('good')
    expect(bearing.verdict).not.toBe('good')
  })

  it('warns when a thin panel carries a driver', () => {
    const r = evaluatePanel({
      material: ply, thickness_mm: 12, spanA_mm: A, spanB_mm: B, braces: 3, treatment: 'none', driverBearing: true,
    })
    expect(r.note.toLowerCase()).toContain('bærer')
  })
})

describe('cabinetBoardCost', () => {
  it('cost scales with thickness', () => {
    const base = { material: ply, width_mm: 300, height_mm: 1180, depth_mm: 420, braces: 2 }
    const c15 = cabinetBoardCost({ ...base, thickness_mm: 15 })
    const c22 = cabinetBoardCost({ ...base, thickness_mm: 22 })
    expect(c22.boardCostDkk).toBeGreaterThan(c15.boardCostDkk)
  })

  it('thinner walls with more braces cost less than thick walls', () => {
    const thick = cabinetBoardCost({ material: ply, thickness_mm: 22, width_mm: 300, height_mm: 1180, depth_mm: 420, braces: 2 })
    const thin = cabinetBoardCost({ material: ply, thickness_mm: 15, width_mm: 300, height_mm: 1180, depth_mm: 420, braces: 3 })
    expect(thin.boardCostDkk).toBeLessThan(thick.boardCostDkk)
    // meaningful saving, not marginal
    expect(thin.boardCostDkk / thick.boardCostDkk).toBeLessThan(0.85)
  })

  it('reports positive areas and mass', () => {
    const c = cabinetBoardCost({ material: ply, thickness_mm: 22, width_mm: 300, height_mm: 1180, depth_mm: 420, braces: 2 })
    expect(c.wallAreaM2).toBeGreaterThan(1.5)
    expect(c.totalAreaM2).toBeGreaterThan(c.wallAreaM2)
    expect(c.wallMassKg).toBeGreaterThan(0)
  })
})
