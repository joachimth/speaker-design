// Time alignment card for System Simulation
//
// Visualizes acoustic center depths for each band's driver and lets the
// user manually adjust delay to time-align the drivers. Shows the estimated
// acoustic center depth, the delay in mm and ms, and a simple baffle cross-section
// diagram with driver positions.

import { useMemo } from 'react'
import type { Driver } from '@/types'
import { acousticCenterDepth } from '@/lib/acoustic/autoDesign'
import { Card, NumberInput, Button } from '@/components/common/UI'

const C = 343000 // mm/s speed of sound

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
  drivers: Driver[]
  onDelayChange: (index: number, delayMs: number) => void
  onAutoAlign: () => void
}

const ROLE_COLORS: Record<string, string> = {
  low: '#f97316',
  mid: '#10b981',
  mid2: '#a855f7',
  high: '#3b82f6',
}

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  mid2: 'Mellem 2',
  high: 'Diskant',
}

export function TimeAlignmentCard({ bands, ways, drivers, onDelayChange, onAutoAlign }: Props) {
  const bandData = useMemo(() => {
    const data: { band: Band; driver?: Driver; depth: number; delayMs: number; delayMm: number }[] = []
    for (let i = 0; i < ways && i < bands.length; i++) {
      const band = bands[i]!
      const driver = drivers.find((d) => d.id === band.driverId)
      const depth = driver ? acousticCenterDepth(driver) : 40
      data.push({
        band,
        driver,
        depth,
        delayMs: band.delay,
        delayMm: band.delay * C / 1000,
      })
    }
    return data
  }, [bands, ways, drivers])

  const maxDepth = Math.max(...bandData.map((d) => d.depth), 1)

  // Diagram dimensions
  const diagramWidth = 600
  const diagramHeight = 200
  const baffleX = 80
  const maxBarLength = diagramWidth - baffleX - 40
  const scale = maxBarLength / Math.max(maxDepth, 100)

  return (
    <Card title="Tidsjustering (akustisk center)">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Akustisk center er der hvor lyden "fødes" i enheden. For at tidsjustere
          sættes delay så alle akustiske centre er i samme plan målt fra bafflen.
          Den dybeste enhed (ofte bas) får 0 ms delay, andre får delay = (dybde_forskel / lydhastighed).
        </p>

        <div className="flex gap-2">
          <Button onClick={onAutoAlign} variant="primary" size="sm">
            Auto justér delay
          </Button>
        </div>

        {/* Cross-section diagram */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 overflow-x-auto">
          <svg viewBox={`0 0 ${diagramWidth} ${diagramHeight}`} className="w-full" style={{ minWidth: 500 }}>
            {/* Baffle plane */}
            <line x1={baffleX} y1={20} x2={baffleX} y2={diagramHeight - 20} className="stroke-gray-400 dark:stroke-gray-500" strokeWidth={3} />
            <text x={baffleX} y={diagramHeight - 5} textAnchor="middle" fontSize={9} className="fill-gray-500">Baffel</text>

            {/* Direction of sound propagation */}
            <text x={baffleX + maxBarLength / 2} y={15} textAnchor="middle" fontSize={9} className="fill-gray-400">→ Lydretning</text>

            {/* Each band as a horizontal bar */}
            {bandData.map((d, i) => {
              const y = 35 + i * 40
              const barLength = d.depth * scale
              const color = ROLE_COLORS[d.band.role] ?? '#666'

              return (
                <g key={i}>
                  {/* Label */}
                  <text x={baffleX - 10} y={y + 4} textAnchor="end" fontSize={10} className="fill-gray-700 dark:fill-gray-300">
                    {ROLE_LABELS[d.band.role] || d.band.role}
                  </text>

                  {/* Acoustic center bar */}
                  <line x1={baffleX} y1={y} x2={baffleX + barLength} y2={y} stroke={color} strokeWidth={4} opacity={0.7} />

                  {/* Acoustic center marker */}
                  <circle cx={baffleX + barLength} cy={y} r={5} fill={color} />

                  {/* Depth label */}
                  <text x={baffleX + barLength + 8} y={y + 3} fontSize={9} className="fill-gray-600 dark:fill-gray-400">
                    {d.depth.toFixed(0)}mm
                  </text>

                  {/* Delay indicator */}
                  {d.delayMs > 0 && (
                    <text x={baffleX + barLength + 60} y={y + 3} fontSize={9} className="fill-brand-600 dark:text-brand-400">
                      delay {d.delayMs.toFixed(2)}ms
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Per-band delay controls */}
        <div className="space-y-3">
          {bandData.map((d, i) => {
            const color = ROLE_COLORS[d.band.role] ?? '#666'
            return (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {ROLE_LABELS[d.band.role] || d.band.role}
                  </span>
                </div>
                {d.driver && (
                  <span className="text-xs text-gray-500 flex-1 truncate">
                    {d.driver.manufacturer} {d.driver.model} · center {d.depth.toFixed(0)}mm bag baffel
                  </span>
                )}
                <NumberInput
                  label=""
                  unit="ms"
                  value={d.band.delay}
                  step={0.01}
                  min={0}
                  onChange={(v) => onDelayChange(i, Math.max(0, v))}
                  className="w-28"
                />
                <span className="text-xs text-gray-500">
                  = {(d.band.delay * C / 1000).toFixed(0)}mm forskydning
                </span>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {bandData.length >= 2 && (
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-3 space-y-1">
            <div className="text-xs text-brand-700 dark:text-brand-300">
              Dybeste center: {maxDepth.toFixed(0)}mm ({bandData.find((d) => d.depth === maxDepth)?.band.role === 'low' ? 'Bas' : 'Mellem/Treble'})
            </div>
            {(() => {
              const aligned = bandData.every((d) => {
                const expected = (maxDepth - d.depth) / C * 1000
                return Math.abs(d.band.delay - expected) < 0.02
              })
              return (
                <div className={`text-xs font-medium ${aligned ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {aligned ? '✓ Alle enheder er tidsjusteret' : '⚠ Delay svarer ikke til akustisk center forskydning'}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </Card>
  )
}
