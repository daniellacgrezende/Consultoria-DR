import { STATUS_MAP, PERFIL_MAP, CURVA_MAP } from "../../utils/constants";

export function SBadge({ s }) {
  const c = STATUS_MAP[s] || STATUS_MAP.inativo;
  return <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>;
}

export function PBadge({ p }) {
  const c = PERFIL_MAP[p];
  if (!c) return <span style={{ fontSize: 11, color: "#999" }}>{p || "—"}</span>;
  return <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.color + "18", color: c.color, border: `1px solid ${c.color}33` }}>{c.label}</span>;
}

export function CBadge({ curva }) {
  const c = CURVA_MAP[curva || "D"];
  return <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>;
}

export function TempBadge({ temp }) {
  const map = { fria: { bg: "#eff6ff", color: "#2563eb" }, morna: { bg: "#fffbeb", color: "#d97706" }, quente: { bg: "#fef2f2", color: "#dc2626" } };
  const c = map[temp] || map.morna;
  return <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{temp === "fria" ? "🥶 Fria" : temp === "quente" ? "🔥 Quente" : "🌤 Morna"}</span>;
}
