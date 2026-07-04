# TODO

## Phase 1: Foundation (MVP)

### Project setup
- [x] Repository structure
- [x] Vite + React + TypeScript scaffold
- [x] Tailwind CSS
- [ ] CI/CD GitHub Pages
- [ ] Dockerfile

### Types & storage
- [ ] TypeScript type definitions (Driver, Cabinet, Project, Crossover)
- [ ] Dexie IndexedDB setup
- [ ] Zustand stores (driver, project)

### PDF datasheet extraction
- [ ] PDF.js integration (text + image extraction)
- [ ] T/S parameter regex parser
- [ ] Frequency response graph digitizer (manual + auto)
- [ ] Impedance curve extraction
- [ ] Driver save/load to IndexedDB

### Driver database
- [ ] Pre-load 4 drivers from mk2 repo (GRS, ScanSpeak 15W, ScanSpeak H2606, SB26)
- [ ] Driver manager UI (list, upload, edit, delete)
- [ ] Driver detail view (params, curves)

## Phase 2: Cabinet Design

### Thiele-Small calculations
- [ ] Sealed box calculator (Vb, Fc, Qtc, F3)
- [ ] Ported box calculator (Vb, Fb, F3, port dimensions)
- [ ] Transmission line calculator
- [ ] Cabinet type auto-recommendation (Qts-based)
- [ ] Cabinet parameter comparison view

### Cabinet visualization
- [ ] Parametric 3D cabinet builder (Three.js)
- [ ] Driver placement on baffle
- [ ] Internal volume calculation
- [ ] Baffle dimension editor
- [ ] STL export

### Baffle step
- [ ] Baffle step diffraction model
- [ ] Baffle step compensation calculator
- [ ] Edge diffraction simulation

## Phase 3: Acoustic Simulation

### Frequency response
- [ ] Individual driver response (from datasheet curve)
- [ ] Combined system response
- [ ] Crossover simulation (LR4, BW4, LR2, etc.)
- [ ] Crossover designer UI (frequency, order, type per way)

### Directivity
- [ ] On-axis + off-axis response
- [ ] Directivity index
- [ ] Vertical lobing analysis
- [ ] Polar diagram (horizontal + vertical)
- [ ] Polar map (frequency vs angle heatmap)

### Spinorama
- [ ] On-axis
- [ ] Listening window (±10° H, ±10° V)
- [ ] Early reflections
- [ ] Sound power
- [ ] Directivity index
- [ ] Predicted in-room response

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

- [ ] Responsive design (mobile + desktop)
- [ ] Dark mode
- [ ] Unit preferences (metric/imperial)
- [ ] Help/intro tour
- [ ] Print-friendly views
- [ ] Performance optimization (web workers for simulation)
