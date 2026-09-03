// Preference Score calculation based on the Harman/Olive model
// Ported from spinorama.org's analysis.py (GPL, Pierre Aubert)
// and the Olive et al. patent US2005/0195982
//
// The preference score predicts subjective listener preference from
// anechoic spinorama measurements (CEA-2034 curves).
//
// Score = 12.69 - 2.49*NBD_ON - 2.99*NBD_PIR - 4.31*LFX + 2.32*SM_PIR
//
// Where:
//   NBD_ON  = Narrow Band Deviation of On-Axis curve (100 Hz - 12 kHz, 1/2 octave)
//   NBD_PIR = Narrow Band Deviation of Predicted In-Room curve
//   LFX     = log10(low frequency extension in Hz)
//   SM_PIR  = Smoothness (r²) of Predicted In-Room curve (100 Hz - 16 kHz)
//
// Higher score = better. Typical range 0-10.

import type { SystemResponseResult, FrequencyDataPoint } from '@/types';

// ---------------------------------------------------------------------------
// 1/N octave band centers
// ---------------------------------------------------------------------------

/**
 * Compute 1/N octave band edges.
 * Returns array of [fMin, fMax] for each band, centered on 1000 Hz.
 */
function octaveBands(N: number): [number, number][] {
  const p = Math.pow(2, 1 / N);
  const pBand = Math.pow(2, 1 / (2 * N));
  const iter = Math.floor((N * 10 + 1) / 2);
  const centers: number[] = [];
  for (let i = iter; i > 0; i--) {
    centers.push(1000 / Math.pow(p, i));
  }
  for (let i = 0; i <= iter; i++) {
    centers.push(1000 * Math.pow(p, i));
  }
  return centers.map((c) => [c / pBand, c * pBand] as [number, number]);
}

// ---------------------------------------------------------------------------
// NBD — Narrow Band Deviation
// ---------------------------------------------------------------------------

/**
 * Narrow Band Deviation: mean absolute deviation within each 1/2-octave band,
 * averaged over all bands between 100 Hz and 12 kHz.
 *
 * NBD = (1/N) * Σ |y_avg_band - y_i| averaged within each band
 */
export function calcNBD(freq: number[], db: number[]): number {
  const bands = octaveBands(2);
  let sum = 0;
  let n = 0;

  for (const [omin, omax] of bands) {
    if (omin < 100) continue;
    if (omax > 12000) break;

    // Collect all points in this band
    const yValues: number[] = [];
    for (let i = 0; i < freq.length; i++) {
      if (freq[i]! >= omin && freq[i]! < omax) {
        yValues.push(db[i]!);
      }
    }

    if (yValues.length === 0) continue;

    const yAvg = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    const meanAbsDev = yValues.reduce((a, y) => a + Math.abs(yAvg - y), 0) / yValues.length;
    sum += meanAbsDev;
    n++;
  }

  if (n === 0) return NaN;
  return sum / n;
}

// ---------------------------------------------------------------------------
// SM — Smoothness (r² of linear regression on log-freq vs dB)
// ---------------------------------------------------------------------------

/**
 * Smoothness: Pearson correlation coefficient of determination (r²) for
 * a linear regression of dB vs log(freq) over 100 Hz - 16 kHz.
 *
 * SM ranges from 0 to 1. Higher = smoother (better fit to a line).
 */
export function calcSmoothness(freq: number[], db: number[]): number {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < freq.length; i++) {
    if (freq[i]! >= 100 && freq[i]! <= 16000) {
      points.push({ x: Math.log(freq[i]!), y: db[i]! });
    }
  }

  if (points.length < 2) return 0;

  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const sumY2 = points.reduce((a, p) => a + p.y * p.y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  // A perfectly flat curve has zero variance in Y → denominator is 0.
  // That IS perfectly smooth (r² = 1).
  if (Math.abs(denominator) < 1e-9) {
    // If numerator is also ~0, the line is flat → perfectly smooth
    if (Math.abs(numerator) < 1e-3) return 1;
    return 0;
  }

  const r = numerator / denominator;
  return r * r; // r²
}

// ---------------------------------------------------------------------------
// LFX — Low Frequency Extension
// ---------------------------------------------------------------------------

/**
 * Low Frequency Extension: log10 of the highest frequency below 300 Hz
 * in the sound power curve where SP is -6 dB relative to the mean LW
 * level (300 Hz - 10 kHz).
 *
 * Returns log10(frequency in Hz). Lower frequency = lower LFX = higher score
 * (the -4.31 coefficient penalizes high LFX).
 */
export function calcLFX(
  lwFreq: number[],
  lwDb: number[],
  spFreq: number[],
  spDb: number[],
): number {
  // Mean LW level between 300 Hz and 10 kHz
  let lwSum = 0;
  let lwCount = 0;
  for (let i = 0; i < lwFreq.length; i++) {
    if (lwFreq[i]! >= 300 && lwFreq[i]! <= 10000) {
      lwSum += lwDb[i]!;
      lwCount++;
    }
  }
  if (lwCount === 0) return Math.log10(300); // fallback

  const lwMean = lwSum / lwCount;
  const threshold = lwMean - 6;

  // Find the highest frequency below 300 Hz where SP <= threshold
  let lfxFreq = 300; // default if not found
  for (let i = 0; i < spFreq.length; i++) {
    if (spFreq[i]! < 300 && spDb[i]! <= threshold) {
      if (spFreq[i]! > lfxFreq || lfxFreq === 300) {
        lfxFreq = spFreq[i]!;
      }
    }
  }

  return Math.log10(lfxFreq);
}

// ---------------------------------------------------------------------------
// LFQ — Low Frequency Quality
// ---------------------------------------------------------------------------

/**
 * Low Frequency Quality: mean absolute deviation between LW and SP
 * in 1/20 octave bands from LFX to 300 Hz.
 */
export function calcLFQ(
  lwFreq: number[],
  lwDb: number[],
  spFreq: number[],
  spDb: number[],
  lfxLog: number,
): number {
  const lfxHz = Math.pow(10, lfxLog);
  const bands = octaveBands(20);
  let sum = 0;
  let n = 0;

  for (const [omin, omax] of bands) {
    if (omin < lfxHz) continue;
    if (omax > 300) break;

    // Average LW in this band
    let lwSum = 0;
    let lwCnt = 0;
    for (let i = 0; i < lwFreq.length; i++) {
      if (lwFreq[i]! >= omin && lwFreq[i]! < omax) {
        lwSum += lwDb[i]!;
        lwCnt++;
      }
    }

    // Average SP in this band
    let spSum = 0;
    let spCnt = 0;
    for (let i = 0; i < spFreq.length; i++) {
      if (spFreq[i]! >= omin && spFreq[i]! < omax) {
        spSum += spDb[i]!;
        spCnt++;
      }
    }

    if (lwCnt > 0 && spCnt > 0) {
      sum += Math.abs(lwSum / lwCnt - spSum / spCnt);
      n++;
    }
  }

  if (n === 0) return 0;
  return sum / n;
}

// ---------------------------------------------------------------------------
// Preference Rating (the main score)
// ---------------------------------------------------------------------------

/**
 * Compute the Harman/Olive preference rating.
 *
 * Score = 12.69 - 2.49*NBD_ON - 2.99*NBD_PIR - 4.31*LFX + 2.32*SM_PIR
 *
 * @param nbdOn  NBD of on-axis curve
 * @param nbdPir NBD of predicted in-room curve
 * @param lfx    log10(low frequency extension in Hz)
 * @param smPir  Smoothness (r²) of predicted in-room curve
 * @returns Preference score (typically 0-10, higher is better)
 */
export function prefRating(
  nbdOn: number,
  nbdPir: number,
  lfx: number,
  smPir: number,
): number {
  return 12.69 - 2.49 * nbdOn - 2.99 * nbdPir - 4.31 * lfx + 2.32 * smPir;
}

// ---------------------------------------------------------------------------
// Full score from spinorama result
// ---------------------------------------------------------------------------

export interface PreferenceScoreResult {
  /** Overall preference score (0-10 scale, higher is better) */
  score: number;
  /** Score assuming a perfect subwoofer (LFX set to ~20 Hz) */
  scoreWithSub: number;
  /** NBD of on-axis curve */
  nbdOnAxis: number;
  /** NBD of listening window */
  nbdListeningWindow: number;
  /** NBD of sound power */
  nbdSoundPower: number;
  /** NBD of predicted in-room response */
  nbdPredInRoom: number;
  /** Low frequency extension in Hz */
  lfxHz: number;
  /** Low frequency quality */
  lfq: number;
  /** Smoothness of predicted in-room response (0-1) */
  smPredInRoom: number;
  /** Smoothness of sound power (0-1) */
  smSoundPower: number;
}

/**
 * Compute the full preference score from a CEA-2034 spinorama result.
 *
 * @param spinorama The SystemResponseResult from calcSpinorama()
 * @returns PreferenceScoreResult with score and all components
 */
export function computePreferenceScore(spinorama: SystemResponseResult): PreferenceScoreResult {
  const { freq, onAxis, listeningWindow, soundPower, predictedInRoom } = spinorama;

  const nbdOnAxis = calcNBD(freq, onAxis);
  const nbdListeningWindow = calcNBD(freq, listeningWindow);
  const nbdSoundPower = calcNBD(freq, soundPower);
  const nbdPredInRoom = calcNBD(freq, predictedInRoom);

  const lfxLog = calcLFX(freq, listeningWindow, freq, soundPower);
  const lfxHz = Math.pow(10, lfxLog);
  const lfq = calcLFQ(freq, listeningWindow, freq, soundPower, lfxLog);

  const smPredInRoom = calcSmoothness(freq, predictedInRoom);
  const smSoundPower = calcSmoothness(freq, soundPower);

  const score = prefRating(nbdOnAxis, nbdPredInRoom, lfxLog, smPredInRoom);

  // Score with perfect subwoofer: LFX at 20 Hz → log10(20) ≈ 1.301
  const scoreWithSub = prefRating(nbdOnAxis, nbdPredInRoom, Math.log10(20), smPredInRoom);

  return {
    score: Math.round(score * 10) / 10,
    scoreWithSub: Math.round(scoreWithSub * 10) / 10,
    nbdOnAxis: Math.round(nbdOnAxis * 100) / 100,
    nbdListeningWindow: Math.round(nbdListeningWindow * 100) / 100,
    nbdSoundPower: Math.round(nbdSoundPower * 100) / 100,
    nbdPredInRoom: Math.round(nbdPredInRoom * 100) / 100,
    lfxHz: Math.round(lfxHz),
    lfq: Math.round(lfq * 100) / 100,
    smPredInRoom: Math.round(smPredInRoom * 1000) / 1000,
    smSoundPower: Math.round(smSoundPower * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Helper: compute on-axis curve from processed band curves (complex sum)
// ---------------------------------------------------------------------------

/**
 * Sum processed band curves into a single on-axis response.
 * This is a simple magnitude sum (no phase) for directivity scoring,
 * since the spinorama uses the on-axis magnitude curve.
 *
 * For phase-coherent summation, use the simulation worker's output instead.
 */
export function sumBandsMagnitude(
  bandCurves: FrequencyDataPoint[][],
  gains: number[],
  polarities: (0 | 180)[],
): FrequencyDataPoint[] {
  if (bandCurves.length === 0) return [];
  const freq = bandCurves[0]!.map((p) => p.freq);

  return freq.map((f, fi) => {
    let sumLinear = 0;
    for (let b = 0; b < bandCurves.length; b++) {
      const db = bandCurves[b]![fi]!.magnitude + (gains[b] ?? 0);
      const sign = polarities[b] === 180 ? -1 : 1;
      sumLinear += sign * Math.pow(10, db / 20);
    }
    return { freq: f, magnitude: 20 * Math.log10(Math.abs(sumLinear) + 1e-10) };
  });
}
