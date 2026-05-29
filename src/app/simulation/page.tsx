"use client";

import { useState, useCallback } from "react";
import { useAppStore, SimulationResult, ProposedAllocation } from "@/store/useAppStore";
import {
  detectConflicts, computeLoad, getProjectColor,
  DAY_NAMES, CADENCE_LABELS, LEVEL_LABELS,
} from "@/lib/domain";
import { StatusBadge, LevelTag, Avatar } from "@/components/ui";

type Tab = "feasibility" | "matrix" | "capacity";

export default function SimulationPage() {
  const { consultants, projects, runSimulationBatch, confirmAndAllocate, fetchAll } = useAppStore();
  const [tab, setTab] = useState<Tab>("feasibility");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [simResults, setSimResults] = useState<Record<number, SimulationResult>>({});
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const active = projects.filter((p) => p.status !== "archived");
  const conflicts = detectConflicts(projects);
  const matrixProjects = active.slice(0, 6);

  // ── Toggle selection ───────────────────────────────────────────────────────

  function toggleProject(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Run batch simulation for all selected (non-applied) ────────────────────

  const runAll = useCallback(async (randomize = false) => {
    const idsToSimulate = selectedIds.filter((id) => !appliedIds.has(id));
    if (!idsToSimulate.length) return;

    setSimLoading(true);
    setSimError(null);

    try {
      const results = await runSimulationBatch(idsToSimulate, randomize);
      setSimResults((prev) => ({ ...prev, ...results }));
    } catch (err: any) {
      setSimError(err.message ?? "Erro na simulação");
    } finally {
      setSimLoading(false);
    }
  }, [selectedIds, appliedIds, runSimulationBatch]);

  // ── Select a project and trigger simulation ────────────────────────────────

  function handleSelect(id: number) {
    const wasSelected = selectedIds.includes(id);
    const newIds = wasSelected
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];

    setSelectedIds(newIds);

    // Auto-simulate when adding (not removing)
    if (!wasSelected) {
      const idsToSim = newIds.filter((x) => !appliedIds.has(x));
      if (idsToSim.length) {
        setSimLoading(true);
        setSimError(null);
        runSimulationBatch(idsToSim).then((results) => {
          setSimResults((prev) => ({ ...prev, ...results }));
          setSimLoading(false);
        }).catch((err) => {
          setSimError(err.message ?? "Erro");
          setSimLoading(false);
        });
      }
    }
  }

  // ── Apply allocations for one project ──────────────────────────────────────

  const handleApply = useCallback(async (projectId: number) => {
    const result = simResults[projectId];
    if (!result?.feasible || appliedIds.has(projectId)) return;

    try {
      const allocations = result.proposed.map((a) => ({
        consultantId: a.consultantId,
        weekday: a.weekday,
        role: a.role,
      }));
      await confirmAndAllocate(projectId, allocations);
      setAppliedIds((prev) => new Set([...prev, projectId]));
      await fetchAll();

      // Re-simulate remaining unapplied projects (their constraints changed)
      const remaining = selectedIds.filter((id) => id !== projectId && !appliedIds.has(id));
      if (remaining.length) {
        const results = await runSimulationBatch(remaining);
        setSimResults((prev) => ({ ...prev, ...results }));
      }
    } catch (err: any) {
      setSimError(err.message ?? "Erro ao aplicar");
    }
  }, [simResults, appliedIds, selectedIds, confirmAndAllocate, fetchAll, runSimulationBatch]);

  // ── Build preview calendar ─────────────────────────────────────────────────

  function buildPreviewCalendar() {
    type CalEntry = { projectAcronym: string; role: string; color: { bg: string; border: string; text: string }; isProposed: boolean };
    const grid: Record<string, CalEntry[]> = {};

    // Existing confirmed allocations
    for (const p of projects) {
      if (p.status === "archived") continue;
      const col = getProjectColor(p.id, projects);
      for (const alloc of (p.allocations ?? [])) {
        const key = `${alloc.consultantId}-${alloc.weekday}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push({ projectAcronym: p.acronym, role: alloc.role, color: col, isProposed: false });
      }
    }

    // Proposed allocations (from simulation, not yet applied)
    for (const id of selectedIds) {
      if (appliedIds.has(id)) continue;
      const result = simResults[id];
      if (!result) continue;
      const p = projects.find((x) => x.id === id);
      if (!p) continue;
      const col = getProjectColor(p.id, projects);

      for (const alloc of result.proposed) {
        const key = `${alloc.consultantId}-${alloc.weekday}`;
        if (!grid[key]) grid[key] = [];
        const exists = grid[key].some((e) => e.projectAcronym === p.acronym);
        if (!exists) {
          grid[key].push({ projectAcronym: p.acronym, role: alloc.role, color: col, isProposed: true });
        }
      }
    }

    return grid;
  }

  function conflictLevel(aId: number, bId: number) {
    if (aId === bId) return "self";
    const c = conflicts.find((x) => (x.a.id === aId && x.b.id === bId) || (x.a.id === bId && x.b.id === aId));
    return c ? c.severity : "none";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Simulação</div>
      </div>

      <div className="page-content">
        <div className="tabs">
          {([["feasibility", "Viabilidade"], ["matrix", "Matriz de Conflitos"], ["capacity", "Capacidade"]] as [Tab, string][]).map(([v, l]) => (
            <button key={v} className={`tab-btn ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "feasibility" && (
          <div>
            <div className="grid-2" style={{ alignItems: "start", marginBottom: 24 }}>
              {/* ── Left: project selection ──────────────────────────────── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Projetos ({selectedIds.length} selecionados)
                  </span>
                  {selectedIds.length > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={() => runAll(true)} disabled={simLoading}>
                      🔄 Nova sugestão
                    </button>
                  )}
                </div>

                {active.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const isApplied = appliedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isApplied && handleSelect(p.id)}
                      style={{
                        padding: "11px 13px", borderRadius: 8,
                        cursor: isApplied ? "default" : "pointer",
                        marginBottom: 6,
                        background: isSelected ? "#fff5f4" : "#fff",
                        border: `1.5px solid ${isSelected ? "var(--red)" : "var(--border)"}`,
                        opacity: isApplied ? 0.55 : 1,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={isSelected} disabled={isApplied} onChange={() => {}} style={{ accentColor: "var(--red)", width: 16, height: 16 }} />
                          <div>
                            <span style={{ fontFamily: "var(--font-hd)", fontWeight: 800, color: "var(--red)", marginRight: 8, fontSize: 15 }}>{p.acronym}</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{p.client}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isApplied && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#eafaf1", color: "#1e8449", fontWeight: 600 }}>✓ Alocado</span>}
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, paddingLeft: 24 }}>
                        {p.startDate} → {p.endDate} · {CADENCE_LABELS[p.cadence]}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Right: results ──────────────────────────────────────── */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  Resultados
                </div>

                {simLoading && (
                  <div className="card" style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                    Simulando {selectedIds.filter((id) => !appliedIds.has(id)).length} projeto(s)...
                  </div>
                )}

                {simError && (
                  <div className="sim-result warn" style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: "#c0392b" }}>❌ {simError}</div>
                  </div>
                )}

                {selectedIds.length === 0 && !simLoading && (
                  <div className="card"><div className="empty-state">Selecione projetos para simular</div></div>
                )}

                {!simLoading && selectedIds.map((id) => {
                  const p = projects.find((x) => x.id === id);
                  const result = simResults[id];
                  const isApplied = appliedIds.has(id);
                  if (!p) return null;

                  return (
                    <div key={id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: "var(--font-hd)", fontWeight: 800, color: "var(--red)", fontSize: 16 }}>{p.acronym}</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--muted)" }}>{p.client}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.startDate} → {p.endDate}</span>
                      </div>

                      {!result && !simLoading && (
                        <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Aguardando simulação...</div>
                      )}

                      {result && (
                        <>
                          <div className={`sim-result ${result.feasible ? "ok" : "warn"}`}>
                            <div style={{ fontFamily: "var(--font-hd)", fontWeight: 700, fontSize: 14, marginBottom: 8, color: result.feasible ? "#1e8449" : "#c0392b" }}>
                              {result.feasible ? "✅ Viável nas datas propostas" : "⚠️ Inviável nas datas propostas"}
                            </div>
                            {result.issues.map((iss, i) => (
                              <div key={i} style={{ fontSize: 13, color: "#c0392b", marginBottom: 3 }}>• {iss}</div>
                            ))}
                            {result.suggestions.map((s, i) => (
                              <div key={i} style={{ fontSize: 13, color: "#1e8449", marginBottom: 3 }}>✓ {s}</div>
                            ))}
                            {/* Earliest feasible date */}
                            {result.earliestFeasibleDate && (
                              <div style={{ marginTop: 10, padding: "8px 12px", background: "#ebf5fb", borderRadius: 6, fontSize: 13, color: "#2e86c1", fontWeight: 600 }}>
                                📅 Data mais cedo viável: <strong>{result.earliestFeasibleDate}</strong>
                              </div>
                            )}
                          </div>

                          {result.proposed.length > 0 && (
                            <div className="card" style={{ marginTop: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div className="card-title" style={{ margin: 0 }}>Time Sugerido</div>
                                {result.feasible && !isApplied && (
                                  <button className="btn btn-primary btn-sm" onClick={() => handleApply(id)}>
                                    ✓ Alocar pessoas
                                  </button>
                                )}
                                {isApplied && (
                                  <span style={{ fontSize: 12, color: "#1e8449", fontWeight: 600 }}>✅ Alocado e confirmado</span>
                                )}
                              </div>
                              {(() => {
                                const grouped = new Map<number, ProposedAllocation[]>();
                                for (const a of result.proposed) {
                                  if (!grouped.has(a.consultantId)) grouped.set(a.consultantId, []);
                                  grouped.get(a.consultantId)!.push(a);
                                }
                                return Array.from(grouped.entries()).map(([cId, allocs]) => {
                                  const ci = consultants.findIndex((c) => c.id === cId);
                                  return (
                                    <div key={cId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                                      <Avatar name={allocs[0].consultantName} index={ci >= 0 ? ci : 0} size={28} />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{allocs[0].consultantName}</div>
                                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{allocs[0].slotDescription}</div>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#2e86c1" }}>
                                          {allocs.map((a) => DAY_NAMES[a.weekday]).join(", ")}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{allocs.length}x/sem · {allocs[0].role}</div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Preview Calendar ────────────────────────────────────────── */}
            {selectedIds.length > 0 && Object.keys(simResults).length > 0 && (
              <div className="card">
                <div className="card-title">Prévia do Calendário Semanal</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                  Existentes (sólido) + propostas (tracejado). Cada consultor aparece em no máximo 1 projeto por dia.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="cal-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", width: 150 }}>Consultor</th>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <th key={d}><span className="cal-th-day">{DAY_NAMES[d]}</span></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grid = buildPreviewCalendar();
                        const relevantIds = new Set<number>();
                        for (const key of Object.keys(grid)) relevantIds.add(Number(key.split("-")[0]));
                        const orderedIds = consultants.map((c) => c.id).filter((id) => relevantIds.has(id));

                        return orderedIds.map((cId) => {
                          const c = consultants.find((x) => x.id === cId);
                          if (!c) return null;
                          const ci = consultants.indexOf(c);

                          return (
                            <tr key={cId}>
                              <td style={{ padding: "8px 10px", background: "var(--surface)" }}>
                                <div className="cal-consultant">
                                  <Avatar name={c.name} index={ci} size={26} />
                                  <div>
                                    <div className="cal-name" style={{ fontSize: 12 }}>{c.name.split(" ")[0]}</div>
                                    <div className="cal-sub" style={{ fontSize: 10 }}>{LEVEL_LABELS[c.level]}{c.isLeader ? " ★" : ""}</div>
                                  </div>
                                </div>
                              </td>
                              {[1, 2, 3, 4, 5].map((d) => {
                                const entries = grid[`${cId}-${d}`] ?? [];
                                const isRestricted = c.restrictions.includes(d as any);
                                const hasConflict = entries.length > 1;

                                return (
                                  <td key={d}>
                                    <div className={`cal-cell${isRestricted && !entries.length ? " restricted" : ""}`} style={{ minHeight: 40, background: hasConflict ? "#fff0f0" : undefined }}>
                                      {isRestricted && !entries.length && <span className="restricted-dot" style={{ marginTop: 12 }} />}
                                      {entries.map((e, i) => (
                                        <div key={i} className="cal-chip" style={{
                                          background: e.color.bg,
                                          borderLeftColor: e.color.border,
                                          color: e.color.text,
                                          borderStyle: e.isProposed ? "dashed" : "solid",
                                          borderWidth: e.isProposed ? "1.5px 1.5px 1.5px 3px" : undefined,
                                          borderColor: e.isProposed ? e.color.border : undefined,
                                        }}>
                                          <span className="cal-chip-acronym">{e.projectAcronym}</span>
                                          <span className="cal-chip-role">— {e.role}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "matrix" && (
          <div className="card">
            <div className="card-title">Matriz de Conflitos</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
              Considera sobreposição real de datas, não apenas dias da semana.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="matrix-table">
                <thead><tr><th>Projeto</th>
                  {matrixProjects.map((p) => (
                    <th key={p.id}><span style={{ color: "var(--red)", fontWeight: 800 }}>{p.acronym}</span><br /><span style={{ fontWeight: 400, color: "var(--muted)" }}>{p.client}</span></th>
                  ))}
                </tr></thead>
                <tbody>{matrixProjects.map((a) => (
                  <tr key={a.id}><td><strong style={{ color: "var(--red)" }}>{a.acronym}</strong> {a.client}</td>
                    {matrixProjects.map((b) => {
                      const lv = conflictLevel(a.id, b.id);
                      if (lv === "self")   return <td key={b.id} className="c-self">—</td>;
                      if (lv === "high")   return <td key={b.id} className="c-high">⚠ Alto</td>;
                      if (lv === "medium") return <td key={b.id} className="c-medium">△ Médio</td>;
                      return <td key={b.id} className="c-ok">✓ OK</td>;
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "capacity" && (
          <div className="card">
            <div className="card-title">Capacidade Individual</div>
            {consultants.map((c, i) => {
              const { total, projects: cps } = computeLoad(c.id, projects);
              const pct = Math.min(100, (total / c.maxDays) * 100);
              const color = pct >= 90 ? "#e74c3c" : pct >= 70 ? "#e67e22" : "#27ae60";
              return (
                <div key={c.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <Avatar name={c.name} index={i} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>{c.name} <LevelTag level={c.level} isLeader={c.isLeader} /></span>
                        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{total.toFixed(1)}/{c.maxDays}d</span>
                      </div>
                      <div style={{ height: 5, background: "#e9ecef", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  {cps.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 42 }}>
                      {cps.map((p) => {
                        const col = getProjectColor(p.id, projects);
                        return <span key={p.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: col.bg, color: col.text, fontWeight: 700, borderLeft: `3px solid ${col.border}` }}>{p.acronym} · {CADENCE_LABELS[p.cadence].split(" ")[0]}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
