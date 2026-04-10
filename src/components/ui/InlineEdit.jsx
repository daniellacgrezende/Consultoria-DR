import { useState, useEffect } from "react";
import { fmtDate } from "../../utils/formatters";

export function InlineText({ value, onSave, placeholder = "—", style = {}, multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);

  if (editing) {
    const props = {
      value: val, onChange: (e) => setVal(e.target.value), autoFocus: true,
      onBlur: () => { onSave(val); setEditing(false); },
      onKeyDown: (e) => { if (e.key === "Enter" && !multiline) { onSave(val); setEditing(false); } if (e.key === "Escape") { setVal(value || ""); setEditing(false); } },
      style: { width: "100%", boxSizing: "border-box", padding: "4px 8px", border: "1px solid #D30000", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff", boxShadow: "0 0 0 3px rgba(211,0,0,0.08)", ...style },
    };
    return multiline ? <textarea {...props} rows={3} style={{ ...props.style, resize: "vertical" }} /> : <input {...props} />;
  }
  return (
    <span onClick={() => setEditing(true)} title="Clique para editar" style={{ cursor: "text", borderBottom: "1px dashed rgba(10,8,9,0.2)", paddingBottom: 1, minWidth: 30, display: "inline-block", fontSize: 12, color: val ? "inherit" : "#9E9C9E", transition: "border-color 0.15s", ...style }}>
      {val || placeholder}
    </span>
  );
}

export function InlineDate({ value, onSave, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);

  if (editing) return (
    <input type="date" value={val} autoFocus onChange={(e) => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Escape") { setVal(value || ""); setEditing(false); } }}
      style={{ padding: "3px 8px", border: "1px solid #D30000", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", boxShadow: "0 0 0 3px rgba(211,0,0,0.08)", ...style }} />
  );
  return (
    <span onClick={() => setEditing(true)} title="Clique para editar" style={{ cursor: "pointer", borderBottom: "1px dashed rgba(10,8,9,0.2)", paddingBottom: 1, fontSize: 12, color: value ? "inherit" : "#9E9C9E", ...style }}>
      {value ? fmtDate(value) : "—"}
    </span>
  );
}
