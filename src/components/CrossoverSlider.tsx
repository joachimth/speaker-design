// Crossover frequency slider with linked bands and live phase display
//
// Shows one slider per crossover point (e.g. bass↔mid, mid↔tweeter).
// Dragging the slider moves both the lower band's lowpass AND the upper
// band's highpass simultaneously, so they stay linked.
// Also shows the phase relationship at the crossover frequency in real-time.

import { useMemo } from 'react'
import { Card, Select } from '@/components/common/UI'
import { buildCrossoverFilter } from '@/lib/acoustic/crossover'
import type { CrossoverType, DesignBand } from '@/types'

interface Props {
  bands: DesignBand[]
  ways: 2 | 3 | 4
  onCrossoverFreqChange: (lowerIdx: number, freq: number) => void
  onCrossoverTypeChange: (lowerIdx: number, type: CrossoverType) => void
}

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  mid2: 'Mellem 2',
  high: 'Diskant',
}

// Log-scale slider helpers (100 Hz - 20000 Hz)
const F_MIN = 100
const F_MAX = 20000

function freqToSlider(freq: number): number {
  const f = Math.max(F_MIN, Math.min(F_MAX, freq))
  return Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN)
}

function sliderToFreq(value: number): number {
  const f = F_MIN * Math.pow(F_MAX / F_MIN, value)
  return Math.round(f / 10) * 10 // round to nearest 10 Hz
}

// Compute phase at a specific frequency from a crossover filter
function phaseAtFreq(type: CrossoverType, freq: number, isHighpass: boolean, atFreq: number): number {
  const sampleRate = 48000
  const filter = buildCrossoverFilter(type, freq, isHighpass, sampleRate)

  // Compute phase analytically from the biquad sections
  const sections = filter.sections
  let totalPhase = 0
  const w = (2 * Math.PI * atFreq) / sampleRate

  for (const s of sections) {
    // Evaluate H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
    // z = e^(jw), a0 = 1 (normalized)
    const cosW = Math.cos(w)
    const sinW = Math.sin(w)
    const cos2W = Math.cos(2 * w)
    const sin2W = Math.sin(2 * w)

    // Numerator: b0 + b1*e^(-jw) + b2*e^(-j2w)
    const numRe = s.b0 + s.b1 * cosW + s.b2 * cos2W
    const numIm = -(s.b1 * sinW + s.b2 * sin2W)

    // Denominator: 1 + a1*e^(-jw) + a2*e^(-j2w)
    const denRe = 1 + s.a1 * cosW + s.a2 * cos2W
    const denIm = -(s.a1 * sinW + s.a2 * sin2W)

    // Phase = atan2(numIm, numRe) - atan2(denIm, denRe)
    totalPhase += Math.atan2(numIm, numRe) - Math.atan2(denIm, denRe)
  }

  // Convert to degrees and normalize to [-180, 180]
  let phaseDeg = (totalPhase * 180) / Math.PI
  while (phaseDeg > 180) phaseDeg -= 360
  while (phaseDeg < -180) phaseDeg += 360

  return phaseDeg
}

// Compute phase difference between two adjacent bands at the crossover frequency
function phaseDifferenceAtXover(
  lowerBand: DesignBand,
  upperBand: DesignBand,
  xoverFreq: number,
): { lowerPhase: number; upperPhase: number; delta: number } {
  // Lower band: lowpass at xoverFreq
  let lowerPhase = 0
  if (lowerBand.lowpassFreq > 0) {
    lowerPhase = phaseAtFreq(lowerBand.lowpassType, lowerBand.lowpassFreq, false, xoverFreq)
  }

  // Upper band: highpass at xoverFreq
  let upperPhase = 0
  if (upperBand.highpassFreq > 0) {
    upperPhase = phaseAtFreq(upperBand.highpassType, upperBand.highpassFreq, true, xoverFreq)
  }

  // Add polarity inversion
  if (lowerBand.polarity === 180) lowerPhase += 180
  if (upperBand.polarity === 180) upperPhase += 180

  // Add delay phase shift (at crossover frequency)
  // phase = -360 * f * delay_ms * 0.001 (in degrees)
  if (lowerBand.delay > 0) lowerPhase -= 360 * xoverFreq * lowerBand.delay * 0.001
  if (upperBand.delay > 0) upperPhase -= 360 * xoverFreq * upperBand.delay * 0.001

  // Normalize
  while (lowerPhase > 180) lowerPhase -= 360
  while (lowerPhase < -180) lowerPhase += 360
  while (upperPhase > 180) upperPhase -= 360
  while (upperPhase < -180) upperPhase += 360

  let delta = upperPhase - lowerPhase
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360

  return { lowerPhase, upperPhase, delta }
}

// Mini phase visualization (SVG arc showing phase relationship)
function PhaseVis({ delta }: { delta: number }) {
  const absDelta = Math.abs(delta)
  const color = absDelta < 15 ? '#10b981' : absDelta < 45 ? '#f59e0b' : '#ef4444'
  const radius = 24
  const cx = 30
  const cy = 30

  // Draw two arrows: lower at 0°, upper at delta°
  const lowerAngle = 0
  const upperAngle = (delta * Math.PI) / 180

  const lowerX = cx + radius * Math.cos(lowerAngle - Math.PI / 2)
  const lowerY = cy + radius * Math.sin(lowerAngle - Math.PI / 2)
  const upperX = cx + radius * Math.cos(upperAngle - Math.PI / 2)
  const upperY = cy + radius * Math.sin(upperAngle - Math.PI / 2)

  return (
    <svg width="60" height="60" className="inline-block">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-700" />
      <line x1={cx} y1={cy} x2={lowerX} y2={lowerY} stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={upperX} y2={upperY} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="2" fill="#6b7280" />
    </svg>
  )
}

export function CrossoverSlider({ bands, ways, onCrossoverFreqChange, onCrossoverTypeChange }: Props) {
  const numXovers = ways - 1

  const crossoverData = useMemo(() => {
    const points: {
      lowerIdx: number
      upperIdx: number
      freq: number
      type: CrossoverType
      lowerRole: string
      upperRole: string
      phase: { lowerPhase: number; upperPhase: number; delta: number }
    }[] = []

    for (let i = 0; i < numXovers && i < bands.length - 1; i++) {
      const lower = bands[i]!
      const upper = bands[i + 1]!
      const freq = lower.lowpassFreq > 0 ? lower.lowpassFreq : upper.highpassFreq
      const type = lower.lowpassFreq > 0 ? lower.lowpassType : upper.highpassType
      const phase = phaseDifferenceAtXover(lower, upper, freq)
      points.push({
        lowerIdx: i,
        upperIdx: i + 1,
        freq,
        type,
        lowerRole: ROLE_LABELS[lower.role] || lower.role,
        upperRole: ROLE_LABELS[upper.role] || upper.role,
        phase,
      })
    }

    return points
  }, [bands, ways, numXovers])

  if (crossoverData.length === 0) return null

  return (
    <Card title="Delefrekvens slider">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Træk i slideren for at flytte delefrekvensen. Begge filtre opdateres samtidig (linket).
          Faseforskellen vises i realtid — grøn = i fase, gul = acceptabel, rød = misalignering.
        </p>

        {crossoverData.map((xo, idx) => {
          const sliderValue = freqToSlider(xo.freq)
          const absDelta = Math.abs(xo.phase.delta)

          return (
            <div key={idx} className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {xo.lowerRole} ↔ {xo.upperRole}
                  </span>
                  <PhaseVis delta={xo.phase.delta} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {xo.freq >= 1000 ? `${(xo.freq / 1000).toFixed(2)} kHz` : `${xo.freq} Hz`}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        absDelta < 15
                          ? 'text-green-600 dark:text-green-400'
                          : absDelta < 45
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      Δφ = {xo.phase.delta.toFixed(0)}°
                    </div>
                  </div>
                </div>
              </div>

              {/* Log-scale slider */}
              <div className="relative px-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={sliderValue}
                  onChange={(e) => onCrossoverFreqChange(xo.lowerIdx, sliderToFreq(parseFloat(e.target.value)))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>100 Hz</span>
                  <span>1 kHz</span>
                  <span>10 kHz</span>
                  <span>20 kHz</span>
                </div>
              </div>

              {/* Crossover type selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Filter type:</span>
                <Select
                  value={xo.type}
                  onChange={(v) => onCrossoverTypeChange(xo.lowerIdx, v as CrossoverType)}
                  options={[
                    { value: 'LR4', label: 'LR4 (24 dB/okt)' },
                    { value: 'LR2', label: 'LR2 (12 dB/okt)' },
                    { value: 'LR8', label: 'LR8 (48 dB/okt)' },
                    { value: 'BW4', label: 'BW4 (24 dB/okt)' },
                    { value: 'BW2', label: 'BW2 (12 dB/okt)' },
                    { value: 'BW1', label: 'BW1 (6 dB/okt)' },
                    { value: 'first_order', label: '1. orden (6 dB/okt)' },
                  ]}
                  className="flex-1 max-w-[200px]"
                />
              </div>

              {/* Phase details */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-center">
                  <div className="text-gray-500">{xo.lowerRole} fase</div>
                  <div className="font-medium text-blue-700 dark:text-blue-300">{xo.phase.lowerPhase.toFixed(0)}°</div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-center">
                  <div className="text-gray-500">Forskel</div>
                  <div
                    className={`font-medium ${
                      absDelta < 15
                        ? 'text-green-600 dark:text-green-400'
                        : absDelta < 45
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {xo.phase.delta.toFixed(0)}°
                  </div>
                </div>
                <div className="rounded bg-orange-50 dark:bg-orange-900/20 px-2 py-1 text-center">
                  <div className="text-gray-500">{xo.upperRole} fase</div>
                  <div className="font-medium text-orange-700 dark:text-orange-300">{xo.phase.upperPhase.toFixed(0)}°</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
