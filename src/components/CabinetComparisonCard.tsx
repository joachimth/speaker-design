// Cabinet parameter comparison card
//
// Shows sealed, ported, and transmission line alignments side-by-side for
// the selected driver, so the user can compare Vb, F3, Fb, etc. at a glance.

import { useMemo } from 'react'
import type { Driver } from '@/types'
import { calcSealed, calcPorted, calcTransmissionLine, calcPort } from '@/lib/acoustic/thieleSmall'
import { Card } from '@/components/common/UI'

interface Props {
  driver: Driver | undefined
}

export function CabinetComparisonCard({ driver }: Props) {
  const results = useMemo(() => {
    if (!driver?.tsParams?.qts || !driver.tsParams.vas) return null
    const ts = driver.tsParams

    const sealed = calcSealed(ts, 0.707)
    const sealedLowQ = calcSealed(ts, 0.577)
    const sealedHighQ = calcSealed(ts, 1.0)
    const ported = calcPorted(ts)
    const portPort = calcPort(ported.vb, ported.fb, 60, 1)
    const tl = calcTransmissionLine(ts)

    return { sealed, sealedLowQ, sealedHighQ, ported, portPort, tl, ts }
  }, [driver])

  if (!results) return null

  const { sealed, sealedLowQ, sealedHighQ, ported, portPort, tl, ts } = results

  return (
    <Card title="Kabinet sammenligning">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-500 font-medium">Parameter</th>
              <th className="text-left py-2 pr-4 font-medium text-blue-600 dark:text-blue-400">Sealed (Qtc 0.707)</th>
              <th className="text-left py-2 pr-4 font-medium text-cyan-600 dark:text-cyan-400">Sealed (Qtc 0.577)</th>
              <th className="text-left py-2 pr-4 font-medium text-indigo-600 dark:text-indigo-400">Sealed (Qtc 1.0)</th>
              <th className="text-left py-2 pr-4 font-medium text-orange-600 dark:text-orange-400">Ported ({ported.alignmentType})</th>
              <th className="text-left py-2 font-medium text-green-600 dark:text-green-400">Trans. Line</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Vb (volumen)" sealed={`${sealed.vb.toFixed(1)} L`} sealedLow={`${sealedLowQ.vb.toFixed(1)} L`} sealedHigh={`${sealedHighQ.vb.toFixed(1)} L`} ported={`${ported.vb.toFixed(1)} L`} tl={`—`} />
            <Row label="Fc / Fb" sealed={`${sealed.fc.toFixed(0)} Hz`} sealedLow={`${sealedLowQ.fc.toFixed(0)} Hz`} sealedHigh={`${sealedHighQ.fc.toFixed(0)} Hz`} ported={`${ported.fb.toFixed(0)} Hz`} tl={`${(ts.fs * 0.85).toFixed(0)} Hz`} />
            <Row label="F3 (-3dB)" sealed={`${sealed.f3.toFixed(0)} Hz`} sealedLow={`${sealedLowQ.f3.toFixed(0)} Hz`} sealedHigh={`${sealedHighQ.f3.toFixed(0)} Hz`} ported={`${ported.f3.toFixed(0)} Hz`} tl={`${(ts.fs * 0.6).toFixed(0)} Hz`} />
            <Row label="Qtc" sealed={sealed.qtc.toFixed(3)} sealedLow={sealedLowQ.qtc.toFixed(3)} sealedHigh={sealedHighQ.qtc.toFixed(3)} ported={`—`} tl={`—`} />
            <Row label="Port længde" sealed={`—`} sealedLow={`—`} sealedHigh={`—`} ported={`${portPort.portLength.toFixed(0)} mm`} tl={`—`} />
            <Row label="Line længde" sealed={`—`} sealedLow={`—`} sealedHigh={`—`} ported={`—`} tl={`${tl.lineLength} mm`} />
            <Row label="Line areal" sealed={`—`} sealedLow={`—`} sealedHigh={`—`} ported={`—`} tl={`${tl.lineArea} mm²`} />
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-gray-500">
        Qtc 0.707 = mest flad (Butterworth). Qtc 0.577 = bedste transient (Bessel). Qtc 1.0 = maksimal bas (mindre flad).
        Ported giver dybere F3 men kræver større kabinet. Trans. line giver dyb bas uden port-støj men kræver meget plads.
      </div>
    </Card>
  )
}

function Row({ label, sealed, sealedLow, sealedHigh, ported, tl }: {
  label: string
  sealed: string
  sealedLow: string
  sealedHigh: string
  ported: string
  tl: string
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 text-gray-500">{label}</td>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{sealed}</td>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{sealedLow}</td>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{sealedHigh}</td>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{ported}</td>
      <td className="py-2 text-gray-700 dark:text-gray-300">{tl}</td>
    </tr>
  )
}
