import { Outlet } from "react-router-dom";
import { B } from "../utils/constants";
import { useData } from "../hooks/useData";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "./ui/Toast";

export default function Layout() {
  const { toast, setToast, loaded } = useData();

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: `linear-gradient(${B.navy},${B.navy2})`, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", fontSize: 13 }}>Carregando…</div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: `linear-gradient(180deg, ${B.navy} 0%, ${B.navy2} 100%)`, fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Header />
      <div style={{ display: "flex", flex: 1, margin: "14px 24px 24px", gap: 14, overflow: "hidden", minHeight: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, background: "#f0f4ff", borderRadius: 12, overflow: "auto", padding: "22px 26px" }}>
          <Outlet />
        </main>
      </div>
      <footer style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>CRM 360 — Consultoria DR</span>
      </footer>
    </div>
  );
}
