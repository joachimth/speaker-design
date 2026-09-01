// Biquad coefficient export for MiniDSP 2x4 and other DSP platforms
//
// Converts the internal BiquadCoeffs (b0, b1, b2, a1, a2 with a1/a2 as
// direct-form canonical negatives) to formats loadable in MiniDSP:
//   - Text format (human-readable, paste into MiniDSP advanced biquad input)
//   - Q23 hex format (for XML editing of MiniDSP plugin files at 48 kHz)
//
// MiniDSP biquad convention: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2]
//                                  - a1*y[n-1] - a2*y[n-2]
// where a1, a2 are the FEEDBACK coefficients (opposite sign of the
// standard DSP literature a1/a2 which appear in the denominator as
// 1 + a1*z^-1 + a2*z^-2).
//
// Our internal BiquadCoeffs uses the denominator form: 1 + a1*z^-1 + a2*z^-2
// So for MiniDSP export we negate a1 and a2.

import { buildCrossoverFilter, type BiquadCoeffs, type CrossoverFilter } from './crossover'
import type { CrossoverType, DesignState } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MiniDspBiquadSection {
  b0: number
  b1: number
  b2: number
  a1: number // MiniDSP feedback (negated from internal)
  a2: number // MiniDSP feedback (negated from internal)
}

export interface BandExport {
  label: string
  role: string
  driverId: string
  filterType: string
  fc: number
  isHighpass: boolean
  sections: MiniDspBiquadSection[]
  gainDb: number
  polarity: 0 | 180
  delayMs: number
}

export interface BiquadExportResult {
  sampleRate: number
  bands: BandExport[]
  text: string
}

// ---------------------------------------------------------------------------
// Convert internal biquad to MiniDSP format
// ---------------------------------------------------------------------------

function toMiniDspSection(coeffs: BiquadCoeffs): MiniDspBiquadSection {
  return {
    b0: coeffs.b0,
    b1: coeffs.b1,
    b2: coeffs.b2,
    a1: -coeffs.a1, // negate for MiniDSP feedback convention
    a2: -coeffs.a2,
  }
}

// ---------------------------------------------------------------------------
// Q23 hex conversion (for XML editing)
// ---------------------------------------------------------------------------

/** Convert a float coefficient [-2, 2) to Q23 hex string (6 hex digits). */
export function toQ23Hex(value: number): string {
  // Q23: 24-bit signed, 23 fractional bits
  // Range: [-2.0, +2.0) → [-0x800000, 0x7FFFFF]
  const scaled = Math.round(value * 0x800000)
  const clamped = Math.max(-0x800000, Math.min(0x7fffff, scaled))
  // Convert to unsigned 24-bit representation
  const unsigned = clamped < 0 ? clamped + 0x1000000 : clamped
  return '0x' + unsigned.toString(16).padStart(6, '0')
}

// ---------------------------------------------------------------------------
// Build export from DesignState
// ---------------------------------------------------------------------------

/**
 * Convert a DesignState's crossover bands to MiniDSP biquad sections.
 * Each band's lowpass and/or highpass is decomposed into cascaded biquad sections.
 */
export function exportBiquads(
  design: DesignState,
  sampleRate: number = 48000,
): BiquadExportResult {
  const bands: BandExport[] = []

  const roleLabels: Record<string, string> = {
    low: 'Bas',
    mid: 'Mellem',
    mid2: 'Mellem 2',
    high: 'Diskant',
  }

  for (let i = 0; i < design.ways; i++) {
    const band = design.bands[i]
    if (!band) continue

    // Lowpass
    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const filter = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false, sampleRate)
      bands.push({
        label: `${roleLabels[band.role] || band.role} - Lowpass`,
        role: band.role,
        driverId: band.driverId,
        filterType: band.lowpassType,
        fc: band.lowpassFreq,
        isHighpass: false,
        sections: filter.sections.map(toMiniDspSection),
        gainDb: band.gain,
        polarity: band.polarity,
        delayMs: band.delay,
      })
    }

    // Highpass
    if (band.highpassFreq > 0) {
      const filter = buildCrossoverFilter(band.highpassType, band.highpassFreq, true, sampleRate)
      bands.push({
        label: `${roleLabels[band.role] || band.role} - Highpass`,
        role: band.role,
        driverId: band.driverId,
        filterType: band.highpassType,
        fc: band.highpassFreq,
        isHighpass: true,
        sections: filter.sections.map(toMiniDspSection),
        gainDb: band.gain,
        polarity: band.polarity,
        delayMs: band.delay,
      })
    }
  }

  const text = formatText(bands, sampleRate)
  return { sampleRate, bands, text }
}

// ---------------------------------------------------------------------------
// Text format (paste into MiniDSP Advanced Biquad input)
// ---------------------------------------------------------------------------

function formatText(bands: BandExport[], sampleRate: number): string {
  const lines: string[] = []
  lines.push(`# MiniDSP 2x4 Biquad Export`)
  lines.push(`# Sample rate: ${sampleRate} Hz`)
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push(`#`)
  lines.push(`# Format: b0, b1, b2, a1, a2 (a1/a2 are feedback coefficients)`)
  lines.push(`# Each filter section is a cascaded biquad. Enter sequentially.`)
  lines.push(`#`)

  for (const band of bands) {
    lines.push(``)
    lines.push(`# === ${band.label} (${band.filterType} @ ${band.fc} Hz) ===`)
    lines.push(`# Driver: ${band.driverId}`)
    lines.push(`# Gain: ${band.gainDb.toFixed(1)} dB | Polarity: ${band.polarity}° | Delay: ${band.delayMs.toFixed(2)} ms`)
    lines.push(`# Sections: ${band.sections.length}`)

    for (let i = 0; i < band.sections.length; i++) {
      const s = band.sections[i]!
      lines.push(`# Section ${i + 1}:`)
      // MiniDSP biquad text format: one coefficient per line or comma-separated
      lines.push(`${s.b0.toFixed(10)}, ${s.b1.toFixed(10)}, ${s.b2.toFixed(10)}, ${s.a1.toFixed(10)}, ${s.a2.toFixed(10)}`)
    }

    // Q23 hex representation
    lines.push(`# Q23 hex (for XML editing at ${sampleRate} Hz):`)
    for (let i = 0; i < band.sections.length; i++) {
      const s = band.sections[i]!
      lines.push(`#   Sec ${i + 1}: B0=${toQ23Hex(s.b0)} B1=${toQ23Hex(s.b1)} B2=${toQ23Hex(s.b2)} A1=${toQ23Hex(s.a1)} A2=${toQ23Hex(s.a2)}`)
    }
  }

  lines.push(``)
  lines.push(`# === End of export ===`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// JSON export (structured format for programmatic loading)
// ---------------------------------------------------------------------------

export function exportBiquadsJSON(
  design: DesignState,
  sampleRate: number = 48000,
): string {
  const result = exportBiquads(design, sampleRate)
  return JSON.stringify({
    format: 'minidsp-biquad',
    version: 1,
    sampleRate: result.sampleRate,
    generatedAt: new Date().toISOString(),
    bands: result.bands.map((b) => ({
      label: b.label,
      role: b.role,
      driverId: b.driverId,
      filterType: b.filterType,
      fc: b.fc,
      isHighpass: b.isHighpass,
      gainDb: b.gainDb,
      polarity: b.polarity,
      delayMs: b.delayMs,
      sections: b.sections.map((s) => ({
        b0: s.b0,
        b1: s.b1,
        b2: s.b2,
        a1: s.a1,
        a2: s.a2,
        q23hex: {
          b0: toQ23Hex(s.b0),
          b1: toQ23Hex(s.b1),
          b2: toQ23Hex(s.b2),
          a1: toQ23Hex(s.a1),
          a2: toQ23Hex(s.a2),
        },
      })),
    })),
  }, null, 2)
}

// ---------------------------------------------------------------------------
// Single filter export (for testing / direct use)
// ---------------------------------------------------------------------------

export function exportSingleFilter(
  type: CrossoverType,
  fc: number,
  isHighpass: boolean,
  sampleRate: number = 48000,
): { filter: CrossoverFilter; sections: MiniDspBiquadSection[]; text: string } {
  const filter = buildCrossoverFilter(type, fc, isHighpass, sampleRate)
  const sections = filter.sections.map(toMiniDspSection)
  const text = sections
    .map((s, i) =>
      `# Section ${i + 1}\n${s.b0.toFixed(10)}, ${s.b1.toFixed(10)}, ${s.b2.toFixed(10)}, ${s.a1.toFixed(10)}, ${s.a2.toFixed(10)}`,
    )
    .join('\n')
  return { filter, sections, text }
}
