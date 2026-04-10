import { useEffect } from "react";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 400,
      background: isError ? "#D30000" : "#1D3557",
      color: "white", padding: "12px 20px", borderRadius: 10,
      fontSize: 13, fontWeight: 600, maxWidth: 340,
      boxShadow: "0 8px 24px rgba(10,8,9,0.2)",
      animation: "fadeUp 0.3s ease", fontFamily: "'Poppins', sans-serif",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>{isError ? "✕" : "✓"}</span> {toast.text}
    </div>
  );
}
