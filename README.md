# Speaker Design

Automatisk web-baseret speaker design software. Indlæs datablade (PDF), lad softwaren udtrække alle relevante parametre, få forslag til kabinettype, og generer frekvenskurver, kabinettegninger og spinorama-simuleringer.

## Mål

1. **Datablad-ekstraktion** - Upload PDF, udtræk Thiele-Small parametre, mekaniske dimensioner, frekvensgang og impedance automatisk
2. **Kabinetforslag** - Analyser T/S parametre og foreslå bedste kabinettype (sealed, ported, transmission line) med volumenberegning
3. **Akustisk simulering** - Baffelstep, on/off-axis respons, dæmpning i kabinettet, crossover-design, spinorama
4. **Visualisering** - Frekvenskurver, 3D kabinettegninger, polardiagrammer, spinorama plots
5. **Eksport** - STL til 3D-print, DSP-konfiguration, projektfiler

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Tailwind CSS
- **PDF:** PDF.js (browser-baseret ekstraktion)
- **Plotting:** Plotly.js (frekvenskurver, spinorama, polar)
- **3D:** Three.js + React Three Fiber (kabinet-visualisering)
- **Storage:** IndexedDB (Dexie) - alt kører client-side, ingen backend
- **Deploy:** GitHub Pages (static) eller Docker (nginx)

## Kompetencer fra mk2-reference-loudspeaker

Følgende er porteret fra det eksisterende Python-baserede speaker-repo:

| mk2 script | Port til | Status |
|---|---|---|
| `crossover_simulation.py` | `lib/acoustic/crossover.ts` | 📋 Planlagt |
| `system_response.py` | `lib/acoustic/systemResponse.ts` | 📋 Planlagt |
| `directivity_estimate.py` | `lib/acoustic/directivity.ts` | 📋 Planlagt |
| `vertical_polar_map.py` | `lib/acoustic/polarMap.ts` | 📋 Planlagt |
| `vertical_lobing.py` | `lib/acoustic/lobing.ts` | 📋 Planlagt |
| `polar_response.py` | `lib/acoustic/polar.ts` | 📋 Planlagt |
| `waveguide_profile.py` | `lib/acoustic/waveguide.ts` | 📋 Planlagt |
| `mk3_crossover_optimization.py` | `lib/acoustic/optimization.ts` | 📋 Planlagt |
| `cad/cabinet.scad` | `lib/cad/cabinetBuilder.ts` (Three.js) | 📋 Planlagt |
| `cad/mk2_waveguide_os.scad` | `lib/cad/waveguideBuilder.ts` | 📋 Planlagt |
| Datasheet extraction pipeline | `lib/pdf/extractor.ts` + `tsParser.ts` | 📋 Planlagt |

## Kørsel

### Lokalt
```bash
npm install
npm run dev
```

### Docker
```bash
docker build -t speaker-design .
docker run -p 8080:80 speaker-design
```

### GitHub Pages
Auto-deploy via GitHub Actions ved push til `main`.

## Licens
MIT
