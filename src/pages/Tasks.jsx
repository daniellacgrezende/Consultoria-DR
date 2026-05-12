import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid, today, slugify, getPeriodDays, addDays } from "../utils/helpers";
import Modal from "../components/ui/Modal";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

const EMPTY_FORM = { texto: "", recorrencia: "", vencimento: "", descricao: "", prioridade: "normal", client_id: "" };
const NOTA_KEY = () => `nota_dia_${today()}`;

const RECORR_COLORS = {
  diária:  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  semanal: { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  mensal:  { bg: "#fefce8", color: "#854d0e", border: "#fde047" },
};

const PRIOR_COLORS = {
  alta:   { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  normal: { bg: "#f8faff", color: "#1D3557", border: "rgba(10,8,9,0.06)" },
  baixa:  { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
};

/* ─── Meeting Item (virtual, baseado em reuniao_agendada_em) ─── */
function MeetingItem({ client, navigate, onRealizada, time }) {
  const atrasada = client.reuniao_agendada_em < today();
  const color = atrasada ? "#dc2626" : "#1d4ed8";
  return (
    <div style={{ borderRadius: 8, background: "#eff6ff", border: `2px solid ${atrasada ? "#dc2626" : "#2563eb"}`, borderLeft: `4px solid ${atrasada ? "#dc2626" : "#2563eb"}`, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>📅</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>
            Reunião com {client.nome}
          </span>
          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: atrasada ? "#dc2626" : "#2563eb", color: "white", borderRadius: 999, padding: "1px 7px", textTransform: "uppercase" }}>
            {atrasada ? "ATRASADA" : "CONFIRMADA"}
          </span>
        </div>
        <span style={{ fontSize: 10, color, flexShrink: 0, fontWeight: 700 }}>
          {fmtDate(client.reuniao_agendada_em)}{time ? ` · ${time}` : ""}
        </span>
        <button onClick={() => navigate(`/clients/${slugify(client.nome)}`)}
          style={{ background: "white", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>
          Ficha
        </button>
        <button onClick={onRealizada}
          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          ✓ Realizada
        </button>
      </div>
    </div>
  );
}

/* ─── Item ─── */
function Item({ t, idx, groupList, atrasadasSet, toggle, postpone, openEdit, remove, moveItem, clients, navigate }) {
  const atras  = atrasadasSet.has(t.id);
  const pc     = PRIOR_COLORS[t.prioridade || "normal"];
  const rc     = t.recorrencia ? RECORR_COLORS[t.recorrencia] : null;
  const isHigh = (t.prioridade || "normal") === "alta";
  const isFirst = idx === 0;
  const isLast  = idx === groupList.length - 1;
  const client  = t.client_id ? clients.find((c) => c.id === t.client_id) : null;

  return (
    <div style={{
      borderRadius: 8,
      background: t.done ? "#f9fafb" : atras ? "#fff5f5" : pc.bg,
      border: `1px solid ${t.done ? "#e5e7eb" : atras ? "#fecaca" : pc.border}`,
      borderLeft: !t.done && isHigh ? "4px solid #dc2626" : undefined,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>

        {/* ↑↓ buttons */}
        {!t.done && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
            <button onClick={() => moveItem(t.id, "up", groupList)} disabled={isFirst} title="Mover para cima"
              style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? "#e5e7eb" : "#9baabf", fontSize: 10, lineHeight: 1, padding: "1px 3px", fontWeight: 700 }}>▲</button>
            <button onClick={() => moveItem(t.id, "down", groupList)} disabled={isLast} title="Mover para baixo"
              style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? "#e5e7eb" : "#9baabf", fontSize: 10, lineHeight: 1, padding: "1px 3px", fontWeight: 700 }}>▼</button>
          </div>
        )}

        <input type="checkbox" checked={t.done} onChange={() => toggle(t)}
          style={{ width: 15, height: 15, accentColor: "#1D3557", flexShrink: 0, cursor: "pointer" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: isHigh ? 700 : 600, color: t.done ? "#6b7280" : atras ? "#dc2626" : pc.color, textDecoration: t.done ? "line-through" : "none" }}>
            {t.texto}
          </span>
          {isHigh && !t.done && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 999, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>ALTA</span>
          )}
          {rc && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, borderRadius: 999, padding: "1px 6px", textTransform: "uppercase" }}>{t.recorrencia}</span>
          )}
          {/* Badge do cliente vinculado */}
          {client && (
            <span
              onClick={() => navigate(`/clients/${slugify(client.nome)}`)}
              title={`Ver ficha de ${client.nome}`}
              style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "1px 7px", cursor: "pointer", textDecoration: "underline dotted", userSelect: "none" }}
            >👤 {client.nome}</span>
          )}
        </div>

        <span style={{ fontSize: 10, color: atras ? "#dc2626" : "#9baabf", flexShrink: 0, fontWeight: atras ? 700 : 400 }}>{fmtDate(t.vencimento || t.data)}</span>
        {!t.done && <button onClick={() => postpone(t)} title="+1d" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+1d</button>}
        {!t.done && <button onClick={() => openEdit(t)} style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>Editar</button>}
        <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>×</button>
      </div>

      {t.descricao && !t.done && (
        <div style={{ padding: "0 12px 9px 35px", fontSize: 11, color: "#9E9C9E", lineHeight: 1.5 }}>{t.descricao}</div>
      )}
    </div>
  );
}

/* ─── Helpers de mês ─── */
function getMonthRange(offsetMonths) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths; // pode ser 12 → JS normaliza
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

/* ─── Calcula próxima data de recorrência ─── */
function getNextRecorrencia(vencimento, recorrencia) {
  const base = new Date((vencimento || today()) + "T12:00:00");
  const todayStr = today();

  // Avança a partir do vencimento original
  if (recorrencia === "diária")  base.setDate(base.getDate() + 1);
  if (recorrencia === "semanal") base.setDate(base.getDate() + 7);
  if (recorrencia === "mensal")  base.setMonth(base.getMonth() + 1);
  if (recorrencia === "anual")   base.setFullYear(base.getFullYear() + 1);

  const next = base.toISOString().slice(0, 10);

  // Se a data calculada já passou (tarefa muito atrasada), calcula a partir de hoje
  if (next <= todayStr) {
    const fallback = new Date(todayStr + "T12:00:00");
    if (recorrencia === "diária")  fallback.setDate(fallback.getDate() + 1);
    if (recorrencia === "semanal") fallback.setDate(fallback.getDate() + 7);
    if (recorrencia === "mensal")  fallback.setMonth(fallback.getMonth() + 1);
    if (recorrencia === "anual")   fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  return next;
}

/* ─── Tasks page ─── */
export default function Tasks() {
  const navigate = useNavigate();
  const { clients, todos, saveTodo, saveClient, deleteTodo, clearDoneTodos, setToast } = useData();
  const [modal, setModal]               = useState(false);
  const [editId, setEditId]             = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [filterDate, setFilterDate]     = useState("");
  const [filterMonth, setFilterMonth]   = useState(""); // "" | "this" | "next"
  const [quickText, setQuickText]       = useState("");
  const [quickDate, setQuickDate]       = useState(today());
  const [quickPrior, setQuickPrior]     = useState("normal");
  const [notaDia, setNotaDia]           = useState(() => localStorage.getItem(NOTA_KEY()) || "");
  const [notaOpen, setNotaOpen]         = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState(() => new Set(["futAmanha", "futSemana", "futAlem", "concluidas"]));
  const toggleSection = (key) => setCollapsedSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const saveNota = (v) => { setNotaDia(v); localStorage.setItem(NOTA_KEY(), v); };

  /* ── CRUD ── */
  const quickAdd = async (e) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    await saveTodo({ id: huid(), texto: quickText.trim(), recorrencia: "", vencimento: quickDate, descricao: "", prioridade: quickPrior, client_id: null, done: false, done_at: null, data: today(), ordem: todos.length }, true);
    setQuickText("");
    setQuickPrior("normal");
  };

  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ texto: t.texto || "", recorrencia: t.recorrencia || "", vencimento: t.vencimento || t.data || "", descricao: t.descricao || "", prioridade: t.prioridade || "normal", client_id: t.client_id || "" });
    const cl = t.client_id ? clients.find((c) => c.id === t.client_id) : null;
    setClientSearch(cl ? cl.nome : "");
    setModal(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setClientSearch("");
    setModal(true);
  };

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.texto.trim()) { setToast({ type: "error", text: "Informe o nome da tarefa." }); return; }
    const isNew = !editId;
    const orig  = todos.find((t) => t.id === editId);
    const entry = {
      id: editId || huid(),
      texto: form.texto.trim(),
      recorrencia: form.recorrencia,
      vencimento: form.vencimento || today(),
      descricao: form.descricao,
      prioridade: form.prioridade,
      client_id: form.client_id || null,
      done:    isNew ? false   : (orig?.done    ?? false),
      done_at: isNew ? null    : (orig?.done_at ?? null),
      data:    isNew ? today() : (orig?.data    ?? today()),
      ordem:   isNew ? todos.length : (orig?.ordem ?? 0),
    };
    await saveTodo(entry, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Tarefa criada." : "Tarefa atualizada." });
  };

  const toggle = async (t) => {
    const markingDone = !t.done;
    await saveTodo({ ...t, done: markingDone, done_at: markingDone ? today() : null }, false);

    // ─── Recorrência: cria próxima ocorrência ao concluir ───
    if (markingDone && t.recorrencia) {
      const nextVenc = getNextRecorrencia(t.vencimento || t.data, t.recorrencia);
      await saveTodo({
        id: huid(),
        texto: t.texto,
        recorrencia: t.recorrencia,
        vencimento: nextVenc,
        descricao: t.descricao || "",
        prioridade: t.prioridade || "normal",
        client_id: t.client_id || null,
        done: false,
        done_at: null,
        data: today(),
        ordem: todos.length,
      }, true);
    }

    // ─── Auto-sync relatório: atualiza ficha e checklist ───
    if (markingDone && t.client_id && t.texto && t.texto.toLowerCase().startsWith("enviar relatório")) {
      const cl = clients.find((c) => c.id === t.client_id);
      if (cl) {
        const dataRel = t.vencimento || today();
        await saveClient({ ...cl, ultimo_relatorio: dataRel }, false);
        const month = dataRel.slice(0, 7);
        const { data: existing } = await supabase.from("report_checklist").select("*").eq("client_id", t.client_id).eq("month", month).maybeSingle();
        if (existing) {
          await supabase.from("report_checklist").update({ checked: true, checked_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("report_checklist").insert({ id: huid(), client_id: t.client_id, month, checked: true, checked_at: new Date().toISOString() });
        }
      }
    }
  };
  const remove   = async (id) => { await deleteTodo(id); };
  const postpone = async (t) => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    await saveTodo({ ...t, vencimento: d.toISOString().slice(0, 10) }, false);
  };

  /* ── Reordenar dentro do grupo ── */
  const moveItem = async (id, direction, groupList) => {
    const idx = groupList.findIndex((t) => t.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === groupList.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newGroup = [...groupList];
    [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];
    const groupIdSet = new Set(groupList.map((t) => t.id));
    let gi = 0;
    const result = pendentes.map((t) => (groupIdSet.has(t.id) ? newGroup[gi++] : t));
    await Promise.all(result.map((t, i) => saveTodo({ ...t, ordem: i }, false)));
  };

  /* ── Listas ── */
  const pendentes = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [todos]
  );
  const concluidas   = useMemo(() => todos.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), [todos]);
  const atrasadasSet = useMemo(() => new Set(pendentes.filter((t) => (t.vencimento || t.data || today()) < today()).map((t) => t.id)), [pendentes]);
  const tomorrowStr  = useMemo(() => { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }, []);
  const weekOutStr   = useMemo(() => { const d = new Date(today() + "T12:00:00"); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }, []);

  /* ── Filtro por mês ── */
  const monthRange = useMemo(() => {
    if (!filterMonth) return null;
    return getMonthRange(filterMonth === "this" ? 0 : 1);
  }, [filterMonth]);

  const applyMonthFilter = (list) => {
    if (!monthRange) return list;
    return list.filter((t) => {
      const d = t.vencimento || t.data || today();
      return d >= monthRange.start && d <= monthRange.end;
    });
  };

  const applyFilters = (list) => {
    let r = list;
    if (filterStatus === "vencidas") r = r.filter((t) => !t.done && atrasadasSet.has(t.id));
    if (filterDate) r = r.filter((t) => (t.vencimento || t.data || today()) === filterDate);
    return r;
  };

  const atrasadas = pendentes.filter((t) =>  atrasadasSet.has(t.id));
  const hojeList  = pendentes.filter((t) => (t.vencimento || t.data || today()) === today());
  const futuras   = pendentes.filter((t) => (t.vencimento || t.data || today()) > today()).sort((a, b) => (a.vencimento || a.data || "").localeCompare(b.vencimento || b.data || ""));

  /* ── Reuniões confirmadas (virtual, de reuniao_agendada_em) ── */
  const meetingClients = useMemo(() =>
    clients.filter((c) => c.status === "ativo" && c.reuniao_agendada_em)
      .sort((a, b) => (a.reuniao_agendada_em || "").localeCompare(b.reuniao_agendada_em || "")),
    [clients]
  );
  const handleMeetingRealizada = async (c) => {
    const pDays = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao || "Trimestral");
    const proxima = addDays(c.reuniao_agendada_em, pDays);
    await saveClient({ ...c, ultima_reuniao: c.reuniao_agendada_em, proxima_reuniao: proxima, reuniao_agendada_em: null, avisado_em: null }, false);
    setToast({ type: "success", text: `Reunião com ${c.nome.split(" ")[0]} marcada como realizada!` });
  };
  const meetAtrasadas = meetingClients.filter((c) => c.reuniao_agendada_em < today());
  const meetHoje      = meetingClients.filter((c) => c.reuniao_agendada_em === today());
  const meetAmanha    = meetingClients.filter((c) => c.reuniao_agendada_em === tomorrowStr);
  const meetSemana    = meetingClients.filter((c) => c.reuniao_agendada_em > tomorrowStr && c.reuniao_agendada_em <= weekOutStr);
  const meetAlem      = meetingClients.filter((c) => c.reuniao_agendada_em > weekOutStr);
  const meetFilterDate = filterDate ? meetingClients.filter((c) => c.reuniao_agendada_em === filterDate) : [];

  /* ── Horários das reuniões (via calendar_events) ── */
  const [meetingTimes, setMeetingTimes] = useState({}); // client_id → "HH:MM"
  useEffect(() => {
    const ids = meetingClients.map((c) => c.id).filter(Boolean);
    if (ids.length === 0) { setMeetingTimes({}); return; }
    supabase.from("calendar_events").select("client_id, start_at").in("client_id", ids)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((ev) => {
          const d = (ev.start_at || "").slice(0, 10);
          const c = meetingClients.find((mc) => mc.id === ev.client_id && mc.reuniao_agendada_em === d);
          if (c && ev.start_at && !map[c.id]) {
            try { map[c.id] = new Date(ev.start_at.replace(" ", "T")).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch {}
          }
        });
        setMeetingTimes(map);
      });
  }, [meetingClients]);

  /* ── Dedup: oculta todos "Reunião com X" quando há MeetingItem para o mesmo cliente ── */
  const meetingClientIds = useMemo(() => new Set(meetingClients.map((c) => c.id)), [meetingClients]);

  const meetingClientNameTokens = useMemo(() => {
    const set = new Set();
    meetingClients.forEach((c) => {
      c.nome.toLowerCase().split(" ").forEach((p) => { if (p.length >= 3) set.add(p); });
    });
    return set;
  }, [meetingClients]);

  const isTodoDuplicate = (t) => {
    if (t.client_id && meetingClientIds.has(t.client_id)) return true;
    const texto = (t.texto || "").toLowerCase();
    if (!texto.includes("reuni") && !texto.includes("meeting")) return false;
    for (const n of meetingClientNameTokens) {
      if (texto.includes(n)) return true;
    }
    return false;
  };

  const visAllDate    = filterDate ? applyFilters(pendentes).filter((t) => !isTodoDuplicate(t)) : [];
  const visAtrasadas  = !filterDate ? applyFilters(atrasadas).filter((t) => !isTodoDuplicate(t)) : [];
  const visHoje       = !filterDate && filterStatus !== "vencidas" ? applyFilters(hojeList).filter((t) => !isTodoDuplicate(t)) : [];
  const visFuturas    = !filterDate && filterStatus !== "vencidas" ? applyMonthFilter(applyFilters(futuras)).filter((t) => !isTodoDuplicate(t)) : [];
  const visConcluidas = filterStatus !== "vencidas" ? applyFilters(concluidas) : [];
  const totalMeetings = filterDate ? meetFilterDate.length : meetAtrasadas.length + meetHoje.length + meetAmanha.length + meetSemana.length + meetAlem.length;
  const totalVisible  = (filterDate ? visAllDate.length + meetFilterDate.length : visAtrasadas.length + visHoje.length + visFuturas.length + totalMeetings) + visConcluidas.length;

  const visAmanha = visFuturas.filter(t => (t.vencimento || t.data || "") === tomorrowStr);
  const visSemana = visFuturas.filter(t => { const d = t.vencimento || t.data || ""; return d > tomorrowStr && d <= weekOutStr; });
  const visAlem   = visFuturas.filter(t => (t.vencimento || t.data || "") > weekOutStr);

  const itemProps = { atrasadasSet, toggle, postpone, openEdit, remove, moveItem, clients, navigate };

  const CollapsibleGroup = ({ sectionKey, label, color, count, children }) => {
    if (count === 0) return null;
    const open = !collapsedSections.has(sectionKey);
    return (
      <>
        <div onClick={() => toggleSection(sectionKey)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginTop: 6, userSelect: "none" }}>
          <span style={{ fontSize: 9, color, display: "inline-block", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" }}>{label} ({count})</span>
        </div>
        {open && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>{children}</div>}
      </>
    );
  };

  const btnStyle = (active) => ({
    padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 6,
    background: active ? B.navy : "white", color: active ? "white" : B.gray,
    border: `1px solid ${active ? B.navy : B.border}`,
  });

  const monthBtnStyle = (key) => ({
    padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 6,
    background: filterMonth === key ? "#1d4ed8" : "white",
    color: filterMonth === key ? "white" : "#1d4ed8",
    border: `1px solid ${filterMonth === key ? "#1d4ed8" : "#bfdbfe"}`,
  });

  const showNota = notaDia || notaOpen;

  /* ── Clientes filtrados no modal ── */
  const clientesModal = useMemo(() => {
    if (!clientSearch.trim()) return clients.filter((c) => c.status === "ativo").slice(0, 8);
    return clients.filter((c) => c.status === "ativo" && c.nome.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8);
  }, [clients, clientSearch]);

  return (
    <>
      <SecH eyebrow="Produtividade" title="To-Do" desc="Suas rotinas e pendências do dia a dia." />

      {/* Nota do Dia */}
      {showNota ? (
        <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>📌 Nota do Dia — {today()}</span>
            {!notaDia && (
              <button onClick={() => setNotaOpen(false)} style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            )}
          </div>
          <textarea
            value={notaDia}
            onChange={(e) => saveNota(e.target.value)}
            autoFocus={notaOpen && !notaDia}
            placeholder="Observações importantes do dia, contextos relevantes, lembretes…"
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#78350f", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }}
          />
        </div>
      ) : (
        <button onClick={() => setNotaOpen(true)}
          style={{ marginBottom: 14, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#b45309", fontWeight: 600, padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}>
          📌 <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>Adicionar nota do dia</span>
        </button>
      )}

      {/* Quick add */}
      <form onSubmit={quickAdd} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            placeholder="Adicionar tarefa… pressione Enter"
            style={{ flex: 1, padding: "11px 16px", border: `1.5px solid ${quickPrior === "alta" ? "#fca5a5" : B.border}`, borderRadius: 10, fontSize: 14, color: B.navy, outline: "none", fontFamily: "inherit", background: quickPrior === "alta" ? "#fff8f8" : "white", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "border-color 0.15s, background 0.15s" }}
            autoFocus
          />
          <input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)}
            style={{ padding: "11px 10px", border: `1.5px solid ${B.border}`, borderRadius: 10, fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", background: "white" }} />
          <button type="submit" style={{ padding: "11px 20px", background: B.navy, color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
          {[
            { v: "alta",   label: "🔴 Alta",  activeBg: "#fef2f2", activeColor: "#dc2626", activeBorder: "#fca5a5" },
            { v: "normal", label: "⚪ Normal", activeBg: "#f0f4ff", activeColor: B.navy,   activeBorder: "#c7d2fe" },
            { v: "baixa",  label: "🔵 Baixa", activeBg: "#f0f9ff", activeColor: "#0369a1", activeBorder: "#bae6fd" },
          ].map(({ v, label, activeBg, activeColor, activeBorder }) => (
            <button key={v} type="button" onClick={() => setQuickPrior(v)}
              style={{ padding: "4px 13px", fontSize: 11, fontWeight: 700, borderRadius: 999, cursor: "pointer", background: quickPrior === v ? activeBg : "#f3f4f6", color: quickPrior === v ? activeColor : "#6b7280", border: `1.5px solid ${quickPrior === v ? activeBorder : "#e5e7eb"}`, transition: "all 0.12s" }}>
              {label}
            </button>
          ))}
          <span style={{ fontSize: 11, color: B.muted, marginLeft: 2 }}>prioridade</span>
          <button type="button" onClick={openNew}
            style={{ marginLeft: "auto", padding: "4px 13px", fontSize: 11, fontWeight: 700, borderRadius: 999, cursor: "pointer", background: "#f0f4ff", color: B.navy, border: "1.5px solid #c7d2fe" }}>
            + Detalhes / vincular cliente
          </button>
        </div>
      </form>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {/* Status */}
        <div style={{ display: "flex", gap: 4 }}>
          <button style={btnStyle(filterStatus === "todas")}    onClick={() => { setFilterStatus("todas"); setFilterDate(""); }}>Todas</button>
          <button style={btnStyle(filterStatus === "vencidas")} onClick={() => { setFilterStatus("vencidas"); setFilterDate(""); setFilterMonth(""); }}>Vencidas</button>
        </div>

        {/* Filtro por mês */}
        <div style={{ display: "flex", gap: 4 }}>
          <button style={monthBtnStyle("this")} onClick={() => { setFilterMonth(filterMonth === "this" ? "" : "this"); setFilterDate(""); setFilterStatus("todas"); }}>Este mês</button>
          <button style={monthBtnStyle("next")} onClick={() => { setFilterMonth(filterMonth === "next" ? "" : "next"); setFilterDate(""); setFilterStatus("todas"); }}>Próx. mês</button>
        </div>

        {/* Filtro por data específica */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>Data</label>
          <input type="date" value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setFilterStatus("todas"); setFilterMonth(""); }}
            style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${filterDate ? B.navy : B.border}`, borderRadius: 6, color: B.navy, background: filterDate ? "#f0f4ff" : "white" }} />
          {filterDate && (
            <button onClick={() => setFilterDate("")} style={{ fontSize: 10, color: B.muted, background: "none", border: "none", cursor: "pointer" }}>limpar</button>
          )}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 11, color: B.gray }}>
          {pendentes.length} pendente(s) · {concluidas.length} concluída(s)
        </span>
      </div>

      {/* Indicador do filtro de mês ativo */}
      {filterMonth && (
        <div style={{ fontSize: 11, color: "#1d4ed8", marginBottom: 10, marginTop: -8 }}>
          Mostrando próximas de: <b>{filterMonth === "this" ? "Este mês" : "Próximo mês"}</b>
          {visFuturas.length === 0 && " — nenhuma tarefa neste período"}
          <button onClick={() => setFilterMonth("")} style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "0 4px" }}>✕ limpar</button>
        </div>
      )}

      {/* Task list */}
      {totalVisible === 0 && todos.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa. Adicione uma acima para começar.</div>
      )}
      {totalVisible === 0 && todos.length > 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa encontrada.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filterDate ? (
          <>
            {(visAllDate.length > 0 || meetFilterDate.length > 0) && (
              <div style={{ fontSize: 10, fontWeight: 700, color: B.navy, textTransform: "uppercase", marginTop: 4 }}>
                {filterDate === today() ? "Hoje" : fmtDate(filterDate)} ({visAllDate.length + meetFilterDate.length})
              </div>
            )}
            {meetFilterDate.map((c) => (
              <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
            ))}
            {visAllDate.map((t, i) => (
              <Item key={t.id} t={t} idx={i} groupList={visAllDate} {...itemProps} />
            ))}
          </>
        ) : (
          <>
            <CollapsibleGroup sectionKey="atrasadas" label="Atrasadas" color="#dc2626" count={visAtrasadas.length + meetAtrasadas.length}>
              {meetAtrasadas.map((c) => (
                <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
              ))}
              {visAtrasadas.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visAtrasadas} {...itemProps} />)}
            </CollapsibleGroup>

            <CollapsibleGroup sectionKey="hoje" label="Hoje" color={B.navy} count={visHoje.length + meetHoje.length}>
              {meetHoje.map((c) => (
                <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
              ))}
              {visHoje.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visHoje} {...itemProps} />)}
            </CollapsibleGroup>

            <CollapsibleGroup sectionKey="futAmanha" label="Amanhã" color="#6b7280" count={visAmanha.length + meetAmanha.length}>
              {meetAmanha.map((c) => (
                <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
              ))}
              {visAmanha.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visFuturas} {...itemProps} />)}
            </CollapsibleGroup>

            <CollapsibleGroup sectionKey="futSemana" label="Esta semana" color="#6b7280" count={visSemana.length + meetSemana.length}>
              {meetSemana.map((c) => (
                <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
              ))}
              {visSemana.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visFuturas} {...itemProps} />)}
            </CollapsibleGroup>

            <CollapsibleGroup sectionKey="futAlem" label="Mais adiante" color="#6b7280" count={visAlem.length + meetAlem.length}>
              {meetAlem.map((c) => (
                <MeetingItem key={`meet-${c.id}`} client={c} navigate={navigate} onRealizada={() => handleMeetingRealizada(c)} time={meetingTimes[c.id]} />
              ))}
              {visAlem.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visFuturas} {...itemProps} />)}
            </CollapsibleGroup>
          </>
        )}

        {/* Concluídas */}
        <CollapsibleGroup sectionKey="concluidas" label="Concluídas" color="#16a34a" count={visConcluidas.length}>
          {visConcluidas.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visConcluidas} {...itemProps} />)}
        </CollapsibleGroup>
      </div>

      {concluidas.length > 0 && filterStatus !== "vencidas" && (
        <button onClick={clearDoneTodos} style={{ marginTop: 10, width: "100%", padding: "7px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Limpar concluídas ({concluidas.length})
        </button>
      )}

      {/* ═══ MODAL ═══ */}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.navy }}>{editId ? "Editar Tarefa" : "Nova Tarefa"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.muted }}>×</button>
          </div>
          <Inp label="Nome da tarefa *" value={form.texto} onChange={F("texto")} placeholder="Ex: Ligar para cliente, Enviar relatório…" />
          <Sel label="Prioridade" value={form.prioridade} onChange={F("prioridade")}
            opts={[{ v: "alta", l: "🔴 Alta" }, { v: "normal", l: "Normal" }, { v: "baixa", l: "🔵 Baixa" }]} />
          <Sel label="Recorrente" value={form.recorrencia} onChange={F("recorrencia")}
            opts={[{ v: "", l: "Não recorrente" }, { v: "diária", l: "Diária" }, { v: "semanal", l: "Semanal" }, { v: "mensal", l: "Mensal" }]} />
          <Inp label="Prazo" type="date" value={form.vencimento} onChange={F("vencimento")} />

          {/* Vincular cliente */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>Vincular Cliente (opcional)</div>
            <input
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setForm((f) => ({ ...f, client_id: "" })); }}
              placeholder="Buscar cliente…"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1.5px solid ${form.client_id ? "#bfdbfe" : B.border}`, borderRadius: 7, fontSize: 13, color: B.navy, fontFamily: "inherit", outline: "none", background: form.client_id ? "#eff6ff" : "white", marginBottom: 4 }}
            />
            {/* Lista de sugestões */}
            {clientSearch && !form.client_id && clientesModal.length > 0 && (
              <div style={{ border: `1px solid ${B.border}`, borderRadius: 7, overflow: "hidden", background: "white" }}>
                {clientesModal.map((c) => (
                  <div key={c.id}
                    onClick={() => { setForm((f) => ({ ...f, client_id: c.id })); setClientSearch(c.nome); }}
                    style={{ padding: "8px 12px", fontSize: 13, color: B.navy, cursor: "pointer", borderBottom: `1px solid ${B.border}` }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f0f4ff"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                  >
                    {c.nome}
                  </div>
                ))}
              </div>
            )}
            {form.client_id && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>👤 {clientSearch}</span>
                <button type="button" onClick={() => { setForm((f) => ({ ...f, client_id: "" })); setClientSearch(""); }}
                  style={{ background: "none", border: "none", color: B.muted, cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            )}
          </div>

          <Tarea label="Descrição" value={form.descricao} onChange={F("descricao")} placeholder="Detalhes, contexto ou instruções…" />
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            {editId && (
              <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Excluir</button>
            )}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>SALVAR</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
