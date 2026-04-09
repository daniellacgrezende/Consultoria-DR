import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { B, NAV_ITEMS, NAV_GROUPS } from "../utils/constants";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = location.pathname.replace("/", "") || "dashboard";
  const [groups, setGroups] = useState({ vendas: true, clientes: true, relatorios: false, config: false });

  const standalone = NAV_ITEMS.filter((i) => !i.group);
  const grouped = Object.entries(NAV_GROUPS);

  return (
    <aside style={{ width: 220, flexShrink: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 8 }}>
        <svg width="24" height="24" viewBox="0 0 60 60" fill="none">
          <path d="M8 8 L8 36 L34 36 Q50 36 50 22 Q50 8 34 8 Z" fill="white" opacity="0.95" />
          <path d="M8 42 L8 54 L28 54 L50 42 Z" fill="white" opacity="0.65" />
        </svg>
        <span style={{ color: "white", fontWeight: 900, fontSize: 13, letterSpacing: "0.12em" }}>CONSULTORIA DR</span>
      </div>

      {/* Standalone items */}
      {standalone.map((item) => (
        <button key={item.id} onClick={() => navigate(`/${item.id === "dashboard" ? "" : item.id}`)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: current === item.id ? "rgba(255,255,255,0.13)" : "transparent", color: current === item.id ? "white" : "rgba(255,255,255,0.5)", fontWeight: current === item.id ? 700 : 400, fontSize: 12, textAlign: "left" }}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
        </button>
      ))}

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

      {/* Grouped items */}
      {grouped.map(([key, label]) => (
        <div key={key}>
          <button onClick={() => setGroups((g) => ({ ...g, [key]: !g[key] }))} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>
            <span>{label}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{groups[key] ? "▾" : "▸"}</span>
          </button>
          {groups[key] && NAV_ITEMS.filter((i) => i.group === key).map((item) => (
            <button key={item.id} onClick={() => navigate(`/${item.id}`)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: current === item.id ? "rgba(255,255,255,0.13)" : "transparent", color: current === item.id ? "white" : "rgba(255,255,255,0.5)", fontWeight: current === item.id ? 700 : 400, fontSize: 12, textAlign: "left", transition: "all 0.12s", marginBottom: 1 }}>
              <span style={{ fontSize: 13 }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
        </div>
      ))}
    </aside>
  );
}
