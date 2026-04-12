import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, getPeriodDays, daysUntil, today, slugify, addDays } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";

function getRelStatus(diasSem, periodDays) {
  if (diasSem === null) return { label: "Nunca enviado", color: "#dc2626", bg: "#fef2f2" };
  const warn = Math.round(periodDays * 0.83);
  if (diasSem > periodDays) return { label: "Atrasado", color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > warn) return { label: "Atenção", color: "#c2410c", bg: "#fff7ed" };
  return { label: "Em Dia", color: "#16a34a", bg: "#f0fdf4" };
}

const TH = { padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: "1px solid rgba(10,8,9,0.06)", background: "#f5f7ff" };

export default function Relatorios() {
  const navigate = useNavigate();
  const { clients, saveClient, setToast } = useData();
  const [sortCol, setSortCol] = useState("diasSem");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [filterClient, setFilterClient] = useState(null);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const rows = useMemo(() => {
    let r = active.map((c) => ({
      ...c,
      diasSem: daysSince(c.ultimo_relatorio || c.ultimoRelatorio),
      periodDays: getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal"),
    }));
    if (filterClient) r = r.filter((c) => c.id === filterClient);
    const dir = sortDir === "asc" ? 1 : -1;
    r.sort((a, b) => {
      if (sortCol === "diasSem") { const da = a.diasSem ?? 99999, db = b.diasSem ?? 99999; return dir * (db - da); }
      if (sortCol === "nome") return dir * a.nome.localeCompare(b.nome);
      return 0;
    });
    return r;
  }, [active, filterClient, sortCol, sortDir]);

  const atrasado = active.filter((c) => {
    const d = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
    const p = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    return d === null || d > p;
  }).length;

  const atencao = active.filter((c) => {
    const d = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
    const p = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    return d !== null && d > Math.round(p * 0.83) && d <= p;
  }).length;

  const emDia = active.filter((c) => {
    const d = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
    const p = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    return d !== null && d <= Math.round(p * 0.83);
  }).length;

  const marcarEnviado = async (c) => {
    const period = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    const proximoRelatorio = addDays(today(), period);
    await saveClient({ ...c, ultimo_relatorio: today(), proximo_relatorio: proximoRelatorio }, false);
    setToast({ type: "success", text: `Relatório de ${c.nome.split(" ")[0]} marcado como enviado. Próximo: ${proximoRelatorio.split("-").reverse().join("/")}` });
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) => sortCol !== col ? null : <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;

  return (
    <>
      <SecH eyebrow="Carteira" title="Relatórios" desc="Acompanhe o envio de relatórios para seus clientes." />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Atrasado" value={atrasado} warn={atrasado > 0} />
        <MiniStat label="Atenção" value={atencao} warn={atencao > 0} />
        <MiniStat label="Em Dia" value={emDia} />
        <MiniStat label="Clientes Ativos" value={active.length} />
      </div>

      {/* Alertas */}
      {(() => {
        const pendentes = rows.filter((c) => c.diasSem === null || c.diasSem > c.periodDays).slice(0, 5);
        const proximos = rows.filter((c) => {
          const d = daysUntil(c.proximo_relatorio || c.proximoRelatorio);
          return d !== null && d >= 0 && d <= 7;
        }).slice(0, 5);
        if (pendentes.length === 0 && proximos.length === 0) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: proximos.length > 0 && pendentes.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 18 }}>
            {pendentes.length > 0 && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 10 }}>Relatório pendente</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendentes.map((c) => (
                    <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: "white", border: "1px solid #fecaca" }}>
                      <Avatar nome={c.nome} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>{c.diasSem === null ? "Nunca enviado" : `${c.diasSem}d sem relatório`} · {c.periodicidade_relatorio || "Mensal"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {proximos.length > 0 && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", marginBottom: 10 }}>Próximos relatórios (7 dias)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {proximos.map((c) => {
                    const d = daysUntil(c.proximo_relatorio || c.proximoRelatorio);
                    return (
                      <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: "white", border: "1px solid #bfdbfe" }}>
                        <Avatar nome={c.nome} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                          <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600 }}>{fmtDate(c.proximo_relatorio || c.proximoRelatorio)} · em {d}d</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtro por cliente */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <div style={{ flex: 1, maxWidth: 340 }}>
          <SearchBox
            placeholder="Filtrar por cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSug(true); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            suggestions={showSug ? clients.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase())).slice(0, 6) : []}
            onSelect={(c) => { setFilterClient(c.id); setSearch(c.nome); setShowSug(false); }}
          />
        </div>
        {filterClient && (
          <button onClick={() => { setFilterClient(null); setSearch(""); }}
            style={{ padding: "9px 14px", background: "white", color: B.gray, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ✕ Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort("nome")} style={{ ...TH, cursor: "pointer" }}>Cliente <SortIcon col="nome" /></th>
                <th onClick={() => toggleSort("diasSem")} style={{ ...TH, cursor: "pointer" }}>Último Relatório <SortIcon col="diasSem" /></th>
                <th style={TH}>Periodicidade</th>
                <th style={TH}>Dias sem relatório</th>
                <th style={TH}>Status</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum cliente ativo</td></tr>
              )}
              {rows.map((c, i) => {
                const st = getRelStatus(c.diasSem, c.periodDays);
                const diasColor = c.diasSem === null ? "#dc2626" : c.diasSem > c.periodDays ? "#dc2626" : c.diasSem > Math.round(c.periodDays * 0.83) ? "#c2410c" : "#16a34a";
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar nome={c.nome} size={30} />
                        <div>
                          <div style={{ fontWeight: 600, color: B.navy, fontSize: 13 }}>{c.nome}</div>
                          <div style={{ fontSize: 11, color: B.gray }}>{c.profissao}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>
                      {fmtDate(c.ultimo_relatorio || c.ultimoRelatorio) || "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: B.navy, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 999, padding: "2px 10px" }}>
                        {c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: diasColor }}>
                        {c.diasSem === null ? "Nunca" : c.diasSem === 0 ? "Hoje" : `${c.diasSem}d`}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => navigate(`/clients/${slugify(c.nome)}`)}
                          style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Ficha
                        </button>
                        <button onClick={() => marcarEnviado(c)}
                          style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Marcar enviado
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
