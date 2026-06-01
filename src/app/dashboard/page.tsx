"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { detectConflicts, getISOWeek } from "@/lib/domain";
import { isWorkingDay } from "@/lib/holidays";

const MONTH_ABBR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const GANTT_COLORS: Record<string, string> = {
  confirmed: "#c0392b", hot: "#e67e22", cold: "#95a5a6",
};

function computeMonthlyOccupancy(
  consultants: { id: number; maxDays: number }[],
  projects: {
    status: string; startDate: string; endDate: string; cadence: string;
    allocations?: { consultantId: number; weekday: number }[];
  }[],
  month: Date,
) {
  const y = month.getFullYear(), m = month.getMonth();
  const monthStart = new Date(y, m, 1);
  const monthEnd   = new Date(y, m + 1, 0);

  let workingDays = 0;
  { const d = new Date(monthStart);
    while (d <= monthEnd) { if (isWorkingDay(d)) workingDays++; d.setDate(d.getDate() + 1); } }

  let usedDays = 0;
  let totalCapDays = 0;

  for (const c of consultants) {
    totalCapDays += (c.maxDays / 5) * workingDays;

    for (const p of projects) {
      if (p.status === "archived") continue;
      const allocs = (p.allocations ?? []).filter((a) => a.consultantId === c.id);
      if (!allocs.length) continue;

      const pStart   = new Date(p.startDate);
      const pEnd     = new Date(p.endDate);
      const effStart = new Date(Math.max(pStart.getTime(), monthStart.getTime()));
      const effEnd   = new Date(Math.min(pEnd.getTime(),   monthEnd.getTime()));
      if (effStart > effEnd) continue;

      for (const alloc of allocs) {
        const iter = new Date(effStart);
        while (iter <= effEnd) {
          if (iter.getDay() === alloc.weekday && isWorkingDay(iter)) {
            const week = getISOWeek(iter);
            if (p.cadence === "weekly" ||
                (p.cadence === "biweekly_odd"  && week % 2 === 1) ||
                (p.cadence === "biweekly_even" && week % 2 === 0)) {
              usedDays++;
            }
          }
          iter.setDate(iter.getDate() + 1);
        }
      }
    }
  }

  const pct = totalCapDays > 0 ? Math.round(usedDays / totalCapDays * 100) : 0;
  return { used: usedDays, total: Math.round(totalCapDays), pct };
}

export default function DashboardPage() {
  const { consultants, projects } = useAppStore();

  const [occMonth, setOccMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const confirmed = projects.filter((p) => p.status === "confirmed");
  const hot       = projects.filter((p) => p.status === "hot");
  const conflicts = detectConflicts(projects);

  const monthlyOcc = computeMonthlyOccupancy(consultants, projects, occMonth);

  function prevMonth() { setOccMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setOccMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  // ── Gantt range: derived from actual project dates ─────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const STATUS_ORDER: Record<string, number> = { confirmed: 0, hot: 1, cold: 2 };

  const activeProjects = projects
    .filter((p) => p.status !== "archived" && p.startDate && p.endDate && new Date(p.endDate) >= today)
    .sort((a, b) => {
      const sd = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return sd !== 0 ? sd : a.acronym.localeCompare(b.acronym);
    });

  const ganttStart = (() => {
    if (!activeProjects.length) {
      const d = new Date(); d.setDate(1); return d;
    }
    const earliest = new Date(Math.min(...activeProjects.map((p) => new Date(p.startDate).getTime())));
    earliest.setDate(1); // snap to first of month
    return earliest;
  })();

  const ganttEnd = (() => {
    if (!activeProjects.length) {
      const d = new Date(); d.setMonth(d.getMonth() + 6); d.setDate(0); return d;
    }
    const latest = new Date(Math.max(...activeProjects.map((p) => new Date(p.endDate).getTime())));
    latest.setMonth(latest.getMonth() + 1); latest.setDate(0); // snap to end of month
    return latest;
  })();

  const ganttDays = Math.max(1, (ganttEnd.getTime() - ganttStart.getTime()) / 86400000);

  const ganttMonths: string[] = [];
  const cursor = new Date(ganttStart);
  while (cursor <= ganttEnd) {
    ganttMonths.push(`${MONTH_ABBR[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  function barStyle(project: { startDate: string; endDate: string; status: string }) {
    const s = new Date(project.startDate);
    const e = new Date(project.endDate);
    const left  = Math.max(0, (s.getTime() - ganttStart.getTime()) / 86400000 / ganttDays) * 100;
    const width = Math.min(100 - left, (e.getTime() - s.getTime()) / 86400000 / ganttDays * 100);
    return {
      left: `${left}%`, width: `${Math.max(width, 1)}%`,
      background: GANTT_COLORS[project.status] ?? "#95a5a6",
      opacity: project.status === "cold" ? 0.6 : 1,
    };
  }

  return (
    <div className="page-content">
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {/* Consultores */}
        <div className="stat-card">
          <div className="stat-label">Consultores</div>
          <div className="stat-value">{consultants.length}</div>
          <div className="stat-sub">{consultants.filter(c => c.isLeader).length} líderes</div>
        </div>

        {/* Projetos Ativos */}
        <div className="stat-card">
          <div className="stat-label">Projetos Ativos</div>
          <div className="stat-value">{confirmed.length}</div>
          <div className="stat-sub">{hot.length} prospectos quentes</div>
        </div>

        {/* Ocupação — mensal com navegação */}
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="stat-label" style={{ margin: 0 }}>Ocupação</div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button onClick={prevMonth} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16, padding: "0 3px", lineHeight: 1 }}>‹</button>
              <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 46, textAlign: "center", fontWeight: 600 }}>
                {MONTH_ABBR[occMonth.getMonth()]}/{String(occMonth.getFullYear()).slice(2)}
              </span>
              <button onClick={nextMonth} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16, padding: "0 3px", lineHeight: 1 }}>›</button>
            </div>
          </div>
          <div className="stat-value">{monthlyOcc.pct}%</div>
          <div className="stat-sub">{monthlyOcc.used} de {monthlyOcc.total} dias no mês</div>
        </div>

        {/* Conflitos */}
        <div className="stat-card">
          <div className="stat-label">Conflitos</div>
          <div className="stat-value" style={{ color: conflicts.length > 0 ? "var(--red)" : "var(--text)" }}>{conflicts.length}</div>
          <div className="stat-sub">{conflicts.filter(c => c.severity === "high").length} alta severidade</div>
        </div>
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
      {(() => {
        const ROW_H    = 36;
        const HEADER_H = 30;
        const LABEL_W  = 170;
        const MONTH_W  = 90;
        const totalW   = Math.max(300, ganttMonths.length * MONTH_W);

        return (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 12px" }}>
              <div className="card-title">Linha do Tempo</div>
            </div>

            <div style={{ display: "flex" }}>
              {/* ── Fixed label column ── */}
              <div style={{
                width: LABEL_W, flexShrink: 0,
                borderRight: "1px solid var(--border)",
                background: "var(--surface)",
                zIndex: 2,
              }}>
                {/* header spacer aligned with months row */}
                <div style={{ height: HEADER_H, borderBottom: "1px solid var(--border)" }} />
                {activeProjects.map((p) => (
                  <div key={p.id} style={{
                    height: ROW_H, display: "flex", alignItems: "center",
                    padding: "0 10px 0 20px",
                    borderBottom: "1px solid var(--border)",
                    overflow: "hidden",
                  }}>
                    <span style={{ fontFamily: "var(--font-hd)", fontWeight: 800, color: "var(--red)", marginRight: 5, whiteSpace: "nowrap", fontSize: 13 }}>
                      {p.acronym}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.client}
                    </span>
                  </div>
                ))}
                <div style={{ height: 12 }} />
              </div>

              {/* ── Scrollable bars column ── */}
              <div style={{ flex: 1, overflowX: "auto" }}>
                {/* Months header */}
                <div style={{ display: "flex", width: totalW, height: HEADER_H, borderBottom: "1px solid var(--border)" }}>
                  {ganttMonths.map((m) => (
                    <div key={m} className="gantt-month" style={{ width: MONTH_W, flexShrink: 0, height: HEADER_H }}>
                      {m}
                    </div>
                  ))}
                </div>
                {/* Bars */}
                {activeProjects.map((p) => (
                  <div key={p.id} style={{
                    height: ROW_H, position: "relative",
                    width: totalW,
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <div className="gantt-bar" style={barStyle(p)}>{p.acronym}</div>
                  </div>
                ))}
                <div style={{ height: 12 }} />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
