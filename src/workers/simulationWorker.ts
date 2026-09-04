// Web Worker for heavy acoustic simulation
//
// Offloads frequency response computation from the main thread.
// The worker receives serialized driver data + design params, computes
// the per-band processed curves and summed response, and returns them.
//
// This avoids blocking the UI during re-renders when sliders/inputs change.

import { generateFrequencies } from '../lib/acoustic/thieleSmall'
import { processBand, complexSum, type ProcessedBand } from '../lib/acoustic/simulateBands'
import { calcBaffleStep, calcBaffleStepCompensation } from '../lib/acoustic/baffle'
import type { Driver, FrequencyDataPoint, DesignBand } from '../types'

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

  // Baffle step + compensation (shared model — derive from actual loss)
  const baffleStepResult = calcBaffleStep(baffleWidth, baffleHeight, freqs)
  const fStep = 343000 / (2 * baffleWidth)
  const fStep3x = fStep * 3
  const baffleCompDb = Math.abs(baffleStepResult.response[0] ?? 6)
  const baffleComp = calcBaffleStepCompensation(fStep, baffleCompDb, freqs)

  const activeBands = bands.slice(0, ways)
  const processedBands: ProcessedBand[] = []

  for (const band of activeBands) {
    const driver = drivers.find((d) => d.id === band.driverId)
    const result = processBand(
      band, driver, freqs,
      baffleStepResult, baffleComp,
      fStep, fStep3x,
      cabinetType, portFb, portVb, portDiameter, numPorts,
      baffleWidth,
    )
    if (!result) continue
    processedBands.push({
      band,
      driverId: band.driverId,
      curve: result.curve,
      hasRealResponse: result.hasRealResponse,
      filters: result.filters,
    })
  }

  // Complex voltage summation (shared implementation)
  const summedResponse = complexSum(processedBands, freqs)

  const output: SimWorkerOutput = {
    processedBands: processedBands.map((pb) => ({
      band: pb.band,
      driverId: pb.driverId,
      curve: pb.curve,
      hasRealResponse: pb.hasRealResponse,
    })),
    summedResponse,
    freqs,
  }

  ;(self as unknown as Worker).postMessage(output)
}
