// Project state store (Zustand)
import { create } from 'zustand';
import type { Project, CabinetType } from '@/types';

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
  setCurrentProject: (project: Project | null) => void;
  setSimHandoff: (handoff: SystemSimHandoff | null) => void;
  loadProjects: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
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
}));
