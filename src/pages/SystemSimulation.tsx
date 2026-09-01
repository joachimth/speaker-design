import { useState, useMemo, useRef, useEffect } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { useProjectStore, downloadJSON } from '@/store/projectStore'
import { useDesignStore } from '@/store/designStore'
import { Card, Select, NumberInput, Badge, StatCard, Button } from '@/components/common/UI'
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, crossoverSlopeDbPerOctave } from '@/lib/acoustic/crossover'
import { calcBaffleStep, baffleStepFrequency } from '@/lib/acoustic/baffle'
import { calcSpinorama, pistonDirectivity } from '@/lib/acoustic/directivity'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { suggestCrossover, suggestBaffle, optimizeGainsForRoom, type RoomOptimizationResult } from '@/lib/acoustic/autoDesign'
import { calcInRoomResponse, ROOM_PRESETS, type RoomAcousticsParams } from '@/lib/acoustic/roomAcoustics'
import { calcCabinetResponse } from '@/lib/acoustic/cabinetResponse'
import { exportBiquads, exportBiquadsJSON } from '@/lib/acoustic/biquadExport'
import { calcImpedance, impedanceMetrics } from '@/lib/acoustic/impedance'
import { calcSystemPhase, assessGroupDelay } from '@/lib/acoustic/groupDelay'
import { PolarDiagram, DirectivityMap, DirectivitySurface } from '@/components/charts/DirectivityCharts'
import type { CrossoverType, FrequencyDataPoint, Driver, CabinetType, DesignState, Project, Cabinet } from '@/types'

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
  const { simHandoff, setSimHandoff } = useProjectStore()
  const { design, updateDesign, setWays: storeSetWays, setBands: storeSetBands, updateBand: storeUpdateBand, setBaffle, setPort, setRoomParams: storeSetRoomParams, setCabinetType: storeSetCabinetType, projectName, setProjectName, markClean } = useDesignStore()

  // Shared design state from the store
  const ways = design.ways
  const bands = design.bands
  const baffleWidth = design.baffleWidth
  const baffleHeight = design.baffleHeight
  const roundoverRadius = design.roundoverRadius
  const roomParams = design.roomParams as RoomAcousticsParams
  const smoothingFraction = design.smoothingFraction
  const cabinetType = design.cabinetType
  const portFb = design.portFb
  const portVb = design.portVb
  const portDiameter = design.portDiameter
  const numPorts = design.numPorts

  // Local setter wrappers — proxy to the shared store so the rest of the
  // component can use the same names as before
  const setWays = (n: 2 | 3 | 4) => { storeSetWays(n); if (n === 2) storeSetBands(DEFAULT_BANDS_2); else if (n === 3) storeSetBands(DEFAULT_BANDS_3); else storeSetBands(DEFAULT_BANDS_4) }
  const setBands = (value: Band[] | ((prev: Band[]) => Band[])) => {
    if (typeof value === 'function') storeSetBands(value(design.bands))
    else storeSetBands(value)
  }
  const setBaffleWidth = (v: number) => setBaffle(v, baffleHeight)
  const setBaffleHeight = (v: number) => setBaffle(baffleWidth, v)
  const setRoundoverRadius = (v: number) => updateDesign({ roundoverRadius: v })
  const setRoomParams = (params: RoomAcousticsParams) => storeSetRoomParams(params as Partial<typeof design.roomParams>)
  const setSmoothingFraction = (v: number) => updateDesign({ smoothingFraction: v })
  const setCabinetType = (v: CabinetType) => storeSetCabinetType(v)
  const setPortFb = (v: number | null) => setPort({ fb: v })
  const setPortVb = (v: number | null) => setPort({ vb: v })
  const setPortDiameter = (v: number) => setPort({ diameter: v })
  const setNumPorts = (v: number) => setPort({ numPorts: v })
  function updateBand(index: number, updates: Partial<Band>) { storeUpdateBand(index, updates) }

  // Local-only UI state
  const [showRoomSim, setShowRoomSim] = useState(true)

  // Auto-tune result state
  const [tuneResult, setTuneResult] = useState<RoomOptimizationResult | null>(null)

  const freqs = useMemo(() => generateFrequencies(20, 20000, 12), [])

  // Consume handoff from CabinetMatch (runs once on mount)
  useEffect(() => {
    if (!simHandoff) return
    const h = simHandoff
    updateDesign({
      ways: h.ways,
      baffleWidth: h.baffleWidth,
      baffleHeight: h.baffleHeight,
      cabinetType: h.cabinetType,
      portFb: h.portFb,
      portVb: h.portVb,
      portDiameter: h.portDiameter,
      numPorts: h.numPorts,
    })

    // Map handoff bands to SystemSimulation Band format
    const template = h.ways === 2 ? DEFAULT_BANDS_2 : h.ways === 3 ? DEFAULT_BANDS_3 : DEFAULT_BANDS_4
    const newBands = template.map((t, i) => {
      const hb = h.bands[i]
      if (!hb) return t
      return {
        ...t,
        driverId: hb.driverId,
        role: hb.role as Band['role'],
        lowpassFreq: hb.lowpassFreq,
        lowpassType: hb.lowpassType as CrossoverType,
        highpassFreq: hb.highpassFreq,
        highpassType: hb.highpassType as CrossoverType,
        gain: hb.gain,
        polarity: hb.polarity,
        delay: hb.delay,
      }
    })
    storeSetBands(newBands)

    // Clear handoff so it doesn't re-apply on next visit
    setSimHandoff(null)
  }, [simHandoff, setSimHandoff, updateDesign, storeSetBands])

  // Consume loaded design from the shared store (runs once, from ProjectOverview)
  // The store is populated by ProjectOverview before navigating here.
  // No local effect needed — the store IS the state.

  // Project name for save (from shared store)
  // projectName and setProjectName come from the store above

  // Save current design as a project to IndexedDB
  async function handleSaveProject() {
    const name = projectName.trim() || `Projekt ${new Date().toLocaleDateString('da-DK')}`
    const designState: DesignState = {
      ways,
      bands: bands.slice(0, ways).map((b) => ({ ...b })),
      baffleWidth,
      baffleHeight,
      roundoverRadius,
      roomParams: { ...roomParams, dimensions: { ...roomParams.dimensions } },
      smoothingFraction,
      cabinetType,
      portFb,
      portVb,
      portDiameter,
      numPorts,
    }

    // Collect driver objects for the project
    const projectDrivers = bands
      .slice(0, ways)
      .map((b) => drivers.find((d) => d.id === b.driverId))
      .filter((d): d is Driver => !!d)

    const project: Project = {
      id: `proj-${Date.now()}`,
      name,
      drivers: projectDrivers,
      cabinet: {
        type: cabinetType,
        dimensions: {
          width: baffleWidth,
          height: baffleHeight,
          depth: 0,
          wallThickness: 0,
          baffleWidth,
          baffleHeight,
          frontRoundoverRadius: roundoverRadius,
        },
        internalVolume: 0,
      },
      crossover: { bands: [], ways },
      designState,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    try {
      const { saveProject } = await import('@/db/database')
      await saveProject(project)
      setProjectName('')
      markClean()
      // Brief feedback
      const btn = document.getElementById('save-project-btn')
      if (btn) {
        const orig = btn.textContent
        btn.textContent = '✓ Gemt!'
        setTimeout(() => { btn.textContent = orig }, 2000)
      }
    } catch (e) {
      console.error('Failed to save project:', e)
    }
  }

  // Export current design as JSON file
  function handleExportJSON() {
    const name = projectName.trim() || `projekt-${Date.now()}`
    const designState: DesignState = {
      ways,
      bands: bands.slice(0, ways).map((b) => ({ ...b })),
      baffleWidth,
      baffleHeight,
      roundoverRadius,
      roomParams: { ...roomParams, dimensions: { ...roomParams.dimensions } },
      smoothingFraction,
      cabinetType,
      portFb,
      portVb,
      portDiameter,
      numPorts,
    }
    downloadJSON(designState, `${name.replace(/\s+/g, '-').toLowerCase()}.json`)
  }

  // Biquad export state
  const [showBiquad, setShowBiquad] = useState(false)
  const [biquadText, setBiquadText] = useState('')
  const [sampleRate, setSampleRate] = useState(48000)

  // Generate biquad coefficients for MiniDSP
  function handleExportBiquads() {
    const designState: DesignState = {
      ways,
      bands: bands.slice(0, ways).map((b) => ({ ...b })),
      baffleWidth,
      baffleHeight,
      roundoverRadius,
      roomParams: { ...roomParams, dimensions: { ...roomParams.dimensions } },
      smoothingFraction,
      cabinetType,
      portFb,
      portVb,
      portDiameter,
      numPorts,
    }
    const result = exportBiquads(designState, sampleRate)
    setBiquadText(result.text)
    setShowBiquad(true)
  }

  // Download biquad as .txt file
  function handleDownloadBiquadTxt() {
    const name = projectName.trim() || `biquad-${Date.now()}`
    const blob = new Blob([biquadText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-biquad.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Download biquad as JSON file
  function handleDownloadBiquadJson() {
    const designState: DesignState = {
      ways,
      bands: bands.slice(0, ways).map((b) => ({ ...b })),
      baffleWidth,
      baffleHeight,
      roundoverRadius,
      roomParams: { ...roomParams, dimensions: { ...roomParams.dimensions } },
      smoothingFraction,
      cabinetType,
      portFb,
      portVb,
      portDiameter,
      numPorts,
    }
    const json = exportBiquadsJSON(designState, sampleRate)
    const name = projectName.trim() || `biquad-${Date.now()}`
    downloadJSON(JSON.parse(json), `${name.replace(/\s+/g, '-').toLowerCase()}-biquad.json`)
  }

  // Copy biquad text to clipboard
  async function handleCopyBiquad() {
    try {
      await navigator.clipboard.writeText(biquadText)
      const btn = document.getElementById('copy-biquad-btn')
      if (btn) {
        const orig = btn.textContent
        btn.textContent = '✓ Kopieret!'
        setTimeout(() => { btn.textContent = orig }, 2000)
      }
    } catch (e) {
      console.error('Clipboard failed:', e)
    }
  }

  // handleWaysChange: parse string from Select onChange, call setWays wrapper
  function handleWaysChange(value: string) {
    setWays(parseInt(value) as 2 | 3 | 4)
  }

  // updateBand is defined above as a store wrapper

  // Auto-suggest state
  const [autoReasoning, setAutoReasoning] = useState<string[] | null>(null)
  const [baffleReasoning, setBaffleReasoning] = useState<string[] | null>(null)

  // Auto-suggest crossover from selected drivers
  function handleAutoCrossover() {
    const selectedDrivers = bands
      .slice(0, ways)
      .map((b) => drivers.find((d) => d.id === b.driverId))
      .filter((d): d is Driver => !!d)

    if (selectedDrivers.length < 2) {
      setAutoReasoning(['Vælg mindst 2 enheder før auto-forslag.'])
      return
    }

    const result = suggestCrossover(selectedDrivers, ways)
    setAutoReasoning(result.reasoning)
    if (result.bands.length === 0) return

    const newBands = [...bands]
    for (let i = 0; i < ways && i < result.bands.length; i++) {
      const sug = result.bands[i]!
      newBands[i] = {
        driverId: sug.driverId,
        role: sug.role as Band['role'],
        lowpassFreq: sug.lowpassFreq,
        lowpassType: sug.lowpassType,
        highpassFreq: sug.highpassFreq,
        highpassType: sug.highpassType,
        gain: sug.gain,
        polarity: sug.polarity,
        delay: sug.delay,
      }
    }
    setBands(newBands)

    // Also auto-suggest baffle based on new crossover frequencies
    const xoFreqs = result.bands.map((b) => b.lowpassFreq)
    handleAutoBaffle(selectedDrivers, xoFreqs)
  }

  // Auto-suggest baffle dimensions from drivers and crossover frequencies
  function handleAutoBaffle(
    driverList?: Driver[],
    xoFreqs?: number[],
  ) {
    const selectedDrivers = driverList ?? bands
      .slice(0, ways)
      .map((b) => drivers.find((d) => d.id === b.driverId))
      .filter((d): d is Driver => !!d)

    if (selectedDrivers.length === 0) {
      setBaffleReasoning(['Ingen enheder valgt for baffel-forslag.'])
      return
    }

    const freqs = xoFreqs ?? bands.slice(0, ways).map((b) => b.lowpassFreq)
    const result = suggestBaffle(selectedDrivers, freqs)
    setBaffleReasoning(result.reasoning)
    setBaffleWidth(result.width)
    setBaffleHeight(result.height)
    setRoundoverRadius(result.roundoverRadius)
  }

  // Auto-tune: optimize per-band gains to flatten the in-room response
  function handleAutoTune() {
    const activeBands = processedBands.slice(0, ways)
    if (activeBands.length < 2) {
      setTuneResult(null)
      return
    }

    // Build band curves at gain=0 (undo current gain so optimizer works from neutral)
    const bandCurvesZero = activeBands.map((pb) =>
      pb.curve.map((p) => ({ freq: p.freq, magnitude: p.magnitude - pb.band.gain })),
    )
    const polarities = activeBands.map((pb) => pb.band.polarity)
    const initialGains = activeBands.map((pb) => pb.band.gain)

    const result = optimizeGainsForRoom(
      bandCurvesZero,
      polarities,
      initialGains,
      roomParams,
      smoothingFraction,
      100,
      10000,
    )
    setTuneResult(result)

    // Apply optimized gains to bands
    const newBands = [...bands]
    for (let i = 0; i < ways && i < result.optimizedGains.length; i++) {
      newBands[i] = { ...newBands[i]!, gain: result.optimizedGains[i]! }
    }
    setBands(newBands)
  }

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

      // Apply cabinet loading to woofer/subwoofer band
      if (isLowDriver && driver) {
        const cabinetResp = calcCabinetResponse(driver, cabinetType, freqs, baffleWidth, 0.707, cabinetType === 'ported' ? { fb: portFb ?? undefined, vb: portVb ?? undefined, portDiameter, numPorts } : undefined)
        curve = curve.map((p, i) => ({
          freq: p.freq,
          magnitude: p.magnitude + (cabinetResp.response[i]?.magnitude ?? 0),
        }))
      }

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
  }, [bands, ways, drivers, freqs, baffleStepCurve, fStep, fStep3x, cabinetType, baffleWidth, portFb, portVb, portDiameter, numPorts])

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
  // In-room response simulation (room modes + boundary gain + smoothing)
  // -----------------------------------------------------------------------
  const roomResult = useMemo(() => {
    if (!summedResponse || !showRoomSim) return null
    return calcInRoomResponse(summedResponse, roomParams, smoothingFraction)
  }, [summedResponse, roomParams, smoothingFraction, showRoomSim])

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
  // Impedance simulation (woofer / low-frequency driver)
  // -----------------------------------------------------------------------
  const impedanceResult = useMemo(() => {
    const lowBand = processedBands.find((pb) => pb.driver && (pb.driver.type === 'woofer' || pb.driver.type === 'subwoofer'))
    if (!lowBand?.driver) return null
    const driver = lowBand.driver
    const vb = portVb ?? 50 // fallback if not set
    const fb = portFb ?? undefined
    return calcImpedance({
      ts: driver.tsParams,
      cabinetType,
      boxVolume: vb,
      fb: cabinetType === 'ported' ? fb : undefined,
      fStart: 10,
      fEnd: 20000,
      pointsPerOctave: 24,
    })
  }, [processedBands, cabinetType, portVb, portFb])

  const impMetrics = useMemo(() => {
    if (!impedanceResult) return null
    const lowBand = processedBands.find((pb) => pb.driver && (pb.driver.type === 'woofer' || pb.driver.type === 'subwoofer'))
    if (!lowBand?.driver) return null
    return impedanceMetrics(impedanceResult, lowBand.driver.tsParams)
  }, [impedanceResult, processedBands])

  // -----------------------------------------------------------------------
  // System phase and group delay
  // -----------------------------------------------------------------------
  const systemPhaseResult = useMemo(() => {
    const activeBands = processedBands.slice(0, ways)
    if (activeBands.length === 0) return null

    const activeDrivers = activeBands.map((pb) => pb.driver).filter((d): d is Driver => !!d)
    if (activeDrivers.length === 0) return null

    const cabinet: Cabinet = {
      type: cabinetType,
      dimensions: {
        width: baffleWidth,
        height: baffleHeight,
        depth: 0,
        wallThickness: 0,
        baffleWidth,
        baffleHeight,
        frontRoundoverRadius: roundoverRadius,
      },
      internalVolume: portVb ?? 0,
    }

    const crossover = {
      ways: ways as 2 | 3 | 4,
      bands: activeBands.map((pb) => ({
        id: `${pb.band.role}-${pb.band.driverId}`,
        driverId: pb.band.driverId,
        driverRole: pb.band.role === 'low' ? 'low' as const : pb.band.role === 'high' ? 'high' as const : 'mid' as const,
        highpassFreq: pb.band.highpassFreq,
        lowpassFreq: pb.band.lowpassFreq,
        highpassType: pb.band.highpassType,
        lowpassType: pb.band.lowpassType,
        polarity: pb.band.polarity,
        delay: pb.band.delay,
        gain: pb.band.gain,
      })),
    }

    return calcSystemPhase(activeDrivers, crossover, cabinet)
  }, [processedBands, ways, cabinetType, baffleWidth, baffleHeight, roundoverRadius, portVb])

  const gdAssessment = useMemo(() => {
    if (!systemPhaseResult) return null
    return assessGroupDelay(systemPhaseResult.systemGroupDelay)
  }, [systemPhaseResult])

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

        {/* Cabinet type selector */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kabinet type</label>
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
                {type === 'sealed' ? 'Lukket' : type === 'ported' ? 'Med port' : type === 'transmission_line' ? 'Trans. line' : 'Ren baffel'}
              </button>
            ))}
          </div>
        </div>

        {/* Port tuning controls (only for ported cabinets) */}
        {cabinetType === 'ported' && (
          <div className="mt-3 p-3 rounded-md bg-gray-50 dark:bg-gray-800/50">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Port tuning</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tuning Fb [Hz] (0=auto)</label>
                <input
                  type="number"
                  value={portFb ?? 0}
                  step={1}
                  onChange={(e) => setPortFb(parseFloat(e.target.value) || null)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Volumen Vb [L] (0=auto)</label>
                <input
                  type="number"
                  value={portVb ?? 0}
                  step={1}
                  onChange={(e) => setPortVb(parseFloat(e.target.value) || null)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Port diameter [mm]</label>
                <input
                  type="number"
                  value={portDiameter}
                  step={5}
                  onChange={(e) => setPortDiameter(parseFloat(e.target.value) || 60)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Antal porte</label>
                <input
                  type="number"
                  value={numPorts}
                  step={1}
                  min={1}
                  onChange={(e) => setNumPorts(Math.max(1, Math.round(parseFloat(e.target.value) || 1)))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2 flex-wrap">
          <Button onClick={handleAutoCrossover} variant="primary">
            Auto delefilter + baffel
          </Button>
          <Button onClick={() => handleAutoBaffle()} variant="secondary">
            Kun auto baffel
          </Button>
          <Button onClick={handleAutoTune} variant="secondary">
            Auto-tilpas til in-room
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Baffelstep ved" value={fStep.toFixed(0)} unit="Hz" />
          <StatCard label="Aktive enheder" value={activeDriverCount} unit={`/${ways}`} />
          <StatCard label="Max system SPL" value={maxSystemDb.toFixed(1)} unit="dB" />
          <StatCard label="Baffel" value={`${baffleWidth}×${baffleHeight}`} unit="mm" />
        </div>
      </Card>

      {/* Project save / export */}
      <Card title="Gem projekt">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Projektnavn</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="f.eks. 3-vejs stuehøjtaler"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <Button id="save-project-btn" onClick={handleSaveProject} variant="primary">
            💾 Gem
          </Button>
          <Button onClick={handleExportJSON} variant="secondary">
            📥 Eksporter JSON
          </Button>
          <Button onClick={handleExportBiquads} variant="secondary">
            🔢 Biquad til MiniDSP
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Gemmer aktuelle indstillinger (enheder, delefilter, baffel, kabinet, rum) i browseren. Brug Overblik-siden for at indlæse eller importere projekter.
        </p>

        {/* Biquad export panel */}
        {showBiquad && (
          <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sample rate:</label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(parseInt(e.target.value))}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
              >
                <option value={48000}>48 kHz</option>
                <option value={96000}>96 kHz</option>
                <option value={44100}>44.1 kHz</option>
              </select>
              <Button onClick={handleExportBiquads} variant="ghost" size="sm">
                Opdater
              </Button>
              <Button id="copy-biquad-btn" onClick={handleCopyBiquad} variant="secondary" size="sm">
                📋 Kopier
              </Button>
              <Button onClick={handleDownloadBiquadTxt} variant="secondary" size="sm">
                .txt
              </Button>
              <Button onClick={handleDownloadBiquadJson} variant="secondary" size="sm">
                .json
              </Button>
              <Button onClick={() => setShowBiquad(false)} variant="ghost" size="sm">
                ✕
              </Button>
            </div>
            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-md p-3 overflow-x-auto max-h-80 overflow-y-auto">
              {biquadText}
            </pre>
          </div>
        )}
      </Card>

      {/* Auto-suggest reasoning */}
      {autoReasoning && autoReasoning.length > 0 && (
        <Card title="Auto delefilter begrundelse">
          <div className="space-y-1">
            {autoReasoning.map((line, i) => (
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

      {/* Auto-tune result */}
      {tuneResult && (
        <Card title="Auto-tilpasning resultat (in-room optimering)">
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Før (std dev)" value={tuneResult.beforeFlatness.toFixed(2)} unit="dB" />
              <StatCard label="Efter (std dev)" value={tuneResult.afterFlatness.toFixed(2)} unit="dB" />
              <StatCard label="Forbedring" value={tuneResult.improvement.toFixed(2)} unit="dB" />
              <StatCard label="Mål niveau" value={tuneResult.targetLevel.toFixed(1)} unit="dB" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {tuneResult.optimizedGains.map((g, i) => (
                <Badge key={i} color={i === 0 ? 'blue' : i === 1 ? 'green' : i === 2 ? 'orange' : 'red'}>
                  Bånd {i + 1}: {g.toFixed(1)} dB
                  {g - tuneResult.originalGains[i]! !== 0 && (
                    <span className="ml-1 text-gray-400">
                      (Δ{g - tuneResult.originalGains[i]! > 0 ? '+' : ''}{(g - tuneResult.originalGains[i]!).toFixed(1)})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
            <div className="space-y-1">
              {tuneResult.reasoning.map((line, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{line}</p>
              ))}
            </div>
          </div>
        </Card>
      )}

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

      {/* Cabinet loading response */}
      {(() => {
        const lowBand = processedBands.find((pb) => pb.driver && (pb.driver.type === 'woofer' || pb.driver.type === 'subwoofer'))
        if (!lowBand?.driver) return null
        const cabResp = calcCabinetResponse(lowBand.driver, cabinetType, freqs, baffleWidth, 0.707, cabinetType === 'ported' ? { fb: portFb ?? undefined, vb: portVb ?? undefined, portDiameter, numPorts } : undefined)
        return (
          <Card title={`Kabinet respons (${cabinetType === 'sealed' ? 'Lukket' : cabinetType === 'ported' ? 'Med port' : cabinetType === 'transmission_line' ? 'Trans. line' : 'Ren baffel'})`}>
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{cabResp.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cabResp.params.fc && <StatCard label="Fc" value={cabResp.params.fc.toFixed(0)} unit="Hz" />}
                {cabResp.params.fb && <StatCard label="Fb" value={cabResp.params.fb.toFixed(0)} unit="Hz" />}
                {cabResp.params.f3 && <StatCard label="F3" value={cabResp.params.f3.toFixed(0)} unit="Hz" />}
                {cabResp.params.vb && <StatCard label="Vb" value={cabResp.params.vb.toFixed(1)} unit="L" />}
                {cabResp.params.qtc && <StatCard label="Qtc" value={cabResp.params.qtc.toFixed(3)} />}
                {cabResp.params.lineLength && <StatCard label="Line længde" value={cabResp.params.lineLength} unit="mm" />}
                {cabResp.params.portLength && <StatCard label="Port længde" value={cabResp.params.portLength.toFixed(0)} unit="mm" />}
                {cabResp.params.portDiameter && <StatCard label="Port Ø" value={cabResp.params.portDiameter} unit="mm" />}
                {cabResp.params.numPorts && cabResp.params.numPorts > 1 && <StatCard label="Antal porte" value={cabResp.params.numPorts} />}
              </div>
              <ResponsivePlot
                data={[
                  { x: cabResp.response.map((p) => p.freq), y: cabResp.response.map((p) => p.magnitude), name: 'Kabinet loading (tilføjet til bas)', color: '#8b5cf6' },
                ]}
                yRange={[-30, 6]}
                yLabel="dB"
              />
            </div>
          </Card>
        )
      })()}

      {/* In-room response simulation */}
      {roomResult && (
        <Card title="Forventet in-room respons (stue simulering)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Simulerer hvordan systemet lyder i et rigtigt rum. Rum gain (grænseflader),
              stående bølger (room modes) og 1/{smoothingFraction} oktav udjævning indgår.
            </p>

            {/* Room preset selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Rum forudstilling"
                value={ROOM_PRESETS.findIndex((p) =>
                  p.params.dimensions.length === roomParams.dimensions.length &&
                  p.params.dimensions.width === roomParams.dimensions.width &&
                  p.params.dimensions.height === roomParams.dimensions.height
                )}
                onChange={(v) => {
                  const idx = parseInt(v)
                  if (idx >= 0 && idx < ROOM_PRESETS.length) {
                    setRoomParams(ROOM_PRESETS[idx]!.params)
                  }
                }}
                options={[
                  { value: -1, label: '— Tilpasset —' },
                  ...ROOM_PRESETS.map((p, i) => ({ value: i, label: p.name })),
                ]}
              />
              <Select
                label="Udjævning"
                value={smoothingFraction}
                onChange={(v) => setSmoothingFraction(parseInt(v))}
                options={[
                  { value: 1, label: '1 oktav' },
                  { value: 3, label: '1/3 oktav' },
                  { value: 6, label: '1/6 oktav' },
                  { value: 12, label: '1/12 oktav' },
                ]}
              />
              <div className="flex items-end">
                <Button
                  onClick={() => setShowRoomSim(!showRoomSim)}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  {showRoomSim ? 'Skjul rum-sim' : 'Vis rum-sim'}
                </Button>
              </div>
            </div>

            {/* Room dimension inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <NumberInput label="Længde" unit="m" value={roomParams.dimensions.length} step={0.1} onChange={(v) => setRoomParams({ ...roomParams, dimensions: { ...roomParams.dimensions, length: v } })} />
              <NumberInput label="Bredde" unit="m" value={roomParams.dimensions.width} step={0.1} onChange={(v) => setRoomParams({ ...roomParams, dimensions: { ...roomParams.dimensions, width: v } })} />
              <NumberInput label="Højde" unit="m" value={roomParams.dimensions.height} step={0.1} onChange={(v) => setRoomParams({ ...roomParams, dimensions: { ...roomParams.dimensions, height: v } })} />
              <NumberInput label="RT60" unit="s" value={roomParams.rt60} step={0.05} onChange={(v) => setRoomParams({ ...roomParams, rt60: v })} />
              <NumberInput label="Afstand væg" unit="m" value={roomParams.speakerDistanceFromFront} step={0.1} onChange={(v) => setRoomParams({ ...roomParams, speakerDistanceFromFront: v })} />
              <NumberInput label="Lytposition" unit="m" value={roomParams.listeningDistance} step={0.1} onChange={(v) => setRoomParams({ ...roomParams, listeningDistance: v })} />
            </div>

            {/* Room stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Rum volumen" value={roomResult.volume.toFixed(1)} unit="m³" />
              <StatCard label="Schroeder freq" value={roomResult.schroederFreq.toFixed(0)} unit="Hz" />
              <StatCard label="Antal modes" value={roomResult.modes.length} />
              <StatCard label="Udjævning" value={`1/${smoothingFraction}`} unit="oktav" />
            </div>

            {/* In-room vs free-field plot */}
            <ResponsivePlot
              data={[
                {
                  x: roomResult.smoothedFreeField.map((p) => p.freq),
                  y: roomResult.smoothedFreeField.map((p) => p.magnitude),
                  name: 'Frit felt (udjævnet)',
                  color: '#3b82f6',
                  dash: true,
                },
                {
                  x: roomResult.inRoomResponse.map((p) => p.freq),
                  y: roomResult.inRoomResponse.map((p) => p.magnitude),
                  name: 'In-room (simuleret)',
                  color: '#f97316',
                },
                {
                  x: roomResult.inRoomRaw.map((p) => p.freq),
                  y: roomResult.inRoomRaw.map((p) => p.magnitude),
                  name: 'In-room rå (med modes)',
                  color: '#9ca3af',
                },
              ]}
              yLabel="dB SPL"
            />

            {/* Room gain curve */}
            <div className="text-xs text-gray-500 mb-1">Rum gain (grænseflade forstærkning fra gulv/vægge)</div>
            <ResponsivePlot
              data={[
                { x: roomResult.roomGain.map((p) => p.freq), y: roomResult.roomGain.map((p) => p.magnitude), name: 'Rum gain', color: '#10b981' },
              ]}
              yRange={[0, 12]}
              yLabel="dB"
            />

            {/* Room modes table */}
            <div className="text-xs text-gray-500 mb-1">
              Rum modes under Schroeder ({roomResult.schroederFreq.toFixed(0)} Hz):
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-1 pr-3">Freq (Hz)</th>
                    <th className="text-left py-1 pr-3">Type</th>
                    <th className="text-left py-1 pr-3">L</th>
                    <th className="text-left py-1 pr-3">W</th>
                    <th className="text-left py-1 pr-3">H</th>
                    <th className="text-left py-1">Styrke</th>
                  </tr>
                </thead>
                <tbody>
                  {roomResult.modes.slice(0, 15).map((mode, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-750">
                      <td className="py-1 pr-3 font-mono text-gray-700 dark:text-gray-300">{mode.freq.toFixed(1)}</td>
                      <td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{mode.type}</td>
                      <td className="py-1 pr-3 font-mono">{mode.indices[0]}</td>
                      <td className="py-1 pr-3 font-mono">{mode.indices[1]}</td>
                      <td className="py-1 pr-3 font-mono">{mode.indices[2]}</td>
                      <td className="py-1">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ width: '60px' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${mode.strength * 100}%`,
                              backgroundColor: mode.type === 'axial' ? '#f97316' : mode.type === 'tangential' ? '#3b82f6' : '#9ca3af',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roomResult.modes.length > 15 && (
                <div className="text-xs text-gray-400 mt-1">...og {roomResult.modes.length - 15} flere</div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* System Spinorama */}
      {systemSpinorama && (
        <Card title="System Spinorama (CEA-2034)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Samlet system directivity. Normaliseret til on-axis (0 dB). Viser Listening Window,
              Early Reflections, Sound Power, Directivity Index og Predicted In-Room.
              <br />
              <span className="text-xs text-gray-400">
                NB: Spinorama er baseret på frit felt / anechoic directivity-modellen.
                "Predicted In-Room" er en vægtet kombination af directivity-kurver, ikke
                den detaljerede stue-simulering (rum gain + modes) som vises i "Forventet in-room respons" ovenfor.
              </span>
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

      {/* Impedance simulation */}
      {impedanceResult && impMetrics && (
        <Card title="Impedans (simuleret)">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Simuleret elektrisk input-impedans for bas-enheden i det valgte kabinet.
              Viser resonans-peak, impedans-minimum og fase-forløb.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Z max" value={impMetrics.zMax.toFixed(1)} unit="Ω" />
              <StatCard label=" ved" value={impMetrics.fMax.toFixed(0)} unit="Hz" />
              <StatCard label="Z min" value={impMetrics.zMin.toFixed(1)} unit="Ω" />
              <StatCard label=" ved" value={impMetrics.fMin.toFixed(0)} unit="Hz" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Nominal" value={impMetrics.nominal.toFixed(1)} unit="Ω" />
              <StatCard label="Fase min" value={impMetrics.phaseMin.toFixed(0)} unit="°" />
              <StatCard label=" ved" value={impMetrics.fPhaseMin.toFixed(0)} unit="Hz" />
            </div>
            <ResponsivePlot
              data={[
                { x: impedanceResult.freq, y: impedanceResult.magnitude, name: 'Impedans', color: '#f97316' },
                { x: impedanceResult.freq, y: impedanceResult.phase, name: 'Fase', color: '#3b82f6', dash: true },
              ]}
              yRange={[-90, Math.max(impMetrics.zMax * 1.2, 50)]}
              yLabel="Ω / °"
            />
            <p className="text-xs text-gray-400">
              Orange kurve = impedans (Ω, venstre akse). Blå stiplet = fase (°).
              Bemærk: ved ported kabinet vises dobbelt-peak med dip ved port-tuning (fb).
            </p>
          </div>
        </Card>
      )}

      {/* System phase and group delay */}
      {systemPhaseResult && gdAssessment && (
        <Card title="System fase & gruppetid">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Fase-respons og gruppetid for det samlede system. Gruppetid er den negative
              afledte af fasen og angiver hvor meget forskellige frekvenser forsinkes.
              Flad gruppetid = god transient-gengivelse.
            </p>
            <div
              className={`rounded-md p-3 border text-sm ${
                gdAssessment.rating === 'good'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : gdAssessment.rating === 'acceptable'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              }`}
            >
              {gdAssessment.description}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Peak gruppetid" value={gdAssessment.peakGd.toFixed(1)} unit="ms" />
              <StatCard label=" ved" value={gdAssessment.fPeakGd.toFixed(0)} unit="Hz" />
              <StatCard label="GD @ 100 Hz" value={gdAssessment.gd100Hz.toFixed(1)} unit="ms" />
              <StatCard label="GD @ 1 kHz" value={gdAssessment.gd1kHz.toFixed(2)} unit="ms" />
            </div>
            <ResponsivePlot
              data={[
                { x: systemPhaseResult.systemPhase.freq, y: systemPhaseResult.systemPhase.phase, name: 'System fase', color: '#f97316' },
                ...systemPhaseResult.perBand.map((band, i) => ({
                  x: band.freq,
                  y: band.phaseDeg,
                  name: `Bånd ${i + 1} fase`,
                  color: COLORS[i] ?? '#6b7280',
                  dash: true,
                })),
              ]}
              yRange={[-450, 90]}
              yLabel="°"
            />
            <ResponsivePlot
              data={[
                { x: systemPhaseResult.systemGroupDelay.freq, y: systemPhaseResult.systemGroupDelay.groupDelay, name: 'System gruppetid', color: '#3b82f6' },
                ...systemPhaseResult.perBand.map((band, i) => ({
                  x: band.freq,
                  y: band.groupDelayMs,
                  name: `Bånd ${i + 1} GD`,
                  color: COLORS[i] ?? '#6b7280',
                  dash: true,
                })),
              ]}
              yRange={[0, Math.max(gdAssessment.peakGd * 1.3, 5)]}
              yLabel="ms"
            />
            <p className="text-xs text-gray-400">
              Øverste plot: fase-respons (orange = system, stiplet = per bånd).
              Nederste plot: gruppetid (blå = system, stiplet = per bånd).
              Peaks i gruppetid ved delefilter-frekvenser indikerer fase-misalignering.
            </p>
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
