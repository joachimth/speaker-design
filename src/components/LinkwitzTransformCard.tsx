// Linkwitz Transform card — sealed enclosure EQ
//
// Lets the user set a target Fp/Qp for a sealed woofer/subwoofer
// and shows the transform curve + biquad coefficients.

import { useMemo, useState } from 'react'
import { Card, Button, NumberInput, Select, Badge } from '@/components/common/UI'
import { linkwitzTransform, linkwitzResponse, sealedAlignment } from '@/lib/acoustic/linkwitzTransform'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { ResponsivePlot } from '@/components/charts/ResponsivePlot'
import type { Driver } from '@/types'

interface Props {
  /** Low-frequency driver (woofer/subwoofer) */
  driver: Driver | null
  /** Sealed box volume in liters */
  boxVolume: number
}

export function LinkwitzTransformCard({ driver, boxVolume }: Props) {
  const [fp, setFp] = useState(30) // target frequency
  const [qp, setQp] = useState(0.707) // target Q (Butterworth)
  const [showBiquad, setShowBiquad] = useState(false)

  const freqs = useMemo(() => generateFrequencies(10, 500, 24), [])

  const alignment = useMemo(() => {
    if (!driver) return null
    const ts = driver.tsParams
    return sealedAlignment(ts.fs, ts.qts, ts.vas, boxVolume)
  }, [driver, boxVolume])

  const transformData = useMemo(() => {
    if (!driver || !alignment) return null
    const { magnitude } = linkwitzResponse(
      { f0: alignment.f0, q0: alignment.q0, fp, qp },
      freqs,
    )
    return { freq: freqs, mag: magnitude }
  }, [driver, alignment, fp, qp, freqs])

  const biquadCoeffs = useMemo(() => {
    if (!driver || !alignment) return null
    return linkwitzTransform({ f0: alignment.f0, q0: alignment.q0, fp, qp })
  }, [driver, alignment, fp, qp])

  if (!driver || !alignment) {
    return (
      <Card title="Linkwitz Transform (sealed EQ)">
        <p className="text-sm text-gray-500">Vælg en bas-enhed for at bruge Linkwitz Transform.</p>
      </Card>
    )
  }

  return (
    <Card title="Linkwitz Transform (sealed EQ)">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Elektronisk transformering af en lukket kabinets respons. Sænker både
          afskæringsfrekvens og Q for dybere og mere kontrolleret bas.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge color="blue">Original: F₀={alignment.f0.toFixed(0)}Hz, Q₀={alignment.q0.toFixed(2)}</Badge>
          <Badge color="green">Mål: Fp={fp}Hz, Qp={qp.toFixed(3)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Mål frekvens (Fp)"
            unit="Hz"
            value={fp}
            step={1}
            min={10}
            max={200}
            onChange={setFp}
          />
          <Select
            label="Mål Q (Qp)"
            value={qp}
            onChange={(v) => setQp(parseFloat(v))}
            options={[
              { value: 0.5, label: '0.500 (Critically damped)' },
              { value: 0.707, label: '0.707 (Butterworth)' },
              { value: 0.8, label: '0.800' },
              { value: 1.0, label: '1.000' },
              { value: 1.1, label: '1.100 (Chebyshev)' },
            ]}
          />
        </div>

        {transformData && (
          <ResponsivePlot
            data={[{
              x: transformData.freq,
              y: transformData.mag,
              name: 'LT gain',
              color: '#10b981',
            }]}
            yRange={[-6, 18]}
            yLabel="dB"
          />
        )}

        <p className="text-xs text-gray-400">
          Transformeringen kræver mere forstærker-effekt ved lavere frekvenser.
          Sikr at enheden har nok Xmax og effektig tålighed.
        </p>

        <Button onClick={() => setShowBiquad(!showBiquad)} variant="secondary" size="sm">
          {showBiquad ? 'Skjul biquad' : 'Vis biquad koefficienter'}
        </Button>

        {showBiquad && biquadCoeffs && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Biquad koefficienter (48 kHz) til MiniDSP:
            </p>
            {biquadCoeffs.map((c, i) => (
              <div key={i} className="p-2 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
                <div className="text-gray-500 mb-1">Section {i + 1}:</div>
                <div className="grid grid-cols-5 gap-1">
                  <span>b0: {c.b0.toFixed(8)}</span>
                  <span>b1: {c.b1.toFixed(8)}</span>
                  <span>b2: {c.b2.toFixed(8)}</span>
                  <span>a1: {c.a1.toFixed(8)}</span>
                  <span>a2: {c.a2.toFixed(8)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
