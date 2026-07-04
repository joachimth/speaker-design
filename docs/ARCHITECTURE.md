# Architecture

## Overview

Speaker Design is a **fully client-side** web application. No backend. All
computation, storage, and PDF processing happens in the browser.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  PDF.js  │  │ Plotly   │  │    Three.js       │  │
│  │ (extract)│  │ (charts) │  │  (3D cabinet)     │  │
│  └────┬─────┘  └────▲─────┘  └────────▲──────────┘  │
│       │              │                  │            │
│  ┌────▼──────────────┴──────────────────▼──────────┐ │
│  │              Core Library (TS)                   │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │  PDF    │ │ Acoustic │ │      CAD         │  │ │
│  │  │ extract │ │   math   │ │   geometry       │  │ │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │ │
│  └──────────────────────┬──────────────────────────┘ │
│                         │                             │
│  ┌──────────────────────▼──────────────────────────┐ │
│  │              State Layer                         │ │
│  │  Zustand stores + Dexie (IndexedDB)              │ │
│  └──────────────────────────────────────────────────┘ │
│                         │                             │
│  ┌──────────────────────▼──────────────────────────┐ │
│  │              React UI                            │ │
│  │  Pages: Drivers | Cabinet | Crossover | Sim     │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │                          │
    GitHub Pages              Docker (nginx)
    (static hosting)         (static files)
```

## Data flow

1. **Upload PDF** → PDF.js extracts text + images
2. **Parse** → T/S params via regex, frequency curves via graph digitizer
3. **Store** → Driver saved to IndexedDB
4. **Design** → User selects drivers, cabinet type, crossover config
5. **Simulate** → Acoustic math computes system response, directivity, spinorama
6. **Visualize** → Plotly renders charts, Three.js renders 3D cabinet
7. **Export** → STL for 3D print, JSON for project save, DSP config

## Why client-side?

- **GitHub Pages** = free hosting, no server costs
- **Privacy** = user's datasheets never leave their browser
- **Offline** = works without internet after first load
- **Docker** = optional, same static files served by nginx

## Performance considerations

- PDF.js worker runs in a Web Worker (non-blocking)
- Acoustic simulations can be heavy → Web Worker candidate
- Three.js scene only renders when visible
- IndexedDB for persistence (handles large datasets better than localStorage)
- Vite code-splitting keeps initial bundle small
