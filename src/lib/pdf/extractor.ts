// PDF datasheet extraction
// Uses PDF.js to extract text and images from speaker driver datasheets.
//
// Pipeline:
// 1. Load PDF via PDF.js (Web Worker for non-blocking)
// 2. Extract all text → regex parse for Thiele-Small parameters
// 3. Extract images → detect frequency response / impedance graphs
// 4. User-assisted graph digitization (click points on the graph image)
//
// Many speaker datasheets use custom embedded fonts that defeat text extraction.
// In those cases, we fall back to image-based extraction with manual digitization.

import type { ThieleSmallParams, FrequencyDataPoint, ImpedanceDataPoint } from '@/types';

/** Minimal PDF.js module type (we only use a few methods) */
type PdfjsModule = typeof import('pdfjs-dist')

/** PDF.js image object (minimal shape we use) */
interface PdfImage {
  width: number
  height: number
  data: Uint8Array | number[]
}

/** Minimal page interface for getImageData (structural, compatible with PDFPageProxy) */
interface PdfPageLike {
  objs: { get(name: string, cb: (img: PdfImage) => void): void }
}

// PDF.js is loaded dynamically to keep initial bundle small
let pdfjsLib: PdfjsModule | null = null;

async function loadPdfJs(): Promise<PdfjsModule> {
  if (pdfjsLib) return pdfjsLib;
  const pdfjs = await import(/* @vite-ignore */ 'pdfjs-dist');
  // Set worker path
  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjsLib = pdfjs;
  return pdfjs;
}

export interface PdfExtractionResult {
  text: string;
  tsParams: Partial<ThieleSmallParams>;
  images: { pageIndex: number; imageIndex: number; dataUrl: string; width: number; height: number }[];
  rawText: { pageIndex: number; text: string }[];
  numPages: number;
}

/**
 * Extract all data from a PDF datasheet.
 */
export async function extractPdf(
  pdfBuffer: ArrayBuffer
): Promise<PdfExtractionResult> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
  const numPages = doc.numPages;

  const allText: string[] = [];
  const rawText: { pageIndex: number; text: string }[] = [];
  const images: PdfExtractionResult['images'] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: object) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');

    allText.push(pageText);
    rawText.push({ pageIndex: i, text: pageText });

    // Extract images from the page
    const ops = await page.getOperatorList();
    const fnArray = ops.fnArray;
    const argsArray = ops.argsArray;

    for (let j = 0; j < fnArray.length; j++) {
      // BEGIN_IMAGE (opcode 85) or PAINT_IMAGE (varies by PDF.js version)
      const opsMap = pdfjs.OPS as Record<string, number>
      if (fnArray[j] === opsMap.paintImageXObject || fnArray[j] === opsMap.paintInlineImage) {
        try {
          const img = argsArray[j];
          if (img && img.width && img.height) {
            // Get the image data
            const imgData = await getImageData(page as PdfPageLike, j, ops, pdfjs);
            if (imgData) {
              images.push({
                pageIndex: i,
                imageIndex: j,
                dataUrl: imgData.dataUrl,
                width: imgData.width,
                height: imgData.height,
              });
            }
          }
        } catch {
          // Skip images that can't be extracted
        }
      }
    }
  }

  // Parse T/S parameters from extracted text
  const tsParams = parseTsParams(allText.join('\n'));

  return {
    text: allText.join('\n'),
    tsParams,
    images,
    rawText,
    numPages,
  };
}

/**
 * Helper to extract image data from PDF page operator list.
 */
async function getImageData(
  page: PdfPageLike,
  opIndex: number,
  ops: { fnArray: number[]; argsArray: unknown[] },
  pdfjs: PdfjsModule
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const args = ops.argsArray[opIndex];
    const fn = ops.fnArray[opIndex];

    const opsMap = pdfjs.OPS as Record<string, number>
    if (fn === opsMap.paintInlineImage) {
      // Inline image - data is in args
      const img = args as PdfImage | undefined;
      if (img && img.width && img.height && img.data) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const imageData = ctx.createImageData(img.width, img.height);
        // Convert image data to RGBA
        if (img.data.length === img.width * img.height * 4) {
          imageData.data.set(img.data);
        } else if (img.data.length === img.width * img.height * 3) {
          // RGB → RGBA
          for (let i = 0; i < img.width * img.height; i++) {
            imageData.data[i * 4] = img.data[i * 3];
            imageData.data[i * 4 + 1] = img.data[i * 3 + 1];
            imageData.data[i * 4 + 2] = img.data[i * 3 + 2];
            imageData.data[i * 4 + 3] = 255;
          }
        } else {
          return null;
        }
        ctx.putImageData(imageData, 0, 0);
        return {
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height,
        };
      }
    } else if (fn === opsMap.paintImageXObject) {
      // XObject image - need to get from page.objs
      const imgName = (args as unknown[])[0] as string;
      return new Promise((resolve) => {
        page.objs.get(imgName, (img: PdfImage) => {
          if (img && img.width && img.height && img.data) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            const imageData = ctx.createImageData(img.width, img.height);
            if (img.data.length === img.width * img.height * 4) {
              imageData.data.set(img.data);
            } else if (img.data.length === img.width * img.height * 3) {
              for (let i = 0; i < img.width * img.height; i++) {
                imageData.data[i * 4] = img.data[i * 3];
                imageData.data[i * 4 + 1] = img.data[i * 3 + 1];
                imageData.data[i * 4 + 2] = img.data[i * 3 + 2];
                imageData.data[i * 4 + 3] = 255;
              }
            } else {
              return resolve(null);
            }
            ctx.putImageData(imageData, 0, 0);
            resolve({
              dataUrl: canvas.toDataURL('image/png'),
              width: img.width,
              height: img.height,
            });
          } else {
            resolve(null);
          }
        });
      });
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Thiele-Small parameter parsing
// ---------------------------------------------------------------------------

/**
 * Parse Thiele-Small parameters from extracted PDF text.
 * Uses regex patterns to match common datasheet formats.
 *
 * Handles various formats:
 * - "Fs: 35 Hz" / "Fs = 35 Hz" / "Fs(Hz): 35" / "Fs 35"
 * - "Resonance Frequency: 35 Hz"
 * - Tables with tab-separated values
 */
export function parseTsParams(text: string): Partial<ThieleSmallParams> {
  const params: Partial<ThieleSmallParams> = {};
  const normalizedText = text.replace(/\s+/g, ' ');

  // T/S parameter patterns - order matters (most specific first)
  const patterns: { key: keyof ThieleSmallParams; regex: RegExp }[] = [
    // Fs - resonance frequency
    { key: 'fs', regex: /(?:Fs|f[sS]|Resonance\s*(?:Frequency|Freq\.?))\s*[:=]?\s*(\d+\.?\d*)\s*Hz/i },
    // Re - DC resistance
    { key: 're', regex: /(?:Re|R[eE]|D\.?C\.?\s*Resistance)\s*[:=]?\s*(\d+\.?\d*)\s*[ΩOhm]/i },
    // Qms - mechanical Q
    { key: 'qms', regex: /Qms\s*[:=]?\s*(\d+\.?\d*)/i },
    // Qes - electrical Q
    { key: 'qes', regex: /Qes\s*[:=]?\s*(\d+\.?\d*)/i },
    // Qts - total Q
    { key: 'qts', regex: /Qts\s*[:=]?\s*(\d+\.?\d*)/i },
    // Vas - equivalent volume
    { key: 'vas', regex: /Vas\s*[:=]?\s*(\d+\.?\d*)\s*(?:L|lit(?:er|re)s?)/i },
    // Sensitivity
    { key: 'sensitivity', regex: /Sens(?:itivity)?\s*[:=]?\s*(\d+\.?\d*)\s*dB/i },
    // Xmax
    { key: 'xmax', regex: /Xmax\s*[:=]?\s*(\d+\.?\d*)\s*mm/i },
    // Sd - piston area
    { key: 'sd', regex: /Sd\s*[:=]?\s*(\d+\.?\d*)\s*cm²/i },
    // Le - inductance
    { key: 'le', regex: /Le?\s*[:=]?\s*(\d+\.?\d*)\s*mH/i },
    // Pe - power handling
    { key: 'pe', regex: /(?:Pe|Power)\s*[:=]?\s*(\d+\.?\d*)\s*W/i },
    // Impedance
    { key: 'imp', regex: /(?:Imp(?:edance)?|Nominal\s*Imp(?:edance)?)\s*[:=]?\s*(\d+\.?\d*)\s*[ΩOhm]/i },
    // BL
    { key: 'bl', regex: /BL?\s*[:=]?\s*(\d+\.?\d*)\s*N\/A/i },
    // Mms
    { key: 'mms', regex: /Mms?\s*[:=]?\s*(\d+\.?\d*)\s*g/i },
    // Cms
    { key: 'cms', regex: /Cms?\s*[:=]?\s*(\d+\.?\d*)\s*mm\/N/i },
  ];

  for (const { key, regex } of patterns) {
    const match = normalizedText.match(regex);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        (params as Record<string, number>)[key] = value;
      }
    }
  }

  // Derive Qts if missing but Qms and Qes are present
  if (params.qms && params.qes && !params.qts) {
    params.qts = (params.qms * params.qes) / (params.qms + params.qes);
  }

  // Derive Sd in m²
  if (params.sd) {
    params.sdM2 = params.sd / 10000; // cm² → m²
  }

  // Derive Vd
  if (params.sd && params.xmax) {
    params.vd = params.sd * params.xmax; // cm³
  }

  return params;
}

// ---------------------------------------------------------------------------
// Graph digitization (manual point-click on graph images)
// ---------------------------------------------------------------------------

export interface DigitizedPoint {
  x: number; // pixel x
  y: number; // pixel y
}

export interface GraphAxis {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLog: boolean; // log scale for x (frequency)
  yLog: boolean;
  xPixelMin: number; // pixel coords of axis bounds
  xPixelMax: number;
  yPixelMin: number;
  yPixelMax: number;
}

/**
 * Convert pixel coordinates to data coordinates using axis calibration.
 */
export function pixelToData(
  pixel: DigitizedPoint,
  axis: GraphAxis
): { freq: number; magnitude: number } {
  // X axis (frequency, usually log scale)
  const xFrac = (pixel.x - axis.xPixelMin) / (axis.xPixelMax - axis.xPixelMin);
  let freq: number;
  if (axis.xLog) {
    freq = axis.xMin * Math.pow(axis.xMax / axis.xMin, xFrac);
  } else {
    freq = axis.xMin + (axis.xMax - axis.xMin) * xFrac;
  }

  // Y axis (magnitude, usually linear in dB or ohms)
  const yFrac = 1 - (pixel.y - axis.yPixelMin) / (axis.yPixelMax - axis.yPixelMin);
  let magnitude: number;
  if (axis.yLog) {
    magnitude = axis.yMin * Math.pow(axis.yMax / axis.yMin, yFrac);
  } else {
    magnitude = axis.yMin + (axis.yMax - axis.yMin) * yFrac;
  }

  return { freq, magnitude };
}

/**
 * Convert a set of digitized points to frequency response data.
 */
export function digitizeToFrequencyResponse(
  points: DigitizedPoint[],
  axis: GraphAxis
): FrequencyDataPoint[] {
  return points
    .map((p) => {
      const { freq, magnitude } = pixelToData(p, axis);
      return { freq, magnitude };
    })
    .filter((p) => p.freq > 0 && !isNaN(p.magnitude))
    .sort((a, b) => a.freq - b.freq);
}

/**
 * Convert digitized points to impedance data.
 */
export function digitizeToImpedance(
  points: DigitizedPoint[],
  axis: GraphAxis
): ImpedanceDataPoint[] {
  return points
    .map((p) => {
      const { freq, magnitude: mag } = pixelToData(p, axis);
      return { freq, magnitude: mag };
    })
    .filter((p) => p.freq > 0 && !isNaN(p.magnitude))
    .sort((a, b) => a.freq - b.freq);
}
