import { describe, it, expect } from 'vitest'
import {
  projectValue, generateProjection, getBreakInState, pctComplete,
  W18_BREAKIN, GRS_BREAKIN, autoFitBreakIn, fitExponentialDecay,
  projectMilestones,
} from '../breakin'

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

  it('auto-fits scenarios when 2+ measurements exist (default behavior)', () => {
    const state = getBreakInState('seed-scanspeak-18w-4424g00')
    expect(state).not.toBeNull()
    // Should have auto-fitted since there are 2 measurements
    expect(state!.scenarios[0].label).toBe('Auto-fit (bedste)')
    expect(state!.scenarios[1].label).toContain('Usikkerhed')
    // Fs final should be between latest (64.53) and spec (49)
    expect(state!.scenarios[0].fsFinal).toBeGreaterThan(49)
    expect(state!.scenarios[0].fsFinal).toBeLessThan(69.41)
  })

  it('returns hand-tuned scenarios when autoFit=false', () => {
    const state = getBreakInState('seed-scanspeak-18w-4424g00', false)
    expect(state).not.toBeNull()
    expect(state!.scenarios[0].label).toBe('Optimistisk')
  })
})

describe('W18_BREAKIN data integrity', () => {
  it('has 2 measurements (0h and 5h)', () => {
    expect(W18_BREAKIN.measurements.length).toBe(2)
    expect(W18_BREAKIN.measurements[0].hours).toBe(0)
    expect(W18_BREAKIN.measurements[1].hours).toBe(5)
  })

  it('has recommended schedule', () => {
    expect(W18_BREAKIN.recommendedSchedule.length).toBeGreaterThanOrEqual(4)
    expect(W18_BREAKIN.recommendedSchedule[0].hours).toBe(10)
  })
})

describe('GRS_BREAKIN data integrity', () => {
  it('has 3 measurements (0h, 5h and 10h)', () => {
      expect(GRS_BREAKIN.measurements.length).toBe(3)
      expect(GRS_BREAKIN.measurements[0].hours).toBe(0)
      expect(GRS_BREAKIN.measurements[1].hours).toBe(5)
      expect(GRS_BREAKIN.measurements[2].hours).toBe(10)
    })

  it('has GRS-specific params (Fs 22, Qts 0.43 spec)', () => {
    expect(GRS_BREAKIN.spec.fs).toBe(22)
    expect(GRS_BREAKIN.spec.qts).toBe(0.43)
  })
})

// =============================================================================
// Auto-fit tests
// =============================================================================

describe('fitExponentialDecay', () => {
  it('returns null with less than 2 points', () => {
    const result = fitExponentialDecay([{ t: 0, x: 70 }], 70, 50, true)
    expect(result).toBeNull()
  })

  it('returns null with only t=0 points', () => {
    const result = fitExponentialDecay([{ t: 0, x: 70 }, { t: 0, x: 69 }], 70, 50, true)
    expect(result).toBeNull()
  })

  it('fits exponential decay to synthetic data', () => {
    // Generate data from a known curve: X(t) = 50 + (70 - 50) * exp(-t/10)
    const x0 = 70, xFinal = 50, tau = 10
    const data = [0, 5, 10, 20, 30].map(t => ({
      t,
      x: xFinal + (x0 - xFinal) * Math.exp(-t / tau),
    }))
    // Add the initial point
    const points: { t: number; x: number }[] = data

    const result = fitExponentialDecay(points, x0, 50, true)
    expect(result).not.toBeNull()
    // Should recover tau ~10 and xFinal ~50 (within grid resolution ±0.25/±grid)
    expect(result!.tau).toBeCloseTo(tau, 0)
    expect(result!.xFinal).toBeCloseTo(xFinal, 0)
  })

  it('handles partial data (early stage)', () => {
    // Only 0h and 5h data — should still produce a reasonable estimate
    const x0 = 69.41
    const data = [
      { t: 0, x: x0 },
      { t: 5, x: 64.53 },
    ]
    const result = fitExponentialDecay(data, x0, 49, true)
    expect(result).not.toBeNull()
    expect(result!.tau).toBeGreaterThan(0)
    // xFinal should be below the 5h measurement
    expect(result!.xFinal).toBeLessThan(64.53)
    // xFinal should be above spec (early data won't extrapolate all the way)
    expect(result!.xFinal).toBeGreaterThan(49)
  })
})

describe('autoFitBreakIn', () => {
  it('returns null with 0-1 measurements', () => {
    const state = JSON.parse(JSON.stringify(W18_BREAKIN))
    state.measurements = [{ hours: 0, fs: 69.41, qts: 0.598 }]
    expect(autoFitBreakIn(state)).toBeNull()
  })

  it('returns fitted scenarios with 2 measurements', () => {
    const state = JSON.parse(JSON.stringify(W18_BREAKIN))
    const result = autoFitBreakIn(state)
    expect(result).not.toBeNull()
    expect(result!.scenarios.length).toBe(2)
    expect(result!.scenarios[0].label).toBe('Auto-fit (bedste)')
    expect(result!.scenarios[1].label).toContain('Usikkerhed')
    // Fit quality should be present
    expect(result!.fitQuality.rmseFs).toBeGreaterThanOrEqual(0)
    expect(result!.fitQuality.rSquaredFs).toBeGreaterThanOrEqual(0)
  })

  it('improves fit quality with more measurements', () => {
    const state = JSON.parse(JSON.stringify(W18_BREAKIN))
    // Add simulated 10h measurement
    state.measurements.push({ hours: 10, fs: 61.0, qts: 0.55 })
    const result = autoFitBreakIn(state)
    expect(result).not.toBeNull()
    // RMSE should be reasonable
    expect(result!.fitQuality.rmseFs).toBeLessThan(5)
    expect(result!.fitQuality.rSquaredFs).toBeGreaterThan(0.8)
  })

  it('fits GRS data correctly (fast decay)', () => {
    const state = JSON.parse(JSON.stringify(GRS_BREAKIN))
    const result = autoFitBreakIn(state)
    expect(result).not.toBeNull()
    // GRS should have faster tau than 18W
    expect(result!.scenarios[0].tauFs).toBeLessThan(10)
    // GRS is close to spec, so xFinal should be near spec
    expect(result!.scenarios[0].fsFinal).toBeLessThan(25)
  })

  it('returns sensible uncertainty corridor widths', () => {
    const state = JSON.parse(JSON.stringify(W18_BREAKIN))
    const result = autoFitBreakIn(state)
    expect(result).not.toBeNull()
    const best = result!.scenarios[0]
    const uncertain = result!.scenarios[1]
    // Uncertainty should be wider (slower tau)
    expect(uncertain.tauFs).toBeGreaterThan(best.tauFs)
    // Uncertainty xFinal should be further from spec
    expect(uncertain.fsFinal).toBeGreaterThan(best.fsFinal)
  })

  describe('projectMilestones edge cases', () => {
    it('returns empty array for empty scenarios', () => {
      const result = projectMilestones(
        [{ hours: 0, fs: 70, qts: 0.6 }],
        [],
        [5, 10]
      )
      expect(result).toEqual([])
    })

    it('handles single scenario without crash', () => {
      const result = projectMilestones(
        [{ hours: 0, fs: 70, qts: 0.6 }],
        [{ label: 'Only', tauFs: 10, tauQts: 10, fsFinal: 55, qtsFinal: 0.45 }],
        [5, 10]
      )
      expect(result.length).toBe(2)
      // With single scenario, avg = scenario value (not halved)
      expect(result[0].fs).toBeGreaterThan(55)
      expect(result[0].fs).toBeLessThan(70)
    })
  })
})

describe('non-monotonic data fitting', () => {
  // GRS 12SW Qts: 0.512 → 0.442 → 0.462 (dropped then bounced back)
  const nonMonotonicQts = [
    { t: 0, x: 0.512 },
    { t: 5, x: 0.442 },
    { t: 10, x: 0.462 },
  ]

  it('detects non-monotonic data and returns flag', () => {
    const fit = fitExponentialDecay(nonMonotonicQts, 0.512, 0.43, true)
    expect(fit).not.toBeNull()
    expect(fit!.nonMonotonic).toBe(true)
  })

  it('does not degenerate to tau≈0 for non-monotonic data', () => {
    const fit = fitExponentialDecay(nonMonotonicQts, 0.512, 0.43, true)
    // Old behavior gave tau=0.5h (instant settle). The fix should give
    // a tau that reflects the overall trend, at least 1h.
    expect(fit!.tau).toBeGreaterThan(1.0)
  })

  it('anchors xFinal near the latest measurement, not below it', () => {
    const fit = fitExponentialDecay(nonMonotonicQts, 0.512, 0.43, true)
    // xFinal should be between spec (0.43) and latest (0.462)
    expect(fit!.xFinal).toBeGreaterThanOrEqual(0.43)
    expect(fit!.xFinal).toBeLessThanOrEqual(0.462)
  })

  it('projection shows a gradual curve, not instant drop', () => {
    const fit = fitExponentialDecay(nonMonotonicQts, 0.512, 0.43, true)
    const at5h = projectValue(0.512, fit!.xFinal, fit!.tau, 5)
    const at10h = projectValue(0.512, fit!.xFinal, fit!.tau, 10)
    // At 5h, Qts should be meaningfully below initial (not already at final)
    expect(at5h).toBeLessThan(0.512)
    expect(at5h).toBeGreaterThan(fit!.xFinal)
    // At 10h, should be very close to final
    expect(Math.abs(at10h - fit!.xFinal)).toBeLessThan(0.01)
  })

  it('monotonic data does not trigger non-monotonic path', () => {
    const monotonic = [
      { t: 0, x: 70 },
      { t: 5, x: 65 },
      { t: 10, x: 62 },
    ]
    const fit = fitExponentialDecay(monotonic, 70, 50, true)
    expect(fit).not.toBeNull()
    expect(fit!.nonMonotonic).toBe(false)
  })

  it('autoFitBreakIn labels uncertainty as non-monotonic for GRS', () => {
    const state = JSON.parse(JSON.stringify(GRS_BREAKIN))
    const result = autoFitBreakIn(state)
    expect(result).not.toBeNull()
    expect(result!.scenarios[1].label).toContain('non-monotonisk')
    // Uncertainty corridor should be wider than best-fit
    expect(result!.scenarios[1].tauQts).toBeGreaterThan(result!.scenarios[0].tauQts)
  })
})