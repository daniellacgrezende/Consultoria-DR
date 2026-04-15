import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { huid } from "../utils/helpers";
import { parseICS } from "../utils/icsParser";
import { SecH, Inp } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";

const FIXED_STAGES = ["lead", "cliente", "perdido", "nutricao"];

export default function Settings() {
  const { pipelineStages, savePipelineStage, deletePipelineStage, setToast } = useData();

  // ─── Outlook sync state ───
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem("outlook_ics_url") || "");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [outlookEvents, setOutlookEvents] = useState([]);

  useEffect(() => {
    supabase.from("calendar_events").select("id, outlook_event_id").then(({ data }) => {
      setOutlookEvents((data || []).filter((e) => e.outlook_event_id));
    });
  }, []);

  const runSync = async (forceAll = false) => {
    if (!syncUrl?.trim()) { setSyncResult({ type: "error", text: "Cole a URL do calendário." }); return; }
    setSyncing(true);
    setSyncResult(null);
    localStorage.setItem("outlook_ics_url", syncUrl);
    try {
      const resp = await fetch(`/api/calendar-proxy?url=${encodeURIComponent(syncUrl)}`);
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `Erro ${resp.status}`); }
      const text = await resp.text();
      const parsed = parseICS(text);
      if (!parsed.length) { setSyncResult({ type: "error", text: "Nenhum evento encontrado no arquivo." }); setSyncing(false); return; }

      const validParsed = parsed.filter((e) => e.start_at && e.outlook_event_id);

      if (forceAll) {
        // Re-sync completo: apaga todos os eventos do Outlook e reimporta
        const { data: existing } = await supabase.from("calendar_events").select("id, outlook_event_id");
        const outlookIds = (existing || []).filter((e) => e.outlook_event_id).map((e) => e.id);
        if (outlookIds.length) await supabase.from("calendar_events").delete().in("id", outlookIds);
        const toInsert = validParsed.map((e) => ({ id: huid(), title: e.title, description: e.description || "", start_at: e.start_at, end_at: e.end_at || e.start_at, type: e.type || "reuniao", color: e.color || "#2563eb", location: e.location || "", outlook_event_id: e.outlook_event_id, client_id: null, lead_id: null }));
        const { error } = await supabase.from("calendar_events").insert(toInsert);
        if (error) throw new Error(error.message);
        setSyncResult({ type: "success", text: `Re-sincronização completa: ${toInsert.length} evento(s) importado(s).` });
        if (setToast) setToast({ type: "success", text: `${toInsert.length} eventos re-importados do Outlook!` });
      } else {
        // Sync incremental: só adiciona eventos novos
        const { data: existing } = await supabase.from("calendar_events").select("outlook_event_id");
        const existingIds = new Set((existing || []).filter((e) => e.outlook_event_id).map((e) => e.outlook_event_id));
        const newEvents = validParsed.filter((e) => !existingIds.has(e.outlook_event_id));
        if (!newEvents.length) { setSyncResult({ type: "info", text: `${parsed.length} eventos encontrados, todos já sincronizados. Use "Re-sincronizar tudo" para corrigir horários.` }); setSyncing(false); return; }
        const toInsert = newEvents.map((e) => ({ id: huid(), title: e.title, description: e.description || "", start_at: e.start_at, end_at: e.end_at || e.start_at, type: e.type || "reuniao", color: e.color || "#2563eb", location: e.location || "", outlook_event_id: e.outlook_event_id, client_id: null, lead_id: null }));
        const { error } = await supabase.from("calendar_events").insert(toInsert);
        if (error) throw new Error(error.message);
        setSyncResult({ type: "success", text: `${toInsert.length} evento(s) novo(s) importado(s)! (${parsed.length - newEvents.length} já existiam)` });
        if (setToast) setToast({ type: "success", text: `${toInsert.length} eventos importados do Outlook!` });
      }
    } catch (err) {
      setSyncResult({ type: "error", text: `Erro na sincronização: ${err.message}` });
    }
    setSyncing(false);
  };

  const handleUrlSync = () => runSync(false);
  const handleForceSync = () => runSync(true);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", tipo: "main", color: "#1D3557", bg: "#f0f4ff", border_color: "#d5ddf5" });
  const [delConf, setDelConf] = useState(null);

  const mainStages = pipelineStages.filter((s) => s.tipo === "main");
  const exitStages = pipelineStages.filter((s) => s.tipo === "exit");

  const startEdit = (s) => { setEditId(s.id); setEditForm({ ...s }); };

  const saveEdit = async () => {
    await savePipelineStage({ ...editForm }, false);
    setEditId(null);
    setToast({ type: "success", text: "Etapa atualizada." });
  };

  const confirmDelete = async (id) => {
    if (FIXED_STAGES.includes(id)) { setToast({ type: "error", text: "Esta etapa não pode ser removida." }); return; }
    await deletePipelineStage(id);
    setDelConf(null);
    setToast({ type: "success", text: "Etapa removida." });
  };

  const saveNew = async () => {
    if (!newForm.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const id = newForm.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (pipelineStages.find((s) => s.id === id)) { setToast({ type: "error", text: "Já existe uma etapa com esse nome." }); return; }
    const maxOrdem = pipelineStages.filter((s) => s.tipo === newForm.tipo).reduce((m, s) => Math.max(m, s.ordem), 0);
    await savePipelineStage({ id, ...newForm, ordem: maxOrdem + 1 }, true);
    setNewModal(false);
    setToast({ type: "success", text: "Etapa criada." });
  };

  const F = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));
  const NF = (k) => (e) => setNewForm((f) => ({ ...f, [k]: e.target.value }));

  const StageRow = ({ s }) => {
    const isEditing = editId === s.id;
    const isFixed = FIXED_STAGES.includes(s.id);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: isEditing ? "#f8faff" : "white", border: `1px solid ${isEditing ? "#818CF8" : B.border}`, marginBottom: 6 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: isEditing ? editForm.color : s.color, flexShrink: 0 }} />
        {isEditing ? (
          <>
            <input value={editForm.nome} onChange={F("nome")} style={{ flex: 1, padding: "4px 8px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 13, color: B.navy, fontFamily: "inherit" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: B.muted }}>Cor:</div>
            <input type="color" value={editForm.color} onChange={F("color")} style={{ width: 30, height: 26, border: `1px solid ${B.border}`, borderRadius: 4, cursor: "pointer", padding: 1 }} />
            <button onClick={() => setEditId(null)} style={{ background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveEdit} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: B.navy }}>{s.nome}</span>
            <span style={{ fontSize: 10, color: B.muted, background: s.tipo === "exit" ? "#fef2f2" : "#f0f4ff", border: `1px solid ${s.tipo === "exit" ? "#fecaca" : B.border}`, borderRadius: 999, padding: "1px 7px" }}>{s.tipo === "exit" ? "Saída" : "Principal"}</span>
            <button onClick={() => startEdit(s)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Editar</button>
            <button onClick={() => isFixed ? setToast({ type: "error", text: "Esta etapa não pode ser removida." }) : setDelConf(s.id)} style={{ background: isFixed ? "#f9fafb" : "#fff5f5", color: isFixed ? "#c4cbd8" : "#dc2626", border: `1px solid ${isFixed ? "#e5e7eb" : "#fecaca"}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: isFixed ? "default" : "pointer" }}>✕</button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <SecH eyebrow="Sistema" title="Configurações" desc="Gerencie as etapas do pipeline e outras configurações." />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Etapas do Pipeline</div>
          <button onClick={() => { setNewForm({ nome: "", tipo: "main", color: "#1D3557", bg: "#f0f4ff", border_color: "#d5ddf5" }); setNewModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Nova Etapa</button>
        </div>

        {mainStages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 8 }}>Etapas Principais (funil)</div>
            {mainStages.map((s) => <StageRow key={s.id} s={s} />)}
          </div>
        )}

        {exitStages.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 8 }}>Saídas Alternativas</div>
            {exitStages.map((s) => <StageRow key={s.id} s={s} />)}
          </div>
        )}

        {pipelineStages.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: B.muted, fontSize: 12 }}>Carregando etapas…</div>
        )}
      </Card>

      {/* ═══ OUTLOOK / TEAMS SYNC ═══ */}
      <Card style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📧</span> Sincronizar Outlook / Teams
          </div>
          {outlookEvents.length > 0 && (
            <span style={{ fontSize: 10, background: "#e1effe", color: "#0078d4", padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>{outlookEvents.length} eventos importados</span>
          )}
        </div>

        <p style={{ fontSize: 12, color: B.gray, marginBottom: 16, marginTop: 0 }}>Importe reuniões e eventos do Outlook e Teams para o seu calendário.</p>

        {syncResult && (
          <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 600, background: syncResult.type === "success" ? "#f0fdf4" : syncResult.type === "error" ? "#fef2f2" : "#eff6ff", color: syncResult.type === "success" ? "#16a34a" : syncResult.type === "error" ? "#dc2626" : "#2563eb", border: `1px solid ${syncResult.type === "success" ? "#bbf7d0" : syncResult.type === "error" ? "#fecaca" : "#bfdbfe"}` }}>
            {syncResult.text}
          </div>
        )}

        <div style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 10 }}>Sincronizar via URL do calendário</div>
          <p style={{ fontSize: 11, color: B.gray, margin: "0 0 12px" }}>Cole a URL ICS do calendário publicado. A URL fica salva para sincronizações futuras.</p>
          <div style={{ fontSize: 11, color: B.gray, background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <strong style={{ color: B.navy }}>Como obter a URL:</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
              <li>No <strong>Outlook Web</strong>, vá em <strong>Configurações → Calendário → Calendários compartilhados</strong></li>
              <li>Em <strong>"Publicar um calendário"</strong>, selecione seu calendário</li>
              <li>Escolha <strong>"Pode ver todos os detalhes"</strong> e clique <strong>"Publicar"</strong></li>
              <li>Copie o <strong>link ICS</strong> (começa com https://outlook.office365.com/...)</li>
            </ol>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="url" value={syncUrl} onChange={(e) => setSyncUrl(e.target.value)} placeholder="https://outlook.office365.com/owa/calendar/..." style={{ flex: 1, minWidth: 200, background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: B.navy, outline: "none" }} />
            <button onClick={handleUrlSync} disabled={syncing} style={{ padding: "10px 20px", background: syncing ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 8, cursor: syncing ? "wait" : "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
              {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar"}
            </button>
            <button onClick={() => { if (confirm("Isso vai apagar todos os eventos do Outlook e reimportar do zero (corrige horários errados). Continuar?")) handleForceSync(); }} disabled={syncing} title="Apaga todos os eventos do Outlook e reimporta — use para corrigir horários" style={{ padding: "10px 16px", background: syncing ? "#94a3b8" : "#dc2626", color: "white", border: "none", borderRadius: 8, cursor: syncing ? "wait" : "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
              🔁 Re-sincronizar tudo
            </button>
          </div>
          <div style={{ fontSize: 10, color: B.gray, marginTop: 6 }}>
            💡 <b>Re-sincronizar tudo</b>: use quando houver horários errados ou eventos faltando — apaga e reimporta do zero.
          </div>
          {localStorage.getItem("outlook_ics_url") && (
            <div style={{ fontSize: 10, color: "#16a34a", marginTop: 4 }}>✓ URL salva — clique em Sincronizar para atualizar</div>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: B.gray, display: "flex", alignItems: "start", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div>
            <strong style={{ color: "#92400e" }}>Dica:</strong> Reuniões do <strong>Microsoft Teams</strong> aparecem automaticamente no calendário do Outlook. Ao sincronizar o Outlook, as reuniões do Teams serão importadas também!
          </div>
        </div>
      </Card>

      {/* Modal Nova Etapa */}
      <Modal open={newModal} onClose={() => setNewModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.navy }}>Nova Etapa</h3>
            <button onClick={() => setNewModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.muted }}>×</button>
          </div>

          <Inp label="Nome da Etapa *" value={newForm.nome} onChange={NF("nome")} placeholder="Ex: Apresentação" />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>Tipo</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["main", "exit"].map((t) => (
                <button key={t} onClick={() => setNewForm((f) => ({ ...f, tipo: t }))} style={{ flex: 1, padding: "8px", borderRadius: 7, border: `1px solid ${newForm.tipo === t ? B.navy : B.border}`, background: newForm.tipo === t ? B.navy : "white", color: newForm.tipo === t ? "white" : B.navy, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {t === "main" ? "Principal" : "Saída alternativa"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={newForm.color} onChange={NF("color")} style={{ width: 44, height: 36, border: `1px solid ${B.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
              <span style={{ fontSize: 12, color: B.muted }}>{newForm.color}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setNewModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveNew} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>CRIAR</button>
          </div>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>Remover etapa?</h3>
          <p style={{ color: B.gray, fontSize: 13, marginBottom: 22 }}>Leads nessa etapa não serão afetados, mas a coluna sumirá do pipeline.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => confirmDelete(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
