// Multi-subwoofer alignment card
//
// Lets the user input multiple subwoofers with their distances from
// the listening position, then computes time alignment delays.

import { useState, useMemo } from 'react'
import { Card, Button, NumberInput, Badge, StatCard } from '@/components/common/UI'
import { alignSubwoofers, subDelaysToSamples, type SubParams } from '@/lib/acoustic/multiSub'

export function MultiSubAlignmentCard() {
  const [subs, setSubs] = useState<SubParams[]>([
    { label: 'Sub 1', distance: 3.0 },
    { label: 'Sub 2', distance: 4.5 },
  ])

  const result = useMemo(() => alignSubwoofers(subs), [subs])
  const samples = useMemo(() => subDelaysToSamples(result), [result])

  function addSub() {
    setSubs([...subs, { label: `Sub ${subs.length + 1}`, distance: 3.0 }])
  }

  function removeSub(idx: number) {
    if (subs.length <= 1) return
    setSubs(subs.filter((_, i) => i !== idx))
  }

  function updateSub(idx: number, patch: Partial<SubParams>) {
    const newSubs = [...subs]
    newSubs[idx] = { ...newSubs[idx]!, ...patch }
    setSubs(newSubs)
  }

  return (
    <Card title="Multi-subwoofer justering">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Tidsjuster flere subwoofere relativt til lyttepositionen.
          Den længst væk er reference (0 ms delay), de andre forsinkes.
        </p>

        {subs.map((sub, i) => {
          const aligned = result.subs[i]
          const samp = samples[i]
          return (
            <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={sub.label}
                  onChange={(e) => updateSub(i, { label: e.target.value })}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 mr-2"
                />
                {aligned?.label === result.referenceLabel && (
                  <Badge color="blue">Reference</Badge>
                )}
                {subs.length > 1 && (
                  <button
                    onClick={() => removeSub(i)}
                    className="ml-2 text-red-500 hover:text-red-700 text-sm"
                    aria-label={`Fjern subwoofer ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <NumberInput
                  label="Afstand"
                  unit="m"
                  value={sub.distance}
                  step={0.1}
                  min={0.1}
                  onChange={(v) => updateSub(i, { distance: v })}
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Delay</label>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {aligned?.delayMs.toFixed(2) ?? '0'} ms
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Samples</label>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {samp?.samples ?? 0}
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sub.inverted ?? false}
                      onChange={(e) => updateSub(i, { inverted: e.target.checked })}
                      className="accent-blue-500"
                    />
                    Invert polaritet
                  </label>
                </div>
              </div>
            </div>
          )
        })}

        <Button onClick={addSub} variant="secondary" size="sm">
          + Tilføj subwoofer
        </Button>

        {result.subs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <StatCard label="Reference" value={result.referenceLabel} unit="" />
            <StatCard label="Max delay" value={result.maxDelay.toFixed(2)} unit="ms" />
            <StatCard label="Antal subwoofere" value={result.subs.length} unit="" />
          </div>
        )}

        <p className="text-xs text-gray-400">
          Hastighed af lyd: {result.speedOfSound} m/s. Delay = (afstand forskel) / lydhastighed.
          Samples ved 48 kHz. Indstil delay i MiniDSP eller DSP som samples eller ms.
        </p>
      </div>
    </Card>
  )
}
