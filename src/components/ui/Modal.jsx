export default function Modal({ open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 300, backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#FFFFFF", borderRadius: 16, width: "100%",
        maxWidth: wide ? 800 : 520, maxHeight: "93vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(10,8,9,0.18)", border: "1px solid rgba(10,8,9,0.06)",
        animation: "fadeUp 0.2s ease",
      }}>
        {children}
      </div>
    </div>
  );
}
