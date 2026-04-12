import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate, fmtDaysUntil } from "../utils/formatters";
import { daysSince, daysUntil, getPeriodDays, getReuniaoStatusDynamic, today, slugify } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";

export default function Meetings() {
  const navigate = useNavigate();
  const { clients, reunioes, saveClient, setToast } = useData();
  const [sortCol, setSortCol] = useState("diasAte");
  const [sortDir, setSortDir] = useState("asc");
  const [rhFilter, setRhFilter] = useState(null);
  const [rhSearch, setRhSearch] = useState("");
  const [rhShowSug, setRhShowSug] = useState(false);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const reunioesData = useMemo(() => {
    let rows = active.map((c) => ({
      ...c,
      diasSem: daysSince(c.ultima_reuniao || c.ultimaReuniao),
      diasAte: daysUntil(c.proxima_reuniao || c.proximaReuniao),
      periodDays: getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao),
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortCol === "diasSem") { const da = a.diasSem ?? -1, db = b.diasSem ?? -1; return dir * (db - da); }
      if (sortCol === "diasAte") { const da = a.diasAte ?? 99999, db = b.diasAte ?? 99999; return dir * (da - db); }
      return 0;
    });
    return rows;
  }, [active, sortCol, sortDir]);

  const critico = active.filter((c) => {
    const d = daysSince(c.ultima_reuniao || c.ultimaReuniao);
    const p = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
    if (d === null) return true;
    if (d > p) { const dAv = daysSince(c.avisado_em || c.avisadoEm); return !(dAv !== null && dAv <= 30); }
    return false;
  }).length;
  const agendar = active.filter((c) => { const d = daysSince(c.ultima_reuniao || c.ultimaReuniao); const p = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao); return d !== null && d > Math.round(p * 0.83) && d <= p; }).length;
  const emDia = active.filter((c) => { const d = daysSince(c.ultima_reuniao || c.ultimaReuniao); const p = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao); return d !== null && d <= Math.round(p * 0.83); }).length;

  const toggleSort = (col) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir(col === "diasSem" ? "desc" : "asc"); } };

  const markAvisado = async (c) => {
    await saveClient({ ...c, avisado_em: today() }, false);
    setToast({ type: "success", text: `${c.nome.split(" ")[0]} marcado como avisado.` });
  };

  // Histórico filtrado
  const rhFiltered = useMemo(() => {
    return reunioes.filter((r) => !rhFilter || r.client_id === rhFilter).sort((a, b) => b.data.localeCompare(a.data));
  }, [reunioes, rhFilter]);

  return (
    <>
      <SecH eyebrow="Agenda" title="Reuniões" desc="Acompanhe as reuniões com seus clientes." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Atrasada" value={critico} warn={critico > 0} />
        <MiniStat label="Atenção" value={agendar} warn={agendar > 0} />
        <MiniStat label="Em Dia" value={emDia} />
        <MiniStat label="Registros" value={reunioes.length} sub="total de reuniões" />
      </div>

      {/* Alertas */}
      {(() => {
        const pendentes = reunioesData.filter((c) => c.diasSem !== null && c.diasSem > c.periodDays).slice(0, 5);
        const proximas = reunioesData.filter((c) => { const d = c.diasAte; return d !== null && d >= 0 && d <= 7; }).slice(0, 5);
        if (pendentes.length === 0 && proximas.length === 0) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: proximas.length > 0 && pendentes.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 18 }}>
            {pendentes.length > 0 && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 10 }}>Reunião pendente</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendentes.map((c) => (
                    <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: "white", border: "1px solid #fecaca" }}>
                      <Avatar nome={c.nome} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>{c.diasSem}d sem reunião · {c.periodicidade_reuniao || "Trimestral"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {proximas.length > 0 && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", marginBottom: 10 }}>Próximas reuniões (7 dias)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {proximas.map((c) => (
                    <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 7, background: "white", border: "1px solid #bfdbfe" }}>
                      <Avatar nome={c.nome} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600 }}>{fmtDate(c.proxima_reuniao || c.proximaReuniao)} · em {c.diasAte}d</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Nome</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Última Reunião</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Periodicidade</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Próxima</th>
                <th onClick={() => toggleSort("diasAte")} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer" }}>Dias p/ Reunião</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Status</th>
                <th style={{ padding: "10px 14px", background: "#f5f7ff", borderBottom: `1px solid ${B.border}` }}></th>
              </tr>
            </thead>
            <tbody>
              {reunioesData.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum cliente ativo</td></tr>}
              {reunioesData.map((c, i) => {
                const dAv = daysSince(c.avisado_em || c.avisadoEm);
                const isAvisado = c.diasSem !== null && c.diasSem > c.periodDays && dAv !== null && dAv <= 30;
                const st = isAvisado ? { label: "Aguardando", color: "#0891B2", bg: "#ecfeff" } : getReuniaoStatusDynamic(c.diasSem, c.periodDays);
                const dAC = c.diasAte === null ? B.gray : c.diasAte < 0 ? "#dc2626" : c.diasAte === 0 ? "#16a34a" : c.diasAte <= 7 ? "#2563eb" : B.gray;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar nome={c.nome} size={30} /><div><div style={{ fontWeight: 600, color: B.navy, fontSize: 13 }}>{c.nome}</div><div style={{ fontSize: 11, color: B.gray }}>{c.profissao}</div></div></div></td>
                    <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{fmtDate(c.ultima_reuniao || c.ultimaReuniao)}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11, fontWeight: 600, color: B.navy, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 999, padding: "2px 10px" }}>{c.periodicidade_reuniao || c.periodicidadeReuniao || "Trimestral"}</span></td>
                    <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{fmtDate(c.proxima_reuniao || c.proximaReuniao)}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ fontWeight: 700, fontSize: 13, color: dAC }}>{fmtDaysUntil(c.diasAte)}</span></td>
                    <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Ficha</button>
                        {!isAvisado && c.diasSem !== null && c.diasSem > Math.round(c.periodDays * 0.83) && (
                          <button onClick={() => markAvisado(c)} style={{ background: "#ecfeff", color: "#0891B2", border: "1px solid #a5f3fc", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Avisei</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Histórico */}
      <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
        <span>Histórico de Reuniões</span>
        <span style={{ fontSize: 12, color: B.gray, fontWeight: 400 }}>{reunioes.length} registro(s)</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <div style={{ flex: 1, maxWidth: 340 }}>
          <SearchBox placeholder="Filtrar por cliente..." value={rhSearch} onChange={(e) => { setRhSearch(e.target.value); setRhShowSug(true); }} onFocus={() => setRhShowSug(true)} onBlur={() => setTimeout(() => setRhShowSug(false), 150)} suggestions={rhShowSug ? clients.filter((c) => c.nome.toLowerCase().includes(rhSearch.toLowerCase())).slice(0, 6) : []} onSelect={(c) => { setRhFilter(c.id); setRhSearch(c.nome); setRhShowSug(false); }} />
        </div>
        {rhFilter && <button onClick={() => { setRhFilter(null); setRhSearch(""); }} style={{ padding: "9px 14px", background: "white", color: B.gray, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✕ Limpar</button>}
      </div>
      {rhFiltered.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: B.gray, background: "white", border: `1px solid ${B.border}`, borderRadius: 12 }}>Nenhum registro{rhFilter ? " para este cliente" : ""}.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rhFiltered.slice(0, 20).map((r) => {
            const cl = clients.find((c) => c.id === r.client_id);
            return (
              <div key={r.id} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 11, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar nome={cl?.nome || "?"} size={30} />
                    <div><div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>{cl?.nome || "—"}</div><div style={{ fontSize: 11, color: B.gray }}>{cl?.profissao || "—"}</div></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{fmtDate(r.data)}</div>
                    <button onClick={() => cl && navigate(`/clients/${slugify(cl.nome)}`)} style={{ fontSize: 10, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginTop: 2 }}>Ver ficha →</button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#445566", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px" }}>{r.texto}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
