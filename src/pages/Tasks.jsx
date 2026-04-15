import { useState, useMemo } from "react";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid, today } from "../utils/helpers";
import Modal from "../components/ui/Modal";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

const EMPTY_FORM = { texto: "", recorrencia: "", vencimento: "", descricao: "", prioridade: "normal" };
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

/* ─── Item: fora do Tasks para estabilidade de referência ─── */
function Item({ t, idx, groupList, atrasadasSet, toggle, postpone, openEdit, remove, moveItem }) {
  const atras  = atrasadasSet.has(t.id);
  const pc     = PRIOR_COLORS[t.prioridade || "normal"];
  const rc     = t.recorrencia ? RECORR_COLORS[t.recorrencia] : null;
  const isHigh = (t.prioridade || "normal") === "alta";
  const isFirst = idx === 0;
  const isLast  = idx === groupList.length - 1;

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
            <button
              onClick={() => moveItem(t.id, "up", groupList)}
              disabled={isFirst}
              title="Mover para cima"
              style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? "#e5e7eb" : "#9baabf", fontSize: 10, lineHeight: 1, padding: "1px 3px", fontWeight: 700 }}
            >▲</button>
            <button
              onClick={() => moveItem(t.id, "down", groupList)}
              disabled={isLast}
              title="Mover para baixo"
              style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? "#e5e7eb" : "#9baabf", fontSize: 10, lineHeight: 1, padding: "1px 3px", fontWeight: 700 }}
            >▼</button>
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

/* ─── Tasks page ─── */
export default function Tasks() {
  const { todos, saveTodo, deleteTodo, clearDoneTodos, setToast } = useData();
  const [modal, setModal]               = useState(false);
  const [editId, setEditId]             = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [filterDate, setFilterDate]     = useState("");
  const [quickText, setQuickText]       = useState("");
  const [quickDate, setQuickDate]       = useState(today());
  const [quickPrior, setQuickPrior]     = useState("normal");
  const [notaDia, setNotaDia]           = useState(() => localStorage.getItem(NOTA_KEY()) || "");
  const [notaOpen, setNotaOpen]         = useState(false);

  const saveNota = (v) => { setNotaDia(v); localStorage.setItem(NOTA_KEY(), v); };

  /* ── CRUD ── */
  const quickAdd = async (e) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    await saveTodo({ id: huid(), texto: quickText.trim(), recorrencia: "", vencimento: quickDate, descricao: "", prioridade: quickPrior, done: false, done_at: null, data: today(), ordem: todos.length }, true);
    setQuickText("");
    setQuickPrior("normal");
  };

  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ texto: t.texto || "", recorrencia: t.recorrencia || "", vencimento: t.vencimento || t.data || "", descricao: t.descricao || "", prioridade: t.prioridade || "normal" });
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
      done:    isNew ? false   : (orig?.done    ?? false),
      done_at: isNew ? null    : (orig?.done_at ?? null),
      data:    isNew ? today() : (orig?.data    ?? today()),
      ordem:   isNew ? todos.length : (orig?.ordem ?? 0),
    };
    await saveTodo(entry, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Tarefa criada." : "Tarefa atualizada." });
  };

  const toggle   = async (t) => { await saveTodo({ ...t, done: !t.done, done_at: !t.done ? today() : null }, false); };
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

    // Monta nova ordem do grupo com o item movido
    const newGroup = [...groupList];
    [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];

    // Reconstrói a lista global de pendentes substituindo os itens do grupo na posição original
    const groupIdSet = new Set(groupList.map((t) => t.id));
    let gi = 0;
    const result = pendentes.map((t) => (groupIdSet.has(t.id) ? newGroup[gi++] : t));

    // Salva todos com ordem sequencial (garante sem colisões)
    await Promise.all(result.map((t, i) => saveTodo({ ...t, ordem: i }, false)));
  };

  /* ── Listas ── */
  const pendentes = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [todos]
  );
  const concluidas   = useMemo(() => todos.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), [todos]);
  const atrasadasSet = useMemo(() => new Set(pendentes.filter((t) => (t.vencimento || t.data || today()) < today()).map((t) => t.id)), [pendentes]);

  const applyFilters = (list) => {
    let r = list;
    if (filterStatus === "vencidas") r = r.filter((t) => !t.done && atrasadasSet.has(t.id));
    if (filterDate) r = r.filter((t) => (t.vencimento || t.data || today()) === filterDate);
    return r;
  };

  const atrasadas = pendentes.filter((t) =>  atrasadasSet.has(t.id));
  const hojeList  = pendentes.filter((t) => (t.vencimento || t.data || today()) === today());
  const futuras   = pendentes.filter((t) => (t.vencimento || t.data || today()) > today());

  // Quando filtro de data ativo, exibe todos os pendentes filtrados sem agrupamento
  const visAllDate    = filterDate ? applyFilters(pendentes) : [];
  const visAtrasadas  = !filterDate ? applyFilters(atrasadas) : [];
  const visHoje       = !filterDate && filterStatus !== "vencidas" ? applyFilters(hojeList) : [];
  const visFuturas    = !filterDate && filterStatus !== "vencidas" ? applyFilters(futuras) : [];
  const visConcluidas = filterStatus !== "vencidas" ? applyFilters(concluidas) : [];
  const totalVisible  = (filterDate ? visAllDate.length : visAtrasadas.length + visHoje.length + visFuturas.length) + visConcluidas.length;

  const itemProps = { atrasadasSet, toggle, postpone, openEdit, remove, moveItem };

  const GroupLabel = ({ label, color, count }) => count === 0 ? null : (
    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", marginTop: 4 }}>{label} ({count})</div>
  );

  const btnStyle = (active) => ({
    padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 6,
    background: active ? B.navy : "white", color: active ? "white" : B.gray,
    border: `1px solid ${active ? B.navy : B.border}`,
  });

  const showNota = notaDia || notaOpen;

  return (
    <>
      <SecH eyebrow="Produtividade" title="To-Do" desc="Suas rotinas e pendências do dia a dia." />

      {/* Nota do Dia — só aparece se tiver conteúdo ou se o usuário abrir */}
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
        </div>
      </form>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={btnStyle(filterStatus === "todas")}    onClick={() => { setFilterStatus("todas"); setFilterDate(""); }}>Todas</button>
          <button style={btnStyle(filterStatus === "vencidas")} onClick={() => { setFilterStatus("vencidas"); setFilterDate(""); }}>Vencidas</button>
        </div>

        {/* Filtro por data específica */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>Data</label>
          <input type="date" value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setFilterStatus("todas"); }}
            style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${filterDate ? B.navy : B.border}`, borderRadius: 6, color: B.navy, background: filterDate ? "#f0f4ff" : "white" }} />
          {filterDate && (
            <button onClick={() => setFilterDate("")} style={{ fontSize: 10, color: B.muted, background: "none", border: "none", cursor: "pointer" }}>limpar</button>
          )}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 11, color: B.gray }}>
          {pendentes.length} pendente(s) · {concluidas.length} concluída(s)
        </span>
      </div>

      {/* Task list */}
      {totalVisible === 0 && todos.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa. Adicione uma acima para começar.</div>
      )}
      {totalVisible === 0 && todos.length > 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa encontrada.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Modo filtro por data: sem agrupamento */}
        {filterDate ? (
          <>
            {visAllDate.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: B.navy, textTransform: "uppercase", marginTop: 4 }}>
                {filterDate === today() ? "Hoje" : fmtDate(filterDate)} ({visAllDate.length})
              </div>
            )}
            {visAllDate.map((t, i) => (
              <Item key={t.id} t={t} idx={i} groupList={visAllDate} {...itemProps} />
            ))}
          </>
        ) : (
          <>
            <GroupLabel label="Atrasadas" color="#dc2626" count={visAtrasadas.length} />
            {visAtrasadas.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visAtrasadas} {...itemProps} />)}

            <GroupLabel label="Hoje" color={B.navy} count={visHoje.length} />
            {visHoje.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visHoje} {...itemProps} />)}

            <GroupLabel label="Próximas" color="#6b7280" count={visFuturas.length} />
            {visFuturas.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visFuturas} {...itemProps} />)}
          </>
        )}

        {/* Concluídas */}
        {visConcluidas.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginTop: 8 }}>Concluídas ({visConcluidas.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visConcluidas.map((t, i) => <Item key={t.id} t={t} idx={i} groupList={visConcluidas} {...itemProps} />)}
            </div>
          </>
        )}
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
