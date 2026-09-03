// Psychoacoustic smoothing of frequency response data
//
// Implements 1/3-octave and 1/6-octave fractional-octave smoothing
// similar to REW's psychoacoustic smoothing. This averages each point
// over a fractional-octave window centered on that frequency, which
// removes narrow dips/peaks that the ear cannot resolve while preserving
// broad trends.

import type { FrequencyDataPoint } from '@/types'

/**
 * Fractional-octave smoothing of frequency response data.
 *
 * @param data   Frequency response points (freq in Hz, magnitude in dB)
 * @param fraction  Smoothing window in octaves (3 = 1/3 oct, 6 = 1/6 oct, 1 = full octave)
 * @returns Smoothed frequency response
 */
export function psychoacousticSmooth(
  data: FrequencyDataPoint[],
  fraction: number = 3,
): FrequencyDataPoint[] {
  if (data.length < 3) return data

  // Convert fraction to window width in octaves
  // 1/N octave means the window spans ±1/(2N) octaves around center
  const halfWidthOctaves = 1 / (2 * fraction)
  const ln2 = Math.log(2)

  return data.map((point) => {
    const centerLn = Math.log(point.freq)

    // Find all points within the smoothing window
    let sumWeighted = 0
    let sumWeights = 0

    for (let j = 0; j < data.length; j++) {
      const pointLn = Math.log(data[j]!.freq)
      const octavesAway = Math.abs(pointLn - centerLn) / ln2

      if (octavesAway > halfWidthOctaves) continue

      // Triangular weighting: max at center, 0 at edges
      const weight = 1 - octavesAway / halfWidthOctaves
      sumWeighted += data[j]!.magnitude * weight
      sumWeights += weight
    }

    return {
      freq: point.freq,
      magnitude: sumWeights > 0 ? sumWeighted / sumWeights : point.magnitude,
    }
  })
}

/**
 * Band-average a frequency response into 1/N octave bands.
 * Returns the average dB level for each standard 1/N octave band.
 *
 * @param data   Frequency response points
 * @param fraction  Band spacing (3 = 1/3 oct, 6 = 1/6 oct)
 * @returns Array of { freq, magnitude } for each band center
 */
export function bandAverage(
  data: FrequencyDataPoint[],
  fraction: number = 3,
): FrequencyDataPoint[] {
  // Generate band center frequencies (ISO 266 standard)
  const bands: number[] = []
  const refFreq = 1000 // reference frequency
  const ratio = Math.pow(2, 1 / fraction)

  // Generate below 1000 Hz
  let f = refFreq
  while (f > 10) {
    f /= ratio
    bands.unshift(f)
  }
  // Generate above 1000 Hz
  f = refFreq
  bands.push(f)
  while (f < 20000) {
    f *= ratio
    bands.push(f)
  }

  // Sort bands
  bands.sort((a, b) => a - b)

  const result: FrequencyDataPoint[] = []
  const halfWidthOctaves = 1 / (2 * fraction)
  const ln2 = Math.log(2)

  for (const bandCenter of bands) {
    const centerLn = Math.log(bandCenter)
    let sumWeighted = 0
    let sumWeights = 0

    for (const point of data) {
      const octavesAway = Math.abs(Math.log(point.freq) - centerLn) / ln2
      if (octavesAway > halfWidthOctaves) continue
      const weight = 1 - octavesAway / halfWidthOctaves
      sumWeighted += point.magnitude * weight
      sumWeights += weight
    }

    if (sumWeights > 0) {
      result.push({ freq: bandCenter, magnitude: sumWeighted / sumWeights })
    }
  }

  return result
}
