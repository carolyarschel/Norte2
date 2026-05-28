import { projectRepo, ProjectRow, LevelSlotRow, PinnedSlotRow, AllocationRow } from "./project.repository";
import { NotFoundError } from "../../lib/errors";

function projectToDTO(
  row: ProjectRow,
  levelSlots: LevelSlotRow[],
  pinnedSlots: PinnedSlotRow[],
  allocations: AllocationRow[],
) {
  return {
    id:        row.id,
    acronym:   row.acronym,
    client:    row.client,
    status:    row.status,
    startDate: row.start_date,
    endDate:   row.end_date,
    cadence:   row.cadence,
    visitDays: row.visit_days,
    levelSlots: levelSlots.map((s) => ({
      id:                    s.id,
      level:                 s.level,
      isLeader:              s.is_leader,
      daysPerWeek:           s.days_per_week,
      visitDays:             s.visit_days,
      assignedConsultantId:  s.assigned_consultant_id,
      assignedDays:          s.assigned_days,
    })),
    pinnedSlots: pinnedSlots.map((s) => ({
      id:           s.id,
      consultantId: s.consultant_id,
      daysPerWeek:  s.days_per_week,
      visitDays:    s.visit_days,
      assignedDays: s.assigned_days,
    })),
    allocations: allocations.map((a) => ({
      id:           a.id,
      consultantId: a.consultant_id,
      weekday:      a.weekday,
      role:         a.role,
    })),
    allocatedConsultants: [...new Set(allocations.map((a) => a.consultant_id))],
  };
}

async function getFullProject(id: number) {
  const row = await projectRepo.findById(id);
  if (!row) throw new NotFoundError("Projeto", id);

  const [levelSlots, pinnedSlots, allocations] = await Promise.all([
    projectRepo.getLevelSlots(id),
    projectRepo.getPinnedSlots(id),
    projectRepo.getAllocations(id),
  ]);

  return projectToDTO(row, levelSlots, pinnedSlots, allocations);
}

export const projectService = {
  async getAll() {
    const rows = await projectRepo.findAll();
    const results = await Promise.all(
      rows.map(async (row) => {
        const [ls, ps, al] = await Promise.all([
          projectRepo.getLevelSlots(row.id),
          projectRepo.getPinnedSlots(row.id),
          projectRepo.getAllocations(row.id),
        ]);
        return projectToDTO(row, ls, ps, al);
      })
    );
    return results;
  },

  async getById(id: number) {
    return getFullProject(id);
  },

  async create(data: {
    acronym: string; client: string; status?: string;
    startDate: string; endDate: string; cadence?: string;
    levelSlots?: { level: string; isLeader: boolean; daysPerWeek: number; visitDays: number[] }[];
    pinnedSlots?: { consultantId: number; daysPerWeek: number; visitDays: number[] }[];
  }) {
    const row = await projectRepo.create({
      acronym:    data.acronym,
      client:     data.client,
      status:     data.status ?? "cold",
      start_date: data.startDate,
      end_date:   data.endDate,
      cadence:    data.cadence ?? "weekly",
      visit_days: [],
    });

    // Insert level slots
    for (const slot of (data.levelSlots ?? [])) {
      await projectRepo.addLevelSlot(row.id, {
        level:         slot.level,
        is_leader:     slot.isLeader,
        days_per_week: slot.daysPerWeek,
        visit_days:    slot.visitDays,
      });
    }

    // Insert pinned slots
    for (const slot of (data.pinnedSlots ?? [])) {
      await projectRepo.addPinnedSlot(row.id, {
        consultant_id: slot.consultantId,
        days_per_week: slot.daysPerWeek,
        visit_days:    slot.visitDays,
      });
    }

    return getFullProject(row.id);
  },

  async update(id: number, data: Partial<{
    acronym: string; client: string; status: string;
    startDate: string; endDate: string; cadence: string;
  }>) {
    const existing = await projectRepo.findById(id);
    if (!existing) throw new NotFoundError("Projeto", id);

    await projectRepo.update(id, {
      acronym:    data.acronym,
      client:     data.client,
      status:     data.status,
      start_date: data.startDate,
      end_date:   data.endDate,
      cadence:    data.cadence,
    });

    return getFullProject(id);
  },

  async remove(id: number) {
    const deleted = await projectRepo.remove(id);
    if (!deleted) throw new NotFoundError("Projeto", id);
  },

  /** Set allocations with one-consultant-per-day enforcement. */
  async setAllocations(
    projectId: number,
    allocations: { consultantId: number; weekday: number; role: string }[],
  ) {
    const project = await projectRepo.findById(projectId);
    if (!project) throw new NotFoundError("Projeto", projectId);

    const dbAllocations = allocations.map((a) => ({
      consultant_id: a.consultantId,
      weekday:       a.weekday,
      role:          a.role,
    }));

    await projectRepo.setAllocations(projectId, dbAllocations, project.cadence);
    return getFullProject(projectId);
  },

  async clearAllocations(projectId: number) {
    const project = await projectRepo.findById(projectId);
    if (!project) throw new NotFoundError("Projeto", projectId);
    await projectRepo.removeAllocations(projectId);
    return getFullProject(projectId);
  },
};
