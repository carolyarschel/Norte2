import { query, queryOne, pool } from "../../config/database";

export interface ProjectRow {
  id: number;
  acronym: string;
  client: string;
  status: string;
  start_date: string;
  end_date: string;
  cadence: string;
  visit_days: number[];
  created_at: Date;
  updated_at: Date;
}

export interface LevelSlotRow {
  id: number;
  project_id: number;
  level: string;
  is_leader: boolean;
  days_per_week: number;
  visit_days: number[];
  assigned_consultant_id: number | null;
  assigned_days: number[];
}

export interface PinnedSlotRow {
  id: number;
  project_id: number;
  consultant_id: number;
  days_per_week: number;
  visit_days: number[];
  assigned_days: number[];
}

export interface AllocationRow {
  id: number;
  project_id: number;
  consultant_id: number;
  weekday: number;
  role: string;
}

export const projectRepo = {
  // ── Projects CRUD ──────────────────────────────────────────────────────────

  async findAll(): Promise<ProjectRow[]> {
    return query<ProjectRow>("SELECT * FROM projects ORDER BY id");
  },

  async findById(id: number): Promise<ProjectRow | null> {
    return queryOne<ProjectRow>("SELECT * FROM projects WHERE id = $1", [id]);
  },

  async create(data: {
    acronym: string; client: string; status: string;
    start_date: string; end_date: string; cadence: string;
    visit_days: number[];
  }): Promise<ProjectRow> {
    const [row] = await query<ProjectRow>(
      `INSERT INTO projects (acronym, client, status, start_date, end_date, cadence, visit_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.acronym, data.client, data.status, data.start_date, data.end_date, data.cadence, data.visit_days]
    );
    return row;
  },

  async update(id: number, data: Partial<{
    acronym: string; client: string; status: string;
    start_date: string; end_date: string; cadence: string;
    visit_days: number[];
  }>): Promise<ProjectRow | null> {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.acronym !== undefined)    { sets.push(`acronym = $${idx++}`);    vals.push(data.acronym); }
    if (data.client !== undefined)     { sets.push(`client = $${idx++}`);     vals.push(data.client); }
    if (data.status !== undefined)     { sets.push(`status = $${idx++}`);     vals.push(data.status); }
    if (data.start_date !== undefined) { sets.push(`start_date = $${idx++}`); vals.push(data.start_date); }
    if (data.end_date !== undefined)   { sets.push(`end_date = $${idx++}`);   vals.push(data.end_date); }
    if (data.cadence !== undefined)    { sets.push(`cadence = $${idx++}`);    vals.push(data.cadence); }
    if (data.visit_days !== undefined) { sets.push(`visit_days = $${idx++}`); vals.push(data.visit_days); }

    if (!sets.length) return this.findById(id);

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const [row] = await query<ProjectRow>(
      `UPDATE projects SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals
    );
    return row ?? null;
  },

  async remove(id: number): Promise<boolean> {
    const [row] = await query("DELETE FROM projects WHERE id = $1 RETURNING id", [id]);
    return !!row;
  },

  // ── Level slots ────────────────────────────────────────────────────────────

  async getLevelSlots(projectId: number): Promise<LevelSlotRow[]> {
    return query<LevelSlotRow>(
      "SELECT * FROM level_slots WHERE project_id = $1 ORDER BY id", [projectId]
    );
  },

  async addLevelSlot(projectId: number, data: {
    level: string; is_leader: boolean; days_per_week: number; visit_days: number[];
  }): Promise<LevelSlotRow> {
    const [row] = await query<LevelSlotRow>(
      `INSERT INTO level_slots (project_id, level, is_leader, days_per_week, visit_days)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, data.level, data.is_leader, data.days_per_week, data.visit_days]
    );
    return row;
  },

  async removeLevelSlot(slotId: number): Promise<boolean> {
    const [row] = await query("DELETE FROM level_slots WHERE id = $1 RETURNING id", [slotId]);
    return !!row;
  },

  // ── Pinned slots ───────────────────────────────────────────────────────────

  async getPinnedSlots(projectId: number): Promise<PinnedSlotRow[]> {
    return query<PinnedSlotRow>(
      "SELECT * FROM pinned_slots WHERE project_id = $1 ORDER BY id", [projectId]
    );
  },

  async addPinnedSlot(projectId: number, data: {
    consultant_id: number; days_per_week: number; visit_days: number[];
  }): Promise<PinnedSlotRow> {
    const [row] = await query<PinnedSlotRow>(
      `INSERT INTO pinned_slots (project_id, consultant_id, days_per_week, visit_days)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [projectId, data.consultant_id, data.days_per_week, data.visit_days]
    );
    return row;
  },

  async removePinnedSlot(slotId: number): Promise<boolean> {
    const [row] = await query("DELETE FROM pinned_slots WHERE id = $1 RETURNING id", [slotId]);
    return !!row;
  },

  // ── Allocations ────────────────────────────────────────────────────────────

  async getAllocations(projectId: number): Promise<AllocationRow[]> {
    return query<AllocationRow>(
      "SELECT * FROM allocations WHERE project_id = $1 ORDER BY weekday", [projectId]
    );
  },

  /**
   * Set allocations for a project atomically.
   * Deletes existing allocations and inserts new ones in a transaction.
   * Checks the one-consultant-per-day rule before inserting.
   */
  async setAllocations(
    projectId: number,
    allocations: { consultant_id: number; weekday: number; role: string }[],
    projectCadence: string,
  ): Promise<AllocationRow[]> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Remove old allocations for this project
      await client.query("DELETE FROM allocations WHERE project_id = $1", [projectId]);

      const inserted: AllocationRow[] = [];
      for (const alloc of allocations) {
        // Check: is this consultant already on another project on this weekday?
        const { rows: conflicts } = await client.query(
          `SELECT a.*, p.cadence
           FROM allocations a JOIN projects p ON a.project_id = p.id
           WHERE a.consultant_id = $1 AND a.weekday = $2 AND p.status != 'archived'`,
          [alloc.consultant_id, alloc.weekday]
        );

        for (const conflict of conflicts) {
          // If both are biweekly with alternating cadences, they don't actually conflict
          const alternating =
            (projectCadence === "biweekly_odd" && conflict.cadence === "biweekly_even") ||
            (projectCadence === "biweekly_even" && conflict.cadence === "biweekly_odd");

          if (!alternating) {
            await client.query("ROLLBACK");
            throw {
              statusCode: 409,
              message: `Consultor #${alloc.consultant_id} já está alocado em outro projeto na ${["","seg","ter","qua","qui","sex"][alloc.weekday]}`,
              name: "AppError",
            };
          }
        }

        const { rows } = await client.query(
          `INSERT INTO allocations (project_id, consultant_id, weekday, role)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [projectId, alloc.consultant_id, alloc.weekday, alloc.role]
        );
        inserted.push(rows[0]);
      }

      // Update the project's visit_days as the union of all allocated weekdays
      const allDays = [...new Set(allocations.map((a) => a.weekday))].sort();
      await client.query(
        "UPDATE projects SET visit_days = $1, updated_at = NOW() WHERE id = $2",
        [allDays, projectId]
      );

      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async removeAllocations(projectId: number): Promise<void> {
    await query("DELETE FROM allocations WHERE project_id = $1", [projectId]);
    await query("UPDATE projects SET visit_days = '{}', updated_at = NOW() WHERE id = $1", [projectId]);
  },
};
