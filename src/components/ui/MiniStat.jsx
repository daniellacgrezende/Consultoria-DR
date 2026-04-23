import { B } from "../../utils/constants";

const BAR_COLORS = [B.brand, B.info, "#8200C2", B.success];

export default function MiniStat({ icon, label, value, warn, sub, idx = 0, onClick, selected }) {
  const barColor = warn ? B.danger : BAR_COLORS[idx % BAR_COLORS.length];
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? `${barColor}14` : "rgba(255,255,255,0.78)",
        backdropFilter: "blur(14px)",
        border: selected ? `2px solid ${barColor}` : `1px solid ${B.border}`,
        borderRadius: 14,
        padding: selected ? "15px 17px" : "16px 18px",
        borderTop: `3px solid ${barColor}`,
        boxShadow: selected ? `0 0 0 3px ${barColor}22` : B.shadow,
        transition: "all 0.2s ease",
        cursor: onClick ? "pointer" : "default",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: warn ? B.danger : B.black, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-1px" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: B.muted, marginTop: 3 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
    </div>
  );
}
