import { useState, useMemo } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select, StatCard } from '@/components/common/UI'
import { calcBaffleStep, baffleStepFrequency } from '@/lib/acoustic/baffle'
import { calcSpinorama, calcPolar } from '@/lib/acoustic/directivity'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import type { FrequencyDataPoint } from '@/types'

export default function SimulationView() {
  const { drivers } = useDriverStore()
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '')
  const [baffleWidth, setBaffleWidth] = useState(320)
  const [baffleHeight, setBaffleHeight] = useState(1080)

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)
  const freqs = useMemo(() => generateFrequencies(20, 20000, 12), [])

  // Baffle step
  const baffleStep = useMemo(() => {
    return calcBaffleStep(baffleWidth, baffleHeight, freqs)
  }, [baffleWidth, baffleHeight, freqs])

  const fStep = baffleStepFrequency(baffleWidth, baffleHeight)

  // Spinorama (if driver has frequency response data, or use flat + sensitivity)
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
  const polarFreqs = [100, 500, 1000, 2000, 5000, 10000]
  const polarAngles = Array.from({ length: 37 }, (_, i) => -90 + i * 5)
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

      <Card title="Simuleringsopsætning">
        <div className="grid grid-cols-3 gap-3">
          <Select
            label="Enhed"
            value={selectedDriverId}
            onChange={setSelectedDriverId}
            options={drivers.map((d) => ({
              value: d.id,
              label: `${d.manufacturer} ${d.model}`,
            }))}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Baffel bredde [mm]</label>
            <input
              type="number"
              value={baffleWidth}
              onChange={(e) => setBaffleWidth(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Baffel højde [mm]</label>
            <input
              type="number"
              value={baffleHeight}
              onChange={(e) => setBaffleHeight(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Baffle step */}
      <Card title="Baffelstep">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Baffelstep frekvens" value={fStep.toFixed(0)} unit="Hz" />
            <StatCard label="Baffel dimension" value={`${baffleWidth}×${baffleHeight}`} unit="mm" />
            <StatCard label="Tab ved lav freq" value="-6" unit="dB" />
          </div>
          <SimplePlot
            data={[{ x: baffleStep.freq, y: baffleStep.response, name: 'Baffelstep respons', color: '#f97316' }]}
            title="Baffelstep respons (diffraction loss)"
            xLog
            yRange={[-8, 2]}
          />
        </div>
      </Card>

      {/* Spinorama */}
      {spinorama && (
        <Card title="Spinorama (CEA-2034)">
          <SimplePlot
            data={[
              { x: spinorama.freq, y: spinorama.onAxis, name: 'On-Axis', color: '#f97316' },
              { x: spinorama.freq, y: spinorama.listeningWindow, name: 'Listening Window', color: '#3b82f6' },
              { x: spinorama.freq, y: spinorama.earlyReflections, name: 'Early Reflections', color: '#10b981' },
              { x: spinorama.freq, y: spinorama.soundPower, name: 'Sound Power', color: '#8b5cf6' },
              { x: spinorama.freq, y: spinorama.directivityIndex, name: 'Directivity Index', color: '#ef4444' },
              { x: spinorama.freq, y: spinorama.predictedInRoom, name: 'Predicted In-Room', color: '#6b7280' },
            ]}
            title="Spinorama"
            xLog
            yRange={[-20, 10]}
          />
        </Card>
      )}

      {/* Polar diagram */}
      {polar && (
        <Card title="Polardiagram">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Polardiagram viser off-axis respons ved udvalgte frekvenser.
              Omnidirektionelt ved lave frekvenser, mere retningsbestemt ved høje.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Freq</th>
                    {polar.angles.map((a) => (
                      <th key={a} className="px-2 py-1 text-center">{a}°</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {polar.frequencies.map((f, fi) => (
                    <tr key={f} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-2 py-1 font-medium">{f} Hz</td>
                      {polar.angles.map((a, ai) => {
                        const db = polar.data[fi][ai]
                        const opacity = Math.max(0, Math.min(1, (db + 30) / 30))
                        return (
                          <td
                            key={a}
                            className="px-2 py-1 text-center"
                            style={{ backgroundColor: `rgba(249, 115, 22, ${opacity * 0.3})` }}
                          >
                            {db.toFixed(1)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simple Plot component (canvas-based, no Plotly dependency for MVP)
// ---------------------------------------------------------------------------

interface PlotSeries {
  x: number[]
  y: number[]
  name: string
  color: string
}

function SimplePlot({
  data,
  yRange,
}: {
  data: PlotSeries[]
  title?: string
  xLog?: boolean
  yRange?: [number, number]
}) {
  const width = 800
  const height = 400
  const margin = { top: 20, right: 120, bottom: 40, left: 50 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  // Determine Y range
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

  // Grid lines: decades for X
  const decades = [20, 100, 1000, 10000]
  // Grid lines: 10dB steps for Y
  const ySteps = Array.from({ length: Math.floor((yMax - yMin) / 10) + 1 }, (_, i) => yMin + i * 10)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 600 }}>
        {/* Background */}
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} fill="#fafafa" stroke="#e5e7eb" />

        {/* Y grid */}
        {ySteps.map((y) => (
          <g key={y}>
            <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={10} fill="#6b7280">{y}</text>
          </g>
        ))}

        {/* X grid */}
        {decades.map((f) => (
          <g key={f}>
            <line x1={xToPixel(f)} y1={margin.top} x2={xToPixel(f)} y2={margin.top + plotH} stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={xToPixel(f)} y={margin.top + plotH + 15} textAnchor="middle" fontSize={10} fill="#6b7280">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={height - 5} textAnchor="middle" fontSize={11} fill="#374151">Frekvens [Hz]</text>
        <text x={15} y={margin.top + plotH / 2} textAnchor="middle" fontSize={11} fill="#374151" transform={`rotate(-90 15 ${margin.top + plotH / 2})`}>dB</text>

        {/* Curves */}
        {data.map((series) => {
          const points = series.x.map((x, i) => `${xToPixel(x)},${yToPixel(series.y[i])}`).join(' ')
          return (
            <g key={series.name}>
              <polyline points={points} fill="none" stroke={series.color} strokeWidth={1.5} opacity={0.85} />
            </g>
          )
        })}

        {/* Legend */}
        {data.map((series, i) => (
          <g key={series.name} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18})`}>
            <line x1={0} y1={0} x2={15} y2={0} stroke={series.color} strokeWidth={2} />
            <text x={20} y={3} fontSize={10} fill="#374151">{series.name}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
