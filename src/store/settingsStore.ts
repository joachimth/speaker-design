// Settings store (Zustand) for global app preferences
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UnitSystem = 'metric' | 'imperial';

interface SettingsStore {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
  toggleUnits: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      units: 'metric',
      setUnits: (u) => set({ units: u }),
      toggleUnits: () => set((s) => ({ units: s.units === 'metric' ? 'imperial' : 'metric' })),
    }),
    { name: 'speaker-design-settings' }
  )
);

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

const MM_TO_INCH = 1 / 25.4;
const CM2_TO_IN2 = 1 / 6.4516;
const L_TO_FT3 = 1 / 28.3168;

/** Convert mm to the active unit system. Returns [value, unitLabel]. */
export function convertLength(mm: number, units: UnitSystem): [number, string] {
  if (units === 'imperial') return [mm * MM_TO_INCH, 'in'];
  return [mm, 'mm'];
}

/** Convert liters to the active unit system. Returns [value, unitLabel]. */
export function convertVolume(liters: number, units: UnitSystem): [number, string] {
  if (units === 'imperial') return [liters * L_TO_FT3, 'ft³'];
  return [liters, 'L'];
}

/** Convert cm² to the active unit system. Returns [value, unitLabel]. */
export function convertArea(cm2: number, units: UnitSystem): [number, string] {
  if (units === 'imperial') return [cm2 * CM2_TO_IN2, 'in²'];
  return [cm2, 'cm²'];
}

/** Format a length value with unit. */
export function formatLength(mm: number, units: UnitSystem, decimals = 1): string {
  const [val, unit] = convertLength(mm, units);
  return `${val.toFixed(decimals)} ${unit}`;
}

/** Format a volume value with unit. */
export function formatVolume(liters: number, units: UnitSystem, decimals = 1): string {
  const [val, unit] = convertVolume(liters, units);
  return `${val.toFixed(decimals)} ${unit}`;
}

/** Format an area value with unit. */
export function formatArea(cm2: number, units: UnitSystem, decimals = 1): string {
  const [val, unit] = convertArea(cm2, units);
  return `${val.toFixed(decimals)} ${unit}`;
}
