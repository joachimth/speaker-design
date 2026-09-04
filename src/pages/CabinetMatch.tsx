import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriverStore } from '@/store/driverStore'
import { useProjectStore } from '@/store/projectStore'
import { Card, Select, NumberInput, Button, StatCard, Badge } from '@/components/common/UI'
import {
  CABINET_PRESETS,
  calcPortTuning,
  recommendSystemForCabinet,
  scoreWooferForCabinet,
  type CabinetSpec,
  type MiniDspOutput,
  type PeqSuggestion,
  type SystemRecommendation,
} from '@/lib/acoustic/cabinetMatch'
import { calcInternalVolume, generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { scoreFromBands } from '@/lib/acoustic/preferenceOptimizer'
import { useOptimizerWorker } from '@/hooks/useOptimizerWorker'
import { pistonDiameter } from '@/lib/acoustic/autoDesign'
import type { Driver } from '@/types'

// ---------------------------------------------------------------------------
// PEQ type labels
// ---------------------------------------------------------------------------

const PEQ_TYPE_LABELS: Record<PeqSuggestion['type'], string> = {
  low_shelf: 'Low Shelf',
  high_shelf: 'High Shelf',
  peak: 'Peak',
  notch: 'Notch',
}

const PEQ_TYPE_COLORS: Record<PeqSuggestion['type'], 'blue' | 'orange' | 'green' | 'red'> = {
  low_shelf: 'blue',
  high_shelf: 'green',
  peak: 'orange',
  notch: 'red',
}

const ROLE_LABELS: Record<string, string> = {
  woofer: 'Bas',
  mid: 'Mellem',
  tweeter: 'Diskant',
}

// ---------------------------------------------------------------------------
// Cabinet input form
// ---------------------------------------------------------------------------

function CabinetInputForm({
  spec,
  onChange,
}: {
  spec: CabinetSpec
  onChange: (spec: CabinetSpec) => void
}) {
  function update(field: keyof CabinetSpec, value: number | string) {
    onChange({ ...spec, [field]: value })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <NumberInput
          label="Højde"
          unit="mm"
          value={spec.height}
          onChange={(v) => update('height', v)}
          min={50}
          step={1}
        />
        <NumberInput
          label="Bredde (front)"
          unit="mm"
          value={spec.width}
          onChange={(v) => update('width', v)}
          min={50}
          step={1}
        />
        <NumberInput
          label="Dybde"
          unit="mm"
          value={spec.depth}
          onChange={(v) => update('depth', v)}
          min={50}
          step={1}
        />
        <NumberInput
          label="Vægtykkelse"
          unit="mm"
          value={spec.wallThickness}
          onChange={(v) => update('wallThickness', v)}
          min={0}
          step={1}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Port</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberInput
            label="Port Ø"
            unit="mm"
            value={spec.portDiameter}
            onChange={(v) => update('portDiameter', v)}
            min={0}
            step={1}
          />
          <NumberInput
            label="Port længde"
            unit="mm"
            value={spec.portLength}
            onChange={(v) => update('portLength', v)}
            min={0}
            step={1}
          />
          <NumberInput
            label="Antal port"
            value={spec.numPorts}
            onChange={(v) => update('numPorts', v)}
            min={1}
            max={4}
            step={1}
          />
          <Select
            label="Port placering"
            value={spec.portPosition}
            onChange={(v) => update('portPosition', v)}
            options={[
              { value: 'bottom', label: 'Bund' },
              { value: 'front', label: 'Front' },
              { value: 'rear', label: 'Bag' },
              { value: 'side', label: 'Side' },
            ]}
          />
        </div>
      </div>

      {/* Mid chamber + woofer count */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Kammer & enheder</div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Mellemkammer volumen"
            unit="L"
            value={spec.midChamberVolume ?? 0}
            onChange={(v) => update('midChamberVolume', v)}
            min={0}
            step={0.1}
          />
          <NumberInput
            label="Antal bas-enheder"
            value={spec.wooferCount ?? 1}
            onChange={(v) => update('wooferCount', v)}
            min={1}
            max={4}
            step={1}
          />
        </div>
        {(spec.wooferCount ?? 1) > 1 && (
          <div className="mt-2">
            <Select
              label="Bas-montering"
              value={spec.wooferMounting ?? 'front'}
              onChange={(v) => update('wooferMounting', v)}
              options={[
                { value: 'front', label: 'Front (begge på fronten)' },
                { value: 'sides', label: 'Sider (push-push, én per langside)' },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MiniDSP output card
// ---------------------------------------------------------------------------

function MiniDspOutputCard({ output }: { output: MiniDspOutput }) {
  const hasHp = output.highpassFreq > 0
  const hasLp = output.lowpassFreq > 0

  return (
    <div className="bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{output.label}</span>
          <Badge color="green">{ROLE_LABELS[output.role] ?? output.role}</Badge>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{output.driverName}</span>
      </div>

      {/* Crossover */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 dark:text-gray-400">HPF:</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {hasHp ? `${output.highpassFreq} Hz ${output.highpassType}` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 dark:text-gray-400">LPF:</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {hasLp ? `${output.lowpassFreq} Hz ${output.lowpassType}` : '—'}
          </span>
        </div>
      </div>

      {/* Delay / Gain / Polarity */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Delay: </span>
          <span className="font-mono text-gray-900 dark:text-gray-100">{output.delay.toFixed(2)} ms</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Gain: </span>
          <span className="font-mono text-gray-900 dark:text-gray-100">
            {output.gain > 0 ? '+' : ''}{output.gain.toFixed(1)} dB
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Polaritet: </span>
          <span className="font-mono text-gray-900 dark:text-gray-100">{output.polarity}°</span>
        </div>
      </div>

      {/* PEQ */}
      {output.peq.length > 0 && (
        <div className="space-y-1.5 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">PEQ filtre</div>
          {output.peq.map((peq, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Badge color={PEQ_TYPE_COLORS[peq.type]}>{PEQ_TYPE_LABELS[peq.type]}</Badge>
              <div className="flex-1">
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {peq.freq} Hz · {peq.gain > 0 ? '+' : ''}{peq.gain} dB · Q={peq.q}
                </span>
                <div className="text-gray-500 dark:text-gray-400 mt-0.5">{peq.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Driver fit card
// ---------------------------------------------------------------------------

function DriverFitCard({
  title,
  score,
}: {
  title: string
  score: NonNullable<SystemRecommendation['wooferScore']>
}) {
  const d = score.driver
  return (
    <Card title={title}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {d.manufacturer} {d.model}
          </span>
          <Badge color={score.overallScore >= 70 ? 'green' : score.overallScore >= 40 ? 'orange' : 'red'}>
            Score: {score.overallScore}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Type: </span>
            <span className="text-gray-900 dark:text-gray-100">{d.type}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Fs: </span>
            <span className="font-mono text-gray-900 dark:text-gray-100">{d.tsParams.fs} Hz</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Qts: </span>
            <span className="font-mono text-gray-900 dark:text-gray-100">{d.tsParams.qts?.toFixed(3) ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Sens: </span>
            <span className="font-mono text-gray-900 dark:text-gray-100">{d.tsParams.sensitivity} dB</span>
          </div>
        </div>

        {score.sealedVb !== undefined && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Sealed Vb: </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{score.sealedVb.toFixed(1)} L</span>
            </div>
            {score.portedVb !== undefined && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ported Vb: </span>
                <span className="font-mono text-gray-900 dark:text-gray-100">
                  {score.portedVb.toFixed(1)} L @ {score.portedFb?.toFixed(0)} Hz
                </span>
              </div>
            )}
          </div>
        )}

        {score.reasons.length > 0 && (
          <div className="space-y-0.5">
            {score.reasons.map((r, i) => (
              <div key={i} className="text-xs text-green-700 dark:text-green-400">✓ {r}</div>
            ))}
          </div>
        )}
        {score.warnings.length > 0 && (
          <div className="space-y-0.5">
            {score.warnings.map((w, i) => (
              <div key={i} className="text-xs text-orange-700 dark:text-orange-400">⚠ {w}</div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CabinetMatch() {
  const { drivers } = useDriverStore()
  const navigate = useNavigate()
  const { setSimHandoff } = useProjectStore()
  const [presetName, setPresetName] = useState('Kudos X2')
  const [cabinetSpec, setCabinetSpec] = useState<CabinetSpec>(CABINET_PRESETS[0]!.spec)
  const [ways, setWays] = useState<2 | 3>(2)
  const [result, setResult] = useState<SystemRecommendation | null>(null)
  const [allScores, setAllScores] = useState<{ name: string; score: number; fit: boolean }[] | null>(null)
  const { optimize: workerOptimize, optimizing: cabOptimizing, cabResult: cabOptResult } = useOptimizerWorker()
  // Selected drivers for cabinet optimization
  const [optDrivers, setOptDrivers] = useState<(string | '')[]>(['', ''])
  const [optWooferCount, setOptWooferCount] = useState(1)

  function handlePresetChange(name: string) {
    setPresetName(name)
    const preset = CABINET_PRESETS.find((p) => p.name === name)
    if (preset) {
      setCabinetSpec({ ...preset.spec, name: name === 'Custom' ? 'Custom' : preset.spec.name })
    }
    setResult(null)
    setAllScores(null)
  }

  function handleSpecChange(spec: CabinetSpec) {
    setCabinetSpec(spec)
    setResult(null)
    setAllScores(null)
  }

  const internalVolume = useMemo(
    () => calcInternalVolume(cabinetSpec.width, cabinetSpec.height, cabinetSpec.depth, cabinetSpec.wallThickness),
    [cabinetSpec],
  )

  const portTuning = useMemo(() => {
    if (cabinetSpec.portDiameter > 0 && cabinetSpec.portLength > 0) {
      const midChamber = cabinetSpec.midChamberVolume ?? 0
      const bassVol = midChamber > 0 ? internalVolume - midChamber : internalVolume
      return calcPortTuning(cabinetSpec.portDiameter, cabinetSpec.portLength, cabinetSpec.numPorts, bassVol)
    }
    return null
  }, [cabinetSpec, internalVolume])

  function handleMatch() {
    if (drivers.length === 0) return
    const rec = recommendSystemForCabinet(drivers, cabinetSpec, ways)
    setResult(rec)

    // Build a quick overview of all woofer scores for display
    const midChamber = cabinetSpec.midChamberVolume ?? 0
    const scoringVolume = midChamber > 0 ? internalVolume - midChamber : internalVolume
    const wooferCount = cabinetSpec.wooferCount ?? 1
    const wooferTypes = ways === 3 ? ['woofer', 'midrange', 'subwoofer'] : ['woofer', 'midrange', 'fullrange', 'subwoofer']
    const scores = drivers
      .filter((d) => wooferTypes.includes(d.type))
      .map((d) => ({
        name: `${d.manufacturer} ${d.model}`,
        score: scoreWooferForCabinet(d, cabinetSpec, scoringVolume, wooferCount).overallScore,
        fit: scoreWooferForCabinet(d, cabinetSpec, scoringVolume, wooferCount).fits,
      }))
      .sort((a, b) => b.score - a.score)
    setAllScores(scores)
  }

  // Live preference score when we have a match result
  const matchPrefScore = useMemo(() => {
    if (!result) return null
    const isPorted = cabinetSpec.portDiameter > 0 && cabinetSpec.portLength > 0
    const cabType = isPorted ? 'ported' : 'sealed'
    const bands = result.miniDspConfig.outputs.map((o) => ({
      driverId: o.driverId,
      role: (o.role === 'woofer' ? 'low' : o.role === 'mid' ? 'mid' : 'high') as 'low' | 'mid' | 'high',
      driverCount: o.driverCount ?? 1,
      lowpassFreq: o.lowpassFreq,
      lowpassType: o.lowpassType,
      highpassFreq: o.highpassFreq,
      highpassType: o.highpassType,
      gain: o.gain,
      polarity: o.polarity,
      delay: o.delay,
    }))
    const freqs = generateFrequencies(20, 20000, 12)
    const matchedDrivers = bands.map((b) => drivers.find((d) => d.id === b.driverId)).filter((d): d is Driver => !!d)
    if (matchedDrivers.length < 2) return null
    // Use largest driver diameter for directivity
    let maxDia = 100
    for (const d of matchedDrivers) {
      const dia = pistonDiameter(d)
      if (dia > maxDia) maxDia = dia
    }
    const onAxis = scoreFromBands(bands, drivers, freqs, cabinetSpec.width, cabinetSpec.height, cabType, portTuning ?? 0, internalVolume, cabinetSpec.portDiameter, cabinetSpec.numPorts)
    // scoreFromBands returns PreferenceScoreResult, but we need the on-axis curve for spinorama
    // Actually scoreFromBands already computes spinorama internally, let's just use the score
    return onAxis
  }, [result, cabinetSpec, portTuning, internalVolume, drivers])

  // Cabinet optimizer handler — runs in Web Worker, UI stays responsive
  function handleOptimizeCabinet() {
    const selectedDrivers = optDrivers
      .map((id) => drivers.find((d) => d.id === id))
      .filter((d): d is Driver => !!d)
    if (selectedDrivers.length < 2) return

    workerOptimize({
      type: 'cabinet',
      params: {
        drivers: selectedDrivers,
        ways: selectedDrivers.length === 3 ? 3 : 2,
        baffleWidth: cabinetSpec.width,
        baffleHeight: cabinetSpec.height,
        wallThickness: cabinetSpec.wallThickness,
        wooferCount: optWooferCount,
      },
    })
  }

  // Apply cabinet optimization result when worker finishes
  useEffect(() => {
    if (cabOptResult) {
      setCabinetSpec(cabOptResult.bestSpec)
      setResult(null)
      setAllScores(null)
    }
  }, [cabOptResult])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kabinet Match</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Indtast et kabinet og få anbefalet drivere der passer, plus aktivt delefilter til MiniDSP.
      </p>

      {/* Cabinet input */}
      <Card title="Kabinet specifikation">
        <div className="space-y-3">
          <Select
            label="Forudstilling"
            value={presetName}
            onChange={handlePresetChange}
            options={CABINET_PRESETS.map((p) => ({ value: p.name, label: p.name }))}
          />
          <CabinetInputForm spec={cabinetSpec} onChange={handleSpecChange} />

          {/* Calculated stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <StatCard label="Intern volumen" value={internalVolume.toFixed(1)} unit="L" />
            {(cabinetSpec.midChamberVolume ?? 0) > 0 ? (
              <>
                <StatCard label="Mellemkammer" value={(cabinetSpec.midChamberVolume ?? 0).toFixed(1)} unit="L" />
                <StatCard label="Bass volumen" value={(internalVolume - (cabinetSpec.midChamberVolume ?? 0)).toFixed(1)} unit="L" />
              </>
            ) : null}
            {portTuning !== null ? (
              <StatCard label="Port tuning" value={portTuning.toFixed(0)} unit="Hz" />
            ) : (
              <StatCard label="Port tuning" value="—" unit="" />
            )}
            <div className="flex items-end">
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Antal veje</label>
                <div className="flex gap-2">
                  {[2, 3].map((w) => (
                    <button
                      key={w}
                      onClick={() => { setWays(w as 2 | 3); setResult(null); setAllScores(null) }}
                      aria-label={`${w}-vejs system`}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        ways === w
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {w}-vejs
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleMatch} disabled={drivers.length === 0}>
              Find drivere &amp; foreslå delefilter
            </Button>
          </div>
        </div>
      </Card>

      {/* Cabinet optimizer: select drivers, find best cabinet */}
      <Card title="Optimer kabinet til valgte enheder">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Vælg 2 eller 3 enheder og find det kabinet (lukket/port, volumen, port tuning)
            der giver den højeste præference score.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {optDrivers.map((driverId, i) => (
              <div key={i} className="space-y-1">
                <Select
                  label={i === 0 ? 'Bas/mellemtone' : i === 1 ? 'Diskant (eller mellemtone)' : 'Diskant'}
                  value={driverId}
                  onChange={(v) => {
                    const next = [...optDrivers]
                    next[i] = v
                    // Auto-expand/shrink selection
                    if (v && i === optDrivers.length - 1 && optDrivers.length < 3) {
                      next.push('')
                    }
                    // Remove trailing empties
                    while (next.length > 2 && next[next.length - 1] === '') {
                      next.pop()
                    }
                    setOptDrivers(next)
                  }}
                  options={[
                    { value: '', label: '— Vælg enhed —' },
                    ...drivers.map((d) => ({
                      value: d.id,
                      label: `${d.manufacturer} ${d.model} (${d.type})`,
                    })),
                  ]}
                />
                {i === 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Antal bas-enheder:</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={optWooferCount}
                      onChange={(e) => setOptWooferCount(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                      className="w-16 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleOptimizeCabinet}
              disabled={cabOptimizing || optDrivers.filter((d) => d).length < 2}
              variant="primary"
            >
              {cabOptimizing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Optimerer kabinet…
                </span>
              ) : (
                'Optimer kabinet'
              )}
            </Button>
            <span className="text-xs text-gray-500">
              Søger lukket og port, volumen og port tuning
            </span>
          </div>

          {cabOptResult && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Bedste kabinet"
                  value={cabOptResult.bestCabinetType === 'sealed' ? 'Lukket' : 'Port'}
                  unit=""
                />
                <StatCard label="Volumen" value={cabOptResult.bestVolume.toFixed(1)} unit="L" />
                {cabOptResult.bestPortFb > 0 && (
                  <StatCard label="Port tuning" value={String(cabOptResult.bestPortFb)} unit="Hz" />
                )}
                <StatCard
                  label="Score"
                  value={`${cabOptResult.bestScore.score.toFixed(1)}`}
                  unit="/10"
                />
                <StatCard
                  label="Forbedring"
                  value={`${cabOptResult.improvement >= 0 ? '+' : ''}${cabOptResult.improvement.toFixed(1)}`}
                  unit="pt"
                />
                <StatCard label="F3" value={String(cabOptResult.trials[0]?.f3?.toFixed(0) ?? '—')} unit="Hz" />
                <StatCard label="Bass ext." value={String(cabOptResult.bestScore.lfxHz)} unit="Hz" />
                <StatCard label="NBD ON" value={cabOptResult.bestScore.nbdOnAxis.toFixed(2)} unit="dB" />
              </div>

              {/* Top trials */}
              <div className="pt-2">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Top konfigurationer (prøvet):
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {cabOptResult.trials.slice(0, 10).map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded"
                      style={{ backgroundColor: i === 0 ? 'rgba(34,197,94,0.1)' : undefined }}
                    >
                      <span className="text-gray-900 dark:text-gray-100">
                        {t.cabinetType === 'sealed' ? 'Lukket' : 'Port'} {t.volume.toFixed(1)}L
                        {t.portFb > 0 ? ` @ ${t.portFb}Hz` : ''}
                      </span>
                      <span className="font-mono text-gray-600 dark:text-gray-400">
                        Score {t.score.toFixed(1)} · F3 {t.f3.toFixed(0)}Hz
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                {cabOptResult.reasoning.map((line, i) => (
                  <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    if (cabOptResult.bestBands.length >= 2) {
                      setSimHandoff({
                        bands: cabOptResult.bestBands.map((b) => ({
                          driverId: b.driverId,
                          role: (b.role === 'mid2' ? 'mid' : b.role) as 'low' | 'mid' | 'high',
                          driverCount: b.driverCount,
                          lowpassFreq: b.lowpassFreq,
                          lowpassType: b.lowpassType,
                          highpassFreq: b.highpassFreq,
                          highpassType: b.highpassType,
                          gain: b.gain,
                          polarity: b.polarity,
                          delay: b.delay,
                        })),
                        ways: cabOptResult.bestBands.length as 2 | 3,
                        baffleWidth: cabOptResult.bestSpec.width,
                        baffleHeight: cabOptResult.bestSpec.height,
                        cabinetType: cabOptResult.bestCabinetType,
                        portFb: cabOptResult.bestPortFb || null,
                        portVb: cabOptResult.bestVolume,
                        portDiameter: cabOptResult.bestSpec.portDiameter,
                        numPorts: cabOptResult.bestSpec.numPorts,
                        projectName: `Optimeret kabinet — ${cabOptResult.bestCabinetType === 'sealed' ? 'lukket' : 'port'}`,
                      })
                      navigate('/system')
                    }
                  }}
                >
                  → Send til System Simulering
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Reasoning */}
          <Card title="Analyse">
            <div className="space-y-1">
              {result.reasoning.map((r, i) => (
                <div key={i} className="text-xs text-gray-700 dark:text-gray-300">
                  {r}
                </div>
              ))}
            </div>
          </Card>

          {/* Live preference score for this match */}
          {matchPrefScore && (
            <Card title="Præference Score for dette match">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Score" value={matchPrefScore.score.toFixed(1)} unit="/10" />
                <StatCard label="Med subwoofer" value={matchPrefScore.scoreWithSub.toFixed(1)} unit="/10" />
                <StatCard label="NBD On-Axis" value={matchPrefScore.nbdOnAxis.toFixed(2)} unit="dB" />
                <StatCard label="NBD In-Room" value={matchPrefScore.nbdPredInRoom.toFixed(2)} unit="dB" />
                <StatCard label="Bass extension" value={String(matchPrefScore.lfxHz)} unit="Hz" />
                <StatCard label="Bass kvalitet" value={matchPrefScore.lfq.toFixed(2)} unit="dB" />
                <StatCard label="Smoothness PIR" value={matchPrefScore.smPredInRoom.toFixed(3)} unit="" />
                <StatCard label="Smoothness SP" value={matchPrefScore.smSoundPower.toFixed(3)} unit="" />
              </div>
            </Card>
          )}

          {/* Driver recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DriverFitCard title="Anbefalet bas/mellemtone" score={result.wooferScore} />
            {result.midScore && <DriverFitCard title="Anbefalet mellemtone" score={result.midScore} />}
            <DriverFitCard title="Anbefalet diskant" score={result.tweeterScore} />
          </div>

          {/* All woofer scores */}
          {allScores && allScores.length > 0 && (
            <Card title="Alle enheder — fit scoring">
              <div className="space-y-1">
                {allScores.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded"
                    style={{
                      backgroundColor: i === 0 ? 'rgba(34,197,94,0.1)' : undefined,
                    }}
                  >
                    <span className="text-gray-900 dark:text-gray-100">
                      {s.fit ? '✓' : '✗'} {s.name}
                    </span>
                    <span className={`font-mono ${s.fit ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {s.score}/100
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* MiniDSP configuration */}
          <Card title={`MiniDSP konfiguration — ${result.miniDspConfig.plugin}`}>
            <div className="space-y-3">
              {/* Plugin info */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  Sample rate: <span className="font-mono text-gray-900 dark:text-gray-100">{result.miniDspConfig.sampleRate} kHz</span>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Input gain: <span className="font-mono text-gray-900 dark:text-gray-100">{result.miniDspConfig.inputGain} dB</span>
                </span>
              </div>

              {/* Crossover points summary */}
              {result.crossover.crossoverPoints.length > 0 && (
                <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-2 text-xs">
                  <span className="font-medium text-brand-800 dark:text-brand-200">Delingsfrekvenser: </span>
                  {result.crossover.crossoverPoints.map((cp, i) => (
                    <span key={i} className="text-brand-700 dark:text-brand-300">
                      {i > 0 && ' · '}
                      {cp.freq} Hz ({cp.lowerRole}→{cp.upperRole}, {cp.type})
                    </span>
                  ))}
                </div>
              )}

              {/* Output cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {result.miniDspConfig.outputs.map((output) => (
                  <MiniDspOutputCard key={output.label} output={output} />
                ))}
              </div>

              {/* Export note */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                Indtast disse værdier i MiniDSP plugin UI. PEQ filtre indsættes som biquad filtre
                med de angivne frekvens, gain og Q værdier.
              </div>

              {/* Handoff to System Simulation */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => {
                    const outputs = result.miniDspConfig.outputs
                    const isPorted = cabinetSpec.portDiameter > 0 && cabinetSpec.portLength > 0
                    const bands = outputs.map((o) => ({
                      driverId: o.driverId,
                      role: o.role === 'woofer' ? 'low' as const : o.role === 'mid' ? 'mid' as const : 'high' as const,
                      driverCount: o.driverCount ?? 1,
                      lowpassFreq: o.lowpassFreq,
                      lowpassType: o.lowpassType,
                      highpassFreq: o.highpassFreq,
                      highpassType: o.highpassType,
                      gain: o.gain,
                      polarity: o.polarity,
                      delay: o.delay,
                      eqFilters: o.peq.map((p) => ({
                        id: `match_peq_${o.label}_${p.freq}_${p.type}`,
                        kind: (p.type === 'peak' || p.type === 'notch' ? 'peaking' : p.type) as 'low_shelf' | 'high_shelf' | 'peaking',
                        freq: p.freq,
                        gain: p.gain,
                        q: p.q,
                        enabled: true,
                      })),
                    }))
                    setSimHandoff({
                      bands,
                      ways: result.ways,
                      baffleWidth: cabinetSpec.width,
                      baffleHeight: cabinetSpec.height,
                      cabinetType: isPorted ? 'ported' : 'sealed',
                      portFb: portTuning ?? null,
                      portVb: internalVolume,
                      portDiameter: cabinetSpec.portDiameter,
                      numPorts: cabinetSpec.numPorts,
                      projectName: `Kabinet Match — ${presetName}`,
                    })
                    navigate('/system')
                  }}
                >
                  → Send til System Simulering
                </Button>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Overfører kabinetstørrelse, valgte drivere og automatiske delefilter-indstillinger.
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
