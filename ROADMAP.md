# Roadmap

## v0.1 — Foundation (done)
- [x] Project scaffold (Vite + React + TS + Tailwind)
- [x] TypeScript types + IndexedDB storage
- [x] PDF datasheet extraction (T/S params)
- [x] Pre-loaded driver database (4 drivers from mk2 repo)
- [x] Driver manager UI

## v0.2 — Cabinet Design (done)
- [x] Thiele-Small calculations (sealed, ported, TL)
- [x] Cabinet type auto-recommendation
- [x] Baffle step + edge diffraction
- [x] Baffle dimension editor + internal volume
- [ ] 3D cabinet visualization (Three.js)
- [ ] STL export

## v0.3 — Acoustic Simulation (done)
- [x] Crossover designer (LR4, BW4, LR2, etc.)
- [x] Combined system response
- [x] Directivity estimation
- [x] Spinorama calculation + plots
- [x] Vertical lobing / polar maps
- [x] Predicted in-room response

## v0.4 — Advanced (mostly done)
- [x] Multi-way system designer (2/3/4-way)
- [x] Driver assignment per band
- [x] Auto-design (crossover freq + gain + delay from driver specs)
- [x] Auto-tune optimizer
- [x] Port tuning calculator
- [x] Cabinet response simulation
- [x] Panel resonance analysis
- [x] Break-in simulation
- [x] Cabinet Match (driver matching + MiniDSP config)
- [x] Cabinet Match -> System Simulering handoff
- [ ] Push-push / push-pull configuration
- [ ] Waveguide designer (OS profile)
- [ ] Crossover optimization (advanced)
- [ ] DSP export (biquads, MiniDSP 4x10 HD)

## v0.5 — Polish (partially done)
- [x] Responsive design
- [x] Dark mode
- [ ] Unit preferences (metric/imperial)
- [ ] Help/intro tour
- [ ] Web workers for performance
- [ ] Project save/load/export
- [ ] Print views

## v1.0 — Production
- [ ] 3D cabinet visualization (Three.js)
- [ ] STL export
- [ ] Graph digitizer UI
- [ ] Waveguide designer
- [ ] DSP biquad export
- [ ] REW measurement import
- [ ] Full test coverage
- [ ] Docker image published
- [x] GitHub Pages live

## Driver Database Expansion

Current: 34 drivers with real measured data. Prioritized sources:
1. loudspeakerlab.com Plotly JSON exports (preferred — real measured curves)
2. Manufacturer PDFs (digitized via pixel extraction)
3. loudspeakerdatabase.com (rate-limited, fallback only)

Candidates for future addition: More SB Acoustics wooferes, SEAS Prestige
series, Dayton RS series extensions, Purifi midrange, Morel tweeteres.
