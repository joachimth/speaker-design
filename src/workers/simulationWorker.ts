// Web Worker for heavy acoustic simulation
//
// Offloads frequency response computation from the main thread.
// The worker receives serialized driver data + design params, computes
// the per-band processed curves and summed response, and returns them.
//
// This avoids blocking the UI during re-renders when sliders/inputs change.

import { generateFrequencies } from '../lib/acoustic/thieleSmall'
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity, filterPhaseRad, buildEqBiquad, applyEqBiquad, eqBiquadPhaseRad, type CrossoverFilter, type BiquadCoeffs } from '../lib/acoustic/crossover'
import { calcCabinetResponse } from '../lib/acoustic/cabinetResponse'
import { calcBaffleStep, calcBaffleStepCompensation } from '../lib/acoustic/baffle'
import { resampleToFreqs } from '../lib/acoustic/preferenceOptimizer'
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
  // fStep must match calcBaffleStep's internal calculation (uses baffleWidth,
  // NOT Math.max(width, height)). Mismatch caused midrange fade-out at wrong freq.
  const fStep = 343000 / (2 * baffleWidth)
  const fStep3x = fStep * 3
  // Baffle step compensation: +6 dB low-shelf at fStep. Any real active
  // speaker includes this EQ. Without it, -6 dB dip in 200-600 Hz region.
  const baffleComp = calcBaffleStepCompensation(fStep, 6, freqs)

  const activeBands = bands.slice(0, ways)
  const processedBands: SimWorkerOutput['processedBands'] = []
  // Store crossover filters for each band so we can compute phase in the sum
  const bandFilters: { lp: CrossoverFilter | null; hp: CrossoverFilter | null; eqs: BiquadCoeffs[] }[] = []

  for (const band of activeBands) {
    const driver = drivers.find((d) => d.id === band.driverId)
    const driverCount = band.driverCount ?? 1
    const hasRealResponse = !!driver?.frequencyResponse && driver.frequencyResponse.length > 0
    const countGainDb = 10 * Math.log10(driverCount)

    let curve: FrequencyDataPoint[]
    if (hasRealResponse && driver!.frequencyResponse) {
      // Resample driver's own frequency response to the freqs grid
      // so cabinet/baffle/crossover/sum all index correctly.
      // This matches the optimizer's simulateOnAxis path.
      curve = resampleToFreqs(driver!.frequencyResponse, freqs)
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
        let compFactor = baffleComp[i] ?? 0
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep))
          bsFactor *= (1 - t)
          compFactor *= (1 - t)
        }
        return { freq: p.freq, magnitude: p.magnitude + bsFactor + compFactor }
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

    // Apply per-band EQ filters (low-shelf, high-shelf, PEQ)
    // Only for bands with active crossover filters in this design
    const hasActiveXover = (band.lowpassFreq > 0 && band.lowpassFreq < 20000) || (band.highpassFreq > 0)
    const eqBiquads: BiquadCoeffs[] = []
    if (hasActiveXover && band.eqFilters) {
      const SAMPLE_RATE_EQ = 48000
      for (const eq of band.eqFilters) {
        if (!eq.enabled || eq.gain === 0) continue
        const biquad = buildEqBiquad(eq.kind, eq.freq, eq.gain, eq.q, SAMPLE_RATE_EQ)
        eqBiquads.push(biquad)
        curve = applyEqBiquad(biquad, curve, SAMPLE_RATE_EQ)
      }
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity)

    bandFilters.push({ lp: lpFilter, hp: hpFilter, eqs: eqBiquads })
    processedBands.push({ band, driverId: band.driverId, curve, hasRealResponse })
  }

  // Summed response (coherent complex voltage summation)
  // Each band contributes: magnitude * e^(j * totalPhase)
  // where totalPhase = filterPhase(LP+HP) + polarity(π if 180) + delay(-2πf*delay)
  // Curve is already on the freqs grid (resampled), so direct index access is safe.
  const SAMPLE_RATE = 48000
  const summedResponse: FrequencyDataPoint[] = freqs.map((f, fi) => {
    let sumReal = 0
    let sumImag = 0
    for (let bi = 0; bi < processedBands.length; bi++) {
      const pb = processedBands[bi]!
      const filters = bandFilters[bi]!

      // Direct index — curve is on freqs grid
      const db = pb.curve[fi]?.magnitude ?? 0
      const mag = Math.pow(10, db / 20)

      // Total phase: filter phase + EQ phase + polarity + delay
      let phase = 0
      if (filters.hp) phase += filterPhaseRad(filters.hp, f, SAMPLE_RATE)
      if (filters.lp) phase += filterPhaseRad(filters.lp, f, SAMPLE_RATE)
      for (const eqBiquad of filters.eqs) {
        phase += eqBiquadPhaseRad(eqBiquad, f, SAMPLE_RATE)
      }
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
