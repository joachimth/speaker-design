/**
 * Mk3 Reference Loudspeaker — 18W/4424G00 & GRS 12SW-4HE Break-in Projection
 * =========================================================================
 * Ported from simulations/breakin_projection.py and DATS measurements.
 *
 * Models exponential-decay break-in curves using measured DATS data.
 * Predicts Fs(t), Qts(t) and recommends re-measure schedule.
 *
 * References:
 *   - ScanSpeak 18W/4424G00 spec: Fs=49, Qts=0.38
 *   - GRS 12SW-4HE spec: Fs=22, Qts=0.43
 *   - DATS measured @0h and @5h (Jul 25-26, 2026)
 *   - Python: mk2-reference-loudspeaker/simulations/breakin_projection.py
 */

/** Single measurement point */
export interface BreakInPoint {
  hours: number
  fs: number
  qts: number
}

/** Break-in scenario parameters */
export interface BreakInScenario {
  label: string
  tauFs: number   // time constant for Fs decay [hours]
  tauQts: number  // time constant for Qts decay [hours]
  fsFinal: number  // settled Fs [Hz]
  qtsFinal: number // settled Qts
}

/** Projected value at a given time */
export interface BreakInProjection {
  hours: number
  fs: number
  qts: number
  fsPctOfChange: number   // % of total Fs change completed
  qtsPctOfChange: number  // % of total Qts change completed
}

/** Full break-in state for a driver */
export interface BreakInState {
  driverId: string
  driverLabel: string
  spec: { fs: number; qts: number }
  measurements: BreakInPoint[]
  scenarios: BreakInScenario[]
  recommendedSchedule: { hours: number; label: string }[]
}

// =============================================================================
// 18W/4424G00 — ScanSpeak Discovery 18 cm midrange
// =============================================================================

const W18_INITIAL: BreakInPoint = { hours: 0, fs: 69.41, qts: 0.598 }
const W18_5H: BreakInPoint = { hours: 5, fs: 64.53, qts: 0.576 }
const W18_SPEC = { fs: 49.0, qts: 0.38 }

export const W18_BREAKIN: BreakInState = {
  driverId: 'seed-scanspeak-18w-4424g00',
  driverLabel: 'ScanSpeak 18W/4424G00',
  spec: W18_SPEC,
  measurements: [W18_INITIAL, W18_5H],
  scenarios: [
    {
      label: 'Optimistisk',
      tauFs: 10.0,
      tauQts: 20.0,
      fsFinal: 57.0,
      qtsFinal: 0.50,
    },
    {
      label: 'Konservativ',
      tauFs: 6.8,
      tauQts: 8.2,
      fsFinal: 60.0,
      qtsFinal: 0.55,
    },
  ],
  recommendedSchedule: [
    { hours: 10, label: 'Anbefalet genmåling' },
    { hours: 15, label: 'Anbefalet genmåling' },
    { hours: 20, label: 'Sandsynligvis settled' },
    { hours: 25, label: 'Aftagende udbytte' },
  ],
}

// =============================================================================
// GRS 12SW-4HE — GRS 12" subwoofer
// =============================================================================

const GRS_INITIAL: BreakInPoint = { hours: 0, fs: 25.07, qts: 0.512 }
const GRS_5H: BreakInPoint = { hours: 5, fs: 23.52, qts: 0.442 }
const GRS_SPEC = { fs: 22.0, qts: 0.43 }

export const GRS_BREAKIN: BreakInState = {
  driverId: 'seed-grs-12sw-4he',
  driverLabel: 'GRS 12SW-4HE',
  spec: GRS_SPEC,
  measurements: [GRS_INITIAL, GRS_5H],
  scenarios: [
    {
      label: 'Optimistisk',
      tauFs: 5.0,
      tauQts: 3.0,
      fsFinal: 22.0,
      qtsFinal: 0.43,
    },
    {
      label: 'Konservativ',
      tauFs: 8.0,
      tauQts: 5.0,
      fsFinal: 23.0,
      qtsFinal: 0.44,
    },
  ],
  recommendedSchedule: [
    { hours: 10, label: 'Bekræft settled' },
  ],
}

// =============================================================================
// Math
// =============================================================================

/**
 * Project break-in value at time t using exponential decay model:
 * X(t) = X_final + (X_initial - X_final) * exp(-t / tau)
 */
export function projectValue(
  xInitial: number,
  xFinal: number,
  tau: number,
  tHours: number
): number {
  return xFinal + (xInitial - xFinal) * Math.exp(-tHours / tau)
}

/**
 * Generate projection curve as array of points from 0 to tMax hours.
 */
export function generateProjection(
  xInitial: number,
  xFinal: number,
  tau: number,
  tMax: number = 50,
  nPoints: number = 100
): { t: number; x: number }[] {
  const points: { t: number; x: number }[] = []
  for (let i = 0; i <= nPoints; i++) {
    const t = (tMax / nPoints) * i
    points.push({ t, x: projectValue(xInitial, xFinal, tau, t) })
  }
  return points
}

/**
 * Percentage of total parameter change completed at time t.
 * Returns 0-100.
 */
export function pctComplete(
  xInitial: number,
  xCurrent: number,
  xFinal: number
): number {
  const total = Math.abs(xInitial - xFinal)
  if (total < 1e-10) return 100
  const completed = Math.abs(xInitial - xCurrent)
  return Math.min(100, (completed / total) * 100)
}

/**
 * Generate projections for both scenarios at key milestones.
 */
export function projectMilestones(
  measurements: BreakInPoint[],
  scenarios: BreakInScenario[],
  hours: number[]
): BreakInProjection[] {
  const initial = measurements[0]

  return hours.map((h) => {
    // Use the most recent measurement if projecting from there
    // (in case break-in started from non-zero)
    // Actually we always project from initial (t=0) because the model
    // is fit to all data
    let fsOpt = 0, qtsOpt = 0
    let fsCon = 0, qtsCon = 0

    if (scenarios.length >= 1) {
      const s = scenarios[0]
      fsOpt = projectValue(initial.fs, s.fsFinal, s.tauFs, h)
      qtsOpt = projectValue(initial.qts, s.qtsFinal, s.tauQts, h)
    }
    if (scenarios.length >= 2) {
      const s = scenarios[1]
      fsCon = projectValue(initial.fs, s.fsFinal, s.tauFs, h)
      qtsCon = projectValue(initial.qts, s.qtsFinal, s.tauQts, h)
    }

    // For pct complete, use the average of the two scenarios
    const avgFs = (fsOpt + fsCon) / 2
    const avgQts = (qtsOpt + qtsCon) / 2

    return {
      hours: h,
      fs: avgFs,
      qts: avgQts,
      fsPctOfChange: pctComplete(initial.fs, avgFs, (scenarios[0].fsFinal + (scenarios[1]?.fsFinal ?? scenarios[0].fsFinal)) / 2),
      qtsPctOfChange: pctComplete(initial.qts, avgQts, (scenarios[0].qtsFinal + (scenarios[1]?.qtsFinal ?? scenarios[0].qtsFinal)) / 2),
    }
  })
}

/**
 * Get the break-in state for a driver ID, or null if not tracked.
 */
export function getBreakInState(driverId: string): BreakInState | null {
  const states: Record<string, BreakInState> = {
    [W18_BREAKIN.driverId]: W18_BREAKIN,
    [GRS_BREAKIN.driverId]: GRS_BREAKIN,
  }
  return states[driverId] ?? null
}
