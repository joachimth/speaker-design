// Project state store (Zustand)
import { create } from 'zustand';
import type { Project, CabinetType } from '@/types';
import { getAllProjects, saveProject, deleteProject } from '@/db/database';

/** Handoff payload from CabinetMatch → SystemSimulation */
export interface SystemSimHandoff {
  bands: {
    driverId: string;
    role: 'low' | 'mid' | 'high';
    driverCount?: number;
    lowpassFreq: number;
    lowpassType: string;
    highpassFreq: number;
    highpassType: string;
    gain: number;
    polarity: 0 | 180;
    delay: number;
  }[];
  ways: 2 | 3;
  baffleWidth: number;
  baffleHeight: number;
  cabinetType: CabinetType;
  portFb: number | null;
  portVb: number | null;
  portDiameter: number;
  numPorts: number;
  projectName: string;
}

interface ProjectStore {
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  /** Handoff from CabinetMatch to SystemSimulation (consumed once on mount) */
  simHandoff: SystemSimHandoff | null;
  setCurrentProject: (project: Project | null) => void;
  setSimHandoff: (handoff: SystemSimHandoff | null) => void;
  loadProjects: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  projects: [],
  loading: false,
  error: null,
  simHandoff: null,

  setCurrentProject: (project) => set({ currentProject: project }),
  setSimHandoff: (handoff) => set({ simHandoff: handoff }),

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await getAllProjects();
      set({ projects, loading: false });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  saveCurrentProject: async () => {
    const project = get().currentProject;
    if (!project) return;
    project.updatedAt = Date.now();
    try {
      await saveProject(project);
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await deleteProject(id);
      const projects = get().projects.filter((p) => p.id !== id);
      set({ projects });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

// ---------------------------------------------------------------------------
// Export/import helpers (JSON file download/upload)
// ---------------------------------------------------------------------------

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error('Ugyldig JSON fil'));
      }
    };
    reader.onerror = () => reject(new Error('Kunne ikke læse fil'));
    reader.readAsText(file);
  });
}
