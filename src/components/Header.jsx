import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { B, NAV_ITEMS } from "../utils/constants";

const PAGE_NAMES = {};
NAV_ITEMS.forEach((i) => { PAGE_NAMES[i.id] = i.label; });
PAGE_NAMES[""] = "Dashboard";
PAGE_NAMES["dashboard"] = "Dashboard";

export default function Header() {
  const { signOut } = useAuth();
  const location = useLocation();
  const path = location.pathname.replace("/", "") || "dashboard";
  const pageName = PAGE_NAMES[path] || path;

  return (
    <header style={{
      height: 48, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", flexShrink: 0,
      background: "rgba(250,250,249,0.8)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: `1px solid ${B.border}`, position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        <span style={{ color: B.black, fontWeight: 600 }}>{pageName}</span>
      </div>
      <button onClick={signOut} style={{
        background: "transparent", border: `1px solid ${B.border}`,
        color: B.gray, borderRadius: 6, padding: "5px 14px",
        fontSize: 11, cursor: "pointer", fontWeight: 500, fontFamily: "inherit",
        transition: "all 0.15s",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = B.muted; e.currentTarget.style.color = B.black; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.color = B.gray; }}
      >Sair</button>
    </header>
  );
}
