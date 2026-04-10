import { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid } from "../utils/helpers";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import Avatar from "../components/ui/Avatar";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

const EVENT_TYPES = [
  { v: "reuniao", l: "📅 Reunião", color: "#2563eb" },
  { v: "followup", l: "📞 Follow-up", color: "#7c3aed" },
  { v: "lembrete", l: "🔔 Lembrete", color: "#f59e0b" },
  { v: "pessoal", l: "🏠 Pessoal", color: "#6b7280" },
];

export default function Calendar() {
  const { clients } = useData();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", start_at: "", end_at: "", type: "reuniao", client_id: "", location: "", color: "#2563eb" });
  const [viewDate, setViewDate] = useState(new Date());
  const [delConf, setDelConf] = useState(null);

  // Load events
  useState(() => {
    supabase.from("calendar_events").select("*").order("start_at").then(({ data }) => {
      setEvents(data || []);
      setLoaded(true);
    });
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return events.filter((e) => e.start_at?.startsWith(prefix));
  }, [events, year, month]);

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.start_at?.startsWith(dateStr));
  };

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = (day) => {
    const dateStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00` : "";
    const endStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T10:00` : "";
    setEditId(null);
    setForm({ title: "", description: "", start_at: dateStr, end_at: endStr, type: "reuniao", client_id: "", location: "", color: "#2563eb" });
    setModal(true);
  };

  const openEdit = (ev) => { setEditId(ev.id); setForm({ ...ev, start_at: ev.start_at?.slice(0, 16), end_at: ev.end_at?.slice(0, 16) }); setModal(true); };

  const save = async () => {
    if (!form.title?.trim() || !form.start_at || !form.end_at) return;
    const entry = { ...form };
    if (!editId) {
      entry.id = huid();
      const { data } = await supabase.from("calendar_events").insert(entry).select();
      if (data) setEvents((p) => [...p, data[0]]);
    } else {
      entry.id = editId;
      await supabase.from("calendar_events").update(entry).eq("id", editId);
      setEvents((p) => p.map((e) => (e.id === editId ? { ...e, ...entry } : e)));
    }
    setModal(false);
  };

  const remove = async (id) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents((p) => p.filter((e) => e.id !== id));
    setDelConf(null);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const todayDate = new Date();
  const isToday = (day) => todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === day;

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <>
      <SecH eyebrow="Agenda" title="Calendário 📅" desc="Visualize e gerencie seus compromissos." />

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: B.navy }}>← Anterior</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: B.navy, textTransform: "capitalize" }}>{monthName}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openNew(null)} style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Novo Evento</button>
          <button onClick={nextMonth} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: B.navy }}>Próximo →</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} style={{ padding: "10px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>{d}</div>
          ))}
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            return (
              <div key={i} onClick={() => day && openNew(day)} style={{ minHeight: 80, padding: 4, borderBottom: `1px solid ${B.border}`, borderRight: i % 7 !== 6 ? `1px solid ${B.border}` : "none", background: !day ? "#fafbff" : isToday(day) ? "#eff6ff" : "white", cursor: day ? "pointer" : "default" }}>
                {day && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday(day) ? 800 : 400, color: isToday(day) ? "#2563eb" : B.navy, marginBottom: 4, textAlign: "right", padding: "2px 4px" }}>{day}</div>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const t = EVENT_TYPES.find((t) => t.v === ev.type);
                      return (
                        <div key={ev.id} onClick={(e) => { e.stopPropagation(); openEdit(ev); }} style={{ fontSize: 9, fontWeight: 600, color: "white", background: t?.color || ev.color || "#2563eb", borderRadius: 4, padding: "2px 4px", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>{ev.title}</div>
                      );
                    })}
                    {dayEvents.length > 3 && <div style={{ fontSize: 9, color: "#8899bb", textAlign: "center" }}>+{dayEvents.length - 3}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Eventos do mês */}
      {monthEvents.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📋 Eventos de {monthName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {monthEvents.sort((a, b) => a.start_at.localeCompare(b.start_at)).map((ev) => {
              const t = EVENT_TYPES.find((t) => t.v === ev.type);
              const cl = ev.client_id ? clients.find((c) => c.id === ev.client_id) : null;
              return (
                <div key={ev.id} onClick={() => openEdit(ev)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, cursor: "pointer", borderLeft: `3px solid ${t?.color || "#2563eb"}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: B.gray }}>{new Date(ev.start_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} {ev.location && `· ${ev.location}`}</div>
                  </div>
                  {cl && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar nome={cl.nome} size={24} /><span style={{ fontSize: 11, color: B.navy }}>{cl.nome.split(" ")[0]}</span></div>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: t?.color, background: `${t?.color}15`, padding: "2px 8px", borderRadius: 999 }}>{t?.l?.split(" ")[1] || ev.type}</span>
                  <button onClick={(e) => { e.stopPropagation(); setDelConf(ev.id); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>🗑</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Evento" : "Novo Evento"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <Inp label="Título *" value={form.title} onChange={F("title")} placeholder="Ex: Reunião com João" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Início *" type="datetime-local" value={form.start_at} onChange={F("start_at")} />
            <Inp label="Fim *" type="datetime-local" value={form.end_at} onChange={F("end_at")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Sel label="Tipo" value={form.type} onChange={F("type")} opts={EVENT_TYPES.map((t) => ({ v: t.v, l: t.l }))} />
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Cliente (opcional)</label>
              <select value={form.client_id || ""} onChange={F("client_id")} style={{ width: "100%", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: B.navy, outline: "none" }}>
                <option value="">— Nenhum —</option>
                {[...clients].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <Inp label="Local" value={form.location || ""} onChange={F("location")} placeholder="Escritório, Online, etc." />
          <Tarea label="Descrição" value={form.description || ""} onChange={F("description")} placeholder="Detalhes do evento..." />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>🗑</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CRIAR EVENTO"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>⚠️ Remover evento?</h3>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => remove(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
