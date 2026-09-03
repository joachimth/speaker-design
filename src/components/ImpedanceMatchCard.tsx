// Impedance matching card — shows impedance compatibility at each crossover point

import { useMemo } from 'react'
import { Card, Badge } from '@/components/common/UI'
import { checkImpedanceMatch } from '@/lib/acoustic/impedanceMatch'
import type { Driver, DesignBand } from '@/types'

interface Props {
  bands: DesignBand[]
  ways: 2 | 3 | 4
  drivers: Driver[]
}

export function ImpedanceMatchCard({ bands, ways, drivers }: Props) {
  const matchResults = useMemo(() => {
    const results: ReturnType<typeof checkImpedanceMatch>[] = []
    for (let i = 0; i < ways - 1 && i < bands.length - 1; i++) {
      const lower = bands[i]!
      const upper = bands[i + 1]!
      const lowerDriver = drivers.find((d) => d.id === lower.driverId)
      const upperDriver = drivers.find((d) => d.id === upper.driverId)
      if (!lowerDriver || !upperDriver) continue
      const xoFreq = lower.lowpassFreq > 0 ? lower.lowpassFreq : upper.highpassFreq
      if (xoFreq <= 0) continue
      results.push(checkImpedanceMatch(lowerDriver, upperDriver, xoFreq))
    }
    return results
  }, [bands, ways, drivers])

  if (matchResults.length === 0) return null

  return (
    <Card title="Impedans match ved delefilter">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Tjek om driver-impedansen er kompatibel ved hvert delefilter-punkt.
          Store mismatch påvirker filterets Q og virkemåde.
        </p>
        {matchResults.map((r, i) => (
          <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {r.lowerLabel} ↔ {r.upperLabel}
              </span>
              <Badge color={r.rating === 'good' ? 'green' : r.rating === 'acceptable' ? 'orange' : 'red'}>
                {r.rating === 'good' ? 'God' : r.rating === 'acceptable' ? 'Acceptabel' : 'Poor'}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center rounded bg-blue-50 dark:bg-blue-900/20 px-2 py-1">
                <div className="text-gray-500">{r.lowerLabel.split(' ').slice(-2).join(' ')}</div>
                <div className="font-medium text-blue-700 dark:text-blue-300">{r.lowerImpedance.toFixed(1)}Ω</div>
              </div>
              <div className="text-center rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                <div className="text-gray-500">@ {r.crossoverFreq >= 1000 ? `${(r.crossoverFreq / 1000).toFixed(1)}k` : r.crossoverFreq}Hz</div>
                <div className="font-medium text-gray-700 dark:text-gray-300">Δ{r.mismatch.toFixed(0)}%</div>
              </div>
              <div className="text-center rounded bg-orange-50 dark:bg-orange-900/20 px-2 py-1">
                <div className="text-gray-500">{r.upperLabel.split(' ').slice(-2).join(' ')}</div>
                <div className="font-medium text-orange-700 dark:text-orange-300">{r.upperImpedance.toFixed(1)}Ω</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">{r.description}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
