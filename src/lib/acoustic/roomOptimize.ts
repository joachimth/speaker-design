// Room optimization: per-band gain optimization for flat in-room response.
// Extracted from autoDesign.ts for modularity.

import type { FrequencyDataPoint } from '@/types';
import { calcInRoomResponse, type RoomAcousticsParams } from './roomAcoustics';

export interface RoomOptimizationResult {
  optimizedGains: number[];
  originalGains: number[];
  beforeFlatness: number;
  afterFlatness: number;
  improvement: number;
  targetLevel: number;
  reasoning: string[];
}

function sumBands(
  bandCurves: FrequencyDataPoint[][],
  bandGains: number[],
  polarities: (0 | 180)[],
): FrequencyDataPoint[] {
  if (bandCurves.length === 0) return [];
  const freqs = bandCurves[0]!.map((p) => p.freq);
  return freqs.map((f, i) => {
    let sumLinear = 0;
    for (let b = 0; b < bandCurves.length; b++) {
      const curve = bandCurves[b]!;
      const db = curve[i]!.magnitude + bandGains[b]!;
      const sign = polarities[b] === 180 ? -1 : 1;
      sumLinear += sign * Math.pow(10, db / 20);
    }
    return { freq: f, magnitude: 20 * Math.log10(Math.max(Math.abs(sumLinear), 1e-10)) };
  });
}

function flatnessScore(
  curve: FrequencyDataPoint[],
  fMin: number,
  fMax: number,
): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return Infinity;
  const mean = inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
  const variance = inRange.reduce((a, p) => a + (p.magnitude - mean) ** 2, 0) / inRange.length;
  return Math.sqrt(variance);
}

function costFunction(
  curve: FrequencyDataPoint[],
  fMin: number,
  fMax: number,
  trialGains: number[],
  initialGains: number[],
): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return Infinity;
  const mean = inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
  const variance = inRange.reduce((a, p) => a + (p.magnitude - mean) ** 2, 0) / inRange.length;
  const stdDev = Math.sqrt(variance);
  let gainPenalty = 0;
  for (let i = 0; i < trialGains.length; i++) {
    const delta = trialGains[i]! - initialGains[i]!;
    gainPenalty += delta * delta;
  }
  gainPenalty *= 0.01;
  return stdDev + gainPenalty;
}

function meanInRange(curve: FrequencyDataPoint[], fMin: number, fMax: number): number {
  const inRange = curve.filter((p) => p.freq >= fMin && p.freq <= fMax);
  if (inRange.length === 0) return 0;
  return inRange.reduce((a, p) => a + p.magnitude, 0) / inRange.length;
}

export function optimizeGainsForRoom(
  bandCurvesZero: FrequencyDataPoint[][],
  polarities: (0 | 180)[],
  initialGains: number[],
  roomParams: RoomAcousticsParams,
  smoothingFraction: number = 3,
  fMin: number = 80,
  fMax: number = 8000,
): RoomOptimizationResult {
  const reasoning: string[] = [];
  const nBands = bandCurvesZero.length;

  if (nBands === 0 || nBands !== initialGains.length) {
    reasoning.push('Antal bånd matcher ikke — optimering ikke mulig.');
    return {
      optimizedGains: initialGains.slice(),
      originalGains: initialGains.slice(),
      beforeFlatness: Infinity,
      afterFlatness: Infinity,
      improvement: 0,
      targetLevel: 0,
      reasoning,
    };
  }

  const baselineSum = sumBands(bandCurvesZero, initialGains, polarities);
  const baselineInRoom = calcInRoomResponse(baselineSum, roomParams, smoothingFraction);
  const beforeScore = flatnessScore(baselineInRoom.inRoomResponse, fMin, fMax);
  const targetMean = meanInRange(baselineInRoom.inRoomResponse, fMin, fMax);
  reasoning.push(
    `Start: in-room fladheds-score (std dev) = ${beforeScore.toFixed(2)} dB ` +
    `over ${fMin}-${fMax} Hz, gennemsnit ${targetMean.toFixed(1)} dB.`,
  );

  const GAIN_CLAMP = 10;
  let bestGains = initialGains.slice();
  const gainStep = 0.5;
  const maxPasses = 5;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improvedThisPass = false;

    for (let band = 0; band < nBands; band++) {
      if (band === 0) continue;

      let bestBandGain = bestGains[band]!;
      let bestBandCost = Infinity;

      const scanStart = Math.max(
        initialGains[band]! - GAIN_CLAMP,
        bestGains[band]! - 6,
      );
      const scanEnd = Math.min(
        initialGains[band]! + GAIN_CLAMP,
        bestGains[band]! + 6,
      );
      for (let g = scanStart; g <= scanEnd + 1e-9; g += gainStep) {
        const trialGains = bestGains.slice();
        trialGains[band] = g;
        const trialSum = sumBands(bandCurvesZero, trialGains, polarities);
        const trialInRoom = calcInRoomResponse(trialSum, roomParams, smoothingFraction);
        const cost = costFunction(trialInRoom.inRoomResponse, fMin, fMax, trialGains, initialGains);
        if (cost < bestBandCost - 1e-9) {
          bestBandCost = cost;
          bestBandGain = g;
        }
      }

      if (Math.abs(bestBandGain - bestGains[band]!) > 1e-9) {
        bestGains[band] = Math.round(bestBandGain * 10) / 10;
        improvedThisPass = true;
      }
    }

    if (!improvedThisPass) {
      reasoning.push(`Optimering konvergeret efter ${pass + 1} passage(r).`);
      break;
    }
    if (pass === maxPasses - 1) {
      reasoning.push(`Maks antal passager (${maxPasses}) nået.`);
    }
  }

  const optimizedSum = sumBands(bandCurvesZero, bestGains, polarities);
  const optimizedInRoom = calcInRoomResponse(optimizedSum, roomParams, smoothingFraction);
  const afterScore = flatnessScore(optimizedInRoom.inRoomResponse, fMin, fMax);
  const afterMean = meanInRange(optimizedInRoom.inRoomResponse, fMin, fMax);
  const improvement = beforeScore - afterScore;

  reasoning.push(`Optimeret gains: [${bestGains.map((g) => g.toFixed(1)).join(', ')}] dB.`);
  reasoning.push(
    `Resultat: fladheds-score ${afterScore.toFixed(2)} dB ` +
    `(forbedring ${improvement.toFixed(2)} dB), gennemsnit ${afterMean.toFixed(1)} dB.`,
  );

  for (let b = 0; b < nBands; b++) {
    const delta = bestGains[b]! - initialGains[b]!;
    if (Math.abs(delta) > 0.05) {
      reasoning.push(`Bånd ${b + 1}: gain ${initialGains[b]!.toFixed(1)} → ${bestGains[b]!.toFixed(1)} dB (Δ${delta > 0 ? '+' : ''}${delta.toFixed(1)}).`);
    }
  }

  return {
    optimizedGains: bestGains,
    originalGains: initialGains.slice(),
    beforeFlatness: beforeScore,
    afterFlatness: afterScore,
    improvement,
    targetLevel: afterMean,
    reasoning,
  };
}
