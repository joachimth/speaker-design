import { useState } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select, NumberInput, Badge } from '@/components/common/UI'
import { buildCrossoverFilter, applyCrossover, crossoverSlopeDbPerOctave } from '@/lib/acoustic/crossover'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import type { CrossoverType } from '@/types'

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
  high: 'Diskant',
}

export default function CrossoverDesigner() {
  const { drivers } = useDriverStore()
  const [ways, setWays] = useState<2 | 3 | 4>(3)
  const [bands, setBands] = useState<{
    driverId: string
    role: 'low' | 'mid' | 'high'
    lowpassFreq: number
    lowpassType: CrossoverType
    highpassFreq: number
    highpassType: CrossoverType
    gain: number
    polarity: 0 | 180
    delay: number
  }[]>([
    { driverId: '', role: 'low', lowpassFreq: 150, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
    { driverId: '', role: 'mid', lowpassFreq: 1250, lowpassType: 'LR4', highpassFreq: 150, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
    { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 1250, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  ])

  // Adjust bands when ways changes
  function handleWaysChange(value: string) {
    const n = parseInt(value) as 2 | 3 | 4
    setWays(n)
    if (n === 2 && bands.length > 2) {
      setBands(bands.slice(0, 2).map((b, i) => ({ ...b, role: i === 0 ? 'low' : 'high' })))
    } else if (n === 4 && bands.length < 4) {
      setBands([...bands, { driverId: '', role: 'mid', lowpassFreq: 5000, lowpassType: 'LR4', highpassFreq: 1250, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 }])
    }
  }

  function updateBand(index: number, updates: Partial<typeof bands[0]>) {
    setBands(bands.map((b, i) => (i === index ? { ...b, ...updates } : b)))
  }

  // Generate preview curves (computed for future plot integration)
  const freqs = generateFrequencies(20, 20000, 12)
  void freqs // will be used for plot preview
  void buildCrossoverFilter
  void applyCrossover

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delingsfilter</h2>

      <Card title="Systemkonfiguration">
        <Select
          label="Antal veje"
          value={ways}
          onChange={handleWaysChange}
          options={WAYS_OPTIONS}
        />
      </Card>

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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-3 gap-3">
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
    </div>
  )
}
