// Web Worker for heavy acoustic simulation
//
// Offloads frequency response computation from the main thread.
// The worker receives serialized driver data + design params, computes
// the per-band processed curves and summed response, and returns them.
//
// This avoids blocking the UI during re-renders when sliders/inputs change.

import { generateFrequencies } from '../lib/acoustic/thieleSmall'
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, filterPhaseRad, type CrossoverFilter } from '../lib/acoustic/crossover'
import { calcCabinetResponse } from '../lib/acoustic/cabinetResponse'
import { calcBaffleStep } from '../lib/acoustic/baffle'
import type { Driver, FrequencyDataPoint, DesignBand, CabinetType, CrossoverType } from '../types'

export interface SimWorkerInput {
  bands: DesignBand[]
  drivers: Driver[]
  ways: number
  baffleWidth: number
  baffleHeight: number
  cabinetType: string
  portFb: number
  portVb: number
  portDiameter: number
  numPorts: number
}

export interface SimWorkerOutput {
  processedBands: {
    band: DesignBand
    driverId: string
    curve: FrequencyDataPoint[]
    hasRealResponse: boolean
  }[]
  summedResponse: FrequencyDataPoint[]
  freqs: number[]
}

self.onmessage = (e: MessageEvent<SimWorkerInput>) => {
  const { bands, drivers, ways, baffleWidth, baffleHeight, cabinetType, portFb, portVb, portDiameter, numPorts } = e.data

  const freqs = generateFrequencies(20, 20000, 12)

  // Baffle step
  const baffleStepResult = calcBaffleStep(baffleWidth, baffleHeight, freqs)
  const fStep = 343000 / (2 * Math.max(baffleWidth, baffleHeight))
  const fStep3x = fStep * 3

  const activeBands = bands.slice(0, ways)
  const processedBands: SimWorkerOutput['processedBands'] = []
  // Store crossover filters for each band so we can compute phase in the sum
  const bandFilters: { lp: CrossoverFilter | null; hp: CrossoverFilter | null }[] = []

  for (const band of activeBands) {
    const driver = drivers.find((d) => d.id === band.driverId)
    const driverCount = band.driverCount ?? 1
    const hasRealResponse = !!driver?.frequencyResponse && driver.frequencyResponse.length > 0
    const countGainDb = 10 * Math.log10(driverCount)

    let curve: FrequencyDataPoint[]
    if (hasRealResponse && driver!.frequencyResponse) {
      curve = [...driver!.frequencyResponse!]
    } else {
      const sens = driver?.tsParams?.sensitivity ?? 0
      curve = freqs.map((f) => ({ freq: f, magnitude: sens + countGainDb }))
    }

    if (driverCount > 1 && hasRealResponse) {
      curve = curve.map((p) => ({ freq: p.freq, magnitude: p.magnitude + countGainDb }))
    }

    const driverType = driver?.type
    const isLowDriver = driverType === 'woofer' || driverType === 'subwoofer'
    const isMidDriver = driverType === 'midrange' || driverType === 'fullrange'

    if (isLowDriver && driver) {
      const effDriver = driverCount > 1 && driver.tsParams?.vas
        ? { ...driver, tsParams: { ...driver.tsParams, vas: driver.tsParams.vas * driverCount } }
        : driver
      const cabinetResp = calcCabinetResponse(
        effDriver,
        cabinetType as CabinetType,
        freqs,
        baffleWidth,
        0.707,
        cabinetType === 'ported' ? { fb: portFb || undefined, vb: portVb || undefined, portDiameter, numPorts } : undefined,
      )
      curve = curve.map((p, i) => ({
        freq: p.freq,
        magnitude: p.magnitude + (cabinetResp.response[i]?.magnitude ?? 0),
      }))
    }

    if (isLowDriver || isMidDriver) {
      curve = curve.map((p, i) => {
        let bsFactor = baffleStepResult.response[i] ?? 0
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep))
          bsFactor *= (1 - t)
        }
        return { freq: p.freq, magnitude: p.magnitude + bsFactor }
      })
    }

    let lpFilter: CrossoverFilter | null = null
    let hpFilter: CrossoverFilter | null = null

    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      lpFilter = buildCrossoverFilter(band.lowpassType as CrossoverType, band.lowpassFreq, false)
      curve = applyCrossover(lpFilter, curve)
    }

    if (band.highpassFreq > 0) {
      hpFilter = buildCrossoverFilter(band.highpassType as CrossoverType, band.highpassFreq, true)
      curve = applyCrossover(hpFilter, curve)
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity)

    bandFilters.push({ lp: lpFilter, hp: hpFilter })
    processedBands.push({ band, driverId: band.driverId, curve, hasRealResponse })
  }

  // Summed response (coherent complex voltage summation)
  // Each band contributes: magnitude * e^(j * totalPhase)
  // where totalPhase = filterPhase(LP+HP) + polarity(π if 180) + delay(-2πf*delay)
  const SAMPLE_RATE = 48000
  const summedResponse: FrequencyDataPoint[] = freqs.map((f) => {
    let sumReal = 0
    let sumImag = 0
    for (let bi = 0; bi < processedBands.length; bi++) {
      const pb = processedBands[bi]!
      const filters = bandFilters[bi]!

      // Interpolate magnitude at frequency f
      const curve = pb.curve
      let db: number | undefined
      for (let i = 0; i < curve.length; i++) {
        if (curve[i]!.freq >= f) {
          if (i === 0) { db = curve[0]!.magnitude; break }
          const p0 = curve[i - 1]!
          const p1 = curve[i]!
          const t = (Math.log(f) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq))
          db = p0.magnitude + t * (p1.magnitude - p0.magnitude)
          break
        }
      }
      if (db === undefined) db = curve[curve.length - 1]?.magnitude ?? 0

      const mag = Math.pow(10, db / 20)

      // Total phase: filter phase + polarity + delay
      let phase = 0
      if (filters.hp) phase += filterPhaseRad(filters.hp, f, SAMPLE_RATE)
      if (filters.lp) phase += filterPhaseRad(filters.lp, f, SAMPLE_RATE)
      if (pb.band.polarity === 180) phase += Math.PI
      if (pb.band.delay > 0) phase += -2 * Math.PI * f * pb.band.delay * 0.001

      sumReal += mag * Math.cos(phase)
      sumImag += mag * Math.sin(phase)
    }
    const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag)
    return { freq: f, magnitude: 20 * Math.log10(mag + 1e-10) }
  })

  const output: SimWorkerOutput = {
    processedBands,
    summedResponse,
    freqs,
  }

  ;(self as unknown as Worker).postMessage(output)
}
