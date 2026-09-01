// Project state store (Zustand)
import { create } from 'zustand';
import type { Project, CabinetType, DesignState } from '@/types';

/** Handoff payload from CabinetMatch → SystemSimulation */
export interface SystemSimHandoff {
  bands: {
    driverId: string;
    role: 'low' | 'mid' | 'high';
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
  /** Loaded design from a saved project (consumed once on SystemSimulation mount) */
  loadedDesign: DesignState | null;
  setCurrentProject: (project: Project | null) => void;
  setSimHandoff: (handoff: SystemSimHandoff | null) => void;
  setLoadedDesign: (design: DesignState | null) => void;
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
  loadedDesign: null,

  setCurrentProject: (project) => set({ currentProject: project }),
  setSimHandoff: (handoff) => set({ simHandoff: handoff }),
  setLoadedDesign: (design) => set({ loadedDesign: design }),

  loadProjects: async () => {
    set({ loading: true });
    try {
      const { getAllProjects } = await import('@/db/database');
      const projects = await getAllProjects();
      set({ projects, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  saveCurrentProject: async () => {
    const project = get().currentProject;
    if (!project) return;
    project.updatedAt = Date.now();
    try {
      const { saveProject } = await import('@/db/database');
      await saveProject(project);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  deleteProject: async (id: string) => {
    try {
      const { deleteProject } = await import('@/db/database');
      await deleteProject(id);
      const projects = get().projects.filter((p) => p.id !== id);
      set({ projects });
    } catch (e: any) {
      set({ error: e.message });
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
      } catch (e) {
        reject(new Error('Ugyldig JSON fil'));
      }
    };
    reader.onerror = () => reject(new Error('Kunne ikke læse fil'));
    reader.readAsText(file);
  });
}
