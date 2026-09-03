# TODO

## Phase 1: Foundation (MVP)

### Project setup
- [x] Repository structure
- [x] Vite + React + TypeScript scaffold
- [x] Tailwind CSS
- [x] CI/CD GitHub Pages
- [x] Dockerfile

### Types & storage
- [x] TypeScript type definitions (Driver, Cabinet, Project, Crossover)
- [x] Dexie IndexedDB setup
- [x] Zustand stores (driver, project)

### PDF datasheet extraction
- [x] PDF.js integration (text + image extraction)
- [x] T/S parameter regex parser
- [x] Frequency response graph digitizer (GraphDigitizer: manual + auto color-mask)
- [x] Impedance curve extraction (GraphDigitizer impedance mode)
- [x] Driver save/load to IndexedDB

### Driver database
- [x] Pre-load 4 drivers from mk2 repo (GRS, ScanSpeak 15W, ScanSpeak H2606, SB26)
- [x] Expanded to 34 drivers with real measured data (loudspeakerlab.com JSON + PDF)
- [x] Driver manager UI (list, upload, edit, delete)
- [x] Driver detail view (params, curves)
- [x] Full off-axis data (10-90 deg) for newer additions

## Phase 2: Cabinet Design

### Thiele-Small calculations
- [x] Sealed box calculator (Vb, Fc, Qtc, F3)
- [x] Ported box calculator (Vb, Fb, F3, port dimensions)
- [x] Transmission line calculator
- [x] Cabinet type auto-recommendation (Qts-based)
- [x] Cabinet parameter comparison view (CabinetComparisonCard)

### Cabinet visualization
- [x] Parametric 3D cabinet builder (Cabinet3DBuilder with Three.js)
- [x] Driver placement on baffle (Cabinet3DBuilder drag-to-position)
- [x] Internal volume calculation
- [x] Baffle dimension editor
- [x] STL export (stlExport.ts: binary STL with hollow box + driver cutouts)

### Baffle step
- [x] Baffle step diffraction model
- [x] Baffle step compensation calculator
- [x] Edge diffraction simulation

## Phase 3: Acoustic Simulation

### Frequency response
- [x] Individual driver response (from datasheet curve)
- [x] Combined system response
- [x] Crossover simulation (LR4, BW4, LR2, etc.)
- [x] Crossover designer UI (frequency, order, type per way)

### Directivity
- [x] On-axis + off-axis response
- [x] Directivity index
- [x] Vertical lobing analysis
- [x] Polar diagram (horizontal + vertical)
- [x] Polar map (frequency vs angle heatmap)

### Spinorama
- [x] On-axis
- [x] Listening window (+/-10 deg H, +/-10 deg V)
- [x] Early reflections
- [x] Sound power
- [x] Directivity index
- [x] Predicted in-room response

### Crossover optimization
- [x] Auto-design: crossover freq + gain + delay from driver specs (autoDesign.ts)
- [x] Auto-tune: gain/delay optimization
- [x] Phase alignment fine-tuning UI (PhaseAlignmentCard)
- [x] Manual driver delay calculation (time alignment UI) (TimeAlignmentCard component)

## Phase 4: Advanced

### Multi-way systems
- [x] 2-way, 3-way, 4-way system designer (SystemSimulation.tsx)
- [x] Driver assignment per band
- [x] Push-push / push-pull configuration (driverCount field on DesignBand)

### Cabinet Match + MiniDSP
- [x] Driver matching from cabinet size + driver category (cabinetMatch.ts)
- [x] MiniDSP 2x4 config generation
- [x] Cabinet Match -> System Simulering handoff (projectStore.ts)

### Room & cabinet acoustics
- [x] In-room response simulation (roomAcoustics.ts)
- [x] Cabinet response simulation (cabinetResponse.ts)
- [x] Panel resonance analysis (panelResonance.ts)
- [x] Break-in simulation (breakin.ts)
- [x] Port tuning calculator

### Waveguide designer
- [x] Oblate spheroid (OS) waveguide parametric design (WaveguideDesigner.tsx)
- [x] Waveguide profile visualization (3D lathe preview + 2D profile)
- [x] Directivity control estimation (DI + coverage vs frequency plot)
- [x] STL export (stlExport.ts: binary STL with hollow box + driver cutouts) for 3D printing

### DSP export
- [x] MiniDSP 2x4 config output (via Cabinet Match)
- [x] Biquad coefficient export (LR2/4/8, BW2/4, 1st order at 48/96/44.1 kHz)
- [x] Biquad text format (paste into MiniDSP advanced biquad input) + Q23 hex
- [x] Biquad JSON export (structured format with q23hex fields)
- [x] MiniDSP 4x10 HD config export (export4x10HD)
- [x] REW measurement import (rewImport.ts parser + DriverManager UI)

### Project management
- [x] Save/load complete projects (IndexedDB via projectStore)
- [x] Project export/import (JSON file download/upload)
- [x] Design comparison (A/B projects) (DesignCompare.tsx page)

## Phase 5: Polish

- [x] Responsive design (mobile + desktop)
- [x] Dark mode
- [x] Unit preferences (metric/imperial) (settingsStore)
- [x] Help/intro tour (HelpTour)
- [x] Print-friendly views (@media print CSS)
- [x] Performance optimization (web workers for simulation) (useSimulationWorker hook + simulationWorker.ts)

## Phase 6: Optimization & Code Quality (Sep 1 review)

### Performance
- [x] Lazy-load Three.js via React.lazy + Suspense (Cabinet3DBuilder, WaveguideDesigner) - initial bundle 320KB -> 182KB gzipped
- [ ] Wire useSimulationWorker into SystemSimulation (hook exists but unused; requires passing freqs + adapting spinorama/room/polar useMemos)
- [x] Route-based code splitting (React.lazy for CabinetMatch, DesignCompare, SimulationView pages) - bundle 189KB -> 178KB gzipped
- [ ] Memoize driver database queries (avoid re-filtering on every render)

### Bug fixes (Sep 1)
- [x] Fix STL downloadSTL href bug (a.href was set to filename instead of blob URL)
- [x] Fix degenerate quad in addHollowBox front wall (v1==v2 duplicate vertex)

### Code quality
- [x] Add React ErrorBoundary (ErrorBoundary.tsx wraps all routes)
- [x] Replace 25 `any` types with proper types (pdf/extractor.ts, driverStore/projectStore catch blocks, simulationWorker casts, database.ts, GraphDigitizer, DriverManager)
- [x] Fix database.ts mixed static+dynamic import warning (projectStore + SystemSimulation now use static imports)
- [x] Add aria-labels for accessibility (added to unit toggle, cabinet type selectors, ways selector, subwoofer remove, parameter set selector)

### Features to consider
- [x] Driver frequency response smoothing (Psychoacoustic 1/N-octave smoothing, smoothing.ts)
- [x] Crossover auto-optimization with target curve (targetCurve.ts: flat, Harman, tilted, custom)
- [x] Impedance matching at crossover frequency (impedanceMatch.ts + ImpedanceMatchCard)
- [x] Export simulation results as image/PNG (pngExport.ts, button on target curve plot)
- [x] Multi-subwoofer alignment tool (multiSub.ts + MultiSubAlignmentCard in CabinetDesigner)
- [x] Linkwitz transform for sealed enclosure equalization (linkwitzTransform.ts + LinkwitzTransformCard)

### Sep 3 additions
- [x] Crossover frequency sliders with linked bands + live phase display (CrossoverSlider.tsx)
- [x] Separate "Auto delefilter" and "Auto fase/delay" buttons in SystemSimulation
- [x] Target curve optimizer UI with smooth/flat/Harman/tilted selector + plot comparison
