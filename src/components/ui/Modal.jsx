export default function Modal({ open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,24,65,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: wide ? 800 : 520, maxHeight: "93vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(6,24,65,0.3)" }}>
        {children}
      </div>
    </div>
  );
}
