// Per-band EQ filter editor card
//
// Lets the user add low-shelf, high-shelf, and PEQ filters to each band.
// EQ filters are applied after crossover filters and before gain/polarity,
// only on bands with active crossover filters in the current design.
//
// Biquad coefficients are generated using the RBJ Audio EQ Cookbook formulas
// (see crossover.ts: lowShelfBiquad, highShelfBiquad, peakingBiquad).

import { Card, Select, NumberInput, Button } from '@/components/common/UI'
import type { EQFilter, EQFilterKind } from '@/types'

interface Band {
  driverId: string
  role: 'low' | 'mid' | 'mid2' | 'high'
  gain: number
  polarity: 0 | 180
  delay: number
  lowpassFreq: number
  lowpassType: string
  highpassFreq: number
  highpassType: string
  eqFilters?: EQFilter[]
}

interface Props {
  bands: Band[]
  ways: 2 | 3 | 4
  onEqChange: (bandIndex: number, eqFilters: EQFilter[]) => void
}

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  mid2: 'Mellem 2',
  high: 'Diskant',
}

function genId(): string {
  return `eq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function EQFiltersCard({ bands, ways, onEqChange }: Props) {
  function addFilter(bandIndex: number, kind: EQFilterKind) {
    const band = bands[bandIndex]
    if (!band) return
    const current = band.eqFilters ?? []
    const newFilter: EQFilter = {
      id: genId(),
      kind,
      freq: kind === 'low_shelf' ? 200 : kind === 'high_shelf' ? 3000 : 1000,
      gain: 0,
      q: kind === 'peaking' ? 1.0 : 0.707,
      enabled: true,
    }
    onEqChange(bandIndex, [...current, newFilter])
  }

  function updateFilter(bandIndex: number, filterId: string, updates: Partial<EQFilter>) {
    const band = bands[bandIndex]
    if (!band || !band.eqFilters) return
    const updated = band.eqFilters.map((f) =>
      f.id === filterId ? { ...f, ...updates } : f,
    )
    onEqChange(bandIndex, updated)
  }

  function removeFilter(bandIndex: number, filterId: string) {
    const band = bands[bandIndex]
    if (!band || !band.eqFilters) return
    onEqChange(bandIndex, band.eqFilters.filter((f) => f.id !== filterId))
  }

  const activeBands = bands.slice(0, ways)

  return (
    <Card title="EQ filtre (per bånd)">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Tilføj low-shelf, high-shelf og PEQ filtre til hvert bånd. Filtrene anvendes
          efter delefilter og før gain. Kun bånd med aktive delefilter beregnes.
          Eksporter som biquad koefficienter til MiniDSP via Biquad Export.
        </p>

        {activeBands.map((band, bi) => {
          const hasActiveXover =
            (band.lowpassFreq > 0 && band.lowpassFreq < 20000) ||
            (band.highpassFreq > 0)
          const filters = band.eqFilters ?? []

          return (
            <div
              key={bi}
              className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {ROLE_LABELS[band.role] || band.role}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addFilter(bi, 'low_shelf')}
                    disabled={!hasActiveXover}
                    className="text-xs"
                  >
                    + Low Shelf
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addFilter(bi, 'high_shelf')}
                    disabled={!hasActiveXover}
                    className="text-xs"
                  >
                    + High Shelf
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => addFilter(bi, 'peaking')}
                    disabled={!hasActiveXover}
                    className="text-xs"
                  >
                    + PEQ
                  </Button>
                </div>
              </div>

              {!hasActiveXover && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Ingen aktive delefilter på dette bånd. EQ beregnes ikke.
                </p>
              )}

              {filters.length === 0 && hasActiveXover && (
                <p className="text-xs text-gray-400">Ingen EQ filtre. Klik + for at tilføje.</p>
              )}

              {filters.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-end gap-2 bg-gray-50 dark:bg-gray-750 rounded p-2"
                >
                  {/* Enable toggle */}
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 pb-1.5">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => updateFilter(bi, f.id, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    Aktiv
                  </label>

                  {/* Filter type */}
                  <div className="w-32">
                    <Select
                      value={f.kind}
                      onChange={(v) => updateFilter(bi, f.id, { kind: v as EQFilterKind })}
                      options={[
                        { value: 'low_shelf', label: 'Low Shelf' },
                        { value: 'high_shelf', label: 'High Shelf' },
                        { value: 'peaking', label: 'PEQ' },
                      ]}
                    />
                  </div>

                  {/* Frequency */}
                  <NumberInput
                    label="Freq"
                    unit="Hz"
                    value={f.freq}
                    step={10}
                    min={20}
                    max={20000}
                    onChange={(v) => updateFilter(bi, f.id, { freq: v })}
                    className="w-24"
                  />

                  {/* Gain */}
                  <NumberInput
                    label="Gain"
                    unit="dB"
                    value={f.gain}
                    step={0.5}
                    min={-18}
                    max={18}
                    onChange={(v) => updateFilter(bi, f.id, { gain: v })}
                    className="w-24"
                  />

                  {/* Q */}
                  <NumberInput
                    label="Q"
                    value={f.q}
                    step={0.1}
                    min={0.1}
                    max={10}
                    onChange={(v) => updateFilter(bi, f.id, { q: v })}
                    className="w-20"
                  />

                  {/* Remove */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => removeFilter(bi, f.id)}
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
