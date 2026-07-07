// 2D/3D directivity renderings: polar diagram, frequency×angle map and an
// isometric surface. All pure SVG - no chart/3D libraries.
//
// Color encoding: level (dB rel. on-axis) is a magnitude, so it uses a single
// sequential ramp of the brand hue. The ramp is built with alpha over the card
// surface, which keeps it light→dark in light mode and dark→light in dark mode
// without theme-specific code. Frequency (ordered) is encoded the same way in
// the polar diagram via fixed brand-scale stroke classes.

import type { PolarResult } from '@/types'

const FLOOR_DB = -30 // dynamic range shown in all three renderings

// Brand-orange RGB used for data marks (brand-600)
const MARK_RGB = '234, 88, 12'

function levelAlpha(db: number): number {
  return Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB))
}

function levelFill(db: number): string {
  return `rgba(${MARK_RGB}, ${(0.06 + 0.94 * levelAlpha(db)).toFixed(3)})`
}

function formatFreq(f: number): string {
  return f >= 1000 ? `${f / 1000}k` : `${Math.round(f)}`
}

// Fixed sequential stroke ramp for the ordered frequency series. Contrast
// rises with frequency on both surfaces (light: darker steps, dark: lighter).
const FREQ_STROKES = [
  'stroke-brand-300 dark:stroke-brand-800',
  'stroke-brand-400 dark:stroke-brand-700',
  'stroke-brand-500 dark:stroke-brand-600',
  'stroke-brand-600 dark:stroke-brand-500',
  'stroke-brand-700 dark:stroke-brand-400',
  'stroke-brand-900 dark:stroke-brand-200',
]
const FREQ_CHIPS = [
  'bg-brand-300 dark:bg-brand-800',
  'bg-brand-400 dark:bg-brand-700',
  'bg-brand-500 dark:bg-brand-600',
  'bg-brand-600 dark:bg-brand-500',
  'bg-brand-700 dark:bg-brand-400',
  'bg-brand-900 dark:bg-brand-200',
]

// Normalize a polar row to its on-axis (0°) value and clamp to the floor
function normalizedRow(polar: PolarResult, fi: number): number[] {
  const angles = polar.angles
  const row = polar.data[fi]!
  const centerIdx = angles.reduce(
    (best, a, i) => (Math.abs(a) < Math.abs(angles[best]!) ? i : best),
    0
  )
  const ref = row[centerIdx]!
  return row.map((v) => Math.max(v - ref, FLOOR_DB))
}

// ---------------------------------------------------------------------------
// Polar diagram (half circle, one curve per frequency)
// ---------------------------------------------------------------------------

export function PolarDiagram({ polar }: { polar: PolarResult }) {
  const width = 460
  const height = 270
  const cx = width / 2
  const cy = height - 26
  const R = Math.min(width / 2 - 34, cy - 16)

  const rings = [-6, -12, -18, -24]
  const spokes = [-90, -60, -30, 0, 30, 60, 90]

  function point(angleDeg: number, db: number): [number, number] {
    const r = R * levelAlpha(db)
    const rad = (angleDeg * Math.PI) / 180
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)]
  }

  function arcPath(r: number): string {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl mx-auto" style={{ display: 'block' }}>
        {/* dB rings */}
        <path d={arcPath(R)} fill="none" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
        {rings.map((db) => (
          <path
            key={db}
            d={arcPath(R * levelAlpha(db))}
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth={0.5}
          />
        ))}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />

        {/* angle spokes + labels */}
        {spokes.map((a) => {
          const [x, y] = point(a, 0)
          const [lx, ly] = [cx + (R + 14) * Math.sin((a * Math.PI) / 180), cy - (R + 14) * Math.cos((a * Math.PI) / 180)]
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
              <text x={lx} y={ly + 3} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
                {a}°
              </text>
            </g>
          )
        })}

        {/* ring labels along the 0° spoke */}
        {rings.map((db) => (
          <text
            key={db}
            x={cx + 3}
            y={cy - R * levelAlpha(db) + 9}
            fontSize={8}
            className="fill-gray-400 dark:fill-gray-500"
          >
            {db}
          </text>
        ))}

        {/* one curve per frequency */}
        {polar.frequencies.map((f, fi) => {
          const row = normalizedRow(polar, fi)
          const pts = polar.angles.map((a, ai) => point(a, row[ai]!).join(',')).join(' ')
          return (
            <polyline
              key={f}
              points={pts}
              fill="none"
              strokeWidth={1.8}
              opacity={0.95}
              className={FREQ_STROKES[fi % FREQ_STROKES.length]}
            >
              <title>{formatFreq(f)} Hz</title>
            </polyline>
          )
        })}
      </svg>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {polar.frequencies.map((f, fi) => (
          <span key={f} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className={`inline-block w-3.5 h-0.5 rounded ${FREQ_CHIPS[fi % FREQ_CHIPS.length]}`} />
            {formatFreq(f)} Hz
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directivity map (frequency × angle heatmap)
// ---------------------------------------------------------------------------

export function DirectivityMap({ polar }: { polar: PolarResult }) {
  const width = 640
  const height = 300
  const margin = { top: 10, right: 14, bottom: 56, left: 44 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const freqs = polar.frequencies
  const angles = polar.angles
  const xMin = Math.log10(freqs[0]!)
  const xMax = Math.log10(freqs[freqs.length - 1]!)
  const aMin = angles[0]!
  const aMax = angles[angles.length - 1]!

  function xPos(f: number): number {
    return margin.left + ((Math.log10(f) - xMin) / (xMax - xMin)) * plotW
  }
  function yPos(a: number): number {
    return margin.top + ((aMax - a) / (aMax - aMin)) * plotH
  }

  // Cell edges midway between neighbouring grid points
  function edges(values: number[], pos: (v: number) => number): number[] {
    const p = values.map(pos)
    const e: number[] = [p[0]! - (p[1]! - p[0]!) / 2]
    for (let i = 0; i < p.length - 1; i++) e.push((p[i]! + p[i + 1]!) / 2)
    e.push(p[p.length - 1]! + (p[p.length - 1]! - p[p.length - 2]!) / 2)
    return e
  }
  const xEdges = edges(freqs, xPos)
  const yEdges = edges([...angles].reverse(), (a) => yPos(a))

  const normalized = freqs.map((_f, fi) => normalizedRow(polar, fi))

  const freqTicks = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(
    (f) => f >= freqs[0]! && f <= freqs[freqs.length - 1]!
  )
  const angleTicks = [-90, -60, -30, 0, 30, 60, 90]
  const scaleStops = [0, -6, -12, -18, -24, -30]

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        <defs>
          <clipPath id="dirmap-clip">
            <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* cells - crispEdges closes antialiasing seams between rects */}
        <g clipPath="url(#dirmap-clip)" shapeRendering="crispEdges">
          {freqs.map((f, fi) =>
            angles.map((a, ai) => {
              const db = normalized[fi]![ai]!
              const revIdx = angles.length - 1 - ai // yEdges is built top(+90)→bottom(-90)
              return (
                <rect
                  key={`${fi}-${ai}`}
                  x={xEdges[fi]}
                  y={yEdges[revIdx]}
                  width={xEdges[fi + 1]! - xEdges[fi]!}
                  height={yEdges[revIdx + 1]! - yEdges[revIdx]!}
                  fill={levelFill(db)}
                >
                  <title>{`${formatFreq(f)} Hz, ${a}°: ${db.toFixed(1)} dB`}</title>
                </rect>
              )
            })
          )}
        </g>

        {/* frame */}
        <rect
          x={margin.left}
          y={margin.top}
          width={plotW}
          height={plotH}
          fill="none"
          className="stroke-gray-300 dark:stroke-gray-600"
          strokeWidth={1}
        />

        {/* x axis (frequency, log) */}
        {freqTicks.map((f) => (
          <g key={f}>
            <line x1={xPos(f)} y1={margin.top + plotH} x2={xPos(f)} y2={margin.top + plotH + 4} className="stroke-gray-400 dark:stroke-gray-500" strokeWidth={1} />
            <text x={xPos(f)} y={margin.top + plotH + 15} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {formatFreq(f)}
            </text>
          </g>
        ))}
        <text x={margin.left + plotW / 2} y={margin.top + plotH + 28} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300">
          Hz
        </text>

        {/* y axis (angle) */}
        {angleTicks.map((a) => (
          <text key={a} x={margin.left - 6} y={yPos(a) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
            {a}°
          </text>
        ))}

        {/* color scale */}
        <g transform={`translate(${margin.left}, ${height - 18})`}>
          {Array.from({ length: 60 }, (_, i) => {
            const db = FLOOR_DB + (i / 59) * -FLOOR_DB
            return <rect key={i} x={(i * 150) / 60} y={0} width={150 / 60 + 0.5} height={8} fill={levelFill(db)} />
          })}
          <rect x={0} y={0} width={150} height={8} fill="none" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={0.5} />
          {scaleStops.map((db) => (
            <text key={db} x={((db - FLOOR_DB) / -FLOOR_DB) * 150} y={17} textAnchor="middle" fontSize={8} className="fill-gray-500 dark:fill-gray-400">
              {db}
            </text>
          ))}
          <text x={158} y={8} fontSize={9} className="fill-gray-700 dark:fill-gray-300">
            dB rel. on-axis
          </text>
        </g>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directivity surface (isometric 3D)
// ---------------------------------------------------------------------------

export function DirectivitySurface({ polar }: { polar: PolarResult }) {
  const width = 640
  const height = 330

  const freqs = polar.frequencies
  const angles = polar.angles
  const nf = freqs.length
  const na = angles.length

  const normalized = freqs.map((_f, fi) => normalizedRow(polar, fi))

  // Isometric projection: u = frequency axis, v = angle axis (drawn receding),
  // z = level. Tuned so the surface fills the viewBox.
  const uLen = 430
  const vDx = 130
  const vDy = 96
  const zScale = 68
  const x0 = 44
  const y0 = height - 62

  function project(fi: number, ai: number, db: number): [number, number] {
    const u = fi / (nf - 1)
    const v = ai / (na - 1)
    const z = levelAlpha(db)
    return [x0 + u * uLen + v * vDx, y0 - v * vDy - z * zScale]
  }

  // Painter's algorithm: draw quads back (v = last) to front (v = 0)
  const quads: { d: string; fill: string; key: string }[] = []
  for (let ai = na - 2; ai >= 0; ai--) {
    for (let fi = 0; fi < nf - 1; fi++) {
      const p00 = project(fi, ai, normalized[fi]![ai]!)
      const p10 = project(fi + 1, ai, normalized[fi + 1]![ai]!)
      const p11 = project(fi + 1, ai + 1, normalized[fi + 1]![ai + 1]!)
      const p01 = project(fi, ai + 1, normalized[fi]![ai + 1]!)
      const avgDb =
        (normalized[fi]![ai]! + normalized[fi + 1]![ai]! + normalized[fi + 1]![ai + 1]! + normalized[fi]![ai + 1]!) / 4
      quads.push({
        key: `${fi}-${ai}`,
        d: `M ${p00.join(' ')} L ${p10.join(' ')} L ${p11.join(' ')} L ${p01.join(' ')} Z`,
        fill: levelFill(avgDb),
      })
    }
  }

  const freqTicks = [100, 1000, 10000].filter((f) => f >= freqs[0]! && f <= freqs[nf - 1]!)
  const xMinLog = Math.log10(freqs[0]!)
  const xMaxLog = Math.log10(freqs[nf - 1]!)

  // Nearest grid index for a tick frequency (grid is log-spaced)
  function freqIndex(f: number): number {
    return ((Math.log10(f) - xMinLog) / (xMaxLog - xMinLog)) * (nf - 1)
  }

  function projectF(fiFloat: number, ai: number, db: number): [number, number] {
    const u = fiFloat / (nf - 1)
    const v = ai / (na - 1)
    return [x0 + u * uLen + v * vDx, y0 - v * vDy - levelAlpha(db) * zScale]
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" style={{ display: 'block' }}>
        {/* base grid outline */}
        <path
          d={`M ${projectF(0, 0, FLOOR_DB).join(' ')} L ${projectF(nf - 1, 0, FLOOR_DB).join(' ')} L ${projectF(nf - 1, na - 1, FLOOR_DB).join(' ')} L ${projectF(0, na - 1, FLOOR_DB).join(' ')} Z`}
          fill="none"
          className="stroke-gray-300 dark:stroke-gray-600"
          strokeWidth={1}
        />

        {/* surface */}
        {quads.map((q) => (
          <path key={q.key} d={q.d} fill={q.fill} strokeWidth={0.4} className="stroke-white/40 dark:stroke-black/40" />
        ))}

        {/* frequency axis labels (front edge) */}
        {freqTicks.map((f) => {
          const [x, y] = projectF(freqIndex(f), 0, FLOOR_DB)
          return (
            <text key={f} x={x} y={y + 14} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {formatFreq(f)} Hz
            </text>
          )
        })}

        {/* angle axis labels (right edge) */}
        {[-90, 0, 90].map((a) => {
          const ai = angles.indexOf(a)
          if (ai === -1) return null
          const [x, y] = projectF(nf - 1, ai, FLOOR_DB)
          return (
            <text key={a} x={x + 6} y={y + 3} fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {a}°
            </text>
          )
        })}

        {/* z axis annotation */}
        <text x={x0 - 8} y={y0 - zScale + 2} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
          0 dB
        </text>
        <text x={x0 - 8} y={y0 - 2} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
          {FLOOR_DB} dB
        </text>
      </svg>
    </div>
  )
}
