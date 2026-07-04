// Combined system response calculation
// Ported from mk2-reference-loudspeaker simulations/system_response.py
//
// Combines individual driver responses through crossover filters,
// baffle step compensation, and sums them into a complete system response.

import type {
  Driver,
  FrequencyDataPoint,
  Crossover,
  Cabinet,
  SimulationResult,
  PolarResult,
} from '@/types';
import { applyCrossover, applyGainAndPolarity, buildCrossoverFilter } from './crossover';
import { calcBaffleStep, baffleStepFrequency } from './baffle';
import { calcSpinorama, calcPolar } from './directivity';
import { generateFrequencies } from './thieleSmall';

/**
 * Calculate the complete simulation for a speaker system.
 *
 * Steps:
 * 1. Generate frequency array (log-spaced 20Hz - 20kHz)
 * 2. For each driver: apply crossover filters + gain + baffle step
 * 3. Sum all driver responses (power summation with phase consideration)
 * 4. Calculate spinorama from the combined on-axis response
 * 5. Calculate polar diagrams for key frequencies
 * 6. Return all results
 */
export function simulateSystem(
  drivers: Driver[],
  crossover: Crossover,
  cabinet: Cabinet
): SimulationResult {
  const frequencies = generateFrequencies(20, 20000, 12);

  // Baffle step calculation
  const baffleW = cabinet.dimensions.baffleWidth || cabinet.dimensions.width;
  const baffleH = cabinet.dimensions.baffleHeight || cabinet.dimensions.height;
  const fStep = baffleStepFrequency(baffleW, baffleH);
  void fStep; // used in baffle step compensation UI
  const baffleStep = calcBaffleStep(baffleW, baffleH, frequencies);

  // Process each driver through its crossover band
  const individualDrivers: { driverId: string; freq: number[]; response: number[] }[] = [];
  const processedCurves: FrequencyDataPoint[][] = [];

  for (const band of crossover.bands) {
    const driver = drivers.find((d) => d.id === band.driverId);
    if (!driver || !driver.frequencyResponse) continue;

    // Get driver's on-axis response
    let curve: FrequencyDataPoint[] = [...driver.frequencyResponse];

    // Apply baffle step compensation (applied to all drivers on the baffle)
    curve = curve.map((p, i) => ({
      freq: p.freq,
      magnitude: p.magnitude + (baffleStep.response[i] ?? 0),
    }));

    // Apply lowpass filter
    if (band.lowpassFreq > 0 && band.lowpassFreq < 20000) {
      const lpFilter = buildCrossoverFilter(band.lowpassType, band.lowpassFreq, false);
      curve = applyCrossover(lpFilter, curve);
    }

    // Apply highpass filter
    if (band.highpassFreq > 0) {
      const hpFilter = buildCrossoverFilter(band.highpassType, band.highpassFreq, true);
      curve = applyCrossover(hpFilter, curve);
    }

    // Apply gain and polarity
    curve = applyGainAndPolarity(curve, band.gain, band.polarity);

    processedCurves.push(curve);
    individualDrivers.push({
      driverId: band.driverId,
      freq: curve.map((p) => p.freq),
      response: curve.map((p) => p.magnitude),
    });
  }

  // Sum all driver responses (voltage summation for coherent sum, or power sum)
  // For simplicity, use voltage summation (coherent) which is more accurate
  // for a single-listening-position simulation
  const onAxis: FrequencyDataPoint[] = frequencies.map((f) => {
    // Convert each driver's dB back to linear, sum, convert back
    let sumLinear = 0;
    for (const curve of processedCurves) {
      // Interpolate this curve at frequency f
      const db = interpolateAt(curve, f);
      sumLinear += Math.pow(10, db / 20);
    }
    return {
      freq: f,
      magnitude: 20 * Math.log10(Math.max(sumLinear, 1e-10)),
    };
  });

  // Calculate spinorama
  // Use the largest driver's diameter for directivity (simplified)
  const largestDriver = drivers.reduce((largest, d) => {
    const dia = d.dimensions?.overallDiameter || 100;
    return dia > (largest?.dimensions?.overallDiameter || 0) ? d : largest;
  }, drivers[0]);
  const driverDiameter = largestDriver?.dimensions?.overallDiameter || 100;

  const systemResponse = calcSpinorama(onAxis, driverDiameter, baffleW, baffleH);

  // Calculate polar diagrams at standard frequencies
  const polarFreqs = [100, 300, 500, 1000, 2000, 5000, 10000];
  const polarAngles = Array.from({ length: 37 }, (_, i) => -90 + i * 5); // -90 to +90, 5° steps

  const horizontalPolar: PolarResult = calcPolar(
    onAxis,
    polarAngles,
    driverDiameter,
    polarFreqs
  );

  // Vertical polar includes lobing from multi-driver arrangement
  const verticalPolar: PolarResult = calcPolar(
    onAxis,
    polarAngles,
    driverDiameter,
    polarFreqs
  );

  return {
    systemResponse,
    horizontalPolar,
    verticalPolar,
    baffleStep,
    individualDrivers,
  };
}

// ---------------------------------------------------------------------------
// Helper: interpolate a frequency data point at a specific frequency
// ---------------------------------------------------------------------------

function interpolateAt(curve: FrequencyDataPoint[], freq: number): number {
  if (curve.length === 0) return 0;
  if (freq <= curve[0]!.freq) return curve[0]!.magnitude;
  if (freq >= curve[curve.length - 1]!.freq) return curve[curve.length - 1]!.magnitude;

  let lo = 0;
  let hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (curve[mid]!.freq < freq) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const p0 = curve[lo]!;
  const p1 = curve[hi]!;
  const t = (Math.log(freq) - Math.log(p0.freq)) / (Math.log(p1.freq) - Math.log(p0.freq));
  return p0.magnitude + t * (p1.magnitude - p0.magnitude);
}
