import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, getPeriodDays, daysUntil, today, slugify, huid } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";

const GRACE_DAYS = 10;

function getRelStatus(diasSem, periodDays) {
  if (diasSem === null) return { label: "Nunca enviado", color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays + GRACE_DAYS) return { label: "Atrasado", color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays) return { label: "Enviar", color: "#c2410c", bg: "#fff7ed" }; // margem 10 dias
  const warn = Math.round(periodDays * 0.83);
  if (diasSem > warn) return { label: "Atenção", color: "#c2410c", bg: "#fff7ed" };
  return { label: "Em Dia", color: "#16a34a", bg: "#f0fdf4" };
}

// Calcula o 5o dia útil do mês (seg-sex)
function get5thBusinessDay(year, month) {
  let count = 0;
  let day = 0;
  while (count < 5) {
    day++;
    const d = new Date(year, month, day);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return day;
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const TH = { padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: "1px solid rgba(10,8,9,0.06)", background: "#f5f7ff" };

export default function Relatorios() {
  const navigate = useNavigate();
  const { clients, saveClient, setToast } = useData();
  const [sortCol, setSortCol] = useState("diasSem");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [filterClient, setFilterClient] = useState(null);

  // ─── Checklist mensal ───
  const [checklist, setChecklist] = useState([]);
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bd5 = get5thBusinessDay(now.getFullYear(), now.getMonth());
  const bd5Date = new Date(now.getFullYear(), now.getMonth(), bd5);
  const isPastBd5 = now >= bd5Date;

  const loadChecklist = useCallback(async () => {
    const { data } = await supabase.from("report_checklist").select("*").eq("month", currentMonth);
    setChecklist(data || []);
    setChecklistLoaded(true);
  }, [currentMonth]);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const monthlyClients = useMemo(() =>
    active.filter((c) => {
      const p = (c.periodicidade_relatorio || c.periodicidadeRelatorio || "").toLowerCase();
      return p === "mensal";
    }).sort((a, b) => a.nome.localeCompare(b.nome)),
  [active]);

  const checkedMap = useMemo(() => {
    const m = {};
    checklist.forEach((r) => { m[r.client_id] = r; });
    return m;
  }, [checklist]);

  const checkedCount = monthlyClients.filter((c) => checkedMap[c.id]?.checked).length;

  const toggleCheck = async (clientId) => {
    const existing = checkedMap[clientId];
    if (existing) {
      const newChecked = !existing.checked;
      await supabase.from("report_checklist").update({ checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null }).eq("id", existing.id);
      setChecklist((p) => p.map((r) => r.id === existing.id ? { ...r, checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null } : r));
      if (newChecked) {
        const cl = clients.find((c) => c.id === clientId);
        if (cl) await saveClient({ ...cl, ultimo_relatorio: today() }, false);
      }
    } else {
      const entry = { id: huid(), client_id: clientId, month: currentMonth, checked: true, checked_at: new Date().toISOString() };
      const { data } = await supabase.from("report_checklist").insert(entry).select();
      if (data) setChecklist((p) => [...p, data[0]]);
      const cl = clients.find((c) => c.id === clientId);
      if (cl) await saveClient({ ...cl, ultimo_relatorio: today() }, false);
    }
  };

  const naoAplicaRel = (c) => (c.periodicidade_relatorio || c.periodicidadeRelatorio || "").toLowerCase() === "não se aplica";

  const rows = useMemo(() => {
    let r = active.filter((c) => !naoAplicaRel(c)).map((c) => ({
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
    if (naoAplicaRel(c)) return false;
    const proxRel = c.proximo_relatorio || c.proximoRelatorio;
    if (!proxRel) return false; // sem data → sem pendência
    return new Date(proxRel) < new Date();
  }).length;

  const atencao = active.filter((c) => {
    if (naoAplicaRel(c)) return false;
    const d = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
    const p = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    return d !== null && d > Math.round(p * 0.83) && d <= p;
  }).length;

  const emDia = active.filter((c) => {
    if (naoAplicaRel(c)) return false;
    const d = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
    const p = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
    return d !== null && d <= Math.round(p * 0.83);
  }).length;

  const marcarEnviado = async (c) => {
    await saveClient({ ...c, ultimo_relatorio: today() }, false);
    setToast({ type: "success", text: `Relatório de ${c.nome.split(" ")[0]} marcado como enviado hoje.` });
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

      {/* ═══ CHECKLIST MENSAL ═══ */}
      {monthlyClients.length > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: B.navy }}>Envio Mensal — {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</div>
              <div style={{ fontSize: 11, color: B.gray, marginTop: 2 }}>
                Prazo: 5º dia útil ({bd5}/{String(now.getMonth() + 1).padStart(2, "0")})
                {isPastBd5 && checkedCount < monthlyClients.length && (
                  <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: 8 }}>Prazo atingido</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: checkedCount === monthlyClients.length ? "#16a34a" : B.navy }}>
                {checkedCount}/{monthlyClients.length}
              </div>
              <div style={{ width: 120, height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${monthlyClients.length > 0 ? (checkedCount / monthlyClients.length) * 100 : 0}%`, height: "100%", background: checkedCount === monthlyClients.length ? "#16a34a" : "#2563eb", borderRadius: 999, transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {monthlyClients.map((c) => {
              const isChecked = checkedMap[c.id]?.checked;
              const checkedAt = checkedMap[c.id]?.checked_at;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1px solid ${isChecked ? "#bbf7d0" : B.border}`, background: isChecked ? "#f0fdf4" : "white", cursor: "pointer", transition: "all 0.15s" }} onClick={() => toggleCheck(c.id)}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isChecked ? "#16a34a" : "#cbd5e1"}`, background: isChecked ? "#16a34a" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {isChecked && <span style={{ color: "white", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <Avatar nome={c.nome} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isChecked ? "#16a34a" : B.navy, textDecoration: isChecked ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                    <div style={{ fontSize: 10, color: B.gray }}>{c.profissao || "—"}</div>
                  </div>
                  {isChecked && checkedAt && (
                    <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600, whiteSpace: "nowrap" }}>
                      Enviado {new Date(checkedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${slugify(c.nome)}`); }} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Ficha</button>
                </div>
              );
            })}
          </div>

          {checkedCount === monthlyClients.length && monthlyClients.length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
              Todos os relatórios mensais foram enviados!
            </div>
          )}
        </Card>
      )}

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
