import { useState, useMemo, useRef, useEffect } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Select, NumberInput, Badge, StatCard } from '@/components/common/UI'
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, crossoverSlopeDbPerOctave } from '@/lib/acoustic/crossover'
import { calcBaffleStep, baffleStepFrequency } from '@/lib/acoustic/baffle'
import { calcSpinorama, pistonDirectivity } from '@/lib/acoustic/directivity'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { PolarDiagram, DirectivityMap, DirectivitySurface } from '@/components/charts/DirectivityCharts'
import type { CrossoverType, FrequencyDataPoint, Driver } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const XOVER_TYPES: { value: CrossoverType; label: string }[] = [
  { value: 'first_order', label: '1. ordens (6 dB/okt)' },
  { value: 'BW2', label: 'Butterworth 2. (12 dB/okt)' },
  { value: 'LR2', label: 'Linkwitz-Riley 2. (12 dB/okt)' },
  { value: 'BW4', label: 'Butterworth 4. (24 dB/okt)' },
  { value: 'LR4', label: 'Linkwitz-Riley 4. (24 dB/okt)' },
  { value: 'LR8', label: 'Linkwitz-Riley 8. (48 dB/okt)' },
]

const WAYS_OPTIONS = [
  { value: 2, label: '2-vejs' },
  { value: 3, label: '3-vejs' },
  { value: 4, label: '4-vejs' },
]

const ROLE_LABELS: Record<string, string> = {
  low: 'Bas',
  mid: 'Mellem',
  high: 'Diskant',
  mid2: 'Mellem 2',
}

const POLAR_FREQS = [100, 500, 1000, 2000, 5000, 10000]
const POLAR_ANGLES = Array.from({ length: 13 }, (_, i) => -90 + i * 15)
const DENSE_ANGLES = Array.from({ length: 37 }, (_, i) => -90 + i * 5)
const MAP_FREQS = generateFrequencies(100, 20000, 6)

// ---------------------------------------------------------------------------
// Band interface
// ---------------------------------------------------------------------------

interface Band {
  driverId: string
  role: 'low' | 'mid' | 'mid2' | 'high'
  lowpassFreq: number
  lowpassType: CrossoverType
  highpassFreq: number
  highpassType: CrossoverType
  gain: number
  polarity: 0 | 180
  delay: number
}

const DEFAULT_BANDS_2: Band[] = [
  { driverId: '', role: 'low', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
]

const DEFAULT_BANDS_3: Band[] = [
  { driverId: '', role: 'low', lowpassFreq: 300, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'mid', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 300, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
]

const DEFAULT_BANDS_4: Band[] = [
  { driverId: '', role: 'low', lowpassFreq: 300, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'mid', lowpassFreq: 1000, lowpassType: 'LR4', highpassFreq: 300, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'mid2', lowpassFreq: 5000, lowpassType: 'LR4', highpassFreq: 1000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 5000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
]

// ---------------------------------------------------------------------------
// Piston diameter helper (prefer Sd, fallback to overall diameter)
// ---------------------------------------------------------------------------

function pistonDiameterOf(driver: Driver | undefined): number {
  const sd = driver?.tsParams?.sd
  if (sd && sd > 0) return 2 * Math.sqrt(sd / Math.PI) * 10 // cm² → mm
  return driver?.dimensions?.overallDiameter ? driver.dimensions.overallDiameter * 0.8 : 100
}

// ---------------------------------------------------------------------------
// Interpolation helper
// ---------------------------------------------------------------------------

function interpolateAt(curve: FrequencyDataPoint[], freq: number): number {
  if (curve.length === 0) return 0
  if (freq <= curve[0]!.freq) return curve[0]!.magnitude
  if (freq >= curve[curve.length - 1]!.freq) return curve[curve.length - 1]!.magnitude
  let lo = 0, hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (curve[mid]!.freq < freq) lo = mid
    else hi = mid
  }
  const p0 = curve[lo]!, p1 = curve[hi]!
  const t = (Math.log(freq) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq))
  return p0.magnitude + t * (p1.magnitude - p0.magnitude)
}

// ===========================================================================
// Main component
// ===========================================================================

export default function SystemSimulation() {
  const { drivers } = useDriverStore()
  const [ways, setWays] = useState<2 | 3 | 4>(2)
  const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS_2)
  const [baffleWidth, setBaffleWidth] = useState(320)
  const [baffleHeight, setBaffleHeight] = useState(900)
  const [roundoverRadius, setRoundoverRadius] = useState(40)

  const freqs = useMemo(() => generateFrequencies(20, 20000, 12), [])

  // Adjust bands when ways changes
  function handleWaysChange(value: string) {
    const n = parseInt(value) as 2 | 3 | 4
    setWays(n)
    if (n === 2) setBands(DEFAULT_BANDS_2)
    else if (n === 3) setBands(DEFAULT_BANDS_3)
    else setBands(DEFAULT_BANDS_4)
  }

  function updateBand(index: number, updates: Partial<Band>) {
    setBands(bands.map((b, i) => (i === index ? { ...b, ...updates } : b)))
  }

  // -----------------------------------------------------------------------
  // Process each driver through crossover + baffle step
  // -----------------------------------------------------------------------
  const fStep = baffleStepFrequency(baffleWidth)
  const fStep3x = fStep * 3
  const baffleStepCurve = useMemo(
    () => calcBaffleStep(baffleWidth, baffleHeight, freqs),
    [baffleWidth, baffleHeight, freqs]
  )

  const processedBands = useMemo(() => {
    const activeBands = bands.slice(0, ways)
    const results: { band: Band; driver: Driver | undefined; curve: FrequencyDataPoint[]; hasRealResponse: boolean }[] = []

    for (const band of activeBands) {
      const driver = drivers.find((d) => d.id === band.driverId)
      const hasRealResponse = !!driver?.frequencyResponse && driver.frequencyResponse.length > 0

      // Start from real driver response or flat at sensitivity level
      let curve: FrequencyDataPoint[]
      if (hasRealResponse && driver!.frequencyResponse) {
        curve = [...driver!.frequencyResponse]
      } else {
        const sens = driver?.tsParams?.sensitivity ?? 0
        curve = freqs.map((f) => ({ freq: f, magnitude: sens }))
      }

      // Apply baffle step loss by driver type
      const driverType = driver?.type
      const isLowDriver = driverType === 'woofer' || driverType === 'subwoofer'
      const isMidDriver = driverType === 'midrange' || driverType === 'fullrange'

      if (isLowDriver || isMidDriver) {
        curve = curve.map((p, i) => {
          let bsFactor = baffleStepCurve.response[i] ?? 0
          if (isMidDriver && p.freq > fStep3x) {
            const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep))
            bsFactor *= (1 - t)
          }
          return { freq: p.freq, magnitude: p.magnitude + bsFactor }
        })
      }

      // Apply lowpass
      if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
        const lp = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false)
        curve = applyCrossover(lp, curve)
      }

      // Apply highpass
      if (band.highpassFreq > 0) {
        const hp = buildCrossoverFilter(band.highpassType, band.highpassFreq, true)
        curve = applyCrossover(hp, curve)
      }

      // Apply gain and polarity
      curve = applyGainAndPolarity(curve, band.gain, band.polarity)

      results.push({ band, driver, curve, hasRealResponse })
    }

    return results
  }, [bands, ways, drivers, freqs, baffleStepCurve, fStep, fStep3x])

  // -----------------------------------------------------------------------
  // Summed system response (voltage summation)
  // -----------------------------------------------------------------------
  const summedResponse = useMemo(() => {
    if (processedBands.length === 0) return null
    return freqs.map((f) => {
      let sumLinear = 0
      for (const pb of processedBands) {
        const db = interpolateAt(pb.curve, f)
        const sign = pb.band.polarity === 180 ? -1 : 1
        sumLinear += sign * Math.pow(10, db / 20)
      }
      return {
        freq: f,
        magnitude: 20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)),
      }
    })
  }, [processedBands, freqs])

  // -----------------------------------------------------------------------
  // System spinorama (using summed on-axis response + largest driver for directivity)
  // -----------------------------------------------------------------------
  const systemSpinorama = useMemo(() => {
    if (!summedResponse) return null
    // Use a weighted average piston diameter across active drivers
    // For simplicity, use the driver with the largest Sd (dominates directivity)
    const activeDrivers = processedBands
      .map((pb) => pb.driver)
      .filter((d): d is Driver => !!d)
    if (activeDrivers.length === 0) return null
    const largest = activeDrivers.reduce((max, d) => {
      const dia = pistonDiameterOf(d)
      return dia > pistonDiameterOf(max) ? d : max
    }, activeDrivers[0])
    const diameter = pistonDiameterOf(largest)
    return calcSpinorama(summedResponse, diameter, baffleWidth, baffleHeight)
  }, [summedResponse, processedBands, baffleWidth, baffleHeight])

  const spinRef = useMemo(() => {
    if (!systemSpinorama || systemSpinorama.onAxis.length === 0) return 0
    return systemSpinorama.onAxis.reduce((a, b) => a + b, 0) / systemSpinorama.onAxis.length
  }, [systemSpinorama])

  // -----------------------------------------------------------------------
  // System polar (summed directivity at each angle/freq)
  // -----------------------------------------------------------------------
  const systemPolar = useMemo(() => {
    const activeBands = processedBands.filter((pb) => pb.driver)
    if (activeBands.length === 0 || !summedResponse) return null

    const data: number[][] = []
    for (const f of POLAR_FREQS) {
      const onAxisDb = interpolateAt(summedResponse, f)
      const row: number[] = []
      for (const angle of POLAR_ANGLES) {
        // Sum directivity contributions from each driver band
        let sumLinear = 0
        for (const pb of activeBands) {
          const driverDb = interpolateAt(pb.curve, f)
          const diameter = pistonDiameterOf(pb.driver)
          const dir = pistonDirectivity(f, angle, diameter)
          const dbAtAngle = driverDb + 20 * Math.log10(Math.max(dir, 1e-6))
          const sign = pb.band.polarity === 180 ? -1 : 1
          sumLinear += sign * Math.pow(10, dbAtAngle / 20)
        }
        row.push(20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)) - onAxisDb)
      }
      data.push(row)
    }
    return { frequencies: POLAR_FREQS, angles: POLAR_ANGLES, data }
  }, [processedBands, summedResponse])

  // Dense polar for 2D/3D maps
  const systemPolarDense = useMemo(() => {
    const activeBands = processedBands.filter((pb) => pb.driver)
    if (activeBands.length === 0 || !summedResponse) return null

    const curves = { frequencies: POLAR_FREQS, angles: DENSE_ANGLES, data: [] as number[][] }
    const map = { frequencies: MAP_FREQS, angles: DENSE_ANGLES, data: [] as number[][] }

    for (const f of POLAR_FREQS) {
      const onAxisDb = interpolateAt(summedResponse, f)
      const row: number[] = []
      for (const angle of DENSE_ANGLES) {
        let sumLinear = 0
        for (const pb of activeBands) {
          const driverDb = interpolateAt(pb.curve, f)
          const diameter = pistonDiameterOf(pb.driver)
          const dir = pistonDirectivity(f, angle, diameter)
          const dbAtAngle = driverDb + 20 * Math.log10(Math.max(dir, 1e-6))
          const sign = pb.band.polarity === 180 ? -1 : 1
          sumLinear += sign * Math.pow(10, dbAtAngle / 20)
        }
        row.push(20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)) - onAxisDb)
      }
      curves.data.push(row)
    }

    for (const f of MAP_FREQS) {
      const onAxisDb = interpolateAt(summedResponse, f)
      const row: number[] = []
      for (const angle of DENSE_ANGLES) {
        let sumLinear = 0
        for (const pb of activeBands) {
          const driverDb = interpolateAt(pb.curve, f)
          const diameter = pistonDiameterOf(pb.driver)
          const dir = pistonDirectivity(f, angle, diameter)
          const dbAtAngle = driverDb + 20 * Math.log10(Math.max(dir, 1e-6))
          const sign = pb.band.polarity === 180 ? -1 : 1
          sumLinear += sign * Math.pow(10, dbAtAngle / 20)
        }
        row.push(20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)) - onAxisDb)
      }
      map.data.push(row)
    }

    return { curves, map }
  }, [processedBands, summedResponse])

  // -----------------------------------------------------------------------
  // Auto-select drivers by type when ways changes or on first load
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (drivers.length === 0) return
    setBands((prev) => {
      const active = prev.slice(0, ways)
      const roleToType: Record<string, string[]> = {
        low: ['woofer', 'subwoofer'],
        mid: ['midrange', 'fullrange'],
        mid2: ['midrange', 'fullrange', 'tweeter'],
        high: ['tweeter'],
      }
      return active.map((band) => {
        if (band.driverId && drivers.find((d) => d.id === band.driverId)) return band
        // Auto-pick first driver matching the role type
        const preferredTypes = roleToType[band.role] || []
        const match = drivers.find((d) => preferredTypes.includes(d.type))
        return { ...band, driverId: match?.id || drivers[0]?.id || '' }
      })
    })
  }, [drivers, ways])

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const activeDriverCount = processedBands.filter((pb) => pb.driver).length
  const maxSystemDb = summedResponse ? Math.max(...summedResponse.map((p) => p.magnitude)) : 0

  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6']

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Simulering</h2>
      <p className="text-sm text-gray-500">
        Komplet simulering af samlet højttalersystem. Vælg enheder per bånd, indstil delefilter,
        baffel og se samlet frekvensrespons, spinorama og directivity.
      </p>

      {/* Setup */}
      <Card title="Systemopsætning">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Select
            label="Antal veje"
            value={ways}
            onChange={handleWaysChange}
            options={WAYS_OPTIONS}
          />
          <NumberField label="Baffel bredde" unit="mm" value={baffleWidth} onChange={setBaffleWidth} />
          <NumberField label="Baffel højde" unit="mm" value={baffleHeight} onChange={setBaffleHeight} />
          <NumberField label="Afrunding radius" unit="mm" value={roundoverRadius} onChange={setRoundoverRadius} />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Baffelstep ved" value={fStep.toFixed(0)} unit="Hz" />
          <StatCard label="Aktive enheder" value={activeDriverCount} unit={`/${ways}`} />
          <StatCard label="Max system SPL" value={maxSystemDb.toFixed(1)} unit="dB" />
          <StatCard label="Baffel" value={`${baffleWidth}×${baffleHeight}`} unit="mm" />
        </div>
      </Card>

      {/* Band configurations */}
      {bands.slice(0, ways).map((band, i) => {
        const driver = drivers.find((d) => d.id === band.driverId)
        return (
          <Card key={i} title={`${ROLE_LABELS[band.role] || band.role} - vej ${i + 1}`}>
            <div className="space-y-3">
              <Select
                label="Enhed"
                value={band.driverId}
                onChange={(v) => updateBand(i, { driverId: v })}
                options={[
                  { value: '', label: '— Vælg enhed —' },
                  ...drivers.map((d) => ({
                    value: d.id,
                    label: `${d.manufacturer} ${d.model} (${d.type})`,
                  })),
                ]}
              />

              {driver && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <span className="text-gray-500">Type: <span className="text-gray-700 dark:text-gray-300 font-medium">{driver.type}</span></span>
                  <span className="text-gray-500">Fs: <span className="text-gray-700 dark:text-gray-300 font-medium">{driver.tsParams.fs} Hz</span></span>
                  <span className="text-gray-500">Sens: <span className="text-gray-700 dark:text-gray-300 font-medium">{driver.tsParams.sensitivity} dB</span></span>
                  <span className="text-gray-500">Imp: <span className="text-gray-700 dark:text-gray-300 font-medium">{driver.tsParams.imp}Ω</span></span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {band.highpassFreq > 0 && (
                  <>
                    <NumberInput
                      label="Highpass frekvens"
                      unit="Hz"
                      value={band.highpassFreq}
                      step={10}
                      onChange={(v) => updateBand(i, { highpassFreq: v })}
                    />
                    <Select
                      label="Highpass type"
                      value={band.highpassType}
                      onChange={(v) => updateBand(i, { highpassType: v as CrossoverType })}
                      options={XOVER_TYPES}
                    />
                  </>
                )}
                {band.lowpassFreq > 0 && (
                  <>
                    <NumberInput
                      label="Lowpass frekvens"
                      unit="Hz"
                      value={band.lowpassFreq}
                      step={10}
                      onChange={(v) => updateBand(i, { lowpassFreq: v })}
                    />
                    <Select
                      label="Lowpass type"
                      value={band.lowpassType}
                      onChange={(v) => updateBand(i, { lowpassType: v as CrossoverType })}
                      options={XOVER_TYPES}
                    />
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberInput label="Gain" unit="dB" value={band.gain} step={0.5} onChange={(v) => updateBand(i, { gain: v })} />
                <Select
                  label="Polaritet"
                  value={band.polarity}
                  onChange={(v) => updateBand(i, { polarity: parseInt(v) as 0 | 180 })}
                  options={[
                    { value: 0, label: '0° (normal)' },
                    { value: 180, label: '180° (inverteret)' },
                  ]}
                />
                <NumberInput label="Delay" unit="ms" value={band.delay} step={0.01} onChange={(v) => updateBand(i, { delay: v })} />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge color="blue">
                  {band.lowpassFreq > 0 ? `${crossoverSlopeDbPerOctave(band.lowpassType)} dB/okt LP` : 'ingen LP'}
                </Badge>
                <Badge color="green">
                  {band.highpassFreq > 0 ? `${crossoverSlopeDbPerOctave(band.highpassType)} dB/okt HP` : 'ingen HP'}
                </Badge>
                {driver?.frequencyResponse && (
                  <Badge color="orange">Målt frekvensrespons</Badge>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      {/* System frequency response */}
      {summedResponse && (
        <Card title="Samlet system frekvensrespons">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Individuelle bånd (farvede) og sum (stiplet). Summen bruger voltage summation med polarity.
            </p>
            <ResponsivePlot
              data={[
                ...processedBands.map((pb, i) => ({
                  x: freqs.map((f) => f),
                  y: freqs.map((f) => interpolateAt(pb.curve, f)),
                  name: `${ROLE_LABELS[pb.band.role] || pb.band.role}${pb.driver ? ` (${pb.driver.manufacturer} ${pb.driver.model})` : ''}`,
                  color: COLORS[i % COLORS.length],
                })),
                {
                  x: summedResponse.map((p) => p.freq),
                  y: summedResponse.map((p) => p.magnitude),
                  name: 'Sum (samlet)',
                  color: '#6b7280',
                  dash: true,
                },
              ]}
              yLabel="dB SPL"
            />
          </div>
        </Card>
      )}

      {/* Baffle step */}
      <Card title="Baffelstep">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Baffelstep frekvens" value={fStep.toFixed(0)} unit="Hz" />
            <StatCard label="Baffel dimension" value={`${baffleWidth}x${baffleHeight}`} unit="mm" />
            <StatCard label="Tab ved lav freq" value="-6" unit="dB" />
          </div>
          <ResponsivePlot
            data={[
              { x: baffleStepCurve.freq, y: baffleStepCurve.response, name: 'Baffelstep tab', color: '#f97316' },
            ]}
            yRange={[-8, 2]}
            yLabel="dB"
          />
        </div>
      </Card>

      {/* System Spinorama */}
      {systemSpinorama && (
        <Card title="System Spinorama (CEA-2034)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Samlet system directivity. Normaliseret til on-axis (0 dB). Viser Listening Window,
              Early Reflections, Sound Power, Directivity Index og Predicted In-Room.
            </p>
            <ResponsivePlot
              data={[
                { x: systemSpinorama.freq, y: normalize(systemSpinorama.onAxis, spinRef), name: 'On-Axis', color: '#f97316' },
                { x: systemSpinorama.freq, y: normalize(systemSpinorama.listeningWindow, spinRef), name: 'Listening Window', color: '#3b82f6' },
                { x: systemSpinorama.freq, y: normalize(systemSpinorama.earlyReflections, spinRef), name: 'Early Reflections', color: '#10b981' },
                { x: systemSpinorama.freq, y: normalize(systemSpinorama.soundPower, spinRef), name: 'Sound Power', color: '#8b5cf6' },
                { x: systemSpinorama.freq, y: systemSpinorama.directivityIndex.map((v) => Math.min(v, 30)), name: 'Directivity Index', color: '#ef4444' },
                { x: systemSpinorama.freq, y: normalize(systemSpinorama.predictedInRoom, spinRef), name: 'Predicted In-Room', color: '#6b7280' },
              ]}
              yRange={[-20, 10]}
              yLabel="dB (rel. on-axis)"
            />
          </div>
        </Card>
      )}

      {/* System Polar diagram */}
      {systemPolarDense && systemPolar && (
        <Card title="System polardiagram">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Samlet off-axis respons ved udvalgte frekvenser, normaliseret til on-axis (0 dB).
              Hver enhed bidrager med sin piston directivity.
            </p>
            <PolarDiagram polar={systemPolarDense.curves} />
          </div>
        </Card>
      )}

      {/* Directivity map (2D) */}
      {systemPolarDense && (
        <Card title="System directivity map (2D)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Frekvens × vinkel med farve som niveau relativt til on-axis.
            </p>
            <DirectivityMap polar={systemPolarDense.map} />
          </div>
        </Card>
      )}

      {/* Directivity surface (3D) */}
      {systemPolarDense && (
        <Card title="System directivity (3D)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Samme data som isometrisk flade.
            </p>
            <DirectivitySurface polar={systemPolarDense.map} />
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: normalize to reference and clamp at -40 dB
// ---------------------------------------------------------------------------

function normalize(values: number[], ref: number): number[] {
  return values.map((v) => Math.max(v - ref, -40))
}

// ---------------------------------------------------------------------------
// Number field
// ---------------------------------------------------------------------------

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit?: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label} {unit && <span className="text-gray-400">[{unit}]</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Responsive SVG Plot
// ---------------------------------------------------------------------------

interface PlotSeries {
  x: number[]
  y: number[]
  name: string
  color: string
  dash?: boolean
}

function ResponsivePlot({
  data,
  yRange,
  yLabel = 'dB',
}: {
  data: PlotSeries[]
  yRange?: [number, number]
  yLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const isMobile = containerWidth < 600
  const width = containerWidth
  const height = isMobile ? 300 : 400
  const legendWidth = isMobile ? 0 : 160
  const margin = { top: 12, right: isMobile ? 8 : legendWidth + 10, bottom: 35, left: 50 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const allY = data.flatMap((d) => d.y).filter((v) => Number.isFinite(v))
  const dataMin = allY.length ? Math.min(...allY) : 0
  const dataMax = allY.length ? Math.max(...allY) : 10
  const rawMin = yRange ? Math.min(yRange[0], dataMin) : Math.min(dataMin, 0)
  const rawMax = yRange ? Math.max(yRange[1], dataMax) : Math.max(dataMax, 10)
  const span = Math.max(rawMax - rawMin, 1)
  const yStep = [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 8) ?? 100
  const yMin = Math.floor(rawMin / yStep) * yStep
  const yMax = Math.ceil(rawMax / yStep) * yStep

  const xMin = Math.log10(20)
  const xMax = Math.log10(20000)

  function xToPixel(freq: number): number {
    const x = Math.log10(Math.max(freq, 1))
    return margin.left + ((x - xMin) / (xMax - xMin)) * plotW
  }

  function yToPixel(value: number): number {
    return margin.top + ((yMax - value) / (yMax - yMin)) * plotH
  }

  const decades = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const ySteps = Array.from({ length: Math.round((yMax - yMin) / yStep) + 1 }, (_, i) => yMin + i * yStep)

  return (
    <div ref={containerRef} className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        <rect x={margin.left} y={margin.top} width={plotW} height={plotH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

        {ySteps.map((y) => (
          <g key={y}>
            <line x1={margin.left} y1={yToPixel(y)} x2={margin.left + plotW} y2={yToPixel(y)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={margin.left - 5} y={yToPixel(y) + 3} textAnchor="end" fontSize={9} className="fill-gray-500 dark:fill-gray-400">{y}</text>
          </g>
        ))}

        {decades.map((f) => (
          <g key={f}>
            <line x1={xToPixel(f)} y1={margin.top} x2={xToPixel(f)} y2={margin.top + plotH} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
            <text x={xToPixel(f)} y={margin.top + plotH + 14} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-gray-400">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}

        <text x={margin.left + plotW / 2} y={height - 4} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300">Hz</text>
        <text x={12} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 12 ${margin.top + plotH / 2})`}>{yLabel}</text>

        {data.map((series) => {
          const points = series.x.map((x, i) => `${xToPixel(x)},${yToPixel(series.y[i]!)}`).join(' ')
          return (
            <polyline
              key={series.name}
              points={points}
              fill="none"
              stroke={series.color}
              strokeWidth={series.dash ? 2 : 1.5}
              opacity={series.dash ? 0.8 : 0.75}
              strokeDasharray={series.dash ? '6 3' : undefined}
            />
          )
        })}

        {/* Legend */}
        {isMobile ? (
          <g>
            {data.map((series, i) => {
              const colW = width / data.length
              const lx = i * colW + 4
              const ly = 4
              return (
                <g key={series.name} transform={`translate(${lx}, ${ly})`}>
                  <line x1={0} y1={0} x2={10} y2={0} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash ? '4 3' : undefined} />
                  <text x={13} y={3} fontSize={7} className="fill-gray-700 dark:fill-gray-300">{series.name.length > 16 ? series.name.slice(0, 15) + '..' : series.name}</text>
                </g>
              )
            })}
          </g>
        ) : (
          <g>
            {data.map((series, i) => (
              <g key={series.name} transform={`translate(${margin.left + plotW + 10}, ${margin.top + i * 18 + 4})`}>
                <line x1={0} y1={0} x2={15} y2={0} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash ? '6 3' : undefined} />
                <text x={20} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">{series.name}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
