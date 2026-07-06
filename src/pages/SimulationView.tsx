import { useState, useMemo, useRef, useEffect } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select, StatCard } from '@/components/common/UI'
import { calcBaffleStep, baffleStepFrequency, calcBaffleStepCompensation, roundoverEffect } from '@/lib/acoustic/baffle'
import { calcSpinorama, calcPolar } from '@/lib/acoustic/directivity'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import type { FrequencyDataPoint } from '@/types'

const polarFreqs = [100, 500, 1000, 2000, 5000, 10000]
const polarAngles = Array.from({ length: 13 }, (_, i) => -90 + i * 15) // -90 to +90, 15deg steps

export default function SimulationView() {
  const { drivers } = useDriverStore()
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '')
  const [baffleWidth, setBaffleWidth] = useState(320)
  const [baffleHeight, setBaffleHeight] = useState(1080)
  const [roundoverRadius, setRoundoverRadius] = useState(40)

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)
  const freqs = useMemo(() => generateFrequencies(20, 20000, 12), [])

  // Baffle step
  const baffleStep = useMemo(() => {
    return calcBaffleStep(baffleWidth, baffleHeight, freqs)
  }, [baffleWidth, baffleHeight, freqs])

  const fStep = baffleStepFrequency(baffleWidth)

  // Baffle step compensation curve
  const baffleComp = useMemo(() => {
    return calcBaffleStepCompensation(fStep, 6, freqs)
  }, [fStep, freqs])

  // Roundover effect (computed for future integration)
  const _roundover = useMemo(() => {
    return roundoverEffect(roundoverRadius, freqs)
  }, [roundoverRadius, freqs])
  void _roundover

  // Baffle recommendation
  const baffleRec = useMemo(() => {
    return recommendBaffleSize(selectedDriver, baffleWidth, baffleHeight)
  }, [selectedDriver, baffleWidth, baffleHeight])

  // Spinorama
  const spinorama = useMemo(() => {
    if (!selectedDriver) return null
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: selectedDriver.tsParams?.sensitivity || 0,
    }))
    const diameter = selectedDriver.dimensions?.overallDiameter || 100
    return calcSpinorama(onAxis, diameter, baffleWidth, baffleHeight)
  }, [selectedDriver, freqs, baffleWidth, baffleHeight])

  // Polar diagram
  const polar = useMemo(() => {
    if (!selectedDriver) return null
    const onAxis: FrequencyDataPoint[] = freqs.map((f) => ({
      freq: f,
      magnitude: selectedDriver.tsParams?.sensitivity || 0,
    }))
    const diameter = selectedDriver.dimensions?.overallDiameter || 100
    return calcPolar(onAxis, polarAngles, diameter, polarFreqs)
  }, [selectedDriver, freqs])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Simulering</h2>

      {/* Setup - responsive: 1 col on mobile, 3 on desktop */}
      <Card title="Simuleringsopsætning">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Enhed"
            value={selectedDriverId}
            onChange={setSelectedDriverId}
            options={drivers.map((d) => ({
              value: d.id,
              label: `${d.manufacturer} ${d.model}`,
            }))}
          />
          <NumberField label="Baffel bredde" unit="mm" value={baffleWidth} onChange={setBaffleWidth} />
          <NumberField label="Baffel højde" unit="mm" value={baffleHeight} onChange={setBaffleHeight} />
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField label="Afrunding radius" unit="mm" value={roundoverRadius} onChange={setRoundoverRadius} />
          <div className="flex items-end">
            <div className="text-xs text-gray-500 pb-2">
              Større afrunding reducerer diffractions-rippels ved høje frekvenser.
            </div>
          </div>
        </div>
      </Card>

      {/* Baffle recommendation */}
      {baffleRec && (
        <Card title="Anbefalet baffel størrelse">
          <div className="space-y-3">
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-3">
              <div className="text-sm font-medium text-brand-800 dark:text-brand-200">
                {baffleRec.title}
              </div>
              <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                {baffleRec.description}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Anbefalet bredde" value={baffleRec.recWidth} unit="mm" />
              <StatCard label="Anbefalet højde" value={baffleRec.recHeight} unit="mm" />
              <StatCard label="Baffelstep ved" value={baffleRec.recStepFreq.toFixed(0)} unit="Hz" />
              <StatCard label="Nuværende step ved" value={fStep.toFixed(0)} unit="Hz" />
            </div>
            {baffleRec.warning && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <span className="text-amber-600 text-sm">⚠️</span>
                <span className="text-xs text-amber-700 dark:text-amber-300">{baffleRec.warning}</span>
              </div>
            )}
            {baffleRec.suggestion && (
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <span className="text-blue-600 text-sm">💡</span>
                <span className="text-xs text-blue-700 dark:text-blue-300">{baffleRec.suggestion}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Baffle step */}
      <Card title="Baffelstep">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Baffelstep frekvens" value={fStep.toFixed(0)} unit="Hz" />
            <StatCard label="Baffel dimension" value={`${baffleWidth}x${baffleHeight}`} unit="mm" />
            <StatCard label="Tab ved lav freq" value="-6" unit="dB" />
          </div>
          <ResponsivePlot
            data={[
              { x: baffleStep.freq, y: baffleStep.response, name: 'Baffelstep tab', color: '#f97316' },
              { x: freqs, y: baffleComp, name: 'Kompensation (+6dB)', color: '#3b82f6', dash: true },
              { x: freqs, y: baffleStep.response.map((v, i) => v + baffleComp[i]!), name: 'Kompenseret', color: '#10b981' },
            ]}
            yRange={[-8, 8]}
            yLabel="dB"
          />
        </div>
      </Card>

      {/* Spinorama */}
      {spinorama && (
        <Card title="Spinorama (CEA-2034)">
          <ResponsivePlot
            data={[
              { x: spinorama.freq, y: spinorama.onAxis, name: 'On-Axis', color: '#f97316' },
              { x: spinorama.freq, y: spinorama.listeningWindow, name: 'Listening Window', color: '#3b82f6' },
              { x: spinorama.freq, y: spinorama.earlyReflections, name: 'Early Reflections', color: '#10b981' },
              { x: spinorama.freq, y: spinorama.soundPower, name: 'Sound Power', color: '#8b5cf6' },
              { x: spinorama.freq, y: spinorama.directivityIndex, name: 'Directivity Index', color: '#ef4444' },
              { x: spinorama.freq, y: spinorama.predictedInRoom, name: 'Predicted In-Room', color: '#6b7280' },
            ]}
            yRange={[-20, 10]}
            yLabel="dB"
          />
        </Card>
      )}

      {/* Polar diagram */}
      {polar && (
        <Card title="Polardiagram">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Polardiagram viser off-axis respons ved udvalgte frekvenser.
              Omnidirektionelt ved lave frekvenser, mere retningsbestemt ved hoeje.
            </p>
            <PolarHeatmap polar={polar} />
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Baffle size recommendation
// ---------------------------------------------------------------------------

interface BaffleRecommendation {
  title: string
  description: string
  recWidth: number
  recHeight: number
  recStepFreq: number
  warning?: string
  suggestion?: string
}

function recommendBaffleSize(
  driver: ReturnType<typeof useDriverStore.getState>['drivers'][0] | undefined,
  currentWidth: number,
  currentHeight: number
): BaffleRecommendation | null {
  if (!driver) return null

  const driverDia = driver.dimensions?.overallDiameter || 100
  const driverType = driver.type
  const C = 343000 // speed of sound mm/s

  // Target: baffle step should be below the driver's operating range
  // For woofers: step should be < 200-300 Hz (so bass isn't affected)
  // For midranges: step should be < 500-800 Hz
  // For tweeters: step should be < 2-3 kHz (but tweeters are always on a baffle, so this is about edge diffraction)

  let targetStepFreq: number
  let minBaffleDim: number

  switch (driverType) {
    case 'woofer':
    case 'subwoofer':
      targetStepFreq = 200
      // f_step = c / (2*pi*d) => d = c / (2*pi*f_step)
      minBaffleDim = Math.round(C / (2 * Math.PI * targetStepFreq))
      break
    case 'midrange':
      targetStepFreq = 500
      minBaffleDim = Math.round(C / (2 * Math.PI * targetStepFreq))
      break
    case 'tweeter':
      targetStepFreq = 2000
      minBaffleDim = Math.round(C / (2 * Math.PI * targetStepFreq))
      break
    default:
      targetStepFreq = 300
      minBaffleDim = Math.round(C / (2 * Math.PI * targetStepFreq))
  }

  // Driver should fit on baffle with at least 50mm margin on each side
  const minWidthForDriver = driverDia + 100
  const minBaffle = Math.max(minBaffleDim, minWidthForDriver)

  // Recommend a baffle that's roughly 1.2x the minimum for smooth response
  const recWidth = Math.round(Math.max(minBaffle, driverDia + 100))
  const recHeight = Math.round(recWidth * 1.5) // taller than wide is typical for speakers

  // Recalculate step freq for recommended baffle
  const recAvg = (recWidth + recHeight) / 2
  const recStepFreq = C / (2 * Math.PI * recAvg)

  // Current baffle evaluation
  const currentAvg = (currentWidth + currentHeight) / 2
  const currentStepFreq = C / (2 * Math.PI * currentAvg)
  const currentMinDim = Math.min(currentWidth, currentHeight)

  const driverTypeLabel: Record<string, string> = {
    woofer: 'woofer',
    subwoofer: 'subwoofer',
    midrange: 'midrange',
    tweeter: 'tweeter',
    fullrange: 'full-range',
  }

  let warning: string | undefined
  let suggestion: string | undefined

  if (currentStepFreq > targetStepFreq * 1.5) {
    warning = `Baffelen er for smal til denne ${driverTypeLabel[driverType]}. Baffelsteppet ligger ved ${currentStepFreq.toFixed(0)} Hz, men bør vaere under ${targetStepFreq} Hz. Dette giver et dybt bas-fald. Overvej en bredere baffel eller DSP-kompensation.`
  } else if (currentMinDim < driverDia + 50) {
    warning = `Enheden (${driverDia}mm diameter) passer naeppe paa baffelen (${currentWidth}x${currentHeight}mm). Tilfoej mindst 50mm margin rundt enheden.`
  } else if (currentStepFreq > targetStepFreq) {
    suggestion = `Baffelsteppet ligger lidt hoejt (${currentStepFreq.toFixed(0)} Hz vs. mål ${targetStepFreq} Hz). En bredere baffel (${recWidth}mm) vil give et glattere frekvensforloeb. Alternativt kan DSP-kompensation bruges.`
  } else {
    suggestion = `Baffelstørrelsen er god til denne ${driverTypeLabel[driverType]}. Baffelsteppet ligger ved ${currentStepFreq.toFixed(0)} Hz, godt under det kritiske område.`
  }

  return {
    title: `Anbefalet baffel til ${driver.manufacturer} ${driver.model}`,
    description: `Beregnet for ${driverTypeLabel[driverType]} med ${driverDia}mm diameter. Maalet er at placere baffelsteppet under enhedens arbejdsområde (${targetStepFreq} Hz).`,
    recWidth,
    recHeight,
    recStepFreq,
    warning,
    suggestion,
  }
}

// ---------------------------------------------------------------------------
// Number field with visible label and input
// ---------------------------------------------------------------------------

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit?: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label} {unit && <span className="text-gray-400">[{unit}]</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Polar heatmap - responsive, horizontal scroll on mobile
// ---------------------------------------------------------------------------

function PolarHeatmap({ polar }: { polar: NonNullable<ReturnType<typeof calcPolar>> }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="text-xs border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left sticky left-0 bg-white dark:bg-gray-800 z-10">Freq</th>
            {polar.angles.map((a) => (
              <th key={a} className="px-1.5 py-1.5 text-center whitespace-nowrap">{a}°</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {polar.frequencies.map((f, fi) => (
            <tr key={f} className="border-t border-gray-200 dark:border-gray-700">
              <td className="px-2 py-1.5 font-medium sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap">
                {f >= 1000 ? `${(f / 1000).toFixed(0)}k` : f} Hz
              </td>
              {polar.angles.map((a, ai) => {
                const db = polar.data[fi][ai]
                const opacity = Math.max(0, Math.min(1, (db + 30) / 30))
                return (
                  <td
                    key={a}
                    className="px-1.5 py-1.5 text-center whitespace-nowrap"
                    style={{ backgroundColor: `rgba(249, 115, 22, ${opacity * 0.35})` }}
                  >
                    {db.toFixed(0)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Responsive Plot - SVG that fills container width, with proper legend
// ---------------------------------------------------------------------------

interface PlotSeries {
  x: number[]
  y: number[]
  name: string
  color: string
  dash?: boolean
}

function ResponsivePlot({
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

  // Responsive dimensions
  const isMobile = containerWidth < 600
  const width = containerWidth
  const height = isMobile ? 300 : 400
  const legendWidth = isMobile ? 0 : 140
  const margin = {
    top: 12,
    right: isMobile ? 8 : legendWidth + 10,
    bottom: 35,
    left: 45,
  }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  // Y range
  const allY = data.flatMap((d) => d.y)
  const yMin = yRange?.[0] ?? Math.min(...allY, 0)
  const yMax = yRange?.[1] ?? Math.max(...allY, 10)

  // X range (log scale 20Hz - 20kHz)
  const xMin = Math.log10(20)
  const xMax = Math.log10(20000)

  function xToPixel(freq: number): number {
    const x = Math.log10(Math.max(freq, 1))
    return margin.left + ((x - xMin) / (xMax - xMin)) * plotW
  }

  function yToPixel(value: number): number {
    return margin.top + ((yMax - value) / (yMax - yMin)) * plotH
  }

  // Grid lines
  const decades = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  // Adaptive tick step: narrow ranges get finer ticks
  const yStep = yMax - yMin <= 20 ? 4 : 10
  const ySteps = Array.from({ length: Math.floor((yMax - yMin) / yStep) + 1 }, (_, i) => yMin + i * yStep)

  // Legend: horizontal on mobile, vertical on desktop
  const legendItems = isMobile ? data : data

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        {/* Background */}
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

        {/* Y grid + labels */}
        {ySteps.map((y) => (
          <g key={y}>
            <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">{y}</text>
          </g>
        ))}

        {/* X grid + labels */}
        {decades.map((f) => (
          <g key={f}>
            <line x1={xToPixel(f)} y1={margin.top} x2={xToPixel(f)} y2={margin.top + plotH} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={xToPixel(f)} y={margin.top + plotH + 14} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300">Hz</text>
        <text x={12} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 12 ${margin.top + plotH / 2})`}>{yLabel}</text>

        {/* Curves */}
        {data.map((series) => {
          const points = series.x.map((x, i) => `${xToPixel(x)},${yToPixel(series.y[i]!)}`).join(' ')
          return (
            <g key={series.name}>
              <polyline
                points={points}
                fill="none"
                stroke={series.color}
                strokeWidth={1.5}
                opacity={0.85}
                strokeDasharray={series.dash ? '4 3' : undefined}
              />
            </g>
          )
        })}

        {/* Legend - horizontal on mobile (below plot), vertical on desktop (right side) */}
        {isMobile ? (
          <g>
            {legendItems.map((series, i) => {
              const colW = width / legendItems.length
              const lx = i * colW + 4
              const ly = 4
              return (
                <g key={series.name} transform={`translate(${lx}, ${ly})`}>
                  <line x1={0} y1={0} x2={10} y2={0} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash ? '4 3' : undefined} />
                  <text x={13} y={3} fontSize={7} className="fill-gray-700 dark:fill-gray-300">{series.name.length > 14 ? series.name.slice(0, 13) + '..' : series.name}</text>
                </g>
              )
            })}
          </g>
        ) : (
          <g>
            {legendItems.map((series, i) => (
              <g key={series.name} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18 + 4})`}>
                <line x1={0} y1={0} x2={15} y2={0} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash ? '4 3' : undefined} />
                <text x={20} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">{series.name}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
