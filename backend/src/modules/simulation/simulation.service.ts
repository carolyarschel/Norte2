import { query } from "../../config/database";
import { projectRepo } from "../projects/project.repository";
import { consultantRepo } from "../consultants/consultant.repository";
import { NotFoundError } from "../../lib/errors";

const DAY_NAMES: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex" };
const LEVEL_LABELS: Record<string, string> = { senior: "Sênior", pleno: "Pleno", junior: "Júnior" };
const ALL_DAYS = [1, 2, 3, 4, 5];

interface ProposedAllocation {
  consultantId:   number;
  consultantName: string;
  weekday:        number;
  role:           string;
  slotType:       "level" | "pinned";
  slotDescription: string;
}

interface SimResult {
  feasible:    boolean;
  issues:      string[];
  suggestions: string[];
  proposed:    ProposedAllocation[];
}

/**
 * Returns weekdays a consultant is busy on confirmed/hot projects
 * (excluding a specific project, so we can re-simulate it).
 */
async function getBusyDays(
  consultantId: number,
  excludeProjectId: number,
): Promise<{ weekday: number; cadence: string }[]> {
  return query(
    `SELECT a.weekday, p.cadence
     FROM allocations a
     JOIN projects p ON a.project_id = p.id
     WHERE a.consultant_id = $1
       AND p.id != $2
       AND p.status NOT IN ('archived')
     ORDER BY a.weekday`,
    [consultantId, excludeProjectId]
  );
}

function pickDays(
  needed: number,
  preferred: number[],
  restrictions: number[],
  busy: number[],
  usedInProject: number[],
): number[] {
  const blocked = new Set([...restrictions, ...busy]);
  const validPreferred = preferred.filter((d) => !blocked.has(d));
  if (validPreferred.length >= needed) return validPreferred.slice(0, needed);

  const available = ALL_DAYS.filter((d) => !blocked.has(d));
  const sorted = [
    ...validPreferred,
    ...available.filter((d) => !validPreferred.includes(d) && !usedInProject.includes(d)),
    ...available.filter((d) => !validPreferred.includes(d) && usedInProject.includes(d)),
  ];
  return sorted.slice(0, needed);
}

export const simulationService = {
  async simulate(projectId: number): Promise<SimResult> {
    const project = await projectRepo.findById(projectId);
    if (!project) throw new NotFoundError("Projeto", projectId);

    const levelSlots  = await projectRepo.getLevelSlots(projectId);
    const pinnedSlots = await projectRepo.getPinnedSlots(projectId);
    const allConsultants = await consultantRepo.findAll();

    const issues: string[]      = [];
    const suggestions: string[] = [];
    const proposed: ProposedAllocation[] = [];
    const factor = project.cadence === "weekly" ? 1 : 0.5;
    const usedDays: number[] = [];

    // Track tentative state during simulation
    const tentativeLoad: Record<number, number>  = {};
    const tentativeDays: Record<number, number[]> = {};

    const getLoad = (cId: number) => {
      // Base load from existing allocations (excluding this project)
      const base = allConsultants.find((c) => c.id === cId);
      if (!base) return 999;
      return (tentativeLoad[cId] ?? 0);
    };

    // Pre-compute loads from existing allocations (excluding this project)
    for (const c of allConsultants) {
      const busy = await getBusyDays(c.id, projectId);
      tentativeLoad[c.id] = busy.length * (project.cadence === "weekly" ? 1 : 0.5);
      tentativeDays[c.id] = busy.map((b) => b.weekday);
    }

    const getBlockedDays = (cId: number): number[] => tentativeDays[cId] ?? [];

    // ── 1. Pinned slots ──────────────────────────────────────────────────────
    for (const slot of pinnedSlots) {
      const c = allConsultants.find((x) => x.id === slot.consultant_id);
      if (!c) {
        issues.push(`Consultor pinado #${slot.consultant_id} não encontrado`);
        continue;
      }

      const blocked = getBlockedDays(c.id);
      const days = pickDays(slot.days_per_week, slot.visit_days, c.restrictions, blocked, usedDays);

      if (days.length < slot.days_per_week) {
        const conflicting = (slot.visit_days.length ? slot.visit_days : ALL_DAYS)
          .filter((d) => blocked.includes(d));
        if (conflicting.length) {
          issues.push(`${c.name} já está em outro projeto na(s) ${conflicting.map((d) => DAY_NAMES[d]).join(", ")}`);
        } else {
          issues.push(`${c.name}: dias disponíveis insuficientes (precisa de ${slot.days_per_week})`);
        }
        continue;
      }

      const cost = days.length * factor;
      if ((tentativeLoad[c.id] ?? 0) + cost > c.max_days) {
        issues.push(`${c.name} ficaria acima da capacidade`);
        continue;
      }

      tentativeLoad[c.id] = (tentativeLoad[c.id] ?? 0) + cost;
      tentativeDays[c.id] = [...(tentativeDays[c.id] ?? []), ...days];
      days.forEach((d) => { if (!usedDays.includes(d)) usedDays.push(d); });

      for (const d of days) {
        proposed.push({
          consultantId: c.id, consultantName: c.name, weekday: d,
          role: c.is_leader ? "líder" : "consultor",
          slotType: "pinned",
          slotDescription: `${c.name} (específico)`,
        });
      }
    }

    // ── 2. Level slots ───────────────────────────────────────────────────────
    for (const slot of levelSlots) {
      const proposedIds = proposed.map((p) => p.consultantId);

      const candidates = allConsultants
        .filter((c) => {
          if (c.level !== slot.level) return false;
          if (slot.is_leader && !c.is_leader) return false;
          if (proposedIds.includes(c.id)) return false;
          return true;
        })
        .sort((a, b) => (tentativeLoad[a.id] ?? 0) - (tentativeLoad[b.id] ?? 0));

      if (!candidates.length) {
        issues.push(`Sem ${slot.is_leader ? "líder " : ""}${LEVEL_LABELS[slot.level]} disponível`);
        continue;
      }

      let filled = false;
      for (const c of candidates) {
        const blocked = getBlockedDays(c.id);
        const days = pickDays(slot.days_per_week, slot.visit_days, c.restrictions, blocked, usedDays);
        if (days.length < slot.days_per_week) continue;

        const cost = days.length * factor;
        if ((tentativeLoad[c.id] ?? 0) + cost > c.max_days) continue;

        tentativeLoad[c.id] = (tentativeLoad[c.id] ?? 0) + cost;
        tentativeDays[c.id] = [...(tentativeDays[c.id] ?? []), ...days];
        days.forEach((d) => { if (!usedDays.includes(d)) usedDays.push(d); });

        for (const d of days) {
          proposed.push({
            consultantId: c.id, consultantName: c.name, weekday: d,
            role: slot.is_leader ? "líder" : "consultor",
            slotType: "level",
            slotDescription: `${slot.is_leader ? "Líder " : ""}${LEVEL_LABELS[slot.level]}`,
          });
        }

        suggestions.push(
          `${LEVEL_LABELS[slot.level]}${slot.is_leader ? " (líder)" : ""}: ${c.name} — ${days.map((d) => DAY_NAMES[d]).join(", ")}`
        );
        filled = true;
        break;
      }

      if (!filled) {
        issues.push(`Sem consultor disponível para vaga de ${slot.is_leader ? "líder " : ""}${LEVEL_LABELS[slot.level]} (${slot.days_per_week}d/sem)`);
      }
    }

    return {
      feasible: issues.length === 0,
      issues,
      suggestions,
      proposed,
    };
  },
};
