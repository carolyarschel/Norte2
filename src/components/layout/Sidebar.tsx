"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

const NAV = [
  { href: "/calendar",    icon: "📅", label: "Calendário"  },
  { href: "/dashboard",   icon: "◈",  label: "Dashboard"   },
  { href: "/consultants", icon: "👤", label: "Consultores" },
  { href: "/projects",    icon: "📋", label: "Projetos"    },
  { href: "/simulation",  icon: "◎",  label: "Simulação"   },
  { href: "/settings",    icon: "⚙️", label: "Configurações" },
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

      <div className="nav-section">Menu</div>

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
