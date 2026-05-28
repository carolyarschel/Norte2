"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Consultant, Project } from "@/types";
import { SEED_CONSULTANTS, SEED_PROJECTS } from "@/lib/seed";

interface AppState {
  companyName: string;
  consultants: Consultant[];
  projects: Project[];

  setCompanyName: (name: string) => void;

  addConsultant: (c: Omit<Consultant, "id">) => void;
  updateConsultant: (id: number, data: Partial<Consultant>) => void;
  removeConsultant: (id: number) => void;

  addProject: (p: Omit<Project, "id">) => void;
  updateProject: (id: number, data: Partial<Project>) => void;
  removeProject: (id: number) => void;
  setProjectStatus: (id: number, status: Project["status"]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      companyName:  "Minha Consultoria",
      consultants:  SEED_CONSULTANTS,
      projects:     SEED_PROJECTS,

      setCompanyName: (name) => set({ companyName: name }),

      addConsultant: (c) =>
        set((s) => ({
          consultants: [...s.consultants, { ...c, id: Date.now() }],
        })),
      updateConsultant: (id, data) =>
        set((s) => ({
          consultants: s.consultants.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        })),
      removeConsultant: (id) =>
        set((s) => ({
          consultants: s.consultants.filter((c) => c.id !== id),
        })),

      addProject: (p) =>
        set((s) => ({
          projects: [...s.projects, { ...p, id: Date.now() }],
        })),
      updateProject: (id, data) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        })),
      removeProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      setProjectStatus: (id, status) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, status } : p
          ),
        })),
    }),
    {
      name: "alloc-platform-store", // localStorage key
    }
  )
);
