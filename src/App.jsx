import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./hooks/useData";
import { useCalendarAutoSync } from "./hooks/useCalendarAutoSync";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Meetings from "./pages/Meetings";
import AssetAllocation from "./pages/AssetAllocation";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import Repasse from "./pages/Repasse";
import Noticias from "./pages/Noticias";
import Relatorios from "./pages/Relatorios";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#061841", color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", fontSize: 13 }}>Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  useCalendarAutoSync();
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#061841", color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", fontSize: 13 }}>Carregando…</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:slug" element={<ClientDetail />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="allocation" element={<AssetAllocation />} />
        <Route path="repasse" element={<Repasse />} />
        <Route path="noticias" element={<Noticias />} />
        <Route path="backup" element={<Backup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
