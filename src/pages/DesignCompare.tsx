// Design A/B comparison page
//
// Select two saved projects and compare their simulated frequency response
// side-by-side on the same plot, with a table of key metrics.

import { useState, useMemo, useEffect } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select } from '@/components/common/UI'
import { ResponsivePlot } from '@/components/charts/ResponsivePlot'
import { simulateDesign } from '@/lib/acoustic/designCompare'

const COLORS_A = ['#f97316', '#fbbf24', '#fde68a']
const COLORS_B = ['#3b82f6', '#6366f1', '#a5b4fc']

export default function DesignCompare() {
  const { projects, loadProjects } = useProjectStore()
  const { drivers } = useDriverStore()
  const [projAId, setProjAId] = useState<string>('')
  const [projBId, setProjBId] = useState<string>('')

  // Load projects on mount — without this, projects are empty unless
  // the user visited the Overblik page first
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const projA = useMemo(() => projects.find((p) => p.id === projAId), [projects, projAId])
  const projB = useMemo(() => projects.find((p) => p.id === projBId), [projects, projBId])

  const simA = useMemo(() => {
    if (!projA?.designState) return null
    return simulateDesign(projA.designState, drivers)
  }, [projA, drivers])

  const simB = useMemo(() => {
    if (!projB?.designState) return null
    return simulateDesign(projB.designState, drivers)
  }, [projB, drivers])

  // Build combined plot series
  const plotSeries = useMemo(() => {
    const series: { x: number[]; y: number[]; name: string; color: string; dash?: boolean }[] = []
    if (simA) {
      series.push({ x: simA.freq, y: simA.summed, name: `${projA?.name ?? 'A'} (sum)`, color: '#f97316' })
      simA.bands.forEach((b, i) => {
        series.push({ x: b.freq, y: b.mag, name: b.name, color: COLORS_A[i % COLORS_A.length]! })
      })
    }
    if (simB) {
      series.push({ x: simB.freq, y: simB.summed, name: `${projB?.name ?? 'B'} (sum)`, color: '#3b82f6', dash: true })
      simB.bands.forEach((b, i) => {
        series.push({ x: b.freq, y: b.mag, name: b.name, color: COLORS_B[i % COLORS_B.length]!, dash: true })
      })
    }
    return series
  }, [simA, simB, projA, projB])

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.designState?.ways ?? '?'}-vejs)`,
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Design sammenligning (A/B)</h2>

      <Card title="Vælg projekter">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Design A</label>
            <Select
              value={projAId}
              onChange={setProjAId}
              options={[{ value: '', label: '— Vælg projekt —' }, ...projectOptions]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Design B</label>
            <Select
              value={projBId}
              onChange={setProjBId}
              options={[{ value: '', label: '— Vælg projekt —' }, ...projectOptions]}
            />
          </div>
        </div>
        {projects.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">
            Ingen gemte projekter. Gem et design under System Simulering først.
          </p>
        )}
      </Card>

      {/* Metrics comparison */}
      {(simA || simB) && (
        <Card title="Sammenligning">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Parameter</th>
                  <th className="text-left py-2 pr-4 font-medium text-orange-600 dark:text-orange-400">{projA?.name ?? 'A'}</th>
                  <th className="text-left py-2 font-medium text-blue-600 dark:text-blue-400">{projB?.name ?? 'B'}</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Antal veje" a={simA?.metrics.bandCount?.toString()} b={simB?.metrics.bandCount?.toString()} />
                <MetricRow label="Enheder" a={simA?.metrics.driverCount?.toString()} b={simB?.metrics.driverCount?.toString()} />
                <MetricRow label="F3 (lav)" a={simA?.metrics.f3Low ? `${simA.metrics.f3Low.toFixed(0)} Hz` : '—'} b={simB?.metrics.f3Low ? `${simB.metrics.f3Low.toFixed(0)} Hz` : '—'} />
                <MetricRow label="Max SPL" a={simA?.metrics.maxDb != null ? `${simA.metrics.maxDb.toFixed(1)} dB` : '—'} b={simB?.metrics.maxDb != null ? `${simB.metrics.maxDb.toFixed(1)} dB` : '—'} />
                <MetricRow
                  label="Kabinet"
                  a={projA?.designState?.cabinetType}
                  b={projB?.designState?.cabinetType}
                />
                <MetricRow
                  label="Baffel"
                  a={projA?.designState ? `${projA.designState.baffleWidth}×${projA.designState.baffleHeight}mm` : '—'}
                  b={projB?.designState ? `${projB.designState.baffleWidth}×${projB.designState.baffleHeight}mm` : '—'}
                />
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Frequency response plot */}
      {plotSeries.length > 0 && (
        <Card title="Frekvensrespons">
          <ResponsivePlot data={plotSeries} yLabel="dB SPL" />
        </Card>
      )}

      {/* Difference plot */}
      {simA && simB && (
        <Card title="Forskel (A - B)">
          <ResponsivePlot
            data={[{
              x: simA.freq,
              y: simA.summed.map((v, i) => v - (simB.summed[i] ?? 0)),
              name: 'A minus B',
              color: '#8b5cf6',
            }]}
            yRange={[-20, 20]}
            yLabel="dB"
          />
        </Card>
      )}
    </div>
  )
}

function MetricRow({ label, a, b }: { label: string; a?: string; b?: string }) {
  const diff = a && b && a !== b
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 text-gray-500">{label}</td>
      <td className="py-2 pr-4">
        <span className={diff ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}>
          {a ?? '—'}
        </span>
      </td>
      <td className="py-2">
        <span className={diff ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>
          {b ?? '—'}
        </span>
      </td>
    </tr>
  )
}
