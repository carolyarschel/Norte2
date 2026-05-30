"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { LuCalendar, LuGauge, LuGroup, LuBriefcaseBusiness, LuChartGantt, LuSettings  } from "react-icons/lu";

const NAV = [
  { href: "/calendar",    icon: <LuCalendar />, label: "Calendário"  },
  { href: "/dashboard",   icon: <LuGauge />,  label: "Dashboard"   },
  { href: "/consultants", icon: <LuGroup />, label: "Consultores" },
  { href: "/projects",    icon: <LuBriefcaseBusiness />, label: "Projetos"    },
  { href: "/simulation",  icon: <LuChartGantt />,  label: "Simulação"   },
  { href: "/settings",    icon: <LuSettings />, label: "Configurações" },
];

export function Sidebar() {
  const pathname    = usePathname();
  const companyName = useAppStore((s) => s.companyName);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-company">{companyName}</div>
        <div className="sidebar-sub">Gestão de Alocações</div>
      </div>

      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`nav-link ${pathname.startsWith(n.href) ? "active" : ""}`}
        >
          <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>{n.icon}</span>
          {n.label}
        </Link>
      ))}
    </aside>
  );
}
