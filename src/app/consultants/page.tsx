"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { computeLoad, DAY_NAMES } from "@/lib/domain";
import { Avatar, LevelTag, CapBar, ChipGroup } from "@/components/ui";
import type { Consultant, Weekday } from "@/types";

type FormState = Omit<Consultant, "id">;

const EMPTY_FORM: FormState = {
  name: "", level: "junior", isLeader: false, maxDays: 5, restrictions: [],
};

const LEVEL_OPTIONS = [
  { value: "junior", label: "Júnior" },
  { value: "pleno",  label: "Pleno"  },
  { value: "senior", label: "Sênior" },
];

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5].map((d) => ({
  value: d,
  label: DAY_NAMES[d],
}));

export default function ConsultantsPage() {
  const { consultants, projects, addConsultant, updateConsultant, removeConsultant } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(c: Consultant) {
    setEditingId(c.id);
    setForm({ name: c.name, level: c.level, isLeader: c.isLeader, maxDays: c.maxDays, restrictions: c.restrictions });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
  }

  function toggleRestriction(value: string | number) {
    const d = Number(value) as Weekday;
    setForm((f) => {
      const restrictions = f.restrictions.includes(d)
        ? f.restrictions.filter((x) => x !== d)
        : [...f.restrictions, d];
      const available = 5 - restrictions.length;
      return {
        ...f,
        restrictions,
        maxDays: Math.min(f.maxDays, Math.max(1, available)),
      };
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = { ...form, maxDays: Number(form.maxDays) };
      if (editingId !== null) {
        await updateConsultant(editingId, data);
      } else {
        await addConsultant(data);
      }
      closeModal();
    } catch (err: any) {
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Consultores</div>
          <div className="topbar-sub">{consultants.length} cadastrados</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          + Novo Consultor
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          {consultants.length === 0 && (
            <div className="empty-state">Nenhum consultor cadastrado. Clique em "+ Novo Consultor" para começar.</div>
          )}
          {consultants.map((c, i) => {
            const { total, projects: cProjects } = computeLoad(c.id, projects);
            return (
              <div
                key={c.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 0", borderBottom: "1px solid var(--border)",
                }}
              >
                <Avatar name={c.name} index={i} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {c.restrictions.length > 0 && (
                      <span>Restrição: {c.restrictions.map((d) => DAY_NAMES[d]).join(", ")} · </span>
                    )}
                    {cProjects.length > 0
                      ? <strong style={{ marginRight: 4 }}>{cProjects.map(p => p.acronym).join(', ')}</strong>
                      : "Sem alocação"}
                  </div>
                </div>
                <LevelTag level={c.level} isLeader={c.isLeader} />
                <CapBar used={total} max={c.maxDays} />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(c)}
                  title="Editar consultor"
                >
                  ✎
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (confirm(`Remover ${c.name}? Esta ação não pode ser desfeita.`))
                      removeConsultant(c.id);
                  }}
                  title="Remover consultor"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingId !== null ? "Editar Consultor" : "Novo Consultor"}</div>
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Nome</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nível</label>
                <select
                  className="form-select"
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as any }))}
                >
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Máx. dias/semana</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={5 - form.restrictions.length}
                  value={form.maxDays}
                  onChange={(e) => {
                    const available = 5 - form.restrictions.length;
                    setForm((f) => ({ ...f, maxDays: Math.min(Math.max(1, Number(e.target.value)), available) }));
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  {5 - form.restrictions.length} dia{5 - form.restrictions.length !== 1 ? "s" : ""} disponível{5 - form.restrictions.length !== 1 ? "is" : ""} (máximo permitido)
                </div>
              </div>
              <div className="form-group full">
                <label className="form-label">É Líder?</label>
                <ChipGroup
                  options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                  selected={[form.isLeader ? "sim" : "nao"]}
                  onToggle={(v) => setForm((f) => ({ ...f, isLeader: v === "sim" }))}
                  single
                />
              </div>
              <div className="form-group full">
                <label className="form-label">Restrições de dias</label>
                <ChipGroup
                  options={WEEKDAY_OPTIONS}
                  selected={form.restrictions}
                  onToggle={toggleRestriction}
                />
              </div>
            </div>
            <div className="modal-footer">
              {saveError && (
                <span style={{ fontSize: 12, color: "#c0392b", flex: 1 }}>{saveError}</span>
              )}
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : editingId !== null ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
