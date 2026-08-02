/**
 * Mk3 Reference Loudspeaker — 18W/4424G00 & GRS 12SW-4HE Break-in Projection
 * =========================================================================
 * Ported from simulations/breakin_projection.py and DATS measurements.
 *
 * Models exponential-decay break-in curves using measured DATS data.
 * Predicts Fs(t), Qts(t) and recommends re-measure schedule.
 *
 * v2 — Added auto-fit from measurement data (nonlinear least-squares
 * approximation). Scenarios now calibrate themselves to available data
 * instead of relying on hand-tuned tau values.
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

/** Fit quality metrics for the current curve-fit */
export interface FitQuality {
  /** Root-mean-square error of Fs residuals [Hz] */
  rmseFs: number
  /** Root-mean-square error of Qts residuals */
  rmseQts: number
  /** R² for Fs fit (1 = perfect, <0 = worse than horizontal line) */
  rSquaredFs: number
  /** R² for Qts fit */
  rSquaredQts: number
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
  // Default scenarios are fallbacks used when no measurements exist (or
  // only the initial measurement). They are replaced by auto-fit once
  // 2+ measurements are available — call autoFitBreakIn().
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
const GRS_10H: BreakInPoint = { hours: 10, fs: 23.25, qts: 0.462 }
const GRS_SPEC = { fs: 22.0, qts: 0.43 }

export const GRS_BREAKIN: BreakInState = {
  driverId: 'seed-grs-12sw-4he',
  driverLabel: 'GRS 12SW-4HE',
  spec: GRS_SPEC,
  measurements: [GRS_INITIAL, GRS_5H, GRS_10H],
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

  if (scenarios.length === 0) return []

  const refFinalFs = scenarios.length >= 2
    ? (scenarios[0].fsFinal + scenarios[1].fsFinal) / 2
    : scenarios[0].fsFinal
  const refFinalQts = scenarios.length >= 2
    ? (scenarios[0].qtsFinal + scenarios[1].qtsFinal) / 2
    : scenarios[0].qtsFinal

  return hours.map((h) => {
    const s0 = scenarios[0]
    const fsOpt = projectValue(initial.fs, s0.fsFinal, s0.tauFs, h)
    const qtsOpt = projectValue(initial.qts, s0.qtsFinal, s0.tauQts, h)

    let fsCon = fsOpt, qtsCon = qtsOpt
    if (scenarios.length >= 2) {
      const s1 = scenarios[1]
      fsCon = projectValue(initial.fs, s1.fsFinal, s1.tauFs, h)
      qtsCon = projectValue(initial.qts, s1.qtsFinal, s1.tauQts, h)
    }

    const avgFs = (fsOpt + fsCon) / 2
    const avgQts = (qtsOpt + qtsCon) / 2

    return {
      hours: h,
      fs: avgFs,
      qts: avgQts,
      fsPctOfChange: pctComplete(initial.fs, avgFs, refFinalFs),
      qtsPctOfChange: pctComplete(initial.qts, avgQts, refFinalQts),
    }
  })
}

/**
 * Get the break-in state for a driver ID, or null if not tracked.
 *
 * When 2+ measurements exist (at least one with t>0), auto-fits the
 * scenarios from measurement data. Falls back to hard-coded scenarios
 * when insufficient data.
 *
 * Pass autoFit=false when you need the raw state without modification.
 */
export function getBreakInState(driverId: string, autoFit: boolean = true): BreakInState | null {
  const states: Record<string, BreakInState> = {
    [W18_BREAKIN.driverId]: W18_BREAKIN,
    [GRS_BREAKIN.driverId]: GRS_BREAKIN,
  }
  const raw = states[driverId] ?? null
  if (!raw || !autoFit) return raw

  // Clone and auto-fit if enough data
  const state: BreakInState = JSON.parse(JSON.stringify(raw))
  const result = autoFitBreakIn(state)
  if (result) {
    state.scenarios = result.scenarios
  }
  return state
}

// =============================================================================
// Auto-fit — calibrate exponential model from measurement data
// =============================================================================

/**
 * Fit an exponential decay X(t) = xFinal + (x0 - xFinal) * exp(-t/tau)
 * to measured {(t, x)} data points using a grid search + local refinement.
 *
 * Returns { tau, xFinal } that minimizes RMSE, or null if insufficient data.
 *
 * Constraints:
 *   - tau > 0
 *   - xFinal must move toward spec direction (monotonic decay assumption)
 *   - xFinal can be above spec if data hasn't converged yet
 */
export function fitExponentialDecay(
  dataPoints: { t: number; x: number }[],
  /** The initial (t=0) value is pinned */
  x0: number,
  /** The ultimate spec target (not necessarily reachable) */
  specTarget: number,
  /** Whether this param should trend downwards (true = Fs/Qts decreasing) */
  isDescending: boolean
): { tau: number; xFinal: number } | null {
  if (dataPoints.length < 2) return null

  // If all data points are at t=0, nothing to fit
  const nonZero = dataPoints.filter(d => d.t > 0)
  if (nonZero.length === 0) return null

  // Latest measurement — bounds where xFinal should be
  const latest = nonZero[nonZero.length - 1]

  // xFinal must be on the spec side of latest (extrapolate in spec direction)
  // but not past spec unless data has already overshot
  let xFinalMin: number, xFinalMax: number
  if (isDescending) {
    // Fs and Qts decrease toward spec
    xFinalMin = Math.min(specTarget, latest.x * 0.85)
    xFinalMax = Math.max(x0 * 0.99, latest.x)
    // If latest is already below spec (overshoot), allow wide range
    if (latest.x <= specTarget) {
      xFinalMin = latest.x * 0.9
      xFinalMax = specTarget * 1.05
    }
  } else {
    // Shouldn't happen for T/S params, but handle ascending case
    xFinalMin = Math.min(x0 * 1.01, latest.x)
    xFinalMax = Math.max(specTarget, latest.x * 1.15)
  }

  // Grid search over tau
  const tauCandidates: number[] = []
  // Tau from 0.5h to 80h — covers fast (rubber surrounds) to slow (coated cones)
  for (let tau = 0.5; tau <= 80; tau += 0.25) {
    tauCandidates.push(tau)
  }

  let bestRMSE = Infinity
  let bestTau = 5
  let bestXFinal = specTarget

  for (const tau of tauCandidates) {
    // Binary search for best xFinal at this tau
    let lo = xFinalMin, hi = xFinalMax
    for (let iter = 0; iter < 30; iter++) {
      const m1 = lo + (hi - lo) / 3
      const m2 = hi - (hi - lo) / 3

      const rmse1 = computeRMSE(dataPoints, x0, m1, tau)
      const rmse2 = computeRMSE(dataPoints, x0, m2, tau)

      if (rmse1 < rmse2) hi = m2
      else lo = m1
    }

    const candidateFinal = (lo + hi) / 2
    const rmse = computeRMSE(dataPoints, x0, candidateFinal, tau)

    if (rmse < bestRMSE) {
      bestRMSE = rmse
      bestTau = tau
      bestXFinal = candidateFinal
    }
  }

  return { tau: bestTau, xFinal: bestXFinal }
}

/** RMSE of model prediction vs data */
function computeRMSE(
  data: { t: number; x: number }[],
  x0: number,
  xFinal: number,
  tau: number
): number {
  const n = data.length
  let sumSq = 0
  for (const d of data) {
    const predicted = projectValue(x0, xFinal, tau, d.t)
    sumSq += (predicted - d.x) ** 2
  }
  return Math.sqrt(sumSq / n)
}

/**
 * Compute R² goodness-of-fit for a model vs data.
 * 1 = perfect, 0 = same as mean, <0 = worse than mean.
 */
function rSquared(
  data: { t: number; x: number }[],
  predicted: (t: number) => number
): number {
  const n = data.length
  if (n < 2) return 0
  const mean = data.reduce((s, d) => s + d.x, 0) / n
  let ssRes = 0, ssTot = 0
  for (const d of data) {
    const resid = d.x - predicted(d.t)
    ssRes += resid * resid
    ssTot += (d.x - mean) ** 2
  }
  if (ssTot < 1e-15) return 1 // all values identical
  return 1 - ssRes / ssTot
}

/**
 * Run auto-fit on a break-in state, returning updated scenarios and fit quality.
 *
 * Returns null if there aren't enough data points to fit (need 2+ measurements,
 * at least one with t > 0).
 *
 * The auto-fit replaces the first scenario with the best-fit curve, and
 * derives a second "±uncertainty" scenario that widens the corridor
 * based on fit confidence.
 */
export function autoFitBreakIn(
  state: BreakInState
): { scenarios: BreakInScenario[]; fitQuality: FitQuality } | null {
  const measurements = state.measurements
  if (measurements.length < 2) return null

  const initial = measurements[0]
  const nonZero = measurements.filter(m => m.hours > 0)
  if (nonZero.length === 0) return null

  // Prepare data for fitting
  const fsData = measurements.map(m => ({ t: m.hours, x: m.fs }))
  const qtsData = measurements.map(m => ({ t: m.hours, x: m.qts }))

  // Fit Fs
  const fsFit = fitExponentialDecay(fsData, initial.fs, state.spec.fs, true)
  // Fit Qts
  const qtsFit = fitExponentialDecay(qtsData, initial.qts, state.spec.qts, true)

  if (!fsFit || !qtsFit) return null

  // Build the primary (best-fit) scenario
  const bestFit: BreakInScenario = {
    label: 'Auto-fit (bedste)',
    tauFs: fsFit.tau,
    tauQts: qtsFit.tau,
    fsFinal: fsFit.xFinal,
    qtsFinal: qtsFit.xFinal,
  }

  // Build uncertainty corridor scenario
  // Wider = lower confidence (few data points, early stage)
  const nPts = nonZero.length
  const uncertaintyFactor = nPts <= 1 ? 2.0 : nPts === 2 ? 1.5 : 1.2

  // Uncertainty in tau: ±50% scaled by uncertainty factor
  const tauFsWide = Math.max(0.5, fsFit.tau * uncertaintyFactor)
  const tauQtsWide = Math.max(0.5, qtsFit.tau * uncertaintyFactor)

  // For xFinal uncertainty corridor: widen away from spec (conservative).
  // For decreasing params (Fs, Qts), the uncertainty upper bound is a
  // higher xFinal (less decay) — i.e., a slower/worse break-in scenario
  // that forms the upper edge of the shaded corridor.
  const fsWider = state.spec.fs < fsFit.xFinal
    ? fsFit.xFinal + (fsFit.xFinal - state.spec.fs) * 0.5
    : fsFit.xFinal * 1.1
  const qtsWider = state.spec.qts < qtsFit.xFinal
    ? qtsFit.xFinal + (qtsFit.xFinal - state.spec.qts) * 0.5
    : qtsFit.xFinal * 1.1

  const uncertainty: BreakInScenario = {
    label: nPts <= 2 ? 'Usikkerhed (få data)' : 'Usikkerhed',
    tauFs: tauFsWide,
    tauQts: tauQtsWide,
    fsFinal: fsWider,
    qtsFinal: qtsWider,
  }

  // Compute fit quality
  const predictedFs = (t: number) => projectValue(initial.fs, fsFit.xFinal, fsFit.tau, t)
  const predictedQts = (t: number) => projectValue(initial.qts, qtsFit.xFinal, qtsFit.tau, t)

  const fitQuality: FitQuality = {
    rmseFs: computeRMSE(fsData, initial.fs, fsFit.xFinal, fsFit.tau),
    rmseQts: computeRMSE(qtsData, initial.qts, qtsFit.xFinal, qtsFit.tau),
    rSquaredFs: rSquared(fsData, predictedFs),
    rSquaredQts: rSquared(qtsData, predictedQts),
  }

  // Return both scenarios: best-fit + uncertainty corridor
  return { scenarios: [bestFit, uncertainty], fitQuality }
}
