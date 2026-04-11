import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { B, NAV_ITEMS, NAV_GROUPS } from "../utils/constants";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "./ui/Avatar";
import { Home, Target, Calendar, CheckSquare, DollarSign, Users, ClipboardList, Shield, PieChart, TrendingUp, HardDrive, Settings } from "lucide-react";

const ICON_MAP = { Home, Target, Calendar, CheckSquare, DollarSign, Users, ClipboardList, Shield, PieChart, TrendingUp, HardDrive, Settings };

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const current = location.pathname.replace("/", "") || "dashboard";
  const [groups, setGroups] = useState({ vendas: true, clientes: true, relatorios: true, config: true });

  const standalone = NAV_ITEMS.filter((i) => !i.group);
  const grouped = Object.entries(NAV_GROUPS);

  const itemStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
    background: active ? "rgba(211,0,0,0.18)" : "transparent",
    color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
    fontWeight: active ? 600 : 400, fontSize: 12.5, textAlign: "left",
    transition: "all 0.15s ease", fontFamily: "inherit",
  });

  const renderIcon = (iconName, active) => {
    const IconComp = ICON_MAP[iconName];
    if (!IconComp) return null;
    return <IconComp size={16} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />;
  };

  return (
    <aside style={{
      width: 200, position: "fixed", top: 0, left: 0, bottom: 0,
      background: B.navy, display: "flex", flexDirection: "column",
      zIndex: 50, overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 16px 16px" }}>
        <svg width="28" height="28" viewBox="0 0 60 60" fill="none">
          <path d="M8 8 L8 36 L34 36 Q50 36 50 22 Q50 8 34 8 Z" fill="white" opacity="0.95" />
          <path d="M8 42 L8 54 L28 54 L50 42 Z" fill="white" opacity="0.65" />
        </svg>
        <span style={{ color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", fontFamily: "'Poppins', sans-serif" }}>CONSULTORIA DR</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {standalone.map((item) => (
          <button key={item.id} onClick={() => navigate(`/${item.id === "dashboard" ? "" : item.id}`)}
            style={itemStyle(current === item.id)}
            onMouseEnter={(e) => { if (current !== item.id) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; } }}
            onMouseLeave={(e) => { if (current !== item.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; } }}
          >
            {renderIcon(item.icon, current === item.id)}{item.label}
          </button>
        ))}

        <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "8px 8px" }} />

        {grouped.map(([key, label]) => (
          <div key={key} style={{ marginBottom: 2 }}>
            <button onClick={() => setGroups((g) => ({ ...g, [key]: !g[key] }))} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 16px", background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.40)", fontSize: 9, fontWeight: 700,
              letterSpacing: "2px", textTransform: "uppercase", fontFamily: "inherit",
            }}>
              <span>{label}</span>
              <span style={{ fontSize: 8, transition: "transform 0.2s", transform: groups[key] ? "rotate(0)" : "rotate(-90deg)" }}>▼</span>
            </button>
            <div style={{ overflow: "hidden", maxHeight: groups[key] ? 500 : 0, transition: "max-height 0.25s ease" }}>
              {NAV_ITEMS.filter((i) => i.group === key).map((item) => (
                <button key={item.id} onClick={() => navigate(`/${item.id}`)}
                  style={itemStyle(current === item.id)}
                  onMouseEnter={(e) => { if (current !== item.id) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; } }}
                  onMouseLeave={(e) => { if (current !== item.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; } }}
                >
                  {renderIcon(item.icon, current === item.id)}{item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar nome={user?.email || "U"} size={32} />
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email?.split("@")[0]}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>Consultor</div>
        </div>
      </div>
    </aside>
  );
}
