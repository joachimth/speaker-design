// Impedance matching at crossover frequency
//
// Evaluates driver impedance at the crossover point to check if
// adjacent drivers have compatible impedance at the crossover frequency.
// Large impedance mismatches can cause crossover networks to behave
// differently than expected.

import type { Driver } from '@/types'
import { generateFrequencies } from './thieleSmall'

/**
 * Compute the impedance magnitude of a driver at a specific frequency
 * using the standard loudspeaker impedance model.
 *
 * Z(f) = Re + jwLe in parallel with motional branch:
 * Z_motional = (Bl)² / (Mms·s + Rms + 1/(s·Cms))
 *
 * Simplified: uses the measured impedance curve if available,
 * otherwise computes from T/S parameters.
 */
export function impedanceAtFreq(driver: Driver, freq: number): number {
  // If we have measured impedance data, use it
  if (driver.impedance && driver.impedance.length > 0) {
    // Linear interpolation between two nearest points
    const sorted = [...driver.impedance].sort((a, b) => a.freq - b.freq)
    let lower = sorted[0]!
    let upper = sorted[sorted.length - 1]!
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i]!.freq <= freq && sorted[i + 1]!.freq >= freq) {
        lower = sorted[i]!
        upper = sorted[i + 1]!
        break
      }
    }
    if (lower.freq === upper.freq) return lower.magnitude
    const t = (freq - lower.freq) / (upper.freq - lower.freq)
    return lower.magnitude + t * (upper.magnitude - lower.magnitude)
  }

  // Compute from T/S parameters
  const ts = driver.tsParams
  const w = 2 * Math.PI * freq

  // Voice coil resistance + inductance
  const zRe = ts.re
  const zLe = (ts.le ?? 0.5) * w // inductive reactance

  // Motional impedance (simplified resonance model)
  // At resonance: Z peaks to Re + (Bl)²/Rms
  // Away from resonance: Z approaches Re + jwLe
  const ratio = freq / ts.fs
  const qFactor = ts.qts

  // Simplified impedance model: single resonance peak
  const bl = ts.bl ?? 5
  const rms = ts.qms > 0 ? (bl * bl) / (ts.fs * ts.qms * (ts.sdM2 ?? ts.sd * 1e-4)) : 5
  const resonancePeak = (bl * bl) / rms
  const zMotional = resonancePeak / Math.sqrt(1 + ((ratio - 1) / qFactor) ** 2)

  return Math.sqrt((zRe + zMotional) ** 2 + zLe ** 2)
}

export interface ImpedanceMatchResult {
  crossoverFreq: number
  lowerLabel: string
  upperLabel: string
  lowerImpedance: number
  upperImpedance: number
  ratio: number
  mismatch: number // percentage mismatch
  rating: 'good' | 'acceptable' | 'poor'
  description: string
}

/**
 * Check impedance matching between two drivers at a crossover frequency.
 *
 * @param lowerDriver  The lower-frequency driver
 * @param upperDriver  The upper-frequency driver
 * @param crossoverFreq  Crossover frequency in Hz
 */
export function checkImpedanceMatch(
  lowerDriver: Driver,
  upperDriver: Driver,
  crossoverFreq: number,
): ImpedanceMatchResult {
  const zLower = impedanceAtFreq(lowerDriver, crossoverFreq)
  const zUpper = impedanceAtFreq(upperDriver, crossoverFreq)
  const ratio = Math.max(zLower, zUpper) / Math.min(zLower, zUpper)
  const mismatch = (ratio - 1) * 100

  let rating: 'good' | 'acceptable' | 'poor'
  let description: string

  if (mismatch < 20) {
    rating = 'good'
    description = `God match: ${zLower.toFixed(1)}Ω vs ${zUpper.toFixed(1)}Ω (Δ${mismatch.toFixed(0)}%). Crossover virker som forventet.`
  } else if (mismatch < 50) {
    rating = 'acceptable'
    description = `Acceptabel: ${zLower.toFixed(1)}Ω vs ${zUpper.toFixed(1)}Ω (Δ${mismatch.toFixed(0)}%). Pas på filter Q.`
  } else {
    rating = 'poor'
    description = `Stor mismatch: ${zLower.toFixed(1)}Ω vs ${zUpper.toFixed(1)}Ω (Δ${mismatch.toFixed(0)}%). Crossover Q påvirkes.`
  }

  return {
    crossoverFreq,
    lowerLabel: `${lowerDriver.manufacturer} ${lowerDriver.model}`,
    upperLabel: `${upperDriver.manufacturer} ${upperDriver.model}`,
    lowerImpedance: zLower,
    upperImpedance: zUpper,
    ratio,
    mismatch,
    rating,
    description,
  }
}

/**
 * Generate an impedance curve from T/S parameters for plotting.
 */
export function computeImpedanceCurve(driver: Driver): { freq: number; magnitude: number }[] {
  const freqs = generateFrequencies(10, 20000, 12)
  return freqs.map((f) => ({ freq: f, magnitude: impedanceAtFreq(driver, f) }))
}
