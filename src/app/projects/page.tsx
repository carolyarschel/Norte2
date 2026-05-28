"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DAY_NAMES, CADENCE_LABELS, LEVEL_LABELS } from "@/lib/domain";
import { Avatar, StatusBadge, ChipGroup } from "@/components/ui";
import type { Project, Weekday, Cadence, ProjectStatus, LevelSlot, PinnedSlot, ConsultantLevel } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormLevelSlot = {
  id: string; // local key for React
  level: ConsultantLevel;
  isLeader: boolean;
  daysPerWeek: number;
  visitDays: Weekday[];
};

type FormPinnedSlot = {
  id: string;
  consultantId: number | null;
  daysPerWeek: number;
  visitDays: Weekday[];
};

type FormState = {
  acronym: string;
  client: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  cadence: Cadence;
  levelSlots: FormLevelSlot[];
  pinnedSlots: FormPinnedSlot[];
};

const EMPTY_FORM: FormState = {
  acronym: "", client: "", status: "cold",
  startDate: "", endDate: "", cadence: "weekly",
  levelSlots: [], pinnedSlots: [],
};

const STATUS_FILTERS: [ProjectStatus | "all", string][] = [
  ["all","Todos"],["confirmed","Confirmados"],["hot","Quentes"],["cold","Frios"],
];

const LEVEL_OPTIONS: ConsultantLevel[] = ["junior","pleno","senior"];

function newLevelSlot(): FormLevelSlot {
  return { id: String(Date.now() + Math.random()), level: "pleno", isLeader: false, daysPerWeek: 1, visitDays: [] };
}

function newPinnedSlot(): FormPinnedSlot {
  return { id: String(Date.now() + Math.random()), consultantId: null, daysPerWeek: 1, visitDays: [] };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DaySelector({ selected, onChange }: { selected: Weekday[]; onChange: (d: Weekday[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {([1,2,3,4,5] as Weekday[]).map((d) => (
        <div
          key={d}
          className={`chip ${selected.includes(d) ? "selected" : ""}`}
          style={{ padding: "3px 9px", fontSize: 11 }}
          onClick={() =>
            onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d])
          }
        >
          {DAY_NAMES[d]}
        </div>
      ))}
      <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center", marginLeft: 4 }}>
        {selected.length === 0 ? "(simulação escolhe)" : ""}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { consultants, projects, addProject, setProjectStatus, removeProject } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // ── Level slots ──────────────────────────────────────────────────────────

  function addLevelSlot() {
    setForm((f) => ({ ...f, levelSlots: [...f.levelSlots, newLevelSlot()] }));
  }

  function updateLevelSlot(id: string, patch: Partial<FormLevelSlot>) {
    setForm((f) => ({
      ...f,
      levelSlots: f.levelSlots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function removeLevelSlot(id: string) {
    setForm((f) => ({ ...f, levelSlots: f.levelSlots.filter((s) => s.id !== id) }));
  }

  // ── Pinned slots ─────────────────────────────────────────────────────────

  function addPinnedSlot() {
    setForm((f) => ({ ...f, pinnedSlots: [...f.pinnedSlots, newPinnedSlot()] }));
  }

  function updatePinnedSlot(id: string, patch: Partial<FormPinnedSlot>) {
    setForm((f) => ({
      ...f,
      pinnedSlots: f.pinnedSlots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function removePinnedSlot(id: string) {
    setForm((f) => ({ ...f, pinnedSlots: f.pinnedSlots.filter((s) => s.id !== id) }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function save() {
    if (!form.acronym.trim() || !form.client.trim()) return;

    const levelSlots: LevelSlot[] = form.levelSlots.map((s) => ({
      level: s.level, isLeader: s.isLeader,
      daysPerWeek: s.daysPerWeek, visitDays: s.visitDays,
    }));

    const pinnedSlots: PinnedSlot[] = form.pinnedSlots
      .filter((s) => s.consultantId !== null)
      .map((s) => ({
        consultantId: s.consultantId!, daysPerWeek: s.daysPerWeek, visitDays: s.visitDays,
      }));

    // Derive visitDays as union of all specified days
    const allDays = new Set<Weekday>([
      ...levelSlots.flatMap((s) => s.visitDays),
      ...pinnedSlots.flatMap((s) => s.visitDays),
    ]);

    const pinnedConsultantIds = pinnedSlots.map((s) => s.consultantId);

    addProject({
      acronym: form.acronym, client: form.client, status: form.status,
      startDate: form.startDate, endDate: form.endDate, cadence: form.cadence,
      levelSlots, pinnedSlots,
      visitDays: Array.from(allDays).sort() as Weekday[],
      allocatedConsultants: pinnedConsultantIds,
    });

    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Projetos</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo Projeto</button>
      </div>

      <div className="page-content">
        <div className="tabs">
          {STATUS_FILTERS.map(([v, l]) => (
            <button key={v} className={`tab-btn ${filter === v ? "active" : ""}`} onClick={() => setFilter(v as any)}>{l}</button>
          ))}
        </div>

        <div className="grid-2">
          {filtered.map((p) => {
            const totalSlots = (p.levelSlots ?? []).length + (p.pinnedSlots ?? []).length;
            return (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-hd)", fontSize: 20, fontWeight: 800, color: "var(--red)", letterSpacing: "0.01em" }}>{p.acronym}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 1 }}>{p.client}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                {/* Demand summary */}
                <div style={{ marginBottom: 8 }}>
                {(p.levelSlots ?? []).map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)", display: "inline-block", flexShrink: 0 }} />
                      {s.isLeader ? "Líder " : ""}{LEVEL_LABELS[s.level]} — {s.daysPerWeek}x/sem
                      {(s.visitDays ?? []).length > 0 && <span style={{ color: "#2e86c1" }}> ({(s.visitDays ?? []).map((d) => DAY_NAMES[d]).join(", ")})</span>}
                    </div>
                  ))}
                  {(p.pinnedSlots ?? []).map((s, i) => {
                    const c = consultants.find((x) => x.id === s.consultantId);
                    return (
                      <div key={i} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", display: "inline-block", flexShrink: 0 }} />
                        {c?.name ?? "?"} — {s.daysPerWeek}x/sem
                        {(s.visitDays ?? []).length > 0 && <span style={{ color: "#2e86c1" }}> ({(s.visitDays ?? []).map((d) => DAY_NAMES[d]).join(", ")})</span>}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                  <span className="cadence-chip">{CADENCE_LABELS[p.cadence]}</span>
                  {(p.visitDays ?? []).length > 0
                    ? (p.visitDays ?? []).map((d) => <span key={d} className="day-chip">{DAY_NAMES[d]}</span>)
                    : <span style={{ fontSize: 11, color: "var(--muted)" }}>Dias a definir</span>
                  }
                </div>

                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                  {p.startDate} → {p.endDate}
                </div>

                {(p.allocatedConsultants ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 10 }}>
                    {(p.allocatedConsultants ?? []).map((cId) => {
                      const c = consultants.find((x) => x.id === cId);
                      return c ? <Avatar key={cId} name={c.name} index={consultants.indexOf(c)} size={25} /> : null;
                    })}
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{(p.allocatedConsultants ?? []).length} alocados</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 7 }}>
                  {p.status !== "confirmed" && (
                    <button className="btn btn-primary btn-sm" onClick={() => setProjectStatus(p.id, "confirmed")}>✓ Confirmar</button>
                  )}
                  {p.status !== "archived" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setProjectStatus(p.id, "archived")}>Arquivar</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => removeProject(p.id)}>Excluir</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-state" style={{ gridColumn: "1/-1" }}>Nenhum projeto</div>}
        </div>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ width: 660 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Novo Projeto</div>

            {/* Basic info */}
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Sigla</label>
                <input className="form-input" value={form.acronym}
                  onChange={(e) => setForm((f) => ({ ...f, acronym: e.target.value.toUpperCase().slice(0, 5) }))}
                  placeholder="Ex: TDG" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}>
                  <option value="cold">Prospecto Frio</option>
                  <option value="hot">Prospecto Quente</option>
                  <option value="confirmed">Confirmado</option>
                </select>
              </div>
              <div className="form-group full">
                <label className="form-label">Empresa Cliente</label>
                <input className="form-input" value={form.client}
                  onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                  placeholder="Ex: Banco Alfa" />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Início</label>
                <input className="form-input" type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Fim</label>
                <input className="form-input" type="date" value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label className="form-label">Cadência</label>
                <select className="form-select" value={form.cadence}
                  onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly_odd">Quinzenal (semanas ímpares)</option>
                  <option value="biweekly_even">Quinzenal (semanas pares)</option>
                </select>
              </div>
            </div>

            {/* ── Level slots ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Vagas por Nível</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Qualquer consultor que se encaixe no perfil</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={addLevelSlot}>+ Adicionar vaga</button>
              </div>

              {form.levelSlots.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>Nenhuma vaga por nível adicionada.</div>
              )}

              {form.levelSlots.map((slot) => (
                <div key={slot.id} style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Nível</label>
                      <select className="form-select" value={slot.level}
                        onChange={(e) => updateLevelSlot(slot.id, { level: e.target.value as ConsultantLevel })}>
                        {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dias/semana</label>
                      <input className="form-input" type="number" min={1} max={5} value={slot.daysPerWeek}
                        onChange={(e) => updateLevelSlot(slot.id, { daysPerWeek: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Líder?</label>
                      <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                        {["Sim","Não"].map((o) => (
                          <div key={o} className={`chip ${(o === "Sim") === slot.isLeader ? "selected" : ""}`}
                            style={{ padding: "5px 10px", fontSize: 12 }}
                            onClick={() => updateLevelSlot(slot.id, { isLeader: o === "Sim" })}>
                            {o}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "end" }}
                      onClick={() => removeLevelSlot(slot.id)}>✕</button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dias preferidos <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional — deixe em branco para a simulação decidir)</span></label>
                    <DaySelector selected={slot.visitDays}
                      onChange={(days) => updateLevelSlot(slot.id, { visitDays: days })} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Pinned slots ───────────────────────────────────────────── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Consultores Específicos</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Quando o projeto requer uma pessoa em particular</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={addPinnedSlot}>+ Adicionar pessoa</button>
              </div>

              {form.pinnedSlots.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>Nenhum consultor específico requerido.</div>
              )}

              {form.pinnedSlots.map((slot) => (
                <div key={slot.id} style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Consultor</label>
                      <select className="form-select" value={slot.consultantId ?? ""}
                        onChange={(e) => updatePinnedSlot(slot.id, { consultantId: Number(e.target.value) || null })}>
                        <option value="">Selecione...</option>
                        {consultants.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({LEVEL_LABELS[c.level]})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dias/semana</label>
                      <input className="form-input" type="number" min={1} max={5} value={slot.daysPerWeek}
                        onChange={(e) => updatePinnedSlot(slot.id, { daysPerWeek: Number(e.target.value) })} />
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "end" }}
                      onClick={() => removePinnedSlot(slot.id)}>✕</button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dias preferidos <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
                    <DaySelector selected={slot.visitDays}
                      onChange={(days) => updatePinnedSlot(slot.id, { visitDays: days })} />
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar Projeto</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
