import { consultantRepo, ConsultantRow } from "./consultant.repository";
import { NotFoundError } from "../../lib/errors";

/** Maps a DB row to the API response format. */
function toDTO(row: ConsultantRow) {
  return {
    id:           row.id,
    name:         row.name,
    level:        row.level,
    isLeader:     row.is_leader,
    maxDays:      row.max_days,
    restrictions: row.restrictions,
  };
}

export const consultantService = {
  async getAll() {
    const rows = await consultantRepo.findAll();
    return rows.map(toDTO);
  },

  async getById(id: number) {
    const row = await consultantRepo.findById(id);
    if (!row) throw new NotFoundError("Consultor", id);
    return toDTO(row);
  },

  async create(data: {
    name: string;
    level: string;
    isLeader: boolean;
    maxDays: number;
    restrictions: number[];
  }) {
    const row = await consultantRepo.create({
      name:         data.name,
      level:        data.level,
      is_leader:    data.isLeader,
      max_days:     data.maxDays,
      restrictions: data.restrictions,
    });
    return toDTO(row);
  },

  async update(id: number, data: Partial<{
    name: string;
    level: string;
    isLeader: boolean;
    maxDays: number;
    restrictions: number[];
  }>) {
    const existing = await consultantRepo.findById(id);
    if (!existing) throw new NotFoundError("Consultor", id);

    const row = await consultantRepo.update(id, {
      name:         data.name,
      level:        data.level,
      is_leader:    data.isLeader,
      max_days:     data.maxDays,
      restrictions: data.restrictions,
    });
    return toDTO(row!);
  },

  async remove(id: number) {
    const deleted = await consultantRepo.remove(id);
    if (!deleted) throw new NotFoundError("Consultor", id);
  },

  /** Returns the weekdays a consultant is already committed to. */
  async getBusyDays(id: number) {
    const existing = await consultantRepo.findById(id);
    if (!existing) throw new NotFoundError("Consultor", id);
    return consultantRepo.busyDays(id);
  },
};
