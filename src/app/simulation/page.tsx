"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  detectConflicts, simulateProject, computeLoad,
  getProjectColor, DAY_NAMES, CADENCE_LABELS, LEVEL_LABELS,
} from "@/lib/domain";
import { StatusBadge, LevelTag, Avatar } from "@/components/ui";

type Tab = "feasibility" | "matrix" | "capacity";

export default function SimulationPage() {
  const { consultants, projects, updateProject } = useAppStore();
  const [tab, setTab]     = useState<Tab>("feasibility");
  const [selId, setSelId] = useState<number | null>(
    projects.find((p) => p.status !== "archived")?.id ?? null
  );

  const active    = projects.filter((p) => p.status !== "archived");
  const conflicts = detectConflicts(projects);
  const matrixProjects = active.slice(0, 6);

  const simResult = useMemo(() => {
    if (!selId) return null;
    const p = projects.find((x) => x.id === selId);
    if (!p) return null;
    const others = projects.filter((x) => x.id !== selId && x.status === "confirmed");
    return simulateProject(p, consultants, others);
  }, [selId, projects, consultants]);

  function conflictLevel(aId: number, bId: number) {
    if (aId === bId) return "self";
    const c = conflicts.find(
      (x) => (x.a.id === aId && x.b.id === bId) || (x.a.id === bId && x.b.id === aId)
    );
    return c ? c.severity : "none";
  }

  function applySimulation() {
    if (!selId || !simResult?.feasible) return;
    const allConsultantIds = [...new Set(simResult.proposedAllocations.map((a) => a.consultant.id))];
    const allDays = [...new Set(simResult.proposedAllocations.flatMap((a) => a.days))].sort() as any;
    updateProject(selId, { allocatedConsultants: allConsultantIds, visitDays: allDays });
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Simulação</div>
      </div>

      <div className="page-content">
        <div className="tabs">
          {([
            ["feasibility","Viabilidade"],
            ["matrix","Matriz de Conflitos"],
            ["capacity","Capacidade"],
          ] as [Tab, string][]).map(([v, l]) => (
            <button key={v} className={`tab-btn ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {/* ── Feasibility ──────────────────────────────────────────────── */}
        {tab === "feasibility" && (
          <div className="grid-2" style={{ alignItems: "start" }}>
            {/* Project list */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Selecione um Projeto
              </div>
              {active.map((p) => (
                <div key={p.id} onClick={() => setSelId(p.id)} style={{
                  padding: "11px 13px", borderRadius: 8, cursor: "pointer", marginBottom: 6,
                  background: selId === p.id ? "#fff5f4" : "#fff",
                  border: `1.5px solid ${selId === p.id ? "var(--red)" : "var(--border)"}`,
                  transition: "all .13s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "var(--font-hd)", fontWeight: 800, color: "var(--red)", marginRight: 8, fontSize: 15, letterSpacing: "0.01em" }}>{p.acronym}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.client}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {/* Demand summary */}
                  {((p.levelSlots ?? []).length > 0 || (p.pinnedSlots ?? []).length > 0) && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(p.levelSlots ?? []).map((s, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: "#f4ecfb", color: "#7d3c98", fontWeight: 600 }}>
                          {s.isLeader ? "Líder " : ""}{LEVEL_LABELS[s.level]} {s.daysPerWeek}x
                        </span>
                      ))}
                      {(p.pinnedSlots ?? []).map((s, i) => {
                        const c = consultants.find((x) => x.id === s.consultantId);
                        return (
                          <span key={i} style={{ fontSize: 11, padding: "1px 7px", borderRadius: 4, background: "#fadbd8", color: "#c0392b", fontWeight: 600 }}>
                            {c?.name.split(" ")[0] ?? "?"} {s.daysPerWeek}x
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Result */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 11, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Resultado da Simulação
              </div>
              {simResult ? (
                <>
                  <div className={`sim-result ${simResult.feasible ? "ok" : "warn"}`}>
                    <div style={{ fontFamily: "var(--font-hd)", fontWeight: 700, fontSize: 15, marginBottom: 10, letterSpacing: "0.01em", color: simResult.feasible ? "#1e8449" : "#c0392b" }}>
                      {simResult.feasible ? "✅ Viável — projeto pode ser aceito" : "⚠️ Atenção — há problemas"}
                    </div>
                    {simResult.issues.map((iss, i) => (
                      <div key={i} style={{ fontSize: 13, color: "#c0392b", marginBottom: 4 }}>• {iss}</div>
                    ))}
                  </div>

                  {/* Proposed allocations */}
                  {(simResult.proposedAllocations ?? []).length > 0 && (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div className="card-title" style={{ margin: 0 }}>Time Sugerido</div>
                        {simResult.feasible && (
                          <button className="btn btn-primary btn-sm" onClick={applySimulation}>
                            ✓ Aplicar alocação
                          </button>
                        )}
                      </div>
                      {(simResult.proposedAllocations ?? []).map((alloc, i) => {
                        const isLevel = "level" in alloc.slot;
                        const slot = alloc.slot as any;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                            <Avatar name={alloc.consultant.name} index={consultants.indexOf(alloc.consultant)} size={30} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{alloc.consultant.name}</div>
                              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                {isLevel
                                  ? `Vaga: ${slot.isLeader ? "Líder " : ""}${LEVEL_LABELS[slot.level as keyof typeof LEVEL_LABELS]}`
                                  : "Consultor específico"}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#2e86c1" }}>
                                {alloc.days.map((d) => DAY_NAMES[d]).join(", ")}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                {alloc.days.length}x/sem
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Project details */}
                  {(() => {
                    const p = projects.find((x) => x.id === selId);
                    if (!p) return null;
                    const weeks = Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000 / 7);
                    return (
                      <div className="card" style={{ marginTop: 12 }}>
                        <div className="card-title">Detalhes</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                          <div><span style={{ color: "var(--muted)" }}>Cadência: </span><strong>{CADENCE_LABELS[p.cadence]}</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Duração: </span><strong>{weeks} semanas</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Vagas nível: </span><strong>{(p.levelSlots ?? []).length}</strong></div>
                          <div><span style={{ color: "var(--muted)" }}>Específicos: </span><strong>{(p.pinnedSlots ?? []).length}</strong></div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="card"><div className="empty-state">Selecione um projeto</div></div>
              )}
            </div>
          </div>
        )}

        {/* ── Conflict matrix ──────────────────────────────────────────── */}
        {tab === "matrix" && (
          <div className="card">
            <div className="card-title">Matriz de Conflitos</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
              Projetos quinzenais alternados (par/ímpar) são automaticamente compatíveis.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    {matrixProjects.map((p) => (
                      <th key={p.id}>
                        <span style={{ color: "var(--red)", fontWeight: 800 }}>{p.acronym}</span><br />
                        <span style={{ fontWeight: 400, color: "var(--muted)" }}>{p.client}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixProjects.map((a) => (
                    <tr key={a.id}>
                      <td><strong style={{ color: "var(--red)" }}>{a.acronym}</strong> {a.client}</td>
                      {matrixProjects.map((b) => {
                        const lv = conflictLevel(a.id, b.id);
                        if (lv === "self")   return <td key={b.id} className="c-self">—</td>;
                        if (lv === "high")   return <td key={b.id} className="c-high">⚠ Alto</td>;
                        if (lv === "medium") return <td key={b.id} className="c-medium">△ Médio</td>;
                        return <td key={b.id} className="c-ok">✓ OK</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Capacity ─────────────────────────────────────────────────── */}
        {tab === "capacity" && (
          <div className="card">
            <div className="card-title">Capacidade Individual</div>
            {consultants.map((c, i) => {
              const { total, projects: cps } = computeLoad(c.id, projects);
              const pct   = Math.min(100, (total / c.maxDays) * 100);
              const color = pct >= 90 ? "#e74c3c" : pct >= 70 ? "#e67e22" : "#27ae60";
              return (
                <div key={c.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <Avatar name={c.name} index={i} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>
                          {c.name} <LevelTag level={c.level} isLeader={c.isLeader} />
                        </span>
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
                        return (
                          <span key={p.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: col.bg, color: col.text, fontWeight: 700, borderLeft: `3px solid ${col.border}` }}>
                            {p.acronym} · {CADENCE_LABELS[p.cadence].split(" ")[0]}
                          </span>
                        );
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
