# Speaker Design

[![CI & Deploy](https://github.com/joachimth/speaker-design/actions/workflows/deploy.yml/badge.svg)](https://github.com/joachimth/speaker-design/actions/workflows/deploy.yml)

Web-baseret speaker design værktøj. Design kabinetter, byg crossover, simuler frekvensgang, og match drivere til kabinetter - alt i browseren.

**Live demo:** <https://joachimth.github.io/speaker-design/>

Alt kører client-side i browseren - ingen backend, ingen data forlader din maskine.

## Funktioner

### Driver-bibliotek (34 drivere)
34 foruddefinerede drivere med reelle målte frekvenskurver fra loudspeakerlab.com Plotly JSON-exports og producentdatablade. Dækker wooferes, midrange, coaxial og tweeteres fra Scan-Speak, SB Acoustics, Dayton, GRS, Wavecor, Purifi, Vifa og Mark Audio. Fuld on-axis + off-axis data (10-90 grader) for de nyeste tilføjelser.

### Kabinet Match
Input af kabinetstørrelse og ønskede driver-kategorier. Systemet anbefaler drivere fra biblioteket der passer til kabinettet, beregner delefilter-frekvenser, og genererer MiniDSP 2x4/4x10 konfiguration. Resultatet kan sendes direkte til System Simulering med et klik (handoff: kabinetstørrelse, valgte drivere og automatiske delefilter-indstillinger overføres). Understøtter 2-vejs og 3-vejs systemer med automatisk fallback til 2-vejs hvis ingen mellemtone findes.

### System Simulering
Multi-way (2/3/4-vejs) system designer med driver assignment per bånd. Crossover-designer (LR2/LR4/LR8, BW2/BW4, 1. orden) med live frekvensrespons-plot. **Delefrekvens slider** med linkede bånd og live fasevisning (grøn/gul/rød faseindikator). Auto-design genererer delefilter-frekvenser, gain og delay fra driver specs og målte frekvenskurver. **Målkurve optimering** med flad/Harman/tiltet target, multi-resolution gain optimering (0.1 dB præcision) og real-time afvigelses-meter.

### Akustisk Simulering
- **Baffelstep** - edge diffraction og baffle step compensation
- **Spinorama** - CEA-2034 kurver (on-axis, listening window, early reflections, sound power, directivity index)
- **Polar diagram** - horizontal + vertical
- **Directivity map** - 2D heatmap + 3D isometric
- **Vertical lobing** - frekvens vs vinkel
- **In-room response** - simuleret lytterumsrespons baseret på spinorama
- **Cabinet response** - kabinettets påvirkning af frekvensgangen
- **Auto-tune** - automatisk gain/delay optimering af delefilter
- **Port tuning** - beregning af port tuning frekvens og dimensioner
- **Panel resonance** - kabinetvægs resonanser
- **Break-in simulation** - driver break-in over tid

### Kabinetberegner
Sealed, ported og transmission line med auto-anbefaling ud fra Qts/Fs. Baffle dimension editor og intern volumenberegning. **Kabinet sammenligning** viser sealed (3 Qtc varianter), ported og TL side-ved-side. **3D kabinet builder** (Three.js) med gennemsigtige vægge, driver placement på baffel (klik+træk for at flytte), og **STL export** til 3D print.

### OS Waveguide Designer
Oblate Spheroid (OS) waveguide fra Dr. Earl Geddes. Parametrisk design af throat/mouth/depth/eccentricitet, 3D preview med LatheGeometry, direktivitets-estimat (DI + coverage vs frekvens), og STL export til 3D print af waveguiden.

### Graf Digitizer
Interaktiv canvas-baseret digitizer til at ekstrahere frekvenskurver (SPL eller impedans) fra PDF datablade eller billeder. 4-punkts akse-kalibrering (log X, lineær Y), manuel klik-til-punkt mode, eller auto farve-mask detektion med tærskel. Understøtter fler-sidet PDF navigation.

### Projektstyring
Gem hele designs (enheder, delefilter, baffel, kabinet, rum-params) i browseren via IndexedDB. Eksporter som JSON fil og importer igen senere eller på en anden maskine. Projektlister på Overblik-siden med indlæs, eksporter og slet. **A/B sammenligning** af to gemte projekter på samme plot med differenskurve og metrikker. **Print/PDF** knap til udskrift eller arkivering.

### Biquad Export
Konverter delefilter-design (LR2/LR4/LR8, BW2/BW4, 1. orden) til biquad filter coefficients direkte fra System Simulering. Vælg sample rate (48/96/44.1 kHz), få tekst format til MiniDSP advanced biquad input, Q23 hex til XML redigering, eller struktureret JSON. Understøtter både **MiniDSP 2x4** (4 outputs) og **MiniDSP 4x10 HD** (10 outputs, op til 4-vejs + sub).

### Unit preferences & Help
Skift mellem metriske (mm) og imperiale (tommer) enheder i headeren. Intro-tour (9 trins rundvisning) vises ved første besøg og kan genaktiveres via ?-knappen i headeren. **Guidet arbejdsgang** med "Næste" knapper på hver fane der leder dig gennem design flowet: Enheder → Kabinet → Kabinet Match → Delingsfilter → System Sim. → A/B Sammenlign.

### Performance
Web Worker offloader tung simulations-beregning (frekvensgang, delefilter, kabinet-respons) til en baggrunds-tråd så UI forbliver responsiv. `useSimulationWorker` hook med 100ms debounce.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS (responsiv, dark mode, print-friendly)
- **3D:** Three.js (kabinet builder + waveguide designer)
- **PDF:** PDF.js (browser-baseret ekstraktion + graf digitizer)
- **Plotting:** Letvægts SVG-grafer (ingen tunge chart-biblioteker)
- **Storage:** IndexedDB (Dexie) - alt kører client-side, ingen backend
- **State:** Zustand (with persist for settings)
- **Workers:** Web Worker for simulation offloading
- **Test:** Vitest (246 tests, 13 testfiler - akustik-matematikken er testdækket)
- **Deploy:** GitHub Pages (static) via GitHub Actions, eller Docker (nginx)

## Akustik-matematik

Akustik-matematikken er porteret fra `mk2-reference-loudspeaker` Python-repoet. 16 moduler i `src/lib/acoustic/`:

| Modul | Beskrivelse |
|---|---|
| `crossover.ts` | Crossover simulation (LR, BW, 1. orden) |
| `systemResponse.ts` | Samlet systemrespons |
| `directivity.ts` | On/off-axis, polar, vertical lobing |
| `baffle.ts` | Baffle step + edge diffraction |
| `thieleSmall.ts` | T/S parameter beregninger (sealed, ported, TL) |
| `autoDesign.ts` | Auto-design af crossover, kabinet og baffle |
| `roomAcoustics.ts` | In-room respons simulering |
| `cabinetResponse.ts` | Kabinet respons simulering |
| `cabinetMatch.ts` | Driver matching + MiniDSP konfiguration |
| `panelResonance.ts` | Kabinetvægs resonanser |
| `breakin.ts` | Driver break-in simulering |
| `targetCurve.ts` | Målkurve optimering (flad, Harman, tiltet, custom) |
| `smoothing.ts` | Psychoakustisk 1/N-oktav udjævning |
| `impedance.ts` | Impedans simulering |
| `impedanceMatch.ts` | Impedans match ved delefrekvens |
| `multiSub.ts` | Multi-subwoofer alignment |
| `linkwitzTransform.ts` | Linkwitz transform for sealed EQ |

## Kørsel

### Lokalt

Projektet bruger [Bun](https://bun.sh) (npm virker også):

```bash
bun install
bun run dev        # dev server på http://localhost:5173
bun run test       # Vitest
bun run lint       # ESLint
bun run build      # produktions-build til dist/
```

### Docker

```bash
docker build -t speaker-design .
docker run -p 8080:80 speaker-design
```

Eller med compose: `docker compose up -d`

### GitHub Pages

Auto-deploy via GitHub Actions ved push til `main`. Pull requests bygger og tester uden at deploye.

## Dokumentation

- [ROADMAP.md](ROADMAP.md) - versionsplan
- [TODO.md](TODO.md) - detaljeret opgaveliste
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - arkitektur
- [docs/ACOUSTIC_MODELS.md](docs/ACOUSTIC_MODELS.md) - matematik-reference
- [CLAUDE.md](CLAUDE.md) - vejledning for AI assistenter

## Licens

MIT
