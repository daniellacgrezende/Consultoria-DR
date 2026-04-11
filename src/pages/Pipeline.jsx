import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useData } from "../hooks/useData";
import { B, LEAD_ETAPAS, LEAD_ETAPAS_MAIN, LEAD_ETAPAS_EXIT, LEAD_ETAPA_COLORS, LEAD_ORIGENS, EMPTY_LEAD, LEAD_TEMPERATURAS, TIPO_REUNIAO } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { TempBadge } from "../components/ui/Badge";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

/* ─── Draggable Lead Card ─── */
function DraggableLeadCard({ lead, openEdit, moveEtapa }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { lead } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: "white",
    border: `1px solid ${B.border}`,
    borderRadius: 9,
    padding: "10px 12px",
    cursor: "grab",
    touchAction: "none",
  };
  const etapa = lead.etapa;
  const tempMap = { fria: { bg: "#E8F0FE", color: "#2A7DE1", l: "Fria" }, morna: { bg: "#FFF4D6", color: "#E89B00", l: "Morna" }, quente: { bg: "#FDE8E8", color: "#D30000", l: "Quente" } };
  const tc = lead.temperatura ? tempMap[lead.temperatura] : null;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => openEdit(lead)}>
      <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 4 }}>{lead.nome}</div>
      {lead.telefone && <div style={{ fontSize: 10, color: B.gray, marginBottom: 3 }}>{lead.telefone}</div>}
      {lead.origem && <div style={{ fontSize: 10, color: B.gray, marginBottom: 3 }}>{lead.origem}</div>}
      {lead.patrimonio_estimado > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginBottom: 3 }}>{money(lead.patrimonio_estimado)}</div>}
      {tc && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, background: tc.bg, color: tc.color, borderRadius: 999, padding: "2px 8px" }}>{tc.l}</span></div>}
      {etapa !== "Cliente" && etapa !== "Perdido" && etapa !== "Nutrição" && (
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Cliente"); }} style={{ flex: 1, fontSize: 9, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px", cursor: "pointer" }}>Converter</button>
          <button onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Perdido"); }} style={{ flex: 1, fontSize: 9, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px", cursor: "pointer" }}>Perdido</button>
          <button onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Nutrição"); }} style={{ flex: 1, fontSize: 9, fontWeight: 700, background: "#fefce8", color: "#854d0e", border: "1px solid #fde047", borderRadius: 6, padding: "4px", cursor: "pointer" }}>Nutrição</button>
        </div>
      )}
    </div>
  );
}

/* ─── Droppable Column ─── */
function DroppableColumn({ etapa, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const ec = LEAD_ETAPA_COLORS[etapa];
  return (
    <div ref={setNodeRef} style={{ background: isOver ? "#eef2ff" : "#f8faff", border: `1px solid ${isOver ? "#818cf8" : B.border}`, borderRadius: 12, padding: 12, minHeight: 200, transition: "all 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: ec.color, background: ec.bg, border: `1px solid ${ec.border}`, borderRadius: 999, padding: "3px 10px" }}>{etapa}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: B.gray }}>{children?.length || 0}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Overlay Card (shown while dragging) ─── */
function OverlayCard({ lead }) {
  return (
    <div style={{ background: "white", border: `2px solid ${B.brand}`, borderRadius: 9, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", width: 200 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 3 }}>{lead.nome}</div>
      {lead.origem && <div style={{ fontSize: 10, color: B.gray }}>{lead.origem}</div>}
      {lead.patrimonio_estimado > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>{money(lead.patrimonio_estimado)}</div>}
    </div>
  );
}

export default function Pipeline() {
  const { leads, saveLead, deleteLead, radar, saveRadar, deleteRadar, setLeads, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [view, setView] = useState("pipeline");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [subTab, setSubTab] = useState("pipeline");
  const [activeDragLead, setActiveDragLead] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event) => {
    const lead = leads.find((l) => l.id === event.active.id);
    if (lead) setActiveDragLead(lead);
  };

  const handleDragEnd = (event) => {
    setActiveDragLead(null);
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id;
    const targetEtapa = over.id;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || !LEAD_ETAPAS.includes(targetEtapa) || lead.etapa === targetEtapa) return;
    moveEtapa(leadId, targetEtapa);
  };

  // ─── Radar state ───
  const [radarModal, setRadarModal] = useState(false);
  const [radarEditId, setRadarEditId] = useState(null);
  const [radarForm, setRadarForm] = useState({ nome: "", origem: "", patrimonioEstimado: "", prioridade: "Média", observacoes: "", dataMapeamento: "", email: "", telefone: "" });
  const [radarDelConf, setRadarDelConf] = useState(null);

  const save = async () => {
    if (!form.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const isNew = !editId;
    const entry = { ...form };
    if (isNew) entry.id = huid();
    else entry.id = editId;
    await saveLead(entry, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Lead cadastrado." : "Atualizado." });
  };

  const remove = async (id) => {
    await deleteLead(id);
    setToast({ type: "success", text: "Lead removido." });
  };

  const moveEtapa = async (id, etapa) => {
    const updates = { etapa, data_ultima_interacao: today() };
    if (etapa === "Cliente") updates.convertido_em = today();
    const lead = leads.find((l) => l.id === id);
    await saveLead({ ...lead, ...updates }, false);
    setToast({ type: "success", text: `Movido para ${etapa}` });
  };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_LEAD, data_primeira_reuniao: today(), data_ultima_interacao: today() }); setModal(true); };
  const openEdit = (l) => { setEditId(l.id); setForm({ ...l }); setModal(true); };
  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fmtPhone = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0,2)})${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)})${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)})${d.slice(2,7)}-${d.slice(7)}`;
  };
  const FPhone = (k) => (e) => setForm((f) => ({ ...f, [k]: fmtPhone(e.target.value) }));

  // ─── Radar handlers ───
  const openRadarNew = () => { setRadarEditId(null); setRadarForm({ nome: "", origem: "", patrimonio_estimado: "", prioridade: "Média", observacoes: "", data_mapeamento: today(), email: "", telefone: "" }); setRadarModal(true); };
  const openRadarEdit = (r) => { setRadarEditId(r.id); setRadarForm({ ...r }); setRadarModal(true); };
  const saveRadarEntry = async () => {
    if (!radarForm.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const isNew = !radarEditId;
    const entry = { ...radarForm };
    if (isNew) entry.id = huid();
    else entry.id = radarEditId;
    await saveRadar(entry, isNew);
    setRadarModal(false);
    setToast({ type: "success", text: isNew ? "Adicionado ao Radar." : "Atualizado." });
  };
  const delRadarEntry = async (id) => {
    await deleteRadar(id);
    setRadarDelConf(null);
    setToast({ type: "success", text: "Removido do Radar." });
  };
  const moveRadarToLead = async (r) => {
    await saveLead({ id: huid(), nome: r.nome, origem: r.origem, patrimonio_estimado: r.patrimonio_estimado, notas: r.observacoes, data_primeira_reuniao: today(), data_ultima_interacao: today(), etapa: "Lead" }, true);
    await deleteRadar(r.id);
    setSubTab("pipeline");
    setToast({ type: "success", text: `${r.nome} movido para o funil!` });
  };

  // ─── Stats ───
  const ativos = leads.filter((l) => !["Cliente", "Perdido", "Nutrição"].includes(l.etapa));
  const convertidos = leads.filter((l) => l.etapa === "Cliente").length;
  const perdidos = leads.filter((l) => l.etapa === "Perdido").length;
  const nutricao = leads.filter((l) => l.etapa === "Nutrição").length;
  const taxaConv = leads.length > 0 ? Math.round((convertidos / leads.length) * 100) : 0;
  const filtered = etapaFilter === "todas" ? leads : leads.filter((l) => l.etapa === etapaFilter);

  const priorColors = { "Alta": { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }, "Média": { bg: "#fffbeb", color: "#92400e", border: "#fde68a" }, "Baixa": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" } };
  const radarSorted = [...radar].sort((a, b) => { const po = { "Alta": 0, "Média": 1, "Baixa": 2 }; return (po[a.prioridade] || 1) - (po[b.prioridade] || 1); });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Vendas" title="Pipeline" desc="Funil de leads e gestão comercial." />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView((v) => (v === "pipeline" ? "lista" : "pipeline"))} style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{view === "pipeline" ? "Lista" : "Pipeline"}</button>
          <button onClick={openNew} style={{ padding: "8px 18px", background: B.brand, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Novo Lead</button>
        </div>
      </div>

      {/* ═══ PIPELINE ═══ */}
      {(
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
            <MiniStat label="Total" value={leads.length} sub="cadastrados" />
            <MiniStat label="Ativos" value={ativos.length} sub="em andamento" />
            <MiniStat label="Clientes" value={convertidos} />
            <MiniStat label="Perdidos" value={perdidos} />
            <MiniStat label="Nutrição" value={nutricao} />
            <MiniStat label="Conversão" value={`${taxaConv}%`} sub={`${convertidos} de ${leads.length}`} />
          </div>

          {/* Etapa filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#8899bb", fontWeight: 700, textTransform: "uppercase" }}>Etapa:</span>
            <select value={etapaFilter} onChange={(e) => setEtapaFilter(e.target.value)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: B.navy, outline: "none", cursor: "pointer" }}>
              <option value="todas">Todas ({leads.length})</option>
              {LEAD_ETAPAS.map((e) => (
                <option key={e} value={e}>{e} ({leads.filter((l) => l.etapa === e).length})</option>
              ))}
            </select>
          </div>

          {view === "pipeline" ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {/* Funil principal */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEAD_ETAPAS_MAIN.length}, 1fr)`, gap: 12, alignItems: "start", marginBottom: 16 }}>
                {LEAD_ETAPAS_MAIN.map((etapa) => {
                  const etapaLeads = leads.filter((l) => l.etapa === etapa);
                  return (
                    <DroppableColumn key={etapa} etapa={etapa}>
                      {etapaLeads.map((l) => (
                        <DraggableLeadCard key={l.id} lead={l} openEdit={openEdit} moveEtapa={moveEtapa} />
                      ))}
                      {etapaLeads.length === 0 && <div style={{ padding: "20px 0", textAlign: "center", color: "#c4c9d4", fontSize: 11 }}>Nenhum lead</div>}
                    </DroppableColumn>
                  );
                })}
              </div>
              {/* Saídas alternativas */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.08em" }}>Saídas alternativas</span>
                <div style={{ flex: 1, height: 1, background: "#e5e7ef" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEAD_ETAPAS_EXIT.length}, 1fr)`, gap: 12, alignItems: "start" }}>
                {LEAD_ETAPAS_EXIT.map((etapa) => {
                  const etapaLeads = leads.filter((l) => l.etapa === etapa);
                  return (
                    <DroppableColumn key={etapa} etapa={etapa}>
                      {etapaLeads.map((l) => (
                        <DraggableLeadCard key={l.id} lead={l} openEdit={openEdit} moveEtapa={moveEtapa} />
                      ))}
                      {etapaLeads.length === 0 && <div style={{ padding: "20px 0", textAlign: "center", color: "#c4c9d4", fontSize: 11 }}>Nenhum lead</div>}
                    </DroppableColumn>
                  );
                })}
              </div>
              <DragOverlay>{activeDragLead ? <OverlayCard lead={activeDragLead} /> : null}</DragOverlay>
            </DndContext>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#f5f7ff" }}>{["Nome", "Origem", "Patrimônio", "Etapa", "1ª Reunião", ""].map((h) => (<th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum lead</td></tr>}
                    {filtered.map((l, i) => {
                      const ec = LEAD_ETAPA_COLORS[l.etapa] || {};
                      return (
                        <tr key={l.id} onClick={() => openEdit(l)} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff", cursor: "pointer" }}>
                          <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar nome={l.nome} size={28} /><span style={{ fontWeight: 700, color: B.navy }}>{l.nome}</span></div></td>
                          <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{l.origem || "—"}</td>
                          <td style={{ padding: "11px 14px", fontWeight: 600, color: "#16a34a" }}>{l.patrimonio_estimado ? money(l.patrimonio_estimado) : "—"}</td>
                          <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color, border: `1px solid ${ec.border || B.border}` }}>{l.etapa}</span></td>
                          <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{fmtDate(l.data_primeira_reuniao)}</td>
                          <td style={{ padding: "11px 14px" }}><button onClick={(e) => { e.stopPropagation(); remove(l.id); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>Remover</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══ RADAR TAB ═══ */}
      {/* ═══ MODAL LEAD ═══ */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Lead" : "Novo Lead"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome *" value={form.nome} onChange={F("nome")} placeholder="Nome do lead" /></div>
            <Inp label="Telefone" value={form.telefone || ""} onChange={FPhone("telefone")} placeholder="(00)99999-9999" />
            <Inp label="E-mail" value={form.email || ""} onChange={F("email")} />
            <Sel label="Origem" value={form.origem || "Indicação"} onChange={F("origem")} opts={LEAD_ORIGENS.map((o) => ({ v: o, l: o }))} />
            <Inp label="Patrimônio Estimado (R$)" type="number" value={form.patrimonio_estimado || ""} onChange={F("patrimonio_estimado")} />
            <Sel label="Temperatura" value={form.temperatura || "morna"} onChange={F("temperatura")} opts={LEAD_TEMPERATURAS.map((t) => ({ v: t.v, l: t.l }))} />
            <Sel label="Tipo Reunião" value={form.tipo_reuniao || ""} onChange={F("tipo_reuniao")} opts={[{ v: "", l: "—" }, ...TIPO_REUNIAO.map((t) => ({ v: t.v, l: t.l }))]} />
            <Sel label="Etapa" value={form.etapa || "Lead"} onChange={F("etapa")} opts={LEAD_ETAPAS.map((e) => ({ v: e, l: e }))} />
            <Inp label="Data 1ª Reunião" type="date" value={form.data_primeira_reuniao || ""} onChange={F("data_primeira_reuniao")} />
            <Inp label="Última Interação" type="date" value={form.data_ultima_interacao || ""} onChange={F("data_ultima_interacao")} />
            {(form.etapa === "Perdido" || form.etapa === "Nutrição") && <div style={{ gridColumn: "1/-1" }}><Inp label="Motivo" value={form.motivo_negativa || ""} onChange={F("motivo_negativa")} /></div>}
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Notas" value={form.notas || ""} onChange={F("notas")} placeholder="Registre tudo sobre o lead..." /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Excluir</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CADASTRAR"}</button>
          </div>
        </div>
      </Modal>

    </>
  );
}
