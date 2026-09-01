// Shared responsive SVG frequency-response plot
//
// Used by SystemSimulation and DesignCompare for log-scale dB vs Hz plots.
// Auto-scales to container width, supports dark mode.

import { useRef, useState, useEffect } from 'react'

export interface PlotSeries {
  x: number[]
  y: number[]
  name: string
  color: string
  dash?: boolean
}

export function ResponsivePlot({
  data,
  yRange,
  yLabel = 'dB',
}: {
  data: PlotSeries[]
  yRange?: [number, number]
  yLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const isMobile = containerWidth < 600
  const width = containerWidth
  const height = isMobile ? 300 : 400
  const legendWidth = isMobile ? 0 : 160
  const margin = { top: 12, right: isMobile ? 8 : legendWidth + 10, bottom: 35, left: 50 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const allY = data.flatMap((d) => d.y).filter((v) => Number.isFinite(v))
  const dataMin = allY.length ? Math.min(...allY) : 0
  const dataMax = allY.length ? Math.max(...allY) : 10
  const rawMin = yRange ? Math.min(yRange[0], dataMin) : Math.min(dataMin, 0)
  const rawMax = yRange ? Math.max(yRange[1], dataMax) : Math.max(dataMax, 10)
  const span = Math.max(rawMax - rawMin, 1)
  const yStep = [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 8) ?? 100
  const yMin = Math.floor(rawMin / yStep) * yStep
  const yMax = Math.ceil(rawMax / yStep) * yStep

  const xMin = Math.log10(20)
  const xMax = Math.log10(20000)

  function xToPixel(freq: number): number {
    const x = Math.log10(Math.max(freq, 1))
    return margin.left + ((x - xMin) / (xMax - xMin)) * plotW
  }

  function yToPixel(value: number): number {
    const clamped = Math.max(value, yMin)
    return margin.top + ((yMax - clamped) / (yMax - yMin)) * plotH
  }

  const decades = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const ySteps: number[] = []
  for (let y = yMin; y <= yMax; y += yStep) ySteps.push(y)

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

        {ySteps.map((y) => (
          <g key={y}>
            <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">{y}</text>
          </g>
        ))}

        {decades.map((f) => (
          <g key={f}>
            <line x1={xToPixel(f)} y1={margin.top} x2={xToPixel(f)} y2={margin.top + plotH} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={xToPixel(f)} y={margin.top + plotH + 14} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}

        <text x={margin.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300">Hz</text>
        <text x={14} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 14 ${margin.top + plotH / 2})`}>{yLabel}</text>

        {data.map((series, idx) => (
          <polyline
            key={idx}
            points={series.x.map((x, i) => `${xToPixel(x)},${yToPixel(series.y[i]!)}`).join(' ')}
            fill="none"
            stroke={series.color}
            strokeWidth={1.5}
            strokeDasharray={series.dash ? '6 3' : undefined}
            opacity={0.85}
          />
        ))}

        {!isMobile && (
          <g>
            {data.map((series, i) => (
              <g key={i} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18 + 4})`}>
                <line x1={0} y1={0} x2={15} y2={0} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash ? '6 3' : undefined} />
                <text x={20} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">{series.name}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
