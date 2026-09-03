// Phase alignment fine-tuning card
//
// Shows the phase relationship between adjacent bands at each crossover
// frequency, and lets the user toggle polarity and adjust delay to achieve
// phase coherence at the crossover point. Visualizes phase overlap zone.

import { useMemo } from 'react'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { buildCrossoverFilter, filterPhaseRad } from '@/lib/acoustic/crossover'
import type { CrossoverType } from '@/types'
import { Card, Select } from '@/components/common/UI'

interface Band {
  driverId: string
  role: 'low' | 'mid' | 'mid2' | 'high'
  driverCount?: number
  gain: number
  polarity: 0 | 180
  delay: number
  lowpassFreq: number
  lowpassType: string
  highpassFreq: number
  highpassType: string
}

interface Props {
  bands: Band[]
  ways: 2 | 3 | 4
  onPolarityChange: (index: number, polarity: 0 | 180) => void
  onDelayChange: (index: number, delayMs: number) => void
}

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  mid2: 'Mellem 2',
  high: 'Diskant',
}

export function PhaseAlignmentCard({ bands, ways, onPolarityChange }: Props) {
  const freqs = useMemo(() => generateFrequencies(20, 20000, 12), [])

  // Compute per-band phase curves near crossover frequencies
  const crossoverPoints = useMemo(() => {
    const points: { freq: number; lowerIdx: number; upperIdx: number; label: string }[] = []
    for (let i = 0; i < ways - 1 && i < bands.length - 1; i++) {
      const lower = bands[i]!
      const upper = bands[i + 1]!
      // Crossover freq = lower's lowpass or upper's highpass
      const xoFreq = lower.lowpassFreq > 0 ? lower.lowpassFreq : upper.highpassFreq
      if (xoFreq > 0) {
        points.push({
          freq: xoFreq,
          lowerIdx: i,
          upperIdx: i + 1,
          label: `${ROLE_LABELS[lower.role] || lower.role} → ${ROLE_LABELS[upper.role] || upper.role}`,
        })
      }
    }
    return points
  }, [bands, ways])

  // Compute phase for each band using exact biquad transfer function evaluation
  const bandPhases = useMemo(() => {
    const SAMPLE_RATE = 48000
    const results: { freq: number[]; phase: number[] }[] = []
    for (let i = 0; i < ways && i < bands.length; i++) {
      const band = bands[i]!
      const phases: number[] = []

      // Build the crossover filters for this band (for phase computation)
      let lpFilter = null
      let hpFilter = null
      if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
        lpFilter = buildCrossoverFilter(band.lowpassType as CrossoverType, band.lowpassFreq, false, SAMPLE_RATE)
      }
      if (band.highpassFreq > 0) {
        hpFilter = buildCrossoverFilter(band.highpassType as CrossoverType, band.highpassFreq, true, SAMPLE_RATE)
      }

      for (const f of freqs) {
        // Exact filter phase from biquad sections (in radians)
        let phaseRad = 0
        if (hpFilter) phaseRad += filterPhaseRad(hpFilter, f, SAMPLE_RATE)
        if (lpFilter) phaseRad += filterPhaseRad(lpFilter, f, SAMPLE_RATE)

        // Polarity adds π radians (180°)
        if (band.polarity === 180) phaseRad += Math.PI

        // Delay adds phase = -2πf*delay (delay in ms → s)
        if (band.delay > 0) phaseRad += -2 * Math.PI * f * band.delay * 0.001

        // Convert to degrees and normalize to [-180, 180]
        let phaseDeg = (phaseRad * 180) / Math.PI
        phaseDeg = ((phaseDeg % 360) + 540) % 360 - 180

        phases.push(phaseDeg)
      }

      results.push({ freq: freqs, phase: phases })
    }
    return results
  }, [bands, ways, freqs])

  if (crossoverPoints.length === 0) return null

  // Diagram dimensions
  const width = 600
  const height = 200
  const margin = { top: 12, right: 120, bottom: 35, left: 45 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  function xToPixel(freq: number): number {
    const x = Math.log10(Math.max(freq, 1))
    const xMin = Math.log10(20)
    const xMax = Math.log10(20000)
    return margin.left + ((x - xMin) / (xMax - xMin)) * plotW
  }

  function yToPixel(phase: number): number {
    return margin.top + ((90 - phase) / 180) * plotH
  }

  const decades = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const phaseGrid = [-180, -90, 0, 90, 180]
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6']

  return (
    <Card title="Fase justering (delingsfilter)">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Viser faseforløb for hvert bånd. Ved delingsfrekvensen bør de to tilstødende bands have
          fase så tæt på hinanden som muligt (helst 0° forskel). Justér polaritet og delay for at opnå kohærens.
        </p>

        {/* Phase plot */}
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 500 }}>
            <rect x={margin.left} y={margin.top} width={plotW} height={plotH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

            {phaseGrid.map((y) => (
              <g key={y}>
                <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
                <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">{y}°</text>
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
            <text x={14} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 14 ${margin.top + plotH / 2})`}>°</text>

            {/* Crossover frequency markers */}
            {crossoverPoints.map((xo, i) => (
              <g key={i}>
                <line x1={xToPixel(xo.freq)} y1={margin.top} x2={xToPixel(xo.freq)} y2={margin.top + plotH} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" opacity={0.5} />
                <text x={xToPixel(xo.freq)} y={margin.top - 2} textAnchor="middle" fontSize={8} className="fill-red-500">{xo.freq}Hz</text>
              </g>
            ))}

            {/* Phase curves */}
            {bandPhases.map((bp, i) => (
              <polyline
                key={i}
                points={bp.freq.map((f, j) => `${xToPixel(f)},${yToPixel(bp.phase[j]!)}`).join(' ')}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.5}
                opacity={0.8}
              />
            ))}

            {/* Legend */}
            <g>
              {bandPhases.map((_, i) => (
                <g key={i} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18 + 4})`}>
                  <line x1={0} y1={0} x2={15} y2={0} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                  <text x={20} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">
                    {ROLE_LABELS[bands[i]?.role] || bands[i]?.role || ''}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Per-crossover analysis + controls */}
        <div className="space-y-3">
          {crossoverPoints.map((xo, i) => {
            // Find phase difference at crossover frequency
            const lowerPhase = bandPhases[xo.lowerIdx]?.phase
            const upperPhase = bandPhases[xo.upperIdx]?.phase
            if (!lowerPhase || !upperPhase) return null

            const idx = freqs.findIndex((f) => f >= xo.freq)
            const lp = lowerPhase[idx] ?? 0
            const up = upperPhase[idx] ?? 0
            let diff = Math.abs(lp - up)
            if (diff > 180) diff = 360 - diff

            const good = diff < 30
            const ok = diff < 90

            return (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {xo.label} @ {xo.freq} Hz
                  </span>
                  <span className={`text-xs font-medium ${good ? 'text-green-600 dark:text-green-400' : ok ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    Δφ = {diff.toFixed(0)}° {good ? '✓' : ok ? '⚠' : '✗'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">{ROLE_LABELS[bands[xo.lowerIdx]?.role] || ''}</span>
                    <Select
                      value={bands[xo.lowerIdx]?.polarity ?? 0}
                      onChange={(v) => onPolarityChange(xo.lowerIdx, parseInt(v) as 0 | 180)}
                      options={[
                        { value: 0, label: '0°' },
                        { value: 180, label: '180°' },
                      ]}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">{ROLE_LABELS[bands[xo.upperIdx]?.role] || ''}</span>
                    <Select
                      value={bands[xo.upperIdx]?.polarity ?? 0}
                      onChange={(v) => onPolarityChange(xo.upperIdx, parseInt(v) as 0 | 180)}
                      options={[
                        { value: 0, label: '0°' },
                        { value: 180, label: '180°' },
                      ]}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
