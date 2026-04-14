import { useState, useMemo } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

/* ─── SortableItem: fora do Tasks para não ser recriado a cada render ─── */
function SortableItem({ t, atrasadasSet, toggle, postpone, openEdit, remove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id,
    disabled: t.done,
  });

  const atras  = atrasadasSet.has(t.id);
  const pc     = PRIOR_COLORS[t.prioridade || "normal"];
  const rc     = t.recorrencia ? RECORR_COLORS[t.recorrencia] : null;
  const isHigh = (t.prioridade || "normal") === "alta";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderRadius: 8,
        background: t.done ? "#f9fafb" : atras ? "#fff5f5" : pc.bg,
        border: `1px solid ${t.done ? "#e5e7eb" : atras ? "#fecaca" : pc.border}`,
        borderLeft: !t.done && isHigh ? "4px solid #dc2626" : undefined,
        overflow: "hidden",
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 10 : undefined,
        boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.12)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        {/* Drag handle */}
        {!t.done && (
          <span
            {...attributes}
            {...listeners}
            title="Arrastar para reordenar"
            style={{ cursor: "grab", color: "#c4c9d4", fontSize: 14, flexShrink: 0, lineHeight: 1, touchAction: "none", userSelect: "none" }}
          >⠿</span>
        )}

        <input
          type="checkbox"
          checked={t.done}
          onChange={() => toggle(t)}
          style={{ width: 15, height: 15, accentColor: "#1D3557", flexShrink: 0, cursor: "pointer" }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: isHigh ? 700 : 600, color: t.done ? "#9baabf" : atras ? "#dc2626" : pc.color, textDecoration: t.done ? "line-through" : "none" }}>
            {t.texto}
          </span>
          {isHigh && !t.done && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 999, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ALTA
            </span>
          )}
          {rc && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, borderRadius: 999, padding: "1px 6px", textTransform: "uppercase" }}>
              {t.recorrencia}
            </span>
          )}
        </div>

        <span style={{ fontSize: 10, color: atras ? "#dc2626" : "#9baabf", flexShrink: 0, fontWeight: atras ? 700 : 400 }}>
          {fmtDate(t.vencimento || t.data)}
        </span>
        {!t.done && (
          <button onClick={() => postpone(t)} title="+1d" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+1d</button>
        )}
        {!t.done && (
          <button onClick={() => openEdit(t)} style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>Editar</button>
        )}
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
  const [modal, setModal]           = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState("todas");
  const [filterMonth, setFilterMonth]   = useState("");
  const [quickText, setQuickText]   = useState("");
  const [quickDate, setQuickDate]   = useState(today());
  const [quickPrior, setQuickPrior] = useState("normal");
  const [notaDia, setNotaDia]       = useState(() => localStorage.getItem(NOTA_KEY()) || "");

  const saveNota = (v) => { setNotaDia(v); localStorage.setItem(NOTA_KEY(), v); };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    const orig = todos.find((t) => t.id === editId);
    const entry = {
      id: editId || huid(),
      texto: form.texto.trim(),
      recorrencia: form.recorrencia,
      vencimento: form.vencimento || today(),
      descricao: form.descricao,
      prioridade: form.prioridade,
      done:     isNew ? false : (orig?.done ?? false),
      done_at:  isNew ? null  : (orig?.done_at ?? null),
      data:     isNew ? today() : (orig?.data ?? today()),
      ordem:    isNew ? todos.length : (orig?.ordem ?? 0),
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

  /* ── Drag-and-drop reorder ── */
  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = pendentes.findIndex((t) => t.id === active.id);
    const newIdx = pendentes.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(pendentes, oldIdx, newIdx);
    await Promise.all(reordered.map((t, i) => saveTodo({ ...t, ordem: i }, false)));
  };

  /* ── Lists ── */
  const pendentes = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [todos]
  );
  const concluidas   = useMemo(() => todos.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), [todos]);
  const atrasadasSet = useMemo(() => new Set(pendentes.filter((t) => (t.vencimento || t.data || today()) < today()).map((t) => t.id)), [pendentes]);

  const applyFilters = (list) => {
    let r = list;
    if (filterStatus === "vencidas") r = r.filter((t) => !t.done && atrasadasSet.has(t.id));
    if (filterMonth) r = r.filter((t) => (t.vencimento || t.data || today()).slice(0, 7) === filterMonth);
    return r;
  };

  const atrasadas = pendentes.filter((t) =>  atrasadasSet.has(t.id));
  const hojeList  = pendentes.filter((t) => (t.vencimento || t.data || today()) === today());
  const futuras   = pendentes.filter((t) => (t.vencimento || t.data || today()) > today());

  const visAtrasadas  = applyFilters(atrasadas);
  const visHoje       = filterStatus === "vencidas" ? [] : applyFilters(hojeList);
  const visFuturas    = filterStatus === "vencidas" ? [] : applyFilters(futuras);
  const visConcluidas = filterStatus === "vencidas" ? [] : applyFilters(concluidas);
  const totalVisible  = visAtrasadas.length + visHoje.length + visFuturas.length + visConcluidas.length;

  const itemProps = { atrasadasSet, toggle, postpone, openEdit, remove };

  const GroupLabel = ({ label, color, count }) => count === 0 ? null : (
    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", marginTop: 4 }}>{label} ({count})</div>
  );

  const btnStyle = (active) => ({
    padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 6,
    background: active ? B.navy : "white", color: active ? "white" : B.gray,
    border: `1px solid ${active ? B.navy : B.border}`,
  });

  return (
    <>
      <SecH eyebrow="Produtividade" title="To-Do" desc="Suas rotinas e pendências do dia a dia." />

      {/* Nota do Dia */}
      <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.05em" }}>📌 Nota do Dia — {today()}</div>
        <textarea
          value={notaDia}
          onChange={(e) => saveNota(e.target.value)}
          placeholder="Observações importantes do dia, contextos relevantes, lembretes…"
          rows={2}
          style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#78350f", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

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
          <input
            type="date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            style={{ padding: "11px 10px", border: `1.5px solid ${B.border}`, borderRadius: 10, fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", background: "white" }}
          />
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
          <button style={btnStyle(filterStatus === "todas")}    onClick={() => setFilterStatus("todas")}>Todas</button>
          <button style={btnStyle(filterStatus === "vencidas")} onClick={() => setFilterStatus("vencidas")}>Vencidas</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>Mês</label>
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${B.border}`, borderRadius: 6, color: B.navy, background: "white" }} />
          {filterMonth && (
            <button onClick={() => setFilterMonth("")} style={{ fontSize: 10, color: B.muted, background: "none", border: "none", cursor: "pointer" }}>limpar</button>
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
        <div style={{ padding: "32px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa corresponde aos filtros selecionados.</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pendentes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <GroupLabel label="Atrasadas" color="#dc2626" count={visAtrasadas.length} />
            {visAtrasadas.map((t) => <SortableItem key={t.id} t={t} {...itemProps} />)}

            <GroupLabel label="Hoje" color={B.navy} count={visHoje.length} />
            {visHoje.map((t) => <SortableItem key={t.id} t={t} {...itemProps} />)}

            <GroupLabel label="Próximas" color="#6b7280" count={visFuturas.length} />
            {visFuturas.map((t) => <SortableItem key={t.id} t={t} {...itemProps} />)}
          </div>
        </SortableContext>
      </DndContext>

      {visConcluidas.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 6 }}>Concluídas ({visConcluidas.length})</div>
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {visConcluidas.map((t) => <SortableItem key={t.id} t={t} {...itemProps} />)}
          </div>
        </div>
      )}

      {concluidas.length > 0 && filterStatus !== "vencidas" && (
        <button onClick={clearDoneTodos} style={{ marginTop: 10, width: "100%", padding: "7px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Limpar concluídas ({concluidas.length})
        </button>
      )}

      {/* ═══ MODAL EDIÇÃO ═══ */}
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
