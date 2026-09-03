import { useState, useMemo, lazy, Suspense } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { useDesignStore } from '@/store/designStore'
import { useSettingsStore, formatLength, formatVolume } from '@/store/settingsStore'
import { Card, Select, NumberInput, StatCard, Button } from '@/components/common/UI'
import PanelResonanceCard from '@/components/PanelResonanceCard'
import ParameterSetSelector from '@/components/driver/ParameterSetSelector'
import BreakInCard from '@/components/BreakInCard'
import { CabinetComparisonCard } from '@/components/CabinetComparisonCard'
import { LinkwitzTransformCard } from '@/components/LinkwitzTransformCard'
import { MultiSubAlignmentCard } from '@/components/MultiSubAlignmentCard'
import type { DriverPlacement } from '@/components/Cabinet3DBuilder'
const Cabinet3DBuilder = lazy(() => import('@/components/Cabinet3DBuilder').then(m => ({ default: m.Cabinet3DBuilder })))
import {
  calcSealed,
  calcPorted,
  calcPort,
  calcTransmissionLine,
  recommendCabinetType,
  calcInternalVolume,
} from '@/lib/acoustic/thieleSmall'
import { suggestCabinet, suggestBaffle } from '@/lib/acoustic/autoDesign'
import type { CabinetType, Driver } from '@/types'

export default function CabinetDesigner() {
  const { drivers, updateDriver } = useDriverStore()
  const { units } = useSettingsStore()
  const { design, setCabinetType, setBaffle, setPort, updateDesign } = useDesignStore()

  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '')
  const [activeParameterSet, setActiveParameterSet] = useState<string>('Datablad')
  const [qtcTarget, setQtcTarget] = useState(0.707)

  // Cabinet dimensions: baffle + roundover come from shared store.
  // Full box dims (width/height/depth/wallThickness) are local since
  // DesignState only tracks baffle dimensions for simulation.
  const [cabinetDims, setCabinetDims] = useState({
    width: 300,
    height: 1180,
    depth: 420,
    wallThickness: 22,
    baffleWidth: design.baffleWidth,
    baffleHeight: design.baffleHeight,
    frontRoundoverRadius: design.roundoverRadius,
  })

  // Driver placements on baffle for 3D builder
  const [placements, setPlacements] = useState<DriverPlacement[]>([
    { driverId: selectedDriverId, label: 'Driver 1', x: 0, y: 100 },
  ])

  // Sync baffle dims from shared store → local cabinetDims
  // (handles load-design and changes from other tabs)
  const { baffleWidth: sharedBW, baffleHeight: sharedBH, roundoverRadius: sharedRR } = design
  const baffleSynced = cabinetDims.baffleWidth === sharedBW
    && cabinetDims.baffleHeight === sharedBH
    && cabinetDims.frontRoundoverRadius === sharedRR
  if (!baffleSynced) {
    cabinetDims.baffleWidth = sharedBW
    cabinetDims.baffleHeight = sharedBH
    cabinetDims.frontRoundoverRadius = sharedRR
  }

  const cabinetType = design.cabinetType
  const portDiameter = design.portDiameter
  const numPorts = design.numPorts

  // Auto-suggest state
  const [cabinetReasoning, setCabinetReasoning] = useState<string[] | null>(null)
  const [baffleReasoning, setBaffleReasoning] = useState<string[] | null>(null)

  // Helper: update cabinet dims and sync baffle to shared store
  function updateCabinetDims(patch: typeof cabinetDims) {
    setCabinetDims(patch)
    setBaffle(patch.baffleWidth, patch.baffleHeight)
    updateDesign({ roundoverRadius: patch.frontRoundoverRadius })
  }

  // Auto-suggest cabinet type + dimensions from driver T/S params
  function handleAutoCabinet() {
    if (!selectedDriver?.tsParams) return
    const result = suggestCabinet(selectedDriver, cabinetType)
    setCabinetReasoning(result.reasoning)
    const newDims = {
      width: result.dimensions.width,
      height: result.dimensions.height,
      depth: result.dimensions.depth,
      wallThickness: result.dimensions.wallThickness,
      baffleWidth: result.dimensions.baffleWidth,
      baffleHeight: result.dimensions.baffleHeight,
      frontRoundoverRadius: result.dimensions.frontRoundoverRadius,
    }
    updateCabinetDims(newDims)
    if (result.ported && result.portLength) {
      setPort({ diameter: 60, numPorts: 1 })
    }
  }

  // Auto-suggest + auto-select best cabinet type, then suggest dimensions
  function handleAutoCabinetType() {
    if (!selectedDriver?.tsParams) return
    const rec = recommendCabinetType(selectedDriver.tsParams)
    setCabinetType(rec.recommended)
    const result = suggestCabinet(selectedDriver, rec.recommended)
    setCabinetReasoning([
      `Anbefalet type: ${rec.recommended} — ${rec.reason}`,
      ...result.reasoning,
    ])
    const newDims = {
      width: result.dimensions.width,
      height: result.dimensions.height,
      depth: result.dimensions.depth,
      wallThickness: result.dimensions.wallThickness,
      baffleWidth: result.dimensions.baffleWidth,
      baffleHeight: result.dimensions.baffleHeight,
      frontRoundoverRadius: result.dimensions.frontRoundoverRadius,
    }
    updateCabinetDims(newDims)
  }

  // Auto-suggest baffle dimensions from driver
  function handleAutoBaffle() {
    if (!selectedDriver) return
    const result = suggestBaffle([selectedDriver as Driver], [])
    setBaffleReasoning(result.reasoning)
    updateCabinetDims({
      ...cabinetDims,
      baffleWidth: result.width,
      baffleHeight: result.height,
      frontRoundoverRadius: result.roundoverRadius,
    })
  }

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

        {/* Skift mellem datablad og målte parameter sæt */}
        {selectedDriver && (
          <div className="mt-3">
            <ParameterSetSelector
              driver={selectedDriver}
              onSelect={(params, name) => {
                setActiveParameterSet(name)
                updateDriver({ ...selectedDriver, tsParams: params, updatedAt: Date.now() })
              }}
            />
          </div>
        )}

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

      {/* Break-in tracker — only shows for tracked mk3 drivers */}
      {selectedDriver && (
        <BreakInCard
          driverId={selectedDriver.id}
          activeParameterSet={activeParameterSet}
        />
      )}

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
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button onClick={handleAutoCabinetType} variant="primary" size="sm">
            Auto type + dimensioner
          </Button>
          <Button onClick={handleAutoCabinet} variant="secondary" size="sm">
            Auto dimensioner (valgt type)
          </Button>
          <Button onClick={handleAutoBaffle} variant="secondary" size="sm">
            Auto baffel
          </Button>
        </div>
      </Card>

      {/* Auto-suggest reasoning */}
      {cabinetReasoning && cabinetReasoning.length > 0 && (
        <Card title="Auto kabinet begrundelse">
          <div className="space-y-1">
            {cabinetReasoning.map((line, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
            ))}
          </div>
        </Card>
      )}
      {baffleReasoning && baffleReasoning.length > 0 && (
        <Card title="Auto baffel begrundelse">
          <div className="space-y-1">
            {baffleReasoning.map((line, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Cabinet dimensions */}
      <Card title="Kabinetdimensioner">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberInput label="Bredde" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.width} onChange={(v) => setCabinetDims({ ...cabinetDims, width: v })} />
          <NumberInput label="Højde" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.height} onChange={(v) => setCabinetDims({ ...cabinetDims, height: v })} />
          <NumberInput label="Dybde" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.depth} onChange={(v) => setCabinetDims({ ...cabinetDims, depth: v })} />
          <NumberInput label="Vægtykkelse" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.wallThickness} onChange={(v) => setCabinetDims({ ...cabinetDims, wallThickness: v })} />
          <NumberInput label="Baffel bredde" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.baffleWidth} onChange={(v) => updateCabinetDims({ ...cabinetDims, baffleWidth: v })} />
          <NumberInput label="Baffel højde" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.baffleHeight} onChange={(v) => updateCabinetDims({ ...cabinetDims, baffleHeight: v })} />
          <NumberInput label="Afrunding" unit={units === 'metric' ? 'mm' : 'in'} value={cabinetDims.frontRoundoverRadius} onChange={(v) => updateCabinetDims({ ...cabinetDims, frontRoundoverRadius: v })} />
          <div className="flex items-end">
            <div className="bg-gray-50 dark:bg-gray-750 rounded-md p-2 w-full">
              <div className="text-xs text-gray-500">Intern volumen</div>
              <div className="text-lg font-semibold">{formatVolume(internalVolume, units, 1)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Panel resonance, material & damping trade-offs */}
      <PanelResonanceCard
        width={cabinetDims.width}
        height={cabinetDims.height}
        depth={cabinetDims.depth}
        wallThickness={cabinetDims.wallThickness}
      />

      {/* Cabinet type comparison (all three side-by-side) */}
      <CabinetComparisonCard driver={selectedDriver} />

      {/* 3D cabinet visualization with driver placement */}
      <Suspense fallback={<Card title="3D Kabinet"><div className="text-center py-8 text-gray-500">Indlæser 3D...</div></Card>}>
      <Cabinet3DBuilder
        cabinetWidth={cabinetDims.width}
        cabinetHeight={cabinetDims.height}
        cabinetDepth={cabinetDims.depth}
        wallThickness={cabinetDims.wallThickness}
        baffleWidth={cabinetDims.baffleWidth}
        baffleHeight={cabinetDims.baffleHeight}
        drivers={drivers}
        placements={placements}
        onPlacementChange={setPlacements}
      />
      </Suspense>

      {/* Alignment results */}
      {cabinetType === 'sealed' && sealedResult && (
        <Card title="Sealed alignment">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberInput label="Mål Qtc" value={qtcTarget} step={0.01} min={0.5} max={1.5} onChange={setQtcTarget} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Vb (volumen)" value={formatVolume(sealedResult.vb, units, 1).split(' ')[0]} unit={formatVolume(sealedResult.vb, units, 1).split(' ')[1]!} />
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
              <StatCard label="Vb" value={formatVolume(portedResult.vb, units, 1).split(' ')[0]} unit={formatVolume(portedResult.vb, units, 1).split(' ')[1]!} />
              <StatCard label="Fb (tuning)" value={portedResult.fb.toFixed(1)} unit="Hz" />
              <StatCard label="F3" value={portedResult.f3?.toFixed(1) || '—'} unit="Hz" />
              <StatCard label="Alignment" value={portedResult.alignmentType} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberInput label="Port diameter" unit={units === 'metric' ? 'mm' : 'in'} value={portDiameter} onChange={(v) => setPort({ diameter: v })} />
              <NumberInput label="Antal porte" value={numPorts} min={1} max={4} onChange={(v) => setPort({ numPorts: v })} />
              <StatCard label="Port længde" value={formatLength(portResult.portLength, units, 1).split(' ')[0]} unit={formatLength(portResult.portLength, units, 1).split(' ')[1]!} />
            </div>
          </div>
        </Card>
      )}

      {cabinetType === 'transmission_line' && tlResult && (
        <Card title="Transmission line">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Line længde" value={formatLength(tlResult.lineLength, units, 0).split(' ')[0]} unit={formatLength(tlResult.lineLength, units, 0).split(' ')[1]!} />
            <StatCard label="Line areal" value={tlResult.lineArea} unit={units === 'metric' ? 'mm²' : 'in²'} />
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

      {/* Linkwitz Transform for sealed cabinets */}
      {cabinetType === 'sealed' && sealedResult && (
        <LinkwitzTransformCard
          driver={selectedDriver}
          boxVolume={sealedResult.vb}
        />
      )}

      {/* Multi-subwoofer alignment tool */}
      <MultiSubAlignmentCard />
    </div>
  )
}
