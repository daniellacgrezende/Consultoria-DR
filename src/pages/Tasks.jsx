import { useState } from "react";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

const EMPTY_FORM = { texto: "", recorrencia: "", vencimento: "", descricao: "", prioridade: "normal" };

const RECORR_COLORS = {
  diária:  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  semanal: { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  mensal:  { bg: "#fefce8", color: "#854d0e", border: "#fde047" },
};

export default function Tasks() {
  const { todos, saveTodo, deleteTodo, clearDoneTodos, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openNew = () => { setEditId(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ texto: t.texto || "", recorrencia: t.recorrencia || "", vencimento: t.vencimento || t.data || "", descricao: t.descricao || "", prioridade: t.prioridade || "normal" });
    setModal(true);
  };

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.texto.trim()) { setToast({ type: "error", text: "Informe o nome da tarefa." }); return; }
    const isNew = !editId;
    const entry = {
      id: editId || huid(),
      texto: form.texto.trim(),
      recorrencia: form.recorrencia,
      vencimento: form.vencimento || today(),
      descricao: form.descricao,
      prioridade: form.prioridade,
      done: isNew ? false : (todos.find((t) => t.id === editId)?.done ?? false),
      done_at: isNew ? null : (todos.find((t) => t.id === editId)?.done_at ?? null),
      data: isNew ? today() : (todos.find((t) => t.id === editId)?.data ?? today()),
      ordem: isNew ? todos.length : (todos.find((t) => t.id === editId)?.ordem ?? 0),
    };
    await saveTodo(entry, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Tarefa criada." : "Tarefa atualizada." });
  };

  const toggle = async (t) => {
    await saveTodo({ ...t, done: !t.done, done_at: !t.done ? today() : null }, false);
  };

  const remove = async (id) => { await deleteTodo(id); };

  const postpone = async (t) => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    await saveTodo({ ...t, vencimento: d.toISOString().slice(0, 10) }, false);
  };

  const pendentes = todos.filter((t) => !t.done);
  const concluidas = todos.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const atrasadas = pendentes.filter((t) => (t.vencimento || t.data || today()) < today());
  const hojeList = pendentes.filter((t) => (t.vencimento || t.data || today()) === today());
  const futuras = pendentes.filter((t) => (t.vencimento || t.data || today()) > today());

  const priorColors = {
    alta:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    normal: { bg: "#f8faff", color: B.navy,    border: B.border },
    baixa:  { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  };

  const Item = ({ t }) => {
    const atras = atrasadas.includes(t);
    const pc = priorColors[t.prioridade || "normal"];
    const rc = t.recorrencia ? RECORR_COLORS[t.recorrencia] : null;
    return (
      <div style={{ borderRadius: 8, background: t.done ? "#f9fafb" : atras ? "#fff5f5" : pc.bg, border: `1px solid ${t.done ? "#e5e7eb" : atras ? "#fecaca" : pc.border}`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ width: 15, height: 15, accentColor: B.navy, flexShrink: 0, cursor: "pointer" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.done ? "#9baabf" : atras ? "#dc2626" : pc.color, textDecoration: t.done ? "line-through" : "none" }}>{t.texto}</span>
            {rc && (
              <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, borderRadius: 999, padding: "1px 6px", textTransform: "uppercase" }}>
                {t.recorrencia}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: atras ? "#dc2626" : "#9baabf", flexShrink: 0, fontWeight: atras ? 700 : 400 }}>{fmtDate(t.vencimento || t.data)}</span>
          {!t.done && <button onClick={() => postpone(t)} title="+1d" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+1d</button>}
          {!t.done && <button onClick={() => openEdit(t)} style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>Editar</button>}
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>×</button>
        </div>
        {t.descricao && !t.done && (
          <div style={{ padding: "0 12px 9px 35px", fontSize: 11, color: B.muted, lineHeight: 1.5 }}>{t.descricao}</div>
        )}
      </div>
    );
  };

  const Group = ({ label, color, items }) => items.length === 0 ? null : (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", marginTop: 4 }}>{label} ({items.length})</div>
      {items.map((t) => <Item key={t.id} t={t} />)}
    </>
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Produtividade" title="Tarefas" desc="Gerencie suas pendências e to-dos." />
        <button onClick={openNew} style={{ padding: "8px 18px", background: B.brand, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Nova Tarefa</button>
      </div>

      <Card style={{ border: `2px solid ${B.navy}` }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>To Do</span>
          <span style={{ fontSize: 11, color: B.gray, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 999, padding: "2px 10px" }}>{pendentes.length} pendente(s) · {concluidas.length} concluída(s)</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {todos.length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa. Clique em "+ Nova Tarefa" para começar.</div>}
          <Group label="Atrasadas" color="#dc2626" items={atrasadas} />
          <Group label="Hoje" color={B.navy} items={hojeList} />
          <Group label="Próximas" color="#6b7280" items={futuras} />
          {concluidas.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginTop: 8 }}>Concluídas ({concluidas.length})</div>
              <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {concluidas.map((t) => <Item key={t.id} t={t} />)}
              </div>
            </>
          )}
        </div>

        {concluidas.length > 0 && (
          <button onClick={clearDoneTodos} style={{ marginTop: 10, width: "100%", padding: "7px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Limpar concluídas ({concluidas.length})
          </button>
        )}
      </Card>

      {/* ═══ MODAL ═══ */}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.navy }}>{editId ? "Editar Tarefa" : "Nova Tarefa"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.muted }}>×</button>
          </div>

          <Inp label="Nome da tarefa *" value={form.texto} onChange={F("texto")} placeholder="Ex: Ligar para cliente, Enviar relatório…" />

          <Sel
            label="Recorrente"
            value={form.recorrencia}
            onChange={F("recorrencia")}
            opts={[
              { v: "", l: "Não recorrente" },
              { v: "diária", l: "Diária" },
              { v: "semanal", l: "Semanal" },
              { v: "mensal", l: "Mensal" },
            ]}
          />

          <Inp label="Prazo" type="date" value={form.vencimento} onChange={F("vencimento")} />

          <Tarea label="Descrição" value={form.descricao} onChange={F("descricao")} placeholder="Detalhes, contexto ou instruções…" />

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            {editId && (
              <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Excluir</button>
            )}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              {editId ? "SALVAR" : "CRIAR"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
