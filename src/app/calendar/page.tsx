"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  getMondayOfWeek, addDays, fmtDate, getISOWeek,
  projectVisitsOnDate, getProjectColor,
  DAY_NAMES, LEVEL_LABELS, CADENCE_LABELS,
} from "@/lib/domain";
import { Avatar } from "@/components/ui";
import type { Weekday } from "@/types";

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export default function CalendarPage() {
  const { consultants, projects } = useAppStore();
  const [weekStart, setWeekStart] = useState(() =>
    getMondayOfWeek(new Date())
  );

  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
  const weekNum  = getISOWeek(weekStart);
  const monthLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  const activeProjects = projects.filter((p) => p.status !== "archived");

  function getChips(consultantId: number, date: Date) {
    return activeProjects
      .filter(
        (p) =>
          (p.allocatedConsultants ?? []).includes(consultantId) &&
          projectVisitsOnDate(p, date)
      )
      .map((p) => {
        const c = consultants.find((x) => x.id === consultantId)!;
        const isLeader = p.pinnedSlots?.some((s) => s.consultantId === consultantId) && c.isLeader;
        return {
          project: p,
          role: isLeader ? "Líder" : "Consultor",
          color: getProjectColor(p.id, projects),
        };
      });
  }

  function isRestricted(consultantId: number, date: Date): boolean {
    const c = consultants.find((x) => x.id === consultantId);
    if (!c) return false;
    const d = date.getDay();
    const wd: Weekday = (d === 0 ? 7 : d) as Weekday;
    return c.restrictions.includes(wd);
  }

  return (
    <>
      {/* Navigation bar */}
      <div className="cal-nav-bar">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
        >
          ‹ Anterior
        </button>
        <div className="cal-month-title">{monthLabel}</div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
        >
          Próximo ›
        </button>
        <span className="cal-week-label">
          Semana {weekNum} ({fmtDate(weekStart)}–{fmtDate(weekDays[4])})
        </span>
      </div>

      <div className="page-content">
        <div className="cal-table-wrap">
          <table className="cal-table">
            <thead>
              <tr>
                <th>CONSULTOR</th>
                {weekDays.map((d, i) => (
                  <th key={i}>
                    <span className="cal-th-day">{DAY_NAMES[i + 1]} {fmtDate(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consultants.map((c, ci) => (
                <tr key={c.id}>
                  {/* Consultant label */}
                  <td>
                    <div className="cal-consultant">
                      <Avatar name={c.name} index={ci} size={29} />
                      <div>
                        <div className="cal-name">{c.name.split(" ")[0]}</div>
                        <div className="cal-sub">
                          {LEVEL_LABELS[c.level]}{c.isLeader ? " ★" : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {weekDays.map((d, di) => {
                    const chips      = getChips(c.id, d);
                    const restricted = isRestricted(c.id, d);
                    return (
                      <td key={di}>
                        <div className={`cal-cell${restricted && !chips.length ? " restricted" : ""}`}>
                          {!chips.length && restricted && (
                            <span className="restricted-dot" title="Dia restrito" />
                          )}
                          {chips.map((ch, chi) => (
                            <div
                              key={chi}
                              className="cal-chip"
                              style={{
                                background:      ch.color.bg,
                                borderLeftColor: ch.color.border,
                                color:           ch.color.text,
                              }}
                              title={`${ch.project.client} — ${ch.role}`}
                            >
                              <span className="cal-chip-acronym">{ch.project.acronym}</span>
                              <span className="cal-chip-role">— {ch.role}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 14, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>LEGENDA:</span>
          {activeProjects.map((p) => {
            const col = getProjectColor(p.id, projects);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: col.bg, border: `2px solid ${col.border}`, display: "inline-block" }} />
                <strong style={{ color: col.border }}>{p.acronym}</strong>
                <span style={{ color: "var(--muted)" }}>{p.client}</span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>({CADENCE_LABELS[p.cadence]})</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e74c3c", display: "inline-block", opacity: 0.35 }} />
            <span style={{ color: "var(--muted)" }}>Dia restrito</span>
          </div>
        </div>
      </div>
    </>
  );
}
