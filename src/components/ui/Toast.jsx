import { useEffect } from "react";
import { B } from "../../utils/constants";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 400, background: toast.type === "error" ? "#dc2626" : B.navy, color: "white", padding: "11px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, maxWidth: 320 }}>
      {toast.type === "error" ? "❌" : "✅"} {toast.text}
    </div>
  );
}
