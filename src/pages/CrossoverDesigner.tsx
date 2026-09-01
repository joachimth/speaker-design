import { useState, useMemo, useRef, useEffect } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { useDesignStore } from '@/store/designStore'
import { Card, Select, NumberInput, Badge, Button } from '@/components/common/UI'
import { buildCrossoverFilter, applyCrossover, crossoverSlopeDbPerOctave } from '@/lib/acoustic/crossover'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { suggestCrossover } from '@/lib/acoustic/autoDesign'
import type { CrossoverType, FrequencyDataPoint, DesignBand } from '@/types'

const XOVER_TYPES: { value: CrossoverType; label: string }[] = [
  { value: 'first_order', label: '1. ordens (6 dB/okt)' },
  { value: 'BW2', label: 'Butterworth 2. (12 dB/okt)' },
  { value: 'LR2', label: 'Linkwitz-Riley 2. (12 dB/okt)' },
  { value: 'BW4', label: 'Butterworth 4. (24 dB/okt)' },
  { value: 'LR4', label: 'Linkwitz-Riley 4. (24 dB/okt)' },
  { value: 'LR8', label: 'Linkwitz-Riley 8. (48 dB/okt)' },
]

const WAYS_OPTIONS = [
  { value: 2, label: '2-vejs' },
  { value: 3, label: '3-vejs' },
  { value: 4, label: '4-vejs' },
]

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  mid2: 'Mellem 2',
  high: 'Diskant',
}

export default function CrossoverDesigner() {
  const { drivers } = useDriverStore()
  const { design, setWays, setBands, updateBand } = useDesignStore()
  const ways = design.ways
  const bands = design.bands

  // Adjust bands when ways changes
  function handleWaysChange(value: string) {
    const n = parseInt(value) as 2 | 3 | 4
    setWays(n)
  }

  // Auto-suggest: compute crossover from selected drivers
  const [autoReasoning, setAutoReasoning] = useState<string[] | null>(null)

  function handleAutoSuggest() {
    // Collect selected drivers from current bands
    const selectedDrivers = bands
      .slice(0, ways)
      .map((b) => drivers.find((d) => d.id === b.driverId))
      .filter((d): d is NonNullable<typeof d> => !!d)

    // If not enough drivers selected, auto-pick by type from the store
    if (selectedDrivers.length < 2) {
      const roleToType: Record<string, string[]> = {
        low: ['woofer', 'subwoofer'],
        mid: ['midrange', 'fullrange'],
        high: ['tweeter'],
      }
      const needed = bands.slice(0, ways).map((band) => {
        if (band.driverId && drivers.find((d) => d.id === band.driverId)) {
          return drivers.find((d) => d.id === band.driverId)!
        }
        const types = roleToType[band.role] || []
        const existing = selectedDrivers.map((d) => d.id)
        return drivers.find((d) => types.includes(d.type) && !existing.includes(d.id))
      }).filter((d): d is NonNullable<typeof d> => !!d)

      if (needed.length < 2) {
        setAutoReasoning(['Ikke nok enheder valgt. Vælg mindst 2 enheder før auto-forslag.'])
        return
      }
      const result = suggestCrossover(needed, ways)
      applySuggestion(result)
      return
    }

    const result = suggestCrossover(selectedDrivers, ways)
    applySuggestion(result)
  }

  function applySuggestion(result: ReturnType<typeof suggestCrossover>) {
    setAutoReasoning(result.reasoning)
    if (result.bands.length === 0) return

    // Build new bands array from suggestion, preserving structure for unused slots
    const newBands: DesignBand[] = [...bands]
    for (let i = 0; i < ways && i < result.bands.length; i++) {
      const sug = result.bands[i]!
      newBands[i] = {
        driverId: sug.driverId,
        role: sug.role as DesignBand['role'],
        lowpassFreq: sug.lowpassFreq,
        lowpassType: sug.lowpassType,
        highpassFreq: sug.highpassFreq,
        highpassType: sug.highpassType,
        gain: sug.gain,
        polarity: sug.polarity,
        delay: sug.delay,
      }
    }
    setBands(newBands)
  }

  // Generate preview curves for the crossover response plot
  const freqs = generateFrequencies(20, 20000, 12)

  // Compute LP and HP filter curves for each active band
  const crossoverCurves = useMemo(() => {
    const curves: { name: string; color: string; freq: number[]; mag: number[] }[] = []
    const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6']

    for (let i = 0; i < ways && i < bands.length; i++) {
      const band = bands[i]
      const driver = drivers.find((d) => d.id === band.driverId)
      const label = `${ROLE_LABELS[band.role]}${driver ? ` (${driver.manufacturer} ${driver.model})` : ''}${(band.driverCount ?? 1) > 1 ? ` ${band.driverCount}×` : ''}`
      const color = COLORS[i % COLORS.length]
      const countGainDb = 10 * Math.log10(band.driverCount ?? 1)

      if (!driver?.frequencyResponse || driver.frequencyResponse.length === 0) {
        // No real driver response — show just the filter curve applied to a flat 0 dB input
        let curve: FrequencyDataPoint[] = freqs.map((f) => ({ freq: f, magnitude: 0 }))

        if (band.highpassFreq > 0) {
          const hp = buildCrossoverFilter(band.highpassType, band.highpassFreq, true)
          curve = applyCrossover(hp, curve)
        }
        if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
          const lp = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false)
          curve = applyCrossover(lp, curve)
        }
        curve = curve.map((p) => ({ ...p, magnitude: p.magnitude + band.gain + countGainDb }))

        curves.push({
          name: `${label} (flad input)`,
          color,
          freq: curve.map((p) => p.freq),
          mag: curve.map((p) => p.magnitude),
        })
      } else {
        // Real driver response with crossover applied
        let curve: FrequencyDataPoint[] = [...driver.frequencyResponse]

        if (band.highpassFreq > 0) {
          const hp = buildCrossoverFilter(band.highpassType, band.highpassFreq, true)
          curve = applyCrossover(hp, curve)
        }
        if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
          const lp = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false)
          curve = applyCrossover(lp, curve)
        }
        curve = curve.map((p) => ({ ...p, magnitude: p.magnitude + band.gain + countGainDb }))

        curves.push({
          name: label,
          color,
          freq: curve.map((p) => p.freq),
          mag: curve.map((p) => p.magnitude),
        })
      }
    }
    return curves
  }, [bands, ways, drivers, freqs])

  // Sum of all active bands = predicted system response through crossover
  const summedResponse = useMemo(() => {
    if (crossoverCurves.length === 0) return null

    return freqs.map((f) => {
      let sumLinear = 0
      for (const curve of crossoverCurves) {
        const idx = findClosestIndex(curve.freq, f)
        const db = curve.mag[idx] ?? -100
        sumLinear += Math.pow(10, db / 20)
      }
      return {
        freq: f,
        magnitude: 20 * Math.log10(Math.max(sumLinear, 1e-10)),
      }
    })
  }, [crossoverCurves, freqs])

  // ---------------------------------------------------------------------------
// Crossover frequency response plot
// ---------------------------------------------------------------------------

interface CurveData {
  name: string
  color: string
  freq: number[]
  mag: number[]
}

function CrossoverPlot({
  curves,
  summedResponse,
}: {
  curves: CurveData[]
  summedResponse: FrequencyDataPoint[] | null
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
  const margin = { top: 12, right: isMobile ? 8 : 180, bottom: 35, left: 45 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  // Gather all Y values
  const allY = [
    ...curves.flatMap((c) => c.mag),
    ...(summedResponse ? summedResponse.map((p) => p.magnitude) : []),
  ]
  // Clamp the floor at -60 dB - steep slopes roll off towards -200 dB and
  // would otherwise squash the audible region of the plot
  const yMin = Math.max(Math.min(...allY, -20), -60)
  const yMax = Math.max(...allY, 10)
  const yRange = yMax - yMin

  // X range (log 20Hz - 20kHz)
  const xMin = Math.log10(20)
  const xMax = Math.log10(20000)

  function xToPixel(freq: number): number {
    const x = Math.log10(Math.max(freq, 1))
    return margin.left + ((x - xMin) / (xMax - xMin)) * plotW
  }

  function yToPixel(value: number): number {
    const clamped = Math.max(value, yMin)
    return margin.top + ((yMax - clamped) / yRange) * plotH
  }

  const decades = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const yStep = 10
  const yMinRounded = Math.floor(yMin / yStep) * yStep
  const ySteps: number[] = []
  for (let y = yMinRounded; y <= yMax; y += yStep) ySteps.push(y)

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        {/* Background */}
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

        {/* Y grid */}
        {ySteps.map((y) => (
          <g key={y}>
            <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">{y}</text>
          </g>
        ))}

        {/* X grid */}
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
        <text x={12} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 12 ${margin.top + plotH / 2})`}>dB</text>

        {/* Summed response (behind individual curves, dashed) */}
        {summedResponse && (
          <polyline
            points={summedResponse.map((p) => `${xToPixel(p.freq)},${yToPixel(p.magnitude)}`).join(' ')}
            fill="none"
            className="stroke-gray-500 dark:stroke-gray-400"
            strokeWidth={2}
            strokeDasharray="6 3"
            opacity={0.7}
          />
        )}

        {/* Individual band curves */}
        {curves.map((curve) => (
          <polyline
            key={curve.name}
            points={curve.freq.map((f, i) => `${xToPixel(f)},${yToPixel(curve.mag[i]!)}`).join(' ')}
            fill="none"
            stroke={curve.color}
            strokeWidth={1.5}
            opacity={0.8}
          />
        ))}

        {/* Legend */}
        <g>
          {[
            ...curves.map((c) => ({ name: c.name, color: c.color, dash: false })),
            ...(summedResponse ? [{ name: 'Sum (total)', color: '#6b7280', dash: true }] : []),
          ].map((item, i) => (
            <g key={item.name} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18 + 4})`}>
              <line x1={0} y1={0} x2={15} y2={0} stroke={item.color} strokeWidth={2} strokeDasharray={item.dash ? '6 3' : undefined} />
              <text x={20} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">{item.name}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

function findClosestIndex(arr: number[], target: number): number {
    let lo = 0, hi = arr.length - 1
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      if (arr[mid]! < target) lo = mid
      else hi = mid
    }
    return Math.abs(arr[lo]! - target) < Math.abs(arr[hi]! - target) ? lo : hi
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delingsfilter</h2>

      <Card title="Systemkonfiguration">
        <div className="flex items-end gap-3">
          <Select
            label="Antal veje"
            value={ways}
            onChange={handleWaysChange}
            options={WAYS_OPTIONS}
            className="flex-1"
          />
          <Button onClick={handleAutoSuggest} variant="primary">
            Auto-forslag
          </Button>
        </div>
      </Card>

      {/* Auto-suggest reasoning */}
      {autoReasoning && autoReasoning.length > 0 && (
        <Card title="Auto-forslag begrundelse">
          <div className="space-y-1">
            {autoReasoning.map((line, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Band configuration */}
      {bands.slice(0, ways).map((band, i) => (
        <Card key={i} title={`${ROLE_LABELS[band.role] || band.role} - vej ${i + 1}`}>
          <div className="space-y-3">
            <Select
              label="Enhed"
              value={band.driverId}
              onChange={(v) => updateBand(i, { driverId: v })}
              options={[
                { value: '', label: '— Vælg enhed —' },
                ...drivers.map((d) => ({ value: d.id, label: `${d.manufacturer} ${d.model}` })),
              ]}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {band.highpassFreq > 0 && (
                <>
                  <NumberInput
                    label="Highpass frekvens"
                    unit="Hz"
                    value={band.highpassFreq}
                    step={10}
                    onChange={(v) => updateBand(i, { highpassFreq: v })}
                  />
                  <Select
                    label="Highpass type"
                    value={band.highpassType}
                    onChange={(v) => updateBand(i, { highpassType: v as CrossoverType })}
                    options={XOVER_TYPES}
                  />
                </>
              )}
              {band.lowpassFreq > 0 && (
                <>
                  <NumberInput
                    label="Lowpass frekvens"
                    unit="Hz"
                    value={band.lowpassFreq}
                    step={10}
                    onChange={(v) => updateBand(i, { lowpassFreq: v })}
                  />
                  <Select
                    label="Lowpass type"
                    value={band.lowpassType}
                    onChange={(v) => updateBand(i, { lowpassType: v as CrossoverType })}
                    options={XOVER_TYPES}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <NumberInput label="Antal enheder" value={band.driverCount ?? 1} min={1} max={8} onChange={(v) => updateBand(i, { driverCount: Math.max(1, Math.round(v)) })} />
              <NumberInput label="Gain" unit="dB" value={band.gain} step={0.5} onChange={(v) => updateBand(i, { gain: v })} />
              <Select
                label="Polaritet"
                value={band.polarity}
                onChange={(v) => updateBand(i, { polarity: parseInt(v) as 0 | 180 })}
                options={[
                  { value: 0, label: '0° (normal)' },
                  { value: 180, label: '180° (inverteret)' },
                ]}
              />
              <NumberInput label="Delay" unit="ms" value={band.delay} step={0.01} onChange={(v) => updateBand(i, { delay: v })} />
            </div>

            <div className="flex gap-2">
              <Badge color="blue">
                {band.lowpassFreq > 0 ? `${crossoverSlopeDbPerOctave(band.lowpassType)} dB/okt lowpass` : 'ingen lowpass'}
              </Badge>
              <Badge color="green">
                {band.highpassFreq > 0 ? `${crossoverSlopeDbPerOctave(band.highpassType)} dB/okt highpass` : 'ingen highpass'}
              </Badge>
            </div>
          </div>
        </Card>
      ))}

      {/* Preview summary */}
      <Card title="Delingsfilter oversigt">
        <div className="space-y-2">
          {bands.slice(0, ways).map((band, i) => {
            const driver = drivers.find((d) => d.id === band.driverId)
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Badge>{ROLE_LABELS[band.role] || band.role}</Badge>
                {(band.driverCount ?? 1) > 1 && (
                  <Badge color="orange">{band.driverCount}×</Badge>
                )}
                <span className="text-gray-700 dark:text-gray-300">
                  {driver ? `${driver.manufacturer} ${driver.model}` : '— ikke valgt —'}
                </span>
                <span className="text-gray-500 text-xs">
                  {band.highpassFreq > 0 && `HP ${band.highpassFreq}Hz ${band.highpassType}`}
                  {band.highpassFreq > 0 && band.lowpassFreq > 0 && ' · '}
                  {band.lowpassFreq > 0 && `LP ${band.lowpassFreq}Hz ${band.lowpassType}`}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Crossover response plot */}
      {crossoverCurves.length > 0 && (
        <Card title="Frekvensrespons gennem delingsfilter">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Viser hver enheds respons efter delingsfilter. Stiplet linje = sum af alle enheder.
            </p>
            <CrossoverPlot
              curves={crossoverCurves}
              summedResponse={summedResponse}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
