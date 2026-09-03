// Shared active design store (Zustand)
//
// Single source of truth for the "active design" that all design tabs
// (CabinetDesigner, CrossoverDesigner, SystemSimulation) read from and
// write to. This replaces each page's local useState with a shared store
// so changes on one tab are visible on all others.
//
// The store mirrors DesignState plus a project name, and supports:
//   - Partial updates (update one field without touching the rest)
//   - Band-level updates (update band[i] without rewriting all bands)
//   - Load from a saved project (loadDesign)
//   - Clear to defaults (clearDesign)

import { create } from 'zustand';
import type {
  DesignState,
  DesignBand,
  CabinetType,
  RoomParams,
} from '@/types';

// ---------------------------------------------------------------------------
// Default values (match SystemSimulation's original defaults)
// ---------------------------------------------------------------------------

const DEFAULT_ROOM_PARAMS: RoomParams = {
  dimensions: { length: 5.0, width: 4.5, height: 2.4 },
  rt60: 0.5,
  speakerDistanceFromFront: 0.6,
  speakerDistanceFromSide: 1.0,
  speakerHeight: 1.0,
  listeningDistance: 3.5,
};

const DEFAULT_BANDS_2: DesignBand[] = [
  { driverId: '', role: 'low', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
];

const DEFAULT_BANDS_3: DesignBand[] = [
  { driverId: '', role: 'low', lowpassFreq: 300, lowpassType: 'LR4', highpassFreq: 0, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'mid', lowpassFreq: 2000, lowpassType: 'LR4', highpassFreq: 300, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  { driverId: '', role: 'high', lowpassFreq: 0, lowpassType: 'LR4', highpassFreq: 2000, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
];

export const DEFAULT_DESIGN_STATE: DesignState = {
  ways: 2,
  bands: DEFAULT_BANDS_2,
  baffleWidth: 320,
  baffleHeight: 900,
  roundoverRadius: 40,
  roomParams: DEFAULT_ROOM_PARAMS,
  smoothingFraction: 3,
  cabinetType: 'sealed',
  portFb: null,
  portVb: null,
  portDiameter: 60,
  numPorts: 1,
};

function getDefaultBands(ways: 2 | 3 | 4): DesignBand[] {
  if (ways === 2) return DEFAULT_BANDS_2.map((b) => ({ ...b }));
  if (ways === 3) return DEFAULT_BANDS_3.map((b) => ({ ...b }));
  // 4-way: 3-way + an extra mid2
  return [
    ...DEFAULT_BANDS_3.map((b) => ({ ...b })),
    { driverId: '', role: 'mid2', lowpassFreq: 5000, lowpassType: 'LR4', highpassFreq: 1250, highpassType: 'LR4', gain: 0, polarity: 0, delay: 0 },
  ];
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface DesignStore {
  /** The active design (mirrors DesignState) */
  design: DesignState;
  /** Active project name (for display and save) */
  projectName: string;
  /** Whether the design has been modified since last load/save */
  isDirty: boolean;
  /** Whether a project was loaded (vs. starting fresh) */
  loadedProjectId: string | null;

  /** Patch one or more top-level fields of the design */
  updateDesign: (patch: Partial<DesignState>) => void;
  /** Update a single band by index */
  updateBand: (index: number, patch: Partial<DesignBand>) => void;
  /** Replace all bands (e.g. when changing ways count) */
  setBands: (bands: DesignBand[]) => void;
  /** Change the number of ways (auto-adjusts bands) */
  setWays: (ways: 2 | 3 | 4) => void;
  /** Set cabinet type */
  setCabinetType: (type: CabinetType) => void;
  /** Set baffle dimensions */
  setBaffle: (width: number, height: number) => void;
  /** Set port parameters */
  setPort: (params: { fb?: number | null; vb?: number | null; diameter?: number; numPorts?: number }) => void;
  /** Set room parameters */
  setRoomParams: (params: Partial<RoomParams>) => void;

  /** Load a full design from a saved project or imported JSON */
  loadDesign: (design: DesignState, name?: string, projectId?: string) => void;
  /** Reset to default empty design */
  clearDesign: () => void;
  /** Mark design as clean (e.g. after save) */
  markClean: () => void;
  /** Set project name */
  setProjectName: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useDesignStore = create<DesignStore>((set) => ({
  design: { ...DEFAULT_DESIGN_STATE, bands: getDefaultBands(2) },
  projectName: '',
  isDirty: false,
  loadedProjectId: null,

  updateDesign: (patch) =>
    set((state) => ({
      design: { ...state.design, ...patch },
      isDirty: true,
    })),

  updateBand: (index, patch) =>
    set((state) => {
      const bands = [...state.design.bands];
      if (index >= 0 && index < bands.length) {
        bands[index] = { ...bands[index]!, ...patch };
      }
      return { design: { ...state.design, bands }, isDirty: true };
    }),

  setBands: (bands) =>
    set((state) => ({
      design: { ...state.design, bands },
      isDirty: true,
    })),

  setWays: (ways) =>
    set((state) => {
      // Keep existing band data where possible, adjust count
      const oldBands = state.design.bands;
      let newBands: DesignBand[];
      if (ways <= oldBands.length) {
        // Shrink: keep existing driver selections, update roles
        const defaults = getDefaultBands(ways);
        newBands = oldBands.slice(0, ways).map((b, i) => ({
          ...b,
          ...defaults[i]!,
          driverId: b.driverId, // preserve driver selection
          gain: b.gain,
          polarity: b.polarity,
          delay: b.delay,
        }));
      } else {
        // Expand: keep existing bands (with drivers), add new ones from defaults
        const defaults = getDefaultBands(ways);
        newBands = defaults.map((d, i) => {
          const existing = oldBands[i];
          if (existing) {
            return {
              ...d,
              driverId: existing.driverId, // preserve driver selection
              gain: existing.gain,
              polarity: existing.polarity,
              delay: existing.delay,
            };
          }
          return d;
        });
      }
      return { design: { ...state.design, ways, bands: newBands }, isDirty: true };
    }),

  setCabinetType: (type) =>
    set((state) => ({
      design: { ...state.design, cabinetType: type },
      isDirty: true,
    })),

  setBaffle: (width, height) =>
    set((state) => ({
      design: { ...state.design, baffleWidth: width, baffleHeight: height },
      isDirty: true,
    })),

  setPort: (params) =>
    set((state) => ({
      design: {
        ...state.design,
        portFb: params.fb !== undefined ? params.fb : state.design.portFb,
        portVb: params.vb !== undefined ? params.vb : state.design.portVb,
        portDiameter: params.diameter !== undefined ? params.diameter : state.design.portDiameter,
        numPorts: params.numPorts !== undefined ? params.numPorts : state.design.numPorts,
      },
      isDirty: true,
    })),

  setRoomParams: (params) =>
    set((state) => ({
      design: {
        ...state.design,
        roomParams: { ...state.design.roomParams, ...params },
      },
      isDirty: true,
    })),

  loadDesign: (design, name, projectId) =>
    set({
      design: { ...design },
      projectName: name ?? '',
      loadedProjectId: projectId ?? null,
      isDirty: false,
    }),

  clearDesign: () =>
    set({
      design: { ...DEFAULT_DESIGN_STATE, bands: getDefaultBands(2) },
      projectName: '',
      loadedProjectId: null,
      isDirty: false,
    }),

  markClean: () => set({ isDirty: false }),

  setProjectName: (name) => set({ projectName: name }),
}));
