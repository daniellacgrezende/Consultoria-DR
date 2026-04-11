import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { huid } from "../utils/helpers";
import { parseICS } from "../utils/icsParser";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import Avatar from "../components/ui/Avatar";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

const EVENT_TYPES = [
  { v: "reuniao", l: "Reunião", color: "#2563eb" },
  { v: "evento", l: "Evento", color: "#7c3aed" },
];

export default function Calendar() {
  const { clients, setToast } = useData();
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", start_at: "", end_at: "", type: "reuniao", client_id: "", location: "", color: "#2563eb", guests: "" });
  const [viewDate, setViewDate] = useState(new Date());
  const [delConf, setDelConf] = useState(null);

  // ─── Outlook sync state ───
  const [syncModal, setSyncModal] = useState(false);
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem("outlook_ics_url") || "");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Load events
  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from("calendar_events").select("*").order("start_at");
    setEvents(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const refresh = async () => {
    setLoaded(false);
    await loadEvents();
    if (setToast) setToast({ type: "success", text: "Calendário atualizado!" });
  };

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
    setForm({ title: "", description: "", start_at: dateStr, end_at: endStr, type: "reuniao", client_id: "", location: "", color: "#2563eb", guests: "" });
    setModal(true);
  };

  const openEdit = (ev) => { setEditId(ev.id); setForm({ ...ev, start_at: ev.start_at?.slice(0, 16), end_at: ev.end_at?.slice(0, 16), guests: ev.guests || "" }); setModal(true); };

  const buildOutlookUrl = (entry) => {
    const params = new URLSearchParams();
    params.set("subject", entry.title);
    params.set("startdt", new Date(entry.start_at).toISOString());
    params.set("enddt", new Date(entry.end_at).toISOString());
    if (entry.location) params.set("location", entry.location);
    if (entry.description) params.set("body", entry.description);
    if (entry.guests) params.set("to", entry.guests.replace(/\s/g, ""));
    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  const save = async () => {
    if (!form.title?.trim()) { if (setToast) setToast({ type: "error", text: "Informe o título." }); return; }
    if (!form.start_at) { if (setToast) setToast({ type: "error", text: "Informe o início." }); return; }
    if (!form.end_at) { if (setToast) setToast({ type: "error", text: "Informe o fim." }); return; }

    const typeColor = EVENT_TYPES.find((t) => t.v === form.type)?.color || "#2563eb";
    const guests = form.guests || "";

    // Build clean DB entry with only valid columns
    const entry = {
      title: form.title,
      description: form.description || "",
      start_at: form.start_at,
      end_at: form.end_at,
      type: form.type || "reuniao",
      client_id: form.client_id || null,
      lead_id: form.lead_id || null,
      location: form.location || "",
      color: typeColor,
      outlook_event_id: form.outlook_event_id || "",
    };

    if (!editId) {
      entry.id = huid();
      const { data, error } = await supabase.from("calendar_events").insert(entry).select();
      if (error) {
        if (setToast) setToast({ type: "error", text: `Erro ao salvar: ${error.message}` });
        return;
      }
      if (data) setEvents((p) => [...p, data[0]]);
      // Open Outlook to create event and send invites
      const outlookUrl = buildOutlookUrl({ ...entry, guests });
      window.open(outlookUrl, "_blank");
      if (setToast) setToast({ type: "success", text: "Evento criado! Outlook aberto para enviar convites." });
    } else {
      entry.id = editId;
      const { error } = await supabase.from("calendar_events").update(entry).eq("id", editId);
      if (error) {
        if (setToast) setToast({ type: "error", text: `Erro ao atualizar: ${error.message}` });
        return;
      }
      setEvents((p) => p.map((e) => (e.id === editId ? { ...e, ...entry } : e)));
      if (setToast) setToast({ type: "success", text: "Evento atualizado." });
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

  // ─── Outlook/Teams Sync ───
  const importEvents = async (parsed) => {
    if (!parsed.length) {
      setSyncResult({ type: "error", text: "Nenhum evento encontrado no arquivo." });
      return;
    }

    // Get existing outlook_event_ids to avoid duplicates
    const existingIds = new Set(events.filter((e) => e.outlook_event_id).map((e) => e.outlook_event_id));

    const newEvents = parsed.filter((e) => !existingIds.has(e.outlook_event_id) && e.start_at && e.end_at);

    if (newEvents.length === 0) {
      setSyncResult({ type: "info", text: `${parsed.length} eventos encontrados, mas todos já estão sincronizados.` });
      return;
    }

    // Prepare for insert
    const toInsert = newEvents.map((e) => ({
      id: huid(),
      title: e.title,
      description: e.description || "",
      start_at: e.start_at,
      end_at: e.end_at,
      type: e.type || "reuniao",
      color: e.color || "#2563eb",
      location: e.location || "",
      outlook_event_id: e.outlook_event_id || "",
      client_id: null,
      lead_id: null,
    }));

    const { data, error } = await supabase.from("calendar_events").insert(toInsert).select();
    if (error) {
      setSyncResult({ type: "error", text: `Erro ao salvar: ${error.message}` });
      return;
    }

    setEvents((p) => [...p, ...(data || toInsert)]);
    setSyncResult({ type: "success", text: `${toInsert.length} evento(s) importado(s) com sucesso! (${parsed.length - newEvents.length} duplicados ignorados)` });
    if (setToast) setToast({ type: "success", text: `${toInsert.length} eventos importados do Outlook!` });
  };

  const handleUrlSync = async () => {
    if (!syncUrl?.trim()) {
      setSyncResult({ type: "error", text: "Cole a URL do calendário." });
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    localStorage.setItem("outlook_ics_url", syncUrl);
    try {
      const resp = await fetch(`/api/calendar-proxy?url=${encodeURIComponent(syncUrl)}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }
      const text = await resp.text();
      const parsed = parseICS(text);
      await importEvents(parsed);
    } catch (err) {
      setSyncResult({ type: "error", text: `Erro na sincronização: ${err.message}` });
    }
    setSyncing(false);
  };

  // Count outlook events
  const outlookCount = events.filter((e) => e.outlook_event_id).length;

  return (
    <>
      <SecH eyebrow="Agenda" title="Calendário" desc="Visualize e gerencie seus compromissos." />

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: B.navy }}>← Anterior</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: B.navy, textTransform: "capitalize" }}>{monthName}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: B.navy }} title="Atualizar calendário">🔄</button>
          <button onClick={() => setSyncModal(true)} style={{ background: "#0078d4", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>📧</span> Outlook / Teams
            {outlookCount > 0 && <span style={{ background: "rgba(255,255,255,0.3)", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>{outlookCount}</span>}
          </button>
          <button onClick={() => openNew(null)} style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Novo Evento</button>
          <button onClick={nextMonth} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: B.navy }}>Próximo →</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} style={{ padding: "5px 2px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>{d}</div>
          ))}
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            return (
              <div key={i} onClick={() => day && openNew(day)} style={{ minHeight: 56, maxHeight: 90, overflow: "hidden", padding: "2px 3px", borderBottom: `1px solid ${B.border}`, borderRight: i % 7 !== 6 ? `1px solid ${B.border}` : "none", background: !day ? "#fafbff" : isToday(day) ? "#eff6ff" : "white", cursor: day ? "pointer" : "default" }}>
                {day && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: isToday(day) ? 800 : 400, color: isToday(day) ? "#2563eb" : B.navy, marginBottom: 1, textAlign: "right", lineHeight: 1.2 }}>{day}</div>
                    {dayEvents.slice(0, 4).map((ev) => {
                      const t = EVENT_TYPES.find((t) => t.v === ev.type);
                      return (
                        <div key={ev.id} onClick={(e) => { e.stopPropagation(); openEdit(ev); }} style={{ fontSize: 8, fontWeight: 600, color: "white", background: t?.color || ev.color || "#2563eb", borderRadius: 3, padding: "1px 3px", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", lineHeight: 1.3 }}>
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 4 && <div style={{ fontSize: 8, color: "#8899bb", textAlign: "center", lineHeight: 1 }}>+{dayEvents.length - 4}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Próximos 7 dias */}
      {(() => {
        const now = new Date();
        const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcoming = events.filter((e) => {
          const d = new Date(e.start_at);
          return d >= now && d <= in7;
        }).sort((a, b) => a.start_at.localeCompare(b.start_at));
        if (!upcoming.length) return null;
        return (
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Próximos eventos (7 dias)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upcoming.map((ev) => {
                const t = EVENT_TYPES.find((t) => t.v === ev.type);
                const cl = ev.client_id ? clients.find((c) => c.id === ev.client_id) : null;
                const isOutlook = !!ev.outlook_event_id;
                return (
                  <div key={ev.id} onClick={() => openEdit(ev)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, cursor: "pointer", borderLeft: `3px solid ${t?.color || "#2563eb"}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, display: "flex", alignItems: "center", gap: 6 }}>
                        {isOutlook && <span style={{ fontSize: 10, background: "#e1effe", color: "#0078d4", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Outlook</span>}
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 11, color: B.gray }}>{new Date(ev.start_at).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} {ev.location && `· ${ev.location}`}</div>
                    </div>
                    {cl && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar nome={cl.nome} size={24} /><span style={{ fontSize: 11, color: B.navy }}>{cl.nome.split(" ")[0]}</span></div>}
                    <span style={{ fontSize: 10, fontWeight: 700, color: t?.color, background: `${t?.color}15`, padding: "2px 8px", borderRadius: 999 }}>{t?.l || ev.type}</span>
                    <button onClick={(e) => { e.stopPropagation(); setDelConf(ev.id); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>🗑</button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* ═══ MODAL SYNC OUTLOOK ═══ */}
      <Modal open={syncModal} onClose={() => { setSyncModal(false); setSyncResult(null); }} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>📧 Sincronizar com Outlook / Teams</h3>
            <button onClick={() => { setSyncModal(false); setSyncResult(null); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: B.gray, marginBottom: 20, marginTop: 4 }}>Importe reuniões e eventos do Outlook e Teams para o seu calendário.</p>

          {/* Resultado do sync */}
          {syncResult && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 600, background: syncResult.type === "success" ? "#f0fdf4" : syncResult.type === "error" ? "#fef2f2" : "#eff6ff", color: syncResult.type === "success" ? "#16a34a" : syncResult.type === "error" ? "#dc2626" : "#2563eb", border: `1px solid ${syncResult.type === "success" ? "#bbf7d0" : syncResult.type === "error" ? "#fecaca" : "#bfdbfe"}` }}>
              {syncResult.text}
            </div>
          )}

          {/* Sync via URL */}
          <div style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Sincronizar via URL do calendário</span>
            </div>
            <p style={{ fontSize: 11, color: B.gray, margin: "0 0 12px" }}>
              Cole a URL ICS do calendário publicado. A URL fica salva para sincronizações futuras.
            </p>
            <div style={{ fontSize: 11, color: B.gray, background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <strong style={{ color: B.navy }}>Como obter a URL:</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
                <li>No <strong>Outlook Web</strong>, vá em <strong>Configurações → Calendário → Calendários compartilhados</strong></li>
                <li>Em <strong>"Publicar um calendário"</strong>, selecione seu calendário</li>
                <li>Escolha <strong>"Pode ver todos os detalhes"</strong> e clique <strong>"Publicar"</strong></li>
                <li>Copie o <strong>link ICS</strong> (começa com https://outlook.office365.com/...)</li>
              </ol>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://outlook.office365.com/owa/calendar/..."
                style={{ flex: 1, background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: B.navy, outline: "none" }}
              />
              <button onClick={handleUrlSync} disabled={syncing} style={{ padding: "10px 20px", background: syncing ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 8, cursor: syncing ? "wait" : "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar"}
              </button>
            </div>
            {localStorage.getItem("outlook_ics_url") && (
              <div style={{ fontSize: 10, color: "#16a34a", marginTop: 6 }}>✓ URL salva — clique em Sincronizar para atualizar</div>
            )}
          </div>

          {/* Info */}
          <div style={{ marginTop: 16, fontSize: 11, color: B.gray, display: "flex", alignItems: "start", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div>
              <strong style={{ color: "#92400e" }}>Dica:</strong> Reuniões do <strong>Microsoft Teams</strong> aparecem automaticamente no calendário do Outlook. Ao sincronizar o Outlook, as reuniões do Teams serão importadas também!
              <br />Eventos duplicados são detectados automaticamente e ignorados.
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Evento */}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Evento" : "Novo Evento"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          {editId && form.outlook_event_id && (
            <div style={{ fontSize: 10, background: "#e1effe", color: "#0078d4", padding: "4px 10px", borderRadius: 6, marginBottom: 12, display: "inline-block", fontWeight: 600 }}>📧 Importado do Outlook</div>
          )}
          <Inp label="Título *" value={form.title} onChange={F("title")} placeholder="Ex: Reunião com João" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Início *" type="datetime-local" value={form.start_at} onChange={F("start_at")} />
            <Inp label="Fim *" type="datetime-local" value={form.end_at} onChange={F("end_at")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Sel label="Tipo" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, color: EVENT_TYPES.find((t) => t.v === e.target.value)?.color || "#2563eb" }))} opts={EVENT_TYPES.map((t) => ({ v: t.v, l: t.l }))} />
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Cliente</label>
              <select value={form.client_id || ""} onChange={F("client_id")} style={{ width: "100%", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: B.navy, outline: "none" }}>
                <option value="">— Nenhum —</option>
                {[...clients].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <Inp label="E-mail convidados" value={form.guests || ""} onChange={F("guests")} placeholder="email1@exemplo.com, email2@exemplo.com" />
          <Inp label="Local" value={form.location || ""} onChange={F("location")} placeholder="Escritório, Online, Teams, etc." />
          <Tarea label="Descrição" value={form.description || ""} onChange={F("description")} placeholder="Detalhes do evento..." />
          {!editId && (
            <div style={{ fontSize: 11, color: "#0078d4", background: "#e1effe", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📧</span> Ao criar, o Outlook será aberto para adicionar à sua agenda e enviar convites aos convidados.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>🗑</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CRIAR EVENTO"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>Remover evento?</h3>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => remove(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
