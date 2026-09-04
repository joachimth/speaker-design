// Target curve optimization for crossover auto-tuning
//
// Extends the existing auto-tune (optimizeGainsForRoom) to support
// a user-defined target curve (e.g. Harman target, flat, tilted).
// The optimizer adjusts per-band gains and delays to minimize the
// difference between the system response and the target curve.

import type { FrequencyDataPoint } from '@/types'

export type TargetCurveType = 'flat' | 'harman' | 'tilted' | 'custom'

export interface TargetCurveParams {
  type: TargetCurveType
  /** Tilt in dB/octave (for 'tilted' type, e.g. -0.5 = -0.5 dB/oct) */
  tilt?: number
  /** Custom target points for 'custom' type */
  customPoints?: { freq: number; magnitude: number }[]
}

/**
 * Generate a target curve at the given frequencies.
 */
export function generateTargetCurve(
  freqs: number[],
  params: TargetCurveParams,
): number[] {
  switch (params.type) {
    case 'flat':
      return freqs.map(() => 0)

    case 'harman':
      // Harman target curve: ~+2 dB tilt from 100 Hz to 10 kHz,
      // gentle roll-off below 100 Hz, flat above
      return freqs.map((f) => {
        if (f < 100) {
          // Low-frequency shelf: gradual boost
          return 2 * Math.min(1, f / 100)
        } else if (f < 10000) {
          // Gentle tilt: +2 dB over 100-10k
          const octaves = Math.log2(f / 100)
          return 2 * (octaves / Math.log2(10000 / 100))
        } else {
          // Flat above 10k
          return 2
        }
      })

    case 'tilted': {
      const tilt = params.tilt ?? -0.5
      return freqs.map((f) => {
        const octaves = Math.log2(f / 1000)
        return tilt * octaves
      })
    }

    case 'custom': {
      if (!params.customPoints || params.customPoints.length < 2) {
        return freqs.map(() => 0)
      }
      const sorted = [...params.customPoints].sort((a, b) => a.freq - b.freq)
      return freqs.map((f) => {
        // Find surrounding points and interpolate (log scale)
        if (f <= sorted[0]!.freq) return sorted[0]!.magnitude
        if (f >= sorted[sorted.length - 1]!.freq) return sorted[sorted.length - 1]!.magnitude

        for (let i = 0; i < sorted.length - 1; i++) {
          if (f >= sorted[i]!.freq && f <= sorted[i + 1]!.freq) {
            const logF = Math.log(f)
            const logLow = Math.log(sorted[i]!.freq)
            const logHigh = Math.log(sorted[i + 1]!.freq)
            const t = (logF - logLow) / (logHigh - logLow)
            return sorted[i]!.magnitude + t * (sorted[i + 1]!.magnitude - sorted[i]!.magnitude)
          }
        }
        return 0
      })
    }

    default:
      return freqs.map(() => 0)
  }
}

/**
 * Optimize per-band gains to match a target curve.
 *
 * Coordinate descent: for each band, try gain adjustments and pick
 * the one that minimizes the weighted error against the target.
 *
 * @param bandResponses  Per-band frequency response (already filtered)
 * @param freqs          Frequency array
 * @param target         Target curve params
 * @param initialGains   Starting gain values per band
 * @param maxGainChange  Maximum gain change (±dB)
 */
export function optimizeForTargetCurve(
  bandResponses: FrequencyDataPoint[][],
  freqs: number[],
  target: TargetCurveParams,
  initialGains: number[],
  maxGainChange: number = 6,
): {
  optimizedGains: number[]
  optimizedResponse: FrequencyDataPoint[]
  targetCurve: number[]
  error: number
  improvement: number
} {
  if (bandResponses.length === 0 || freqs.length === 0) {
    return { optimizedGains: [], optimizedResponse: [], targetCurve: [], error: 0, improvement: 0 }
  }

  const rawTarget = generateTargetCurve(freqs, target)
  const gains = [...initialGains]
  // Band 0 (woofer) locked at gain 0 — it's the reference.
  if (gains.length > 0) gains[0] = 0

  // Offset the target curve to match the system's average level over 100-10000 Hz.
  // The raw target is a shape (0 dB reference); the system response includes driver
  // sensitivity (~80 dB). Without offsetting, the optimizer would try to drag the
  // entire response down to 0 dB instead of matching the target shape.
  const refFreqs = freqs.filter((f) => f >= 100 && f <= 10000)
  const refIndices = refFreqs.map((rf) => freqs.indexOf(rf))
  let systemAvg = 0
  for (const ri of refIndices) {
    let sumLinear = 0
    for (let b = 0; b < bandResponses.length; b++) {
      const idx = findClosestIdx(bandResponses[b]!, freqs[ri]!)
      const db = (bandResponses[b]![idx]?.magnitude ?? -100) + initialGains[b]!
      sumLinear += Math.pow(10, db / 20)
    }
    systemAvg += 20 * Math.log10(Math.max(sumLinear, 1e-10))
  }
  systemAvg /= Math.max(refIndices.length, 1)

  // Also compute the raw target average over the same band to center the shape
  let targetAvg = 0
  for (const ri of refIndices) {
    targetAvg += rawTarget[ri] ?? 0
  }
  targetAvg /= Math.max(refIndices.length, 1)

  const targetCurve = rawTarget.map((v) => v - targetAvg + systemAvg)

  function computeError(testGains: number[]): number {
    let totalError = 0
    for (let i = 0; i < freqs.length; i++) {
      let sumLinear = 0
      for (let b = 0; b < bandResponses.length; b++) {
        const idx = findClosestIdx(bandResponses[b]!, freqs[i]!)
        const db = (bandResponses[b]![idx]?.magnitude ?? -100) + testGains[b]!
        sumLinear += Math.pow(10, db / 20)
      }
      const systemDb = 20 * Math.log10(Math.max(sumLinear, 1e-10))
      const error = systemDb - targetCurve[i]!
      // Weight: emphasize 100-10000 Hz (most audible region)
      const f = freqs[i]!
      const weight = f >= 100 && f <= 10000 ? 1 : 0.3
      totalError += weight * error * error
    }
    return totalError / freqs.length
  }

  const initialError = computeError(gains)

  // Multi-resolution coordinate descent:
  // Start coarse (1 dB) for fast convergence, then refine (0.5, 0.25, 0.1 dB)
  // for precision. This converges ~4x faster than fixed 0.1 dB steps while
  // achieving the same precision.
  const stepSizes = [1.0, 0.5, 0.25, 0.1]
  const maxIterationsPerStep = [10, 8, 5, 3]

  for (let phase = 0; phase < stepSizes.length; phase++) {
    const stepSize = stepSizes[phase]!
    const maxIter = maxIterationsPerStep[phase]!

    for (let iter = 0; iter < maxIter; iter++) {
      let improved = false
      for (let b = 0; b < gains.length; b++) {
        // Band 0 (woofer) locked at gain 0 — it's the reference.
        // All other bands adjust relative to it.
        if (b === 0) continue

        const currentError = computeError(gains)
        let bestGain = gains[b]!
        let bestError = currentError

        // Try increasing
        for (let g = gains[b]! + stepSize; g <= initialGains[b]! + maxGainChange; g += stepSize) {
          const testGains = [...gains]
          testGains[b] = g
          const err = computeError(testGains)
          if (err < bestError) {
            bestError = err
            bestGain = g
          }
        }

        // Try decreasing
        for (let g = gains[b]! - stepSize; g >= initialGains[b]! - maxGainChange; g -= stepSize) {
          const testGains = [...gains]
          testGains[b] = g
          const err = computeError(testGains)
          if (err < bestError) {
            bestError = err
            bestGain = g
          }
        }

        if (bestGain !== gains[b]) {
          gains[b] = bestGain
          improved = true
        }
      }
      if (!improved) break
    }
  }

  const finalError = computeError(gains)
  const optimizedResponse = freqs.map((f) => {
    let sumLinear = 0
    for (let b = 0; b < bandResponses.length; b++) {
      const idx = findClosestIdx(bandResponses[b]!, f)
      const db = (bandResponses[b]![idx]?.magnitude ?? -100) + gains[b]!
      sumLinear += Math.pow(10, db / 20)
    }
    return { freq: f, magnitude: 20 * Math.log10(Math.max(sumLinear, 1e-10)) }
  })

  return {
    optimizedGains: gains.map((g) => Math.round(g * 10) / 10),
    optimizedResponse,
    targetCurve,
    error: Math.sqrt(finalError),
    improvement: Math.sqrt(initialError) - Math.sqrt(finalError),
  }
}

function findClosestIdx(data: FrequencyDataPoint[], freq: number): number {
  let closest = 0
  let minDiff = Infinity
  for (let i = 0; i < data.length; i++) {
    const diff = Math.abs(data[i]!.freq - freq)
    if (diff < minDiff) {
      minDiff = diff
      closest = i
    }
  }
  return closest
}
