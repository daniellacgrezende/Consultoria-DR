import { useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP, CURVA_MAP } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurva, getCurrentPL, daysSince, getPeriodDays, slugify } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import { CBadge } from "../components/ui/Badge";
import { SecH } from "../components/ui/FormFields";

export default function Dashboard() {
  const navigate = useNavigate();
  const { clients, history, leads, aportes } = useData();
  const [ufFilter, setUfFilter] = useState("");
  const [showAUM, setShowAUM] = useState(false);
  const [showClientes, setShowClientes] = useState(false);
  const [selectedMes, setSelectedMes] = useState(null);
  const [origemDrill, setOrigemDrill] = useState(null);
  const [perfilDrill, setPerfilDrill] = useState(null);
  const [seguroDrill, setSeguroDrill] = useState(null);

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

  const origemMap = {};
  active.forEach((c) => { const k = c.origem_cliente || "—"; origemMap[k] = (origemMap[k] || 0) + 1; });
  const origemData = Object.entries(origemMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  const OCOLS = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

  const leadsAtivos = leads.filter((l) => !["Cliente", "Perdido", "Nutrição", "Desqualificado"].includes(l.etapa)).length;
  const leadsConvertidos = leads.filter((l) => l.etapa === "Cliente").length;

  // Aportes/Resgates mensais (a partir de 2026)
  const aportesMonthly = useMemo(() => {
    const map = {};
    aportes.forEach((a) => {
      if (!a.data || a.data < "2026") return;
      const mes = a.data.slice(0, 7);
      if (!map[mes]) map[mes] = { aporte: 0, resgate: 0 };
      if (a.tipo === "aporte") map[mes].aporte += Number(a.valor || 0);
      else if (a.tipo === "resgate") map[mes].resgate += Number(a.valor || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mes, { aporte, resgate }]) => ({
        mes,
        label: new Date(mes + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", ""),
        aporte,
        resgate,
        liquido: aporte - resgate,
      }));
  }, [aportes]);

  const n = aportesMonthly.length || 1;
  const avgAporte = aportesMonthly.reduce((s, m) => s + m.aporte, 0) / n;
  const avgResgate = aportesMonthly.reduce((s, m) => s + m.resgate, 0) / n;
  const avgLiquido = aportesMonthly.reduce((s, m) => s + m.liquido, 0) / n;

  const mesDetail = useMemo(() => {
    if (!selectedMes) return [];
    return aportes
      .filter((a) => a.data?.startsWith(selectedMes))
      .map((a) => ({ ...a, clientNome: clients.find((c) => c.id === a.client_id)?.nome || "—" }))
      .sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === "aporte" ? -1 : 1;
        return Number(b.valor) - Number(a.valor);
      });
  }, [selectedMes, aportes, clients]);

  // UF data
  const ufMap = {};
  active.forEach((c) => { const k = (c.uf || "—").toUpperCase(); ufMap[k] = (ufMap[k] || []); ufMap[k].push(c); });
  const ufSorted = Object.entries(ufMap).sort((a, b) => b[1].length - a[1].length);
  const ufFiltered = ufFilter ? ufSorted.filter(([uf]) => uf.includes(ufFilter)) : ufSorted.slice(0, 6);

  return (
    <>
      <SecH eyebrow="Dashboard" title="Home" desc="Visão geral da carteira." />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <div onClick={() => setShowClientes((v) => !v)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
            <span>Clientes Ativos</span>
            <span>{showClientes ? "🙈" : "👁"}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showClientes ? active.length : "••"}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{showClientes ? `${clients.length} total na base` : "clique para revelar"}</div>
        </div>
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
        <div onClick={() => setSeguroDrill(seguroDrill ? null : "com")} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid #16a34a`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>🛡️ Seguro de Vida</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>{active.length > 0 ? Math.round((totalSeguro / active.length) * 100) : 0}%</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{totalSeguro} de {active.length} clientes</div>
          {seguroDrill && (
            <div style={{ marginTop: 8, borderTop: `1px solid ${B.border}`, paddingTop: 8 }}>
              {[
                { key: "com", label: "Com seguro", cls: active.filter((c) => c.seguro_vida || c.seguroVida), color: "#16a34a" },
                { key: "sem", label: "Sem seguro", cls: active.filter((c) => !c.seguro_vida && !c.seguroVida), color: "#dc2626" },
              ].map(({ key, label, cls, color }) => (
                <div key={key} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 3 }}>{label} ({cls.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {cls.map((c) => (
                      <span key={c.id} onClick={(e) => { e.stopPropagation(); navigate(`/clients/${slugify(c.nome)}`); }} style={{ fontSize: 10, fontWeight: 600, background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 999, padding: "1px 7px", cursor: "pointer" }}>
                        {c.nome.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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

          {/* Origem dos Clientes */}
          {origemData.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Origem dos Clientes</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ flexShrink: 0, width: 160, height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={origemData} cx="50%" cy="50%" outerRadius={72} innerRadius={30} dataKey="value" paddingAngle={2}>
                        {origemData.map((_, i) => (<Cell key={i} fill={OCOLS[i % OCOLS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} clientes`, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {origemData.map(({ name, value }, i) => {
                    const pct = Math.round((value / active.length) * 100);
                    const isOpen = origemDrill === name;
                    return (
                      <div key={name}>
                        <div onClick={() => setOrigemDrill(isOpen ? null : name)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 5px", borderRadius: 6, background: isOpen ? "#f0f4ff" : "transparent" }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: OCOLS[i % OCOLS.length], flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                              <span style={{ fontSize: 10, color: B.gray, flexShrink: 0, marginLeft: 6 }}>{value}cl · {pct}%</span>
                            </div>
                            <div style={{ height: 3, background: "#e8eeff", borderRadius: 999 }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: OCOLS[i % OCOLS.length], borderRadius: 999 }} />
                            </div>
                          </div>
                        </div>
                        {isOpen && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, marginLeft: 17, marginBottom: 2 }}>
                            {active.filter((c) => (c.origem_cliente || "—") === name).map((c) => (
                              <span key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ fontSize: 10, fontWeight: 600, background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 999, padding: "1px 8px", cursor: "pointer" }}>{c.nome.split(" ")[0]}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

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

      {/* Perfil + Aportes lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>
        {perfilData.length > 0 && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Clientes por Perfil</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perfilData} cx="50%" cy="50%" outerRadius={62} innerRadius={26} dataKey="value" paddingAngle={2}>
                      {perfilData.map((_, i) => (<Cell key={i} fill={PCOLS[i % PCOLS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} clientes`, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {perfilData.map(({ name, value }, i) => {
                const p = Math.round((value / active.length) * 100);
                const isOpen = perfilDrill === name;
                const clientsInPerfil = active.filter((c) => (PERFIL_MAP[c.perfil]?.label || c.perfil || "—") === name);
                return (
                  <div key={name}>
                    <div onClick={() => setPerfilDrill(isOpen ? null : name)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 5px", borderRadius: 6, background: isOpen ? "#f0f4ff" : "transparent" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PCOLS[i % PCOLS.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: B.navy }}>{name}</span>
                          <span style={{ fontSize: 10, color: B.gray, flexShrink: 0, marginLeft: 6 }}>{value}cl · {p}%</span>
                        </div>
                        <div style={{ height: 3, background: "#e8eeff", borderRadius: 999 }}>
                          <div style={{ height: "100%", width: `${p}%`, background: PCOLS[i % PCOLS.length], borderRadius: 999 }} />
                        </div>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, marginLeft: 16, marginBottom: 2 }}>
                        {clientsInPerfil.map((c) => (
                          <span key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ fontSize: 10, fontWeight: 600, background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 999, padding: "1px 8px", cursor: "pointer" }}>{c.nome.split(" ")[0]}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {aportesMonthly.length > 0 && (
          <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Aportes e Resgates por Mês
            <span style={{ fontSize: 10, fontWeight: 400, color: B.gray }}>a partir de 2026 · clique no mês para detalhar</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8faff" }}>
                  <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700, color: "#8899bb", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${B.border}` }}>Mês</th>
                  <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: "#16a34a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${B.border}` }}>Aportado</th>
                  <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: "#dc2626", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${B.border}` }}>Resgatado</th>
                  <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: B.navy, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${B.border}` }}>Líquido</th>
                  <th style={{ padding: "7px 12px", borderBottom: `1px solid ${B.border}`, minWidth: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxVal = Math.max(...aportesMonthly.map((m) => Math.max(m.aporte, m.resgate)), 1);
                  return aportesMonthly.map(({ mes, label, aporte, resgate, liquido }) => {
                    const isOpen = selectedMes === mes;
                    const barAp = Math.round((aporte / maxVal) * 100);
                    const barRe = Math.round((resgate / maxVal) * 100);
                    return (
                      <Fragment key={mes}>
                        <tr onClick={() => setSelectedMes(isOpen ? null : mes)} style={{ borderBottom: isOpen ? "none" : `1px solid ${B.border}`, cursor: "pointer", background: isOpen ? "#f0f4ff" : "white", transition: "background 0.1s" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 9, color: B.muted, marginRight: 6 }}>{isOpen ? "▼" : "▶"}</span>
                            {label}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#16a34a", whiteSpace: "nowrap" }}>{aporte > 0 ? money(aporte) : "—"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#dc2626", whiteSpace: "nowrap" }}>{resgate > 0 ? money(resgate) : "—"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: liquido >= 0 ? "#16a34a" : "#dc2626", whiteSpace: "nowrap" }}>{liquido >= 0 ? "+" : ""}{money(liquido)}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ height: 4, background: "#e8eeff", borderRadius: 999 }}>
                                <div style={{ height: "100%", width: `${barAp}%`, background: "#16a34a", borderRadius: 999 }} />
                              </div>
                              <div style={{ height: 4, background: "#e8eeff", borderRadius: 999 }}>
                                <div style={{ height: "100%", width: `${barRe}%`, background: "#dc2626", borderRadius: 999 }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                            <td colSpan={5} style={{ padding: 0 }}>
                              <div style={{ background: "#f8faff", borderTop: `1px solid ${B.border}`, padding: "8px 16px 10px" }}>
                                {mesDetail.length === 0 ? (
                                  <div style={{ fontSize: 11, color: B.gray, padding: "6px 0" }}>Nenhum registro encontrado.</div>
                                ) : (
                                  mesDetail.map((a) => (
                                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${B.border}` }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                        <span style={{ fontWeight: 800, fontSize: 13, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{a.tipo === "aporte" ? "+" : "−"}</span>
                                        <span style={{ fontWeight: 600, fontSize: 12, color: B.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.clientNome}</span>
                                        {a.observacao && <span style={{ fontSize: 10, color: B.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {a.observacao}</span>}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 12 }}>
                                        <span style={{ fontSize: 10, color: B.muted }}>{a.data?.split("-").reverse().join("/")}</span>
                                        <span style={{ fontWeight: 700, fontSize: 12, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626" }}>{money(a.valor)}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: B.navy, fontSize: 11 }}>Média mensal</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#16a34a", fontSize: 11 }}>{money(avgAporte)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#dc2626", fontSize: 11 }}>{money(avgResgate)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: avgLiquido >= 0 ? "#16a34a" : "#dc2626", fontSize: 11 }}>{avgLiquido >= 0 ? "+" : ""}{money(avgLiquido)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        )}
      </div>


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

    </>
  );
}
