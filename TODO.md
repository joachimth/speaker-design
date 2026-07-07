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
- [x] Driver manager UI (list, upload, edit, delete)
- [x] Driver detail view (params, curves)

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
- [x] Listening window (±10° H, ±10° V)
- [x] Early reflections
- [x] Sound power
- [x] Directivity index
- [x] Predicted in-room response

### Crossover optimization
- [ ] Auto-optimization of crossover frequency + order
- [ ] Phase alignment
- [ ] Driver delay calculation (time alignment)

## Phase 4: Advanced

### Multi-way systems
- [ ] 2-way, 3-way, 4-way system designer
- [ ] Driver assignment per band
- [ ] Push-push / push-pull configuration

### Waveguide designer
- [ ] Oblate spheroid (OS) waveguide parametric design
- [ ] Waveguide profile visualization
- [ ] Directivity control estimation
- [ ] STL export for 3D printing

### DSP export
- [ ] MiniDSP 4x10 HD config export
- [ ] biquad coefficient export
- [ ] REW measurement import

### Project management
- [ ] Save/load complete projects
- [ ] Project export/import (JSON)
- [ ] Design comparison (A/B projects)

## Phase 5: Polish

- [x] Responsive design (mobile + desktop)
- [x] Dark mode
- [ ] Unit preferences (metric/imperial)
- [ ] Help/intro tour
- [ ] Print-friendly views
- [ ] Performance optimization (web workers for simulation)
