import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP, CURVA_MAP } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurva, getCurrentPL, daysSince, getPeriodDays, slugify } from "../utils/helpers";
import { supabase } from "../lib/supabase";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import { CBadge } from "../components/ui/Badge";
import { SecH } from "../components/ui/FormFields";

export default function Dashboard() {
  const navigate = useNavigate();
  const { clients, history, leads } = useData();
  const [ufFilter, setUfFilter] = useState("");
  const [showAUM, setShowAUM] = useState(false);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);
  const getPL = (c) => getCurrentPL(c, history);
  const totalAUM = useMemo(() => active.reduce((s, c) => s + getPL(c), 0), [active, history]);
  const aumMedio = active.length ? totalAUM / active.length : 0;
  const totalSeguro = active.filter((c) => c.seguro_vida || c.seguroVida).length;
  const alertas = active.filter((c) => {
    const d = daysSince(c.ultima_reuniao || c.ultimaReuniao);
    const p = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
    return d !== null && d > p;
  }).length;
  const outdatedIps = active.filter((c) => !(c.envio_ips || c.envioIps)).length;
  const totalAlertas = alertas + outdatedIps;
  const ufs = [...new Set(active.map((c) => c.uf).filter(Boolean))].length;

  const top10 = useMemo(() => [...active].sort((a, b) => getPL(b) - getPL(a)).slice(0, 10), [active, history]);

  // Top Indicadores: agrupa clientes por "indicado_por", soma PL, ordena desc
  const topIndicadores = useMemo(() => {
    const map = {};
    active.forEach((c) => {
      const ind = c.indicado_por || c.indicadoPor;
      if (!ind) return;
      if (!map[ind]) map[ind] = { nome: ind, count: 0, pl: 0 };
      map[ind].count += 1;
      map[ind].pl += getPL(c);
    });
    return Object.values(map).sort((a, b) => b.pl - a.pl);
  }, [active, history]);
  const curvaSummary = ["A", "B", "C", "D"].map((k) => ({
    k, ...CURVA_MAP[k],
    count: active.filter((c) => getCurva(getPL(c)) === k).length,
    aum: active.filter((c) => getCurva(getPL(c)) === k).reduce((s, c) => s + getPL(c), 0),
  }));

  const perfilMap = {};
  active.forEach((c) => { const k = PERFIL_MAP[c.perfil]?.label || c.perfil || "—"; perfilMap[k] = (perfilMap[k] || 0) + 1; });
  const perfilData = Object.entries(perfilMap).map(([name, value]) => ({ name, value }));
  const PCOLS = ["#2563eb", "#7c3aed", "#0891b2", "#dc2626", "#9f1239", "#16a34a"];

  const leadsAtivos = leads.filter((l) => !["Cliente", "Perdido", "Nutrição"].includes(l.etapa)).length;
  const leadsConvertidos = leads.filter((l) => l.etapa === "Cliente").length;

  // Calendar events
  const [calEvents, setCalEvents] = useState([]);
  useEffect(() => {
    supabase.from("calendar_events").select("*").order("start_at").then(({ data }) => {
      setCalEvents(data || []);
    });
  }, []);

  const proximosEventos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return calEvents
      .filter((e) => { const d = new Date(e.start_at); return d >= today && d <= end; })
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  }, [calEvents]);

  // UF data
  const ufMap = {};
  active.forEach((c) => { const k = (c.uf || "—").toUpperCase(); ufMap[k] = (ufMap[k] || []); ufMap[k].push(c); });
  const ufSorted = Object.entries(ufMap).sort((a, b) => b[1].length - a[1].length);
  const ufFiltered = ufFilter ? ufSorted.filter(([uf]) => uf.includes(ufFilter)) : ufSorted.slice(0, 6);

  return (
    <>
      <SecH eyebrow="Dashboard" title="Home" desc="Visão geral da carteira." />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <MiniStat label="Clientes Ativos" value={active.length} sub={`${clients.length} total na base`} />
        <div onClick={() => setShowAUM((v) => !v)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
            <span>Patrimônio sob Gestão</span>
            <span>{showAUM ? "🙈" : "👁"}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showAUM ? money(totalAUM) : "R$ ••••••"}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{showAUM ? `${active.length} clientes` : "clique para revelar"}</div>
        </div>
        <div onClick={() => setShowAUM((v) => !v)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Patrimônio Médio</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showAUM ? money(aumMedio) : "R$ ••••••"}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>por cliente ativo</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Top 10 */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Top 10 por Patrimônio</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {top10.map((c, i) => (
              <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : i === 2 ? "#fef9ef" : "white", border: `1px solid ${i < 3 ? "#e8dfc8" : B.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#b45309" : i === 1 ? "#475569" : i === 2 ? "#92400e" : B.gray, width: 20, textAlign: "center" }}>{i + 1}</span>
                <Avatar nome={c.nome} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: B.gray }}>{c.profissao}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>{money(getPL(c))}</div>
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
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>AUM por Curva</div>
            {curvaSummary.map(({ k, label, color, bg, count, aum }) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: bg, color, borderRadius: 999, padding: "2px 9px", minWidth: 56, textAlign: "center" }}>{label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{money(aum)}</span>
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
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Clientes por Perfil</div>
            {perfilData.length > 0 ? (
              <ResponsiveContainer width="100%" height={130}>
                <PieChart><Pie data={perfilData} cx="50%" cy="50%" outerRadius={52} dataKey="value" label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`} labelLine={false} fontSize={9}>{perfilData.map((_, i) => (<Cell key={i} fill={PCOLS[i % PCOLS.length]} />))}</Pie><Tooltip formatter={(v, n) => [`${v}cl`, n]} /></PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: B.gray, fontSize: 12 }}>Sem dados</div>
            )}
          </Card>

          {/* UF Filter */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>🗺️ Por Estado (UF)</div>
            <input value={ufFilter} onChange={(e) => setUfFilter(e.target.value.toUpperCase())} placeholder="Filtrar por UF (ex: SP, ES…)" style={{ width: "100%", boxSizing: "border-box", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: B.navy, outline: "none", fontFamily: "inherit", marginBottom: 8 }} />
            {ufFiltered.map(([uf, cls]) => (
              <div key={uf} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{uf}</span>
                  <span style={{ fontSize: 11, color: B.gray }}>{cls.length}cl</span>
                </div>
                <div style={{ height: 5, background: "#e8eeff", borderRadius: 999, marginBottom: ufFilter ? 3 : 0 }}>
                  <div style={{ height: "100%", width: `${Math.round((cls.length / active.length) * 100)}%`, background: B.navy, borderRadius: 999 }} />
                </div>
                {ufFilter && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {cls.map((c) => (
                      <span key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ fontSize: 10, fontWeight: 600, background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 999, padding: "1px 8px", cursor: "pointer" }}>{c.nome.split(" ")[0]}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Top Indicadores */}
      {topIndicadores.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>
            🤝 Top Indicadores
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topIndicadores.map((ind, i) => {
              const pct = topIndicadores[0].pl > 0 ? Math.round((ind.pl / topIndicadores[0].pl) * 100) : 0;
              return (
                <div key={ind.nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: i === 0 ? "#fef3c7" : "#f8faff", border: `1px solid ${i === 0 ? "#e8dfc8" : B.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "#b45309" : B.gray, width: 20, textAlign: "center" }}>{i + 1}</span>
                  <Avatar nome={ind.nome} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ind.nome}</div>
                    <div style={{ height: 4, background: "#e8eeff", borderRadius: 999, marginTop: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#8b5cf6", borderRadius: 999 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: B.navy }}>{money(ind.pl)}</div>
                    <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600 }}>{ind.count} indicado{ind.count > 1 ? "s" : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Próximos Eventos */}
      <Card style={{ marginBottom: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>
          Próximos Eventos <span style={{ fontWeight: 400, fontSize: 11, color: B.gray }}>(hoje + 7 dias)</span>
        </div>
        {proximosEventos.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum evento nos próximos 7 dias</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proximosEventos.map((ev) => {
              const d = new Date(ev.start_at);
              const isToday = d.toDateString() === new Date().toDateString();
              const dateLabel = isToday ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
              const timeLabel = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const dotColor = ev.color || (ev.type === "reuniao" ? "#2563eb" : "#7c3aed");
              return (
                <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: isToday ? "#eff6ff" : "#f8faff", border: `1px solid ${isToday ? "#bfdbfe" : B.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                    {ev.location && <div style={{ fontSize: 10, color: B.gray, marginTop: 1 }}>{ev.location}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "#2563eb" : B.navy }}>{dateLabel}</div>
                    <div style={{ fontSize: 10, color: B.gray }}>{timeLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
