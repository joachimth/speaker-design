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

- **Build:** Vite + React 18 + TypeScript
- **UI:** Tailwind CSS
- **Charts:** Plotly.js (frequency response, spinorama, polar diagrams)
- **3D:** Three.js via React Three Fiber (cabinet visualization, STL export)
- **PDF:** PDF.js (text + image extraction from datasheets)
- **Storage:** Dexie (IndexedDB wrapper)
- **State:** Zustand
- **Testing:** Vitest
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
│   ├── lib/
│   │   ├── pdf/               # PDF extraction + T/S parsing + graph digitizer
│   │   ├── acoustic/          # All acoustic simulation math (ported from mk2 Python)
│   │   ├── cad/               # Parametric cabinet + waveguide geometry (Three.js)
│   │   └── plot/              # Plotly configuration helpers
│   ├── components/            # React components (by domain)
│   └── pages/                 # Top-level views
├── public/
│   └── drivers/               # Pre-loaded driver database (JSON)
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

1. `npm install` - install dependencies
2. `npm run dev` - start dev server (http://localhost:5173)
3. `npm run build` - production build to `dist/`
4. `npm run test` - run Vitest tests
5. `npm run lint` - ESLint
6. `npm run preview` - preview production build

### Git conventions

- Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Work on feature branches, push to `main` triggers GitHub Pages deploy
- **Do not open a pull request unless explicitly asked.**

## What does NOT exist yet

Everything is being built from scratch. The mk2 repo provides the acoustic
math and design knowledge, but the web application, PDF extraction, UI, and
deployment are all new.

Pre-loaded driver data in `public/drivers/` will be seeded from the mk2 repo's
extracted datasheets (GRS 8SW-4HE-8, ScanSpeak 15W/4434G00, ScanSpeak
H2606/920000, SB Acoustics SB26STAC-C000-4).

## Domain glossary

- **T/S parameters** - Thiele-Small parameters describing driver behavior
- **Qts** - total quality factor of driver (determines cabinet suitability)
- **Vas** - equivalent volume of driver suspension
- **Fs** - free-air resonant frequency
- **Baffle step** - low-frequency loss due to finite baffle size
- **Spinorama** - standardized curve set (on-axis, listening window, early reflections, sound power, directivity index)
- **LR4** - Linkwitz-Riley 4th-order crossover (24 dB/oct)
- **Push-push** - two woofers opposed, cancelling cabinet forces
