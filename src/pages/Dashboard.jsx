import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";
import { B, PERFIL_MAP, CURVA_MAP } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurva, getCurrentPL, daysSince, getPeriodDays } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import { CBadge } from "../components/ui/Badge";
import { SecH } from "../components/ui/FormFields";

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [leads, setLeads] = useState([]);
  const [showAUM, setShowAUM] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [c, h, l] = await Promise.all([
        supabase.from("clients").select("*").eq("status", "ativo"),
        supabase.from("history").select("*"),
        supabase.from("leads").select("*"),
      ]);
      setClients(c.data || []);
      setHistory(h.data || []);
      setLeads(l.data || []);
    };
    load();
  }, []);

  const active = clients;
  const getPL = (c) => getCurrentPL(c, history);
  const totalAUM = useMemo(() => active.reduce((s, c) => s + getPL(c), 0), [active, history]);
  const aumMedio = active.length ? totalAUM / active.length : 0;
  const totalSeguro = active.filter((c) => c.seguro_vida).length;
  const alertas = active.filter((c) => { const d = daysSince(c.ultima_reuniao); const p = getPeriodDays(c.periodicidade_reuniao); return d !== null && d > p; }).length;
  const outdatedIps = active.filter((c) => !c.envio_ips).length;
  const totalAlertas = alertas + outdatedIps;
  const ufs = [...new Set(active.map((c) => c.uf).filter(Boolean))].length;

  const top10 = [...active].sort((a, b) => getPL(b) - getPL(a)).slice(0, 10);
  const curvaSummary = ["A", "B", "C", "D"].map((k) => ({ k, ...CURVA_MAP[k], count: active.filter((c) => getCurva(getPL(c)) === k).length, aum: active.filter((c) => getCurva(getPL(c)) === k).reduce((s, c) => s + getPL(c), 0) }));

  const perfilMap = {};
  active.forEach((c) => { const k = PERFIL_MAP[c.perfil]?.label || c.perfil || "—"; perfilMap[k] = (perfilMap[k] || 0) + 1; });
  const perfilData = Object.entries(perfilMap).map(([name, value]) => ({ name, value }));
  const PCOLS = ["#2563eb", "#7c3aed", "#0891b2", "#dc2626", "#9f1239", "#16a34a"];

  const leadsAtivos = leads.filter((l) => l.etapa !== "Convertido" && l.etapa !== "Perdido").length;
  const leadsConvertidos = leads.filter((l) => l.etapa === "Convertido").length;

  return (
    <>
      <SecH eyebrow="Dashboard" title="Home" desc="Visão geral da carteira." />

      {/* Hero Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        <MiniStat icon="👥" label="Clientes Ativos" value={active.length} sub={`carteira ativa`} />
        <div onClick={() => setShowAUM((v) => !v)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>💼 AUM {showAUM ? "🔓" : "🔒"}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showAUM ? money(totalAUM) : "• • • • •"}</div>
            </div>
          </div>
        </div>
        <MiniStat icon="🎯" label="Leads Ativos" value={leadsAtivos} sub={`${leadsConvertidos} convertidos`} />
        <MiniStat icon="⚠️" label="Alertas" value={totalAlertas} warn={totalAlertas > 0} sub="reunião + IPS" />
        <MiniStat icon="🗺️" label="Estados" value={ufs} sub="UFs representadas" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Top 10 */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>🏆 Top 10 por Patrimônio</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {top10.map((c, i) => (
              <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : i === 2 ? "#fef9ef" : "white", border: `1px solid ${i < 3 ? "#e8dfc8" : B.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#b45309" : i === 1 ? "#475569" : i === 2 ? "#92400e" : B.gray, width: 20, textAlign: "center" }}>{i + 1}</span>
                <Avatar nome={c.nome} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: B.gray }}>{c.profissao}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>{showAUM ? money(getPL(c)) : "•••"}</div>
                  <CBadge curva={getCurva(getPL(c))} />
                </div>
              </div>
            ))}
            {top10.length === 0 && <div style={{ padding: 20, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum cliente cadastrado</div>}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* AUM por Curva */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📊 AUM por Curva</div>
            {curvaSummary.map(({ k, label, color, bg, count, aum }) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: bg, color: color, borderRadius: 999, padding: "2px 9px", minWidth: 56, textAlign: "center" }}>{label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{showAUM ? money(aum) : "•••"}</span>
                    <span style={{ fontSize: 11, color: B.gray }}>{count}cl</span>
                  </div>
                  <div style={{ height: 5, background: "#e8eeff", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: totalAUM > 0 ? `${Math.round((aum / totalAUM) * 100)}%` : "0%", background: color, borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Perfil */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📊 Clientes por Perfil</div>
            {perfilData.length > 0 ? (
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={perfilData} cx="50%" cy="50%" outerRadius={52} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={9}>
                    {perfilData.map((_, i) => (<Cell key={i} fill={PCOLS[i % PCOLS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}cl`, n]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: B.gray, fontSize: 12 }}>Sem dados</div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
