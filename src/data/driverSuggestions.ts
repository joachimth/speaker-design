// Anbefalede driver-parringer og systemdesign-forslag
//
// Hjælper brugere med at finde kompatible drivere til fler-vejs systemer.
// Matching er baseret på: krydsningsfrekvens-kompatibilitet, følsomhed,
// impedans og typisk anvendelse.

import type { Driver } from '@/types';
import { SEED_DRIVERS } from './seedDrivers';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DriverMatch {
  driver: Driver;
  compatibility: 'optimal' | 'good' | 'possible' | 'mismatch';
  notes: string;
  /** Recommended crossover frequency [Hz] */
  recommendedXo?: number;
}

export interface SystemSuggestion {
  name: string;
  description: string;
  type: '2-way' | '3-way' | '2.5-way' | 'sub+sat' | 'fullrange';
  drivers: string[]; // driver IDs in order (woofer → mid → tweeter)
  recommendedXo?: string; // e.g. "2.5 kHz LR4"
  notes: string;
}

// ---------------------------------------------------------------------------
// Helper: find driver by ID
// ---------------------------------------------------------------------------

function byId(id: string): Driver | undefined {
  return SEED_DRIVERS.find((d) => d.id === id);
}

// ---------------------------------------------------------------------------
// Match tweeter to woofer (2-way)
// ---------------------------------------------------------------------------

export function findTweeterForWoofer(
  wooferId: string,
  maxFc?: number
): DriverMatch[] {
  const woofer = byId(wooferId);
  if (!woofer) return [];

  // Estimate woofer's useful top end: where response starts breaking up
  // For most woofers, usable range is 3-5x Fs before cone breakup
  const wooferF3 = woofer.tsParams.fs * 4;
  const wooferMaxXo = maxFc ?? 3500; // default max xo for tweeters

  const results: DriverMatch[] = [];
  const allTweeters = SEED_DRIVERS.filter((d) =>
    ['tweeter', 'fullrange'].includes(d.type)
  );

  for (const tw of allTweeters) {
    // Tweeter must be able to play low enough
    const twMinXo = tw.tsParams.fs * 1.3; // practical minimum: ~1.3x Fs

    // Impedance: different impedance works but changes crossover component values
    const sameImp = tw.tsParams.imp === woofer.tsParams.imp;

    // Sensitivity: match within 3 dB is good, 5 dB is possible
    const sensDiff = Math.abs(woofer.tsParams.sensitivity - tw.tsParams.sensitivity);

    // Find best crossover point
    const xoRange: [number, number] = [
      Math.max(wooferF3, twMinXo),
      Math.min(wooferMaxXo, 4000),
    ];

    let compatibility: DriverMatch['compatibility'];
    let notes: string;

    if (xoRange[0] < xoRange[1] && sensDiff <= 3) {
      compatibility = 'optimal';
      notes = `God følsomhedsmatch (${sensDiff.toFixed(1)} dB forskel). ` +
        `Krydsning ${xoRange[0].toFixed(0)}-${xoRange[1].toFixed(0)} Hz.`;
    } else if (xoRange[0] < xoRange[1] && sensDiff <= 5) {
      compatibility = 'good';
      notes = `Acceptabelt match med følsomhedsdiffernce på ${sensDiff.toFixed(1)} dB ` +
        `(kan kompenseres med dæmpning/forstærkning). ` +
        `Krydsning ${xoRange[0].toFixed(0)}-${xoRange[1].toFixed(0)} Hz.`;
    } else if (xoRange[0] < xoRange[1] * 0.5) {
      compatibility = 'possible';
      notes = `Muligt men kræver omhyggeligt crossover-design. ` +
        `Følsomhedsdiffernce: ${sensDiff.toFixed(1)} dB.`;
    } else {
      compatibility = 'mismatch';
      notes = `Ikke anbefalet — krydsningsområdet er for lille eller overlap utilstrækkeligt.`;
    }

    if (!sameImp) {
      notes += ` Impedansforskel (woofer: ${woofer.tsParams.imp}Ω, diskant: ${tw.tsParams.imp}Ω) — crossover-komponenter skal tilpasses.`;
    }

    results.push({
      driver: tw,
      compatibility,
      notes,
      recommendedXo: compatibility !== 'mismatch'
        ? Math.round((xoRange[0] + xoRange[1]) / 2)
        : undefined,
    });
  }

  return results.sort((a, b) => {
    const rank: Record<string, number> = { optimal: 0, good: 1, possible: 2, mismatch: 3 };
    return (rank[a.compatibility] ?? 99) - (rank[b.compatibility] ?? 99);
  });
}

// ---------------------------------------------------------------------------
// Match midrange for 3-way
// ---------------------------------------------------------------------------

export function findMidrangeFor3Way(
  wooferId: string,
  tweeterId: string
): DriverMatch[] {
  const woofer = byId(wooferId);
  const tweeter = byId(tweeterId);
  if (!woofer || !tweeter) return [];

  // Midrange should cover from ~200-500 Hz to 1-4 kHz
  const mids = SEED_DRIVERS.filter((d) =>
    ['midrange', 'fullrange'].includes(d.type) && d.id !== wooferId && d.id !== tweeterId
  );

  const results: DriverMatch[] = [];

  for (const mid of mids) {
    const midLowFs = mid.tsParams.fs * 1.3;
    const midHighF3 = 8000; // midrange typically usable to 5-8 kHz

    // Lower xo: between woofer and mid
    const lowXoMin = Math.max(woofer.tsParams.fs * 3, midLowFs);
    const lowXoMax = 500; // typical woofer-mid xo

    // Upper xo: between mid and tweeter
    const highXoMin = Math.max(midLowFs, tweeter.tsParams.fs * 1.3);
    const highXoMax = Math.min(midHighF3, 4000);

    const lowXoOk = lowXoMin < lowXoMax;
    const highXoOk = highXoMin < highXoMax;

    let compatibility: DriverMatch['compatibility'];
    let notes: string;

    if (lowXoOk && highXoOk) {
      compatibility = 'optimal';
      notes = `Godt match. Lav krydsning ${lowXoMin.toFixed(0)}-${lowXoMax.toFixed(0)} Hz, ` +
        `høj krydsning ${highXoMin.toFixed(0)}-${highXoMax.toFixed(0)} Hz. Følsomhed: ${mid.tsParams.sensitivity} dB.`;
    } else if (lowXoOk || highXoOk) {
      compatibility = 'good';
      notes = `Delvist match. ${lowXoOk ? 'Lav' : 'Høj'} krydsning mulig. ` +
        `${!lowXoOk ? 'Lav krydsning svær — overvej lavere woofer-krydsning.' : ''}` +
        `${!highXoOk ? 'Høj krydsning svær — overvej højere diskant-krydsning.' : ''}`;
    } else {
      compatibility = 'mismatch';
      notes = 'Mellemtone har utilstrækkeligt overlap med woofer eller diskant.';
    }

    results.push({ driver: mid, compatibility, notes });
  }

  return results.sort((a, b) => {
    const rank: Record<string, number> = { optimal: 0, good: 1, possible: 2, mismatch: 3 };
    return (rank[a.compatibility] ?? 99) - (rank[b.compatibility] ?? 99);
  });
}

// ---------------------------------------------------------------------------
// Pre-configured system suggestions
// ---------------------------------------------------------------------------

export const SYSTEM_SUGGESTIONS: SystemSuggestion[] = [
  {
    name: 'Mk2 Reference (3-way)',
    description: 'Joachims 3-vejs referencehøjttaler. GRS push-push woofer, ScanSpeak mellemtone, H2606 ringradiator i WG212 bølgeleder.',
    type: '3-way',
    drivers: ['seed-grs-8sw-4he-8', 'seed-scanspeak-15w-4434g00', 'seed-scanspeak-h2606-920000'],
    recommendedXo: '150 Hz LR4 + 1250 Hz LR4',
    notes: 'SEALED kabinet 69L. MiniDSP 4x10 HD til aktivt crossover. GRS i push-push par (+3 dB). WG212 giver 3 dB loading gain.',
  },
  {
    name: 'Mk3 Alternative (3-way)',
    description: 'Samme som Mk2 men med SB26STAC dome-diskant i stedet for H2606 ringradiator. Til brug hvis H2606 fejler distorsionstest.',
    type: '3-way',
    drivers: ['seed-grs-8sw-4he-8', 'seed-scanspeak-15w-4434g00', 'seed-sb26stac-c000-4'],
    recommendedXo: '150 Hz LR4 + 1100 Hz LR4',
    notes: 'Samme kabinet som Mk2. SB26STAC kræver lavere krydsning (1100 Hz) grundet bølgeleder-fravær. Ingen waveguide loading — ~3 dB lavere følsomhed i toppen.',
  },
  {
    name: 'Budget 2-vejs med RS225',
    description: 'Dayton RS225 8" bass/mid + ND28F diskant. God pris/ydelse, kompakt 2-vejs.',
    type: '2-way',
    drivers: ['seed-dayton-rs225-8', 'seed-dayton-nd28f-4'],
    recommendedXo: '2.0-2.5 kHz LR4',
    notes: 'PORTED eller SEALED. RS225 glat respons til ~2.5 kHz før cone breakup. ND28F høj følsomhed — kan dæmpes ~5 dB. Godt for 8 ohm system.',
  },
  {
    name: 'HiFi 3-vejs med ScanSpeak',
    description: 'ScanSpeak Illuminator mellemtone + Revelator bas + D3004 bølgeleder-diskant. Avanceret hi-fi 3-vejs.',
    type: '3-way',
    drivers: ['seed-scanspeak-22w-8851t00', 'seed-scanspeak-12mu-4731t00', 'seed-scanspeak-d3004-602000'],
    recommendedXo: '250-350 Hz LR4 + 2.5 kHz LR4',
    notes: 'Høj kvalitet. Alle drivere fra ScanSpeaks Illuminator/Revelator serie. 22W kan sealed eller ported. D3004 bølgeleder-gain reducerer behov for diskant-dæmpning.',
  },
  {
    name: 'Enkel 2-vejs med SB Acoustics',
    description: 'SB NRX 4.5" wide-range + SB29 ringradiator. Velegnet til små kabinetter og nærfeltslytning.',
    type: '2-way',
    drivers: ['seed-sb-acoustics-sb12nrx25-4', 'seed-sb-acoustics-tweeter'],
    recommendedXo: '2.0-3.0 kHz LR4',
    notes: 'SB12NRX25-4 har glat respons til ~5 kHz — giver god margin. SB29RDC ringradiator kan krydses lavt (1.2 kHz). Kompakt kabinet ~8-15 L.',
  },
  {
    name: 'Full-range + sub',
    description: 'Markaudio Alpair 7MS full-range + SB34NRX75-6 subwoofer. Simpelt system med dyb bas.',
    type: 'sub+sat',
    drivers: ['seed-markaudio-alpair-7ms', 'seed-sb-acoustics-sb34nrx75-6'],
    recommendedXo: '80-120 Hz',
    notes: 'Alpair 7MS dækker 80 Hz - 20 kHz alene. Subwoofer afhjælper bunden. Velegnet til rørhøjttalere eller minimalistiske systemer. Aktiv dæmpning/delay påkrævet.',
  },
  {
    name: 'Kudos X2 restaurering (Vifa + Wavecor)',
    description: 'Vifa BC25TG15-04 diskant + Wavecor WF146WA01 mellem/bas. Oprindeligt Kudos X2 kabinet, nu med MiniDSP 2x4 aktivt delefilter.',
    type: '2-way',
    drivers: ['seed-wavecor-wf146wa01', 'seed-vifa-bc25tg15-04'],
    recommendedXo: '2.0 kHz LR4',
    notes: 'Kudos X2 passivt design krydsede muligvis op mod 4900 Hz, men Wavecor anbefaler max 3.5 kHz (breakup/directivity risk). Vifa Fs 1100 Hz tillader komfortabel krydsning fra ~2 kHz. MiniDSP aktivt setup kører allerede 2000 Hz LR4 — sikkert for begge enheder. Følsomhed: Wavecor 90 dB vs Vifa 93.9 dB — diskant kan behøve -3.9 dB pad.',
  },
  {
    name: '2.5-vejs med Wavecor WF168 + Vifa BC25TG15',
    description: 'Wavecor WF168WA01 6.5" bas + Wavecor WF146WA01 5.75" mellemtone + Vifa BC25TG15-04 diskant. 3-vejs aktivt system.',
    type: '3-way',
    drivers: ['seed-wavecor-wf168wa01', 'seed-wavecor-wf146wa01', 'seed-vifa-bc25tg15-04'],
    recommendedXo: '300 Hz LR4 + 2.0 kHz LR4',
    notes: 'WF168WA01 dækker bunden til 300 Hz (Vas 24.6L, egner sig til lukket/ported). WF146WA01 tager mellemtone 300 Hz - 2 kHz. Vifa diskant fra 2 kHz. Følsomhed: WF168 91.5 dB, WF146 90 dB, Vifa 93.9 dB — juster gains for flad sum. 8Ω varianter (WF168WA02, WF146WA02) giver lavere følsomhed men højere Qts.',
  },
  {
    name: 'Wavecor WF168 2-vejs (6.5" + diskant)',
    description: 'Wavecor WF168WA01 6.5" bas/mellemtone + Vifa BC25TG15-04 diskant. Kompakt 2-vejs med dybere bas end WF146.',
    type: '2-way',
    drivers: ['seed-wavecor-wf168wa01', 'seed-vifa-bc25tg15-04'],
    recommendedXo: '2.0 kHz LR4',
    notes: 'WF168WA01 går dybere end WF146 (Fs 47.5 vs 56 Hz, Vas 24.6 vs 10 L). Max øvre frekvens 3.0 kHz — 2 kHz krydsning er sikker. Følsomhed 91.5 dB vs Vifa 93.9 dB — diskant pad ~-2.4 dB. 8Ω variant: WF168WA02 (89 dB, Qts=0.52).',
  },
];

// ---------------------------------------------------------------------------
// Utility: find all suggestions a specific driver is used in
// ---------------------------------------------------------------------------

export function findSuggestionsForDriver(driverId: string): SystemSuggestion[] {
  return SYSTEM_SUGGESTIONS.filter((s) => s.drivers.includes(driverId));
}

// ---------------------------------------------------------------------------
// Utility: suggest cabinet type + volume for a driver
// ---------------------------------------------------------------------------

export interface CabinetSuggestion {
  type: 'sealed' | 'ported';
  volume: string; // e.g. "15-25 L"
  f3: string; // e.g. "~55 Hz"
  notes: string;
}

export function suggestCabinet(driver: Driver): CabinetSuggestion[] {
  const { qts, fs, vas, sensitivity } = driver.tsParams;
  const suggestions: CabinetSuggestion[] = [];

  if (qts < 0.5) {
    // Ported suitable
    if (vas < 20) {
      suggestions.push({
        type: 'ported',
        volume: `${(vas * 0.5).toFixed(0)}-${(vas * 1.2).toFixed(0)} L`,
        f3: `~${(fs * 0.6).toFixed(0)} Hz`,
        notes: `Ported QB3/SC4 alignment. Fb ~ ${(fs * 0.8).toFixed(0)} Hz. God basforlængelse.`,
      });
    } else {
      suggestions.push({
        type: 'ported',
        volume: `${(vas * 0.3).toFixed(0)}-${(vas * 0.8).toFixed(0)} L`,
        f3: `~${(fs * 0.6).toFixed(0)} Hz`,
        notes: `Ported. Beregnet volumen er vejledende — finjuster efter måling.`,
      });
    }
  }

  // Sealed is always an option
  const qtcTarget = Math.max(0.5, Math.min(1.0, qts * 1.5));
  const sealedVol = vas / ((qtcTarget / qts) ** 2 - 1);
  suggestions.push({
    type: 'sealed',
    volume: `${(sealedVol * 0.7).toFixed(0)}-${(sealedVol * 1.3).toFixed(0)} L`,
    f3: `~${(fs * (qtcTarget / qts) * 0.9).toFixed(0)} Hz`,
    notes: `Sealed Qtc ~ ${qtcTarget.toFixed(2)}. Strammere bas, mindre gruppeløbstid end ported. Kræver større forstærker-effekt i bunden.`,
  });

  // Sensitivity estimate for ported
  if (qts < 0.5) {
    suggestions[0].notes += ` Forventet følsomhed: ~${(sensitivity + 3).toFixed(1)} dB (baffelstep inkluderet).`;
  }

  return suggestions;
}
