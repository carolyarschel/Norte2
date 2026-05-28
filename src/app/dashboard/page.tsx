"use client";

import { useAppStore } from "@/store/useAppStore";
import { computeLoad, detectConflicts, STATUS_META } from "@/lib/domain";

const GANTT_START = new Date("2026-05-01");
const GANTT_END   = new Date("2026-11-30");
const GANTT_DAYS  = (GANTT_END.getTime() - GANTT_START.getTime()) / 86400000;
const GANTT_MONTHS = ["Mai","Jun","Jul","Ago","Set","Out","Nov"];
const GANTT_COLORS: Record<string, string> = {
  confirmed: "#c0392b", hot: "#e67e22", cold: "#95a5a6",
};

export default function DashboardPage() {
  const { consultants, projects } = useAppStore();

  const confirmed = projects.filter((p) => p.status === "confirmed");
  const hot       = projects.filter((p) => p.status === "hot");
  const conflicts = detectConflicts(projects);

  const totalCap = consultants.reduce((s, c) => s + c.maxDays, 0);
  const usedCap  = consultants.reduce((s, c) => s + computeLoad(c.id, projects).total, 0);
  const occ      = Math.round((usedCap / totalCap) * 100);

  function barStyle(project: { startDate: string; endDate: string; status: string }) {
    const s = new Date(project.startDate);
    const e = new Date(project.endDate);
    const left  = Math.max(0, (s.getTime() - GANTT_START.getTime()) / 86400000 / GANTT_DAYS) * 100;
    const width = Math.min(100 - left, (e.getTime() - s.getTime()) / 86400000 / GANTT_DAYS * 100);
    return {
      left: `${left}%`, width: `${width}%`,
      background: GANTT_COLORS[project.status] ?? "#95a5a6",
      opacity: project.status === "cold" ? 0.6 : 1,
    };
  }

  return (
    <div className="page-content">
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Consultores",    value: consultants.length,  sub: `${consultants.filter(c=>c.isLeader).length} líderes` },
          { label: "Projetos Ativos",value: confirmed.length,    sub: `${hot.length} prospectos quentes` },
          { label: "Ocupação",       value: `${occ}%`,           sub: `${usedCap.toFixed(1)} de ${totalCap} dias/sem` },
          { label: "Conflitos",      value: conflicts.length,    sub: `${conflicts.filter(c=>c.severity==="high").length} alta severidade`, warn: conflicts.length > 0 },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.warn ? "var(--red)" : "var(--text)" }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Conflict banner */}
      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <strong style={{ color: "var(--red)" }}>{conflicts.length} conflito(s) detectado(s)</strong>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
              {conflicts.map((c) => `${c.a.acronym} × ${c.b.acronym}`).join("  ·  ")}
            </div>
          </div>
        </div>
      )}

      {/* Gantt */}
      <div className="card">
        <div className="card-title">Linha do Tempo</div>
        <div className="gantt-header">
          <div className="gantt-header-label" />
          <div className="gantt-months">
            {GANTT_MONTHS.map((m) => (
              <div key={m} className="gantt-month">{m}</div>
            ))}
          </div>
        </div>
        {projects
          .filter((p) => p.status !== "archived")
          .map((p) => (
            <div key={p.id} className="gantt-row">
              <div className="gantt-label">
                <span style={{ fontFamily: "var(--font-hd)", fontWeight: 800, color: "var(--red)", marginRight: 6 }}>
                  {p.acronym}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.client}</span>
              </div>
              <div className="gantt-track">
                <div className="gantt-bar" style={barStyle(p)}>{p.acronym}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
