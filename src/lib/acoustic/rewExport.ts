// REW (Room EQ Wizard) measurement export
//
// Exports the simulated system frequency response as a plain-text
// frequency/measurement file that can be imported into REW for
// comparison with real measurements, room correction, or further EQ.
//
// REW supports two import formats:
// 1. Tab-separated .txt: "Freq <tab> dB" per line (simplest)
// 2. Binary .frd: same as .txt with SPL/Phase columns
//
// We use format 1 (tab-separated) since it's the most widely compatible.
// REW: File → Import → Import Frequency Response

import type { FrequencyDataPoint } from '@/types';

/**
 * Generate REW-importable text from a frequency response curve.
 * Format: frequency (Hz) <tab> magnitude (dB) per line.
 */
export function exportToREW(
  curve: FrequencyDataPoint[],
  label: string = 'System Response',
): string {
  const header = `* Speaker Design export: ${label}\n* Format: REW frequency response import\n* Columns: Freq (Hz)\tSPL (dB)\n*\n`;
  const lines = curve.map((p) => `${p.freq.toFixed(2)}\t${p.magnitude.toFixed(4)}`);
  return header + lines.join('\n') + '\n';
}

/**
 * Generate a downloadable .txt blob for REW import.
 */
export function downloadREWExport(
  curve: FrequencyDataPoint[],
  label: string = 'system-response',
): void {
  const text = exportToREW(curve, label);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${label.replace(/\s+/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
