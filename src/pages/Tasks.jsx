import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import { SecH } from "../components/ui/FormFields";

export default function Tasks() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    supabase.from("todos").select("*").order("ordem").then(({ data }) => setTodos(data || []));
  }, []);

  const sync = async (newTodos) => {
    setTodos(newTodos);
  };

  const addTodo = async () => {
    if (!text.trim()) return;
    const t = { id: huid(), texto: text.trim(), done: false, done_at: null, data: today(), vencimento: today(), ordem: todos.length, prioridade: "normal" };
    await supabase.from("todos").insert(t);
    setTodos((p) => [...p, t]);
    setText("");
  };

  const toggle = async (t) => {
    const updates = { done: !t.done, done_at: !t.done ? today() : null };
    await supabase.from("todos").update(updates).eq("id", t.id);
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, ...updates } : x)));
  };

  const remove = async (id) => {
    await supabase.from("todos").delete().eq("id", id);
    setTodos((p) => p.filter((x) => x.id !== id));
  };

  const updatePriority = async (id, prioridade) => {
    await supabase.from("todos").update({ prioridade }).eq("id", id);
    setTodos((p) => p.map((x) => (x.id === id ? { ...x, prioridade } : x)));
  };

  const postpone = async (t) => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const vencimento = d.toISOString().slice(0, 10);
    await supabase.from("todos").update({ vencimento }).eq("id", t.id);
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, vencimento } : x)));
  };

  const saveEdit = async () => {
    await supabase.from("todos").update({ texto: editText }).eq("id", editId);
    setTodos((p) => p.map((x) => (x.id === editId ? { ...x, texto: editText } : x)));
    setEditId(null);
  };

  const clearDone = async () => {
    const doneIds = todos.filter((t) => t.done).map((t) => t.id);
    if (doneIds.length) await supabase.from("todos").delete().in("id", doneIds);
    setTodos((p) => p.filter((t) => !t.done));
  };

  const pendentes = todos.filter((t) => !t.done);
  const concluidas = todos.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const atrasadas = pendentes.filter((t) => (t.vencimento || t.data || today()) < today());
  const hoje = pendentes.filter((t) => (t.vencimento || t.data || today()) === today());
  const futuras = pendentes.filter((t) => (t.vencimento || t.data || today()) > today());

  const priorColors = { alta: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }, normal: { bg: "#f8faff", color: B.navy, border: B.border }, baixa: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" } };

  const Item = ({ t }) => {
    const atras = atrasadas.includes(t);
    const pc = priorColors[t.prioridade || "normal"];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: t.done ? "#f9fafb" : atras ? "#fff5f5" : pc.bg, border: `1px solid ${t.done ? "#e5e7eb" : atras ? "#fecaca" : pc.border}` }}>
        <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ width: 15, height: 15, accentColor: B.navy, flexShrink: 0, cursor: "pointer" }} />
        <span style={{ flex: 1, fontSize: 13, color: t.done ? "#9baabf" : atras ? "#dc2626" : pc.color, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.4 }}>{t.texto}</span>
        {!t.done && (
          <select value={t.prioridade || "normal"} onChange={(e) => updatePriority(t.id, e.target.value)} style={{ fontSize: 10, border: `1px solid ${pc.border}`, borderRadius: 5, padding: "2px 4px", background: pc.bg, color: pc.color, cursor: "pointer", fontWeight: 700 }}>
            <option value="alta">🔴 Alta</option>
            <option value="normal">⚪ Normal</option>
            <option value="baixa">⬇ Baixa</option>
          </select>
        )}
        <span style={{ fontSize: 10, color: atras ? "#dc2626" : "#9baabf", flexShrink: 0, fontWeight: atras ? 700 : 400 }}>{atras ? "⚠ " : ""}{fmtDate(t.vencimento || t.data)}</span>
        {!t.done && <button onClick={() => postpone(t)} title="Adiar +1d" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+1d</button>}
        {!t.done && <button onClick={() => { setEditId(t.id); setEditText(t.texto); }} style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 6, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>✏</button>}
        <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>×</button>
      </div>
    );
  };

  return (
    <>
      <SecH eyebrow="Produtividade" title="Tarefas ✅" desc="Gerencie suas pendências e to-dos." />

      <Card style={{ marginBottom: 20, border: `2px solid ${B.navy}` }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✅ To Do</span>
          <span style={{ fontSize: 11, color: B.gray, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 999, padding: "2px 10px" }}>{pendentes.length} pendente(s) · {concluidas.length} concluída(s)</span>
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {editId ? (
            <>
              <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} style={{ flex: 1, background: "#f0f4ff", border: "2px solid #6366f1", borderRadius: 7, padding: "9px 12px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit" }} />
              <button onClick={saveEdit} style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 7, padding: "9px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Salvar</button>
              <button onClick={() => setEditId(null)} style={{ background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 7, padding: "9px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>✕</button>
            </>
          ) : (
            <>
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }} placeholder="Nova tarefa… (Enter para adicionar)" style={{ flex: 1, background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "9px 12px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit" }} />
              <button onClick={addTodo} style={{ background: B.navy, color: "white", border: "none", borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+</button>
            </>
          )}
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {todos.length === 0 && <div style={{ padding: "16px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma tarefa. Digite acima e pressione Enter.</div>}
          {atrasadas.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginTop: 4 }}>⚠ Atrasadas ({atrasadas.length})</div>{atrasadas.map((t) => <Item key={t.id} t={t} />)}</>}
          {hoje.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: B.navy, textTransform: "uppercase", marginTop: 4 }}>📅 Hoje ({hoje.length})</div>{hoje.map((t) => <Item key={t.id} t={t} />)}</>}
          {futuras.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginTop: 4 }}>🗓 Próximas ({futuras.length})</div>{futuras.map((t) => <Item key={t.id} t={t} />)}</>}
          {concluidas.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginTop: 8 }}>✅ Concluídas ({concluidas.length})</div><div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>{concluidas.map((t) => <Item key={t.id} t={t} />)}</div></>}
        </div>

        {concluidas.length > 0 && <button onClick={clearDone} style={{ marginTop: 10, width: "100%", padding: "7px", background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Limpar concluídas ({concluidas.length})</button>}
      </Card>
    </>
  );
}
