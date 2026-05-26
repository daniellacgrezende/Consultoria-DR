import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP, EMPTY_CLIENT, LEAD_ORIGENS, PERIOD_OPTIONS, STATUS_MAP } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, calcIdade, daysSince, getPeriodDays, getReuniaoStatusDynamic, getLiquidezAtual, huid, today, slugify, addDays } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { SBadge, PBadge, CBadge } from "../components/ui/Badge";
import { InlineText, InlineDate, InlineSelect, InlineMoney } from "../components/ui/InlineEdit";
import { SecH, Inp, Sel, Tarea } from "../components/ui/FormFields";

export default function ClientDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clients, history, aportes, reunioes, saveClient, deleteClient, saveReuniao, deleteReuniao, saveAporte, deleteAporte, incrementLiquidez, saveTodo, setToast } = useData();

  const client = clients.find((c) => slugify(c.nome) === slug || c.id === slug);
  const id = client?.id;

  // ─── Edit modal ───
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSection, setEditSection] = useState(null); // null=tudo | "dados" | "financeiro"
  const openEditModal = (section) => { setEditForm({ ...client }); setEditSection(section || null); setEditModal(true); };
  const EF = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const saveEdit = async () => {
    if (!editForm.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const f = { ...editForm, id: client.id };
    if (f.ultima_reuniao) f.proxima_reuniao = addDays(f.ultima_reuniao, getPeriodDays(f.periodicidade_reuniao || "Trimestral"));
    if (f.ultimo_relatorio) { const pd = getPeriodDays(f.periodicidade_relatorio || "Mensal"); if (isFinite(pd)) f.proximo_relatorio = addDays(f.ultimo_relatorio, pd); else f.proximo_relatorio = ""; }
    await saveClient(f, false);
    setEditModal(false);
    setToast({ type: "success", text: "Cadastro atualizado." });
    // Se o nome mudou, o slug mudou — redireciona para a URL correta
    const newSlug = slugify(editForm.nome);
    if (newSlug !== slug) navigate(`/clients/${newSlug}`, { replace: true });
  };

  // ─── Reunião modal ───
  const [rhModal, setRhModal] = useState(false);
  const [rhEditId, setRhEditId] = useState(null);
  const [rhForm, setRhForm] = useState({ client_id: "", data: "", titulo: "", texto: "" });

  // ─── Aporte modal ───
  const [aptModal, setAptModal] = useState(false);
  const [resumoModal, setResumoModal] = useState(false);
  const [liqModal, setLiqModal] = useState(false);
  const [slideModal, setSlideModal] = useState(false);
  const [slideObs, setSlideObs] = useState([]);
  const [slideObsInput, setSlideObsInput] = useState("");
  const [slideEditObs, setSlideEditObs] = useState(false);
  const [slideObjetivos, setSlideObjetivos] = useState("");
  const [aptEditId, setAptEditId] = useState(null);
  const [aptForm, setAptForm] = useState({ client_id: "", data: "", tipo: "aporte", valor: "", observacao: "", is_reserva: false, is_pgbl: false, valor_reserva: "", valor_pgbl: "" });
  const [aptHistOpen, setAptHistOpen] = useState(false);
  const [aptFilter, setAptFilter] = useState({ mode: "todos", ano: "", de: "", ate: "" });
  const [rhExpandedIds, setRhExpandedIds] = useState(new Set());
  const [rhNotesEditing, setRhNotesEditing] = useState(new Set());
  const [rhInline, setRhInline] = useState({}); // { [id]: { data, titulo, texto, dirty } }
  const [finOpen, setFinOpen] = useState(true);
  const [notasOpen, setNotasOpen] = useState(true);
  const [dgOpen, setDgOpen] = useState(true);
  const toggleRhExpand = (rid) => {
    setRhExpandedIds((prev) => { const n = new Set(prev); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });
    setRhInline((prev) => {
      if (prev[rid]) return prev;
      const r = clientReunioes.find((x) => x.id === rid);
      if (!r) return prev;
      return { ...prev, [rid]: { data: r.data || "", titulo: r.titulo || "", texto: r.texto || "", dirty: false } };
    });
  };
  const rhInlineChange = (rid, field, val) => setRhInline((prev) => ({ ...prev, [rid]: { ...prev[rid], [field]: val, dirty: true } }));
  const rhInlineSave = async (rid) => {
    const ed = rhInline[rid];
    if (!ed) return;
    const orig = clientReunioes.find((r) => r.id === rid);
    await saveReuniao({ ...orig, data: ed.data, titulo: ed.titulo, texto: ed.texto }, false);
    setRhInline((prev) => ({ ...prev, [rid]: { ...prev[rid], dirty: false } }));
    setRhNotesEditing((prev) => { const n = new Set(prev); n.delete(rid); return n; });
    setToast({ type: "success", text: "Histórico atualizado." });
  };

  if (!client) return (
    <div style={{ padding: 40, textAlign: "center", color: B.gray }}>
      Cliente não encontrado. <button onClick={() => navigate("/clients")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Voltar</button>
    </div>
  );

  const updateField = async (field, value) => {
    const updates = { [field]: value };
    let toastMsg = null;
    // Auto-calcular próxima reunião
    if (field === "ultima_reuniao" && value) {
      const pDays = getPeriodDays(client.periodicidade_reuniao || client.periodicidadeReuniao);
      updates.proxima_reuniao = addDays(value, pDays);
      toastMsg = `Próxima reunião calculada: ${updates.proxima_reuniao.split("-").reverse().join("/")}`;
    }
    // Recalcular quando periodicidade muda e já tem última reunião
    if (field === "periodicidade_reuniao" && (client.ultima_reuniao || client.ultimaReuniao)) {
      const base = client.ultima_reuniao || client.ultimaReuniao;
      updates.proxima_reuniao = addDays(base, getPeriodDays(value));
      toastMsg = `Próxima reunião recalculada: ${updates.proxima_reuniao.split("-").reverse().join("/")}`;
    }
    // Auto-calcular próximo relatório (ignora "Não se aplica")
    if (field === "ultimo_relatorio" && value) {
      const pDays = getPeriodDays(client.periodicidade_relatorio || client.periodicidadeRelatorio || "Mensal");
      if (isFinite(pDays)) {
        updates.proximo_relatorio = addDays(value, pDays);
        toastMsg = `Próximo relatório calculado: ${updates.proximo_relatorio.split("-").reverse().join("/")}`;
      }
    }
    if (field === "periodicidade_relatorio" && (client.ultimo_relatorio || client.ultimoRelatorio)) {
      const pDays = getPeriodDays(value || "Mensal");
      if (isFinite(pDays)) {
        const base = client.ultimo_relatorio || client.ultimoRelatorio;
        updates.proximo_relatorio = addDays(base, pDays);
        toastMsg = `Próximo relatório recalculado: ${updates.proximo_relatorio.split("-").reverse().join("/")}`;
      } else {
        updates.proximo_relatorio = "";
      }
    }
    await saveClient({ ...client, ...updates }, false);
    if (toastMsg) setToast({ type: "success", text: toastMsg });
  };

  const pl = getCurrentPL(client, history);
  const curva = getCurva(pl);
  const idade = calcIdade(client.data_nascimento || client.dataNascimento);
  const dR = daysSince(client.ultima_reuniao || client.ultimaReuniao);
  const periodDays = getPeriodDays(client.periodicidade_reuniao || client.periodicidadeReuniao);
  const reuniaoStatus = getReuniaoStatusDynamic(dR, periodDays);
  const liqAtual = getLiquidezAtual(client, aportes);

  const clientAportes = aportes.filter((a) => a.client_id === id).sort((a, b) => b.data.localeCompare(a.data));
  const aporteYears = [...new Set(clientAportes.map((a) => a.data?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  // Aplica filtro de período nos aportes
  const filteredClientAportes = clientAportes.filter((a) => {
    if (aptFilter.mode === "todos") return true;
    if (aptFilter.mode === "ano") return a.data?.startsWith(aptFilter.ano);
    if (aptFilter.mode === "periodo") {
      if (aptFilter.de && a.data < aptFilter.de) return false;
      if (aptFilter.ate && a.data > aptFilter.ate) return false;
      return true;
    }
    return true;
  });

  const totalAp = filteredClientAportes.filter((a) => a.tipo === "aporte").reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalRe = filteredClientAportes.filter((a) => a.tipo === "resgate").reduce((s, a) => s + Number(a.valor || 0), 0);
  const liquido = totalAp - totalRe;

  // Média/mês: líquido do período filtrado ÷ meses decorridos no ano corrente
  const mediaMes = (() => {
    const liquidoFiltrado = filteredClientAportes.reduce((s, a) => s + (a.tipo === "aporte" ? Number(a.valor || 0) : -Number(a.valor || 0)), 0);
    const months = Math.max(1, new Date().getMonth() + 1);
    return liquidoFiltrado / months;
  })();

  // PGBL: aportes do ano corrente marcados is_pgbl
  const anoAtual = new Date().getFullYear().toString();
  const pgblAnoAtual = clientAportes
    .filter((a) => a.tipo === "aporte" && a.is_pgbl && a.data?.startsWith(anoAtual))
    .reduce((s, a) => s + Number(a.valor || 0), 0);
  const hasPgbl = client.pgbl === true || client.pgbl === "true";
  const rendaMensal = Number(client.receita_mensal || 0);
  const rendaBrutaTributavel = Number(client.renda_bruta_tributavel || 0);
  // Renda bruta anual: usa campo direto se preenchido, senão calcula da receita mensal (×12 + 1/3 férias)
  const rendaBrutaAnual = rendaBrutaTributavel > 0 ? rendaBrutaTributavel : (rendaMensal * 12 + rendaMensal / 3);
  const pgblLimite = rendaBrutaAnual * 0.12;
  const pgblPct = pgblLimite > 0 ? Math.min(100, Math.round((pgblAnoAtual / pgblLimite) * 100)) : null;

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
    // Só atualiza ultima_reuniao se o título for "Acompanhamento"
    if (isNew && (rhForm.titulo || "").trim().toLowerCase() === "acompanhamento") {
      await updateField("ultima_reuniao", rhForm.data);
    }
  };

  const saveAptEntry = async () => {
    if (!aptForm.data || !aptForm.valor) { setToast({ type: "error", text: "Preencha data e valor." }); return; }
    const isNew = !aptEditId;
    const valorReserva = Number(aptForm.valor_reserva) || 0;
    const valorPgbl    = Number(aptForm.valor_pgbl)    || 0;
    const entry = {
      ...aptForm,
      client_id: id,
      id: aptEditId || huid(),
      valor: Number(aptForm.valor),
      valor_reserva: valorReserva,
      valor_pgbl: valorPgbl,
      is_reserva: valorReserva > 0,
      is_pgbl: valorPgbl > 0,
    };
    await saveAporte(entry, isNew);
    if (isNew && valorReserva > 0) {
      const delta = entry.tipo === "aporte" ? valorReserva : -valorReserva;
      await incrementLiquidez(id, delta);
    }
    setAptModal(false);
    setAptEditId(null);
    setToast({ type: "success", text: isNew ? "Registrado." : "Atualizado." });
  };

  const openAptEdit = (a) => {
    setAptEditId(a.id);
    setAptForm({
      ...a,
      valor: String(a.valor),
      valor_reserva: a.valor_reserva ? String(a.valor_reserva) : (a.is_reserva ? String(a.valor) : ""),
      valor_pgbl:    a.valor_pgbl    ? String(a.valor_pgbl)    : (a.is_pgbl    ? String(a.valor) : ""),
    });
    setAptModal(true);
  };

  const handleDeleteAporte = async (a) => {
    if (!confirm("Remover este lançamento?")) return;
    await deleteAporte(a.id);
    const valorReserva = Number(a.valor_reserva) || (a.is_reserva ? Number(a.valor) : 0);
    if (valorReserva > 0) {
      const delta = a.tipo === "aporte" ? -valorReserva : valorReserva;
      await incrementLiquidez(id, delta);
    }
    setToast({ type: "success", text: "Removido." });
  };

  const hasSeguro = client.seguro_vida || client.seguroVida;

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
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase" }}>PL Atual</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{money(pl)}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => {
              const obs = [];
              if (hasSeguro) obs.push("✅ Protegido");
              else if (client.seguro_vida !== "nao_aplica") obs.push("Desprotegido");
              if (hasPgbl && pgblPct !== null) obs.push(`PGBL ${anoAtual}: ${pgblPct}% — ${money(pgblAnoAtual)} / ${money(pgblLimite)}`);
              setSlideObs(obs);
              setSlideObjetivos(client.planejamento || "");
              setSlideEditObs(false);
              setSlideModal(true);
            }} style={{ padding: "7px 16px", background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📋 Slide</button>
            <button onClick={() => openEditModal()} style={{ padding: "7px 16px", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Editar Cadastro</button>
          </div>
        </div>
      </div>

      {/* Alerta */}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Observação — só aparece se preenchida */}
        {client.observacao_rapida && (
          <Card style={{ gridColumn: "1/-1", background: "#fffbeb", border: `1px solid #fde68a` }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#92400e", marginBottom: 6 }}>Observação</div>
            <InlineText value={client.observacao_rapida} onSave={(v) => updateField("observacao_rapida", v)} placeholder="Clique para editar…" multiline saveOnEnter style={{ width: "100%", display: "block" }} />
            <div style={{ fontSize: 9, color: "#92400e", opacity: 0.6, marginTop: 4, textAlign: "right" }}>Enter = nova linha · Ctrl+Enter = salvar</div>
          </Card>
        )}

        {/* Dados Gerais */}
        <Card style={{ gridColumn: "1/-1" }}>
          <div style={{ marginBottom: dgOpen ? 12 : 0, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span onClick={() => setDgOpen((o) => !o)} style={{ fontWeight: 700, fontSize: 12, color: B.navy, cursor: "pointer", userSelect: "none", flex: 1 }}>Dados Gerais <span style={{ fontSize: 10, color: B.muted, fontWeight: 400 }}>{dgOpen ? "▲" : "▼"}</span></span>
            <button onClick={(e) => { e.stopPropagation(); openEditModal("dados"); }} style={{ fontSize: 10, fontWeight: 700, color: B.navy, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>Editar</button>
          </div>
          {dgOpen && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {/* Linha 1: cidade+uf · nascimento · profissão · estado civil · filhos · cônjuge */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Cidade / UF</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <InlineText value={client.cidade} onSave={(v) => updateField("cidade", v)} />
                    <span style={{ color: B.muted, fontSize: 11, flexShrink: 0 }}>·</span>
                    <InlineText value={client.uf} onSave={(v) => updateField("uf", v)} style={{ maxWidth: 28 }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Data Nascimento</div>
                  <InlineDate value={client.data_nascimento} onSave={(v) => updateField("data_nascimento", v)} />
                  {idade !== null && <div style={{ fontSize: 13, fontWeight: 700, color: B.navy, marginTop: 2 }}>{idade} anos</div>}
                </div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Profissão</div><InlineText value={client.profissao} onSave={(v) => updateField("profissao", v)} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Estado Civil</div><InlineSelect value={client.estado_civil || ""} onSave={(v) => updateField("estado_civil", v)} opts={[{ v: "", l: "—" }, { v: "Solteiro", l: "Solteiro" }, { v: "Casado", l: "Casado" }, { v: "Divorciado", l: "Divorciado" }, { v: "Viúvo", l: "Viúvo" }, { v: "União estável", l: "União estável" }]} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Filhos</div><InlineText value={client.filhos} onSave={(v) => updateField("filhos", v)} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Cônjuge</div><InlineText value={client.conjuge} onSave={(v) => updateField("conjuge", v)} /></div>
                {/* Linha 2: e-mail · origem · início carteira · seguro/prev · hobbies · pediu indicação */}
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>E-mail</div><InlineText value={client.email} onSave={(v) => updateField("email", v)} placeholder="email@exemplo.com" /></div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Origem</div>
                  <InlineSelect value={client.origem_cliente || ""} onSave={(v) => updateField("origem_cliente", v)} opts={[{ v: "", l: "—" }, ...LEAD_ORIGENS.map((o) => ({ v: o, l: o }))]} />
                  {client.origem_cliente === "Indicação" && (
                    <div style={{ marginTop: 3 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", marginBottom: 2 }}>↳ Indicado por</div>
                      <InlineSelect value={client.indicado_por || ""} onSave={(v) => updateField("indicado_por", v)} opts={[{ v: "", l: "—" }, ...clients.filter((c) => c.id !== id).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ v: c.nome, l: c.nome }))]} />
                    </div>
                  )}
                </div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Início Carteira</div><InlineDate value={client.inicio_carteira} onSave={(v) => updateField("inicio_carteira", v)} /></div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Seguro / Prev. / Suc.</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginBottom: 3 }}>
                    {client.seguro_vida !== "nao_aplica" && (() => {
                      const val = client.seguro_vida;
                      const isTrue = val === true || val === "true";
                      const isFalse = val === false || val === "false";
                      const next = isTrue ? false : isFalse ? "nao_aplica" : true;
                      return (
                        <span onClick={() => updateField("seguro_vida", next)} title="Clique para alterar (✓ / ✗ / N/A)" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: isTrue ? "#dcfce7" : isFalse ? "#fee2e2" : "#f3f4f6", color: isTrue ? "#16a34a" : isFalse ? "#dc2626" : "#9E9C9E", fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${isTrue ? "#bbf7d0" : isFalse ? "#fecaca" : "#e5e7eb"}`, userSelect: "none" }}>
                          {isTrue ? "✓" : isFalse ? "✗" : "—"} Seg.
                        </span>
                      );
                    })()}
                    {client.pgbl !== "nao_aplica" && (client.pgbl === true || client.pgbl === "true") && (
                      <span onClick={() => updateField("pgbl", false)} title="Clique para remover" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid #bbf7d0", userSelect: "none" }}>✓ PGBL</span>
                    )}
                    {client.vgbl !== "nao_aplica" && (client.vgbl === true || client.vgbl === "true") && (
                      <span onClick={() => updateField("vgbl", false)} title="Clique para remover" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid #bbf7d0", userSelect: "none" }}>✓ VGBL</span>
                    )}
                    {(() => {
                      const suc = typeof client.sucessao === "boolean" ? (client.sucessao ? "Sim" : "") : (client.sucessao || "");
                      if (!suc) return null;
                      const hasComment = suc !== "Sim" && suc !== "true" && suc !== "false";
                      return (
                        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "#f0f9ff", color: "#0369a1", fontSize: 10, fontWeight: 700, border: "1px solid #bae6fd", userSelect: "none" }}>✓ Suc.</span>
                          {hasComment && <span style={{ fontSize: 10, color: "#0369a1", fontStyle: "italic" }}>{suc}</span>}
                        </span>
                      );
                    })()}
                    {client.envio_ips !== "nao_aplica" && !client.envio_ips && (
                      <span onClick={() => updateField("envio_ips", "nao_aplica")} title="Clique para marcar como Não se aplica" style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 10, fontWeight: 700, border: "1px solid #fed7aa", cursor: "pointer", userSelect: "none" }}>! IPS</span>
                    )}
                  </div>
                  <InlineText value={client.seguro_observacao} onSave={(v) => updateField("seguro_observacao", v)} placeholder="obs…" style={{ fontSize: 11 }} />
                </div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Hobbies</div><InlineText value={client.hobbies} onSave={(v) => updateField("hobbies", v)} placeholder="Clique para editar…" /></div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 3 }}>Pediu indicação em</div>
                  <InlineDate value={client.data_pedido_indicacao} onSave={(v) => updateField("data_pedido_indicacao", v)} />
                  {client.data_pedido_indicacao && (() => {
                    const d = daysSince(client.data_pedido_indicacao);
                    if (d === null) return null;
                    const m = Math.floor(d / 30);
                    const label = d === 0 ? "hoje" : m === 0 ? "este mês" : m === 1 ? "1 mês atrás" : `${m} meses atrás`;
                    return <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{label}</div>;
                  })()}
                </div>
                {grupoNome && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Grupo (PJ+PF)</div><InlineText value={client.grupo_nome} onSave={(v) => updateField("grupo_nome", v)} /></div>}
              </div>
            </>
          )}
        </Card>

        {/* Financeiro */}
        <Card style={{ gridColumn: "1/-1" }}>
          <div style={{ marginBottom: finOpen ? 10 : 0, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span onClick={() => setFinOpen((o) => !o)} style={{ fontWeight: 700, fontSize: 12, color: B.navy, cursor: "pointer", userSelect: "none", flex: 1 }}>Financeiro <span style={{ fontSize: 10, color: B.muted, fontWeight: 400 }}>{finOpen ? "▲" : "▼"}</span></span>
            <div style={{ display: "flex", gap: 6 }}>
              {(Number(client.liquidez_atual || 0) > 0 || client.liquidez_produtos) && (
                <button onClick={(e) => { e.stopPropagation(); setLiqModal(true); }} style={{ fontSize: 10, fontWeight: 700, color: "#0891b2", background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>💧 Apresentação</button>
              )}
              <button onClick={(e) => { e.stopPropagation(); openEditModal("financeiro"); }} style={{ fontSize: 10, fontWeight: 700, color: B.navy, background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>Editar</button>
            </div>
          </div>
          {finOpen && (
            <>
              {/* Linha 1: Perfil+Benchmark / PL / Liq. Desejada / Liq. Atual / Aporte / Receita */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Perfil</div><InlineSelect value={client.perfil || "moderado"} onSave={(v) => {
                    const benchmarkPorPerfil = { conservador: "IPCA+4%", moderado: "IPCA+5%", arrojado: "IPCA+6%", agressivo: "IPCA+8%" };
                    updateField("perfil", v);
                    if (!client.benchmark) updateField("benchmark", benchmarkPorPerfil[v] || "");
                  }} opts={Object.entries(PERFIL_MAP).map(([k, v]) => ({ v: k, l: v.label }))} /></div>
                  <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Benchmark</div><InlineSelect value={client.benchmark || ({ conservador: "IPCA+4%", moderado: "IPCA+5%", arrojado: "IPCA+6%", agressivo: "IPCA+8%" }[client.perfil] || "")} onSave={(v) => updateField("benchmark", v)} opts={[{ v: "", l: "—" }, { v: "IPCA+4%", l: "IPCA+4%" }, { v: "IPCA+5%", l: "IPCA+5%" }, { v: "IPCA+6%", l: "IPCA+6%" }, { v: "IPCA+8%", l: "IPCA+8%" }]} /></div>
                </div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>PL Atual</div><InlineMoney value={client.pl_inicial} onSave={(v) => updateField("pl_inicial", v)} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Liquidez Desejada</div><InlineMoney value={client.liquidez_desejada} onSave={(v) => updateField("liquidez_desejada", v)} /></div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Liquidez Atual</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <InlineMoney value={client.liquidez_atual} onSave={(v) => updateField("liquidez_atual", v)} />
                    {Number(client.liquidez_atual || 0) > 0 && Number(client.liquidez_desejada || 0) > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: Number(client.liquidez_atual) >= Number(client.liquidez_desejada) ? "#16a34a" : "#c2410c", background: Number(client.liquidez_atual) >= Number(client.liquidez_desejada) ? "#f0fdf4" : "#fff7ed", border: `1px solid ${Number(client.liquidez_atual) >= Number(client.liquidez_desejada) ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 999, padding: "1px 6px" }}>{Math.min(100, Math.round((Number(client.liquidez_atual) / Number(client.liquidez_desejada)) * 100))}%</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Aporte Mensal</div>
                  {Number(client.aporte_mensal_max) > 0
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{money(client.aporte_mensal)} <span style={{ color: B.muted, fontWeight: 400 }}>–</span> {money(client.aporte_mensal_max)}</span>
                    : <InlineMoney value={client.aporte_mensal} onSave={(v) => updateField("aporte_mensal", v)} />
                  }
                </div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Receita Mensal</div><InlineMoney value={client.receita_mensal} onSave={(v) => updateField("receita_mensal", v)} /></div>
                {hasPgbl && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>
                    Renda Bruta Tributável/Ano
                    {rendaBrutaTributavel === 0 && rendaMensal > 0 && <span style={{ fontWeight: 400, color: B.muted, textTransform: "none" }}> (calculado)</span>}
                  </div>
                  <InlineMoney value={rendaBrutaTributavel > 0 ? client.renda_bruta_tributavel : rendaBrutaAnual} onSave={(v) => updateField("renda_bruta_tributavel", v)} />
                  {rendaBrutaTributavel === 0 && rendaMensal > 0 && (
                    <div style={{ fontSize: 9, color: B.muted, marginTop: 2 }}>da Receita Mensal · 12% = {money(pgblLimite)}</div>
                  )}
                  {rendaBrutaTributavel > 0 && (
                    <div style={{ fontSize: 9, color: B.muted, marginTop: 2 }}>manual · 12% = {money(pgblLimite)}</div>
                  )}
                </div>
                )}
              </div>
              {/* Linha 2: IR / Corretoras / Pagamento / Produtos de Reserva / Taxa / Mínimo + Financiamentos abaixo de Corretoras */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 8 }}>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>IR</div><InlineSelect value={client.declaracao_ir || ""} onSave={(v) => updateField("declaracao_ir", v)} opts={[{ v: "", l: "—" }, { v: "Simplificada", l: "Simplificada" }, { v: "Completa", l: "Completa" }]} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Corretoras</div><InlineText value={client.corretoras} onSave={(v) => updateField("corretoras", v)} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Pagamento</div><InlineSelect value={client.forma_pagamento || ""} onSave={(v) => updateField("forma_pagamento", v)} opts={[{ v: "", l: "—" }, { v: "BTG", l: "BTG" }, { v: "XP", l: "XP" }, { v: "Boleto", l: "Boleto" }]} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Produtos de Reserva</div><InlineText value={client.liquidez_produtos} onSave={(v) => updateField("liquidez_produtos", v)} placeholder="Tesouro Selic, CDB..." /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Taxa (%)</div><InlineSelect value={client.taxa_contratada || ""} onSave={(v) => updateField("taxa_contratada", v)} opts={[{ v: "", l: "—" }, { v: "1", l: "1%" }, { v: "0.95", l: "0,95%" }, { v: "0.9", l: "0,9%" }, { v: "0.8", l: "0,8%" }, { v: "0.7", l: "0,7%" }]} /></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Mínimo Contrato</div><InlineMoney value={client.valor_minimo_contrato} onSave={(v) => updateField("valor_minimo_contrato", v)} /></div>
                <div style={{ gridColumn: "1" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Patrimônio Imobilizado</div><InlineText value={client.patrimonio_imobilizado} onSave={(v) => updateField("patrimonio_imobilizado", v)} placeholder="Ex: Imóvel SP, Carro 2023…" /></div>
                <div style={{ gridColumn: "2" }}><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Financiamentos</div><InlineText value={client.financiamentos} onSave={(v) => updateField("financiamentos", v)} placeholder="Ex: Financiamento imóvel, Leasing…" /></div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${B.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Planejamento / Metas</div>
                <InlineText value={client.planejamento} onSave={(v) => updateField("planejamento", v)} placeholder="Clique para editar..." multiline style={{ width: "100%", display: "block" }} />
              </div>
            </>
          )}
        </Card>


        {/* Grupo PJ+PF */}
        {grupoMembers.length > 0 && (
          <Card style={{ gridColumn: "1/-1", background: "#f5f3ff", border: "2px solid #ddd6fe" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#7c3aed", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #ddd6fe" }}>Contas vinculadas — {grupoNome}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[client, ...grupoMembers].map((c) => (
                <div key={c.id} onClick={() => c.id !== id && navigate(`/clients/${slugify(c.nome)}`)} style={{ background: "white", border: "1px solid #ddd6fe", borderRadius: 9, padding: "10px 14px", cursor: c.id !== id ? "pointer" : "default", flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#7c3aed" }}>{c.nome}{c.id === id && <span style={{ fontSize: 10, color: "#a78bfa", marginLeft: 6 }}>(esta)</span>}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{c.profissao || "—"}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>

      {/* Aportes */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Aportes e Resgates</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navigate(`/clients/${slug}/rebalanceamento`)} style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🌎 Rebalanceamento</button>
            <button onClick={() => setResumoModal(true)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📊 Resumo</button>
            <button onClick={() => { setAptForm({ client_id: id, data: today(), tipo: "aporte", valor: "", observacao: "", is_reserva: false, is_pgbl: false, valor_reserva: "", valor_pgbl: "" }); setAptModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Registrar</button>
          </div>
        </div>

        {/* Link Rebalanceamento — logo abaixo do header */}
        {(client.link_rebalanceamento || true) && (
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", whiteSpace: "nowrap" }}>Link Rebalanceamento</span>
            <InlineText value={client.link_rebalanceamento} onSave={(v) => updateField("link_rebalanceamento", v)} placeholder="https://…" style={{ width: 220 }} />
            {client.link_rebalanceamento && String(client.link_rebalanceamento).startsWith("http") && (
              <a href={client.link_rebalanceamento} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 96, fontSize: 11, color: "#2563eb", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", padding: "2px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5 }} onClick={(e) => e.stopPropagation()}>↗ Abrir</a>
            )}
          </div>
        )}

        {/* Filtro de período — controla os stats e o histórico */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: aptFilter.mode === "periodo" ? 8 : 0 }}>
            <button onClick={() => setAptFilter({ mode: "todos", ano: "", de: "", ate: "" })}
              style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${aptFilter.mode === "todos" ? B.navy : B.border}`, background: aptFilter.mode === "todos" ? B.navy : "white", color: aptFilter.mode === "todos" ? "white" : B.gray }}>
              Desde o início
            </button>
            {aporteYears.map((y) => (
              <button key={y} onClick={() => setAptFilter({ mode: "ano", ano: y, de: "", ate: "" })}
                style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${aptFilter.mode === "ano" && aptFilter.ano === y ? B.brand : B.border}`, background: aptFilter.mode === "ano" && aptFilter.ano === y ? B.brand : "white", color: aptFilter.mode === "ano" && aptFilter.ano === y ? "white" : B.gray }}>
                {y}
              </button>
            ))}
            <button onClick={() => setAptFilter((f) => ({ ...f, mode: "periodo" }))}
              style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${aptFilter.mode === "periodo" ? "#0369a1" : B.border}`, background: aptFilter.mode === "periodo" ? "#e0f2fe" : "white", color: aptFilter.mode === "periodo" ? "#0369a1" : B.gray }}>
              Período...
            </button>
          </div>
          {aptFilter.mode === "periodo" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: B.gray }}>De</span>
              <input type="date" value={aptFilter.de || ""} onChange={(e) => setAptFilter((f) => ({ ...f, de: e.target.value }))}
                style={{ border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
              <span style={{ fontSize: 11, color: B.gray }}>até</span>
              <input type="date" value={aptFilter.ate || ""} onChange={(e) => setAptFilter((f) => ({ ...f, ate: e.target.value }))}
                style={{ border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            </div>
          )}
        </div>

        {/* Stats principais — respondem ao filtro acima */}
        {(() => {
          const hasReserva = Number(client.liquidez_desejada || 0) > 0;
          const liqA = Number(client.liquidez_atual || 0);
          const desejada = Number(client.liquidez_desejada || 0);
          const pct = desejada > 0 ? Math.min(100, Math.round((liqA / desejada) * 100)) : 0;
          const ok = liqA >= desejada;
          return (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${hasReserva ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 12 }}>
              {hasReserva && (
                <div style={{ background: ok ? "#f0fdf4" : "#fff7ed", border: `1px solid ${ok ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>💧 Reserva</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ok ? "#16a34a" : "#c2410c", marginBottom: 4 }}>{pct}%</div>
                  <div style={{ width: "100%", height: 4, background: ok ? "#bbf7d0" : "#fed7aa", borderRadius: 99, marginBottom: 3 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: ok ? "#16a34a" : "#f97316", borderRadius: 99, transition: "width .3s" }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#8899bb", fontWeight: 600 }}>{money(liqA)} / {money(desejada)}</div>
                </div>
              )}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Aportado</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{money(totalAp)}</div>
              </div>
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Resgatado</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{money(totalRe)}</div>
              </div>
              <div style={{ background: liquido >= 0 ? "#f0fdf4" : "#fff5f5", border: `1px solid ${liquido >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Líquido</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: liquido >= 0 ? "#16a34a" : "#dc2626" }}>{liquido >= 0 ? "+" : ""}{money(liquido)}</div>
              </div>
              <div style={{ background: mediaMes >= 0 ? "#f5f3ff" : "#fff5f5", border: `1px solid ${mediaMes >= 0 ? "#ddd6fe" : "#fecaca"}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Média/Mês (líq.)</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: mediaMes >= 0 ? "#7c3aed" : "#dc2626" }}>{mediaMes >= 0 ? "" : "-"}{money(Math.abs(mediaMes))}</div>
              </div>
            </div>
          );
        })()}

        {/* PGBL */}
        {hasPgbl && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {hasPgbl && pgblPct !== null && (() => {
              const restante = Math.max(0, pgblLimite - pgblAnoAtual);
              const concluido = pgblPct >= 100;
              return (
                <div style={{ background: concluido ? "#f0fdf4" : "#f5f3ff", border: `1px solid ${concluido ? "#bbf7d0" : "#ddd6fe"}`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Progresso */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: concluido ? "#16a34a" : "#7c3aed" }}>⏳ PGBL {pgblPct}%</span>
                    </div>
                    <div style={{ width: 140, height: 5, background: concluido ? "#bbf7d0" : "#ddd6fe", borderRadius: 99 }}>
                      <div style={{ width: `${pgblPct}%`, height: "100%", background: concluido ? "#16a34a" : "#7c3aed", borderRadius: 99, transition: "width .3s" }} />
                    </div>
                  </div>
                  {/* Valores */}
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 2 }}>Renda Bruta/Ano</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{money(rendaBrutaAnual)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 2 }}>Limite (12%)</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: concluido ? "#16a34a" : "#7c3aed" }}>{money(pgblLimite)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 2 }}>Aportado</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{money(pgblAnoAtual)}</div>
                    </div>
                    {!concluido && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 2 }}>Restante</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#c2410c" }}>{money(restante)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {hasPgbl && pgblPct === null && (
              <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                ⏳ PGBL — preencha Receita Mensal ou Renda Bruta Tributável
              </span>
            )}
          </div>
        )}

        {/* Histórico colapsável — usa o mesmo filtro dos stats acima */}
        {(() => {
          return (
        <div>
          <button onClick={() => setAptHistOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontSize: 11, fontWeight: 600, color: B.navy }}>
            <span style={{ fontSize: 10 }}>{aptHistOpen ? "▼" : "▶"}</span>
            Ver histórico ({filteredClientAportes.length} registro{filteredClientAportes.length !== 1 ? "s" : ""}{aptFilter.mode !== "todos" ? " no período" : ""})
          </button>

          {aptHistOpen && (
            <div style={{ marginTop: 10 }}>
              {/* Lista */}
              {filteredClientAportes.length === 0
                ? <div style={{ padding: 12, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhuma movimentação.</div>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <tbody>
                    {filteredClientAportes.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                        <td style={{ padding: "5px 8px", width: 14 }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626" }}>{a.tipo === "aporte" ? "+" : "−"}</span>
                        </td>
                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>{fmtDate(a.data)}</td>
                        <td style={{ padding: "5px 14px 5px 8px", whiteSpace: "nowrap", fontWeight: 700, color: a.tipo === "aporte" ? "#16a34a" : "#dc2626" }}>{money(a.valor)}</td>
                        <td style={{ padding: "5px 8px 5px 16px", color: "#6b7280", fontSize: 11, width: "100%" }}>{a.observacao || ""}</td>
                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {(Number(a.valor_reserva) > 0 || a.is_reserva) && (
                              <span style={{ fontSize: 9, background: "#e0f2fe", color: "#0369a1", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                                RESERVA{Number(a.valor_reserva) > 0 && Number(a.valor_reserva) < Number(a.valor) ? ` ${money(a.valor_reserva)}` : ""}
                              </span>
                            )}
                            {(Number(a.valor_pgbl) > 0 || a.is_pgbl) && (
                              <span style={{ fontSize: 9, background: "#f5f3ff", color: "#7c3aed", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                                PGBL{Number(a.valor_pgbl) > 0 && Number(a.valor_pgbl) < Number(a.valor) ? ` ${money(a.valor_pgbl)}` : ""}
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap", textAlign: "right" }}>
                          <button onClick={() => openAptEdit(a)} style={{ background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 5, padding: "2px 7px", fontSize: 10, cursor: "pointer", marginRight: 4 }}>✎</button>
                          <button onClick={() => handleDeleteAporte(a)} style={{ background: "white", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 7px", fontSize: 10, cursor: "pointer" }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          )}
        </div>
          );
        })()}
      </Card>

      {/* Reunião + Relatório — penúltimo, lado a lado, compactos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${B.border}` }}>Reunião</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Periodicidade</div><InlineSelect value={client.periodicidade_reuniao || "Trimestral"} onSave={(v) => updateField("periodicidade_reuniao", v)} opts={PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#0891b2", textTransform: "uppercase", marginBottom: 3 }}>Chamei em</div><InlineDate value={client.avisado_em} onSave={(v) => updateField("avisado_em", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Última Reunião</div><InlineDate value={client.ultima_reuniao} onSave={(v) => updateField("ultima_reuniao", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Próxima Reunião</div><InlineDate value={client.proxima_reuniao} onSave={(v) => updateField("proxima_reuniao", v)} /></div>
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${B.border}` }}>Relatório</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Periodicidade</div><InlineSelect value={client.periodicidade_relatorio || ""} onSave={(v) => updateField("periodicidade_relatorio", v)} opts={[{ v: "", l: "—" }, ...PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))]} /></div>
            <div />
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Último Relatório</div><InlineDate value={client.ultimo_relatorio} onSave={(v) => updateField("ultimo_relatorio", v)} /></div>
            <div><div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 3 }}>Próximo Relatório</div><InlineDate value={client.proximo_relatorio} onSave={(v) => updateField("proximo_relatorio", v)} /></div>
          </div>
        </Card>
      </div>

      {/* Notas Gerais — abaixo de Aportes */}
      <Card style={{ marginBottom: 12, border: "2px solid #e0e7ff", background: "#fafbff" }}>
        <div onClick={() => setNotasOpen((o) => !o)} style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: notasOpen ? 10 : 0, paddingBottom: 8, borderBottom: "1px solid #e0e7ff", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
          <span>Notas Gerais</span>
          <span style={{ fontSize: 10, color: B.muted }}>{notasOpen ? "▲ recolher" : "▼ expandir"}</span>
        </div>
        {notasOpen && (
          <>
            <InlineText value={client.notas_gerais} onSave={(v) => updateField("notas_gerais", v)} placeholder="Clique para editar… Enter = nova linha · Ctrl+Enter = salvar" multiline saveOnEnter style={{ width: "100%", minHeight: 60 }} />
            <div style={{ fontSize: 9, color: B.muted, marginTop: 4, textAlign: "right" }}>Enter = nova linha · Ctrl+Enter = salvar · Esc = cancelar</div>
          </>
        )}
      </Card>

      {/* Histórico */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Histórico ({clientReunioes.length})</span>
          <button onClick={() => { setRhEditId(null); setRhForm({ client_id: id, data: today(), titulo: "", texto: "" }); setRhModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Registrar</button>
        </div>
        {clientReunioes.length === 0 ? <div style={{ padding: 16, textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum registro.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {clientReunioes.map((r) => {
              const isOpen = rhExpandedIds.has(r.id);
              return (
                <div key={r.id} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}>
                      <span onClick={() => toggleRhExpand(r.id)} style={{ fontSize: 10, color: B.muted, flexShrink: 0, cursor: "pointer", userSelect: "none" }}>{isOpen ? "▼" : "▶"}</span>
                      {isOpen ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          <InlineDate value={r.data} onSave={(v) => saveReuniao({ ...r, data: v }, false).then(() => setToast({ type: "success", text: "Data atualizada." }))} />
                          <InlineText value={r.titulo} onSave={(v) => saveReuniao({ ...r, titulo: v }, false)} placeholder="Sem título" style={{ fontWeight: 600, color: B.navy, fontSize: 12 }} />
                        </div>
                      ) : (
                        <div onClick={() => toggleRhExpand(r.id)} style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0, cursor: "pointer" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>{r.data ? r.data.split("-").reverse().join("/") : "—"}</span>
                          {r.titulo && <span style={{ fontSize: 11, fontWeight: 600, color: B.navy, background: "#e8eeff", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap" }}>{r.titulo}</span>}
                          {r.texto && <span style={{ fontSize: 11, color: B.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.texto.slice(0, 80)}{r.texto.length > 80 ? "…" : ""}</span>}
                        </div>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm("Remover este registro?")) { deleteReuniao(r.id).then(() => setToast({ type: "success", text: "Removido." })); } }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 9px", fontSize: 10, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>Remover</button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "4px 14px 12px", borderTop: `1px solid ${B.border}` }}>
                      <InlineText value={r.texto} onSave={(v) => saveReuniao({ ...r, texto: v }, false).then(() => setToast({ type: "success", text: "Histórico atualizado." }))} multiline saveOnEnter placeholder="Clique para adicionar notas… (Ctrl+Enter para salvar)" style={{ width: "100%", minHeight: 36, color: "#445566", lineHeight: 1.7, fontSize: 12 }} />
                      {r.texto && <div style={{ fontSize: 9, color: B.muted, marginTop: 3, textAlign: "right" }}>Ctrl+Enter = salvar · Esc = cancelar</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
<button onClick={async () => { await updateField("status", "inativo"); navigate("/clients"); setToast({ type: "success", text: "Arquivado." }); }} style={{ padding: "9px 18px", background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Arquivar</button>
        <button onClick={async () => { if (confirm("Remover permanentemente?")) { await deleteClient(id); navigate("/clients"); setToast({ type: "success", text: "Removido." }); } }} style={{ padding: "9px 18px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remover</button>
      </div>

      {/* ═══ MODAL EDITAR CADASTRO ═══ */}
      <Modal open={editModal} onClose={() => setEditModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editSection === "dados" ? "Editar Dados Gerais" : editSection === "financeiro" ? "Editar Financeiro" : "Editar Cadastro"}</h3>
            <button onClick={() => setEditModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {(!editSection || editSection === "dados") && <>
            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}` }}>Dados Gerais</div>
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Observação" value={editForm.observacao_rapida ?? editForm.observacaoRapida ?? ""} onChange={EF("observacao_rapida")} /></div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={editForm.nome || ""} onChange={EF("nome")} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px", gap: 8 }}><Inp label="Cidade" value={editForm.cidade || ""} onChange={EF("cidade")} /><Inp label="UF" value={editForm.uf || ""} onChange={EF("uf")} /></div>
            <Inp label="Profissão" value={editForm.profissao || ""} onChange={EF("profissao")} />
            <Sel label="Estado Civil" value={editForm.estado_civil || editForm.estadoCivil || ""} onChange={EF("estado_civil")} opts={[{ v: "", l: "—" }, { v: "Solteiro", l: "Solteiro" }, { v: "Casado", l: "Casado" }, { v: "Divorciado", l: "Divorciado" }, { v: "Viúvo", l: "Viúvo" }, { v: "União estável", l: "União estável" }]} />
            <Inp label="Filhos" value={editForm.filhos || ""} onChange={EF("filhos")} />
            <Inp label="Cônjuge" value={editForm.conjuge || ""} onChange={EF("conjuge")} />
            <Inp label="Data Nascimento" value={editForm.data_nascimento || editForm.dataNascimento || ""} onChange={EF("data_nascimento")} type="date" />
            <div style={{ gridColumn: "1/-1" }}><Inp label="Hobbies" value={editForm.hobbies || ""} onChange={EF("hobbies")} /></div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Grupo (PJ+PF)" value={editForm.grupo_nome ?? editForm.grupoNome ?? ""} onChange={EF("grupo_nome")} placeholder="Nome do grupo" /></div>
            <Sel label="Origem do Cliente" value={editForm.origem_cliente || editForm.origemCliente || ""} onChange={EF("origem_cliente")} opts={[{ v: "", l: "—" }, ...LEAD_ORIGENS.map((o) => ({ v: o, l: o }))]} />
            <Inp label="Início Carteira" value={editForm.inicio_carteira ?? editForm.inicioCarteira ?? ""} onChange={EF("inicio_carteira")} type="date" />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Status e Perfil</div>
            <Sel label="Status" value={editForm.status || "ativo"} onChange={EF("status")} opts={[{ v: "ativo", l: "Ativo" }, { v: "inativo", l: "Inativo" }]} />
            <Sel label="Perfil" value={editForm.perfil || "moderado"} onChange={EF("perfil")} opts={Object.entries(PERFIL_MAP).map(([k, v]) => ({ v: k, l: v.label }))} />
            <Sel label="Benchmark" value={editForm.benchmark || ""} onChange={EF("benchmark")} opts={[{ v: "", l: "—" }, { v: "IPCA+4%", l: "IPCA+4%" }, { v: "IPCA+5%", l: "IPCA+5%" }, { v: "IPCA+6%", l: "IPCA+6%" }, { v: "IPCA+8%", l: "IPCA+8%" }]} />
            </>}

            {(!editSection || editSection === "financeiro") && <>
            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: editSection === "financeiro" ? 0 : 6 }}>Financeiro</div>
            <Inp label="PL Atual (R$)" value={editForm.pl_inicial ?? editForm.plInicial ?? ""} onChange={EF("pl_inicial")} type="number" />
            <Inp label="Aporte Mensal Mín (R$)" value={editForm.aporte_mensal ?? editForm.aporteMensal ?? ""} onChange={EF("aporte_mensal")} type="number" />
            <Inp label="Aporte Mensal Máx (R$)" value={editForm.aporte_mensal_max ?? ""} onChange={EF("aporte_mensal_max")} type="number" placeholder="Deixe vazio para valor único" />
            <Inp label="Liquidez Desejada (R$)" value={editForm.liquidez_desejada ?? editForm.liquidezDesejada ?? ""} onChange={EF("liquidez_desejada")} type="number" />
            <Inp label="Liquidez Atual (R$)" value={editForm.liquidez_atual ?? ""} onChange={EF("liquidez_atual")} type="number" />
            <Inp label="Taxa Contratada" value={editForm.taxa_contratada ?? editForm.taxaContratada ?? ""} onChange={EF("taxa_contratada")} />
            <Inp label="Receita Mensal (R$)" value={editForm.receita_mensal ?? editForm.receitaMensal ?? ""} onChange={EF("receita_mensal")} type="number" />
            <div>
              <Inp label="Renda Bruta Tributável/Ano (R$)" value={editForm.renda_bruta_tributavel ?? editForm.rendaBrutaTributavel ?? ""} onChange={EF("renda_bruta_tributavel")} type="number" placeholder="Se vazio, calculado da Receita Mensal" />
              {(() => {
                const rm = Number(editForm.receita_mensal || editForm.receitaMensal || 0);
                const rbt = Number(editForm.renda_bruta_tributavel || editForm.rendaBrutaTributavel || 0);
                const base = rbt > 0 ? rbt : (rm * 12 + rm / 3);
                const lim = base * 0.12;
                if (lim === 0) return null;
                return <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 3, fontWeight: 600 }}>Limite PGBL: {money(lim)} {rbt === 0 && rm > 0 ? "(calculado)" : "(manual)"}</div>;
              })()}
            </div>
            <Sel label="Forma Pagamento" value={editForm.forma_pagamento ?? editForm.formaPagamento ?? "XP"} onChange={EF("forma_pagamento")} opts={["XP", "BTG", "Boleto", "Outros"].map((v) => ({ v, l: v }))} />
            <Sel label="Declaração IR" value={editForm.declaracao_ir ?? editForm.declaracaoIR ?? "Simplificada"} onChange={EF("declaracao_ir")} opts={["Simplificada", "Completa"].map((v) => ({ v, l: v }))} />
            <div style={{ gridColumn: "1/-1" }}><Inp label="Corretoras" value={editForm.corretoras || ""} onChange={EF("corretoras")} placeholder="XP, BTG, Avenue…" /></div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Link Rebalanceamento" value={editForm.link_rebalanceamento ?? editForm.linkRebalanceamento ?? ""} onChange={EF("link_rebalanceamento")} placeholder="https://…" /></div>
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Planejamento / Metas" value={editForm.planejamento || ""} onChange={EF("planejamento")} /></div>
            </>}

            {(!editSection || editSection === "dados") && <>
            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Datas</div>
            <Inp label="Última Reunião" value={editForm.ultima_reuniao ?? editForm.ultimaReuniao ?? ""} onChange={EF("ultima_reuniao")} type="date" />
            <Inp label="Próxima Reunião" value={editForm.proxima_reuniao ?? editForm.proximaReuniao ?? ""} onChange={EF("proxima_reuniao")} type="date" />
            <Inp label="Último Relatório" value={editForm.ultimo_relatorio ?? editForm.ultimoRelatorio ?? ""} onChange={EF("ultimo_relatorio")} type="date" />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Reuniões e Relatórios</div>
            <Sel label="Periodicidade Reunião" value={editForm.periodicidade_reuniao || editForm.periodicidadeReuniao || "Trimestral"} onChange={EF("periodicidade_reuniao")} opts={PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))} />
            <Sel label="Periodicidade Relatório" value={editForm.periodicidade_relatorio || editForm.periodicidadeRelatorio || ""} onChange={EF("periodicidade_relatorio")} opts={[{ v: "", l: "—" }, ...PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))]} />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Atributos</div>
            <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 16px" }}>
              <Sel label="IPS Enviada"
                value={(editForm.envio_ips ?? editForm.envioIps) === "nao_aplica" ? "nao_aplica" : (editForm.envio_ips ?? editForm.envioIps) ? "sim" : "nao"}
                onChange={(e) => setEditForm((f) => ({ ...f, envio_ips: e.target.value === "sim" ? true : e.target.value === "nao_aplica" ? "nao_aplica" : false }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }, { v: "nao_aplica", l: "Não se aplica" }]} />
              <Sel label="Seguro de Vida"
                value={(editForm.seguro_vida ?? editForm.seguroVida) === "nao_aplica" ? "nao_aplica" : (editForm.seguro_vida ?? editForm.seguroVida) === true || (editForm.seguro_vida ?? editForm.seguroVida) === "true" ? "sim" : "nao"}
                onChange={(e) => setEditForm((f) => ({ ...f, seguro_vida: e.target.value === "sim" ? true : e.target.value === "nao_aplica" ? "nao_aplica" : false }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }, { v: "nao_aplica", l: "Não se aplica" }]} />
              <Sel label="Previdência"
                value={editForm.pgbl === "nao_aplica" ? "nao_aplica" : editForm.pgbl && editForm.vgbl ? "ambos" : editForm.pgbl ? "pgbl" : editForm.vgbl ? "vgbl" : "nao"}
                onChange={(e) => { const v = e.target.value; setEditForm((f) => ({ ...f, pgbl: v === "pgbl" || v === "ambos" ? true : v === "nao_aplica" ? "nao_aplica" : false, vgbl: v === "vgbl" || v === "ambos" })); }}
                opts={[{ v: "nao", l: "Não" }, { v: "pgbl", l: "PGBL" }, { v: "vgbl", l: "VGBL" }, { v: "ambos", l: "PGBL e VGBL" }, { v: "nao_aplica", l: "Não se aplica" }]} />
              <Inp label="Sucessão" value={typeof editForm.sucessao === "boolean" ? (editForm.sucessao ? "Sim" : "") : (editForm.sucessao || "")} onChange={EF("sucessao")} placeholder="Descreva o planejamento..." />
            </div>
            </>}

          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            <button onClick={saveEdit} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>SALVAR</button>
          </div>
        </div>
      </Modal>

      {/* Modal Reunião */}
      <Modal open={rhModal} onClose={() => setRhModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: B.navy }}>{rhEditId ? "Editar Registro" : "Novo Registro"}</h3>
          <Inp label="Data *" type="date" value={rhForm.data} onChange={(e) => setRhForm((f) => ({ ...f, data: e.target.value }))} />
          <Inp label="Título" value={rhForm.titulo || ""} onChange={(e) => setRhForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de acompanhamento, Compra do imóvel…" />
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Registro *</label>
            <textarea value={rhForm.texto} onChange={(e) => setRhForm((f) => ({ ...f, texto: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveRhEntry(); } }} rows={8} placeholder="O que foi discutido… (Enter = nova linha · Ctrl+Enter = salvar)" style={{ width: "100%", boxSizing: "border-box", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 7, padding: "10px 13px", fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.7 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setRhModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveRhEntry} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>{rhEditId ? "SALVAR" : "REGISTRAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Modal Aporte */}
      <Modal open={aptModal} onClose={() => { setAptModal(false); setAptEditId(null); }}>
        <div style={{ padding: "26px 30px" }} onKeyDown={(e) => { if (e.key === "Enter" && e.target.type !== "checkbox") { e.preventDefault(); saveAptEntry(); } }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: B.navy }}>{aptEditId ? "Editar Lançamento" : "Novo Aporte / Resgate"}</h3>
          <Inp label="Data *" type="date" value={aptForm.data} onChange={(e) => setAptForm((f) => ({ ...f, data: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginBottom: 13 }}>
            {["aporte", "resgate"].map((t) => (
              <button key={t} onClick={() => setAptForm((f) => ({ ...f, tipo: t }))} style={{ flex: 1, padding: "9px", border: `2px solid ${aptForm.tipo === t ? (t === "aporte" ? "#16a34a" : "#dc2626") : B.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, background: aptForm.tipo === t ? (t === "aporte" ? "#f0fdf4" : "#fff5f5") : "white", color: aptForm.tipo === t ? (t === "aporte" ? "#16a34a" : "#dc2626") : B.gray }}>{t === "aporte" ? "Aporte" : "Resgate"}</button>
            ))}
          </div>
          <Inp label="Valor Total (R$) *" type="number" value={aptForm.valor} onChange={(e) => setAptForm((f) => ({ ...f, valor: e.target.value }))} placeholder="0" />

          {/* Split: Reserva de Emergência */}
          <div style={{ marginBottom: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: B.navy, cursor: "pointer", marginBottom: 5 }}>
              <input type="checkbox"
                checked={!!aptForm.is_reserva}
                onChange={(e) => setAptForm((f) => ({ ...f, is_reserva: e.target.checked, valor_reserva: e.target.checked ? (f.valor || "") : "" }))}
                style={{ width: 16, height: 16, cursor: "pointer" }} />
              Parte para Reserva de Emergência
            </label>
            {aptForm.is_reserva && (
              <div style={{ paddingLeft: 22 }}>
                <Inp label="Valor destinado à Reserva (R$)" type="number" value={aptForm.valor_reserva}
                  onChange={(e) => setAptForm((f) => ({ ...f, valor_reserva: e.target.value }))} placeholder="0" />
              </div>
            )}
          </div>

          {/* Split: PGBL */}
          <div style={{ marginBottom: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: B.navy, cursor: "pointer", marginBottom: 5 }}>
              <input type="checkbox"
                checked={!!aptForm.is_pgbl}
                onChange={(e) => setAptForm((f) => ({ ...f, is_pgbl: e.target.checked, valor_pgbl: e.target.checked ? (f.valor || "") : "" }))}
                style={{ width: 16, height: 16, cursor: "pointer" }} />
              Parte para PGBL
            </label>
            {aptForm.is_pgbl && (
              <div style={{ paddingLeft: 22 }}>
                <Inp label="Valor destinado ao PGBL (R$)" type="number" value={aptForm.valor_pgbl}
                  onChange={(e) => setAptForm((f) => ({ ...f, valor_pgbl: e.target.value }))} placeholder="0" />
              </div>
            )}
          </div>

          {/* Alerta se soma dos splits ultrapassar o total */}
          {(() => {
            const total = Number(aptForm.valor) || 0;
            const alocado = (Number(aptForm.valor_reserva) || 0) + (Number(aptForm.valor_pgbl) || 0);
            if (alocado > total && total > 0) return (
              <div style={{ fontSize: 11, color: "#dc2626", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
                ⚠ Soma dos splits (R${alocado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) ultrapassa o valor total.
              </div>
            );
            return null;
          })()}
          <Inp label="Onde foi aportado / Observação" value={aptForm.observacao} onChange={(e) => setAptForm((f) => ({ ...f, observacao: e.target.value }))} placeholder="Ex: XP - Tesouro Selic, BTG - CDB..." />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAptModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveAptEntry} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>{aptEditId ? "SALVAR" : "REGISTRAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Modal Slide Apresentação */}
      {slideModal && (() => {
        const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
        const fmtInicio = (v) => {
          if (!v) return "—";
          const parts = String(v).split("-");
          const y = parts[0];
          const m = parts[1] ? Number(parts[1]) : null;
          return m ? `${MESES_PT[m-1]}/${y}` : y;
        };
        const fmtBenchmark = (v) => {
          if (!v) return "—";
          return v.replace("IPCA+", "IPCA + ").replace("%", "% aa");
        };
        const benchmarkVal = client.benchmark || ({ conservador: "IPCA+4%", moderado: "IPCA+5%", arrojado: "IPCA+6%", agressivo: "IPCA+8%" }[client.perfil] || "");
        const liqA = Number(client.liquidez_atual || 0);
        const desejada = Number(client.liquidez_desejada || 0);
        const pctLiq = desejada > 0 ? Math.min(100, Math.round((liqA / desejada) * 100)) : 0;
        const okLiq = liqA >= desejada;
        const produtos = (client.liquidez_produtos || "").split(/,|\n/).map((p) => p.trim()).filter(Boolean);
        const perfilLabel = PERFIL_MAP[client.perfil]?.label || client.perfil || "—";
        const ROW = { display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "14px 28px", gap: 24 };
        const LABEL = { fontSize: 13, fontWeight: 700, color: "white", width: 180, flexShrink: 0 };
        const VAL = { fontSize: 13, color: "rgba(255,255,255,0.85)", flex: 1 };
        return (
          <div onClick={() => setSlideModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(6px)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#061841", borderRadius: 18, width: "100%", maxWidth: 680, boxShadow: "0 32px 80px rgba(0,0,0,0.6)", overflow: "hidden" }}>
              {/* Cabeçalho */}
              <div style={{ padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{client.nome} · Slide 1</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setSlideEditObs((v) => !v)} style={{ background: slideEditObs ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 12px", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {slideEditObs ? "✓ Pronto" : "✎ Editar obs"}
                  </button>
                  <button onClick={() => setSlideModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
              </div>

              {/* Perfil de risco */}
              <div style={ROW}>
                <div style={LABEL}>Perfil de risco</div>
                <div style={{ ...VAL, fontWeight: 600 }}>{perfilLabel}</div>
              </div>

              {/* Objetivos */}
              <div style={{ ...ROW, alignItems: "flex-start" }}>
                <div style={LABEL}>Objetivos</div>
                {slideEditObs ? (
                  <textarea value={slideObjetivos} onChange={(e) => setSlideObjetivos(e.target.value)} rows={3}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }} />
                ) : (
                  <div style={{ ...VAL, whiteSpace: "pre-line", lineHeight: 1.6 }}>{slideObjetivos || "—"}</div>
                )}
              </div>

              {/* Liquidez */}
              <div style={{ ...ROW, alignItems: "center" }}>
                <div style={LABEL}>Liquidez</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                  {desejada > 0 ? (
                    <div style={{ background: okLiq ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.15)", border: `1px solid ${okLiq ? "rgba(22,163,74,0.35)" : "rgba(249,115,22,0.35)"}`, borderRadius: 10, padding: "10px 16px", minWidth: 160 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: okLiq ? "rgba(134,239,172,0.8)" : "rgba(253,186,116,0.8)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>💧 Reserva</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: okLiq ? "#4ade80" : "#fb923c", lineHeight: 1, marginBottom: 6 }}>{pctLiq}%</div>
                      <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, marginBottom: 6, overflow: "hidden" }}>
                        <div style={{ width: `${pctLiq}%`, height: "100%", background: okLiq ? "#4ade80" : "#fb923c", borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{money(liqA)} / {money(desejada)}</div>
                    </div>
                  ) : liqA > 0 ? (
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#67e8f9" }}>{money(liqA)}</div>
                  ) : null}
                  {produtos.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Produtos</div>
                      {produtos.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 6, padding: "5px 12px" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div style={{ ...ROW, alignItems: "flex-start" }}>
                <div style={LABEL}>Observações</div>
                <div style={{ flex: 1 }}>
                  {slideObs.length === 0 && !slideEditObs && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>—</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: slideEditObs && slideObs.length > 0 ? 8 : slideObs.length > 0 ? 0 : 0 }}>
                    {slideObs.map((ob, i) => {
                      const isProtegido = ob === "✅ Protegido";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, color: isProtegido ? "#4ade80" : ob === "Desprotegido" ? "#f87171" : "rgba(255,255,255,0.85)", fontWeight: isProtegido || ob === "Desprotegido" ? 700 : 400 }}>
                            {isProtegido ? "✅" : ob === "Desprotegido" ? "❌" : "⊗"} {isProtegido ? "Protegido" : ob}
                          </span>
                          {slideEditObs && (
                            <button onClick={() => setSlideObs((s) => s.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {slideEditObs && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input value={slideObsInput} onChange={(e) => setSlideObsInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && slideObsInput.trim()) { setSlideObs((s) => [...s, slideObsInput.trim()]); setSlideObsInput(""); } }}
                        placeholder="Adicionar observação…"
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "white", outline: "none", fontFamily: "inherit" }} />
                      <button onClick={() => { if (slideObsInput.trim()) { setSlideObs((s) => [...s, slideObsInput.trim()]); setSlideObsInput(""); } }}
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "5px 12px", color: "white", fontSize: 12, cursor: "pointer" }}>+</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Início da Consultoria */}
              <div style={ROW}>
                <div style={LABEL}>Início da Consultoria</div>
                <div style={{ ...VAL, fontWeight: 600 }}>{fmtInicio(client.inicio_carteira)}</div>
              </div>

              {/* Benchmark */}
              <div style={{ ...ROW, borderBottom: "none" }}>
                <div style={LABEL}>Benchmark da carteira</div>
                <div style={{ ...VAL, fontWeight: 600 }}>{fmtBenchmark(benchmarkVal)}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Apresentação Liquidez */}
      {liqModal && (() => {
        const liqA = Number(client.liquidez_atual || 0);
        const desejada = Number(client.liquidez_desejada || 0);
        const pctLiq = desejada > 0 ? Math.min(100, Math.round((liqA / desejada) * 100)) : 0;
        const ok = liqA >= desejada;
        const produtos = (client.liquidez_produtos || "")
          .split(/,|\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <div onClick={() => setLiqModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(6px)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#0d1f3c", borderRadius: 20, padding: "22px 28px", width: "100%", maxWidth: 620, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>Liquidez</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{client.nome.split(" ")[0]}</div>
              </div>

              {/* Linha horizontal: reserva à esquerda + produtos à direita */}
              <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

                {/* Card reserva */}
                {desejada > 0 && (
                  <div style={{ background: ok ? "rgba(22,163,74,0.15)" : "rgba(249,115,22,0.15)", border: `1px solid ${ok ? "rgba(22,163,74,0.35)" : "rgba(249,115,22,0.35)"}`, borderRadius: 14, padding: "16px 20px", minWidth: 200 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: ok ? "rgba(134,239,172,0.8)" : "rgba(253,186,116,0.8)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>💧 Reserva</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: ok ? "#4ade80" : "#fb923c", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>{pctLiq}%</div>
                    <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.12)", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                      <div style={{ width: `${pctLiq}%`, height: "100%", background: ok ? "#4ade80" : "#fb923c", borderRadius: 99, transition: "width .4s" }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>{money(liqA)} <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>/</span> {money(desejada)}</div>
                  </div>
                )}

                {/* Só valor, sem meta */}
                {desejada === 0 && liqA > 0 && (
                  <div style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.35)", borderRadius: 14, padding: "16px 20px", minWidth: 180 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(103,232,249,0.8)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>💧 Liquidez Atual</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#67e8f9", letterSpacing: "-0.03em" }}>{money(liqA)}</div>
                  </div>
                )}

                {/* Produtos */}
                {produtos.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>Produtos</div>
                    {produtos.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "7px 14px" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap" }}>{p}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setLiqModal(false)} style={{ width: "100%", marginTop: 16, padding: "9px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Fechar</button>
            </div>
          </div>
        );
      })()}

      {/* Modal Resumo Aportes */}
      {resumoModal && (
        <div onClick={() => setResumoModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(6px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a2744", borderRadius: 20, padding: "32px 28px", width: 260, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20, textAlign: "center" }}>
              {client.nome.split(" ")[0]} · {aptFilter.mode === "ano" ? aptFilter.ano : aptFilter.mode === "periodo" ? `${aptFilter.de?.slice(0,7) || ""}–${aptFilter.ate?.slice(0,7) || ""}` : "Desde o início"}
            </div>
            {[
              { label: "Aportado",      value: totalAp,   color: "#16a34a", bg: "rgba(22,163,74,0.12)",  border: "rgba(22,163,74,0.25)",  prefix: "" },
              { label: "Resgatado",     value: totalRe,   color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)",  prefix: "" },
              { label: "Líquido",       value: liquido,   color: liquido >= 0 ? "#34d399" : "#f87171", bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.12)", prefix: liquido >= 0 ? "+" : "" },
              { label: "Média/mês (líq.)", value: mediaMes, color: "#818cf8", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.25)", prefix: mediaMes >= 0 ? "" : "" },
            ].map(({ label, value, color, bg, border, prefix }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{prefix}{money(Math.abs(value))}</div>
              </div>
            ))}
            <button onClick={() => setResumoModal(false)} style={{ width: "100%", marginTop: 8, padding: "10px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
