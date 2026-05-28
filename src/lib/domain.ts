import type {
  Project, Consultant, ConsultantLoad, ConflictEntry,
  SimulationResult, SlotAllocation, ChipColor, Weekday,
  LevelSlot, PinnedSlot,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAY_NAMES: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex",
};

export const LEVEL_LABELS = {
  senior: "Sênior", pleno: "Pleno", junior: "Júnior",
} as const;

export const STATUS_META = {
  confirmed: { label: "Confirmado",       color: "#c0392b", bg: "rgba(192,57,43,0.1)"   },
  hot:       { label: "Prospecto Quente", color: "#e67e22", bg: "rgba(230,126,34,0.1)"  },
  cold:      { label: "Prospecto Frio",   color: "#7f8c8d", bg: "rgba(127,140,141,0.1)" },
  archived:  { label: "Arquivado",        color: "#aaa",    bg: "rgba(180,180,180,0.1)" },
} as const;

export const CADENCE_LABELS = {
  weekly:        "Semanal",
  biweekly_odd:  "Quinzenal (ímpares)",
  biweekly_even: "Quinzenal (pares)",
} as const;

export const PROJECT_COLORS: ChipColor[] = [
  { bg: "#d6eaf8", border: "#2e86c1", text: "#1a5276" },
  { bg: "#d5f5e3", border: "#1e8449", text: "#145a32" },
  { bg: "#fde8d8", border: "#ca6f1e", text: "#784212" },
  { bg: "#e8daef", border: "#7d3c98", text: "#4a235a" },
  { bg: "#fdf2d0", border: "#b7950b", text: "#7d6608" },
  { bg: "#d1f2eb", border: "#148f77", text: "#0e6655" },
  { bg: "#fadbd8", border: "#c0392b", text: "#922b21" },
  { bg: "#d6dbdf", border: "#5d6d7e", text: "#2e4057" },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function fmtDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export function jsDateToWeekday(date: Date): Weekday | null {
  const d = date.getDay();
  if (d === 0 || d === 6) return null;
  return d as Weekday;
}

// ─── Project helpers ──────────────────────────────────────────────────────────

export function projectVisitsOnDate(project: Project, date: Date): boolean {
  const start = new Date(project.startDate);
  const end   = new Date(project.endDate);
  if (date < start || date > end) return false;
  const weekday = jsDateToWeekday(date);
  if (!weekday) return false;
  if (!(project.visitDays ?? []).includes(weekday)) return false;
  if (project.cadence === "weekly") return true;
  const week = getISOWeek(date);
  if (project.cadence === "biweekly_odd")  return week % 2 === 1;
  if (project.cadence === "biweekly_even") return week % 2 === 0;
  return false;
}

/** Weekly cost of the project in days/week (0.5x for biweekly). */
export function projectDayCost(project: Project): number {
  const factor = project.cadence === "weekly" ? 1 : 0.5;
  return (project.visitDays ?? []).length * factor;
}

export function getProjectColor(projectId: number, projects: Project[]): ChipColor {
  const idx = projects.findIndex((p) => p.id === projectId);
  return PROJECT_COLORS[idx % PROJECT_COLORS.length];
}

// ─── Consultant helpers ───────────────────────────────────────────────────────

export function computeLoad(consultantId: number, projects: Project[]): ConsultantLoad {
  let total = 0;
  const list: Project[] = [];
  for (const p of projects) {
    if (p.status === "archived") continue;
    if (!(p.allocatedConsultants ?? []).includes(consultantId)) continue;
    // Cost = days they personally visit, not the whole project's visitDays
    const pinned = (p.pinnedSlots ?? []).find((s) => s.consultantId === consultantId);
    const factor = p.cadence === "weekly" ? 1 : 0.5;
    if (pinned) {
      total += pinned.daysPerWeek * factor;
    } else {
      // find which level slot they satisfy
      total += factor; // at least 1 day attribution if no pinned slot
    }
    list.push(p);
  }
  return { total, projects: list };
}

/** Returns remaining available days/week for a consultant. */
export function remainingCapacity(c: Consultant, projects: Project[]): number {
  return c.maxDays - computeLoad(c.id, projects).total;
}

/**
 * Returns the set of weekdays a consultant is already committed to
 * across all confirmed projects (respecting cadence).
 * biweekly projects occupy their days every OTHER week, so they
 * still block those days for any new weekly project.
 */
export function consultantBusyDays(consultantId: number, projects: Project[]): Weekday[] {
  const busy = new Set<Weekday>();
  for (const p of projects) {
    if (p.status === "archived") continue;
    if (!(p.allocatedConsultants ?? []).includes(consultantId)) continue;

    // Find which days this consultant specifically visits in this project
    const pinned = (p.pinnedSlots ?? []).find((s) => s.consultantId === consultantId);
    const days: Weekday[] = pinned?.visitDays?.length
      ? pinned.visitDays
      : (p.visitDays ?? []);

    days.forEach((d) => busy.add(d));
  }
  return Array.from(busy);
}

// ─── Conflict detection ───────────────────────────────────────────────────────

export function detectConflicts(projects: Project[]): ConflictEntry[] {
  const active = projects.filter((p) => p.status !== "archived");
  const out: ConflictEntry[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];

      // Find consultants present in both projects
      const sc = (a.allocatedConsultants ?? []).filter((c) =>
        (b.allocatedConsultants ?? []).includes(c)
      );
      if (!sc.length) continue;

      // Alternating biweekly cadences never overlap on the same week
      const alternating =
        (a.cadence === "biweekly_odd"  && b.cadence === "biweekly_even") ||
        (a.cadence === "biweekly_even" && b.cadence === "biweekly_odd");
      if (alternating) continue;

      // Date range must overlap
      const aStart = new Date(a.startDate), aEnd = new Date(a.endDate);
      const bStart = new Date(b.startDate), bEnd = new Date(b.endDate);
      if (!(aStart <= bEnd && bStart <= aEnd)) continue;

      // For each shared consultant, check if they visit BOTH projects on the SAME day
      const conflictingDays = new Set<Weekday>();
      for (const cId of sc) {
        const aPinned = (a.pinnedSlots ?? []).find((s) => s.consultantId === cId);
        const bPinned = (b.pinnedSlots ?? []).find((s) => s.consultantId === cId);

        // Days this consultant actually visits in each project
        const aDays: Weekday[] = aPinned?.visitDays?.length ? aPinned.visitDays : (a.visitDays ?? []);
        const bDays: Weekday[] = bPinned?.visitDays?.length ? bPinned.visitDays : (b.visitDays ?? []);

        aDays.filter((d) => bDays.includes(d)).forEach((d) => conflictingDays.add(d));
      }

      if (!conflictingDays.size) continue; // same consultant, different days — no conflict

      const sd = Array.from(conflictingDays) as Weekday[];
      out.push({
        a, b,
        sharedConsultants: sc,
        sharedDays: sd,
        severity: sc.length >= 2 ? "high" : "medium",
      });
    }
  }
  return out;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

/**
 * Picks the best days for a slot.
 * - preferredDays: explicitly requested by user (respected first)
 * - restrictions: days the consultant cannot visit (fixed constraint)
 * - busyDays: days the consultant is ALREADY committed to in other projects (hard block)
 * - projectUsedDays: days already assigned within THIS project (soft preference to spread)
 */
function pickDays(
  daysNeeded: number,
  preferredDays: Weekday[],
  restrictions: Weekday[],
  busyDays: Weekday[],       // ← NEW: hard block from other projects
  projectUsedDays: Weekday[],
): Weekday[] {
  const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5];

  // Hard blocks: restrictions + already busy in another project on same day
  const hardBlocked = new Set([...restrictions, ...busyDays]);

  // Validate preferred days against hard blocks
  const validPreferred = preferredDays.filter((d) => !hardBlocked.has(d));
  if (validPreferred.length >= daysNeeded) return validPreferred.slice(0, daysNeeded);

  // Fill remaining from available days not hard-blocked
  const available = ALL_DAYS.filter((d) => !hardBlocked.has(d));
  const sorted = [
    ...validPreferred,
    ...available.filter((d) => !validPreferred.includes(d) && !projectUsedDays.includes(d)),
    ...available.filter((d) => !validPreferred.includes(d) && projectUsedDays.includes(d)),
  ];
  return sorted.slice(0, daysNeeded);
}

/**
 * Full simulation: for each slot (level or pinned), finds the best consultant
 * (most idle first, respecting the one-project-per-day rule), picks days if
 * not specified, and reports issues.
 */
export function simulateProject(
  project: Project,
  consultants: Consultant[],
  confirmedProjects: Project[],
): SimulationResult {
  const issues: string[]        = [];
  const suggestions: string[]   = [];
  const proposed: SlotAllocation[] = [];
  const factor = project.cadence === "weekly" ? 1 : 0.5;
  const projectUsedDays: Weekday[] = [...(project.visitDays ?? [])];

  // Track tentative load and day usage per consultant during this simulation
  const tentativeLoad: Record<number, number>    = {};
  const tentativeDays: Record<number, Weekday[]> = {};

  const getEffectiveLoad = (cId: number) =>
    computeLoad(cId, confirmedProjects).total + (tentativeLoad[cId] ?? 0);

  // Days a consultant is already committed to (confirmed projects + tentative in this sim)
  const getBlockedDays = (cId: number): Weekday[] => {
    const confirmed = consultantBusyDays(cId, confirmedProjects);
    const tentative = tentativeDays[cId] ?? [];
    return [...new Set([...confirmed, ...tentative])];
  };

  // ── 1. Pinned slots ────────────────────────────────────────────────────────
  for (const slot of (project.pinnedSlots ?? [])) {
    const c = consultants.find((x) => x.id === slot.consultantId);
    if (!c) {
      issues.push(`Consultor pinado (ID ${slot.consultantId}) não encontrado`);
      continue;
    }

    const blockedDays = getBlockedDays(c.id);
    const days = pickDays(slot.daysPerWeek, slot.visitDays ?? [], c.restrictions, blockedDays, projectUsedDays);

    if (days.length < slot.daysPerWeek) {
      // Find out why — day conflict or just unavailability
      const conflictDays = (slot.visitDays ?? []).filter((d) => blockedDays.includes(d));
      if (conflictDays.length) {
        issues.push(
          `${c.name} já está em outro projeto na(s) ${conflictDays.map((d) => DAY_NAMES[d]).join(", ")}`
        );
      } else {
        issues.push(`${c.name}: dias disponíveis insuficientes (precisa de ${slot.daysPerWeek})`);
      }
    }

    const cost = days.length * factor;
    if (getEffectiveLoad(c.id) + cost > c.maxDays) {
      issues.push(`${c.name} ficaria acima da capacidade (${(getEffectiveLoad(c.id) + cost).toFixed(1)}/${c.maxDays}d)`);
    } else {
      tentativeLoad[c.id] = (tentativeLoad[c.id] ?? 0) + cost;
      tentativeDays[c.id] = [...(tentativeDays[c.id] ?? []), ...days];
    }

    days.forEach((d) => { if (!projectUsedDays.includes(d)) projectUsedDays.push(d); });
    proposed.push({ slot, consultant: c, days });
  }

  // ── 2. Level slots ─────────────────────────────────────────────────────────
  for (const slot of (project.levelSlots ?? [])) {
    const alreadyProposedIds = proposed.map((p) => p.consultant.id);

    const candidates = consultants
      .filter((c) => {
        if (c.level !== slot.level) return false;
        if (slot.isLeader && !c.isLeader) return false;
        if (alreadyProposedIds.includes(c.id)) return false;
        return true;
      })
      .sort((a, b) => getEffectiveLoad(a.id) - getEffectiveLoad(b.id)); // most idle first

    if (!candidates.length) {
      issues.push(`Sem ${slot.isLeader ? "líder " : ""}${LEVEL_LABELS[slot.level]} disponível`);
      continue;
    }

    let filled = false;
    for (const c of candidates) {
      const blockedDays = getBlockedDays(c.id);
      const days = pickDays(slot.daysPerWeek, slot.visitDays ?? [], c.restrictions, blockedDays, projectUsedDays);

      if (days.length < slot.daysPerWeek) continue; // can't fit — try next candidate

      const cost = days.length * factor;
      if (getEffectiveLoad(c.id) + cost > c.maxDays) continue;

      tentativeLoad[c.id] = (tentativeLoad[c.id] ?? 0) + cost;
      tentativeDays[c.id] = [...(tentativeDays[c.id] ?? []), ...days];
      days.forEach((d) => { if (!projectUsedDays.includes(d)) projectUsedDays.push(d); });
      proposed.push({ slot, consultant: c, days });
      suggestions.push(
        `${LEVEL_LABELS[slot.level]}${slot.isLeader ? " (líder)" : ""}: sugerido ${c.name} — ${days.map((d) => DAY_NAMES[d]).join(", ")} (${days.length}x/sem)`
      );
      filled = true;
      break;
    }

    if (!filled) {
      issues.push(
        `Sem consultor disponível (sem conflito de dia) para vaga de ${slot.isLeader ? "líder " : ""}${LEVEL_LABELS[slot.level]} (${slot.daysPerWeek}d/sem)`
      );
    }
  }

  return {
    feasible: issues.length === 0,
    issues,
    suggestions,
    proposedAllocations: proposed,
  };
}
