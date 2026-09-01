// REW (Room EQ Wizard) measurement import parser
//
// REW exports frequency response measurements as tab- or space-separated .txt
// files with columns: Frequency, SPL, Phase (optional).
//
// Common formats:
//   20.0    -10.5    -45.2
//   20.5    -11.0    -47.0
//   ...
//
// Also handles CSV exports (comma-separated) and files with header lines
// that start with * (REW comments) or non-numeric characters.

import type { FrequencyDataPoint, ImpedanceDataPoint } from '@/types'

export interface RewImportResult {
  frequencyResponse?: FrequencyDataPoint[]
  impedance?: ImpedanceDataPoint[]
  /** Source label extracted from REW file header, if present */
  name?: string
  /** Number of data points parsed */
  pointCount: number
}

/**
 * Parse a REW .txt measurement export.
 *
 * Supports:
 * - Tab, space, comma, or semicolon separated values
 * - Header lines starting with * or non-numeric text
 * - 2-column (freq, SPL) or 3-column (freq, SPL, phase) format
 * - Impedance measurements (freq, magnitude-ohms, phase)
 *
 * Detection: if median magnitude > 0.1, treat as impedance (ohms);
 * otherwise treat as SPL (dB, typically negative or 0-100 range).
 */
export function parseRewFile(text: string): RewImportResult {
  const lines = text.split(/\r?\n/)
  const points: { freq: number; mag: number; phase?: number }[] = []
  let name: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // REW comment / header lines
    if (trimmed.startsWith('*')) {
      // Try to extract measurement name from header
      const nameMatch = trimmed.match(/\* Measurement name:\s*(.+)/i)
      if (nameMatch) {
        name = nameMatch[1]!.trim()
      }
      continue
    }

    // Skip non-numeric header lines
    if (!/^[\d\s,;.\-+eE]+$/.test(trimmed)) continue

    // Split by tab, space, comma, or semicolon
    const parts = trimmed.split(/[\t,;\s]+/).filter((p) => p.length > 0)
    if (parts.length < 2) continue

    const freq = parseFloat(parts[0]!)
    const mag = parseFloat(parts[1]!)
    const phase = parts.length >= 3 ? parseFloat(parts[2]!) : undefined

    if (!Number.isFinite(freq) || !Number.isFinite(mag) || freq <= 0) continue
    if (phase !== undefined && !Number.isFinite(phase)) continue

    points.push({ freq, mag, phase })
  }

  if (points.length === 0) {
    return { pointCount: 0 }
  }

  // Sort by frequency (REW files are usually sorted but just in case)
  points.sort((a, b) => a.freq - b.freq)

  // Detect impedance vs SPL: impedance magnitudes are typically > 0.5 ohms,
  // while SPL values can be any dB but are often < 120. If the median
  // magnitude is > 0.1 AND most values are positive, treat as impedance.
  const mags = points.map((p) => p.mag).sort((a, b) => a - b)
  const median = mags[Math.floor(mags.length / 2)] ?? 0
  const positiveRatio = mags.filter((m) => m > 0).length / mags.length

  if (median > 0.1 && positiveRatio > 0.8) {
    // Impedance measurement
    const impedance: ImpedanceDataPoint[] = points.map((p) => ({
      freq: p.freq,
      magnitude: p.mag,
      phase: p.phase,
    }))
    return { impedance, name, pointCount: points.length }
  }

  // SPL measurement
  const frequencyResponse: FrequencyDataPoint[] = points.map((p) => ({
    freq: p.freq,
    magnitude: p.mag,
  }))

  return { frequencyResponse, name, pointCount: points.length }
}

/**
 * Downsample frequency response data to a target number of points.
 * REW files often have 256+ points; we typically want ~100-200 for the app.
 * Uses simple decimation (every Nth point) while preserving min/max extremes.
 */
export function downsampleCurve(
  points: FrequencyDataPoint[],
  targetCount: number = 200,
): FrequencyDataPoint[] {
  if (points.length <= targetCount) return points

  const step = Math.ceil(points.length / targetCount)
  const result: FrequencyDataPoint[] = []

  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]!)
  }

  // Always include the last point
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]!)
  }

  return result
}
