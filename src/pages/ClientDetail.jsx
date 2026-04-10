import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, calcIdade, daysSince, getPeriodDays, getReuniaoStatusDynamic, getLiquidezAtual, huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { SBadge, PBadge, CBadge } from "../components/ui/Badge";
import { InlineText, InlineDate } from "../components/ui/InlineEdit";
import { SecH, Inp, Sel, Tarea } from "../components/ui/FormFields";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, history, aportes, reunioes, saveClient, deleteClient, saveReuniao, deleteReuniao, saveAporte, setToast } = useData();

  const client = clients.find((c) => c.id === id);

  // ─── Reunião modal ───
  const [rhModal, setRhModal] = useState(false);
  const [rhEditId, setRhEditId] = useState(null);
  const [rhForm, setRhForm] = useState({ client_id: "", data: "", texto: "" });

  // ─── Aporte modal ───
  const [aptModal, setAptModal] = useState(false);
  const [aptForm, setAptForm] = useState({ client_id: "", data: "", tipo: "aporte", valor: "", observacao: "", is_reserva: false, is_pgbl: false });

  if (!client) return (
    <div style={{ padding: 40, textAlign: "center", color: B.gray }}>
      Cliente não encontrado. <button onClick={() => navigate("/clients")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Voltar</button>
    </div>
  );

  const updateField = async (field, value) => {
    await saveClient({ ...client, [field]: value }, false);
  };

  const pl = getCurrentPL(client, history);
  const curva = getCurva(pl);
  const idade = calcIdade(client.data_nascimento || client.dataNascimento);
  const dR = daysSince(client.ultima_reuniao || client.ultimaReuniao);
  const periodDays = getPeriodDays(client.periodicidade_reuniao || client.periodicidadeReuniao);
  const reuniaoStatus = getReuniaoStatusDynamic(dR, periodDays);
  const liqAtual = getLiquidezAtual(client, aportes);

  const clientAportes = aportes.filter((a) => a.client_id === id).sort((a, b) => b.data.localeCompare(a.data));
  const totalAp = clientAportes.filter((a) => a.tipo === "aporte").reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalRe = clientAportes.filter((a) => a.tipo === "resgate").reduce((s, a) => s + Number(a.valor || 0), 0);

  const clientReunioes = reunioes.filter((r) => r.client_id === id).sort((a, b) => b.data.localeCompare(a.data));

  // Grupo
  const grupoNome = client.grupo_nome || client.grupoNome;
  const grupoMembers = grupoNome ? clients.filter((c) => (c.grupo_nome || c.grupoNome) === grupoNome && c.id !== id) : [];

  // Handlers
  const saveRhEntry = async () => {
    if (!rhForm.data || !rhForm.texto.trim()) { setToast({ type: "error", text: "Preencha data e registro." }); return; }
    const isNew = !rhEditId;
    const entry = { ...rhForm, client_id: id };
    if (isNew) entry.id = huid();
    else entry.id = rhEditId;
    await saveReuniao(entry, isNew);
    setRhModal(false);
    setToast({ type: "success", text: isNew ? "Registrado." : "Atualizado." });
    // Atualizar ultima_reuniao do cliente
    if (isNew) await updateField("ultima_reuniao", rhForm.data);
  };

  const saveAptEntry = async () => {
    if (!aptForm.data || !aptForm.valor) { setToast({ type: "error", text: "Preencha data e valor." }); return; }
    const entry = { ...aptForm, client_id: id, id: huid(), valor: Number(aptForm.valor) };
    await saveAporte(entry, true);
    setAptModal(false);
    setToast({ type: "success", text: "Registrado." });
  };

  const hasSeguro = client.seguro_vida || client.seguroVida;
  const hasDesbalanceado = client.cliente_desbalanceado || client.clienteDesbalanceado;
  const obsRapida = client.observacao_rapida || client.observacaoRapida;

  return (
    <>
      <button onClick={() => navigate("/clients")} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>← Voltar</button>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #1D3557, #264773)`, borderRadius: 11, padding: "18px 22px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar nome={client.nome} size={48} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{client.nome}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{client.profissao}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
              <SBadge s={client.status} />
              <PBadge p={client.perfil} />
              <CBadge curva={curva} />
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: reuniaoStatus.bg, color: reuniaoStatus.color }}>{reuniaoStatus.label}</span>
              {hasSeguro && <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.12)", color: "white", padding: "2px 9px", borderRadius: 999 }}>🛡 Seguro</span>}
              {hasDesbalanceado && <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(220,38,38,0.25)", color: "#fca5a5", padding: "2px 9px", borderRadius: 999 }}>⚠ Desbalanceado</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase" }}>PL Atual</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(pl)}</div>
        </div>
      </div>

      {/* Alerta */}
      {obsRapida && (
        <div style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "2px solid #f59e0b", borderRadius: 9, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div><div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase" }}>Atenção</div><p style={{ margin: 0, fontSize: 12, color: "#78350f" }}>{obsRapida}</p></div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Dados Pessoais */}
        <Card style={{ gridColumn: "1/-1" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between" }}>
            <span>👤 Dados Pessoais</span>
            <span style={{ fontSize: 10, color: "#8899bb", fontWeight: 400 }}>clique para editar</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            {[["Cidade", "cidade"], ["UF", "uf"], ["Estado Civil", "estado_civil"], ["Profissão", "profissao"], ["Origem", "origem_cliente"], ["Corretoras", "corretoras"]].map(([lbl, field]) => (
              <div key={field}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>{lbl}</div><InlineText value={client[field]} onSave={(v) => updateField(field, v)} /></div>
            ))}
            {idade !== null && <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Idade</div><span style={{ fontSize: 12, fontWeight: 600 }}>{idade} anos</span></div>}
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Início Carteira</div><InlineDate value={client.inicio_carteira} onSave={(v) => updateField("inicio_carteira", v)} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: `1px solid ${B.border}` }}>
            {[["envio_ips", "IPS"], ["seguro_vida", "Seguro"], ["pgbl", "PGBL"], ["vgbl", "VGBL"], ["sucessao", "Sucessão"]].map(([field, lbl]) => (
              <div key={field} onClick={() => updateField(field, !client[field])} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, border: `1px solid ${client[field] ? "#bbf7d0" : "#e5e7eb"}`, background: client[field] ? "#f0fdf4" : "#f9fafb", cursor: "pointer" }}>
                <span style={{ fontSize: 13 }}>{client[field] ? "✅" : "⬜"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: client[field] ? "#16a34a" : "#6b7280" }}>{lbl}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Grupo PJ+PF */}
        {grupoMembers.length > 0 && (
          <Card style={{ gridColumn: "1/-1", background: "#f5f3ff", border: "2px solid #ddd6fe" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#7c3aed", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #ddd6fe" }}>🔗 Contas vinculadas — {grupoNome}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[client, ...grupoMembers].map((c) => (
                <div key={c.id} onClick={() => c.id !== id && navigate(`/clients/${c.id}`)} style={{ background: "white", border: "1px solid #ddd6fe", borderRadius: 9, padding: "10px 14px", cursor: c.id !== id ? "pointer" : "default", flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#7c3aed" }}>{c.nome}{c.id === id && <span style={{ fontSize: 10, color: "#a78bfa", marginLeft: 6 }}>(esta)</span>}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{c.profissao || "—"}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Agenda */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>🗓️ Agenda</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Última Reunião</div><InlineDate value={client.ultima_reuniao} onSave={(v) => updateField("ultima_reuniao", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Próxima</div><InlineDate value={client.proxima_reuniao} onSave={(v) => updateField("proxima_reuniao", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Periodicidade</div><InlineText value={client.periodicidade_reuniao || "Trimestral"} onSave={(v) => updateField("periodicidade_reuniao", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Último Relatório</div><InlineDate value={client.ultimo_relatorio} onSave={(v) => updateField("ultimo_relatorio", v)} /></div>
          </div>
        </Card>

        {/* Contrato */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📋 Contrato</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Taxa</div><InlineText value={client.taxa_contratada} onSave={(v) => updateField("taxa_contratada", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Pagamento</div><InlineText value={client.forma_pagamento} onSave={(v) => updateField("forma_pagamento", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>IR</div><InlineText value={client.declaracao_ir} onSave={(v) => updateField("declaracao_ir", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Mínimo</div><InlineText value={client.valor_minimo_contrato} onSave={(v) => updateField("valor_minimo_contrato", v)} /></div>
          </div>
        </Card>
      </div>

      {/* Aportes */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between" }}>
          <span>💰 Aportes e Resgates</span>
          <button onClick={() => { setAptForm({ client_id: id, data: today(), tipo: "aporte", valor: "", observacao: "", is_reserva: false, is_pgbl: false }); setAptModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Registrar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Aportado</div><div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{money(totalAp)}</div></div>
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Resgatado</div><div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{money(totalRe)}</div></div>
          <div style={{ background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Reserva</div><div style={{ fontSize: 14, fontWeight: 700, color: B.navy }}>{money(liqAtual)}</div></div>
        </div>
        {clientAportes.length === 0 ? <div style={{ padding: 12, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma movimentação.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {clientAportes.slice(0, 10).map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: a.tipo === "aporte" ? "#f0fdf4" : "#fff5f5", border: `1px solid ${a.tipo === "aporte" ? "#dcfce7" : "#fee2e2"}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626" }}>{a.tipo === "aporte" ? "📥" : "📤"}</span>
                  <span style={{ fontSize: 11, color: B.gray }}>{fmtDate(a.data)}</span>
                  {a.observacao && <span style={{ fontSize: 10, color: "#9baabf", fontStyle: "italic" }}>{a.observacao}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626" }}>{a.tipo === "aporte" ? "+" : "-"}{money(a.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reuniões */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between" }}>
          <span>📓 Histórico de Reuniões ({clientReunioes.length})</span>
          <button onClick={() => { setRhEditId(null); setRhForm({ client_id: id, data: today(), texto: "" }); setRhModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Registrar</button>
        </div>
        {clientReunioes.length === 0 ? <div style={{ padding: 16, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum registro.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clientReunioes.map((r) => (
              <div key={r.id} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 9, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>📅 {fmtDate(r.data)}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => { setRhEditId(r.id); setRhForm({ ...r }); setRhModal(true); }} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 5, padding: "3px 9px", fontSize: 10, cursor: "pointer" }}>✏</button>
                    <button onClick={async () => { await deleteReuniao(r.id); setToast({ type: "success", text: "Removido." }); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 9px", fontSize: 10, cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#445566", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r.texto}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notas Gerais */}
      <Card style={{ marginBottom: 12, border: "2px solid #e0e7ff", background: "#fafbff" }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #e0e7ff" }}>🗒️ Informações Gerais</div>
        <InlineText value={client.notas_gerais} onSave={(v) => updateField("notas_gerais", v)} placeholder="Clique para adicionar informações gerais..." multiline style={{ width: "100%", minHeight: 60 }} />
      </Card>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => navigate("/reports")} style={{ padding: "9px 18px", background: B.brand, color: "white", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ver Evolução →</button>
        <button onClick={async () => { await updateField("status", "inativo"); navigate("/clients"); setToast({ type: "success", text: "Arquivado." }); }} style={{ padding: "9px 18px", background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗄 Arquivar</button>
        <button onClick={async () => { if (confirm("Remover permanentemente?")) { await deleteClient(id); navigate("/clients"); setToast({ type: "success", text: "Removido." }); } }} style={{ padding: "9px 18px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑 Remover</button>
      </div>

      {/* Modal Reunião */}
      <Modal open={rhModal} onClose={() => setRhModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: B.navy }}>{rhEditId ? "Editar Registro" : "Nova Reunião"}</h3>
          <Inp label="Data *" type="date" value={rhForm.data} onChange={(e) => setRhForm((f) => ({ ...f, data: e.target.value }))} />
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Registro *</label>
            <textarea value={rhForm.texto} onChange={(e) => setRhForm((f) => ({ ...f, texto: e.target.value }))} rows={8} placeholder="O que foi discutido..." style={{ width: "100%", boxSizing: "border-box", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "10px 13px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.7 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRhModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveRhEntry} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>{rhEditId ? "SALVAR" : "REGISTRAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Modal Aporte */}
      <Modal open={aptModal} onClose={() => setAptModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: B.navy }}>Novo Aporte / Resgate</h3>
          <Inp label="Data *" type="date" value={aptForm.data} onChange={(e) => setAptForm((f) => ({ ...f, data: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginBottom: 13 }}>
            {["aporte", "resgate"].map((t) => (
              <button key={t} onClick={() => setAptForm((f) => ({ ...f, tipo: t }))} style={{ flex: 1, padding: "9px", border: `2px solid ${aptForm.tipo === t ? (t === "aporte" ? "#16a34a" : "#dc2626") : B.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, background: aptForm.tipo === t ? (t === "aporte" ? "#f0fdf4" : "#fff5f5") : "white", color: aptForm.tipo === t ? (t === "aporte" ? "#16a34a" : "#dc2626") : B.gray }}>{t === "aporte" ? "📥 Aporte" : "📤 Resgate"}</button>
            ))}
          </div>
          <Inp label="Valor (R$) *" type="number" value={aptForm.valor} onChange={(e) => setAptForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0" />
          <Inp label="Observação" value={aptForm.observacao} onChange={(e) => setAptForm((f) => ({ ...f, observacao: e.target.value }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAptModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveAptEntry} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>REGISTRAR</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
