// Web Worker for heavy acoustic simulation
//
// Offloads frequency response computation from the main thread.
// The worker receives serialized driver data + design params, computes
// the per-band processed curves and summed response, and returns them.
//
// This avoids blocking the UI during re-renders when sliders/inputs change.

import { generateFrequencies } from '../lib/acoustic/thieleSmall'
import { buildCrossoverFilter, applyCrossover, applyGainAndPolarity } from '../lib/acoustic/crossover'
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

    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const lp = buildCrossoverFilter(band.lowpassType as CrossoverType, band.lowpassFreq, false)
      curve = applyCrossover(lp, curve)
    }

    if (band.highpassFreq > 0) {
      const hp = buildCrossoverFilter(band.highpassType as CrossoverType, band.highpassFreq, true)
      curve = applyCrossover(hp, curve)
    }

    curve = applyGainAndPolarity(curve, band.gain, band.polarity)

    processedBands.push({ band, driverId: band.driverId, curve, hasRealResponse })
  }

  // Summed response (voltage summation with polarity + delay)
  const summedResponse: FrequencyDataPoint[] = freqs.map((f) => {
    let sumLinear = 0
    for (const pb of processedBands) {
      // Simple interpolation
      const curve = pb.curve
      let val: number | undefined
      for (let i = 0; i < curve.length; i++) {
        if (curve[i]!.freq >= f) {
          if (i === 0) { val = curve[0]!.magnitude; break }
          const p0 = curve[i - 1]!
          const p1 = curve[i]!
          const t = (Math.log(f) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq))
          val = p0.magnitude + t * (p1.magnitude - p0.magnitude)
          break
        }
      }
      if (val === undefined) val = curve[curve.length - 1]?.magnitude ?? 0

      const sign = pb.band.polarity === 180 ? -1 : 1
      const delayPhase = 2 * Math.PI * f * (pb.band.delay ?? 0) * 0.001
      // Simplified: treat as magnitude sum (phase effects handled in groupDelay module)
      sumLinear += sign * Math.pow(10, val / 20) * Math.cos(delayPhase)
    }
    return { freq: f, magnitude: 20 * Math.log10(Math.abs(sumLinear) + 1e-10) }
  })

  const output: SimWorkerOutput = {
    processedBands,
    summedResponse,
    freqs,
  }

  ;(self as unknown as Worker).postMessage(output)
}
