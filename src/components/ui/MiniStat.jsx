import { B } from "../../utils/constants";

const BAR_COLORS = [B.brand, B.info, "#8200C2", B.success];

export default function MiniStat({ icon, label, value, warn, sub, idx = 0 }) {
  const barColor = warn ? B.danger : BAR_COLORS[idx % BAR_COLORS.length];
  return (
    <div style={{
      background: "rgba(255,255,255,0.78)", backdropFilter: "blur(14px)",
      border: `1px solid ${B.border}`, borderRadius: 14,
      padding: "16px 18px", borderTop: `3px solid ${barColor}`,
      boxShadow: B.shadow, transition: "all 0.2s ease",
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
