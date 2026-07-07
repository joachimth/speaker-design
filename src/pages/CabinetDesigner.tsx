import { useState, useMemo } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select, NumberInput, StatCard } from '@/components/common/UI'
import {
  calcSealed,
  calcPorted,
  calcPort,
  calcTransmissionLine,
  recommendCabinetType,
  calcInternalVolume,
} from '@/lib/acoustic/thieleSmall'
import type { CabinetType } from '@/types'

export default function CabinetDesigner() {
  const { drivers } = useDriverStore()
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '')
  const [cabinetType, setCabinetType] = useState<CabinetType>('sealed')
  const [qtcTarget, setQtcTarget] = useState(0.707)
  const [portDiameter, setPortDiameter] = useState(60)
  const [numPorts, setNumPorts] = useState(1)
  const [cabinetDims, setCabinetDims] = useState({
    width: 320,
    height: 1080,
    depth: 370,
    wallThickness: 22,
    baffleWidth: 320,
    baffleHeight: 1080,
    frontRoundoverRadius: 40,
  })

  // Fall back to the first driver: the store loads async, so drivers[0] is
  // not yet available when the initial selectedDriverId state is captured
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? drivers[0]

  const recommendation = useMemo(() => {
    if (!selectedDriver?.tsParams?.qts) return null
    return recommendCabinetType(selectedDriver.tsParams)
  }, [selectedDriver])

  const sealedResult = useMemo(() => {
    if (!selectedDriver?.tsParams?.qts || !selectedDriver.tsParams.vas) return null
    return calcSealed(selectedDriver.tsParams, qtcTarget)
  }, [selectedDriver, qtcTarget])

  const portedResult = useMemo(() => {
    if (!selectedDriver?.tsParams) return null
    return calcPorted(selectedDriver.tsParams)
  }, [selectedDriver])

  const portResult = useMemo(() => {
    if (!portedResult) return null
    return calcPort(portedResult.vb, portedResult.fb, portDiameter, numPorts)
  }, [portedResult, portDiameter, numPorts])

  const tlResult = useMemo(() => {
    if (!selectedDriver?.tsParams) return null
    return calcTransmissionLine(selectedDriver.tsParams)
  }, [selectedDriver])

  const internalVolume = useMemo(() => {
    return calcInternalVolume(
      cabinetDims.width,
      cabinetDims.height,
      cabinetDims.depth,
      cabinetDims.wallThickness
    )
  }, [cabinetDims])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kabinetdesign</h2>

      {/* Driver selection */}
      <Card title="Vælg enhed">
        <Select
          value={selectedDriver?.id || ''}
          onChange={setSelectedDriverId}
          options={drivers.map((d) => ({
            value: d.id,
            label: `${d.manufacturer} ${d.model} (${d.type})`,
          }))}
        />

        {recommendation && (
          <div className="mt-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-3">
            <div className="text-sm font-medium text-brand-800 dark:text-brand-200">
              Anbefaling: {recommendation.recommended}
            </div>
            <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">{recommendation.reason}</div>
            {recommendation.alternatives.length > 0 && (
              <div className="mt-2 space-y-1">
                {recommendation.alternatives.map((alt, i) => (
                  <div key={i} className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>{alt.type}:</strong> {alt.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Cabinet type selector */}
      <Card title="Kabinettype">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['sealed', 'ported', 'transmission_line', 'open_baffle'] as CabinetType[]).map((type) => (
            <button
              key={type}
              onClick={() => setCabinetType(type)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                cabinetType === type
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {type === 'sealed' ? 'Sealed' : type === 'ported' ? 'Ported' : type === 'transmission_line' ? 'Trans. Line' : 'Åben baffel'}
            </button>
          ))}
        </div>
      </Card>

      {/* Cabinet dimensions */}
      <Card title="Kabinetdimensioner">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberInput label="Bredde" unit="mm" value={cabinetDims.width} onChange={(v) => setCabinetDims({ ...cabinetDims, width: v })} />
          <NumberInput label="Højde" unit="mm" value={cabinetDims.height} onChange={(v) => setCabinetDims({ ...cabinetDims, height: v })} />
          <NumberInput label="Dybde" unit="mm" value={cabinetDims.depth} onChange={(v) => setCabinetDims({ ...cabinetDims, depth: v })} />
          <NumberInput label="Vægtykkelse" unit="mm" value={cabinetDims.wallThickness} onChange={(v) => setCabinetDims({ ...cabinetDims, wallThickness: v })} />
          <NumberInput label="Baffel bredde" unit="mm" value={cabinetDims.baffleWidth} onChange={(v) => setCabinetDims({ ...cabinetDims, baffleWidth: v })} />
          <NumberInput label="Baffel højde" unit="mm" value={cabinetDims.baffleHeight} onChange={(v) => setCabinetDims({ ...cabinetDims, baffleHeight: v })} />
          <NumberInput label="Afrunding" unit="mm" value={cabinetDims.frontRoundoverRadius} onChange={(v) => setCabinetDims({ ...cabinetDims, frontRoundoverRadius: v })} />
          <div className="flex items-end">
            <div className="bg-gray-50 dark:bg-gray-750 rounded-md p-2 w-full">
              <div className="text-xs text-gray-500">Intern volumen</div>
              <div className="text-lg font-semibold">{internalVolume.toFixed(1)} L</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Alignment results */}
      {cabinetType === 'sealed' && sealedResult && (
        <Card title="Sealed alignment">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput label="Mål Qtc" value={qtcTarget} step={0.01} min={0.5} max={1.5} onChange={setQtcTarget} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vb (volumen)" value={sealedResult.vb.toFixed(1)} unit="L" />
              <StatCard label="Fc (resonans)" value={sealedResult.fc.toFixed(1)} unit="Hz" />
              <StatCard label="Qtc" value={sealedResult.qtc.toFixed(3)} />
              <StatCard label="F3 (-3dB)" value={sealedResult.f3.toFixed(1)} unit="Hz" />
            </div>
          </div>
        </Card>
      )}

      {cabinetType === 'ported' && portedResult && portResult && (
        <Card title="Ported alignment">
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vb" value={portedResult.vb.toFixed(1)} unit="L" />
              <StatCard label="Fb (tuning)" value={portedResult.fb.toFixed(1)} unit="Hz" />
              <StatCard label="F3" value={portedResult.f3?.toFixed(1) || '—'} unit="Hz" />
              <StatCard label="Alignment" value={portedResult.alignmentType} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberInput label="Port diameter" unit="mm" value={portDiameter} onChange={setPortDiameter} />
              <NumberInput label="Antal porte" value={numPorts} min={1} max={4} onChange={setNumPorts} />
              <StatCard label="Port længde" value={portResult.portLength.toFixed(0)} unit="mm" />
            </div>
          </div>
        </Card>
      )}

      {cabinetType === 'transmission_line' && tlResult && (
        <Card title="Transmission line">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Line længde" value={tlResult.lineLength} unit="mm" />
            <StatCard label="Line areal" value={tlResult.lineArea} unit="mm²" />
            <StatCard label="Taper ratio" value={`${tlResult.taperRatio}:1`} />
            <StatCard label="Stuffing" value={tlResult.stuffing} unit="g/L" />
          </div>
        </Card>
      )}

      {cabinetType === 'open_baffle' && (
        <Card title="Åben baffel">
          <div className="text-sm text-gray-500">
            Åben baffel kræver ingen kabinetberegning. Baffelsteppet er kritisk - vælg en stor baffel
            for at udstrække basresponsen. Brug baffelstep-beregningen under Simulering.
          </div>
        </Card>
      )}
    </div>
  )
}
