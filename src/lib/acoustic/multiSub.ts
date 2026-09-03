// Multi-subwoofer time alignment tool
//
// Helps time-align multiple subwoofers by computing the delay needed
// for each sub relative to a reference, based on physical distance and
// optionally room mode optimization.

export interface SubParams {
  /** Subwoofer label (e.g. "Sub 1") */
  label: string
  /** Physical distance from listening position (m) */
  distance: number
  /** Optional fixed delay already applied (ms) */
  existingDelay?: number
  /** Optional polarity inversion (true = inverted) */
  inverted?: boolean
  /** Optional gain offset (dB) */
  gainOffset?: number
}

export interface SubAlignmentResult {
  /** Per-sub alignment data */
  subs: {
    label: string
    distance: number
    delayMs: number
    totalDelayMs: number
    inverted: boolean
    gainDb: number
  }[]
  /** Reference sub (furthest away) */
  referenceLabel: string
  /** Speed of sound used (m/s) */
  speedOfSound: number
  /** Max delay applied (ms) */
  maxDelay: number
}

const SPEED_OF_SOUND = 343 // m/s at 20°C

/**
 * Compute time alignment delays for multiple subwoofers.
 *
 * The furthest subwoofer is the reference (0 delay).
 * All other subs get a delay equal to the distance difference / speed of sound.
 *
 * @param subs  Array of subwoofer parameters
 * @returns Alignment result with per-sub delays
 */
export function alignSubwoofers(subs: SubParams[]): SubAlignmentResult {
  if (subs.length === 0) {
    return { subs: [], referenceLabel: '', speedOfSound: SPEED_OF_SOUND, maxDelay: 0 }
  }

  // Find max distance (reference)
  const maxDistance = Math.max(...subs.map((s) => s.distance))
  const referenceSub = subs.find((s) => s.distance === maxDistance)!

  const result = subs.map((s) => {
    const distanceDiff = maxDistance - s.distance
    const delayMs = (distanceDiff / SPEED_OF_SOUND) * 1000 // m / (m/s) = s → ms
    const totalDelayMs = delayMs + (s.existingDelay ?? 0)
    return {
      label: s.label,
      distance: s.distance,
      delayMs: Math.round(delayMs * 100) / 100,
      totalDelayMs: Math.round(totalDelayMs * 100) / 100,
      inverted: s.inverted ?? false,
      gainDb: s.gainOffset ?? 0,
    }
  })

  const maxDelay = Math.max(...result.map((r) => r.delayMs))

  return {
    subs: result,
    referenceLabel: referenceSub.label,
    speedOfSound: SPEED_OF_SOUND,
    maxDelay: Math.round(maxDelay * 100) / 100,
  }
}

/**
 * Generate MiniDSP biquad delay settings for multi-sub alignment.
 * Returns the delay in samples for each sub at the given sample rate.
 */
export function subDelaysToSamples(
  result: SubAlignmentResult,
  sampleRate: number = 48000,
): { label: string; samples: number; ms: number }[] {
  return result.subs.map((s) => ({
    label: s.label,
    samples: Math.round((s.totalDelayMs / 1000) * sampleRate),
    ms: s.totalDelayMs,
  }))
}
