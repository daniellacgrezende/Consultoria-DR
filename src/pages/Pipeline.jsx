import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useData } from "../hooks/useData";
import { B, LEAD_ETAPAS, LEAD_ETAPAS_MAIN, LEAD_ETAPAS_EXIT, LEAD_ETAPA_COLORS, LEAD_ORIGENS, EMPTY_LEAD, LEAD_TEMPERATURAS, TIPO_REUNIAO } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { huid, today, daysSince } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

/* ─── Temperature config ─── */
const TEMP_MAP = {
  fria:   { bg: "#EFF6FF", color: "#1D4ED8", dot: "#3B82F6", label: "Fria" },
  morna:  { bg: "#FFFBEB", color: "#92400E", dot: "#F59E0B", label: "Morna" },
  quente: { bg: "#FEF2F2", color: "#991B1B", dot: "#EF4444", label: "Quente" },
};

/* ─── Days badge ─── */
function DaysBadge({ date }) {
  if (!date) return null;
  const d = daysSince(date);
  if (d === null) return null;
  const warn = d > 21;
  const crit = d > 45;
  const bg    = crit ? "#FEF2F2" : warn ? "#FFFBEB" : "#F0FDF4";
  const color = crit ? "#DC2626" : warn ? "#B45309" : "#15803D";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: bg, color, borderRadius: 999, padding: "2px 7px" }}>
      {d === 0 ? "hoje" : `${d}d`}
    </span>
  );
}

/* ─── Lead Card (draggable) ─── */
function DraggableLeadCard({ lead, openEdit, moveEtapa }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id, data: { lead },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const tc = lead.temperatura ? TEMP_MAP[lead.temperatura] : null;
  const patrimonio = Number(lead.patrimonio_estimado || 0);
  const isExit = ["Cliente", "Perdido", "Nutrição"].includes(lead.etapa);
  const dias = daysSince(lead.data_ultima_interacao);
  const stale = dias !== null && dias > 21;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => openEdit(lead)}
        style={{
          background: "white",
          border: `1px solid ${stale ? "#FDE68A" : B.border}`,
          borderLeft: `3px solid ${tc ? tc.dot : B.border}`,
          borderRadius: 8,
          padding: "12px 13px",
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          transition: "box-shadow 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.09)")}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)")}
      >
        {/* Row 1: name + days */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <Avatar nome={lead.nome} size={26} />
            <span style={{ fontWeight: 700, fontSize: 12.5, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {lead.nome}
            </span>
          </div>
          <DaysBadge date={lead.data_ultima_interacao} />
        </div>

        {/* Row 2: patrimônio */}
        {patrimonio > 0 && (
          <div style={{ fontSize: 14, fontWeight: 800, color: "#15803D", marginBottom: 5, letterSpacing: "-0.4px" }}>
            {money(patrimonio)}
          </div>
        )}

        {/* Row 3: origem + temperatura */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: !isExit ? 8 : 0 }}>
          {lead.origem && (
            <span style={{ fontSize: 10, color: B.muted, background: "#F8FAFF", border: `1px solid ${B.border}`, borderRadius: 4, padding: "1px 6px" }}>
              {lead.origem}
            </span>
          )}
          {tc && (
            <span style={{ fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.color, borderRadius: 999, padding: "1px 7px", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: tc.dot, display: "inline-block" }} />
              {tc.label}
            </span>
          )}
        </div>

        {/* Row 4: quick actions */}
        {!isExit && (
          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Cliente"); }}
              style={{ flex: 1, fontSize: 9.5, fontWeight: 700, background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", borderRadius: 5, padding: "4px 0", cursor: "pointer" }}
            >✓ Converter</button>
            <button
              onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Perdido"); }}
              style={{ flex: 1, fontSize: 9.5, fontWeight: 700, background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3", borderRadius: 5, padding: "4px 0", cursor: "pointer" }}
            >✕ Perdido</button>
            <button
              onClick={(e) => { e.stopPropagation(); moveEtapa(lead.id, "Nutrição"); }}
              style={{ flex: 1, fontSize: 9.5, fontWeight: 700, background: "#FEFCE8", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 5, padding: "4px 0", cursor: "pointer" }}
            >↻ Nutrir</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Column (droppable) ─── */
function PipelineColumn({ etapa, leads, openEdit, moveEtapa }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const ec = LEAD_ETAPA_COLORS[etapa];
  const totalPatrimonio = leads.reduce((s, l) => s + Number(l.patrimonio_estimado || 0), 0);
  const staleCount = leads.filter((l) => {
    const d = daysSince(l.data_ultima_interacao);
    return d !== null && d > 21;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Column header */}
      <div style={{
        background: isOver ? "#EEF2FF" : "#FAFBFF",
        border: `1px solid ${isOver ? "#818CF8" : B.border}`,
        borderTop: `3px solid ${ec.color}`,
        borderRadius: "10px 10px 0 0",
        padding: "10px 12px",
        marginBottom: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ec.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {etapa}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color,
            border: `1px solid ${ec.border}`, borderRadius: 999, padding: "1px 8px", minWidth: 20, textAlign: "center"
          }}>
            {leads.length}
          </span>
        </div>
        {totalPatrimonio > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: B.navy }}>
            {money(totalPatrimonio)}
          </div>
        )}
        {staleCount > 0 && (
          <div style={{ fontSize: 9.5, color: "#B45309", marginTop: 2 }}>
            ⚠ {staleCount} sem contato
          </div>
        )}
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? "#F5F7FF" : "#F2F4FB",
          border: `1px solid ${isOver ? "#818CF8" : B.border}`,
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          padding: "10px 8px",
          minHeight: 160,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          transition: "background 0.15s",
        }}
      >
        {leads.map((l) => (
          <DraggableLeadCard key={l.id} lead={l} openEdit={openEdit} moveEtapa={moveEtapa} />
        ))}
        {leads.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#C4CBD8", fontSize: 11 }}>
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Exit Column — mesma estrutura da PipelineColumn, visual atenuado ─── */
function ExitColumn({ etapa, leads, openEdit, moveEtapa }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const ec = LEAD_ETAPA_COLORS[etapa];
  const totalPatrimonio = leads.reduce((s, l) => s + Number(l.patrimonio_estimado || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* header igual ao PipelineColumn */}
      <div style={{
        background: isOver ? "#FFF7ED" : "#FAFAFA",
        border: `1px solid ${isOver ? ec.color : B.border}`,
        borderTop: `3px solid ${ec.color}`,
        borderRadius: "10px 10px 0 0",
        padding: "10px 12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ec.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{etapa}</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`, borderRadius: 999, padding: "1px 8px", minWidth: 20, textAlign: "center" }}>{leads.length}</span>
        </div>
        {totalPatrimonio > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: B.navy }}>{money(totalPatrimonio)}</div>
        )}
      </div>

      {/* drop area */}
      <div
        ref={setNodeRef}
        style={{
          background: isOver ? "#FFF7ED" : "#F7F7F7",
          border: `1px solid ${isOver ? ec.color : B.border}`, borderTop: "none",
          borderRadius: "0 0 10px 10px",
          padding: "10px 8px",
          minHeight: 160,
          display: "flex", flexDirection: "column", gap: 8,
          flex: 1,
          transition: "background 0.15s",
        }}
      >
        {leads.map((l) => (
          <DraggableLeadCard key={l.id} lead={l} openEdit={openEdit} moveEtapa={moveEtapa} />
        ))}
        {leads.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#C4CBD8", fontSize: 11 }}>Nenhum lead</div>
        )}
      </div>
    </div>
  );
}

/* ─── Drag overlay ─── */
function OverlayCard({ lead }) {
  const tc = lead.temperatura ? TEMP_MAP[lead.temperatura] : null;
  return (
    <div style={{
      background: "white", border: `2px solid ${B.brand}`,
      borderLeft: `4px solid ${tc ? tc.dot : B.brand}`,
      borderRadius: 8, padding: "11px 13px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)", width: 210,
    }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: B.navy, marginBottom: 3 }}>{lead.nome}</div>
      {Number(lead.patrimonio_estimado) > 0 && (
        <div style={{ fontSize: 13, fontWeight: 800, color: "#15803D" }}>{money(lead.patrimonio_estimado)}</div>
      )}
    </div>
  );
}

/* ─── Summary Bar (replaces MiniStats) ─── */
function PipelineSummaryBar({ leads }) {
  const ativos = leads.filter((l) => !["Cliente", "Perdido", "Nutrição"].includes(l.etapa));
  const convertidos = leads.filter((l) => l.etapa === "Cliente").length;
  const quentes = leads.filter((l) => l.temperatura === "quente" && !["Cliente", "Perdido", "Nutrição"].includes(l.etapa)).length;
  const taxaConv = leads.length > 0 ? Math.round((convertidos / leads.length) * 100) : 0;
  const totalPipeline = ativos.reduce((s, l) => s + Number(l.patrimonio_estimado || 0), 0);
  const stale = ativos.filter((l) => { const d = daysSince(l.data_ultima_interacao); return d !== null && d > 21; }).length;

  const items = [
    { label: "Em andamento", value: ativos.length, color: B.navy },
    { label: "Pipeline est.", value: totalPipeline > 0 ? money(totalPipeline) : "—", color: "#15803D" },
    { label: "Quentes", value: quentes, color: "#EF4444" },
    { label: "Sem contato +21d", value: stale, color: stale > 0 ? "#B45309" : B.muted, warn: stale > 0 },
    { label: "Convertidos", value: convertidos, color: "#15803D" },
    { label: "Taxa conv.", value: `${taxaConv}%`, color: B.navy },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: "white", border: `1px solid ${B.border}`,
      borderRadius: 10, marginBottom: 16, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          flex: 1, padding: "10px 14px",
          borderRight: i < items.length - 1 ? `1px solid ${B.border}` : "none",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: item.color, letterSpacing: "-0.5px", lineHeight: 1 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
export default function Pipeline() {
  const { leads, saveLead, deleteLead, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [view, setView] = useState("pipeline");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [activeDragLead, setActiveDragLead] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e) => { const l = leads.find((x) => x.id === e.active.id); if (l) setActiveDragLead(l); };
  const handleDragEnd = (e) => {
    setActiveDragLead(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || !LEAD_ETAPAS.includes(over.id) || lead.etapa === over.id) return;
    moveEtapa(active.id, over.id);
  };

  const save = async () => {
    if (!form.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const isNew = !editId;
    const entry = { ...form, id: editId || huid() };
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

  const filtered = etapaFilter === "todas" ? leads : leads.filter((l) => l.etapa === etapaFilter);

  return (
    <>
      {/* ─── Header ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Vendas" title="Pipeline" desc="Gestão consultiva de leads." />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setView((v) => (v === "pipeline" ? "lista" : "pipeline"))}
            style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {view === "pipeline" ? "Lista" : "Pipeline"}
          </button>
          <button
            onClick={openNew}
            style={{ padding: "8px 18px", background: B.brand, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            + Novo Lead
          </button>
        </div>
      </div>

      {/* ─── Summary bar (slim, no cards) ─── */}
      <PipelineSummaryBar leads={leads} />

      {/* ─── Filter (list view only) ─── */}
      {view === "lista" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: B.muted, fontWeight: 700, textTransform: "uppercase" }}>Etapa:</span>
          <select value={etapaFilter} onChange={(e) => setEtapaFilter(e.target.value)}
            style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: B.navy, outline: "none", cursor: "pointer" }}>
            <option value="todas">Todas ({leads.length})</option>
            {LEAD_ETAPAS.map((e) => (<option key={e} value={e}>{e} ({leads.filter((l) => l.etapa === e).length})</option>))}
          </select>
        </div>
      )}

      {/* ═══ PIPELINE VIEW ═══ */}
      {view === "pipeline" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Funil único: etapas principais + saídas em uma só fila horizontal */}
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${LEAD_ETAPAS_MAIN.length}, minmax(170px, 1fr)) 2px repeat(${LEAD_ETAPAS_EXIT.length}, minmax(170px, 1fr))`,
              gap: "0 10px",
              alignItems: "start",
              minWidth: 1100,
            }}>
              {/* Etapas principais */}
              {LEAD_ETAPAS_MAIN.map((etapa) => (
                <PipelineColumn
                  key={etapa}
                  etapa={etapa}
                  leads={leads.filter((l) => l.etapa === etapa)}
                  openEdit={openEdit}
                  moveEtapa={moveEtapa}
                />
              ))}

              {/* Separador vertical */}
              <div style={{ alignSelf: "stretch", background: B.border, borderRadius: 2, margin: "0 2px" }} />

              {/* Etapas de saída — mesmo nível, visual atenuado */}
              {LEAD_ETAPAS_EXIT.map((etapa) => (
                <ExitColumn
                  key={etapa}
                  etapa={etapa}
                  leads={leads.filter((l) => l.etapa === etapa)}
                  openEdit={openEdit}
                  moveEtapa={moveEtapa}
                />
              ))}
            </div>
          </div>

          <DragOverlay>{activeDragLead ? <OverlayCard lead={activeDragLead} /> : null}</DragOverlay>
        </DndContext>
      )}

      {/* ═══ LIST VIEW ═══ */}
      {view === "lista" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F5F7FF" }}>
                  {["Nome", "Patrimônio", "Temperatura", "Etapa", "Origem", "Última Interação", "Dias", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: B.muted }}>Nenhum lead</td></tr>}
                {filtered.map((l, i) => {
                  const ec = LEAD_ETAPA_COLORS[l.etapa] || {};
                  const tc = l.temperatura ? TEMP_MAP[l.temperatura] : null;
                  const dias = daysSince(l.data_ultima_interacao);
                  return (
                    <tr key={l.id} onClick={() => openEdit(l)}
                      style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#FAFBFF", cursor: "pointer" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar nome={l.nome} size={28} />
                          <span style={{ fontWeight: 700, color: B.navy }}>{l.nome}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#15803D" }}>
                        {Number(l.patrimonio_estimado) > 0 ? money(l.patrimonio_estimado) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {tc ? (
                          <span style={{ fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.color, borderRadius: 999, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: tc.dot, display: "inline-block" }} />
                            {tc.label}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color, border: `1px solid ${ec.border || B.border}` }}>
                          {l.etapa}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: B.muted, fontSize: 12 }}>{l.origem || "—"}</td>
                      <td style={{ padding: "10px 14px", color: B.muted, fontSize: 12 }}>{fmtDate(l.data_ultima_interacao) || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {dias !== null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: dias > 45 ? "#DC2626" : dias > 21 ? "#B45309" : "#15803D" }}>
                            {dias === 0 ? "hoje" : `${dias}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button onClick={(e) => { e.stopPropagation(); remove(l.id); }}
                          style={{ background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ MODAL LEAD ═══ */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Lead" : "Novo Lead"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.muted }}>×</button>
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
            {(form.etapa === "Perdido" || form.etapa === "Nutrição") && (
              <div style={{ gridColumn: "1/-1" }}><Inp label="Motivo" value={form.motivo_negativa || ""} onChange={F("motivo_negativa")} /></div>
            )}
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Notas" value={form.notas || ""} onChange={F("notas")} placeholder="Registre tudo sobre o lead..." /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Excluir</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              {editId ? "SALVAR" : "CADASTRAR"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
