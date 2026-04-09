import { Outlet } from "react-router-dom";
import { B } from "../utils/constants";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: `linear-gradient(180deg, ${B.navy} 0%, ${B.navy2} 100%)`, fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, margin: "14px 24px 24px", gap: 14, overflow: "hidden", minHeight: 0 }}>
        <Sidebar />
        <main style={{ flex: 1, background: "#f0f4ff", borderRadius: 12, overflow: "auto", padding: "22px 26px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
