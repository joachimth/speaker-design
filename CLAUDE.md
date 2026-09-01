# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this repository is

A **web-based speaker design tool** that runs entirely in the browser. Users
upload driver datasheets (PDF), the tool extracts Thiele-Small parameters and
frequency response data, suggests cabinet designs, and simulates the complete
acoustic system including crossovers, directivity, and spinorama.

It is a **client-side application** - no backend server. All computation runs
in the browser via TypeScript. All data (drivers, projects, datasheets) is
stored in IndexedDB.

Deployed on **GitHub Pages** (primary) or as a **Docker image** (nginx serving
static files) as an alternative.

## Tech stack

- **Build:** Vite + React 18 + TypeScript (Bun as package manager, `bun.lock`)
- **UI:** Tailwind CSS (responsive, dark mode via `class` strategy)
- **Charts:** Lightweight custom SVG charts (Plotly.js planned for advanced plots)
- **3D:** Three.js via React Three Fiber (planned - cabinet visualization, STL export)
- **PDF:** PDF.js (text + image extraction from datasheets)
- **Storage:** Dexie (IndexedDB wrapper)
- **State:** Zustand
- **Testing:** Vitest
- **Lint:** ESLint 9 (flat config, `eslint.config.js`)
- **Deploy:** GitHub Actions → GitHub Pages / Docker

## Repository layout

```
.
├── src/
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Root component + routing
│   ├── types/                 # TypeScript type definitions
│   ├── store/                 # Zustand state stores
│   ├── db/                    # Dexie IndexedDB setup
│   ├── data/                  # Seed driver database (seedDrivers.ts)
│   ├── lib/
│   │   ├── pdf/               # PDF extraction + T/S parsing + graph digitizer
│   │   └── acoustic/          # All acoustic simulation math (ported from mk2 Python)
│   ├── components/            # React components (by domain)
│   └── pages/                 # Top-level views
├── public/                    # Static assets (favicon)
├── .github/workflows/         # CI/CD
├── docs/                      # Architecture + math reference docs
├── Dockerfile                 # Docker alternative deploy
└── package.json
```

## Key conventions

### Acoustic math

All simulation code in `src/lib/acoustic/` is ported from the
`mk2-reference-loudspeaker` repository's Python scripts. The math is
identical - only the language changes (Python → TypeScript).

Reference docs for the math models live in `docs/ACOUSTIC_MODELS.md`.

### Driver data format

Every driver has a standardized JSON structure (see `src/types/index.ts`).
Extracted from PDF datasheets via `src/lib/pdf/`. The extraction pipeline:

1. PDF.js extracts text → T/S parameter regex parsing
2. PDF.js extracts images → frequency response graph detection
3. Graph digitizer (manual point-click or auto-detect) → CSV frequency/impedance data
4. All data stored in IndexedDB

### Cabinet types

The tool supports these cabinet types, auto-suggested from T/S parameters:
- **Sealed** (closed box) - best for low Qts (< 0.4)
- **Ported** (bass reflex) - best for medium Qts (0.3-0.6)
- **Transmission line** - best for low Fs drivers
- **Open baffle** - for full-range or dipole designs

### Crossover types

LR4 (Linkwitz-Riley 4th order) is the default. Also supported: BW2, BW4, LR2,
LR8, first-order. Active (DSP) crossover is the primary mode - no passive
component calculation in v1.

### Units

All metric: mm, L, Hz, Ω, dB, V, mm². Same convention as mk2 repo.

## Development workflow

1. `bun install` - install dependencies (npm works too, but `bun.lock` is the lockfile)
2. `bun run dev` - start dev server (http://localhost:5173)
3. `bun run build` - production build to `dist/`
4. `bun run test` - run Vitest tests
5. `bun run lint` - ESLint
6. `bun run preview` - preview production build

### Git conventions

- Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Work on feature branches, push to `main` triggers GitHub Pages deploy
- **Do not open a pull request unless explicitly asked.**

## Current state

**34 seed drivers** in `src/data/seedDrivers.ts` (seeded into IndexedDB on
first load). Recent additions use real measured on-axis + off-axis SPL data
from loudspeakerlab.com Plotly JSON exports (logarithmically subsampled to
~40 on-axis / ~25 off-axis points via the `subsample_log` Python helper).
Older drivers use PDF-digitized curves (~35 points). Manufacturers: Scan-Speak,
SB Acoustics, Dayton, GRS, Wavecor, Purifi, Vifa, Mark Audio.

Implemented (11 acoustic modules in `src/lib/acoustic/`):
- **Crossover** (crossover.ts) — LR2/LR4/LR8, BW2/BW4, 1. orden, live response
- **System response** (systemResponse.ts) — combined multi-way response
- **Directivity** (directivity.ts) — on/off-axis, polar, vertical lobing, DI
- **Baffle** (baffle.ts) — baffle step + edge diffraction
- **Thiele-Small** (thieleSmall.ts) — sealed/ported/TL calculators + auto-rec
- **Auto-design** (autoDesign.ts) — crossover freq/gain/delay + cabinet + baffle
- **Room acoustics** (roomAcoustics.ts) — in-room response from spinorama
- **Cabinet response** (cabinetResponse.ts) — cabinet effect on frequency response
- **Cabinet Match** (cabinetMatch.ts) — driver matching + MiniDSP 2x4 config
- **Panel resonance** (panelResonance.ts) — cabinet wall resonances
- **Break-in** (breakin.ts) — driver break-in simulation
- **Biquad export** (biquadExport.ts) — converts crossover to MiniDSP biquad coefficients (text + Q23 hex + JSON, 48/96/44.1 kHz)

Pages: DriverManager, CabinetDesigner, CrossoverDesigner, SimulationView,
SystemSimulation (multi-way), CabinetMatch, ProjectOverview.

Cabinet Match → System Simulering handoff: `projectStore.ts` carries
`SystemSimHandoff` (bands with driverId/role/crossover/gain/polarity/delay,
cabinet dims, port tuning) between the two pages via Zustand state.

Tests: 203 tests across 11 test files (Vitest). Build clean. Typecheck clean.

Not yet built (see `TODO.md`): 3D cabinet visualization (Three.js), STL
export, graph digitizer UI, waveguide designer, DSP biquad export, project
save/load, REW measurement import.

## Domain glossary

- **T/S parameters** - Thiele-Small parameters describing driver behavior
- **Qts** - total quality factor of driver (determines cabinet suitability)
- **Vas** - equivalent volume of driver suspension
- **Fs** - free-air resonant frequency
- **Baffle step** - low-frequency loss due to finite baffle size
- **Spinorama** - standardized curve set (on-axis, listening window, early reflections, sound power, directivity index)
- **LR4** - Linkwitz-Riley 4th-order crossover (24 dB/oct)
- **Push-push** - two woofers opposed, cancelling cabinet forces
