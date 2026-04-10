import { B } from "../../utils/constants";

const labelStyle = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: B.muted, textTransform: "uppercase", marginBottom: 4 };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: `1px solid rgba(10,8,9,0.12)`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: B.black, outline: "none", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" };

export function Inp({ label, type = "text", ...p }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} {...p} style={{ ...inputStyle, ...(p.style || {}) }}
        onFocus={(e) => { e.target.style.borderColor = "#D30000"; e.target.style.boxShadow = "0 0 0 3px rgba(211,0,0,0.08)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(10,8,9,0.12)"; e.target.style.boxShadow = "none"; }} />
    </div>
  );
}

export function Sel({ label, value, onChange, opts }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
        {opts.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
      </select>
    </div>
  );
}

export function Tarea({ label, ...p }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={labelStyle}>{label}</label>
      <textarea {...p} rows={3} style={{ ...inputStyle, resize: "vertical", ...(p.style || {}) }}
        onFocus={(e) => { e.target.style.borderColor = "#D30000"; e.target.style.boxShadow = "0 0 0 3px rgba(211,0,0,0.08)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(10,8,9,0.12)"; e.target.style.boxShadow = "none"; }} />
    </div>
  );
}

export function Chk({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: B.black, marginBottom: 10 }}>
      <input type="checkbox" checked={!!checked} onChange={onChange} style={{ width: 16, height: 16, accentColor: "#D30000", borderRadius: 4 }} />{label}
    </label>
  );
}

export function SecH({ eyebrow, title, desc }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: B.muted, textTransform: "uppercase" }}>{eyebrow}</div>
      <h2 style={{ margin: "4px 0 2px", fontSize: 20, fontWeight: 700, color: B.black, letterSpacing: "-0.01em" }}>{title}</h2>
      {desc && <p style={{ margin: 0, fontSize: 13, color: B.gray }}>{desc}</p>}
    </div>
  );
}
