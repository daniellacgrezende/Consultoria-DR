import { B } from "../../utils/constants";
import Avatar from "./Avatar";

export default function SearchBox({ placeholder, value, onChange, onFocus, onBlur, suggestions = [], onSelect, style }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <input value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", background: "white", border: `1px solid ${B.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit" }} />
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: `1px solid ${B.border}`, borderRadius: 9, boxShadow: "0 8px 28px rgba(6,24,65,0.14)", zIndex: 100, maxHeight: 240, overflowY: "auto" }}>
          {suggestions.map((c) => (
            <div key={c.id} onMouseDown={() => onSelect(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${B.border}`, fontSize: 13, color: B.navy, display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar nome={c.nome} size={30} />
              <div>
                <div style={{ fontWeight: 600 }}>{c.nome}</div>
                <div style={{ fontSize: 11, color: B.gray }}>{c.profissao || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
