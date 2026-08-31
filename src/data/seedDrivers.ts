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

// H2606/920000: real measured on-axis + off-axis from loudspeakerlab.com
// (480-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points).
// Replaces earlier PDF-digitized approximation. Full 10-90° off-axis coverage.
const H2606_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:43.7}, {freq:23.8,magnitude:43.7}, {freq:28.7,magnitude:43.5}, {freq:34.1,magnitude:43.3}, {freq:40.6,magnitude:43.1}, {freq:48.3,magnitude:42.7}, {freq:58.2,magnitude:42.2}, {freq:69.2,magnitude:41.5},
  {freq:82.3,magnitude:40.5}, {freq:99.3,magnitude:39.2}, {freq:118.1,magnitude:38.0}, {freq:140.5,magnitude:37.8}, {freq:167.1,magnitude:38.9}, {freq:201.6,magnitude:40.5}, {freq:239.7,magnitude:41.9}, {freq:285.1,magnitude:44.9},
  {freq:344.0,magnitude:49.8}, {freq:409.0,magnitude:53.4}, {freq:486.4,magnitude:56.1}, {freq:578.5,magnitude:59.5}, {freq:697.9,magnitude:63.6}, {freq:830.0,magnitude:67.3}, {freq:987.0,magnitude:69.8}, {freq:1173.8,magnitude:72.0},
  {freq:1416.2,magnitude:73.7}, {freq:1684.1,magnitude:74.8}, {freq:2002.7,magnitude:75.7}, {freq:2416.3,magnitude:76.0}, {freq:2873.5,magnitude:74.7}, {freq:3417.2,magnitude:72.3}, {freq:4063.7,magnitude:72.4}, {freq:4902.9,magnitude:74.3},
  {freq:5830.6,magnitude:74.5}, {freq:6933.8,magnitude:74.6}, {freq:8365.6,magnitude:74.7}, {freq:9948.5,magnitude:73.5}, {freq:11830.8,magnitude:75.6}, {freq:14069.3,magnitude:75.2}, {freq:16974.7,magnitude:72.1}, {freq:20186.4,magnitude:66.7},
];

const H2606_10DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:41.1}, {freq:26.7,magnitude:41.3}, {freq:35.6,magnitude:41.4}, {freq:47.6,magnitude:41.7}, {freq:63.5,magnitude:41.8}, {freq:84.8,magnitude:41.5}, {freq:113.1,magnitude:39.6}, {freq:151.0,magnitude:31.5},
  {freq:201.6,magnitude:36.6}, {freq:269.1,magnitude:44.6}, {freq:359.2,magnitude:49.6}, {freq:479.5,magnitude:55.8}, {freq:630.8,magnitude:61.2}, {freq:842.0,magnitude:67.4}, {freq:1124.0,magnitude:71.5}, {freq:1500.4,magnitude:74.0},
  {freq:2002.7,magnitude:75.5}, {freq:2673.3,magnitude:75.6}, {freq:3568.5,magnitude:72.8}, {freq:4763.4,magnitude:73.5}, {freq:6358.3,magnitude:74.5}, {freq:8487.3,magnitude:74.5}, {freq:11329.2,magnitude:74.5}, {freq:15122.7,magnitude:73.3},
  {freq:20186.4,magnitude:66.1},
];

const H2606_20DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:39.3}, {freq:26.7,magnitude:39.5}, {freq:35.6,magnitude:39.7}, {freq:47.6,magnitude:40.1}, {freq:63.5,magnitude:40.4}, {freq:84.8,magnitude:40.2}, {freq:113.1,magnitude:38.5}, {freq:151.0,magnitude:30.8},
  {freq:201.6,magnitude:36.2}, {freq:269.1,magnitude:44.5}, {freq:359.2,magnitude:49.7}, {freq:479.5,magnitude:55.6}, {freq:630.8,magnitude:61.0}, {freq:842.0,magnitude:67.2}, {freq:1124.0,magnitude:71.1}, {freq:1500.4,magnitude:73.6},
  {freq:2002.7,magnitude:75.0}, {freq:2673.3,magnitude:75.5}, {freq:3568.5,magnitude:73.5}, {freq:4763.4,magnitude:72.7}, {freq:6358.3,magnitude:72.9}, {freq:8487.3,magnitude:73.0}, {freq:11329.2,magnitude:73.2}, {freq:15122.7,magnitude:70.1},
  {freq:20186.4,magnitude:63.7},
];

const H2606_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:40.2}, {freq:26.7,magnitude:40.1}, {freq:35.6,magnitude:39.8}, {freq:47.6,magnitude:39.4}, {freq:63.5,magnitude:38.9}, {freq:84.8,magnitude:38.3}, {freq:113.1,magnitude:38.7}, {freq:151.0,magnitude:40.6},
  {freq:201.6,magnitude:42.7}, {freq:269.1,magnitude:45.4}, {freq:359.2,magnitude:51.2}, {freq:479.5,magnitude:56.0}, {freq:630.8,magnitude:60.9}, {freq:842.0,magnitude:66.8}, {freq:1124.0,magnitude:70.5}, {freq:1500.4,magnitude:72.8},
  {freq:2002.7,magnitude:74.2}, {freq:2673.3,magnitude:75.1}, {freq:3568.5,magnitude:73.8}, {freq:4763.4,magnitude:71.9}, {freq:6358.3,magnitude:71.5}, {freq:8487.3,magnitude:69.9}, {freq:11329.2,magnitude:71.2}, {freq:15122.7,magnitude:65.5},
  {freq:20186.4,magnitude:58.6},
];

const H2606_40DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:67.2}, {freq:26.7,magnitude:67.1}, {freq:35.6,magnitude:66.9}, {freq:47.6,magnitude:66.5}, {freq:63.5,magnitude:65.9}, {freq:84.8,magnitude:64.7}, {freq:113.1,magnitude:62.2}, {freq:151.0,magnitude:56.6},
  {freq:201.6,magnitude:38.0}, {freq:269.1,magnitude:55.0}, {freq:359.2,magnitude:50.3}, {freq:479.5,magnitude:58.1}, {freq:630.8,magnitude:60.7}, {freq:842.0,magnitude:66.3}, {freq:1124.0,magnitude:70.0}, {freq:1500.4,magnitude:71.9},
  {freq:2002.7,magnitude:73.2}, {freq:2673.3,magnitude:74.5}, {freq:3568.5,magnitude:73.4}, {freq:4763.4,magnitude:71.0}, {freq:6358.3,magnitude:70.3}, {freq:8487.3,magnitude:67.1}, {freq:11329.2,magnitude:68.9}, {freq:15122.7,magnitude:58.2},
  {freq:20186.4,magnitude:55.1},
];

const H2606_50DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:37.2}, {freq:26.7,magnitude:37.0}, {freq:35.6,magnitude:36.7}, {freq:47.6,magnitude:36.3}, {freq:63.5,magnitude:35.7}, {freq:84.8,magnitude:35.5}, {freq:113.1,magnitude:36.7}, {freq:151.0,magnitude:39.4},
  {freq:201.6,magnitude:42.1}, {freq:269.1,magnitude:45.3}, {freq:359.2,magnitude:50.6}, {freq:479.5,magnitude:55.6}, {freq:630.8,magnitude:60.1}, {freq:842.0,magnitude:65.3}, {freq:1124.0,magnitude:69.1}, {freq:1500.4,magnitude:70.7},
  {freq:2002.7,magnitude:72.0}, {freq:2673.3,magnitude:73.5}, {freq:3568.5,magnitude:72.1}, {freq:4763.4,magnitude:69.7}, {freq:6358.3,magnitude:68.0}, {freq:8487.3,magnitude:64.7}, {freq:11329.2,magnitude:66.2}, {freq:15122.7,magnitude:54.4},
  {freq:20186.4,magnitude:53.2},
];

const H2606_60DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:38.9}, {freq:26.7,magnitude:38.7}, {freq:35.6,magnitude:38.4}, {freq:47.6,magnitude:37.8}, {freq:63.5,magnitude:36.8}, {freq:84.8,magnitude:34.9}, {freq:113.1,magnitude:32.8}, {freq:151.0,magnitude:35.1},
  {freq:201.6,magnitude:39.9}, {freq:269.1,magnitude:43.9}, {freq:359.2,magnitude:49.4}, {freq:479.5,magnitude:54.9}, {freq:630.8,magnitude:59.6}, {freq:842.0,magnitude:64.1}, {freq:1124.0,magnitude:68.4}, {freq:1500.4,magnitude:69.3},
  {freq:2002.7,magnitude:70.8}, {freq:2673.3,magnitude:72.4}, {freq:3568.5,magnitude:70.3}, {freq:4763.4,magnitude:67.9}, {freq:6358.3,magnitude:65.4}, {freq:8487.3,magnitude:62.5}, {freq:11329.2,magnitude:63.0}, {freq:15122.7,magnitude:55.3},
  {freq:20186.4,magnitude:52.9},
];

const H2606_70DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:43.0}, {freq:26.7,magnitude:42.9}, {freq:35.6,magnitude:42.9}, {freq:47.6,magnitude:42.7}, {freq:63.5,magnitude:42.3}, {freq:84.8,magnitude:41.2}, {freq:113.1,magnitude:38.4}, {freq:151.0,magnitude:29.0},
  {freq:201.6,magnitude:39.4}, {freq:269.1,magnitude:45.6}, {freq:359.2,magnitude:48.8}, {freq:479.5,magnitude:54.9}, {freq:630.8,magnitude:59.4}, {freq:842.0,magnitude:63.0}, {freq:1124.0,magnitude:67.6}, {freq:1500.4,magnitude:67.7},
  {freq:2002.7,magnitude:69.6}, {freq:2673.3,magnitude:70.7}, {freq:3568.5,magnitude:68.2}, {freq:4763.4,magnitude:65.7}, {freq:6358.3,magnitude:62.9}, {freq:8487.3,magnitude:60.6}, {freq:11329.2,magnitude:59.3}, {freq:15122.7,magnitude:53.5},
  {freq:20186.4,magnitude:51.7},
];

const H2606_80DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:53.7}, {freq:26.7,magnitude:53.6}, {freq:35.6,magnitude:53.4}, {freq:47.6,magnitude:53.0}, {freq:63.5,magnitude:52.4}, {freq:84.8,magnitude:51.3}, {freq:113.1,magnitude:49.4}, {freq:151.0,magnitude:46.7},
  {freq:201.6,magnitude:42.9}, {freq:269.1,magnitude:41.6}, {freq:359.2,magnitude:49.8}, {freq:479.5,magnitude:53.8}, {freq:630.8,magnitude:59.3}, {freq:842.0,magnitude:62.2}, {freq:1124.0,magnitude:66.3}, {freq:1500.4,magnitude:66.4},
  {freq:2002.7,magnitude:68.0}, {freq:2673.3,magnitude:68.6}, {freq:3568.5,magnitude:65.7}, {freq:4763.4,magnitude:63.0}, {freq:6358.3,magnitude:60.4}, {freq:8487.3,magnitude:58.1}, {freq:11329.2,magnitude:55.5}, {freq:15122.7,magnitude:49.9},
  {freq:20186.4,magnitude:47.5},
];

const H2606_90DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:51.5}, {freq:26.7,magnitude:51.4}, {freq:35.6,magnitude:51.2}, {freq:47.6,magnitude:50.8}, {freq:63.5,magnitude:50.1}, {freq:84.8,magnitude:49.0}, {freq:113.1,magnitude:47.0}, {freq:151.0,magnitude:44.4},
  {freq:201.6,magnitude:41.5}, {freq:269.1,magnitude:40.3}, {freq:359.2,magnitude:48.8}, {freq:479.5,magnitude:53.3}, {freq:630.8,magnitude:59.0}, {freq:842.0,magnitude:62.1}, {freq:1124.0,magnitude:64.6}, {freq:1500.4,magnitude:65.6},
  {freq:2002.7,magnitude:66.6}, {freq:2673.3,magnitude:67.1}, {freq:3568.5,magnitude:63.5}, {freq:4763.4,magnitude:60.7}, {freq:6358.3,magnitude:58.0}, {freq:8487.3,magnitude:55.2}, {freq:11329.2,magnitude:51.8}, {freq:15122.7,magnitude:45.9},
  {freq:20186.4,magnitude:43.1},
];

const H2606_OFFAXIS: OffAxisData[] = [
  { angle: 10, curve: H2606_10DEG },
  { angle: 20, curve: H2606_20DEG },
  { angle: 30, curve: H2606_30DEG },
  { angle: 40, curve: H2606_40DEG },
  { angle: 50, curve: H2606_50DEG },
  { angle: 60, curve: H2606_60DEG },
  { angle: 70, curve: H2606_70DEG },
  { angle: 80, curve: H2606_80DEG },
  { angle: 90, curve: H2606_90DEG },
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
// Scan-Speak 18W/4424G00: real measured on-axis + off-axis from
// loudspeakerlab.com (475-point Plotly curves, subsampled to ~40 on-axis /
// ~25 off-axis points). Replaces earlier pixel-digitized approximation.
const MID18W_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.9,magnitude:75.3}, {freq:24.8,magnitude:79.3}, {freq:29.5,magnitude:78.5}, {freq:35.1,magnitude:82.4}, {freq:42.4,magnitude:84.8}, {freq:50.4,magnitude:83.8}, {freq:59.9,magnitude:89.3}, {freq:71.3,magnitude:88.4},
  {freq:84.8,magnitude:90.6}, {freq:100.8,magnitude:91.2}, {freq:121.6,magnitude:92.4}, {freq:144.6,magnitude:92.9}, {freq:172.0,magnitude:92.5}, {freq:204.5,magnitude:92.7}, {freq:243.2,magnitude:92.4}, {freq:289.2,magnitude:92.5},
  {freq:344.0,magnitude:93.0}, {freq:415.0,magnitude:92.4}, {freq:493.5,magnitude:91.9}, {freq:586.9,magnitude:92.5}, {freq:697.9,magnitude:92.3}, {freq:830.0,magnitude:92.2}, {freq:987.0,magnitude:92.3}, {freq:1190.8,magnitude:92.9},
  {freq:1416.2,magnitude:94.0}, {freq:1684.1,magnitude:93.9}, {freq:2002.7,magnitude:94.5}, {freq:2381.7,magnitude:94.0}, {freq:2832.3,magnitude:92.6}, {freq:3368.2,magnitude:93.5}, {freq:4063.7,magnitude:94.2}, {freq:4832.6,magnitude:93.4},
  {freq:5747.0,magnitude:91.8}, {freq:6834.4,magnitude:91.4}, {freq:8127.5,magnitude:91.0}, {freq:9665.3,magnitude:89.1}, {freq:11661.2,magnitude:82.9}, {freq:13867.6,magnitude:73.8}, {freq:16491.4,magnitude:69.3}, {freq:19611.7,magnitude:69.7},
];

const MID18W_30DEG: FrequencyDataPoint[] = [
  {freq:20.9,magnitude:75.0}, {freq:27.9,magnitude:77.2}, {freq:36.7,magnitude:82.7}, {freq:49.0,magnitude:83.0}, {freq:65.4,magnitude:88.6}, {freq:87.2,magnitude:90.5}, {freq:114.8,magnitude:91.9}, {freq:153.2,magnitude:92.6},
  {freq:204.5,magnitude:92.5}, {freq:273.0,magnitude:92.1}, {freq:359.2,magnitude:92.5}, {freq:479.5,magnitude:91.6}, {freq:640.0,magnitude:92.0}, {freq:854.3,magnitude:91.9}, {freq:1124.0,magnitude:91.6}, {freq:1500.4,magnitude:92.5},
  {freq:2002.7,magnitude:92.8}, {freq:2673.3,magnitude:90.2}, {freq:3517.3,magnitude:89.5}, {freq:4695.1,magnitude:84.6}, {freq:6267.2,magnitude:80.5}, {freq:8365.6,magnitude:70.2}, {freq:11006.7,magnitude:68.7}, {freq:14692.2,magnitude:52.4},
  {freq:19611.7,magnitude:55.2},
];

const MID18W_60DEG: FrequencyDataPoint[] = [
  {freq:20.9,magnitude:75.0}, {freq:27.9,magnitude:77.2}, {freq:36.7,magnitude:82.6}, {freq:49.0,magnitude:82.9}, {freq:65.4,magnitude:88.6}, {freq:87.2,magnitude:90.4}, {freq:114.8,magnitude:91.8}, {freq:153.2,magnitude:92.5},
  {freq:204.5,magnitude:92.4}, {freq:273.0,magnitude:92.1}, {freq:359.2,magnitude:92.4}, {freq:479.5,magnitude:91.4}, {freq:640.0,magnitude:91.9}, {freq:854.3,magnitude:91.2}, {freq:1124.0,magnitude:90.8}, {freq:1500.4,magnitude:90.4},
  {freq:2002.7,magnitude:89.5}, {freq:2673.3,magnitude:85.1}, {freq:3517.3,magnitude:75.5}, {freq:4695.1,magnitude:79.4}, {freq:6267.2,magnitude:56.4}, {freq:8365.6,magnitude:69.9}, {freq:11006.7,magnitude:69.3}, {freq:14692.2,magnitude:56.7},
  {freq:19611.7,magnitude:56.7},
];

// ---------------------------------------------------------------------------
// Vifa / Wavecor frequency response data
// Vifa BC25TG15-04: real measured on-axis + off-axis from loudspeakerlab.com
//   (321-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points)
// Wavecor WF146WA01: real measured on-axis from loudspeakerlab.com (480-point
//   Plotly curve, subsampled to 40 points). Replaces earlier pixel-digitized
//   approximation from loudspeakerdatabase.com.
// Wavecor WF146WA02 + WF168WA01/02: measured on-axis SPL curves digitized
//   from loudspeakerdatabase.com manufacturer chart images. Low-frequency values
//   below ~100 Hz on WF168 curves are model-corrected (Fs dip from T/S params)
//   because pixel detection couldn't separate the curve from legend text at LF.
// ---------------------------------------------------------------------------

const VIFA_BC25TG15_ONAXIS: FrequencyDataPoint[] = [
  {freq:198.7,magnitude:61.8}, {freq:223.0,magnitude:64.1}, {freq:250.3,magnitude:66.3}, {freq:285.1,magnitude:68.2}, {freq:320.0,magnitude:70.1}, {freq:359.2,magnitude:72.5}, {freq:403.2,magnitude:74.5}, {freq:452.5,magnitude:76.3},
  {freq:515.4,magnitude:78.9}, {freq:578.5,magnitude:80.7}, {freq:649.3,magnitude:82.9}, {freq:728.8,magnitude:85.0}, {freq:818.1,magnitude:87.1}, {freq:931.6,magnitude:89.3}, {freq:1045.7,magnitude:90.6}, {freq:1173.8,magnitude:92.4},
  {freq:1317.5,magnitude:93.2}, {freq:1478.9,magnitude:94.2}, {freq:1684.1,magnitude:94.2}, {freq:1890.3,magnitude:94.4}, {freq:2121.8,magnitude:94.3}, {freq:2381.7,magnitude:94.1}, {freq:2712.2,magnitude:94.1}, {freq:3044.4,magnitude:93.9},
  {freq:3417.2,magnitude:93.8}, {freq:3835.7,magnitude:93.4}, {freq:4305.4,magnitude:92.1}, {freq:4902.9,magnitude:93.9}, {freq:5503.4,magnitude:94.4}, {freq:6177.3,magnitude:92.9}, {freq:6933.8,magnitude:93.2}, {freq:7782.9,magnitude:93.2},
  {freq:8863.1,magnitude:92.9}, {freq:9948.5,magnitude:92.7}, {freq:11166.8,magnitude:92.9}, {freq:12534.3,magnitude:92.0}, {freq:14069.3,magnitude:92.3}, {freq:16021.9,magnitude:93.2}, {freq:17984.0,magnitude:93.7}, {freq:20186.4,magnitude:92.0},
];

const VIFA_BC25TG15_30DEG: FrequencyDataPoint[] = [
  {freq:198.7,magnitude:61.7}, {freq:239.7,magnitude:66.2}, {freq:293.4,magnitude:68.9}, {freq:354.0,magnitude:72.3}, {freq:427.1,magnitude:75.6}, {freq:522.9,magnitude:79.4}, {freq:630.8,magnitude:82.3}, {freq:761.1,magnitude:86.0},
  {freq:931.6,magnitude:89.2}, {freq:1124.0,magnitude:91.9}, {freq:1356.1,magnitude:93.5}, {freq:1660.0,magnitude:94.1}, {freq:2002.7,magnitude:94.1}, {freq:2416.3,magnitude:93.8}, {freq:2957.7,magnitude:93.3}, {freq:3568.5,magnitude:93.2},
  {freq:4305.4,magnitude:92.9}, {freq:5270.0,magnitude:93.9}, {freq:6358.3,magnitude:91.8}, {freq:7671.3,magnitude:90.2}, {freq:9390.1,magnitude:91.0}, {freq:11329.2,magnitude:89.6}, {freq:13668.8,magnitude:87.5}, {freq:16731.3,magnitude:85.4},
  {freq:20186.4,magnitude:81.9},
];

const VIFA_BC25TG15_60DEG: FrequencyDataPoint[] = [
  {freq:198.7,magnitude:62.0}, {freq:239.7,magnitude:66.2}, {freq:293.4,magnitude:68.8}, {freq:354.0,magnitude:72.4}, {freq:427.1,magnitude:75.8}, {freq:522.9,magnitude:79.4}, {freq:630.8,magnitude:82.3}, {freq:761.1,magnitude:85.9},
  {freq:931.6,magnitude:89.4}, {freq:1124.0,magnitude:92.1}, {freq:1356.1,magnitude:93.6}, {freq:1660.0,magnitude:93.8}, {freq:2002.7,magnitude:93.8}, {freq:2416.3,magnitude:93.0}, {freq:2957.7,magnitude:92.5}, {freq:3568.5,magnitude:91.7},
  {freq:4305.4,magnitude:92.4}, {freq:5270.0,magnitude:90.5}, {freq:6358.3,magnitude:89.3}, {freq:7671.3,magnitude:89.2}, {freq:9390.1,magnitude:85.4}, {freq:11329.2,magnitude:82.5}, {freq:13668.8,magnitude:76.2}, {freq:16731.3,magnitude:74.1},
  {freq:20186.4,magnitude:73.9},
];

const WF146WA01_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:71.7}, {freq:23.8,magnitude:74.4}, {freq:28.7,magnitude:76.6}, {freq:34.1,magnitude:78.5}, {freq:40.6,magnitude:80.2}, {freq:48.3,magnitude:81.7}, {freq:58.2,magnitude:83.3}, {freq:69.2,magnitude:84.7},
  {freq:82.3,magnitude:86.0}, {freq:99.3,magnitude:87.3}, {freq:118.1,magnitude:88.3}, {freq:140.5,magnitude:89.1}, {freq:167.1,magnitude:89.7}, {freq:201.6,magnitude:90.1}, {freq:239.7,magnitude:90.4}, {freq:285.1,magnitude:90.5},
  {freq:344.0,magnitude:90.7}, {freq:409.0,magnitude:90.5}, {freq:486.4,magnitude:90.7}, {freq:578.5,magnitude:90.6}, {freq:697.9,magnitude:90.8}, {freq:830.0,magnitude:90.7}, {freq:987.0,magnitude:90.4}, {freq:1173.8,magnitude:91.2},
  {freq:1416.2,magnitude:91.1}, {freq:1684.1,magnitude:89.6}, {freq:2002.7,magnitude:89.1}, {freq:2416.3,magnitude:89.2}, {freq:2873.5,magnitude:88.8}, {freq:3417.2,magnitude:88.3}, {freq:4063.7,magnitude:90.9}, {freq:4902.9,magnitude:91.1},
  {freq:5830.6,magnitude:90.5}, {freq:6933.8,magnitude:86.6}, {freq:8365.6,magnitude:89.0}, {freq:9948.5,magnitude:89.3}, {freq:11830.8,magnitude:82.5}, {freq:14069.3,magnitude:76.2}, {freq:16974.7,magnitude:66.5}, {freq:20186.4,magnitude:56.9},
];

const WF146WA02_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:68.2}, {freq:29.4,magnitude:73.9}, {freq:43.1,magnitude:78.0}, {freq:63.2,magnitude:81.5},
  {freq:92.8,magnitude:84.5}, {freq:136.3,magnitude:86.5}, {freq:200.0,magnitude:87.5}, {freq:293.6,magnitude:87.9},
  {freq:430.9,magnitude:87.6}, {freq:632.5,magnitude:88.0}, {freq:928.3,magnitude:87.6}, {freq:1362.6,magnitude:88.6},
  {freq:2000.0,magnitude:87.3}, {freq:2935.6,magnitude:87.1}, {freq:4308.9,magnitude:90.8}, {freq:6324.6,magnitude:89.8},
  {freq:9283.2,magnitude:88.4}, {freq:13625.8,magnitude:77.3}, {freq:20000.0,magnitude:60.1},
];

const WF168WA01_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:73.5}, {freq:29.4,magnitude:78.1}, {freq:43.1,magnitude:81.9}, {freq:63.2,magnitude:91.5},
  {freq:92.8,magnitude:91.5}, {freq:136.3,magnitude:91.5}, {freq:200.0,magnitude:91.5}, {freq:293.6,magnitude:91.5},
  {freq:430.9,magnitude:91.5}, {freq:632.5,magnitude:91.5}, {freq:928.3,magnitude:91.0}, {freq:1362.6,magnitude:91.0},
  {freq:2000.0,magnitude:88.6}, {freq:2935.6,magnitude:80.1}, {freq:4308.9,magnitude:77.4}, {freq:6324.6,magnitude:77.3},
  {freq:9283.2,magnitude:77.7}, {freq:13625.8,magnitude:77.3}, {freq:20000.0,magnitude:77.3},
];

const WF168WA02_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:71.3}, {freq:29.4,magnitude:76.2}, {freq:43.1,magnitude:80.3}, {freq:63.2,magnitude:88.2},
  {freq:92.8,magnitude:88.2}, {freq:136.3,magnitude:88.2}, {freq:200.0,magnitude:88.2}, {freq:293.6,magnitude:88.2},
  {freq:430.9,magnitude:88.2}, {freq:632.5,magnitude:87.0}, {freq:928.3,magnitude:87.2}, {freq:1362.6,magnitude:87.5},
  {freq:2000.0,magnitude:85.5}, {freq:2935.6,magnitude:80.5}, {freq:4308.9,magnitude:77.3}, {freq:6324.6,magnitude:77.3},
  {freq:9283.2,magnitude:77.3}, {freq:13625.8,magnitude:77.3}, {freq:20000.0,magnitude:77.3},
];

// GRS 12SMP-4: real measured on-axis + off-axis from loudspeakerlab.com
// (480-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points).
// 12" surface-mount poly cone bass-midwoofer, 4 Ω, 91.9 dB, 90 W RMS.
// Fs 28 Hz, Qts 0.51, Vas 132 L, Xmax 5.5 mm, Sd 516 cm², Bl 10.2 Tm.
const GRS_12SMP_4_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:82.1}, {freq:23.8,magnitude:84.0}, {freq:28.7,magnitude:86.0}, {freq:34.1,magnitude:87.6}, {freq:40.6,magnitude:89.4}, {freq:48.3,magnitude:89.2}, {freq:58.2,magnitude:89.8}, {freq:69.2,magnitude:90.8},
  {freq:82.3,magnitude:91.5}, {freq:99.3,magnitude:91.9}, {freq:118.1,magnitude:91.6}, {freq:140.5,magnitude:91.3}, {freq:167.1,magnitude:91.1}, {freq:201.6,magnitude:90.8}, {freq:239.7,magnitude:90.8}, {freq:285.1,magnitude:89.9},
  {freq:344.0,magnitude:89.7}, {freq:409.0,magnitude:89.1}, {freq:486.4,magnitude:86.6}, {freq:578.5,magnitude:90.9}, {freq:697.9,magnitude:90.8}, {freq:830.0,magnitude:93.0}, {freq:987.0,magnitude:93.8}, {freq:1173.8,magnitude:95.0},
  {freq:1416.2,magnitude:94.6}, {freq:1684.1,magnitude:96.3}, {freq:2002.7,magnitude:96.9}, {freq:2416.3,magnitude:92.9}, {freq:2873.5,magnitude:91.4}, {freq:3417.2,magnitude:89.4}, {freq:4063.7,magnitude:78.6}, {freq:4902.9,magnitude:79.7},
  {freq:5830.6,magnitude:76.1}, {freq:6933.8,magnitude:72.8}, {freq:8365.6,magnitude:72.3}, {freq:9948.5,magnitude:59.8}, {freq:11830.8,magnitude:68.3}, {freq:14069.3,magnitude:59.6}, {freq:16974.7,magnitude:56.7}, {freq:20186.4,magnitude:53.4},
];

const GRS_12SMP_4_15DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:82.1}, {freq:26.7,magnitude:85.5}, {freq:35.6,magnitude:88.0}, {freq:47.6,magnitude:89.2}, {freq:63.5,magnitude:90.3}, {freq:84.8,magnitude:91.6}, {freq:113.1,magnitude:91.7}, {freq:151.0,magnitude:91.2},
  {freq:201.6,magnitude:90.8}, {freq:269.1,magnitude:90.2}, {freq:359.2,magnitude:89.7}, {freq:479.5,magnitude:87.1}, {freq:630.8,magnitude:90.8}, {freq:842.0,magnitude:92.5}, {freq:1124.0,magnitude:94.7}, {freq:1500.4,magnitude:95.0},
  {freq:2002.7,magnitude:95.3}, {freq:2673.3,magnitude:89.6}, {freq:3568.5,magnitude:85.6}, {freq:4763.4,magnitude:65.9}, {freq:6358.3,magnitude:53.7}, {freq:8487.3,magnitude:65.9}, {freq:11329.2,magnitude:65.3}, {freq:15122.7,magnitude:56.7},
  {freq:20186.4,magnitude:49.6},
];

const GRS_12SMP_4_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:82.1}, {freq:26.7,magnitude:85.5}, {freq:35.6,magnitude:88.0}, {freq:47.6,magnitude:89.2}, {freq:63.5,magnitude:90.3}, {freq:84.8,magnitude:91.6}, {freq:113.1,magnitude:91.7}, {freq:151.0,magnitude:91.2},
  {freq:201.6,magnitude:90.8}, {freq:269.1,magnitude:90.2}, {freq:359.2,magnitude:89.7}, {freq:479.5,magnitude:87.1}, {freq:630.8,magnitude:90.9}, {freq:842.0,magnitude:91.9}, {freq:1124.0,magnitude:93.7}, {freq:1500.4,magnitude:93.1},
  {freq:2002.7,magnitude:90.7}, {freq:2673.3,magnitude:82.2}, {freq:3568.5,magnitude:68.2}, {freq:4763.4,magnitude:68.4}, {freq:6358.3,magnitude:65.1}, {freq:8487.3,magnitude:62.1}, {freq:11329.2,magnitude:57.1}, {freq:15122.7,magnitude:48.1},
  {freq:20186.4,magnitude:52.8},
];

const GRS_12SMP_4_45DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:82.1}, {freq:26.7,magnitude:85.5}, {freq:35.6,magnitude:88.0}, {freq:47.6,magnitude:89.2}, {freq:63.5,magnitude:90.3}, {freq:84.8,magnitude:91.6}, {freq:113.1,magnitude:91.7}, {freq:151.0,magnitude:91.2},
  {freq:201.6,magnitude:90.8}, {freq:269.1,magnitude:90.2}, {freq:359.2,magnitude:89.7}, {freq:479.5,magnitude:90.8}, {freq:630.8,magnitude:90.2}, {freq:842.0,magnitude:91.2}, {freq:1124.0,magnitude:92.1}, {freq:1500.4,magnitude:89.7},
  {freq:2002.7,magnitude:82.0}, {freq:2673.3,magnitude:70.0}, {freq:3568.5,magnitude:74.7}, {freq:4763.4,magnitude:65.5}, {freq:6358.3,magnitude:54.0}, {freq:8487.3,magnitude:57.8}, {freq:11329.2,magnitude:60.8}, {freq:15122.7,magnitude:50.7},
  {freq:20186.4,magnitude:50.2},
];

// ===== Batch 2: real measured data from loudspeakerlab.com =====
// SB Acoustics SB19ST-C000-4: 3/4" textile dome tweeter, 4 Ω, 88.5 dB.
// 367-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points.
// Measured off-axis: 30° and 60° only (others marked "est." in source).
const SB19ST_C000_ONAXIS: FrequencyDataPoint[] = [
  {freq:102.3,magnitude:51.3}, {freq:116.5,magnitude:52.2}, {freq:134.5,magnitude:55.4}, {freq:153.2,magnitude:59.2}, {freq:177.0,magnitude:60.6}, {freq:201.6,magnitude:63.7}, {freq:229.6,magnitude:63.1}, {freq:265.2,magnitude:65.5},
  {freq:302.0,magnitude:68.0}, {freq:344.0,magnitude:71.6}, {freq:397.4,magnitude:74.3}, {freq:452.5,magnitude:75.3}, {freq:522.9,magnitude:79.5}, {freq:595.4,magnitude:80.6}, {freq:678.1,magnitude:83.0}, {freq:783.4,magnitude:85.2},
  {freq:892.1,magnitude:88.4}, {freq:1030.7,magnitude:90.0}, {freq:1173.8,magnitude:90.3}, {freq:1336.7,magnitude:89.6}, {freq:1544.3,magnitude:90.4}, {freq:1758.7,magnitude:89.6}, {freq:2002.7,magnitude:88.6}, {freq:2313.9,magnitude:89.2},
  {freq:2635.0,magnitude:88.6}, {freq:3044.4,magnitude:89.3}, {freq:3466.9,magnitude:89.6}, {freq:3948.1,magnitude:89.7}, {freq:4561.4,magnitude:90.2}, {freq:5194.5,magnitude:90.0}, {freq:6001.4,magnitude:89.3}, {freq:6834.4,magnitude:89.2},
  {freq:7782.9,magnitude:88.8}, {freq:8992.0,magnitude:88.5}, {freq:10240.0,magnitude:88.7}, {freq:11661.2,magnitude:88.9}, {freq:13472.8,magnitude:88.6}, {freq:15342.7,magnitude:88.4}, {freq:17726.2,magnitude:89.3}, {freq:20186.4,magnitude:89.4},
];

const SB19ST_C000_30DEG: FrequencyDataPoint[] = [
  {freq:102.3,magnitude:51.4}, {freq:127.0,magnitude:54.1}, {freq:157.7,magnitude:56.6}, {freq:198.7,magnitude:62.9}, {freq:246.8,magnitude:66.1}, {freq:306.4,magnitude:68.0}, {freq:380.5,magnitude:73.1}, {freq:479.5,magnitude:77.4},
  {freq:595.4,magnitude:80.1}, {freq:739.4,magnitude:84.2}, {freq:918.3,magnitude:88.5}, {freq:1156.9,magnitude:90.1}, {freq:1436.8,magnitude:89.9}, {freq:1784.2,magnitude:88.8}, {freq:2215.8,magnitude:89.2}, {freq:2791.7,magnitude:88.0},
  {freq:3466.9,magnitude:88.8}, {freq:4305.4,magnitude:89.0}, {freq:5346.7,magnitude:88.6}, {freq:6736.4,magnitude:88.3}, {freq:8365.6,magnitude:87.9}, {freq:10388.9,magnitude:87.3}, {freq:12901.6,magnitude:86.4}, {freq:16255.0,magnitude:86.6},
  {freq:20186.4,magnitude:86.1},
];

const SB19ST_C000_60DEG: FrequencyDataPoint[] = [
  {freq:102.3,magnitude:48.9}, {freq:127.0,magnitude:53.4}, {freq:157.7,magnitude:57.3}, {freq:198.7,magnitude:63.2}, {freq:246.8,magnitude:67.3}, {freq:306.4,magnitude:68.5}, {freq:380.5,magnitude:73.7}, {freq:479.5,magnitude:77.5},
  {freq:595.4,magnitude:80.3}, {freq:739.4,magnitude:84.7}, {freq:918.3,magnitude:88.7}, {freq:1156.9,magnitude:89.6}, {freq:1436.8,magnitude:90.9}, {freq:1784.2,magnitude:88.8}, {freq:2215.8,magnitude:88.6}, {freq:2791.7,magnitude:88.1},
  {freq:3466.9,magnitude:88.5}, {freq:4305.4,magnitude:88.4}, {freq:5346.7,magnitude:87.5}, {freq:6736.4,magnitude:87.6}, {freq:8365.6,magnitude:86.7}, {freq:10388.9,magnitude:84.8}, {freq:12901.6,magnitude:83.8}, {freq:16255.0,magnitude:81.9},
  {freq:20186.4,magnitude:80.0},
];

// SB Acoustics SB13PFCR25-4: 5" fiber cone midbass, 4 Ω, 89 dB.
// 480-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points.
// Full 10-90° measured off-axis (10° steps). Nearfield 54587-pt trace skipped.
const SB13PFCR25_4_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:23.8,magnitude:75.6}, {freq:28.7,magnitude:78.4}, {freq:34.1,magnitude:80.3}, {freq:40.6,magnitude:82.2}, {freq:48.3,magnitude:84.2}, {freq:58.2,magnitude:86.3}, {freq:69.2,magnitude:87.2},
  {freq:82.3,magnitude:88.6}, {freq:99.3,magnitude:89.6}, {freq:118.1,magnitude:90.3}, {freq:140.5,magnitude:90.2}, {freq:167.1,magnitude:91.2}, {freq:201.6,magnitude:91.6}, {freq:239.7,magnitude:91.5}, {freq:285.1,magnitude:91.8},
  {freq:344.0,magnitude:91.6}, {freq:409.0,magnitude:92.0}, {freq:486.4,magnitude:91.5}, {freq:578.5,magnitude:91.6}, {freq:697.9,magnitude:91.5}, {freq:830.0,magnitude:90.3}, {freq:987.0,magnitude:89.8}, {freq:1173.8,magnitude:90.8},
  {freq:1416.2,magnitude:91.6}, {freq:1684.1,magnitude:89.6}, {freq:2002.7,magnitude:89.4}, {freq:2416.3,magnitude:89.7}, {freq:2873.5,magnitude:88.2}, {freq:3417.2,magnitude:86.7}, {freq:4063.7,magnitude:86.8}, {freq:4902.9,magnitude:88.6},
  {freq:5830.6,magnitude:90.9}, {freq:6933.8,magnitude:90.7}, {freq:8365.6,magnitude:88.4}, {freq:9948.5,magnitude:87.1}, {freq:11830.8,magnitude:83.6}, {freq:14069.3,magnitude:74.8}, {freq:16974.7,magnitude:56.8}, {freq:20186.4,magnitude:51.6},
];

const SB13PFCR25_4_10DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.8}, {freq:1500.4,magnitude:91.2},
  {freq:2002.7,magnitude:89.1}, {freq:2673.3,magnitude:88.5}, {freq:3568.5,magnitude:86.9}, {freq:4763.4,magnitude:87.8}, {freq:6358.3,magnitude:94.2}, {freq:8487.3,magnitude:85.7}, {freq:11329.2,magnitude:82.3}, {freq:15122.7,magnitude:67.3},
  {freq:20186.4,magnitude:56.0},
];

const SB13PFCR25_4_20DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.8}, {freq:1500.4,magnitude:91.3},
  {freq:2002.7,magnitude:88.7}, {freq:2673.3,magnitude:87.8}, {freq:3568.5,magnitude:86.4}, {freq:4763.4,magnitude:86.2}, {freq:6358.3,magnitude:92.6}, {freq:8487.3,magnitude:77.6}, {freq:11329.2,magnitude:69.8}, {freq:15122.7,magnitude:64.6},
  {freq:20186.4,magnitude:57.7},
];

const SB13PFCR25_4_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.8}, {freq:1500.4,magnitude:91.2},
  {freq:2002.7,magnitude:88.2}, {freq:2673.3,magnitude:86.9}, {freq:3568.5,magnitude:85.2}, {freq:4763.4,magnitude:83.4}, {freq:6358.3,magnitude:89.5}, {freq:8487.3,magnitude:64.7}, {freq:11329.2,magnitude:69.7}, {freq:15122.7,magnitude:57.5},
  {freq:20186.4,magnitude:62.5},
];

const SB13PFCR25_4_40DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.6}, {freq:1500.4,magnitude:90.8},
  {freq:2002.7,magnitude:87.9}, {freq:2673.3,magnitude:85.6}, {freq:3568.5,magnitude:83.8}, {freq:4763.4,magnitude:79.4}, {freq:6358.3,magnitude:85.7}, {freq:8487.3,magnitude:70.4}, {freq:11329.2,magnitude:69.5}, {freq:15122.7,magnitude:56.6},
  {freq:20186.4,magnitude:60.4},
];

const SB13PFCR25_4_50DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.5}, {freq:1500.4,magnitude:90.4},
  {freq:2002.7,magnitude:87.5}, {freq:2673.3,magnitude:84.4}, {freq:3568.5,magnitude:81.8}, {freq:4763.4,magnitude:73.7}, {freq:6358.3,magnitude:81.8}, {freq:8487.3,magnitude:69.0}, {freq:11329.2,magnitude:63.3}, {freq:15122.7,magnitude:61.4},
  {freq:20186.4,magnitude:52.1},
];

const SB13PFCR25_4_60DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.5}, {freq:1500.4,magnitude:89.9},
  {freq:2002.7,magnitude:87.3}, {freq:2673.3,magnitude:82.9}, {freq:3568.5,magnitude:79.6}, {freq:4763.4,magnitude:65.7}, {freq:6358.3,magnitude:78.4}, {freq:8487.3,magnitude:68.6}, {freq:11329.2,magnitude:52.5}, {freq:15122.7,magnitude:58.8},
  {freq:20186.4,magnitude:38.7},
];

const SB13PFCR25_4_70DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.5}, {freq:1500.4,magnitude:89.5},
  {freq:2002.7,magnitude:87.2}, {freq:2673.3,magnitude:82.1}, {freq:3568.5,magnitude:76.8}, {freq:4763.4,magnitude:62.1}, {freq:6358.3,magnitude:76.8}, {freq:8487.3,magnitude:70.0}, {freq:11329.2,magnitude:54.5}, {freq:15122.7,magnitude:57.4},
  {freq:20186.4,magnitude:45.3},
];

const SB13PFCR25_4_80DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.4}, {freq:1500.4,magnitude:88.9},
  {freq:2002.7,magnitude:87.0}, {freq:2673.3,magnitude:82.0}, {freq:3568.5,magnitude:75.8}, {freq:4763.4,magnitude:65.6}, {freq:6358.3,magnitude:76.3}, {freq:8487.3,magnitude:71.0}, {freq:11329.2,magnitude:56.4}, {freq:15122.7,magnitude:56.0},
  {freq:20186.4,magnitude:41.7},
];

const SB13PFCR25_4_90DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:26.7,magnitude:77.3}, {freq:35.6,magnitude:80.7}, {freq:47.6,magnitude:84.1}, {freq:63.5,magnitude:86.8}, {freq:84.8,magnitude:88.7}, {freq:113.1,magnitude:90.3}, {freq:151.0,magnitude:90.9},
  {freq:201.6,magnitude:91.6}, {freq:269.1,magnitude:91.1}, {freq:359.2,magnitude:92.1}, {freq:479.5,magnitude:92.0}, {freq:630.8,magnitude:91.2}, {freq:842.0,magnitude:90.4}, {freq:1124.0,magnitude:90.1}, {freq:1500.4,magnitude:88.8},
  {freq:2002.7,magnitude:86.5}, {freq:2673.3,magnitude:81.4}, {freq:3568.5,magnitude:74.5}, {freq:4763.4,magnitude:68.3}, {freq:6358.3,magnitude:76.4}, {freq:8487.3,magnitude:71.0}, {freq:11329.2,magnitude:57.6}, {freq:15122.7,magnitude:57.0},
  {freq:20186.4,magnitude:41.7},
];

// Purifi PTT5.25X08-NFA-01: 5.25" ultra-low distortion midbass, 8 Ω, 84.7 dB.
// 475-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points.
// Measured off-axis: 30° and 60° only (others marked "est." in source).
const PURIFI_PTT5_25X08_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:55.7}, {freq:23.8,magnitude:64.9}, {freq:28.3,magnitude:68.6}, {freq:33.6,magnitude:70.5}, {freq:40.6,magnitude:72.1}, {freq:48.3,magnitude:73.5}, {freq:57.4,magnitude:75.8}, {freq:68.3,magnitude:77.9},
  {freq:81.2,magnitude:79.3}, {freq:96.5,magnitude:81.7}, {freq:116.5,magnitude:82.9}, {freq:138.5,magnitude:82.7}, {freq:164.7,magnitude:83.3}, {freq:195.8,magnitude:83.8}, {freq:232.9,magnitude:84.5}, {freq:277.0,magnitude:84.5},
  {freq:329.4,magnitude:84.3}, {freq:397.4,magnitude:85.4}, {freq:472.6,magnitude:85.6}, {freq:562.0,magnitude:85.2}, {freq:668.3,magnitude:84.9}, {freq:794.8,magnitude:83.7}, {freq:945.2,magnitude:83.4}, {freq:1140.4,magnitude:82.1},
  {freq:1356.1,magnitude:83.1}, {freq:1612.7,magnitude:83.6}, {freq:1917.8,magnitude:82.9}, {freq:2280.7,magnitude:82.6}, {freq:2712.2,magnitude:83.0}, {freq:3225.4,magnitude:83.1}, {freq:3891.5,magnitude:85.2}, {freq:4627.7,magnitude:87.0},
  {freq:5503.4,magnitude:81.5}, {freq:6544.6,magnitude:77.8}, {freq:7782.9,magnitude:73.1}, {freq:9255.5,magnitude:69.6}, {freq:11166.8,magnitude:65.5}, {freq:13279.6,magnitude:67.1}, {freq:15792.2,magnitude:61.3}, {freq:18780.2,magnitude:52.0},
];

const PURIFI_PTT5_25X08_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:55.7}, {freq:26.7,magnitude:67.7}, {freq:35.1,magnitude:70.9}, {freq:46.9,magnitude:73.3}, {freq:62.6,magnitude:77.0}, {freq:83.5,magnitude:79.7}, {freq:109.9,magnitude:82.8}, {freq:146.7,magnitude:82.9},
  {freq:195.8,magnitude:83.8}, {freq:261.4,magnitude:84.4}, {freq:344.0,magnitude:84.1}, {freq:459.1,magnitude:85.3}, {freq:612.9,magnitude:85.2}, {freq:818.1,magnitude:83.6}, {freq:1076.3,magnitude:82.2}, {freq:1436.8,magnitude:82.6},
  {freq:1917.8,magnitude:81.9}, {freq:2560.0,magnitude:80.9}, {freq:3368.2,magnitude:80.7}, {freq:4496.0,magnitude:84.4}, {freq:6001.4,magnitude:70.5}, {freq:8011.0,magnitude:63.8}, {freq:10540.1,magnitude:55.2}, {freq:14069.3,magnitude:56.6},
  {freq:18780.2,magnitude:55.9},
];

const PURIFI_PTT5_25X08_60DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:55.7}, {freq:26.7,magnitude:67.7}, {freq:35.1,magnitude:70.9}, {freq:46.9,magnitude:73.3}, {freq:62.6,magnitude:77.0}, {freq:83.5,magnitude:79.7}, {freq:109.9,magnitude:82.8}, {freq:146.7,magnitude:82.9},
  {freq:195.8,magnitude:83.8}, {freq:261.4,magnitude:84.4}, {freq:344.0,magnitude:84.1}, {freq:459.1,magnitude:85.3}, {freq:612.9,magnitude:85.2}, {freq:818.1,magnitude:83.6}, {freq:1076.3,magnitude:81.4}, {freq:1436.8,magnitude:81.7},
  {freq:1917.8,magnitude:80.6}, {freq:2560.0,magnitude:78.0}, {freq:3368.2,magnitude:76.4}, {freq:4496.0,magnitude:75.0}, {freq:6001.4,magnitude:61.0}, {freq:8011.0,magnitude:60.7}, {freq:10540.1,magnitude:52.6}, {freq:14069.3,magnitude:52.6},
  {freq:18780.2,magnitude:52.6},
];

// Dayton Audio DC28F-8: 1-1/8" silk dome tweeter, 8 Ω, 89 dB.
// 480-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points.
// Measured off-axis: 15°, 30°, 45° (others marked "est." in source).
const DAYTON_DC28F_8_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:64.9}, {freq:23.8,magnitude:74.6}, {freq:28.7,magnitude:48.4}, {freq:34.1,magnitude:40.4}, {freq:40.6,magnitude:59.3}, {freq:48.3,magnitude:56.1}, {freq:58.2,magnitude:51.0}, {freq:69.2,magnitude:46.7},
  {freq:82.3,magnitude:30.1}, {freq:99.3,magnitude:56.0}, {freq:118.1,magnitude:60.9}, {freq:140.5,magnitude:62.9}, {freq:167.1,magnitude:65.6}, {freq:201.6,magnitude:64.6}, {freq:239.7,magnitude:64.3}, {freq:285.1,magnitude:75.6},
  {freq:344.0,magnitude:73.5}, {freq:409.0,magnitude:76.5}, {freq:486.4,magnitude:79.8}, {freq:578.5,magnitude:83.0}, {freq:697.9,magnitude:83.6}, {freq:830.0,magnitude:83.3}, {freq:987.0,magnitude:85.3}, {freq:1173.8,magnitude:86.3},
  {freq:1416.2,magnitude:89.1}, {freq:1684.1,magnitude:90.6}, {freq:2002.7,magnitude:89.5}, {freq:2416.3,magnitude:89.4}, {freq:2873.5,magnitude:89.5}, {freq:3417.2,magnitude:88.2}, {freq:4063.7,magnitude:88.2}, {freq:4902.9,magnitude:87.4},
  {freq:5830.6,magnitude:88.3}, {freq:6933.8,magnitude:88.8}, {freq:8365.6,magnitude:85.8}, {freq:9948.5,magnitude:85.4}, {freq:11830.8,magnitude:89.4}, {freq:14069.3,magnitude:86.9}, {freq:16974.7,magnitude:87.0}, {freq:20186.4,magnitude:81.2},
];

const DAYTON_DC28F_8_15DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:70.8}, {freq:26.7,magnitude:64.3}, {freq:35.6,magnitude:54.3}, {freq:47.6,magnitude:62.7}, {freq:63.5,magnitude:59.1}, {freq:84.8,magnitude:53.4}, {freq:113.1,magnitude:58.8}, {freq:151.0,magnitude:63.5},
  {freq:201.6,magnitude:66.3}, {freq:269.1,magnitude:73.2}, {freq:359.2,magnitude:76.2}, {freq:479.5,magnitude:79.8}, {freq:630.8,magnitude:83.3}, {freq:842.0,magnitude:83.3}, {freq:1124.0,magnitude:86.0}, {freq:1500.4,magnitude:89.6},
  {freq:2002.7,magnitude:90.0}, {freq:2673.3,magnitude:89.8}, {freq:3568.5,magnitude:87.5}, {freq:4763.4,magnitude:86.8}, {freq:6358.3,magnitude:87.8}, {freq:8487.3,magnitude:85.1}, {freq:11329.2,magnitude:85.4}, {freq:15122.7,magnitude:86.3},
  {freq:20186.4,magnitude:77.8},
];

const DAYTON_DC28F_8_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:69.8}, {freq:26.7,magnitude:67.7}, {freq:35.6,magnitude:58.5}, {freq:47.6,magnitude:61.6}, {freq:63.5,magnitude:60.9}, {freq:84.8,magnitude:53.3}, {freq:113.1,magnitude:55.0}, {freq:151.0,magnitude:64.3},
  {freq:201.6,magnitude:66.5}, {freq:269.1,magnitude:71.6}, {freq:359.2,magnitude:75.9}, {freq:479.5,magnitude:79.4}, {freq:630.8,magnitude:82.9}, {freq:842.0,magnitude:83.3}, {freq:1124.0,magnitude:86.6}, {freq:1500.4,magnitude:89.4},
  {freq:2002.7,magnitude:90.0}, {freq:2673.3,magnitude:90.3}, {freq:3568.5,magnitude:87.3}, {freq:4763.4,magnitude:86.0}, {freq:6358.3,magnitude:86.7}, {freq:8487.3,magnitude:83.5}, {freq:11329.2,magnitude:84.6}, {freq:15122.7,magnitude:82.7},
  {freq:20186.4,magnitude:68.1},
];

const DAYTON_DC28F_8_45DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:70.9}, {freq:26.7,magnitude:65.8}, {freq:35.6,magnitude:47.2}, {freq:47.6,magnitude:62.8}, {freq:63.5,magnitude:58.0}, {freq:84.8,magnitude:57.1}, {freq:113.1,magnitude:56.3}, {freq:151.0,magnitude:62.6},
  {freq:201.6,magnitude:66.7}, {freq:269.1,magnitude:72.2}, {freq:359.2,magnitude:74.6}, {freq:479.5,magnitude:80.4}, {freq:630.8,magnitude:83.4}, {freq:842.0,magnitude:83.1}, {freq:1124.0,magnitude:86.1}, {freq:1500.4,magnitude:89.6},
  {freq:2002.7,magnitude:89.5}, {freq:2673.3,magnitude:89.6}, {freq:3568.5,magnitude:87.4}, {freq:4763.4,magnitude:86.4}, {freq:6358.3,magnitude:84.7}, {freq:8487.3,magnitude:80.7}, {freq:11329.2,magnitude:82.1}, {freq:15122.7,magnitude:78.8},
  {freq:20186.4,magnitude:62.7},
];

// Dayton Audio DC130BS-8: 5-1/4" classic shielded woofer, 8 Ω, 86 dB.
// 480-point Plotly curves, subsampled to ~40 on-axis / ~25 off-axis points.
// Measured off-axis: 15°, 30°, 45° (others marked "est." in source).
const DAYTON_DC130BS_8_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:60.4}, {freq:23.8,magnitude:65.6}, {freq:28.7,magnitude:69.9}, {freq:34.1,magnitude:74.8}, {freq:40.6,magnitude:77.9}, {freq:48.3,magnitude:78.8}, {freq:58.2,magnitude:81.7}, {freq:69.2,magnitude:82.6},
  {freq:82.3,magnitude:85.0}, {freq:99.3,magnitude:86.5}, {freq:118.1,magnitude:87.2}, {freq:140.5,magnitude:87.2}, {freq:167.1,magnitude:87.6}, {freq:201.6,magnitude:88.1}, {freq:239.7,magnitude:88.3}, {freq:285.1,magnitude:88.2},
  {freq:344.0,magnitude:88.1}, {freq:409.0,magnitude:87.9}, {freq:486.4,magnitude:88.1}, {freq:578.5,magnitude:88.0}, {freq:697.9,magnitude:88.2}, {freq:830.0,magnitude:88.4}, {freq:987.0,magnitude:88.7}, {freq:1173.8,magnitude:88.8},
  {freq:1416.2,magnitude:88.7}, {freq:1684.1,magnitude:88.4}, {freq:2002.7,magnitude:89.1}, {freq:2416.3,magnitude:90.1}, {freq:2873.5,magnitude:94.2}, {freq:3417.2,magnitude:94.9}, {freq:4063.7,magnitude:93.2}, {freq:4902.9,magnitude:86.2},
  {freq:5830.6,magnitude:81.5}, {freq:6933.8,magnitude:77.1}, {freq:8365.6,magnitude:74.5}, {freq:9948.5,magnitude:68.4}, {freq:11830.8,magnitude:53.4}, {freq:14069.3,magnitude:53.5}, {freq:16974.7,magnitude:57.0}, {freq:20186.4,magnitude:44.9},
];

const DAYTON_DC130BS_8_15DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:60.4}, {freq:26.7,magnitude:67.7}, {freq:35.6,magnitude:75.8}, {freq:47.6,magnitude:78.7}, {freq:63.5,magnitude:82.9}, {freq:84.8,magnitude:84.6}, {freq:113.1,magnitude:86.8}, {freq:151.0,magnitude:87.7},
  {freq:201.6,magnitude:88.1}, {freq:269.1,magnitude:88.2}, {freq:359.2,magnitude:88.0}, {freq:479.5,magnitude:87.8}, {freq:630.8,magnitude:88.7}, {freq:842.0,magnitude:88.5}, {freq:1124.0,magnitude:88.7}, {freq:1500.4,magnitude:89.1},
  {freq:2002.7,magnitude:89.5}, {freq:2673.3,magnitude:92.1}, {freq:3568.5,magnitude:93.6}, {freq:4763.4,magnitude:87.1}, {freq:6358.3,magnitude:76.5}, {freq:8487.3,magnitude:75.3}, {freq:11329.2,magnitude:59.1}, {freq:15122.7,magnitude:50.9},
  {freq:20186.4,magnitude:45.2},
];

const DAYTON_DC130BS_8_30DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:60.4}, {freq:26.7,magnitude:67.7}, {freq:35.6,magnitude:75.8}, {freq:47.6,magnitude:78.7}, {freq:63.5,magnitude:82.9}, {freq:84.8,magnitude:84.6}, {freq:113.1,magnitude:86.8}, {freq:151.0,magnitude:87.7},
  {freq:201.6,magnitude:88.1}, {freq:269.1,magnitude:88.2}, {freq:359.2,magnitude:88.0}, {freq:479.5,magnitude:87.6}, {freq:630.8,magnitude:88.6}, {freq:842.0,magnitude:88.2}, {freq:1124.0,magnitude:88.4}, {freq:1500.4,magnitude:88.1},
  {freq:2002.7,magnitude:89.1}, {freq:2673.3,magnitude:91.1}, {freq:3568.5,magnitude:90.5}, {freq:4763.4,magnitude:83.0}, {freq:6358.3,magnitude:72.2}, {freq:8487.3,magnitude:68.8}, {freq:11329.2,magnitude:48.5}, {freq:15122.7,magnitude:48.0},
  {freq:20186.4,magnitude:45.6},
];

const DAYTON_DC130BS_8_45DEG: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:60.4}, {freq:26.7,magnitude:67.7}, {freq:35.6,magnitude:75.8}, {freq:47.6,magnitude:78.7}, {freq:63.5,magnitude:82.9}, {freq:84.8,magnitude:84.6}, {freq:113.1,magnitude:86.8}, {freq:151.0,magnitude:87.7},
  {freq:201.6,magnitude:88.1}, {freq:269.1,magnitude:88.2}, {freq:359.2,magnitude:88.0}, {freq:479.5,magnitude:87.8}, {freq:630.8,magnitude:88.5}, {freq:842.0,magnitude:87.9}, {freq:1124.0,magnitude:88.0}, {freq:1500.4,magnitude:87.7},
  {freq:2002.7,magnitude:88.5}, {freq:2673.3,magnitude:89.0}, {freq:3568.5,magnitude:87.1}, {freq:4763.4,magnitude:79.0}, {freq:6358.3,magnitude:64.6}, {freq:8487.3,magnitude:60.7}, {freq:11329.2,magnitude:48.9}, {freq:15122.7,magnitude:40.8},
  {freq:20186.4,magnitude:44.4},
];

// Dayton RS225-8 frequency response — digitized from Dayton Audio PDF datasheet
// 8" Reference woofer, 8 Ω, 86.8 dB. On-axis 0° curve (black in PDF).
// Flat plateau to ~2 kHz, breakup peak ~3 kHz, roll-off above.
const DAYTON_RS225_8_ONAXIS: FrequencyDataPoint[] = [
  {freq:20,magnitude:72}, {freq:25,magnitude:78}, {freq:30,magnitude:82}, {freq:35,magnitude:84},
  {freq:40,magnitude:85.5}, {freq:50,magnitude:86.2}, {freq:60,magnitude:86.5}, {freq:75,magnitude:86.7},
  {freq:100,magnitude:86.8}, {freq:150,magnitude:86.8}, {freq:200,magnitude:86.7}, {freq:300,magnitude:86.8},
  {freq:500,magnitude:86.9}, {freq:700,magnitude:87.0}, {freq:1000,magnitude:87.1}, {freq:1500,magnitude:87.3},
  {freq:2000,magnitude:87.5}, {freq:2500,magnitude:88.2}, {freq:3000,magnitude:89.0}, {freq:3500,magnitude:87.5},
  {freq:4000,magnitude:85.0}, {freq:5000,magnitude:82.5}, {freq:6000,magnitude:79.0}, {freq:7000,magnitude:76.0},
  {freq:8000,magnitude:73.5}, {freq:10000,magnitude:70.0}, {freq:12000,magnitude:67.0}, {freq:15000,magnitude:64.0},
  {freq:20000,magnitude:60.0},
];

// Dayton RS270S-8 frequency response — digitized from Dayton Audio PDF datasheet
// 10" Reference woofer, 8 Ω, 88.7 dB. On-axis 0° curve (black in PDF).
// Flat plateau to ~1.5 kHz, roll-off above.
const DAYTON_RS270S_8_ONAXIS: FrequencyDataPoint[] = [
  {freq:20,magnitude:74}, {freq:25,magnitude:80}, {freq:30,magnitude:84}, {freq:35,magnitude:86},
  {freq:40,magnitude:87.5}, {freq:50,magnitude:88.2}, {freq:60,magnitude:88.5}, {freq:75,magnitude:88.6},
  {freq:100,magnitude:88.7}, {freq:150,magnitude:88.6}, {freq:200,magnitude:88.5}, {freq:300,magnitude:88.7},
  {freq:500,magnitude:88.8}, {freq:700,magnitude:88.9}, {freq:1000,magnitude:89.0}, {freq:1200,magnitude:89.3},
  {freq:1500,magnitude:89.5}, {freq:1800,magnitude:88.8}, {freq:2000,magnitude:87.0}, {freq:2500,magnitude:84.0},
  {freq:3000,magnitude:81.0}, {freq:4000,magnitude:77.0}, {freq:5000,magnitude:74.0}, {freq:6000,magnitude:71.5},
  {freq:8000,magnitude:68.0}, {freq:10000,magnitude:65.0}, {freq:12000,magnitude:62.0}, {freq:15000,magnitude:59.0},
  {freq:20000,magnitude:55.0},
];

// Dayton ND28F-4 frequency response — digitized from Dayton Audio PDF datasheet
// 1-1/8" Neodymium dome tweeter. Fs ~1100 Hz, 88.4 dB (ND28F-6 datasheet used as proxy).
// On-axis 0° curve (black in PDF). Flat from 2 kHz to 20 kHz.
const DAYTON_ND28F_4_ONAXIS: FrequencyDataPoint[] = [
  {freq:500,magnitude:72}, {freq:700,magnitude:78}, {freq:900,magnitude:83}, {freq:1100,magnitude:86},
  {freq:1300,magnitude:87.5}, {freq:1600,magnitude:88.2}, {freq:2000,magnitude:88.4}, {freq:2500,magnitude:88.5},
  {freq:3000,magnitude:88.4}, {freq:4000,magnitude:88.5}, {freq:5000,magnitude:88.6}, {freq:6000,magnitude:88.4},
  {freq:7000,magnitude:88.3}, {freq:8000,magnitude:88.5}, {freq:10000,magnitude:88.2}, {freq:12000,magnitude:87.8},
  {freq:15000,magnitude:87.0}, {freq:18000,magnitude:86.0}, {freq:20000,magnitude:85.0}, {freq:25000,magnitude:82.0},
  {freq:30000,magnitude:78.0}, {freq:35000,magnitude:74.0}, {freq:40000,magnitude:70.0},
];

// ScanSpeak 22W/8851T00 frequency response — digitized from Scan-Speak PDF datasheet
// Revelator 22cm woofer, 8 Ω, 88 dB. On-axis curve (red in PDF).
// Flat to ~1 kHz, cone breakup roll-off above.
const SCANSPEAK_22W_8851T00_ONAXIS: FrequencyDataPoint[] = [
  {freq:10,magnitude:68}, {freq:12,magnitude:72}, {freq:15,magnitude:76}, {freq:18,magnitude:79},
  {freq:21,magnitude:82}, {freq:25,magnitude:84}, {freq:30,magnitude:85.5}, {freq:40,magnitude:86.8},
  {freq:50,magnitude:87.4}, {freq:60,magnitude:87.7}, {freq:80,magnitude:87.9}, {freq:100,magnitude:88.0},
  {freq:150,magnitude:88.1}, {freq:200,magnitude:88.0}, {freq:300,magnitude:88.0}, {freq:500,magnitude:87.9},
  {freq:700,magnitude:87.8}, {freq:1000,magnitude:87.5}, {freq:1200,magnitude:87.0}, {freq:1500,magnitude:86.0},
  {freq:2000,magnitude:84.0}, {freq:2500,magnitude:81.0}, {freq:3000,magnitude:78.0}, {freq:4000,magnitude:74.0},
  {freq:5000,magnitude:71.0}, {freq:7000,magnitude:67.0}, {freq:10000,magnitude:63.0}, {freq:15000,magnitude:58.0},
  {freq:20000,magnitude:54.0},
];

// ScanSpeak 12MU/4731T00 frequency response — digitized from Scan-Speak PDF datasheet
// Illuminator 4.5" midrange, 4 Ω, 90 dB. On-axis curve (red in PDF).
// Flat 90-92 dB plateau to ~2 kHz, roll-off above with breakup.
const SCANSPEAK_12MU_4731T00_ONAXIS: FrequencyDataPoint[] = [
  {freq:10.0,magnitude:91.6}, {freq:12.8,magnitude:92.1}, {freq:16.5,magnitude:91.5}, {freq:21.2,magnitude:92.0},
  {freq:27.2,magnitude:92.2}, {freq:45.0,magnitude:91.9}, {freq:74.2,magnitude:92.0}, {freq:95.3,magnitude:91.8},
  {freq:122.4,magnitude:92.0}, {freq:157.3,magnitude:92.5}, {freq:202.1,magnitude:92.6}, {freq:259.6,magnitude:91.4},
  {freq:333.5,magnitude:90.9}, {freq:428.4,magnitude:91.3}, {freq:550.4,magnitude:90.6}, {freq:707.1,magnitude:90.1},
  {freq:908.4,magnitude:90.0}, {freq:1167.0,magnitude:89.8}, {freq:1499.2,magnitude:89.0}, {freq:1926.0,magnitude:88.4},
  {freq:3178.7,magnitude:84.2}, {freq:4083.5,magnitude:84.4}, {freq:5246.0,magnitude:84.4}, {freq:6739.4,magnitude:82.0},
  {freq:8658.0,magnitude:78.6}, {freq:11122.7,magnitude:78.6}, {freq:14289.1,magnitude:79.5}, {freq:18356.8,magnitude:83.0},
  {freq:23582.5,magnitude:77.6}, {freq:30295.9,magnitude:78.5}, {freq:38920.4,magnitude:77.0}, {freq:50000.0,magnitude:74.6},
];

// ScanSpeak D3004/602000 frequency response — digitized from Scan-Speak PDF datasheet
// Illuminator 26mm textile dome tweeter, 4 Ω, 89 dB. On-axis curve (red in PDF).
// Fs peak ~170 Hz, flat 89-91 dB from 2-10 kHz, roll-off above.
const SCANSPEAK_D3004_602000_ONAXIS: FrequencyDataPoint[] = [
  {freq:100.0,magnitude:88.8}, {freq:120.1,magnitude:90.8}, {freq:144.1,magnitude:92.5}, {freq:173.0,magnitude:93.2},
  {freq:207.7,magnitude:93.0}, {freq:249.4,magnitude:92.6}, {freq:299.4,magnitude:92.3}, {freq:359.5,magnitude:91.8},
  {freq:431.6,magnitude:91.2}, {freq:518.1,magnitude:90.9}, {freq:622.0,magnitude:91.0}, {freq:746.8,magnitude:90.8},
  {freq:896.6,magnitude:90.6}, {freq:1076.4,magnitude:90.5}, {freq:1551.4,magnitude:90.6}, {freq:1862.5,magnitude:90.0},
  {freq:2236.1,magnitude:89.4}, {freq:2684.5,magnitude:88.9}, {freq:3222.9,magnitude:88.8}, {freq:3869.3,magnitude:89.2},
  {freq:4645.3,magnitude:89.0}, {freq:5576.9,magnitude:88.7}, {freq:6695.4,magnitude:88.5}, {freq:8038.1,magnitude:87.4},
  {freq:9650.2,magnitude:86.2}, {freq:11585.6,magnitude:84.8}, {freq:13909.1,magnitude:80.9}, {freq:16698.6,magnitude:78.8},
  {freq:20047.6,magnitude:78.8}, {freq:24068.2,magnitude:78.8}, {freq:28895.2,magnitude:78.4}, {freq:34690.2,magnitude:78.4},
  {freq:41647.5,magnitude:78.2}, {freq:50000.0,magnitude:73.6},
];

// ScanSpeak D2905/990000 frequency response — digitized from Scan-Speak PDF datasheet
// Revelator 28mm dome tweeter, 6 Ω, 91 dB. On-axis curve (red in PDF).
// Fs ~500 Hz, flat 91 dB from 2-10 kHz, roll-off above.
const SCANSPEAK_D2905_990000_ONAXIS: FrequencyDataPoint[] = [
  {freq:100,magnitude:72}, {freq:150,magnitude:76}, {freq:200,magnitude:80}, {freq:250,magnitude:83},
  {freq:300,magnitude:85}, {freq:400,magnitude:87}, {freq:500,magnitude:88}, {freq:700,magnitude:89.5},
  {freq:1000,magnitude:90.5}, {freq:1500,magnitude:91.0}, {freq:2000,magnitude:91.2}, {freq:2500,magnitude:91.0},
  {freq:3000,magnitude:91.0}, {freq:4000,magnitude:91.0}, {freq:5000,magnitude:91.0}, {freq:6000,magnitude:91.0},
  {freq:8000,magnitude:90.8}, {freq:10000,magnitude:90.5}, {freq:12000,magnitude:90.0}, {freq:15000,magnitude:88.5},
  {freq:18000,magnitude:87.0}, {freq:20000,magnitude:86.0}, {freq:25000,magnitude:83.0}, {freq:30000,magnitude:80.0},
  {freq:40000,magnitude:75.0}, {freq:50000,magnitude:71.0},
];

// SB Acoustics SB34NRX75-6 frequency response — digitized from SB Acoustics PDF datasheet
// 12" Norex woofer, 6 Ω, 90 dB. On-axis curve (blue in PDF), upper graph only.
// Flat ~88-90 dB to ~2 kHz, irregular breakup above.
const SB_ACOUSTICS_SB34NRX75_6_ONAXIS: FrequencyDataPoint[] = [
  {freq:10.0,magnitude:76.1}, {freq:12.3,magnitude:76.0}, {freq:15.0,magnitude:85.6}, {freq:18.4,magnitude:86.3},
  {freq:22.5,magnitude:87.1}, {freq:27.6,magnitude:87.8}, {freq:33.8,magnitude:88.4}, {freq:50.8,magnitude:89.1},
  {freq:62.2,magnitude:90.3}, {freq:76.3,magnitude:89.5}, {freq:93.5,magnitude:90.0}, {freq:114.5,magnitude:90.4},
  {freq:140.3,magnitude:88.6}, {freq:171.9,magnitude:88.2}, {freq:210.6,magnitude:88.3}, {freq:258.1,magnitude:88.7},
  {freq:316.2,magnitude:87.0}, {freq:387.5,magnitude:88.1}, {freq:474.8,magnitude:88.1}, {freq:581.7,magnitude:87.9},
  {freq:712.8,magnitude:86.7}, {freq:873.3,magnitude:87.7}, {freq:1070.1,magnitude:87.3}, {freq:1311.1,magnitude:86.2},
  {freq:1606.5,magnitude:84.9}, {freq:1968.4,magnitude:83.3}, {freq:2411.9,magnitude:86.1}, {freq:2955.2,magnitude:88.2},
  {freq:3621.0,magnitude:87.1}, {freq:4436.7,magnitude:84.6}, {freq:5436.2,magnitude:86.2}, {freq:6660.8,magnitude:84.1},
  {freq:8161.4,magnitude:82.0}, {freq:10000.0,magnitude:75.7},
];

// SB Acoustics SB12NRX25-4 frequency response — digitized from SB Acoustics PDF datasheet
// 4" Norex midbass, 4 Ω, 87.5 dB. On-axis curve (blue in PDF), upper graph only.
// Fs ~55 Hz, flat 87-89 dB to ~7 kHz, roll-off above.
const SB_ACOUSTICS_SB12NRX25_4_ONAXIS: FrequencyDataPoint[] = [
  {freq:20.0,magnitude:72.9}, {freq:24.5,magnitude:74.8}, {freq:30.0,magnitude:77.4}, {freq:36.8,magnitude:78.8},
  {freq:45.1,magnitude:80.9}, {freq:67.7,magnitude:84.1}, {freq:82.9,magnitude:85.0}, {freq:101.6,magnitude:88.5},
  {freq:124.5,magnitude:88.5}, {freq:152.5,magnitude:89.3}, {freq:186.9,magnitude:87.1}, {freq:229.0,magnitude:87.9},
  {freq:280.6,magnitude:86.8}, {freq:343.8,magnitude:87.3}, {freq:421.3,magnitude:86.9}, {freq:516.2,magnitude:87.5},
  {freq:632.5,magnitude:87.1}, {freq:774.9,magnitude:87.9}, {freq:949.5,magnitude:87.5}, {freq:1163.4,magnitude:87.3},
  {freq:1425.5,magnitude:85.4}, {freq:1746.7,magnitude:85.0}, {freq:2140.1,magnitude:86.3}, {freq:2622.3,magnitude:87.5},
  {freq:3213.0,magnitude:87.9}, {freq:3936.8,magnitude:88.4}, {freq:4823.7,magnitude:89.2}, {freq:5910.4,magnitude:89.5},
  {freq:7241.9,magnitude:89.0}, {freq:8873.4,magnitude:88.2}, {freq:10872.4,magnitude:83.8}, {freq:13321.7,magnitude:83.9},
  {freq:16322.8,magnitude:79.2}, {freq:20000.0,magnitude:76.1},
];

// SB Acoustics SB29RDC-C000-4 frequency response — digitized from SB Acoustics PDF datasheet
// 1.1" fabric dome tweeter, 4 Ω, 93 dB. On-axis curve (blue in PDF), upper graph only.
// Fs ~600 Hz, flat 93 dB from 1-20 kHz, gentle roll-off above.
const SB_ACOUSTICS_TWEETER_ONAXIS: FrequencyDataPoint[] = [
  {freq:100.0,magnitude:77.1}, {freq:120.1,magnitude:78.7}, {freq:144.1,magnitude:80.2}, {freq:173.0,magnitude:82.0},
  {freq:207.7,magnitude:83.6}, {freq:249.4,magnitude:85.1}, {freq:299.4,magnitude:86.7}, {freq:359.5,magnitude:88.5},
  {freq:431.6,magnitude:89.3}, {freq:896.6,magnitude:93.1}, {freq:1076.4,magnitude:93.0}, {freq:1551.4,magnitude:93.7},
  {freq:1862.5,magnitude:93.1}, {freq:2236.1,magnitude:93.1}, {freq:3222.9,magnitude:92.7}, {freq:3869.3,magnitude:93.0},
  {freq:4645.3,magnitude:93.0}, {freq:5576.9,magnitude:92.7}, {freq:6695.4,magnitude:92.8}, {freq:8038.1,magnitude:92.6},
  {freq:9650.2,magnitude:92.5}, {freq:11585.6,magnitude:92.6}, {freq:13909.1,magnitude:93.4}, {freq:16699.6,magnitude:93.4},
  {freq:20047.6,magnitude:92.7}, {freq:24068.2,magnitude:92.8}, {freq:28895.2,magnitude:92.2}, {freq:34690.2,magnitude:91.1},
  {freq:41647.5,magnitude:90.9}, {freq:50000.0,magnitude:89.2},
];

// Markaudio Alpair 7MS frequency response — digitized from Markaudio PDF datasheet
// 4" fullrange, 8 Ω, 86.3 dB. SPL curve (orange in PDF).
// Fs ~75 Hz, flat 86-88 dB to ~10 kHz, gradual roll-off to 30 kHz.
const MARKAUDIO_ALPAIR_7MS_ONAXIS: FrequencyDataPoint[] = [
  {freq:20,magnitude:64}, {freq:30,magnitude:72}, {freq:40,magnitude:77}, {freq:50,magnitude:80},
  {freq:60,magnitude:82.5}, {freq:75,magnitude:84}, {freq:100,magnitude:85.5}, {freq:150,magnitude:86.0},
  {freq:200,magnitude:86.2}, {freq:300,magnitude:86.3}, {freq:500,magnitude:86.3}, {freq:700,magnitude:86.4},
  {freq:1000,magnitude:86.5}, {freq:1500,magnitude:86.8}, {freq:2000,magnitude:87.0}, {freq:3000,magnitude:87.3},
  {freq:4000,magnitude:87.5}, {freq:5000,magnitude:87.8}, {freq:6000,magnitude:88.0}, {freq:7000,magnitude:87.8},
  {freq:8000,magnitude:87.5}, {freq:10000,magnitude:86.5}, {freq:12000,magnitude:85.5}, {freq:15000,magnitude:84.0},
  {freq:18000,magnitude:82.0}, {freq:20000,magnitude:80.0}, {freq:25000,magnitude:76.0}, {freq:30000,magnitude:72.0},
  {freq:35000,magnitude:68.0}, {freq:40000,magnitude:64.0},
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

  // GRS 12SMP-4 — 12" surface-mount poly cone bass-midwoofer, 4 Ω.
  // Measured frequency response from loudspeakerlab.com (480-point on-axis +
  // off-axis 15/30/45 degrees). Fs 28 Hz, Qts 0.51, Vas 132 L, 91.9 dB.
  // Shallow-profile frame for surface-mount, 50 mm voice coil, copper cap.
  {
    id: 'seed-grs-12smp-4',
    manufacturer: 'GRS',
    model: '12SMP-4',
    type: 'woofer',
    tsParams: {
      fs: 28, re: 3.9, qms: 3.1, qes: 0.61, qts: 0.51, vas: 132,
      sensitivity: 91.9, xmax: 5.5, sd: 516, sdM2: 0.0516, vd: 2838,
      imp: 4, pe: 90, bl: 10.2, mms: 93, cms: 0.35, le: 0.41,
    },
    dimensions: {
      overallDiameter: 332, cutoutDiameter: 284, mountingDepth: 136,
      magnetDiameter: 145, magnetDepth: 50, weight: 3500,
    },
    frequencyResponse: GRS_12SMP_4_ONAXIS,
    offAxis: [
      { angle: 15, curve: GRS_12SMP_4_15DEG },
      { angle: 30, curve: GRS_12SMP_4_30DEG },
      { angle: 45, curve: GRS_12SMP_4_45DEG },
    ],
    datasheetUrl: 'https://www.soundimports.eu/en/grs-12smp-4.html',
    notes: '12" surface-mount poly cone bass-midwoofer. Damped poly cone + rubber surround, copper cap on pole piece, vented pole piece + aluminum VC former. Shallow-profile steel frame for surface-mount. Frekvensrespons fra loudspeakerlab.com reelle målinger (480-punkt on-axis + off-axis 15/30/45 grader). Fs 28 Hz, Qts 0.51, Vas 132 L, Bl 10.2 Tm, Mms 93 g. 90 W RMS, 50 mm svingspole.',
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
    frequencyResponse: DAYTON_RS225_8_ONAXIS,
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
    frequencyResponse: DAYTON_RS270S_8_ONAXIS,
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
    frequencyResponse: SCANSPEAK_22W_8851T00_ONAXIS,
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
    frequencyResponse: SB_ACOUSTICS_SB34NRX75_6_ONAXIS,
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
    frequencyResponse: SCANSPEAK_12MU_4731T00_ONAXIS,
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
    frequencyResponse: SB_ACOUSTICS_SB12NRX25_4_ONAXIS,
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
    frequencyResponse: MARKAUDIO_ALPAIR_7MS_ONAXIS,
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
    frequencyResponse: SCANSPEAK_D3004_602000_ONAXIS,
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
    frequencyResponse: SCANSPEAK_D2905_990000_ONAXIS,
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
    frequencyResponse: DAYTON_ND28F_4_ONAXIS,
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
    frequencyResponse: SB_ACOUSTICS_TWEETER_ONAXIS,
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
    offAxis: [
      { angle: 30, curve: VIFA_BC25TG15_30DEG },
      { angle: 60, curve: VIFA_BC25TG15_60DEG },
    ],
    datasheetUrl: 'https://www.madisoundspeakerstore.com/vifa-soft-dome-tweeters/vifa-bc25tg15-04-1-textile-dome-tweeter/',
    notes: '1" (25.4mm) fabric dome, ferrofluid cooled, ferrite magnet. Fs 1100 Hz, sensitivity 93.9 dB (2.83V). Tidligere brugt i Kudos X2 kabinet med Wavecor WF146WA01/02. Mulig oprindelig delefrekvens op mod 4900 Hz (Kudos passivt design) — overskrider Wavecor max 3.5 kHz. Frekvensrespons fra loudspeakerlab.com reelle målinger (321-punkt on-axis + off-axis 30/60 grader). Sources: loudspeakerlab.com, datasheet PDF, HiFiCompass, Madisound.',
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

  // ===== Batch 2: new drivers from loudspeakerlab.com measured data =====

  // SB Acoustics SB19ST-C000-4 — 3/4" textile dome tweeter, 4 Ω, 88.5 dB.
  // Real measured on-axis + off-axis 30°/60° from loudspeakerlab.com.
  // Fs 980 Hz, Re 3.4 Ω, Sd 3.8 cm², 19 mm CCAW voice coil, 88 mm faceplate.
  {
    id: 'seed-sb-acoustics-sb19st-c000-4',
    manufacturer: 'SB Acoustics',
    model: 'SB19ST-C000-4',
    type: 'tweeter',
    tsParams: {
      fs: 980, re: 3.4, qms: 1.2, qes: 1.0, qts: 0.55, vas: 0.01,
      sensitivity: 88.5, xmax: 0.6, sd: 3.8, sdM2: 0.00038, vd: 2.28,
      imp: 4, pe: 30, le: 0.07,
    },
    dimensions: {
      overallDiameter: 88, cutoutDiameter: 36, mountingDepth: 15,
      magnetDiameter: 50, magnetDepth: 12, weight: 120,
    },
    frequencyResponse: SB19ST_C000_ONAXIS,
    offAxis: [
      { angle: 30, curve: SB19ST_C000_30DEG },
      { angle: 60, curve: SB19ST_C000_60DEG },
    ],
    datasheetUrl: 'https://sbacoustics.com/wp-content/uploads/2020/05/SB19ST-C000-4.pdf',
    notes: '3/4" tekstil dome diskant. Damped pole cavity, fine weave soft fabric dome, CCAW svingspole, silver lead wires. Glat frekvensrespons med fremragende off-axis spredning. Fs 980 Hz, Re 3.4 Ω, Sd 3.8 cm², 19 mm svingspole. Frekvensrespons fra loudspeakerlab.com reelle målinger (367-punkt on-axis + off-axis 30/60 grader).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // SB Acoustics SB13PFCR25-4 — 5" fiber cone midbass, 4 Ω, 89 dB.
  // Real measured on-axis + full 10-90° off-axis from loudspeakerlab.com.
  // Fs 44 Hz, Qts 0.29, Vas 9 L, Xmax 4.5 mm, Sd 87 cm², 25 mm voice coil.
  {
    id: 'seed-sb-acoustics-sb13pfcr25-4',
    manufacturer: 'SB Acoustics',
    model: 'SB13PFCR25-4',
    type: 'woofer',
    tsParams: {
      fs: 44, re: 3.2, qms: 2.6, qes: 0.33, qts: 0.29, vas: 9,
      sensitivity: 89, xmax: 4.5, sd: 87, sdM2: 0.0087, vd: 391.5,
      imp: 4, pe: 80, bl: 6.2, mms: 6.5, cms: 1.35, le: 0.56,
    },
    dimensions: {
      overallDiameter: 138, cutoutDiameter: 117, mountingDepth: 58,
      magnetDiameter: 90, magnetDepth: 25, weight: 910,
    },
    frequencyResponse: SB13PFCR25_4_ONAXIS,
    offAxis: [
      { angle: 10, curve: SB13PFCR25_4_10DEG },
      { angle: 20, curve: SB13PFCR25_4_20DEG },
      { angle: 30, curve: SB13PFCR25_4_30DEG },
      { angle: 40, curve: SB13PFCR25_4_40DEG },
      { angle: 50, curve: SB13PFCR25_4_50DEG },
      { angle: 60, curve: SB13PFCR25_4_60DEG },
      { angle: 70, curve: SB13PFCR25_4_70DEG },
      { angle: 80, curve: SB13PFCR25_4_80DEG },
      { angle: 90, curve: SB13PFCR25_4_90DEG },
    ],
    datasheetUrl: 'https://sbacoustics.com/product/sb13pfcr25-4/',
    notes: '5" fiber cone midbass. Vented reinforced plastic chassis, proprietary natural fiber cone, soft rubber surround. Fs 44 Hz, Qts 0.29, Vas 9 L, Sd 87 cm², Xmax 4.5 mm, 25 mm svingspole, 80 W RMS. Frekvensrespons fra loudspeakerlab.com reelle målinger (480-punkt on-axis + fuld off-axis 10-90 grader i 10° skridt).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Purifi PTT5.25X08-NFA-01 — 5.25" ultra-low distortion midbass, 8 Ω, 84.7 dB.
  // Real measured on-axis + off-axis 30°/60° from loudspeakerlab.com.
  // Fs 32 Hz, Qts 0.26, Vas 13 L, Xmax 9.8 mm, Sd 84.9 cm², 39 mm VC, 250 W RMS.
  {
    id: 'seed-purifi-ptt5-25x08-nfa-01',
    manufacturer: 'Purifi',
    model: 'PTT5.25X08-NFA-01',
    type: 'woofer',
    tsParams: {
      fs: 32, re: 3.8, qms: 3.5, qes: 0.28, qts: 0.26, vas: 13,
      sensitivity: 84.7, xmax: 9.8, sd: 84.9, sdM2: 0.00849, vd: 832,
      imp: 8, pe: 250, bl: 9.0, mms: 19.6, cms: 1.30, le: 0.55,
    },
    dimensions: {
      overallDiameter: 147, cutoutDiameter: 121, mountingDepth: 83,
      magnetDiameter: 100, magnetDepth: 25, weight: 1500,
    },
    frequencyResponse: PURIFI_PTT5_25X08_ONAXIS,
    offAxis: [
      { angle: 30, curve: PURIFI_PTT5_25X08_30DEG },
      { angle: 60, curve: PURIFI_PTT5_25X08_60DEG },
    ],
    datasheetUrl: 'https://www.soundimports.eu/en/purifi-ptt525x08-nfa-01.html',
    notes: '5.25" ultra-low distortion midbass. Purifi NeutralSurround + PureDrive motor. Negligible force factor modulation, ultra-low magnetic hysteresis distortion. Fs 32 Hz, Qts 0.26, Vas 13 L, Sd 84.9 cm², Xmax 9.8 mm, 39 mm svingspole (CCAW), 250 W RMS. Frekvensrespons fra loudspeakerlab.com reelle målinger (475-punkt on-axis + off-axis 30/60 grader).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Dayton Audio DC28F-8 — 1-1/8" silk dome tweeter, 8 Ω, 89 dB.
  // Real measured on-axis + off-axis 15°/30°/45° from loudspeakerlab.com.
  // Fs 834 Hz, Re 5.4 Ω, Qts 0.50, Sd 6.6 cm², 29 mm voice coil, 50 W RMS.
  {
    id: 'seed-dayton-dc28f-8',
    manufacturer: 'Dayton Audio',
    model: 'DC28F-8',
    type: 'tweeter',
    tsParams: {
      fs: 834, re: 5.4, qms: 0.81, qes: 1.33, qts: 0.50, vas: 0.02,
      sensitivity: 89, xmax: 0.5, sd: 6.6, sdM2: 0.00066, vd: 3.3,
      imp: 8, pe: 50, le: 0.09,
    },
    dimensions: {
      overallDiameter: 110, cutoutDiameter: 74, mountingDepth: 39,
      magnetDiameter: 60, magnetDepth: 25, weight: 550,
    },
    frequencyResponse: DAYTON_DC28F_8_ONAXIS,
    offAxis: [
      { angle: 15, curve: DAYTON_DC28F_8_15DEG },
      { angle: 30, curve: DAYTON_DC28F_8_30DEG },
      { angle: 45, curve: DAYTON_DC28F_8_45DEG },
    ],
    datasheetUrl: 'https://www.daytonaudio.com/product/29/dc28f-8-1-1-8-silk-dome-tweeter-8-ohm',
    notes: '1-1/8" silk dome diskant. Treated silk dome, damped rear chamber, ferrofluid cooled voice coil. Fs 834 Hz, Re 5.4 Ω, Qts 0.50, Sd 6.6 cm², 29 mm svingspole, 50 W RMS. Frekvensrespons 1300-20000 Hz. Frekvensrespons fra loudspeakerlab.com reelle målinger (480-punkt on-axis + off-axis 15/30/45 grader).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Dayton Audio DC130BS-8 — 5-1/4" classic shielded woofer, 8 Ω, 86 dB.
  // Real measured on-axis + off-axis 15°/30°/45° from loudspeakerlab.com.
  // Fs 50 Hz, Qts 0.47, Vas 9 L, Xmax 2.5 mm, Sd 91.6 cm², 60 W RMS.
  {
    id: 'seed-dayton-dc130bs-8',
    manufacturer: 'Dayton Audio',
    model: 'DC130BS-8',
    type: 'woofer',
    tsParams: {
      fs: 50, re: 6.2, qms: 2.2, qes: 0.6, qts: 0.47, vas: 9,
      sensitivity: 86, xmax: 2.5, sd: 91.6, sdM2: 0.00916, vd: 229,
      imp: 8, pe: 60, mms: 8.8,
    },
    dimensions: {
      overallDiameter: 145, cutoutDiameter: 120, mountingDepth: 77,
      magnetDiameter: 80, magnetDepth: 30, weight: 1180,
    },
    frequencyResponse: DAYTON_DC130BS_8_ONAXIS,
    offAxis: [
      { angle: 15, curve: DAYTON_DC130BS_8_15DEG },
      { angle: 30, curve: DAYTON_DC130BS_8_30DEG },
      { angle: 45, curve: DAYTON_DC130BS_8_45DEG },
    ],
    datasheetUrl: 'https://www.daytonaudio.com/product/21/dc130bs-8-5-1-4-classic-shielded-woofer-8-ohm',
    notes: '5-1/4" classic shielded woofer. Treated paper cone, rubber surround, aluminum voice coil, shielded motor. Fs 50 Hz, Qts 0.47, Vas 9 L, Sd 91.6 cm², Xmax 2.5 mm, Mms 8.8 g, 60 W RMS. Frekvensrespons til ~2 kHz. Frekvensrespons fra loudspeakerlab.com reelle målinger (480-punkt on-axis + off-axis 15/30/45 grader).',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ===== DATS-Measured parameter sets (Jul 25-26, 2026) =====
  // Archived in parameterSets on the parent seed drivers above.
  // Standalone DATS entries removed in favor of in-driver parameter set switching.
  // See: seed-grs-12sw-4he, seed-scanspeak-18w-4424g00, seed-sb26stac-c000-4
];
