// Project state store (Zustand)
import { create } from 'zustand';
import type { Project } from '@/types';

interface ProjectStore {
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  loadProjects: () => Promise<void>;
  saveCurrentProject: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  projects: [],
  loading: false,
  error: null,

  setCurrentProject: (project) => set({ currentProject: project }),

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
