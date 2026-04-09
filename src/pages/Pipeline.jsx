import { useState } from "react";
import { useData } from "../hooks/useData";
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
  const { leads, saveLead, deleteLead, radar, saveRadar, deleteRadar, setLeads, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [view, setView] = useState("pipeline");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [subTab, setSubTab] = useState("pipeline");

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
    if (etapa === "Convertido") updates.convertido_em = today();
    const lead = leads.find((l) => l.id === id);
    await saveLead({ ...lead, ...updates }, false);
    setToast({ type: "success", text: `Movido para ${etapa}` });
  };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_LEAD, data_primeira_reuniao: today(), data_ultima_interacao: today() }); setModal(true); };
  const openEdit = (l) => { setEditId(l.id); setForm({ ...l }); setModal(true); };
  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
    await saveLead({ id: huid(), nome: r.nome, origem: r.origem, patrimonio_estimado: r.patrimonio_estimado, notas: r.observacoes, data_primeira_reuniao: today(), data_ultima_interacao: today(), etapa: "1ª Reunião" }, true);
    await deleteRadar(r.id);
    setSubTab("pipeline");
    setToast({ type: "success", text: `${r.nome} movido para o funil!` });
  };

  // ─── Stats ───
  const ativos = leads.filter((l) => l.etapa !== "Convertido" && l.etapa !== "Perdido");
  const convertidos = leads.filter((l) => l.etapa === "Convertido").length;
  const perdidos = leads.filter((l) => l.etapa === "Perdido").length;
  const taxaConv = leads.length > 0 ? Math.round((convertidos / leads.length) * 100) : 0;
  const filtered = etapaFilter === "todas" ? leads : leads.filter((l) => l.etapa === etapaFilter);

  const priorColors = { "Alta": { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }, "Média": { bg: "#fffbeb", color: "#92400e", border: "#fde68a" }, "Baixa": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" } };
  const radarSorted = [...radar].sort((a, b) => { const po = { "Alta": 0, "Média": 1, "Baixa": 2 }; return (po[a.prioridade] || 1) - (po[b.prioridade] || 1); });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Pipeline & Radar" title="Gestão de Leads 🎯" desc="Funil de leads e radar de prospecção." />
        <div style={{ display: "flex", gap: 8 }}>
          {subTab === "pipeline" && (
            <>
              <button onClick={() => setView((v) => (v === "pipeline" ? "lista" : "pipeline"))} style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{view === "pipeline" ? "📋 Lista" : "📊 Pipeline"}</button>
              <button onClick={openNew} style={{ padding: "8px 18px", background: B.navy, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Novo Lead</button>
            </>
          )}
          {subTab === "radar" && <button onClick={openRadarNew} style={{ padding: "8px 18px", background: "#7c3aed", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Adicionar ao Radar</button>}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(6,24,65,0.07)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[{ id: "pipeline", label: "🎯 Funil de Leads" }, { id: "radar", label: "📡 Radar" }].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: subTab === t.id ? B.navy : "transparent", color: subTab === t.id ? "white" : "#8899bb" }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ PIPELINE TAB ═══ */}
      {subTab === "pipeline" && (
        <>
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
              return <button key={e} onClick={() => setEtapaFilter(e)} style={{ padding: "5px 14px", borderRadius: 999, border: `1px solid ${etapaFilter === e ? (ec?.border || B.navy) : "#dde4f5"}`, fontSize: 11, fontWeight: 700, cursor: "pointer", background: etapaFilter === e ? (ec?.bg || "#e8eeff") : "white", color: etapaFilter === e ? (ec?.color || B.navy) : "#8899bb" }}>{e === "todas" ? "Todos" : e} {e !== "todas" && <span style={{ opacity: 0.6 }}>({leads.filter((l) => l.etapa === e).length})</span>}</button>;
            })}
          </div>

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
                          {l.origem && <div style={{ fontSize: 10, color: B.gray, marginBottom: 4 }}>📍 {l.origem}</div>}
                          {l.patrimonio_estimado > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>{money(l.patrimonio_estimado)}</div>}
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
                          <td style={{ padding: "11px 14px" }}><button onClick={(e) => { e.stopPropagation(); remove(l.id); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑</button></td>
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
      {subTab === "radar" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <MiniStat icon="📡" label="No Radar" value={radar.length} sub="potenciais a abordar" />
            <MiniStat icon="🔴" label="Alta Prioridade" value={radar.filter((r) => r.prioridade === "Alta").length} warn={radar.filter((r) => r.prioridade === "Alta").length > 0} />
            <MiniStat icon="💼" label="AUC Mapeado" value={money(radar.reduce((s, r) => s + Number(r.patrimonio_estimado || 0), 0))} sub="patrimônio estimado" />
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${B.border}` }}><span style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>📡 Prospects ({radar.length})</span></div>
            {radarSorted.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum prospect. Clique em "+ Adicionar ao Radar".</div> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#f5f7ff" }}>{["Nome", "Origem", "AUC", "Prioridade", "Mapeado em", ""].map((h) => (<th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {radarSorted.map((r, i) => {
                      const pc = priorColors[r.prioridade] || priorColors["Média"];
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                          <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar nome={r.nome} size={28} /><div><div style={{ fontWeight: 700, color: B.navy }}>{r.nome}</div>{r.telefone && <div style={{ fontSize: 10, color: B.gray }}>📱 {r.telefone}</div>}</div></div></td>
                          <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{r.origem || "—"}</td>
                          <td style={{ padding: "11px 14px", fontWeight: 700, color: "#7c3aed" }}>{r.patrimonio_estimado ? money(r.patrimonio_estimado) : "—"}</td>
                          <td style={{ padding: "11px 14px" }}><span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{r.prioridade}</span></td>
                          <td style={{ padding: "11px 14px", color: B.gray, fontSize: 12 }}>{fmtDate(r.data_mapeamento)}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => moveRadarToLead(r)} style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>→ Funil</button>
                              <button onClick={() => openRadarEdit(r)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>✏</button>
                              <button onClick={() => setRadarDelConf(r.id)} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══ MODAL LEAD ═══ */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Lead" : "Novo Lead"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome *" value={form.nome} onChange={F("nome")} placeholder="Nome do lead" /></div>
            <Inp label="Telefone" value={form.telefone || ""} onChange={F("telefone")} />
            <Inp label="E-mail" value={form.email || ""} onChange={F("email")} />
            <Sel label="Origem" value={form.origem || "Indicação"} onChange={F("origem")} opts={LEAD_ORIGENS.map((o) => ({ v: o, l: o }))} />
            <Inp label="Patrimônio Estimado (R$)" type="number" value={form.patrimonio_estimado || ""} onChange={F("patrimonio_estimado")} />
            <Sel label="Temperatura" value={form.temperatura || "morna"} onChange={F("temperatura")} opts={LEAD_TEMPERATURAS.map((t) => ({ v: t.v, l: t.l }))} />
            <Sel label="Tipo Reunião" value={form.tipo_reuniao || ""} onChange={F("tipo_reuniao")} opts={[{ v: "", l: "—" }, ...TIPO_REUNIAO.map((t) => ({ v: t.v, l: t.l }))]} />
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
            {editId && <button onClick={() => { remove(editId); setModal(false); }} style={{ padding: "10px 16px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>🗑</button>}
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.navy, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CADASTRAR"}</button>
          </div>
        </div>
      </Modal>

      {/* ═══ MODAL RADAR ═══ */}
      <Modal open={radarModal} onClose={() => setRadarModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{radarEditId ? "Editar Prospect" : "Adicionar ao Radar 📡"}</h3>
            <button onClick={() => setRadarModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <Inp label="Nome *" value={radarForm.nome} onChange={(e) => setRadarForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome do prospect" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="E-mail" value={radarForm.email || ""} onChange={(e) => setRadarForm((f) => ({ ...f, email: e.target.value }))} />
            <Inp label="Telefone" value={radarForm.telefone || ""} onChange={(e) => setRadarForm((f) => ({ ...f, telefone: e.target.value }))} />
          </div>
          <Inp label="Origem" value={radarForm.origem || ""} onChange={(e) => setRadarForm((f) => ({ ...f, origem: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Patrimônio Estimado" type="number" value={radarForm.patrimonio_estimado || ""} onChange={(e) => setRadarForm((f) => ({ ...f, patrimonio_estimado: e.target.value }))} />
            <Inp label="Data Mapeamento" type="date" value={radarForm.data_mapeamento || ""} onChange={(e) => setRadarForm((f) => ({ ...f, data_mapeamento: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 6 }}>Prioridade</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Alta", "Média", "Baixa"].map((p) => {
                const colors = { "Alta": ["#fef2f2", "#dc2626", "#fecaca"], "Média": ["#fffbeb", "#92400e", "#fde68a"], "Baixa": ["#f0fdf4", "#16a34a", "#bbf7d0"] }[p];
                return <button key={p} type="button" onClick={() => setRadarForm((f) => ({ ...f, prioridade: p }))} style={{ flex: 1, padding: "9px", border: `2px solid ${radarForm.prioridade === p ? colors[2] : "#dde4f5"}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, background: radarForm.prioridade === p ? colors[0] : "white", color: radarForm.prioridade === p ? colors[1] : "#8899bb" }}>{p}</button>;
              })}
            </div>
          </div>
          <Tarea label="Observações" value={radarForm.observacoes || ""} onChange={(e) => setRadarForm((f) => ({ ...f, observacoes: e.target.value }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRadarModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            <button onClick={saveRadarEntry} style={{ flex: 2, padding: "10px", background: "#7c3aed", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{radarEditId ? "SALVAR" : "ADICIONAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete radar */}
      <Modal open={!!radarDelConf} onClose={() => setRadarDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>⚠️ Remover do Radar?</h3>
          <p style={{ color: B.gray, fontSize: 13, marginBottom: 22 }}>Esta ação não pode ser desfeita.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRadarDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => delRadarEntry(radarDelConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
