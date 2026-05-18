import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, getPeriodDays, today, slugify, huid, getCurva, getCurrentPL } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";
import Modal from "../components/ui/Modal";
import { CBadge } from "../components/ui/Badge";

// Atenção: passou o prazo mas ainda dentro de ATRASADO_DAYS (15d) → "Atenção"
// Atrasado: mais de ATRASADO_DAYS após o prazo (ou nunca enviado)
const ATRASADO_DAYS = 15;

function getRelStatus(diasSem, periodDays) {
  if (diasSem === null)                     return { key: "atrasado", label: "Atrasado", color: "#dc2626", bg: "#fef2f2" };
  if (diasSem > periodDays + ATRASADO_DAYS) return { key: "atrasado", label: "Atrasado", color: "#dc2626", bg: "#fef2f2" };
  if (diasSem >= periodDays - 5)            return { key: "atencao",  label: "Atenção",  color: "#c2410c", bg: "#fff7ed" };
  return                                           { key: "emdia",    label: "Em Dia",   color: "#16a34a", bg: "#f0fdf4" };
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
  const { clients, history, saveClient, saveTodo, setToast } = useData();
  const [sortCol, setSortCol] = useState("diasSem");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [filterClient, setFilterClient] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistSort, setChecklistSort] = useState("curva"); // "curva" | "nome"
  const [statFilter, setStatFilter] = useState(null); // "atrasado" | "atencao" | "emdia" | null
  const [atencaoOpen, setAtencaoOpen] = useState(false);
  const [atrasadoOpen, setAtrasadoOpen] = useState(true);
  const [taskModal, setTaskModal] = useState(null); // { texto, data }

  // ─── Checklist: começa no próximo mês, avança automaticamente quando tudo enviado ───
  const now = new Date();
  // Mês base (próximo mês calendário) — nunca muda
  const baseMonthDate  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const baseMonth      = `${baseMonthDate.getFullYear()}-${String(baseMonthDate.getMonth() + 1).padStart(2, "0")}`;
  // Mês futuro (dois meses à frente)
  const futureMonthDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const futureMonth     = `${futureMonthDate.getFullYear()}-${String(futureMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // ─── Checklist state ───
  const [checklist, setChecklist] = useState([]);
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  const loadChecklist = useCallback(async () => {
    const { data } = await supabase.from("report_checklist").select("*").in("month", [baseMonth, futureMonth]);
    setChecklist(data || []);
    setChecklistLoaded(true);
  }, [baseMonth, futureMonth]);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const CURVA_ORD = { A: 1, B: 2, C: 3, D: 4 };
  const monthlyClients = useMemo(() => {
    const list = active.filter((c) => {
      const p = (c.periodicidade_relatorio || c.periodicidadeRelatorio || "").toLowerCase();
      return p === "mensal";
    });
    if (checklistSort === "curva") {
      return list.sort((a, b) => {
        const ca = getCurva(getCurrentPL(a, history));
        const cb = getCurva(getCurrentPL(b, history));
        const diff = (CURVA_ORD[ca] || 5) - (CURVA_ORD[cb] || 5);
        return diff !== 0 ? diff : a.nome.localeCompare(b.nome);
      });
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [active, history, checklistSort]);

  // Mapa apenas do mês base — para saber se todos já foram enviados
  const baseCheckedMap = useMemo(() => {
    const m = {};
    checklist.filter((r) => r.month === baseMonth).forEach((r) => { m[r.client_id] = r; });
    return m;
  }, [checklist, baseMonth]);

  // Se todos os clientes mensais estão marcados no mês base, avança para o futuro
  const allBaseChecked = checklistLoaded && monthlyClients.length > 0
    && monthlyClients.every((c) => baseCheckedMap[c.id]?.checked);

  const nextMonthDate = allBaseChecked ? futureMonthDate : baseMonthDate;
  const nextMonth     = allBaseChecked ? futureMonth     : baseMonth;
  const bd5           = get5thBusinessDay(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
  const bd5Date       = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), bd5);
  const isPastBd5     = now >= bd5Date;

  const checkedMap = useMemo(() => {
    const m = {};
    checklist.filter((r) => r.month === nextMonth).forEach((r) => { m[r.client_id] = r; });
    return m;
  }, [checklist, nextMonth]);

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
    const CURVA_ORDER = { A: 1, B: 2, C: 3, D: 4 };
    const STATUS_ORDER = { atrasado: 0, atencao: 1, emdia: 2 };
    let r = active.filter((c) => !naoAplicaRel(c)).map((c) => {
      const diasSem = daysSince(c.ultimo_relatorio || c.ultimoRelatorio);
      const periodDays = getPeriodDays(c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal");
      const pl = getCurrentPL(c, history);
      const curva = getCurva(pl);
      const statusKey = getRelStatus(diasSem, periodDays).key;
      return { ...c, diasSem, periodDays, pl, curva, statusKey };
    });
    if (filterClient) r = r.filter((c) => c.id === filterClient);
    const dir = sortDir === "asc" ? 1 : -1;
    r.sort((a, b) => {
      if (sortCol === "diasSem")    { const da = a.diasSem ?? 99999, db = b.diasSem ?? 99999; return dir * (db - da); }
      if (sortCol === "nome")       return dir * a.nome.localeCompare(b.nome);
      if (sortCol === "periodDays") return dir * (a.periodDays - b.periodDays);
      if (sortCol === "curva")      return dir * ((CURVA_ORDER[a.curva] || 5) - (CURVA_ORDER[b.curva] || 5));
      if (sortCol === "status")     return dir * ((STATUS_ORDER[a.statusKey] || 0) - (STATUS_ORDER[b.statusKey] || 0));
      return 0;
    });
    return r;
  }, [active, filterClient, sortCol, sortDir, history]);

  // ─── Arrays derivados: calculados UMA VEZ, usados em contadores E painéis ───
  const atrasadoRows = useMemo(() => rows.filter((c) => c.diasSem !== null && getRelStatus(c.diasSem, c.periodDays).key === "atrasado"), [rows]);
  const atencaoRows  = useMemo(() => rows.filter((c) => getRelStatus(c.diasSem, c.periodDays).key === "atencao"),  [rows]);
  const emDiaRows    = useMemo(() => rows.filter((c) => getRelStatus(c.diasSem, c.periodDays).key === "emdia"),    [rows]);

  const naoAplicaRows  = useMemo(() => active.filter(naoAplicaRel).map((c) => ({
    ...c, diasSem: daysSince(c.ultimo_relatorio || c.ultimoRelatorio), periodDays: Infinity, _naoAplica: true,
  })), [active]);

  const atrasadoCount  = atrasadoRows.length;
  const atencaoCount   = atencaoRows.length;
  const emDiaCount     = emDiaRows.length;
  const naoAplicaCount = naoAplicaRows.length;

  const pendentesAtrasado = useMemo(() =>
    [...atrasadoRows].sort((a, b) => (b.pl || 0) - (a.pl || 0)),
    [atrasadoRows]
  );
  const pendentesAtencao = useMemo(() =>
    [...atencaoRows]
      .filter((c) => (c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal").toLowerCase() !== "mensal")
      .sort((a, b) => (b.pl || 0) - (a.pl || 0)),
    [atencaoRows]
  );


  // ─── Tabela filtrada pelo card de stat selecionado ───
  const displayRows = useMemo(() => {
    if (!statFilter) return rows;
    if (statFilter === "atrasado")   return atrasadoRows;
    if (statFilter === "atencao")    return atencaoRows;
    if (statFilter === "emdia")      return emDiaRows;
    if (statFilter === "nao_aplica") return naoAplicaRows;
    return rows;
  }, [statFilter, rows, atrasadoRows, atencaoRows, emDiaRows, naoAplicaRows]);

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: statFilter ? 6 : 18 }}>
        <MiniStat label="Atrasado" value={atrasadoCount} warn={atrasadoCount > 0}
          idx={0} selected={statFilter === "atrasado"}
          onClick={() => setStatFilter((v) => v === "atrasado" ? null : "atrasado")} />
        <MiniStat label="Atenção"  value={atencaoCount}  warn={atencaoCount > 0}
          idx={1} selected={statFilter === "atencao"}
          onClick={() => setStatFilter((v) => v === "atencao" ? null : "atencao")} />
        <MiniStat label="Em Dia"   value={emDiaCount}
          idx={2} selected={statFilter === "emdia"}
          onClick={() => setStatFilter((v) => v === "emdia" ? null : "emdia")} />
        <MiniStat label="N/A"      value={naoAplicaCount} idx={3}
          selected={statFilter === "nao_aplica"}
          onClick={() => setStatFilter((v) => v === "nao_aplica" ? null : "nao_aplica")} />
        <MiniStat label="Clientes Ativos" value={active.length} idx={4} />
      </div>
      {statFilter && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: statFilter === "atrasado" ? "#dc2626" : statFilter === "atencao" ? "#c2410c" : "#16a34a", background: statFilter === "atrasado" ? "#fef2f2" : statFilter === "atencao" ? "#fff7ed" : "#f0fdf4", border: `1px solid ${statFilter === "atrasado" ? "#fecaca" : statFilter === "atencao" ? "#fed7aa" : "#bbf7d0"}`, borderRadius: 999, padding: "3px 12px" }}>
            {statFilter === "atrasado" ? "🔴 Mostrando: Atrasados" : statFilter === "atencao" ? "🟠 Mostrando: Atenção" : "🟢 Mostrando: Em Dia"}
          </span>
          <button onClick={() => setStatFilter(null)} style={{ fontSize: 11, color: B.gray, background: "white", border: `1px solid ${B.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>✕ Ver todos</button>
        </div>
      )}

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
              <button
                onClick={(e) => { e.stopPropagation(); setChecklistSort((s) => s === "curva" ? "nome" : "curva"); }}
                style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6, border: `1px solid ${B.border}`, background: "white", color: B.navy, cursor: "pointer", whiteSpace: "nowrap" }}>
                {checklistSort === "curva" ? "Curva A→D" : "Nome A→Z"}
              </button>
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
                      <button onClick={(e) => { e.stopPropagation(); setTaskModal({ texto: `Enviar relatório mensal para ${c.nome}`, data: today(), client_id: c.id }); }}
                        style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Tarefa</button>
                    </div>
                  );})}
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

      {/* ═══ PAINEL ATRASADO ═══ */}
      {pendentesAtrasado.length > 0 && (
        <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
          <div
            onClick={() => setAtrasadoOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", userSelect: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, display: "inline-block", transition: "transform 0.2s", transform: atrasadoOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#dc2626" }}>▶</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>
                🔴 Relatório Atrasado ({pendentesAtrasado.length}) — +{ATRASADO_DAYS}d do prazo
              </span>
            </div>
          </div>
          {atrasadoOpen && (
            <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
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
                      {c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal"} · {c.diasSem !== null ? `${c.diasSem - c.periodDays}d de atraso` : "Nunca enviado"}
                    </div>
                    <div style={{ fontSize: 10, color: B.muted }}>
                      Último envio: {fmtDate(c.ultimo_relatorio || c.ultimoRelatorio) || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button onClick={() => marcarEnviado(c)}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      ✓ Enviado
                    </button>
                    <button onClick={() => setTaskModal({ texto: `Enviar relatório para ${c.nome}`, data: today(), client_id: c.id })}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      + Tarefa
                    </button>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      )}

      {/* ═══ PAINEL ATENÇÃO (recolhido por padrão) ═══ */}
      {pendentesAtencao.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
          <div
            onClick={() => setAtencaoOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", userSelect: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, display: "inline-block", transition: "transform 0.2s", transform: atencaoOpen ? "rotate(90deg)" : "rotate(0deg)", color: "#c2410c" }}>▶</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase" }}>
                🟠 Atenção — enviar em breve ({pendentesAtencao.length})
              </span>
            </div>
          </div>
          {atencaoOpen && (
            <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
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
                      {c.periodicidade_relatorio || c.periodicidadeRelatorio || "Mensal"} · {c.diasSem > c.periodDays ? `${c.diasSem - c.periodDays}d de atraso` : `vence em ${c.periodDays - c.diasSem}d`}
                    </div>
                    <div style={{ fontSize: 10, color: B.muted }}>
                      Último envio: {fmtDate(c.ultimo_relatorio || c.ultimoRelatorio) || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button onClick={() => marcarEnviado(c)}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      ✓ Enviado
                    </button>
                    <button onClick={() => setTaskModal({ texto: `Enviar relatório para ${c.nome}`, data: today(), client_id: c.id })}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      + Tarefa
                    </button>
                  </div>
                </div>
              );})}
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
                <th onClick={() => toggleSort("periodDays")} style={{ ...TH, cursor: "pointer" }}>Periodicidade <SortIcon col="periodDays" /></th>
                <th onClick={() => toggleSort("curva")} style={{ ...TH, cursor: "pointer", textAlign: "center" }}>Curva <SortIcon col="curva" /></th>
                <th onClick={() => toggleSort("diasSem")} style={{ ...TH, cursor: "pointer" }}>Dias sem relatório <SortIcon col="diasSem" /></th>
                <th onClick={() => toggleSort("status")} style={{ ...TH, cursor: "pointer" }}>Status <SortIcon col="status" /></th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum cliente ativo</td></tr>
              )}
              {displayRows.map((c, i) => {
                const st = c._naoAplica
                  ? { label: "N/A", bg: "#f3f4f6", color: "#6b7280" }
                  : getRelStatus(c.diasSem, c.periodDays);
                const curva = c.curva ?? getCurva(getCurrentPL(c, history));
                const diasColor = c._naoAplica ? "#9ca3af" : c.diasSem === null ? "#dc2626" : c.diasSem > c.periodDays + ATRASADO_DAYS ? "#dc2626" : c.diasSem > c.periodDays ? "#c2410c" : "#16a34a";
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
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      <CBadge curva={curva} />
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

      {/* ─── Mini modal criar tarefa ─── */}
      <Modal open={!!taskModal} onClose={() => setTaskModal(null)}>
        <div style={{ padding: "24px 28px", minWidth: 320 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: B.navy }}>Criar Tarefa</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase" }}>Descrição</label>
            <input value={taskModal?.texto || ""} onChange={(e) => setTaskModal((m) => ({ ...m, texto: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase" }}>Data</label>
            <input type="date" value={taskModal?.data || ""} onChange={(e) => setTaskModal((m) => ({ ...m, data: e.target.value }))}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setTaskModal(null)} style={{ flex: 1, padding: "9px", background: "white", border: "1px solid #d1d5db", borderRadius: 7, cursor: "pointer", color: "#6b7280", fontWeight: 600 }}>Cancelar</button>
            <button onClick={async () => {
              await saveTodo({ id: huid(), texto: taskModal.texto, vencimento: taskModal.data, recorrencia: "", descricao: "", prioridade: "normal", client_id: taskModal.client_id || null, done: false, done_at: null, ordem: 0 }, true);
              setTaskModal(null);
              setToast({ type: "success", text: "Tarefa criada!" });
            }} style={{ flex: 2, padding: "9px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Criar Tarefa</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
