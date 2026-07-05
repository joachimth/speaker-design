# Speaker Design

[![CI & Deploy](https://github.com/joachimth/speaker-design/actions/workflows/deploy.yml/badge.svg)](https://github.com/joachimth/speaker-design/actions/workflows/deploy.yml)

Automatisk web-baseret speaker design software. Indlæs datablade (PDF), lad softwaren udtrække alle relevante parametre, få forslag til kabinettype, og generer frekvenskurver, kabinettegninger og spinorama-simuleringer.

**Live demo:** <https://joachimth.github.io/speaker-design/>

Alt kører client-side i browseren - ingen backend, ingen data forlader din maskine.

## Mål

1. **Datablad-ekstraktion** - Upload PDF, udtræk Thiele-Small parametre, mekaniske dimensioner, frekvensgang og impedance automatisk
2. **Kabinetforslag** - Analyser T/S parametre og foreslå bedste kabinettype (sealed, ported, transmission line) med volumenberegning
3. **Akustisk simulering** - Baffelstep, on/off-axis respons, dæmpning i kabinettet, crossover-design, spinorama
4. **Visualisering** - Frekvenskurver, 3D kabinettegninger, polardiagrammer, spinorama plots
5. **Eksport** - STL til 3D-print, DSP-konfiguration, projektfiler

## Funktioner

- **Driver-bibliotek** - 15+ foruddefinerede drivere (ScanSpeak, SB Acoustics, Dayton, GRS m.fl.) plus PDF-upload med automatisk T/S-parameterudtræk
- **Kabinetberegner** - Sealed, ported og transmission line med auto-anbefaling ud fra Qts/Fs
- **Crossover-designer** - LR2/LR4/LR8, BW2/BW4 og 1. orden med live frekvensrespons-plot
- **Simulering** - Baffelstep, spinorama (CEA-2034 kurver), polardiagram og vertical lobing

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS (responsiv, dark mode)
- **PDF:** PDF.js (browser-baseret ekstraktion)
- **Plotting:** Letvægts SVG-grafer (ingen tunge chart-biblioteker)
- **3D:** Three.js kabinet-visualisering (planlagt)
- **Storage:** IndexedDB (Dexie) - alt kører client-side, ingen backend
- **Test:** Vitest (akustik-matematikken er testdækket)
- **Deploy:** GitHub Pages (static) eller Docker (nginx)

## Kompetencer fra mk2-reference-loudspeaker

Akustik-matematikken er porteret fra det eksisterende Python-baserede speaker-repo:

| mk2 script | Port til | Status |
|---|---|---|
| `crossover_simulation.py` | `lib/acoustic/crossover.ts` | ✅ Porteret |
| `system_response.py` | `lib/acoustic/systemResponse.ts` | ✅ Porteret |
| `directivity_estimate.py` | `lib/acoustic/directivity.ts` | ✅ Porteret |
| `polar_response.py` | `lib/acoustic/directivity.ts` (`calcPolar`) | ✅ Porteret |
| `vertical_lobing.py` | `lib/acoustic/directivity.ts` (`calcVerticalLobing`) | ✅ Porteret |
| Datasheet extraction pipeline | `lib/pdf/extractor.ts` | ✅ Porteret |
| `vertical_polar_map.py` | `lib/acoustic/polarMap.ts` | 📋 Planlagt |
| `waveguide_profile.py` | `lib/acoustic/waveguide.ts` | 📋 Planlagt |
| `mk3_crossover_optimization.py` | `lib/acoustic/optimization.ts` | 📋 Planlagt |
| `cad/cabinet.scad` | `lib/cad/cabinetBuilder.ts` (Three.js) | 📋 Planlagt |
| `cad/mk2_waveguide_os.scad` | `lib/cad/waveguideBuilder.ts` | 📋 Planlagt |

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

## Licens

MIT
