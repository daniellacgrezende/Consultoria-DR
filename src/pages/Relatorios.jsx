import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, getPeriodDays, daysUntil, today, slugify, huid, getCurva, getCurrentPL } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";
import { CBadge } from "../components/ui/Badge";

// Margem de atenção: entre o prazo e prazo + ATENCAO_DAYS → "Atenção"
// Após prazo + ATENCAO_DAYS → "Atrasado"
const ATENCAO_DAYS = 7;
const ATRASADO_DAYS = 15;

function getRelStatus(diasSem, periodDays) {
  if (diasSem === null) return { key: "atrasado", label: "Atrasado",  color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays + ATRASADO_DAYS) return { key: "atrasado", label: "Atrasado",  color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays + ATENCAO_DAYS)  return { key: "atrasado", label: "Atrasado",  color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays)                 return { key: "atencao",  label: "Atenção",   color: "#c2410c", bg: "#fff7ed" };
  const warn = Math.round(periodDays * 0.83);
  if (diasSem > warn)                       return { key: "atencao",  label: "Atenção",   color: "#c2410c", bg: "#fff7ed" };
  return                                           { key: "emdia",    label: "Em Dia",    color: "#16a34a", bg: "#f0fdf4" };
}

function get5thBusinessDay(year, month) {
  let count = 0, day = 0;
  while (count < 5) {
    day++;
    const dow = new Date(year, month, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return day;
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TH = { padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: "1px solid rgba(10,8,9,0.06)", background: "#f5f7ff" };

export default function Relatorios() {
  const navigate = useNavigate();
  const { clients, history, saveClient, setToast } = useData();
  const [sortCol, setSortCol] = useState("diasSem");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [filterClient, setFilterClient] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(true); // colapsável

  // ─── Checklist: usa o PRÓXIMO mês ───
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const bd5 = get5thBusinessDay(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
  const bd5Date = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), bd5);
  const isPastBd5 = now >= bd5Date;

  // ─── Checklist state ───
  const [checklist, setChecklist] = useState([]);
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  const loadChecklist = useCallback(async () => {
    const { data } = await supabase.from("report_checklist").select("*").eq("month", nextMonth);
    setChecklist(data || []);
    setChecklistLoaded(true);
  }, [nextMonth]);

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

  // Clientes não marcados ainda (para mostrar na lista)
  const pendingMonthly   = monthlyClients.filter((c) => !checkedMap[c.id]?.checked);
  const completedMonthly = monthlyClients.filter((c) =>  checkedMap[c.id]?.checked);
  const checkedCount     = completedMonthly.length;

  const toggleCheck = async (clientId) => {
    const existing = checkedMap[clientId];
    if (existing) {
      const newChecked = !existing.checked;
      await supabase.from("report_checklist")
        .update({ checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null })
        .eq("id", existing.id);
      setChecklist((p) => p.map((r) => r.id === existing.id
        ? { ...r, checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null }
        : r));
      if (newChecked) {
        const cl = clients.find((c) => c.id === clientId);
        if (cl) await saveClient({ ...cl, ultimo_relatorio: today() }, false);
      }
    } else {
      const entry = { id: huid(), client_id: clientId, month: nextMonth, checked: true, checked_at: new Date().toISOString() };
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

  // Painel pendentes: separado em Atenção e Atrasado
  const pendentesAtencao  = rows.filter((c) => c.diasSem !== null && c.diasSem > c.periodDays && c.diasSem <= c.periodDays + ATRASADO_DAYS).slice(0, 5);
  const pendentesAtrasado = rows.filter((c) => c.diasSem === null || c.diasSem > c.periodDays + ATRASADO_DAYS).slice(0, 5);

  const proximos = rows.filter((c) => {
    const d = daysUntil(c.proximo_relatorio || c.proximoRelatorio);
    return d !== null && d >= 0 && d <= 7;
  }).slice(0, 5);

  const atrasadoCount = rows.filter((c) => { const st = getRelStatus(c.diasSem, c.periodDays); return st.key === "atrasado"; }).length;
  const atencaoCount  = rows.filter((c) => { const st = getRelStatus(c.diasSem, c.periodDays); return st.key === "atencao";  }).length;
  const emDiaCount    = rows.filter((c) => { const st = getRelStatus(c.diasSem, c.periodDays); return st.key === "emdia";    }).length;

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
        <MiniStat label="Atrasado" value={atrasadoCount} warn={atrasadoCount > 0} />
        <MiniStat label="Atenção"  value={atencaoCount}  warn={atencaoCount > 0} />
        <MiniStat label="Em Dia"   value={emDiaCount} />
        <MiniStat label="Clientes Ativos" value={active.length} />
      </div>

      {/* ═══ CHECKLIST MENSAL (colapsável) ═══ */}
      {monthlyClients.length > 0 && (
        <Card style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
          {/* Cabeçalho clicável */}
          <div
            onClick={() => setChecklistOpen((v) => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", userSelect: "none", borderBottom: checklistOpen ? `1px solid ${B.border}` : "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, display: "inline-block", transition: "transform 0.2s", transform: checklistOpen ? "rotate(90deg)" : "rotate(0deg)", color: B.muted }}>▶</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: B.navy }}>
                  Envio Mensal — {MONTH_NAMES[nextMonthDate.getMonth()]} {nextMonthDate.getFullYear()}
                </div>
                <div style={{ fontSize: 11, color: B.gray, marginTop: 1 }}>
                  Prazo: 5º dia útil ({bd5}/{String(nextMonthDate.getMonth() + 1).padStart(2, "0")})
                  {isPastBd5 && checkedCount < monthlyClients.length && (
                    <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: 8 }}>Prazo atingido</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: checkedCount === monthlyClients.length ? "#16a34a" : B.navy }}>
                {checkedCount}/{monthlyClients.length}
              </div>
              <div style={{ width: 100, height: 7, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${monthlyClients.length > 0 ? (checkedCount / monthlyClients.length) * 100 : 0}%`, height: "100%", background: checkedCount === monthlyClients.length ? "#16a34a" : "#2563eb", borderRadius: 999, transition: "width 0.3s" }} />
              </div>
            </div>
          </div>

          {checklistOpen && (
            <div style={{ padding: "12px 16px" }}>
              {/* Pendentes de envio */}
              {pendingMonthly.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: completedMonthly.length > 0 ? 10 : 0 }}>
                  {pendingMonthly.map((c) => {
                    const curva = getCurva(getCurrentPL(c, history));
                    return (
                    <div key={c.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: "white", cursor: "pointer", transition: "all 0.15s" }}
                      onClick={() => toggleCheck(c.id)}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #cbd5e1", background: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} />
                      <Avatar nome={c.nome} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <div style={{ fontSize: 10, color: B.gray }}>{c.profissao || "—"}</div>
                      </div>
                      <CBadge curva={curva} />
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${slugify(c.nome)}`); }}
                        style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Ficha</button>
                    </div>
                  );})
                </div>
              )}

              {/* Já enviados — ficam visíveis até virar o mês */}
              {completedMonthly.length > 0 && (
                <>
                  {pendingMonthly.length > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 4 }}>Enviados ✓</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {completedMonthly.map((c) => {
                      const checkedAt = checkedMap[c.id]?.checked_at;
                      return (
                        <div key={c.id}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", cursor: "pointer", opacity: 0.75 }}
                          onClick={() => toggleCheck(c.id)}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #16a34a", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ color: "white", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>
                          </div>
                          <Avatar nome={c.nome} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", textDecoration: "line-through", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                            <div style={{ fontSize: 10, color: B.gray }}>{c.profissao || "—"}</div>
                          </div>
                          {checkedAt && (
                            <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 600, whiteSpace: "nowrap" }}>
                              Enviado {new Date(checkedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {checkedCount === monthlyClients.length && monthlyClients.length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                  Todos os relatórios mensais foram enviados! 🎉
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ═══ PAINÉIS DE ALERTA ═══ */}
      {(pendentesAtrasado.length > 0 || pendentesAtencao.length > 0 || proximos.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: [pendentesAtrasado.length, pendentesAtencao.length, proximos.length].filter(Boolean).length > 1 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 18 }}>

          {/* Atrasado */}
          {pendentesAtrasado.length > 0 && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 10 }}>
                Relatório Atrasado — +{ATRASADO_DAYS}d do prazo
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendentesAtrasado.map((c) => {
                  const curva = getCurva(getCurrentPL(c, history));
                  return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 7, background: "white", border: "1px solid #fecaca" }}>
                    <Avatar nome={c.nome} size={26} />
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(`/clients/${slugify(c.nome)}`)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <CBadge curva={curva} />
                      </div>
                      <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>
                        {c.diasSem === null ? "Nunca enviado" : `${c.diasSem}d sem relatório`}
                      </div>
                      <div style={{ fontSize: 10, color: B.muted }}>
                        Último envio: {fmtDate(c.ultimo_relatorio || c.ultimoRelatorio) || "—"}
                      </div>
                    </div>
                    <button onClick={() => marcarEnviado(c)}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      ✓ Enviado
                    </button>
                  </div>
                );})}
              </div>
            </div>
          )}

          {/* Atenção */}
          {pendentesAtencao.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase", marginBottom: 10 }}>
                Atenção — enviar em breve
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendentesAtencao.map((c) => {
                  const curva = getCurva(getCurrentPL(c, history));
                  return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 7, background: "white", border: "1px solid #fed7aa" }}>
                    <Avatar nome={c.nome} size={26} />
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(`/clients/${slugify(c.nome)}`)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                        <CBadge curva={curva} />
                      </div>
                      <div style={{ fontSize: 10, color: "#c2410c", fontWeight: 600 }}>
                        {c.diasSem}d sem relatório · {c.periodicidade_relatorio || "Mensal"}
                      </div>
                      <div style={{ fontSize: 10, color: B.muted }}>
                        Último envio: {fmtDate(c.ultimo_relatorio || c.ultimoRelatorio) || "—"}
                      </div>
                    </div>
                    <button onClick={() => marcarEnviado(c)}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      ✓ Enviado
                    </button>
                  </div>
                );})}
              </div>
            </div>
          )}

          {/* Próximos 7 dias */}
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
      )}

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
                const diasColor = c.diasSem === null ? "#dc2626" : c.diasSem > c.periodDays + ATRASADO_DAYS ? "#dc2626" : c.diasSem > c.periodDays ? "#c2410c" : "#16a34a";
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
