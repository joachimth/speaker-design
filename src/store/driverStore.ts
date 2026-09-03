// Driver state store (Zustand)
import { create } from 'zustand';
import type { Driver } from '@/types';
import { getAllDrivers, saveDriver, deleteDriver } from '@/db/database';

interface DriverStore {
  drivers: Driver[];
  loading: boolean;
  error: string | null;
  loadDrivers: () => Promise<void>;
  addDriver: (driver: Driver) => Promise<void>;
  updateDriver: (driver: Driver) => Promise<void>;
  removeDriver: (id: string) => Promise<void>;
}

export const useDriverStore = create<DriverStore>((set, get) => ({
  drivers: [],
  loading: false,
  error: null,

  loadDrivers: async () => {
    set({ loading: true, error: null });
    try {
      const drivers = await getAllDrivers();
      set({ drivers, loading: false });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  addDriver: async (driver: Driver) => {
    try {
      await saveDriver(driver);
      await get().loadDrivers();
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  updateDriver: async (driver: Driver) => {
    driver.updatedAt = Date.now();
    try {
      await saveDriver(driver);
      await get().loadDrivers();
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  removeDriver: async (id: string) => {
    try {
      await deleteDriver(id);
      await get().loadDrivers();
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
