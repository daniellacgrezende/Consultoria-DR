import { Outlet } from "react-router-dom";
import { B } from "../utils/constants";
import { useData } from "../hooks/useData";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "./ui/Toast";

export default function Layout() {
  const { toast, setToast, loaded } = useData();

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: B.offwhite, color: B.muted, fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${B.border}`, borderTopColor: B.brand, animation: "spin 0.8s linear infinite" }} />
        <span>Carregando...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: B.offwhite, fontFamily: "'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", marginLeft: 200 }}>
        <Header />
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
