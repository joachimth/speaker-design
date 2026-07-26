import { describe, it, expect } from 'vitest'
import { projectValue, generateProjection, getBreakInState, pctComplete, W18_BREAKIN, GRS_BREAKIN } from '../breakin'

describe('break-in math', () => {
  it('projectValue at t=0 returns initial value', () => {
    expect(projectValue(69.41, 57, 10, 0)).toBeCloseTo(69.41, 1)
  })

  it('projectValue approaches final value as t increases', () => {
    const v5 = projectValue(69.41, 57, 10, 5)
    const v20 = projectValue(69.41, 57, 10, 20)
    const v50 = projectValue(69.41, 57, 10, 50)
    // At 5h: should be between initial and final
    expect(v5).toBeLessThan(69.41)
    expect(v5).toBeGreaterThan(57)
    // At 20h: should be closer to final
    expect(v20).toBeLessThan(v5)
    expect(v20).toBeGreaterThan(57)
    // At 50h: essentially at final
    expect(v50).toBeCloseTo(57, 0)
  })
})

describe('generateProjection', () => {
  it('generates specified number of points', () => {
    const pts = generateProjection(69.41, 57, 10, 50, 100)
    expect(pts.length).toBe(101) // t=0 to t=50, inclusive
    expect(pts[0].t).toBe(0)
    expect(pts[100].t).toBe(50)
  })

  it('starts at initial value', () => {
    const pts = generateProjection(69.41, 57, 10, 50, 100)
    expect(pts[0].x).toBeCloseTo(69.41, 1)
  })
})

describe('pctComplete', () => {
  it('returns 0 at start', () => {
    expect(pctComplete(69.41, 69.41, 57)).toBeCloseTo(0, 0)
  })

  it('returns 100 at final', () => {
    expect(pctComplete(69.41, 57, 57)).toBeCloseTo(100, 0)
  })

  it('returns 50 at halfway', () => {
    const half = 69.41 - (69.41 - 57) / 2
    expect(pctComplete(69.41, half, 57)).toBeCloseTo(50, 0)
  })

  it('handles very small differences', () => {
    expect(pctComplete(1, 1, 1)).toBeCloseTo(100, 0)
  })
})

describe('getBreakInState', () => {
  it('returns 18W state for correct driver', () => {
    const state = getBreakInState('seed-scanspeak-18w-4424g00')
    expect(state).not.toBeNull()
    expect(state!.driverLabel).toContain('18W')
  })

  it('returns GRS state for correct driver', () => {
    const state = getBreakInState('seed-grs-12sw-4he')
    expect(state).not.toBeNull()
    expect(state!.driverLabel).toContain('12SW')
  })

  it('returns null for untracked drivers', () => {
    expect(getBreakInState('seed-dayton-rs225-8')).toBeNull()
    expect(getBreakInState('nonexistent')).toBeNull()
  })
})

describe('W18_BREAKIN data integrity', () => {
  it('has 2 measurements (0h and 5h)', () => {
    expect(W18_BREAKIN.measurements.length).toBe(2)
    expect(W18_BREAKIN.measurements[0].hours).toBe(0)
    expect(W18_BREAKIN.measurements[1].hours).toBe(5)
  })

  it('has optimistic and conservative scenarios', () => {
    expect(W18_BREAKIN.scenarios.length).toBe(2)
    expect(W18_BREAKIN.scenarios[0].label).toBe('Optimistisk')
    expect(W18_BREAKIN.scenarios[1].label).toBe('Konservativ')
  })

  it('has recommended schedule', () => {
    expect(W18_BREAKIN.recommendedSchedule.length).toBeGreaterThanOrEqual(4)
    expect(W18_BREAKIN.recommendedSchedule[0].hours).toBe(10)
  })
})

describe('GRS_BREAKIN data integrity', () => {
  it('has 2 measurements (0h and 5h)', () => {
    expect(GRS_BREAKIN.measurements.length).toBe(2)
    expect(GRS_BREAKIN.measurements[0].hours).toBe(0)
    expect(GRS_BREAKIN.measurements[1].hours).toBe(5)
  })

  it('has GRS-specific params (Fs 22, Qts 0.43 spec)', () => {
    expect(GRS_BREAKIN.spec.fs).toBe(22)
    expect(GRS_BREAKIN.spec.qts).toBe(0.43)
  })

  it('has shorter recommended schedule (already near settled)', () => {
    expect(GRS_BREAKIN.recommendedSchedule.length).toBeLessThanOrEqual(W18_BREAKIN.recommendedSchedule.length)
  })
})
