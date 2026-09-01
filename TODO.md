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
- [ ] Frequency response graph digitizer (manual + auto)
- [ ] Impedance curve extraction
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
- [ ] Cabinet parameter comparison view

### Cabinet visualization
- [ ] Parametric 3D cabinet builder (Three.js)
- [ ] Driver placement on baffle
- [x] Internal volume calculation
- [x] Baffle dimension editor
- [ ] STL export

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
- [ ] Phase alignment fine-tuning UI
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
- [ ] Oblate spheroid (OS) waveguide parametric design
- [ ] Waveguide profile visualization
- [ ] Directivity control estimation
- [ ] STL export for 3D printing

### DSP export
- [x] MiniDSP 2x4 config output (via Cabinet Match)
- [x] Biquad coefficient export (LR2/4/8, BW2/4, 1st order at 48/96/44.1 kHz)
- [x] Biquad text format (paste into MiniDSP advanced biquad input) + Q23 hex
- [x] Biquad JSON export (structured format with q23hex fields)
- [ ] MiniDSP 4x10 HD config export
- [x] REW measurement import (rewImport.ts parser + DriverManager UI)

### Project management
- [x] Save/load complete projects (IndexedDB via projectStore)
- [x] Project export/import (JSON file download/upload)
- [x] Design comparison (A/B projects) (DesignCompare.tsx page)

## Phase 5: Polish

- [x] Responsive design (mobile + desktop)
- [x] Dark mode
- [ ] Unit preferences (metric/imperial)
- [ ] Help/intro tour
- [ ] Print-friendly views
- [ ] Performance optimization (web workers for simulation)
