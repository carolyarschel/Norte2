"use client";

import { create } from "zustand";
import type { Consultant, Project } from "@/types";
import { api } from "@/lib/api";

interface AppState {
  companyName: string;
  consultants: Consultant[];
  projects: Project[];
  loading: boolean;

  setCompanyName: (name: string) => void;
  fetchAll: () => Promise<void>;

  addConsultant: (c: Omit<Consultant, "id">) => Promise<void>;
  updateConsultant: (id: number, data: Partial<Consultant>) => Promise<void>;
  removeConsultant: (id: number) => Promise<void>;

  addProject: (p: Omit<Project, "id">) => Promise<void>;
  updateProject: (id: number, data: Partial<Project>) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  setProjectStatus: (id: number, status: Project["status"]) => Promise<void>;
}

export const useAppStore = create<AppState>()((set) => ({
  companyName: "Minha Consultoria",
  consultants: [],
  projects: [],
  loading: false,

  setCompanyName: (name) => set({ companyName: name }),

  // Carrega tudo do banco na inicialização
  fetchAll: async () => {
    set({ loading: true });
    const [consultants, projects] = await Promise.all([
      api.consultants.list(),
      api.projects.list(),
    ]);
    set({ consultants, projects, loading: false });
  },

  addConsultant: async (c) => {
    const created = await api.consultants.create(c);
    set((s) => ({ consultants: [...s.consultants, created] }));
  },
  updateConsultant: async (id, data) => {
    const updated = await api.consultants.update(id, data);
    set((s) => ({
      consultants: s.consultants.map((c) => (c.id === id ? updated : c)),
    }));
  },
  removeConsultant: async (id) => {
    await api.consultants.remove(id);
    set((s) => ({
      consultants: s.consultants.filter((c) => c.id !== id),
    }));
  },

  addProject: async (p) => {
    const created = await api.projects.create(p);
    set((s) => ({ projects: [...s.projects, created] }));
  },
  updateProject: async (id, data) => {
    const updated = await api.projects.update(id, data);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },
  removeProject: async (id) => {
    await api.projects.remove(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
  setProjectStatus: async (id, status) => {
    const updated = await api.projects.update(id, { status });
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },
}));