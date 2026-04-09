import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { B, PERFIL_MAP } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, calcIdade, daysSince, getPeriodDays, getReuniaoStatusDynamic, getLiquidezAtual } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import { SBadge, PBadge, CBadge } from "../components/ui/Badge";
import { InlineText, InlineDate } from "../components/ui/InlineEdit";
import { SecH } from "../components/ui/FormFields";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState([]);
  const [aportes, setAportes] = useState([]);
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [c, h, a, r] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("history").select("*").eq("client_id", id).order("data", { ascending: false }),
        supabase.from("aportes").select("*").eq("client_id", id).order("data", { ascending: false }),
        supabase.from("reunioes_hist").select("*").eq("client_id", id).order("data", { ascending: false }),
      ]);
      setClient(c.data);
      setHistory(h.data || []);
      setAportes(a.data || []);
      setReunioes(r.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const updateField = async (field, value) => {
    await supabase.from("clients").update({ [field]: value }).eq("id", id);
    setClient((c) => ({ ...c, [field]: value }));
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Carregando...</div>;
  if (!client) return <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Cliente não encontrado. <button onClick={() => navigate("/clients")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Voltar</button></div>;

  const pl = getCurrentPL(client, history);
  const curva = getCurva(pl);
  const idade = calcIdade(client.data_nascimento);
  const dR = daysSince(client.ultima_reuniao);
  const periodDays = getPeriodDays(client.periodicidade_reuniao);
  const reuniaoStatus = getReuniaoStatusDynamic(dR, periodDays);
  const liqAtual = getLiquidezAtual(client, aportes);

  const totalAp = aportes.filter((a) => a.tipo === "aporte").reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalRe = aportes.filter((a) => a.tipo === "resgate").reduce((s, a) => s + Number(a.valor || 0), 0);

  return (
    <>
      <button onClick={() => navigate("/clients")} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>← Voltar para clientes</button>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${B.navy}, ${B.navy2})`, borderRadius: 11, padding: "18px 22px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase" }}>PL Atual</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(pl)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Dados Pessoais */}
        <Card style={{ gridColumn: "1/-1" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>👤 Dados Pessoais</div>
          {client.observacao_rapida && (
            <div style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "2px solid #f59e0b", borderRadius: 9, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <div><div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase" }}>Atenção</div><p style={{ margin: 0, fontSize: 12, color: "#78350f" }}>{client.observacao_rapida}</p></div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[["Cidade", "cidade"], ["UF", "uf"], ["Estado Civil", "estado_civil"], ["Profissão", "profissao"], ["Origem", "origem_cliente"], ["Corretoras", "corretoras"]].map(([lbl, field]) => (
              <div key={field}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>{lbl}</div>
                <InlineText value={client[field]} onSave={(v) => updateField(field, v)} />
              </div>
            ))}
            {idade !== null && <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Idade</div><span style={{ fontSize: 12, fontWeight: 600 }}>{idade} anos</span></div>}
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Início Carteira</div><InlineDate value={client.inicio_carteira} onSave={(v) => updateField("inicio_carteira", v)} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, marginTop: 10, borderTop: `1px solid ${B.border}` }}>
            {[["envio_ips", "IPS"], ["seguro_vida", "Seguro"], ["pgbl", "PGBL"], ["vgbl", "VGBL"], ["sucessao", "Sucessão"]].map(([field, lbl]) => (
              <div key={field} onClick={() => updateField(field, !client[field])} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999, border: `1px solid ${client[field] ? "#bbf7d0" : "#e5e7eb"}`, background: client[field] ? "#f0fdf4" : "#f9fafb", cursor: "pointer" }}>
                <span style={{ fontSize: 13 }}>{client[field] ? "✅" : "⬜"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: client[field] ? "#16a34a" : "#6b7280" }}>{lbl}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Agenda */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>🗓️ Agenda</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Última Reunião</div><InlineDate value={client.ultima_reuniao} onSave={(v) => updateField("ultima_reuniao", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Próxima Reunião</div><InlineDate value={client.proxima_reuniao} onSave={(v) => updateField("proxima_reuniao", v)} /></div>
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
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Declaração IR</div><InlineText value={client.declaracao_ir} onSave={(v) => updateField("declaracao_ir", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Valor Mínimo</div><InlineText value={client.valor_minimo_contrato} onSave={(v) => updateField("valor_minimo_contrato", v)} /></div>
          </div>
        </Card>
      </div>

      {/* Aportes */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>💰 Aportes e Resgates</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Aportado</div><div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{money(totalAp)}</div></div>
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Resgatado</div><div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{money(totalRe)}</div></div>
          <div style={{ background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Reserva</div><div style={{ fontSize: 14, fontWeight: 700, color: B.navy }}>{money(liqAtual)}</div></div>
        </div>
        {aportes.length === 0 ? <div style={{ padding: 12, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma movimentação.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {aportes.slice(0, 10).map((a) => (
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
      <Card>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📓 Histórico de Reuniões ({reunioes.length})</div>
        {reunioes.length === 0 ? <div style={{ padding: 16, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum registro.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reunioes.map((r) => (
              <div key={r.id} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 9, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, marginBottom: 6 }}>📅 {fmtDate(r.data)}</div>
                <p style={{ margin: 0, fontSize: 12, color: "#445566", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r.texto}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
