import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { B, LEAD_ETAPAS, LEAD_ETAPA_COLORS, LEAD_ORIGENS, EMPTY_LEAD, LEAD_TEMPERATURAS, TIPO_REUNIAO } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { TempBadge } from "../components/ui/Badge";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [view, setView] = useState("pipeline");
  const [etapaFilter, setEtapaFilter] = useState("todas");

  useEffect(() => {
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data }) => setLeads(data || []));
  }, []);

  const save = async () => {
    if (!form.nome?.trim()) return;
    if (editId) {
      const { data } = await supabase.from("leads").update(form).eq("id", editId).select();
      if (data) setLeads((p) => p.map((l) => (l.id === editId ? data[0] : l)));
    } else {
      const newLead = { ...form, id: huid() };
      const { data } = await supabase.from("leads").insert(newLead).select();
      if (data) setLeads((p) => [data[0], ...p]);
    }
    setModal(false);
  };

  const remove = async (id) => {
    await supabase.from("leads").delete().eq("id", id);
    setLeads((p) => p.filter((l) => l.id !== id));
  };

  const moveEtapa = async (id, etapa) => {
    const updates = { etapa, data_ultima_interacao: today() };
    if (etapa === "Convertido") updates.convertido_em = today();
    await supabase.from("leads").update(updates).eq("id", id);
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_LEAD, dataPrimeiraReuniao: today(), dataUltimaInteracao: today() }); setModal(true); };
  const openEdit = (l) => { setEditId(l.id); setForm({ ...l }); setModal(true); };
  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const ativos = leads.filter((l) => l.etapa !== "Convertido" && l.etapa !== "Perdido");
  const convertidos = leads.filter((l) => l.etapa === "Convertido").length;
  const perdidos = leads.filter((l) => l.etapa === "Perdido").length;
  const taxaConv = leads.length > 0 ? Math.round((convertidos / leads.length) * 100) : 0;
  const filtered = etapaFilter === "todas" ? leads : leads.filter((l) => l.etapa === etapaFilter);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Pipeline" title="Funil de Vendas 🎯" desc="Gerencie seus leads e acompanhe o funil." />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView((v) => (v === "pipeline" ? "lista" : "pipeline"))} style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{view === "pipeline" ? "📋 Lista" : "📊 Pipeline"}</button>
          <button onClick={openNew} style={{ padding: "8px 18px", background: B.navy, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Novo Lead</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <MiniStat icon="🎯" label="Total" value={leads.length} sub="cadastrados" />
        <MiniStat icon="🔄" label="Ativos" value={ativos.length} sub="em andamento" />
        <MiniStat icon="✅" label="Convertidos" value={convertidos} />
        <MiniStat icon="❌" label="Perdidos" value={perdidos} />
        <MiniStat icon="📊" label="Conversão" value={`${taxaConv}%`} sub={`${convertidos} de ${leads.length}`} />
      </div>

      {/* Etapa filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#8899bb", fontWeight: 700, textTransform: "uppercase" }}>Etapa:</span>
        {["todas", ...LEAD_ETAPAS].map((e) => {
          const ec = LEAD_ETAPA_COLORS[e];
          return (
            <button key={e} onClick={() => setEtapaFilter(e)} style={{ padding: "5px 14px", borderRadius: 999, border: `1px solid ${etapaFilter === e ? (ec?.border || B.navy) : "#dde4f5"}`, fontSize: 11, fontWeight: 700, cursor: "pointer", background: etapaFilter === e ? (ec?.bg || "#e8eeff") : "white", color: etapaFilter === e ? (ec?.color || B.navy) : "#8899bb" }}>
              {e === "todas" ? "Todos" : e} {e !== "todas" && <span style={{ opacity: 0.6 }}>({leads.filter((l) => l.etapa === e).length})</span>}
            </button>
          );
        })}
      </div>

      {/* Pipeline Kanban */}
      {view === "pipeline" ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEAD_ETAPAS.length}, 1fr)`, gap: 12, alignItems: "start" }}>
          {LEAD_ETAPAS.map((etapa) => {
            const ec = LEAD_ETAPA_COLORS[etapa];
            const etapaLeads = leads.filter((l) => l.etapa === etapa);
            return (
              <div key={etapa} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: ec.color, background: ec.bg, border: `1px solid ${ec.border}`, borderRadius: 999, padding: "3px 10px" }}>{etapa}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.gray }}>{etapaLeads.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {etapaLeads.map((l) => (
                    <div key={l.id} onClick={() => openEdit(l)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 9, padding: "10px 12px", cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 3 }}>{l.nome}</div>
                      {l.temperatura && <TempBadge temp={l.temperatura} />}
                      {l.patrimonio_estimado > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginTop: 4 }}>{money(l.patrimonio_estimado)}</div>}
                      {l.origem && <div style={{ fontSize: 10, color: B.gray, marginTop: 2 }}>📍 {l.origem}</div>}
                      {etapa !== "Convertido" && etapa !== "Perdido" && (
                        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                          <button onClick={(e) => { e.stopPropagation(); moveEtapa(l.id, "Convertido"); }} style={{ flex: 1, fontSize: 9, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px", cursor: "pointer" }}>✅</button>
                          <button onClick={(e) => { e.stopPropagation(); moveEtapa(l.id, "Perdido"); }} style={{ flex: 1, fontSize: 9, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px", cursor: "pointer" }}>❌</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {etapaLeads.length === 0 && <div style={{ padding: "20px 0", textAlign: "center", color: "#c4c9d4", fontSize: 11 }}>Nenhum lead</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f5f7ff" }}>
                  {["Nome", "Origem", "Temperatura", "Patrimônio", "Etapa", "1ª Reunião", ""].map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum lead</td></tr>}
                {filtered.map((l, i) => {
                  const ec = LEAD_ETAPA_COLORS[l.etapa] || {};
                  return (
                    <tr key={l.id} onClick={() => openEdit(l)} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff", cursor: "pointer" }}>
                      <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar nome={l.nome} size={28} /><span style={{ fontWeight: 700, color: B.navy }}>{l.nome}</span></div></td>
                      <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{l.origem || "—"}</td>
                      <td style={{ padding: "11px 14px" }}>{l.temperatura && <TempBadge temp={l.temperatura} />}</td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: "#16a34a" }}>{l.patrimonio_estimado ? money(l.patrimonio_estimado) : "—"}</td>
                      <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color, border: `1px solid ${ec.border || B.border}` }}>{l.etapa}</span></td>
                      <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{fmtDate(l.data_primeira_reuniao)}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Lead */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Lead" : "Novo Lead"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={form.nome} onChange={F("nome")} placeholder="Nome do lead" /></div>
            <Inp label="Telefone" value={form.telefone || ""} onChange={F("telefone")} />
            <Inp label="E-mail" value={form.email || ""} onChange={F("email")} />
            <Sel label="Origem" value={form.origem} onChange={F("origem")} opts={LEAD_ORIGENS.map((o) => ({ v: o, l: o }))} />
            <Inp label="Patrimônio Estimado (R$)" type="number" value={form.patrimonioEstimado || form.patrimonio_estimado || ""} onChange={F("patrimonio_estimado")} />
            <Sel label="Temperatura" value={form.temperatura || "morna"} onChange={F("temperatura")} opts={LEAD_TEMPERATURAS.map((t) => ({ v: t.v, l: t.l }))} />
            <Sel label="Tipo de Reunião" value={form.tipo_reuniao || ""} onChange={F("tipo_reuniao")} opts={[{ v: "", l: "—" }, ...TIPO_REUNIAO.map((t) => ({ v: t.v, l: t.l }))]} />
            <div style={{ gridColumn: "1/-1", marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 6 }}>Etapa</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LEAD_ETAPAS.map((e) => {
                  const ec = LEAD_ETAPA_COLORS[e];
                  return <button key={e} type="button" onClick={() => setForm((f) => ({ ...f, etapa: e }))} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${form.etapa === e ? ec.border : "#dde4f5"}`, fontSize: 11, fontWeight: 700, cursor: "pointer", background: form.etapa === e ? ec.bg : "white", color: form.etapa === e ? ec.color : "#8899bb" }}>{e}</button>;
                })}
              </div>
            </div>
            <Inp label="Data 1ª Reunião" type="date" value={form.data_primeira_reuniao || ""} onChange={F("data_primeira_reuniao")} />
            <Inp label="Última Interação" type="date" value={form.data_ultima_interacao || ""} onChange={F("data_ultima_interacao")} />
            {form.etapa === "Perdido" && <div style={{ gridColumn: "1/-1" }}><Inp label="Motivo" value={form.motivo_negativa || ""} onChange={F("motivo_negativa")} /></div>}
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Notas" value={form.notas || ""} onChange={F("notas")} placeholder="Registre tudo sobre o lead..." /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>🗑 Remover</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.navy, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CADASTRAR"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
