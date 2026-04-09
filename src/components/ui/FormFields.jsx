import { B } from "../../utils/constants";

export function Inp({ label, type = "text", ...p }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
      <input type={type} {...p} style={{ width: "100%", boxSizing: "border-box", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", ...(p.style || {}) }} onFocus={(e) => (e.target.style.borderColor = B.navy)} onBlur={(e) => (e.target.style.borderColor = B.border)} />
    </div>
  );
}

export function Sel({ label, value, onChange, opts }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={onChange} style={{ width: "100%", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit" }}>
        {opts.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
      </select>
    </div>
  );
}

export function Tarea({ label, ...p }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
      <textarea {...p} rows={3} style={{ width: "100%", boxSizing: "border-box", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", resize: "vertical" }} onFocus={(e) => (e.target.style.borderColor = B.navy)} onBlur={(e) => (e.target.style.borderColor = B.border)} />
    </div>
  );
}

export function Chk({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: B.navy, marginBottom: 10 }}>
      <input type="checkbox" checked={!!checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: B.navy }} />{label}
    </label>
  );
}

export function SecH({ eyebrow, title, desc }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#8899bb", textTransform: "uppercase" }}>{eyebrow}</div>
      <h2 style={{ margin: "3px 0 1px", fontSize: 19, fontWeight: 700, color: B.navy }}>{title}</h2>
      {desc && <p style={{ margin: 0, fontSize: 13, color: "#7890aa" }}>{desc}</p>}
    </div>
  );
}
