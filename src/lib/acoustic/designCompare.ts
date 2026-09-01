// Simulate a DesignState to produce frequency response curves for A/B comparison.
//
// Reuses the same acoustic modules as SystemSimulation but as a standalone
// function that takes a DesignState + driver list and returns the summed
// response + per-band curves.

import type { DesignState, Driver, FrequencyDataPoint } from '@/types'
import { generateFrequencies } from '@/lib/acoustic/thieleSmall'
import { calcBaffleStep, baffleStepFrequency } from '@/lib/acoustic/baffle'
import { buildCrossoverFilter, applyCrossover } from '@/lib/acoustic/crossover'
import { calcCabinetResponse } from '@/lib/acoustic/cabinetResponse'

export interface DesignSimResult {
  freq: number[]
  /** Summed system response (voltage sum of all bands) */
  summed: number[]
  /** Per-band curves (after crossover, gain, baffle step, cabinet) */
  bands: { name: string; role: string; freq: number[]; mag: number[] }[]
  /** Key metrics for comparison */
  metrics: {
    f3Low: number | null
    maxDb: number
    bandCount: number
    driverCount: number
  }
}

export function simulateDesign(
  design: DesignState,
  allDrivers: Driver[],
): DesignSimResult {
  const freqs = generateFrequencies(20, 20000, 12)
  const { ways, bands, baffleWidth, baffleHeight, cabinetType, portFb, portVb, portDiameter, numPorts } = design

  const fStep = baffleStepFrequency(baffleWidth)
  const fStep3x = fStep * 3
  const baffleStepCurve = calcBaffleStep(baffleWidth, baffleHeight, freqs)

  const bandCurves: { name: string; role: string; freq: number[]; mag: number[] }[] = []
  const allCurves: FrequencyDataPoint[][] = []

  for (let i = 0; i < ways && i < bands.length; i++) {
    const band = bands[i]!
    const driver = allDrivers.find((d) => d.id === band.driverId)
    if (!driver) continue

    const driverCount = band.driverCount ?? 1
    const countGainDb = 10 * Math.log10(driverCount)

    // Start from real response or flat at sensitivity
    let curve: FrequencyDataPoint[]
    if (driver.frequencyResponse && driver.frequencyResponse.length > 0) {
      curve = [...driver.frequencyResponse]
      if (driverCount > 1) {
        curve = curve.map((p) => ({ freq: p.freq, magnitude: p.magnitude + countGainDb }))
      }
    } else {
      const sens = driver.tsParams?.sensitivity ?? 0
      curve = freqs.map((f) => ({ freq: f, magnitude: sens + countGainDb }))
    }

    const driverType = driver.type
    const isLowDriver = driverType === 'woofer' || driverType === 'subwoofer'
    const isMidDriver = driverType === 'midrange' || driverType === 'fullrange'

    // Cabinet loading for woofer/subwoofer
    if (isLowDriver) {
      const effDriver = driverCount > 1 && driver.tsParams?.vas
        ? { ...driver, tsParams: { ...driver.tsParams, vas: driver.tsParams.vas * driverCount } }
        : driver
      const cabinetResp = calcCabinetResponse(effDriver, cabinetType, freqs, baffleWidth, 0.707, cabinetType === 'ported' ? { fb: portFb ?? undefined, vb: portVb ?? undefined, portDiameter, numPorts } : undefined)
      curve = curve.map((p, idx) => ({
        freq: p.freq,
        magnitude: p.magnitude + (cabinetResp.response[idx]?.magnitude ?? 0),
      }))
    }

    // Baffle step
    if (isLowDriver || isMidDriver) {
      curve = curve.map((p, idx) => {
        let bsFactor = baffleStepCurve.response[idx] ?? 0
        if (isMidDriver && p.freq > fStep3x) {
          const t = Math.min(1, (p.freq - fStep) / (fStep3x - fStep))
          bsFactor *= (1 - t)
        }
        return { freq: p.freq, magnitude: p.magnitude + bsFactor }
      })
    }

    // Apply highpass
    if (band.highpassFreq > 0) {
      const hp = buildCrossoverFilter(band.highpassType, band.highpassFreq, true)
      curve = applyCrossover(hp, curve)
    }

    // Apply lowpass
    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const lp = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false)
      curve = applyCrossover(lp, curve)
    }

    // Apply gain + polarity (polarity affects phase, but for magnitude comparison we just apply gain)
    curve = curve.map((p) => ({ freq: p.freq, magnitude: p.magnitude + band.gain }))

    const roleLabel = band.role === 'low' ? 'Bas' : band.role === 'mid' ? 'Mellem' : band.role === 'mid2' ? 'Mellem 2' : 'Diskant'
    const driverLabel = `${driver.manufacturer} ${driver.model}`
    bandCurves.push({
      name: `${roleLabel} (${driverLabel})${driverCount > 1 ? ` ${driverCount}×` : ''}`,
      role: band.role,
      freq: curve.map((p) => p.freq),
      mag: curve.map((p) => p.magnitude),
    })
    allCurves.push(curve)
  }

  // Summed response (voltage sum)
  const summed = freqs.map((_f, idx) => {
    let sumLinear = 0
    for (const curve of allCurves) {
      const db = curve[idx]?.magnitude ?? -100
      sumLinear += Math.pow(10, db / 20)
    }
    return 20 * Math.log10(Math.max(sumLinear, 1e-10))
  })

  // Find F3 low (first freq where summed drops 3 dB below max)
  const maxDb = Math.max(...summed)
  const threshold = maxDb - 3
  let f3Low: number | null = null
  for (let i = 0; i < summed.length; i++) {
    if (summed[i]! >= threshold) {
      f3Low = freqs[i]!
      break
    }
  }

  return {
    freq: freqs,
    summed,
    bands: bandCurves,
    metrics: {
      f3Low,
      maxDb,
      bandCount: ways,
      driverCount: bands.filter((b) => b.driverId).length,
    },
  }
}
