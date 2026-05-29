import { query } from "../../config/database";
import { projectRepo } from "../projects/project.repository";
import { consultantRepo, ConsultantRow } from "../consultants/consultant.repository";
import { NotFoundError } from "../../lib/errors";

const DAY_NAMES: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex" };
const LEVEL_LABELS: Record<string, string> = { senior: "Sênior", pleno: "Pleno", junior: "Júnior" };
const ALL_DAYS = [1, 2, 3, 4, 5];
const LEVEL_RANK: Record<string, number> = { junior: 0, pleno: 1, senior: 2 };

function meetsMinLevel(consultantLevel: string, requiredMin: string): boolean {
  return (LEVEL_RANK[consultantLevel] ?? 0) >= (LEVEL_RANK[requiredMin] ?? 0);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Date-aware conflict checking ────────────────────────────────────────────

interface CommittedEntry {
  consultantId: number;
  weekday: number;
  cadence: string;
  startDate: string;
  endDate: string;
  projectId: number;
}

/** Do two date ranges overlap? */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Are two cadences alternating biweekly (and thus never on the same actual week)? */
function isAlternating(cadenceA: string, cadenceB: string): boolean {
  return (
    (cadenceA === "biweekly_odd" && cadenceB === "biweekly_even") ||
    (cadenceA === "biweekly_even" && cadenceB === "biweekly_odd")
  );
}

/**
 * Returns weekdays that are BLOCKED for a consultant given a target project's dates/cadence.
 * A weekday is blocked only if there's another project that:
 *   1. Uses the same weekday for this consultant
 *   2. Has overlapping date range with the target project
 *   3. Is NOT alternating biweekly with the target project
 */
function getBlockedDays(
  consultantId: number,
  targetProject: { startDate: string; endDate: string; cadence: string },
  allCommitted: CommittedEntry[],
): number[] {
  const blocked = new Set<number>();
  for (const entry of allCommitted) {
    if (entry.consultantId !== consultantId) continue;
    // Check actual date overlap
    if (!rangesOverlap(targetProject.startDate, targetProject.endDate, entry.startDate, entry.endDate)) continue;
    // Check alternating biweekly
    if (isAlternating(targetProject.cadence, entry.cadence)) continue;
    blocked.add(entry.weekday);
  }
  return [...blocked];
}

/** Loads all committed allocations from the database (excluding specific project IDs). */
async function loadCommittedFromDB(excludeProjectIds: number[]): Promise<CommittedEntry[]> {
  if (excludeProjectIds.length === 0) {
    const rows = await query(
      `SELECT a.consultant_id, a.weekday, p.cadence, p.start_date, p.end_date, p.id as project_id
       FROM allocations a JOIN projects p ON a.project_id = p.id
       WHERE p.status != 'archived'`
    );
    return rows.map((r: any) => ({
      consultantId: r.consultant_id,
      weekday: r.weekday,
      cadence: r.cadence,
      startDate: r.start_date.toISOString().split("T")[0],
      endDate: r.end_date.toISOString().split("T")[0],
      projectId: r.project_id,
    }));
  }

  const placeholders = excludeProjectIds.map((_, i) => `$${i + 1}`).join(",");
  const rows = await query(
    `SELECT a.consultant_id, a.weekday, p.cadence, p.start_date, p.end_date, p.id as project_id
     FROM allocations a JOIN projects p ON a.project_id = p.id
     WHERE p.status != 'archived' AND p.id NOT IN (${placeholders})`,
    excludeProjectIds
  );
  return rows.map((r: any) => ({
    consultantId: r.consultant_id,
    weekday: r.weekday,
    cadence: r.cadence,
    startDate: r.start_date.toISOString().split("T")[0],
    endDate: r.end_date.toISOString().split("T")[0],
    projectId: r.project_id,
  }));
}

// ─── Day picking ─────────────────────────────────────────────────────────────

function pickDays(
  needed: number,
  mustInclude: number[],
  preferred: number[],
  blocked: Set<number>,
  projectUsedDays: number[],
  randomize: boolean,
): number[] {
  const mandatory = mustInclude.filter((d) => !blocked.has(d));
  if (mandatory.length > needed) return mandatory.slice(0, needed);

  const remaining = needed - mandatory.length;
  if (remaining === 0) return mandatory;

  const available = ALL_DAYS.filter((d) => !blocked.has(d) && !mandatory.includes(d));
  let candidates = [
    ...preferred.filter((d) => available.includes(d)),
    ...available.filter((d) => !preferred.includes(d) && !projectUsedDays.includes(d)),
    ...available.filter((d) => !preferred.includes(d) && projectUsedDays.includes(d)),
  ];
  candidates = [...new Set(candidates)];
  if (randomize) candidates = shuffle(candidates);

  return [...mandatory, ...candidates.slice(0, remaining)].sort();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProposedAllocation {
  consultantId: number;
  consultantName: string;
  weekday: number;
  role: string;
  slotType: "level" | "pinned";
  slotDescription: string;
}

/** Tentative allocation passed from a previously simulated project (for multi-project). */
interface TentativeAllocation {
  consultantId: number;
  weekday: number;
  cadence: string;
  startDate: string;
  endDate: string;
}

interface SimResult {
  feasible: boolean;
  issues: string[];
  suggestions: string[];
  proposed: ProposedAllocation[];
  /** If not feasible, the earliest Monday where it becomes feasible (null if not found). */
  earliestFeasibleDate: string | null;
}

// ─── Core simulation ────────────────────────────────────────────────────────

async function runSimulation(
  projectId: number,
  allConsultants: ConsultantRow[],
  committed: CommittedEntry[],
  randomize: boolean,
  projectOverrides?: { startDate?: string; endDate?: string },
): Promise<SimResult> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError("Projeto", projectId);

  const startDate = projectOverrides?.startDate ?? project.start_date.toISOString?.().split("T")[0] ?? project.start_date;
  const endDate = projectOverrides?.endDate ?? project.end_date.toISOString?.().split("T")[0] ?? project.end_date;

  const targetProject = { startDate, endDate, cadence: project.cadence };

  const levelSlots = await projectRepo.getLevelSlots(projectId);
  const pinnedSlots = await projectRepo.getPinnedSlots(projectId);

  const issues: string[] = [];
  const suggestions: string[] = [];
  const proposed: ProposedAllocation[] = [];
  const factor = project.cadence === "weekly" ? 1 : 0.5;
  const projectUsedDays: number[] = [];

  // Build blocked days per consultant (considering date overlap, not just weekday)
  const getBlocked = (cId: number): Set<number> => {
    const consultant = allConsultants.find((c) => c.id === cId);
    const restrictions = consultant?.restrictions ?? [];
    const busy = getBlockedDays(cId, targetProject, committed);
    return new Set([...restrictions, ...busy]);
  };

  // Track tentative load for capacity check
  const loadMap: Record<number, number> = {};
  for (const c of allConsultants) {
    // Count days this consultant is busy (from committed entries)
    const busyCount = committed.filter((e) => e.consultantId === c.id).length;
    loadMap[c.id] = busyCount * factor;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Resolve LEADERS
  // ═══════════════════════════════════════════════════════════════════════════

  const leaderSlots = levelSlots.filter((s) => s.is_leader);
  const nonLeaderSlots = levelSlots.filter((s) => !s.is_leader);
  const leaderDays: number[] = [];

  // 1a. Pinned leaders
  for (const slot of pinnedSlots) {
    const c = allConsultants.find((x) => x.id === slot.consultant_id);
    if (!c || !c.is_leader) continue;

    const blocked = getBlocked(c.id);
    const days = pickDays(slot.days_per_week, [], slot.visit_days, blocked, projectUsedDays, randomize);

    if (days.length < slot.days_per_week) {
      issues.push(`${c.name} (líder pinado): dias insuficientes`);
      continue;
    }
    const cost = days.length * factor;
    if (loadMap[c.id] + cost > c.max_days) {
      issues.push(`${c.name} ficaria acima da capacidade`);
      continue;
    }

    loadMap[c.id] += cost;
    days.forEach((d) => {
      if (!projectUsedDays.includes(d)) projectUsedDays.push(d);
      if (!leaderDays.includes(d)) leaderDays.push(d);
    });

    for (const d of days) {
      proposed.push({
        consultantId: c.id, consultantName: c.name, weekday: d,
        role: "líder", slotType: "pinned", slotDescription: `${c.name} (líder específico)`,
      });
    }
  }

  // 1b. Level leader slots
  for (const slot of leaderSlots) {
    const proposedIds = [...new Set(proposed.map((p) => p.consultantId))];
    let candidates = allConsultants.filter((c) => {
      if (!meetsMinLevel(c.level, slot.level)) return false;
      if (!c.is_leader) return false;
      if (proposedIds.includes(c.id)) return false;
      return true;
    });

    if (randomize) candidates = shuffle(candidates);
    else candidates.sort((a, b) => {
      const ae = a.level === slot.level ? 0 : 1;
      const be = b.level === slot.level ? 0 : 1;
      return ae !== be ? ae - be : loadMap[a.id] - loadMap[b.id];
    });

    let filled = false;
    for (const c of candidates) {
      const blocked = getBlocked(c.id);
      const days = pickDays(slot.days_per_week, [], slot.visit_days, blocked, projectUsedDays, randomize);
      if (days.length < slot.days_per_week) continue;

      const cost = days.length * factor;
      if (loadMap[c.id] + cost > c.max_days) continue;

      loadMap[c.id] += cost;
      days.forEach((d) => {
        if (!projectUsedDays.includes(d)) projectUsedDays.push(d);
        if (!leaderDays.includes(d)) leaderDays.push(d);
      });

      for (const d of days) {
        proposed.push({
          consultantId: c.id, consultantName: c.name, weekday: d,
          role: "líder", slotType: "level", slotDescription: `Líder ${LEVEL_LABELS[slot.level]}+`,
        });
      }
      suggestions.push(`Líder ${LEVEL_LABELS[slot.level]}+: ${c.name} (${LEVEL_LABELS[c.level]}) — ${days.map((d) => DAY_NAMES[d]).join(", ")}`);
      filled = true;
      break;
    }

    if (!filled) issues.push(`Sem líder ${LEVEL_LABELS[slot.level]}+ disponível (${slot.days_per_week}d/sem)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Resolve NON-LEADERS (must include leader's days)
  // ═══════════════════════════════════════════════════════════════════════════

  // 2a. Pinned non-leaders
  for (const slot of pinnedSlots) {
    const c = allConsultants.find((x) => x.id === slot.consultant_id);
    if (!c || c.is_leader) continue;

    const blocked = getBlocked(c.id);
    const days = pickDays(slot.days_per_week, leaderDays, slot.visit_days, blocked, projectUsedDays, randomize);

    if (days.length < slot.days_per_week) {
      issues.push(`${c.name} (pinado): dias insuficientes`);
      continue;
    }
    const cost = days.length * factor;
    if (loadMap[c.id] + cost > c.max_days) {
      issues.push(`${c.name} ficaria acima da capacidade`);
      continue;
    }

    loadMap[c.id] += cost;
    days.forEach((d) => { if (!projectUsedDays.includes(d)) projectUsedDays.push(d); });

    for (const d of days) {
      proposed.push({
        consultantId: c.id, consultantName: c.name, weekday: d,
        role: "consultor", slotType: "pinned", slotDescription: `${c.name} (específico)`,
      });
    }
  }

  // 2b. Level non-leader slots
  for (const slot of nonLeaderSlots) {
    const proposedIds = [...new Set(proposed.map((p) => p.consultantId))];
    let candidates = allConsultants.filter((c) => {
      if (!meetsMinLevel(c.level, slot.level)) return false;
      if (proposedIds.includes(c.id)) return false;
      return true;
    });

    if (randomize) candidates = shuffle(candidates);
    else candidates.sort((a, b) => {
      const ae = a.level === slot.level ? 0 : 1;
      const be = b.level === slot.level ? 0 : 1;
      return ae !== be ? ae - be : loadMap[a.id] - loadMap[b.id];
    });

    let filled = false;
    for (const c of candidates) {
      const blocked = getBlocked(c.id);
      const days = pickDays(slot.days_per_week, leaderDays, slot.visit_days, blocked, projectUsedDays, randomize);
      if (days.length < slot.days_per_week) continue;

      const cost = days.length * factor;
      if (loadMap[c.id] + cost > c.max_days) continue;

      loadMap[c.id] += cost;
      days.forEach((d) => { if (!projectUsedDays.includes(d)) projectUsedDays.push(d); });

      for (const d of days) {
        proposed.push({
          consultantId: c.id, consultantName: c.name, weekday: d,
          role: "consultor", slotType: "level", slotDescription: `${LEVEL_LABELS[slot.level]}+`,
        });
      }
      suggestions.push(`${LEVEL_LABELS[slot.level]}+: ${c.name} (${LEVEL_LABELS[c.level]}) — ${days.map((d) => DAY_NAMES[d]).join(", ")}`);
      filled = true;
      break;
    }

    if (!filled) issues.push(`Sem ${LEVEL_LABELS[slot.level]}+ disponível (${slot.days_per_week}d/sem)`);
  }

  return { feasible: issues.length === 0, issues, suggestions, proposed, earliestFeasibleDate: null };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const simulationService = {
  /**
   * Simulate one or more projects together.
   * For each project, considers date-aware conflicts and tentative allocations
   * from previously simulated projects in the batch.
   *
   * @param projectIds - project IDs to simulate (order matters: first = highest priority)
   * @param randomize  - shuffle candidate order for variety
   */
  async simulateBatch(
    projectIds: number[],
    randomize = false,
  ): Promise<Record<number, SimResult>> {
    const allConsultants = await consultantRepo.findAll();
    // Load committed allocations, excluding all projects being simulated
    const committed = await loadCommittedFromDB(projectIds);
    const results: Record<number, SimResult> = {};

    // Running list of tentative allocations from already-simulated projects in this batch
    const tentative: CommittedEntry[] = [];

    for (const projectId of projectIds) {
      const project = await projectRepo.findById(projectId);
      if (!project) {
        results[projectId] = {
          feasible: false,
          issues: ["Projeto não encontrado"],
          suggestions: [],
          proposed: [],
          earliestFeasibleDate: null,
        };
        continue;
      }

      const startDate = project.start_date.toISOString?.().split("T")[0] ?? String(project.start_date);
      const endDate = project.end_date.toISOString?.().split("T")[0] ?? String(project.end_date);

      // Merge DB committed + tentative from previous projects in batch
      const allCommitted = [...committed, ...tentative];

      // Run simulation
      const result = await runSimulation(projectId, allConsultants, allCommitted, randomize);

      // If feasible, add proposed allocations to tentative for next projects
      if (result.feasible) {
        for (const alloc of result.proposed) {
          tentative.push({
            consultantId: alloc.consultantId,
            weekday: alloc.weekday,
            cadence: project.cadence,
            startDate,
            endDate,
            projectId,
          });
        }
      } else {
        // Try to find earliest feasible start date (shift by 1 week at a time, up to 26 weeks)
        const originalDuration = (new Date(endDate).getTime() - new Date(startDate).getTime());

        for (let weeksOffset = 1; weeksOffset <= 26; weeksOffset++) {
          const newStart = new Date(new Date(startDate).getTime() + weeksOffset * 7 * 86400000);
          const newEnd = new Date(newStart.getTime() + originalDuration);
          const newStartStr = newStart.toISOString().split("T")[0];
          const newEndStr = newEnd.toISOString().split("T")[0];

          const retry = await runSimulation(
            projectId, allConsultants, allCommitted, false,
            { startDate: newStartStr, endDate: newEndStr }
          );

          if (retry.feasible) {
            result.earliestFeasibleDate = newStartStr;
            result.suggestions.push(
              `Data mais cedo viável: ${newStartStr} (${weeksOffset} semana${weeksOffset > 1 ? "s" : ""} depois)`
            );
            break;
          }
        }
      }

      results[projectId] = result;
    }

    return results;
  },
};
