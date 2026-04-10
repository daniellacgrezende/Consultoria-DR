import { STATUS_MAP, PERFIL_MAP, CURVA_MAP } from "../../utils/constants";

const badgeBase = { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" };

export function SBadge({ s }) {
  const c = STATUS_MAP[s] || STATUS_MAP.inativo;
  return <span style={{ ...badgeBase, background: c.bg, color: c.color }}>{c.label}</span>;
}

export function PBadge({ p }) {
  const c = PERFIL_MAP[p];
  if (!c) return <span style={{ fontSize: 11, color: "#9E9C9E" }}>{p || "—"}</span>;
  return <span style={{ ...badgeBase, background: c.color + "15", color: c.color, border: `1px solid ${c.color}25` }}>{c.label}</span>;
}

export function CBadge({ curva }) {
  const c = CURVA_MAP[curva || "D"];
  return <span style={{ ...badgeBase, background: c.bg, color: c.color }}>{c.label}</span>;
}

export function TempBadge({ temp }) {
  const map = {
    fria: { bg: "#E8F0FE", color: "#2A7DE1" },
    morna: { bg: "#FFF4D6", color: "#E89B00" },
    quente: { bg: "#FDE8E8", color: "#D30000" },
  };
  const c = map[temp] || map.morna;
  return <span style={{ ...badgeBase, background: c.bg, color: c.color }}>{temp === "fria" ? "🥶 Fria" : temp === "quente" ? "🔥 Quente" : "🌤 Morna"}</span>;
}
