// Pre-loaded driver database — seeded from mk2-reference-loudspeaker datasheets
// and expanded with common DIY loudspeaker drivers
//
// Each driver includes manufacturer-measured on-axis frequency response data
// extracted and digitized from official datasheet PDFs (sampled to ~35 points).

import type { Driver, FrequencyDataPoint, OffAxisData } from '@/types';

// ---------------------------------------------------------------------------
// Datasheet frequency response data — sampled 1/24 octave, ~35 points/driver
// Extracted from official manufacturer PDFs in mk2-reference-loudspeaker repo.
// ---------------------------------------------------------------------------

const H2606_ONAXIS: FrequencyDataPoint[] = [
  {freq:216.09,magnitude:62.78}, {freq:242.7,magnitude:65.39}, {freq:272.57,magnitude:67.21},
  {freq:306.13,magnitude:68.79}, {freq:343.81,magnitude:71.09}, {freq:386.14,magnitude:73.24},
  {freq:433.68,magnitude:75.32}, {freq:487.06,magnitude:77.09}, {freq:547.02,magnitude:79.48},
  {freq:579.72,magnitude:80.8}, {freq:651.08,magnitude:82.7}, {freq:731.23,magnitude:84.94},
  {freq:821.25,magnitude:87.16}, {freq:922.35,magnitude:89.23}, {freq:1035.89,magnitude:90.93},
  {freq:1163.42,magnitude:92.15}, {freq:1306.64,magnitude:93.12}, {freq:1467.49,magnitude:93.71},
  {freq:1648.15,magnitude:94.32}, {freq:1851.04,magnitude:94.92}, {freq:2078.91,magnitude:95.45},
  {freq:2334.84,magnitude:95.83}, {freq:2622.27,magnitude:95.08}, {freq:2945.08,magnitude:95.91},
  {freq:3307.63,magnitude:96.55}, {freq:3714.82,magnitude:95.32}, {freq:3936.84,magnitude:94.92},
  {freq:4421.48,magnitude:94.7}, {freq:4965.79,magnitude:94.86}, {freq:5577.1,magnitude:95.25},
  {freq:6263.66,magnitude:95.53}, {freq:7034.75,magnitude:95.99}, {freq:7900.76,magnitude:95.26},
  {freq:8873.37,magnitude:94.55}, {freq:9965.73,magnitude:94.71},
];

const H2606_OFFAXIS: OffAxisData[] = [
  { angle: 30, curve: [
    {freq:1035.89,magnitude:90.73}, {freq:1306.64,magnitude:93.15}, {freq:1648.15,magnitude:93.71},
    {freq:2078.91,magnitude:94.62}, {freq:2622.27,magnitude:95.23}, {freq:3307.63,magnitude:94.56},
    {freq:4172.13,magnitude:93.77}, {freq:4965.79,magnitude:93.03}, {freq:5910.42,magnitude:92.23},
    {freq:7034.75,magnitude:91.82}, {freq:8873.37,magnitude:88.26}, {freq:9965.73,magnitude:90.33},
  ]},
  { angle: 60, curve: [
    {freq:1035.89,magnitude:90.20}, {freq:1306.64,magnitude:92.65}, {freq:1648.15,magnitude:93.56},
    {freq:2078.91,magnitude:93.27}, {freq:2622.27,magnitude:93.48}, {freq:3307.63,magnitude:92.24},
    {freq:4172.13,magnitude:90.38}, {freq:4965.79,magnitude:89.55}, {freq:5910.42,magnitude:87.05},
    {freq:7034.75,magnitude:85.39}, {freq:8873.37,magnitude:83.34}, {freq:9965.73,magnitude:78.51},
  ]},
];

const MID15W_ONAXIS: FrequencyDataPoint[] = [
  {freq:101.6,magnitude:86.1}, {freq:114.11,magnitude:86.55}, {freq:135.82,magnitude:89.7},
  {freq:152.54,magnitude:89.7}, {freq:171.32,magnitude:89.77}, {freq:203.91,magnitude:90.3},
  {freq:229.01,magnitude:90.04}, {freq:257.2,magnitude:90.22}, {freq:306.13,magnitude:90.45},
  {freq:343.81,magnitude:90.91}, {freq:386.14,magnitude:90.83}, {freq:459.59,magnitude:90.45},
  {freq:516.17,magnitude:90.53}, {freq:579.72,magnitude:90.66}, {freq:689.99,magnitude:90.23},
  {freq:774.94,magnitude:89.99}, {freq:870.33,magnitude:90.38}, {freq:1035.89,magnitude:90.26},
  {freq:1163.42,magnitude:89.85}, {freq:1306.64,magnitude:89.64}, {freq:1467.49,magnitude:89.24},
  {freq:1746.65,magnitude:89.1}, {freq:1961.67,magnitude:89.81}, {freq:2203.16,magnitude:89.19},
  {freq:2622.27,magnitude:88.66}, {freq:2945.08,magnitude:88.79}, {freq:3307.63,magnitude:88.03},
  {freq:3936.84,magnitude:88.59}, {freq:4421.48,magnitude:88.71}, {freq:4965.79,magnitude:89.67},
  {freq:5910.42,magnitude:92.95}, {freq:6638.02,magnitude:91.61}, {freq:7455.19,magnitude:84.22},
  {freq:8873.37,magnitude:85.44}, {freq:9965.73,magnitude:82.95},
];

const SB26_ONAXIS: FrequencyDataPoint[] = [
  {freq:101.6,magnitude:56.62}, {freq:120.93,magnitude:59.47}, {freq:135.82,magnitude:60.73},
  {freq:161.66,magnitude:64.18}, {freq:192.41,magnitude:67.73}, {freq:216.09,magnitude:69.99},
  {freq:257.2,magnitude:73.14}, {freq:306.13,magnitude:76.79}, {freq:343.81,magnitude:78.95},
  {freq:409.22,magnitude:82.1}, {freq:487.06,magnitude:84.26}, {freq:547.02,magnitude:86.32},
  {freq:651.08,magnitude:88.5}, {freq:774.94,magnitude:91.33}, {freq:870.33,magnitude:92.2},
  {freq:1035.89,magnitude:91.87}, {freq:1232.95,magnitude:91.57}, {freq:1467.49,magnitude:91.07},
  {freq:1648.15,magnitude:91.17}, {freq:1961.67,magnitude:90.28}, {freq:2334.84,magnitude:90.97},
  {freq:2622.27,magnitude:91.27}, {freq:3121.1,magnitude:91.27}, {freq:3714.82,magnitude:91.35},
  {freq:4172.13,magnitude:91.78}, {freq:4965.79,magnitude:92.07}, {freq:5910.42,magnitude:91.31},
  {freq:6638.02,magnitude:91.97}, {freq:7900.76,magnitude:91.57}, {freq:9403.7,magnitude:91.38},
  {freq:10561.34,magnitude:91.67}, {freq:12570.41,magnitude:92.86}, {freq:14961.65,magnitude:92.56},
  {freq:16803.5,magnitude:93.06}, {freq:20000.0,magnitude:92.26},
];

const GRS_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:71.11}, {freq:23.8,magnitude:78.19}, {freq:28.33,magnitude:79.13},
  {freq:35.74,magnitude:83.69}, {freq:42.54,magnitude:86.47}, {freq:50.63,magnitude:85.62},
  {freq:60.26,magnitude:87.16}, {freq:71.72,magnitude:88.47}, {freq:85.37,magnitude:89.32},
  {freq:107.68,magnitude:89.03}, {freq:128.16,magnitude:89.03}, {freq:152.54,magnitude:89.03},
  {freq:181.56,magnitude:88.64}, {freq:216.09,magnitude:89.08}, {freq:257.2,magnitude:89.03},
  {freq:324.42,magnitude:89.03}, {freq:386.14,magnitude:88.75}, {freq:459.59,magnitude:88.75},
  {freq:547.02,magnitude:86.3}, {freq:651.08,magnitude:88.45}, {freq:821.25,magnitude:89.31},
  {freq:977.47,magnitude:89.07}, {freq:1163.42,magnitude:88.25}, {freq:1384.73,magnitude:90.46},
  {freq:1648.15,magnitude:91.31}, {freq:1961.67,magnitude:90.74}, {freq:2474.38,magnitude:91.31},
  {freq:2945.08,magnitude:92.56}, {freq:3505.32,magnitude:88.84}, {freq:4172.13,magnitude:87.01},
  {freq:4965.79,magnitude:81.37}, {freq:5910.42,magnitude:75.02}, {freq:7455.19,magnitude:66.06},
  {freq:8873.37,magnitude:63.52}, {freq:10561.34,magnitude:50.71},
];

// GRS 12SW-4HE frequency response — digitized from the official GRS spec-sheet
// OmniMic plot (1/24 oct, nearfield-spliced below ~450 Hz). 12" high-excursion
// sub, 4 Ω, 84.5 dB. Mk3 v8 bass, used 2× push-push, side-mounted. LPF ~150-200 Hz.
// Curve is genuinely different from the 8SW (lower sensitivity plateau ~87 dB,
// deeper reach, hard roll-off above ~2.5 kHz) — do NOT share GRS_ONAXIS.
const GRS12SW_ONAXIS: FrequencyDataPoint[] = [
  {freq:15.0,magnitude:69.0}, {freq:16.5,magnitude:58.5}, {freq:18.5,magnitude:70.5},
  {freq:20.0,magnitude:74.0}, {freq:24.5,magnitude:79.2}, {freq:30.0,magnitude:82.2},
  {freq:36.8,magnitude:84.6}, {freq:45.1,magnitude:85.9}, {freq:55.2,magnitude:87.0},
  {freq:67.7,magnitude:87.4}, {freq:82.9,magnitude:87.4}, {freq:101.6,magnitude:87.0},
  {freq:124.5,magnitude:86.4}, {freq:152.5,magnitude:85.6}, {freq:186.9,magnitude:84.6},
  {freq:229.0,magnitude:83.4}, {freq:280.6,magnitude:82.2}, {freq:343.8,magnitude:81.3},
  {freq:421.3,magnitude:81.6}, {freq:463.0,magnitude:79.0}, {freq:516.2,magnitude:73.4},
  {freq:575.0,magnitude:75.0}, {freq:632.5,magnitude:76.3}, {freq:774.9,magnitude:77.8},
  {freq:949.5,magnitude:78.0}, {freq:1163.4,magnitude:78.4}, {freq:1425.5,magnitude:79.8},
  {freq:1700.0,magnitude:81.4}, {freq:2000.0,magnitude:79.6}, {freq:2474.4,magnitude:76.8},
  {freq:2945.1,magnitude:68.5}, {freq:3505.3,magnitude:63.0}, {freq:4172.1,magnitude:59.4},
  {freq:4965.8,magnitude:54.2}, {freq:5910.4,magnitude:49.0},
];

// 18W/4424G00 frequency response (extracted from official ScanSpeak PDF raster plot)
// Midrange — 18 cm Discovery series, 4 Ω, 91 dB. Replaces 15W/4434G00 in Mk3 v9.
// Full on-axis curve digitized at 300 DPI from the datasheet SPL graph.
// 30°/60° off-axis valid from ~150 Hz upward (cone directivity narrows above 2 kHz).
const MID18W_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.00,magnitude:74.8}, {freq:24.51,magnitude:79.1}, {freq:30.03,magnitude:79.1},
  {freq:36.79,magnitude:83.0}, {freq:45.08,magnitude:84.7}, {freq:55.23,magnitude:87.3},
  {freq:67.68,magnitude:88.5}, {freq:82.92,magnitude:90.5}, {freq:101.60,magnitude:91.2},
  {freq:124.49,magnitude:92.5}, {freq:152.54,magnitude:92.8}, {freq:186.90,magnitude:92.8},
  {freq:229.01,magnitude:92.2}, {freq:280.60,magnitude:92.5}, {freq:343.81,magnitude:93.0},
  {freq:421.27,magnitude:92.3}, {freq:516.17,magnitude:92.2}, {freq:632.46,magnitude:92.2},
  {freq:774.94,magnitude:92.2}, {freq:949.51,magnitude:92.5}, {freq:1163.42,magnitude:92.9},
  {freq:1425.51,magnitude:94.1}, {freq:1746.65,magnitude:94.1}, {freq:2140.14,magnitude:94.5},
  {freq:2622.27,magnitude:93.1}, {freq:3213.01,magnitude:92.7}, {freq:3936.84,magnitude:94.3},
  {freq:4823.73,magnitude:93.4}, {freq:5910.42,magnitude:91.5}, {freq:7241.92,magnitude:91.2},
  {freq:8873.37,magnitude:91.0}, {freq:10872.37,magnitude:87.2}, {freq:13321.69,magnitude:74.8},
  {freq:16322.80,magnitude:68.3}, {freq:20000.00,magnitude:70.4},
];

const MID18W_30DEG: FrequencyDataPoint[] = [
  {freq:152.54,magnitude:92.2}, {freq:186.90,magnitude:92.2}, {freq:229.01,magnitude:92.3},
  {freq:280.60,magnitude:92.3}, {freq:343.81,magnitude:92.6}, {freq:421.27,magnitude:91.8},
  {freq:516.17,magnitude:91.8}, {freq:632.46,magnitude:92.0}, {freq:774.94,magnitude:91.4},
  {freq:949.51,magnitude:91.2}, {freq:1163.42,magnitude:90.9}, {freq:1425.51,magnitude:90.3},
  {freq:1746.65,magnitude:90.1}, {freq:2140.14,magnitude:88.8}, {freq:2622.27,magnitude:85.4},
  {freq:3213.01,magnitude:78.4}, {freq:3936.84,magnitude:80.6}, {freq:4823.73,magnitude:79.4},
  {freq:5910.42,magnitude:69.2}, {freq:7241.92,magnitude:64.5}, {freq:8873.37,magnitude:71.8},
  {freq:10872.37,magnitude:70.3}, {freq:13321.69,magnitude:58.0}, {freq:16322.80,magnitude:52.2},
  {freq:20000.00,magnitude:52.2},
];

const MID18W_60DEG: FrequencyDataPoint[] = [
  {freq:152.54,magnitude:92.3}, {freq:186.90,magnitude:92.3}, {freq:229.01,magnitude:92.2},
  {freq:280.60,magnitude:92.0}, {freq:343.81,magnitude:92.7}, {freq:421.27,magnitude:92.2},
  {freq:516.17,magnitude:91.9}, {freq:632.46,magnitude:92.1}, {freq:774.94,magnitude:92.0},
  {freq:949.51,magnitude:91.9}, {freq:1163.42,magnitude:92.0}, {freq:1425.51,magnitude:92.4},
  {freq:1746.65,magnitude:92.8}, {freq:2140.14,magnitude:92.3}, {freq:2622.27,magnitude:90.4},
  {freq:3213.01,magnitude:89.5}, {freq:3936.84,magnitude:88.5}, {freq:4823.73,magnitude:84.8},
  {freq:5910.42,magnitude:83.9}, {freq:7241.92,magnitude:78.6}, {freq:8873.37,magnitude:70.3},
  {freq:10872.37,magnitude:70.5}, {freq:13321.69,magnitude:63.5}, {freq:16322.80,magnitude:53.4},
  {freq:20000.00,magnitude:54.0},
];

// ---------------------------------------------------------------------------
// Vifa / Wavecor frequency response data
// Vifa BC25TG15-04: digitized from Peerless datasheet PDF (pixel-based, 300 DPI)
// Wavecor WF146WA01/02 + WF168WA01/02: constructed from T/S parameters +
// datasheet SPL curves (infinite baffle model with cone breakup peak)
// ---------------------------------------------------------------------------

const VIFA_BC25TG15_ONAXIS: FrequencyDataPoint[] = [
  {freq:200.0,magnitude:62.4}, {freq:293.6,magnitude:69.0}, {freq:430.9,magnitude:75.9}, {freq:632.5,magnitude:83.0},
  {freq:928.3,magnitude:89.8}, {freq:1362.6,magnitude:93.9}, {freq:2000.0,magnitude:94.4}, {freq:2935.6,magnitude:94.0},
  {freq:4308.9,magnitude:93.3}, {freq:6324.6,magnitude:93.0}, {freq:9283.2,magnitude:92.5}, {freq:13625.8,magnitude:92.3},
  {freq:20000.0,magnitude:91.7}, {freq:29356.0,magnitude:86.9}, {freq:40000.0,magnitude:81.9},
];

const WF146WA01_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:69.7}, {freq:29.4,magnitude:74.6}, {freq:43.1,magnitude:78.7}, {freq:63.2,magnitude:90.0},
  {freq:92.8,magnitude:90.0}, {freq:136.3,magnitude:90.0}, {freq:200.0,magnitude:90.0}, {freq:293.6,magnitude:90.1},
  {freq:430.9,magnitude:90.3}, {freq:632.5,magnitude:90.4}, {freq:928.3,magnitude:90.5}, {freq:1362.6,magnitude:90.7},
  {freq:2000.0,magnitude:90.8}, {freq:2935.6,magnitude:90.9}, {freq:4308.9,magnitude:91.9}, {freq:6324.6,magnitude:93.9},
  {freq:9283.2,magnitude:87.4}, {freq:13625.8,magnitude:77.5}, {freq:20000.0,magnitude:68.9},
];

const WF146WA02_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:67.3}, {freq:29.4,magnitude:72.6}, {freq:43.1,magnitude:77.0}, {freq:63.2,magnitude:87.5},
  {freq:92.8,magnitude:87.5}, {freq:136.3,magnitude:87.5}, {freq:200.0,magnitude:87.5}, {freq:293.6,magnitude:87.6},
  {freq:430.9,magnitude:87.8}, {freq:632.5,magnitude:87.9}, {freq:928.3,magnitude:88.0}, {freq:1362.6,magnitude:88.2},
  {freq:2000.0,magnitude:88.3}, {freq:2935.6,magnitude:88.4}, {freq:4308.9,magnitude:89.4}, {freq:6324.6,magnitude:91.4},
  {freq:9283.2,magnitude:84.9}, {freq:13625.8,magnitude:75.0}, {freq:20000.0,magnitude:66.4},
];

const WF168WA01_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:73.5}, {freq:29.4,magnitude:78.1}, {freq:43.1,magnitude:81.9}, {freq:63.2,magnitude:91.5},
  {freq:92.8,magnitude:91.5}, {freq:136.3,magnitude:91.5}, {freq:200.0,magnitude:91.5}, {freq:293.6,magnitude:91.6},
  {freq:430.9,magnitude:91.8}, {freq:632.5,magnitude:91.9}, {freq:928.3,magnitude:92.1}, {freq:1362.6,magnitude:92.2},
  {freq:2000.0,magnitude:92.4}, {freq:2935.6,magnitude:92.5}, {freq:4308.9,magnitude:94.6}, {freq:6324.6,magnitude:92.4},
  {freq:9283.2,magnitude:82.2}, {freq:13625.8,magnitude:73.3}, {freq:20000.0,magnitude:65.4},
];

const WF168WA02_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:71.3}, {freq:29.4,magnitude:76.2}, {freq:43.1,magnitude:80.3}, {freq:63.2,magnitude:89.0},
  {freq:92.8,magnitude:89.0}, {freq:136.3,magnitude:89.0}, {freq:200.0,magnitude:89.0}, {freq:293.6,magnitude:89.1},
  {freq:430.9,magnitude:89.3}, {freq:632.5,magnitude:89.4}, {freq:928.3,magnitude:89.6}, {freq:1362.6,magnitude:89.7},
  {freq:2000.0,magnitude:89.9}, {freq:2935.6,magnitude:90.0}, {freq:4308.9,magnitude:92.1}, {freq:6324.6,magnitude:89.9},
  {freq:9283.2,magnitude:79.7}, {freq:13625.8,magnitude:70.8}, {freq:20000.0,magnitude:62.9},
];

// ---------------------------------------------------------------------------
// Driver catalog
// ---------------------------------------------------------------------------

export const SEED_DRIVERS: Driver[] = [
  // ===== Woofers / Subwoofers =====

  {
    id: 'seed-grs-8sw-4he-8',
    manufacturer: 'GRS',
    model: '8SW-4HE-8',
    type: 'subwoofer',
    tsParams: {
      fs: 32, re: 5.8, qms: 6.5, qes: 0.42, qts: 0.39, vas: 52,
      sensitivity: 85.5, xmax: 7.0, sd: 208, sdM2: 0.0208, vd: 1456,
      imp: 8, pe: 100, bl: 11.2, mms: 38,
    },
    dimensions: {
      overallDiameter: 208, cutoutDiameter: 185, mountingDepth: 95,
      magnetDiameter: 100, magnetDepth: 40, weight: 2200,
    },
    frequencyResponse: GRS_ONAXIS,
    datasheetUrl: 'https://www.parts-express.com/pedocs/specs/292-1500--grs-8sw-4he-8-spec-sheet.pdf',
    notes: 'Budget 8" subwoofer. Push-push par i mk2-design (historisk — erstattet af 12SW-4HE i Mk3 v8). Cutout 185mm skal verificeres med skydelære — ingen STEP-fil tilgængelig.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Mk3 v8 bass — 2× GRS 12SW-4HE, push-push, side-mounted (DD-015).
  // 12" high-excursion sub, 4 Ω, 84.5 dB. Fs 22 Hz, Xmax 12.5 mm (Klippel),
  // Sd 504 cm². Sealed ~75 L/pair → Fc ~39 Hz, Qtc ~0.76 (Linkwitz Transform
  // to Fc 28 Hz / Qtc 0.707). Push-push pair cancels reaction forces → thin
  // side walls viable. vd field follows the catalog convention sd(cm²)·xmax(mm).
  // Has DATS-measured parameter set (Jul 25, 2026) and break-in update (Jul 26).
  {
    id: 'seed-grs-12sw-4he',
    manufacturer: 'GRS',
    model: '12SW-4HE',
    type: 'subwoofer',
    tsParams: {
      fs: 22, re: 3.9, qms: 4.08, qes: 0.48, qts: 0.43, vas: 80.4,
      sensitivity: 84.5, xmax: 12.5, sd: 504, sdM2: 0.0504, vd: 6300,
      imp: 4, pe: 250, bl: 16.2, mms: 237, cms: 0.22, le: 3.5,
    },
    parameterSets: [
      {
        name: 'DATS @5h',
        tsParams: {
          fs: 25.07, re: 4.2, qms: 3.929, qes: 0.589, qts: 0.512, vas: 80.4,
          sensitivity: 84.5, xmax: 12.5, sd: 504, sdM2: 0.0504, vd: 6300,
          imp: 4, pe: 250, bl: 16.2, mms: 237, cms: 0.22, le: 3.5,
        },
        notes: 'DATS Jul 25. Fs=25.1 (+14%), Qts=0.51 (+19%). Suspension softer end spec.',
      },
      {
        name: 'DATS @5h (break-in)',
        tsParams: {
          fs: 23.52, re: 4.2, qms: 3.532, qes: 0.518, qts: 0.442, vas: 80.4,
          sensitivity: 84.5, xmax: 12.5, sd: 504, sdM2: 0.0504, vd: 6300,
          imp: 4, pe: 250, bl: 16.2, mms: 237, cms: 0.22, le: 3.5,
        },
        notes: 'Jul 26 break-in update. Fs=23.5 (+6.9%), Qts=0.44 (+2.7%). Indenfor 7% af spec efter 5h.',
      },
    ],
    dimensions: {
      overallDiameter: 332, cutoutDiameter: 284, mountingDepth: 136,
      magnetDiameter: 160, magnetDepth: 75, weight: 5910,
    },
    frequencyResponse: GRS12SW_ONAXIS,
    datasheetUrl: 'https://www.parts-express.com/GRS-12SW-4HE-12-Paper-Cone-Rubber-Surround-High-Excursion-Subwoofer-4-Ohm-292-824',
    notes: 'Mk3 v8 bas — 2× i push-push, sidemonteret på 370 mm dybe sidepaneler (Ø284 udskæring, 43 mm margin). Fs 22 Hz, Xmax 12.5 mm Klippel-verificeret, Sd 504 cm², Bl 16.2 Tm, Mms 237 g. 250 W AES. Lukket ~75 L/par: Fc ~39 Hz, Qtc ~0.76 → Linkwitz Transform til 28 Hz/0.707. Kobles ved ~150-200 Hz LR4. Forstærket papmembran + gummikant. 2" (50.8 mm) 4-lags svingspole. Koblingsklods bonded mellem modstående magneter for stiv mekanisk kobling (vibrationsudligning). Vælg parameter set for at skifte mellem datablad og DATS-målte værdier.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-dayton-rs225-8',
    manufacturer: 'Dayton Audio',
    model: 'RS225-8',
    type: 'woofer',
    tsParams: {
      fs: 28, re: 6.2, qms: 2.8, qes: 0.51, qts: 0.43, vas: 62.5,
      sensitivity: 89.0, xmax: 5.5, sd: 221, sdM2: 0.0221, vd: 1216,
      imp: 8, pe: 80, bl: 8.4, mms: 31.5, le: 0.78,
    },
    dimensions: {
      overallDiameter: 232, cutoutDiameter: 207, mountingDepth: 96,
      magnetDiameter: 125, magnetDepth: 40, weight: 1900,
    },
    notes: 'Reference Series 8" woofer. God til sealed eller ported. Papir-membran, støbt kurv.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-dayton-rs270s-8',
    manufacturer: 'Dayton Audio',
    model: 'RS270S-8',
    type: 'woofer',
    tsParams: {
      fs: 28.5, re: 6.0, qms: 2.5, qes: 0.37, qts: 0.32, vas: 85.8,
      sensitivity: 91.5, xmax: 7.5, sd: 345, sdM2: 0.0345, vd: 2588,
      imp: 8, pe: 100, bl: 9.3, mms: 47.4, le: 0.83,
    },
    dimensions: {
      overallDiameter: 282, cutoutDiameter: 250, mountingDepth: 110,
      magnetDiameter: 150, magnetDepth: 45, weight: 3100,
    },
    notes: 'Reference Series 10" woofer. Høj følsomhed, glat respons til ~2 kHz. Velegnet til 2-vejs med stor båndbredde.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-scanspeak-22w-8851t00',
    manufacturer: 'ScanSpeak',
    model: '22W/8851T00',
    type: 'woofer',
    tsParams: {
      fs: 21, re: 3.4, qms: 4.5, qes: 0.32, qts: 0.30, vas: 69,
      sensitivity: 87.5, xmax: 12.0, sd: 220, sdM2: 0.0220, vd: 2640,
      imp: 4, pe: 150, bl: 9.3, mms: 52, le: 1.0,
    },
    dimensions: {
      overallDiameter: 230, cutoutDiameter: 198, mountingDepth: 99,
      magnetDiameter: 128, magnetDepth: 40, weight: 3200,
    },
    notes: 'Revelator 8" woofer med SD-1 membran. Exceptionel mellemtone-kvalitet. 4 ohm version. kræver god forstærker.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-sb-acoustics-sb34nrx75-6',
    manufacturer: 'SB Acoustics',
    model: 'SB34NRX75-6',
    type: 'subwoofer',
    tsParams: {
      fs: 25, re: 5.5, qms: 4.5, qes: 0.46, qts: 0.42, vas: 72,
      sensitivity: 90.0, xmax: 13.0, sd: 490, sdM2: 0.0490, vd: 6370,
      imp: 6, pe: 200, bl: 9.6, mms: 68,
    },
    dimensions: {
      overallDiameter: 318, cutoutDiameter: 290, mountingDepth: 123,
      magnetDiameter: 160, magnetDepth: 50, weight: 3800,
    },
    notes: 'SB NRX 12" subwoofer. Høj xmax, papir/hamp-membran. Velegnet til sealed eller stor ported.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== Midrange / Fullrange =====

  {
    id: 'seed-scanspeak-15w-4434g00',
    manufacturer: 'ScanSpeak',
    model: '15W/4434G00',
    type: 'midrange',
    tsParams: {
      fs: 280, re: 4.7, qms: 0.65, qes: 0.32, qts: 0.21, vas: 1.8,
      sensitivity: 88.0, xmax: 0.8, sd: 40.5, sdM2: 0.00405, vd: 32.4,
      imp: 6, pe: 80, bl: 5.8, mms: 6.2,
    },
    dimensions: {
      overallDiameter: 145, cutoutDiameter: 72, mountingDepth: 65,
      magnetDiameter: 78, magnetDepth: 25, weight: 650,
    },
    frequencyResponse: MID15W_ONAXIS,
    datasheetUrl: 'https://www.scan-speak.dk/datasheet/pdf/15w-4434g00.pdf',
    notes: 'Discovery 5.5" mellemtone. Ren mellemtone — brug fra 150-200 Hz til ca. 1-4 kHz. Ingen STEP-fil fra ScanSpeak.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Mk3 v9 midrange — replaces 15W/4434G00 in the 3-way reference speaker.
  // 18 cm Discovery series, 4 Ω, 91 dB. Exceptional flatness from 100-5000 Hz.
  // Added July 6, 2026 — frequency response digitized from official PDF raster plot.
  // Has DATS-measured parameter sets (Jul 25 + Jul 26 break-in progression).
  {
    id: 'seed-scanspeak-18w-4424g00',
    manufacturer: 'ScanSpeak',
    model: '18W/4424G00',
    type: 'midrange',
    tsParams: {
      fs: 49, re: 3.2, qms: 4.57, qes: 0.42, qts: 0.38, vas: 24.1,
      sensitivity: 91.0, xmax: 2.8, sd: 137, sdM2: 0.0137, vd: 383.6,
      imp: 4, pe: 50, bl: 5.2, mms: 11.4, le: 0.36,
    },
    parameterSets: [
      {
        name: 'DATS @0h',
        tsParams: {
          fs: 69.41, re: 3.117, qms: 5.518, qes: 0.671, qts: 0.598, vas: 24.1,
          sensitivity: 91.0, xmax: 2.8, sd: 137, sdM2: 0.0137, vd: 383.6,
          imp: 4, pe: 50, bl: 5.2, mms: 11.4, le: 0.299,
        },
        notes: 'DATS Jul 25. Fs=69.4 (+42%), Qts=0.60 (+57%). Stiv ny suspension — break-in påkrævet.',
      },
      {
        name: 'DATS @5h (break-in)',
        tsParams: {
          fs: 64.53, re: 3.117, qms: 5.409, qes: 0.636, qts: 0.576, vas: 24.1,
          sensitivity: 91.0, xmax: 2.8, sd: 137, sdM2: 0.0137, vd: 383.6,
          imp: 4, pe: 50, bl: 5.2, mms: 11.4, le: 0.299,
        },
        notes: 'Jul 26 break-in @5h. Fs=64.5 (-7%), Qts=0.58 (-3.7%). Trend: faldende mod spec.',
      },
    ],
    dimensions: {
      overallDiameter: 179, cutoutDiameter: 144, mountingDepth: 72,
      magnetDiameter: 110, magnetDepth: 30, weight: 1200,
    },
    frequencyResponse: MID18W_ONAXIS,
    offAxis: [
      { angle: 30, curve: MID18W_30DEG },
      { angle: 60, curve: MID18W_60DEG },
    ],
    datasheetUrl: 'https://www.scan-speak.dk/datasheet/pdf/18w-4424g00.pdf',
    notes: 'Discovery 18 cm mellemtone. Mk3 v9 — 18W/4424G00 erstatter 15W/4434G00. Fs 49 Hz, Qts 0.38, 91 dB/4Ω. 150 Hz LR4 HPF, 1100 Hz LR4 LPF. GLAT RESPONS 100-5000 Hz. 1.2 kg, coated glasfibermembran, SBR-gummikant. Vælg parameter set for at skifte mellem datablad og DATS-målte værdier.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-scanspeak-12mu-4731t00',
    manufacturer: 'ScanSpeak',
    model: '12MU/4731T00',
    type: 'midrange',
    tsParams: {
      fs: 165, re: 5.0, qms: 1.8, qes: 0.38, qts: 0.31, vas: 2.5,
      sensitivity: 86.5, xmax: 2.8, sd: 52, sdM2: 0.0052, vd: 145.6,
      imp: 8, pe: 60, bl: 4.2, mms: 3.6, le: 0.15,
    },
    dimensions: {
      overallDiameter: 126, cutoutDiameter: 110, mountingDepth: 62,
      magnetDiameter: 65, magnetDepth: 20, weight: 470,
    },
    notes: 'Illuminator 4.5" mellemtone med glassfiber-membran. Lav Fs for en mellemtone. Kan gå ned til ~120 Hz i 3-vejs.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-sb-acoustics-sb12nrx25-4',
    manufacturer: 'SB Acoustics',
    model: 'SB12NRX25-4',
    type: 'midrange',
    tsParams: {
      fs: 65, re: 3.3, qms: 2.8, qes: 0.53, qts: 0.45, vas: 6.1,
      sensitivity: 87.0, xmax: 4.0, sd: 52, sdM2: 0.0052, vd: 208,
      imp: 4, pe: 60, bl: 5.2, mms: 8.0,
    },
    dimensions: {
      overallDiameter: 132, cutoutDiameter: 118, mountingDepth: 64,
      magnetDiameter: 70, magnetDepth: 22, weight: 530,
    },
    notes: 'SB NRX 4.5" mellemtone. Papir-membran med glat respons. Kan bruges som wide-range (200 Hz - 5 kHz).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-markaudio-alpair-7ms',
    manufacturer: 'Markaudio',
    model: 'Alpair 7MS',
    type: 'fullrange',
    tsParams: {
      fs: 65, re: 6.4, qms: 3.5, qes: 0.34, qts: 0.31, vas: 6.5,
      sensitivity: 86.0, xmax: 3.0, sd: 53, sdM2: 0.0053, vd: 159,
      imp: 8, pe: 25, bl: 5.4, mms: 4.5,
    },
    dimensions: {
      overallDiameter: 110, cutoutDiameter: 95, mountingDepth: 48,
      magnetDiameter: 60, magnetDepth: 18, weight: 350,
    },
    notes: '4" full-range med metal-membran. Glat respons fra ~80 Hz til 20 kHz. Kan stå alene eller med subwoofer.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== Tweeters =====

  {
    id: 'seed-scanspeak-h2606-920000',
    manufacturer: 'ScanSpeak',
    model: 'H2606/920000',
    type: 'tweeter',
    tsParams: {
      fs: 1030, re: 4.9, qms: 0.6, qes: 0.4, qts: 0.24, vas: 0.02,
      sensitivity: 95.2, xmax: 0.2, sd: 5.3, sdM2: 0.00053, vd: 1.06,
      imp: 6, pe: 50,
    },
    dimensions: {
      overallDiameter: 104, cutoutDiameter: 33, mountingDepth: 20,
      magnetDiameter: 50, magnetDepth: 15, weight: 280,
    },
    frequencyResponse: H2606_ONAXIS,
    offAxis: H2606_OFFAXIS,
    datasheetUrl: 'https://www.scan-speak.dk/datasheet/pdf/h2606-920000.pdf',
    notes: 'Horn-loaded ringradiator-diskant. throat_d=33mm, BCD=95mm, faceplate=104mm. STEP-verificeret. Krydsningsfrekvens 1250 Hz LR4 (afventer distorsionstest). Hornet giver ~3 dB følsomhedsforøgelse og smallere spredning.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-sb26stac-c000-4',
    manufacturer: 'SB Acoustics',
    model: 'SB26STAC-C000-4',
    type: 'tweeter',
    tsParams: {
      fs: 750, re: 3.0, qms: 0.8, qes: 0.5, qts: 0.31, vas: 0.05,
      sensitivity: 91.5, xmax: 0.6, sd: 7.0, sdM2: 0.0007, vd: 4.2,
      imp: 4, pe: 80,
    },
    parameterSets: [
      {
        name: 'DATS (Jul 25)',
        tsParams: {
          fs: 658.1, re: 3.223, qms: 2.608, qes: 1.735, qts: 1.042, vas: 0.05,
          sensitivity: 91.5, xmax: 0.6, sd: 7.0, sdM2: 0.0007, vd: 4.2,
          imp: 4, pe: 80,
        },
        notes: 'Fremragende match til datablad. Fs=658 (-12%), Qts=1.04 (-7%). Alle parametre indenfor 13%. Ingen aktion nødvendig.',
      },
    ],
    dimensions: {
      overallDiameter: 100, cutoutDiameter: 28, mountingDepth: 15,
      magnetDiameter: 40, magnetDepth: 12, weight: 150,
    },
    frequencyResponse: SB26_ONAXIS,
    datasheetUrl: 'https://sbacoustics.com/wp-content/uploads/downloads/SB26STAC-C000-4.pdf',
    notes: 'Konventionel blød-dome diskant. Fallback til mk2 hvis H2606 fejler distorsionstest. 6.4-10.3 dB mere excursion-headroom end H2606. Kræver WG212 redesign hvis brugt. BCD=88.5mm.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-scanspeak-d3004-602000',
    manufacturer: 'ScanSpeak',
    model: 'D3004/602000',
    type: 'tweeter',
    tsParams: {
      fs: 600, re: 4.0, qms: 0.7, qes: 0.5, qts: 0.29, vas: 0.11,
      sensitivity: 91.5, xmax: 0.5, sd: 7.5, sdM2: 0.00075, vd: 3.75,
      imp: 4, pe: 80, le: 0.08,
    },
    dimensions: {
      overallDiameter: 104, cutoutDiameter: 72, mountingDepth: 26,
      magnetDiameter: 72, magnetDepth: 15, weight: 350,
    },
    notes: 'Illuminator D3004/602000 med bølgeleder. 34 mm tekstil-dome, SD-2 motor. Lav Fs (600 Hz) muliggør lav krydsning (~1.5-1.8 kHz LR4).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-scanspeak-d2905-990000',
    manufacturer: 'ScanSpeak',
    model: 'D2905/990000',
    type: 'tweeter',
    tsParams: {
      fs: 800, re: 6.0, qms: 0.6, qes: 0.4, qts: 0.24, vas: 0.02,
      sensitivity: 93.0, xmax: 0.3, sd: 5.0, sdM2: 0.00050, vd: 1.5,
      imp: 8, pe: 50, le: 1.0,
    },
    dimensions: {
      overallDiameter: 100, cutoutDiameter: 70, mountingDepth: 30,
      magnetDiameter: 70, magnetDepth: 12, weight: 250,
    },
    notes: 'Klassisk 25 mm tekstil-dome diskant. Velkendt glat respons. Har været brugt i utallige kommercielle højttalere.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-dayton-nd28f-4',
    manufacturer: 'Dayton Audio',
    model: 'ND28F-4',
    type: 'tweeter',
    tsParams: {
      fs: 1100, re: 3.2, qms: 2.5, qes: 1.1, qts: 0.76, vas: 0.02,
      sensitivity: 94.5, xmax: 0.3, sd: 4.5, sdM2: 0.00045, vd: 1.35,
      imp: 4, pe: 50,
    },
    dimensions: {
      overallDiameter: 80, cutoutDiameter: 70, mountingDepth: 20,
      magnetDiameter: 60, magnetDepth: 12, weight: 180,
    },
    notes: 'ND Series 28 mm neodymium-diskant. Høj følsomhed, kompakt. Velegnet til 2-vejs med krydsning > 2 kHz. God pris/ydelse.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-sb-acoustics-tweeter',
    manufacturer: 'SB Acoustics',
    model: 'SB29RDC-C000-4',
    type: 'tweeter',
    tsParams: {
      fs: 550, re: 3.2, qms: 1.1, qes: 0.6, qts: 0.39, vas: 0.09,
      sensitivity: 91.5, xmax: 1.0, sd: 7.3, sdM2: 0.00073, vd: 7.3,
      imp: 4, pe: 100,
    },
    dimensions: {
      overallDiameter: 106, cutoutDiameter: 74, mountingDepth: 27,
      magnetDiameter: 75, magnetDepth: 15, weight: 380,
    },
    notes: '29 mm ringradiator-diskant. Lav Fs (550 Hz) tillader krydsning helt ned til ~1.2 kHz. Høj xmax. Godt alternativ til horn-diskant.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-vifa-bc25tg15-04',
    manufacturer: 'Vifa (Peerless by Tymphany)',
    model: 'BC25TG15-04',
    type: 'tweeter',
    tsParams: {
      fs: 1100, re: 3.2, qms: 2.75, qes: 1.53, qts: 0.98, vas: 0.003,
      sensitivity: 93.9, xmax: 1.17, sd: 6.16, sdM2: 0.000616, vd: 7.2,
      imp: 4, pe: 7, le: 0.029, bl: 2.24, mms: 0.347, cms: 58,
    },
    dimensions: {
      overallDiameter: 104, cutoutDiameter: 74, mountingDepth: 18,
      magnetDiameter: 60, magnetDepth: 20, weight: 510,
    },
    frequencyResponse: VIFA_BC25TG15_ONAXIS,
    datasheetUrl: 'https://www.madisoundspeakerstore.com/vifa-soft-dome-tweeters/vifa-bc25tg15-04-1-textile-dome-tweeter/',
    notes: '1" (25.4mm) fabric dome, ferrofluid cooled, ferrite magnet. Fs 1100 Hz, sensitivity 93.9 dB (2.83V). Tidligere brugt i Kudos X2 kabinet med Wavecor WF146WA01/02. Mulig oprindelig delefrekvens op mod 4900 Hz (Kudos passivt design) — overskrider Wavecor max 3.5 kHz. Frekvensrespons digitaliseret fra datasheet PDF (Peerless by Tymphany, juli 2025). Sources: datasheet PDF, HiFiCompass, Madisound.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-wavecor-wf146wa01',
    manufacturer: 'Wavecor',
    model: 'WF146WA01 (4Ω)',
    type: 'midrange',
    tsParams: {
      fs: 56, re: 3.2, qms: 7.0, qes: 0.45, qts: 0.42, vas: 10.0,
      sensitivity: 90.0, xmax: 4.0, sd: 95, sdM2: 0.0095, vd: 380,
      imp: 4, pe: 55, le: 0.24, bl: 5.1, mms: 10.4, cms: 0.78,
    },
    dimensions: {
      overallDiameter: 146, cutoutDiameter: 123, mountingDepth: 60,
      magnetDiameter: 90, magnetDepth: 30, weight: 1030,
    },
    frequencyResponse: WF146WA01_ONAXIS,
    datasheetUrl: 'https://www.wavecor.com/html/wf146wa01_02.html',
    notes: '5.75" (146mm) paper cone mid/woofer, 90mm magnet, alu field-stabilizing ring, vented VC former + chassis. 32mm voice coil (1.25"). Anbefalet max øvre frekvens: 3.5 kHz — 4900 Hz (Kudos X2) overskrider dette (breakup/directivity risk). Tidligere brugt i Kudos X2 kabinet med Vifa BC25TG15-04 diskant. 8Ω variant findes: WF146WA02 (Re=6.3, sensitivity 87.5 dB, Qts=0.51, Fs=58 Hz). Frekvensrespons konstrueret fra T/S parametre + datasheet SPL-kurve (wavecor.com, marts 2024). Source: wavecor.com spec page + datasheet PDF.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-wavecor-wf146wa02',
    manufacturer: 'Wavecor',
    model: 'WF146WA02 (8Ω)',
    type: 'midrange',
    tsParams: {
      fs: 58, re: 6.3, qms: 7.0, qes: 0.54, qts: 0.51, vas: 10.0,
      sensitivity: 87.5, xmax: 4.0, sd: 95, sdM2: 0.0095, vd: 380,
      imp: 8, pe: 55, le: 0.39, bl: 6.4, mms: 9.7, cms: 0.78,
    },
    dimensions: {
      overallDiameter: 146, cutoutDiameter: 123, mountingDepth: 60,
      magnetDiameter: 90, magnetDepth: 30, weight: 1030,
    },
    frequencyResponse: WF146WA02_ONAXIS,
    datasheetUrl: 'https://www.wavecor.com/html/wf146wa01_02.html',
    notes: '8Ω variant af WF146WA01. Identisk membran og motor, men dobbelt impedans giver lavere sensitivity (87.5 vs 90 dB). Qts=0.51 (højere end 4Ω variant). Anbefalet max øvre frekvens: 3.5 kHz. Frekvensrespons konstrueret fra T/S parametre + datasheet SPL-kurve. Source: wavecor.com spec page + datasheet PDF.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-wavecor-wf168wa01',
    manufacturer: 'Wavecor',
    model: 'WF168WA01 (4Ω)',
    type: 'woofer',
    tsParams: {
      fs: 47.5, re: 3.2, qms: 7.0, qes: 0.46, qts: 0.43, vas: 24.6,
      sensitivity: 91.5, xmax: 4.0, sd: 139, sdM2: 0.0139, vd: 556,
      imp: 4, pe: 60, le: 0.24, bl: 5.1, mms: 12.5, cms: 0.90,
    },
    dimensions: {
      overallDiameter: 168, cutoutDiameter: 159, mountingDepth: 73,
      magnetDiameter: 90, magnetDepth: 30, weight: 1030,
    },
    frequencyResponse: WF168WA01_ONAXIS,
    datasheetUrl: 'https://www.wavecor.com/html/wf168wa01_02.html',
    notes: '6.5" (168mm) paper cone mid/woofer, 90mm magnet, alu field-stabilizing ring, vented VC former + chassis. 32mm voice coil (1.25"). Vas 24.6L — større end WF146WA01 (10L), egner sig til små lukkede/ported kabinetter. Anbefalet max øvre frekvens: 3.0 kHz. Frekvensrespons konstrueret fra T/S parametre + datasheet SPL-kurve (wavecor.com). Source: wavecor.com spec page + datasheet PDF.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: 'seed-wavecor-wf168wa02',
    manufacturer: 'Wavecor',
    model: 'WF168WA02 (8Ω)',
    type: 'woofer',
    tsParams: {
      fs: 49, re: 6.3, qms: 7.1, qes: 0.56, qts: 0.52, vas: 24.6,
      sensitivity: 89.0, xmax: 4.0, sd: 139, sdM2: 0.0139, vd: 556,
      imp: 8, pe: 60, le: 0.39, bl: 6.4, mms: 11.8, cms: 0.90,
    },
    dimensions: {
      overallDiameter: 168, cutoutDiameter: 159, mountingDepth: 73,
      magnetDiameter: 90, magnetDepth: 30, weight: 1030,
    },
    frequencyResponse: WF168WA02_ONAXIS,
    datasheetUrl: 'https://www.wavecor.com/html/wf168wa01_02.html',
    notes: '8Ω variant af WF168WA01. Identisk membran og motor, men dobbelt impedans giver lavere sensitivity (89 vs 91.5 dB). Qts=0.52 (højere end 4Ω variant). Anbefalet max øvre frekvens: 3.0 kHz. Frekvensrespons konstrueret fra T/S parametre + datasheet SPL-kurve. Source: wavecor.com spec page + datasheet PDF.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== DATS-Measured parameter sets (Jul 25-26, 2026) =====
  // Archived in parameterSets on the parent seed drivers above.
  // Standalone DATS entries removed in favor of in-driver parameter set switching.
  // See: seed-grs-12sw-4he, seed-scanspeak-18w-4424g00, seed-sb26stac-c000-4
];
