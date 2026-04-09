import { useAuth } from "../contexts/AuthContext";
import { B } from "../utils/constants";
import Avatar from "./ui/Avatar";

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{user?.email}</span>
        <Avatar nome={user?.email || "U"} size={32} />
        <button onClick={signOut} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Sair</button>
      </div>
    </header>
  );
}
