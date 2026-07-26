/**
 * BreakInChart — SVG scatter/line chart for break-in projection curves.
 *
 * Renders:
 *   - Optimistic and conservative projection curves
 *   - Measured data points (circles)
 *   - Spec reference line (dashed)
 *   - Milestone markers at 10h, 15h, 20h
 *   - Shaded uncertainty region between scenarios
 *
 * Pure SVG — no charting library dependency.
 */

import { useMemo } from 'react'
import { generateProjection } from '@/lib/acoustic/breakin'
import type { BreakInState } from '@/lib/acoustic/breakin'

// Layout constants
const MARGIN = { top: 24, right: 20, bottom: 32, left: 48 }
const CHART_W = 360
const CHART_H = 200
const W = CHART_W + MARGIN.left + MARGIN.right
const H = CHART_H + MARGIN.top + MARGIN.bottom

interface ChartProps {
  /** Scale domain */
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  /** Title / y-axis label */
  title: string
  yLabel: string
  yUnit: string
  /** Spec reference line value */
  specValue: number
  /** Projects from xInitial, falls to xFinal with tau */
  projections: {
    label: string
    color: string
    dash: string
    xInitial: number
    xFinal: number
    tau: number
  }[]
  measurements: { x: number; y: number }[]
  measurementLabels: boolean
}

function toSvgX(x: number, xMin: number, xScale: number): number {
  return MARGIN.left + (x - xMin) * xScale
}

function toSvgY(y: number, yMin: number, yScale: number): number {
  return MARGIN.top + CHART_H - (y - yMin) * yScale
}

/** 2D quadratic Bézier for smooth curves */
function bezierCurve(
  points: { x: number; y: number }[]
): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cp = { x: (prev.x + points[i].x) / 2, y: prev.y }
    d += ` Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`
  }
  return d
}

function Chart(props: ChartProps) {
  const { xMin, xMax, yMin, yMax, title, yLabel, yUnit, specValue, projections, measurements, measurementLabels } = props

  const xScale = CHART_W / (xMax - xMin)
  const yScale = CHART_H / (yMax - yMin)

  // Build SVG path data for each projection, and the shaded region
  const curves = useMemo(() => {
    return projections.map((p) => {
      const pts = generateProjection(p.xInitial, p.xFinal, p.tau, xMax, 80)
      const svgPts = pts.map((pt) => ({
        x: toSvgX(pt.t, xMin, xScale),
        y: toSvgY(pt.x, yMin, yScale),
      }))
      return { ...p, svgPts, path: bezierCurve(svgPts) }
    })
  }, [projections, xMin, xMax, yMin, yMax, xScale, yScale])

  // Shaded region between first two curves
  const shadePath = useMemo(() => {
    if (curves.length < 2) return ''
    const c0 = curves[0].svgPts
    const c1 = curves[1].svgPts
    const len = Math.min(c0.length, c1.length)
    if (len < 2) return ''
    let d = `M ${c0[0].x.toFixed(1)} ${c0[0].y.toFixed(1)}`
    for (let i = 1; i < len; i++) {
      const prev = c0[i - 1]
      const cp = { x: (prev.x + c0[i].x) / 2, y: prev.y }
      d += ` Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${c0[i].x.toFixed(1)} ${c0[i].y.toFixed(1)}`
    }
    // Back along bottom curve
    for (let i = len - 1; i >= 0; i--) {
      const prev = c1[Math.min(i + 1, len - 1)]
      const cp = { x: (prev.x + c1[i].x) / 2, y: prev.y }
      d += ` Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${c1[i].x.toFixed(1)} ${c1[i].y.toFixed(1)}`
    }
    d += ' Z'
    return d
  }, [curves])

  // Y-axis ticks (5 ticks)
  const yTicks = useMemo(() => {
    const ticks: { y: number; label: string }[] = []
    const nTicks = 5
    for (let i = 0; i < nTicks; i++) {
      const val = yMin + (yMax - yMin) * (i / (nTicks - 1))
      ticks.push({
        y: toSvgY(val, yMin, yScale),
        label: val.toFixed(val > 10 ? 1 : val > 1 ? 2 : 3),
      })
    }
    return ticks
  }, [yMin, yMax, yScale])

  // X-axis ticks
  const xTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = []
    const step = 10
    for (let v = Math.ceil(xMin / step) * step; v <= xMax; v += step) {
      ticks.push({
        x: toSvgX(v, xMin, xScale),
        label: `${v}`,
      })
    }
    return ticks
  }, [xMin, xMax, xScale])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-md"
      role="img"
      aria-label={title}
    >
      {/* Title */}
      <text x={MARGIN.left} y={14} className="text-xs font-semibold fill-gray-600 dark:fill-gray-400">
        {title}
      </text>

      {/* Y-axis label */}
      <text
        x={10}
        y={MARGIN.top + CHART_H / 2}
        textAnchor="middle"
        className="text-[10px] fill-gray-400"
        transform={`rotate(-90, 10, ${MARGIN.top + CHART_H / 2})`}
      >
        {yLabel} [{yUnit}]
      </text>

      {/* Grid lines + Y-axis labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={MARGIN.left}
            y1={t.y}
            x2={MARGIN.left + CHART_W}
            y2={t.y}
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth={i === 0 ? 0.5 : 0.5}
            strokeDasharray={i === 0 ? 'none' : '3,3'}
          />
          <text
            x={MARGIN.left - 4}
            y={t.y + 3}
            textAnchor="end"
            className="text-[10px] fill-gray-400"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={MARGIN.top + CHART_H + 14}
          textAnchor="middle"
          className="text-[10px] fill-gray-400"
        >
          {t.label}h
        </text>
      ))}

      {/* Spec reference line */}
      <line
        x1={MARGIN.left}
        y1={toSvgY(specValue, yMin, yScale)}
        x2={MARGIN.left + CHART_W}
        y2={toSvgY(specValue, yMin, yScale)}
        className="stroke-indigo-400"
        strokeWidth={1}
        strokeDasharray="5,4"
        opacity={0.7}
      />
      <text
        x={MARGIN.left + CHART_W - 4}
        y={toSvgY(specValue, yMin, yScale) - 3}
        textAnchor="end"
        className="text-[9px] fill-indigo-400"
      >
        Spec: {specValue}
      </text>

      {/* Shaded uncertainty region */}
      {shadePath && (
        <path d={shadePath} fill="#d97706" opacity={0.06} />
      )}

      {/* Projection curves */}
      {curves.map((c, i) => (
        <path
          key={i}
          d={c.path}
          fill="none"
          stroke={c.color}
          strokeWidth={2}
          strokeDasharray={c.dash}
          className="transition-opacity"
        />
      ))}

      {/* Measurement points */}
      {measurements.map((m, i) => (
        <g key={i}>
          <circle
            cx={toSvgX(m.x, xMin, xScale)}
            cy={toSvgY(m.y, yMin, yScale)}
            r={5}
            className="fill-red-500 stroke-white dark:stroke-gray-900"
            strokeWidth={2}
          />
          {measurementLabels && (
            <text
              x={toSvgX(m.x, xMin, xScale) + 7}
              y={toSvgY(m.y, yMin, yScale) - 3}
              className="text-[10px] font-semibold fill-red-600"
            >
              {m.y.toFixed(m.y > 10 ? 1 : 3)}
            </text>
          )}
        </g>
      ))}

      {/* X-axis line */}
      <line
        x1={MARGIN.left}
        y1={MARGIN.top + CHART_H}
        x2={MARGIN.left + CHART_W}
        y2={MARGIN.top + CHART_H}
        className="stroke-gray-300 dark:stroke-gray-600"
        strokeWidth={1}
      />
    </svg>
  )
}

// =============================================================================
// Break-in chart for a tracked driver
// =============================================================================

interface BreakInChartCardProps {
  state: BreakInState
}

export default function BreakInChartCard({ state }: BreakInChartCardProps) {
  const initial = state.measurements[0]
  const sc0 = state.scenarios[0]
  const sc1 = state.scenarios[1]

  // Determine y-axis ranges from measurements, spec and projections
  const fsMin = Math.min(...state.measurements.map(m => m.fs), state.spec.fs, ...state.scenarios.map(s => s.fsFinal)) * 0.92
  const fsMax = Math.max(...state.measurements.map(m => m.fs), state.spec.fs, ...state.scenarios.map(s => s.fsFinal)) * 1.08
  const qtsMin = Math.min(...state.measurements.map(m => m.qts), state.spec.qts, ...state.scenarios.map(s => s.qtsFinal)) * 0.9
  const qtsMax = Math.max(...state.measurements.map(m => m.qts), state.spec.qts, ...state.scenarios.map(s => s.qtsFinal)) * 1.1

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        {/* Fs chart */}
        <Chart
          xMin={-2}
          xMax={52}
          yMin={fsMin}
          yMax={fsMax}
          title={`${state.driverLabel} — Fs`}
          yLabel="Fs"
          yUnit="Hz"
          specValue={state.spec.fs}
          projections={[
            {
              label: sc0.label,
              color: '#059669',
              dash: 'none',
              xInitial: initial.fs,
              xFinal: sc0.fsFinal,
              tau: sc0.tauFs,
            },
            ...(sc1 ? [{
              label: sc1.label,
              color: '#d97706',
              dash: '6,4',
              xInitial: initial.fs,
              xFinal: sc1.fsFinal,
              tau: sc1.tauFs,
            }] : []),
          ]}
          measurements={state.measurements.map(m => ({ x: m.hours, y: m.fs }))}
          measurementLabels={true}
        />

        {/* Qts chart */}
        <Chart
          xMin={-2}
          xMax={52}
          yMin={qtsMin}
          yMax={qtsMax}
          title={`${state.driverLabel} — Qts`}
          yLabel="Qts"
          yUnit="—"
          specValue={state.spec.qts}
          projections={[
            {
              label: sc0.label,
              color: '#059669',
              dash: 'none',
              xInitial: initial.qts,
              xFinal: sc0.qtsFinal,
              tau: sc0.tauQts,
            },
            ...(sc1 ? [{
              label: sc1.label,
              color: '#d97706',
              dash: '6,4',
              xInitial: initial.qts,
              xFinal: sc1.qtsFinal,
              tau: sc1.tauQts,
            }] : []),
          ]}
          measurements={state.measurements.map(m => ({ x: m.hours, y: m.qts }))}
          measurementLabels={true}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center sm:justify-start mt-2 text-xs text-gray-500">
        {state.scenarios.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ backgroundColor: i === 0 ? '#059669' : '#d97706' }}
            />
            {s.label} (Fs→{s.fsFinal.toFixed(0)} Hz, Qts→{s.qtsFinal.toFixed(3)})
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Målt
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed border-indigo-400" style={{ borderStyle: 'dashed' }} />
          Spec
        </span>
      </div>
    </div>
  )
}
