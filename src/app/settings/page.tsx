"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const { companyName, setCompanyName } = useAppStore();
  const [val, setVal] = useState(companyName);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Configurações</div>
      </div>
      <div className="page-content">
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title">Empresa</div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Nome da Empresa</label>
            <input
              className="form-input"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Ex: Minha Consultoria"
            />
          </div>
          <button className="btn btn-primary" onClick={() => setCompanyName(val)}>
            Salvar
          </button>
        </div>
      </div>
    </>
  );
}
