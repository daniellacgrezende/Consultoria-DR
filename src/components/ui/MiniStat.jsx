import { B } from "../../utils/constants";

export default function MiniStat({ icon, label, value, warn, sub }) {
  return (
    <div style={{ background: "white", border: `1px solid ${warn ? "#fecaca" : B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${warn ? "#dc2626" : B.navy}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: warn ? "#dc2626" : B.navy }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
    </div>
  );
}
