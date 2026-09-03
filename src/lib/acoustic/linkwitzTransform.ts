// Linkwitz Transform for sealed enclosure equalization
//
// The Linkwitz Transform (by Siegfried Linkwitz) allows you to electronically
// transform the response of a sealed enclosure from one Q/frequency pair to
// another. This is commonly used to extend the low-frequency response of a
// sealed subwoofer or woofer by lowering both the cutoff frequency and Q.
//
// The transform is a biquad shelving filter with:
//   - Original: F0, Q0 (the driver's sealed alignment)
//   - Target:  Fp, Qp (the desired response)
//
// The transfer function is:
//   H(s) = (s² + s·(F0/Q0) + F0²) / (s² + s·(Fp/Qp) + Fp²) · (Fp/F0)²
//
// This can be implemented as two cascaded biquads.

import type { BiquadCoeffs } from '@/lib/acoustic/crossover'

export interface LinkwitzTransformParams {
  /** Original sealed resonant frequency (Hz) */
  f0: number
  /** Original sealed Q */
  q0: number
  /** Target resonant frequency (Hz) */
  fp: number
  /** Target Q */
  qp: number
  /** Sample rate (Hz) */
  sampleRate?: number
}

/**
 * Compute biquad coefficients for a Linkwitz Transform.
 *
 * Returns two cascaded biquad sections that implement the transform.
 */
export function linkwitzTransform(params: LinkwitzTransformParams): BiquadCoeffs[] {
  const { f0, q0, fp, qp, sampleRate = 48000 } = params

  // Pre-warp frequencies for bilinear transform
  const w0 = (2 * Math.PI * f0) / sampleRate
  const wp = (2 * Math.PI * fp) / sampleRate

  // Analog prototype coefficients (s-domain)
  // Numerator: s² + s·(w0/Q0) + w0²
  // Denominator: s² + s·(wp/Qp) + wp²
  // Gain: (wp/w0)²

  const numB0 = w0 * w0
  const numB1 = w0 / q0
  const numB2 = 1

  const denA0 = wp * wp
  const denA1 = wp / qp
  const denA2 = 1

  const gainFactor = (fp / f0) * (fp / f0)

  // Apply bilinear transform with pre-warping
  // s = 2·fs·(z-1)/(z+1), let K = 2·fs
  const K = 2 * sampleRate

  // Substituting s and s² into numerator and denominator:
  // Multiply through by (1+z⁻¹)² to get polynomial in z⁻¹
  const nb0 = numB2 * K * K + numB1 * K + numB0
  const nb1 = -2 * numB2 * K * K - 2 * numB0
  const nb2 = numB2 * K * K - numB1 * K + numB0

  const da0 = denA2 * K * K + denA1 * K + denA0
  const da1 = -2 * denA2 * K * K - 2 * denA0
  const da2 = denA2 * K * K - denA1 * K + denA0

  return [{
    b0: (nb0 / da0) * gainFactor,
    b1: (nb1 / da0) * gainFactor,
    b2: (nb2 / da0) * gainFactor,
    a1: da1 / da0,
    a2: da2 / da0,
  }]
}

/**
 * Compute the frequency response of a Linkwitz Transform at given frequencies.
 * Returns magnitude in dB and phase in degrees.
 */
export function linkwitzResponse(
  params: LinkwitzTransformParams,
  freqs: number[],
): { magnitude: number[]; phase: number[] } {
  const coeffs = linkwitzTransform(params)
  const sr = params.sampleRate ?? 48000

  const magnitude: number[] = []
  const phase: number[] = []

  for (const f of freqs) {
    const w = (2 * Math.PI * f) / sr
    let totalMag = 1
    let totalPhase = 0

    for (const c of coeffs) {
      const cosW = Math.cos(w)
      const sinW = Math.sin(w)
      const cos2W = Math.cos(2 * w)
      const sin2W = Math.sin(2 * w)

      const numRe = c.b0 + c.b1 * cosW + c.b2 * cos2W
      const numIm = -(c.b1 * sinW + c.b2 * sin2W)
      const denRe = 1 + c.a1 * cosW + c.a2 * cos2W
      const denIm = -(c.a1 * sinW + c.a2 * sin2W)

      const numMag = Math.sqrt(numRe * numRe + numIm * numIm)
      const denMag = Math.sqrt(denRe * denRe + denIm * denIm)
      totalMag *= numMag / denMag
      totalPhase += Math.atan2(numIm, numRe) - Math.atan2(denIm, denRe)
    }

    magnitude.push(20 * Math.log10(Math.max(totalMag, 1e-10)))
    let phaseDeg = (totalPhase * 180) / Math.PI
    while (phaseDeg > 180) phaseDeg -= 360
    while (phaseDeg < -180) phaseDeg += 360
    phase.push(phaseDeg)
  }

  return { magnitude, phase }
}

/**
 * Compute the sealed enclosure F0 and Q0 from driver T/S parameters.
 *
 * F0 = Fs · √(Vas/Vb + 1)
 * Q0 = Qts · √(Vas/Vb + 1)
 *
 * @param fs  Driver free-air resonance (Hz)
 * @param qts Driver total Q
 * @param vas Driver equivalent volume (L)
 * @param vb  Box volume (L)
 */
export function sealedAlignment(fs: number, qts: number, vas: number, vb: number): { f0: number; q0: number } {
  const ratio = Math.sqrt(vas / vb + 1)
  return {
    f0: fs * ratio,
    q0: qts * ratio,
  }
}
