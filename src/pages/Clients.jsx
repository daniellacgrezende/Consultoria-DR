import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP, EMPTY_CLIENT, LEAD_ORIGENS, PERIOD_OPTIONS } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, daysSince, cuid, slugify } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { PBadge, CBadge } from "../components/ui/Badge";
import { Inp, Sel, Tarea, SecH } from "../components/ui/FormFields";

export default function Clients() {
  const navigate = useNavigate();
  const { clients, history, saveClient, deleteClient, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [query, setQuery] = useState("");
  const [filterCurva, setFilterCurva] = useState("all");
  const [filterPerfil, setFilterPerfil] = useState("all");
  const [filterSeguro, setFilterSeguro] = useState("all");
  const [plMin, setPlMin] = useState("");
  const [plMax, setPlMax] = useState("");
  const [sortCol, setSortCol] = useState("nome");
  const [sortDir, setSortDir] = useState("asc");
  const [ufFilter, setUfFilter] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showPL, setShowPL] = useState(false);
  const [atrasoPanel, setAtrasoPanel] = useState(null); // null | "precisaChamar" | "jaChamei"

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);
  const getPL = (c) => getCurrentPL(c, history);
  const totalAUM = useMemo(() => active.reduce((s, c) => s + getPL(c), 0), [active, history]);
  const PDAYS = { mensal: 30, bimestral: 60, trimestral: 90, quadrimestral: 120, semestral: 180, anual: 365 };
  const isLate = (c) => {
    const p = (c.periodicidade_reuniao || c.periodicidadeReuniao || "Trimestral").toLowerCase();
    if (p === "não se aplica") return false;
    const proxima = c.proxima_reuniao || c.proximaReuniao;
    if (proxima) return new Date(proxima) < new Date();
    const d = daysSince(c.ultima_reuniao || c.ultimaReuniao);
    return d !== null && d > Math.round((PDAYS[p] || 90) * 0.83);
  };
  const isChamei = (c) => {
    const dAv = daysSince(c.avisado_em || c.avisadoEm);
    const p = (c.periodicidade_reuniao || c.periodicidadeReuniao || "Trimestral").toLowerCase();
    return dAv !== null && dAv <= (PDAYS[p] || 90) + 10;
  };
  const precisaChamar = useMemo(() => active.filter((c) => isLate(c) && !isChamei(c)), [active]);
  const jaChamei = useMemo(() => active.filter((c) => isLate(c) && isChamei(c)), [active]);
  const alertas75 = precisaChamar.length + jaChamei.length;

  const ufs = useMemo(() => [...new Set(active.map((c) => (c.uf || "").toUpperCase()).filter(Boolean))].sort(), [active]);

  const rows = useMemo(() => {
    let r = active.map((c) => ({ ...c, _pl: getPL(c), _curva: getCurva(getPL(c)) }));
    if (filterCurva !== "all") r = r.filter((c) => c._curva === filterCurva);
    if (filterPerfil !== "all") r = r.filter((c) => (c.perfil || "") === filterPerfil);
    if (filterSeguro === "sim") r = r.filter((c) => c.seguro_vida || c.seguroVida);
    if (filterSeguro === "nao") r = r.filter((c) => !c.seguro_vida && !c.seguroVida);
    if (ufFilter) r = r.filter((c) => (c.uf || "").toUpperCase() === ufFilter);
    if (plMin !== "") r = r.filter((c) => c._pl >= Number(plMin));
    if (plMax !== "") r = r.filter((c) => c._pl <= Number(plMax));
    if (query) r = r.filter((c) => `${c.nome} ${c.profissao} ${c.cidade} ${c.grupo_nome || c.grupoNome || ""}`.toLowerCase().includes(query.toLowerCase()));
    const d = sortDir === "asc" ? 1 : -1;
    r.sort((a, b) => {
      if (sortCol === "nome") return d * a.nome.localeCompare(b.nome);
      if (sortCol === "pl") return d * (a._pl - b._pl);
      if (sortCol === "curva") return d * a._curva.localeCompare(b._curva);
      if (sortCol === "perfil") return d * (a.perfil || "").localeCompare(b.perfil || "");
      if (sortCol === "proxima_reuniao") {
        const da = new Date(a.proxima_reuniao || a.proximaReuniao || "9999-12-31");
        const db = new Date(b.proxima_reuniao || b.proximaReuniao || "9999-12-31");
        return d * (da - db);
      }
      return 0;
    });
    return r;
  }, [active, history, filterCurva, filterPerfil, filterSeguro, ufFilter, plMin, plMax, query, sortCol, sortDir]);

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleSort = (col) => { if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortCol(col); setSortDir("asc"); } };

  const save = async () => {
    if (!form.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const isNew = !editId;
    if (isNew) form.id = cuid();
    else form.id = editId;
    const newId = await saveClient(form, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Cadastrado." : "Atualizado." });
    if (isNew && newId) navigate(`/clients/${slugify(form.nome)}`);
  };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_CLIENT }); setModal(true); };
  const openEdit = (c) => { setEditId(c.id); setForm({ ...c }); setModal(true); };

  const importRef = useRef(null);
  const importPlRef = useRef(null);

  const COLS = [
    { h: "Nome", f: "nome" }, { h: "Data Nascimento", f: "data_nascimento" },
    { h: "Cidade", f: "cidade" }, { h: "UF", f: "uf" },
    { h: "Estado Civil", f: "estado_civil" }, { h: "Filhos", f: "filhos" },
    { h: "Cônjuge", f: "conjuge" }, { h: "Profissão", f: "profissao" },
    { h: "Hobbies", f: "hobbies" }, { h: "Status", f: "status" },
    { h: "Perfil", f: "perfil" }, { h: "PL Atual (R$)", f: "pl_inicial" },
    { h: "Aporte Mensal (R$)", f: "aporte_mensal" }, { h: "Meta Patrimônio (R$)", f: "meta_patrimonio" },
    { h: "Liquidez Desejada (R$)", f: "liquidez_desejada" }, { h: "Liquidez Atual (R$)", f: "liquidez_atual" },
    { h: "Produtos Liquidez", f: "liquidez_produtos" }, { h: "Taxa Contratada", f: "taxa_contratada" },
    { h: "Receita Mensal (R$)", f: "receita_mensal" }, { h: "Forma Pagamento", f: "forma_pagamento" },
    { h: "Declaração IR", f: "declaracao_ir" }, { h: "Corretoras", f: "corretoras" },
    { h: "Origem", f: "origem_cliente" }, { h: "Grupo", f: "grupo_nome" },
    { h: "Seguro de Vida", f: "seguro_vida" }, { h: "PGBL", f: "pgbl" },
    { h: "VGBL", f: "vgbl" }, { h: "IPS Enviada", f: "envio_ips" },
    { h: "Sucessão", f: "sucessao" }, { h: "Desbalanceado", f: "cliente_desbalanceado" },
    { h: "Início Carteira", f: "inicio_carteira" }, { h: "Última Reunião", f: "ultima_reuniao" },
    { h: "Próxima Reunião", f: "proxima_reuniao" }, { h: "Último Relatório", f: "ultimo_relatorio" },
    { h: "Periodicidade Reunião", f: "periodicidade_reuniao" }, { h: "Periodicidade Relatório", f: "periodicidade_relatorio" },
    { h: "Observação Rápida", f: "observacao_rapida" }, { h: "Planejamento", f: "planejamento" },
    { h: "Observações", f: "observacoes" }, { h: "Link Rebalanceamento", f: "link_rebalanceamento" },
  ];

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      COLS.map((c) => c.h),
      ...clients.map((cl) => COLS.map((c) => {
        const v = cl[c.f] ?? cl[Object.keys(EMPTY_CLIENT).find((k) => k.replace(/_([a-z])/g, (_, l) => l.toUpperCase()) === c.f.replace(/_([a-z])/g, (_, l) => l.toUpperCase()))] ?? "";
        if (typeof v === "boolean") return v ? "Sim" : "Não";
        return v ?? "";
      })),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = COLS.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes.xlsx");
    setToast({ type: "success", text: `${clients.length} clientes exportados.` });
  };

  const importXlsx = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (data.length < 2) { setToast({ type: "error", text: "Planilha vazia." }); return; }
        const headers = data[0];
        const colIdx = {};
        COLS.forEach((c) => { const i = headers.indexOf(c.h); if (i >= 0) colIdx[c.f] = i; });

        // Monta entradas da planilha
        const entries = [];
        for (const row of data.slice(1)) {
          if (!row[colIdx["nome"]]) continue;
          const entry = { ...EMPTY_CLIENT };
          COLS.forEach((c) => {
            if (colIdx[c.f] === undefined) return;
            const val = row[colIdx[c.f]];
            if (["seguro_vida", "pgbl", "vgbl", "envio_ips", "cliente_desbalanceado"].includes(c.f)) {
              entry[c.f] = val === "Sim" || val === true;
            } else {
              entry[c.f] = val ?? "";
            }
          });
          entry.status = entry.status || "ativo";
          entries.push(entry);
        }

        // Detecta duplicatas por nome normalizado
        const duplicatas = entries.filter((e) =>
          clients.some((c) => (c.nome || "").trim().toLowerCase() === (e.nome || "").trim().toLowerCase())
        );

        let acao = "criar"; // padrão: criar todos
        if (duplicatas.length > 0) {
          const nomes = duplicatas.slice(0, 5).map((d) => d.nome).join(", ");
          const sufixo = duplicatas.length > 5 ? ` e mais ${duplicatas.length - 5}` : "";
          const resp = window.confirm(
            `${duplicatas.length} cliente(s) já existem no sistema:\n${nomes}${sufixo}\n\nOK → Sobrescrever os existentes\nCancelar → Pular duplicatas (importar só os novos)`
          );
          acao = resp ? "sobrescrever" : "pular";
        }

        let criados = 0, atualizados = 0, pulados = 0;
        for (const entry of entries) {
          const existente = clients.find(
            (c) => (c.nome || "").trim().toLowerCase() === (entry.nome || "").trim().toLowerCase()
          );
          if (existente) {
            if (acao === "sobrescrever") {
              await saveClient({ ...entry, id: existente.id }, false);
              atualizados++;
            } else {
              pulados++;
            }
          } else {
            entry.id = cuid();
            await saveClient(entry, true);
            criados++;
          }
        }

        const partes = [];
        if (criados > 0) partes.push(`${criados} criados`);
        if (atualizados > 0) partes.push(`${atualizados} sobrescritos`);
        if (pulados > 0) partes.push(`${pulados} pulados`);
        setToast({ type: "success", text: partes.join(" · ") + "." });
      } catch {
        setToast({ type: "error", text: "Erro ao ler planilha." });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // ── Exporta template de 2 colunas para atualização mensal de PL ──
  const exportPlTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome", "PL Atual (R$)"],
      ["Exemplo: João Silva", "150000"],
    ]);
    ws["!cols"] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "PL Mensal");
    XLSX.writeFile(wb, "template_pl_mensal.xlsx");
    setToast({ type: "success", text: "Template exportado." });
  };

  // ── Importação mensal: atualiza apenas pl_inicial dos clientes existentes ──
  const importPlXlsx = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (data.length < 2) { setToast({ type: "error", text: "Planilha vazia." }); return; }
        const headers = data[0];
        const nomeIdx = headers.indexOf("Nome");
        const plIdx = headers.indexOf("PL Atual (R$)");
        if (nomeIdx < 0 || plIdx < 0) {
          setToast({ type: "error", text: 'Planilha precisa ter colunas "Nome" e "PL Atual (R$)".' });
          return;
        }
        let updated = 0;
        const notFound = [];
        for (const row of data.slice(1)) {
          const nomePlanilha = String(row[nomeIdx] || "").trim().toLowerCase();
          if (!nomePlanilha) continue;
          const pl = Number(row[plIdx]) || 0;
          const found = clients.find((c) => (c.nome || "").trim().toLowerCase() === nomePlanilha);
          if (!found) { notFound.push(row[nomeIdx]); continue; }
          await saveClient({ ...found, pl_inicial: pl }, false);
          updated++;
        }
        const nfMsg = notFound.length > 0 ? ` Não encontrados (${notFound.length}): ${notFound.slice(0, 5).join(", ")}${notFound.length > 5 ? "…" : ""}.` : "";
        setToast({ type: updated > 0 ? "success" : "error", text: `${updated} PL(s) atualizados.${nfMsg}` });
      } catch {
        setToast({ type: "error", text: "Erro ao ler planilha de PL." });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const selStyle = { background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, color: B.navy, outline: "none", cursor: "pointer", fontFamily: "inherit" };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return <span style={{ color: B.navy, fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Carteira" title="Clientes" desc="Gestão completa da sua carteira." />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Importação cadastral */}
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importXlsx} />
          <button onClick={() => importRef.current?.click()} style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↑ Importar</button>
          <button onClick={exportXlsx} style={{ padding: "8px 14px", background: "white", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↓ Exportar</button>
          {/* Atualização mensal de PL */}
          <input ref={importPlRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importPlXlsx} />
          <button onClick={() => importPlRef.current?.click()} style={{ padding: "8px 14px", background: "white", color: "#7c3aed", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↑ Atualizar PL</button>
          <button onClick={exportPlTemplate} style={{ padding: "8px 14px", background: "white", color: "#7c3aed", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↓ Template PL</button>
          <button onClick={openNew} style={{ padding: "8px 18px", background: B.brand, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Novo Cliente</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        {/* Clientes Ativos — oculto por padrão */}
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.brand}`, cursor: "pointer", userSelect: "none" }} onClick={() => setShowStats((s) => !s)}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
            <span>Clientes Ativos</span>
            <span style={{ fontSize: 10, color: B.muted }}>{showStats ? "🙈" : "👁"}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showStats ? active.length : "••••"}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{showStats ? `${rows.length} exibidos` : "clique para revelar"}</div>
        </div>
        {/* AUM — oculto por padrão */}
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }} onClick={() => setShowStats((s) => !s)}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
            <span>AUM</span>
            <span style={{ fontSize: 10, color: B.muted }}>{showStats ? "🙈" : "👁"}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showStats ? money(totalAUM) : "R$ ••••••"}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{showStats ? "patrimônio total" : "clique para revelar"}</div>
        </div>
        <div style={{ background: "white", border: `1px solid ${alertas75 > 0 ? "#fecaca" : B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${alertas75 > 0 ? "#dc2626" : B.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 8 }}>Reunião em Atraso</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div onClick={() => setAtrasoPanel((p) => p === "precisaChamar" ? null : "precisaChamar")} style={{ flex: 1, background: atrasoPanel === "precisaChamar" ? "#fee2e2" : precisaChamar.length > 0 ? "#fff5f5" : "#f8faff", border: `1px solid ${precisaChamar.length > 0 ? "#fecaca" : B.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: precisaChamar.length > 0 ? "#dc2626" : B.muted }}>{precisaChamar.length}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: precisaChamar.length > 0 ? "#dc2626" : B.muted, textTransform: "uppercase", marginTop: 2 }}>📞 Preciso chamar</div>
            </div>
            <div onClick={() => setAtrasoPanel((p) => p === "jaChamei" ? null : "jaChamei")} style={{ flex: 1, background: atrasoPanel === "jaChamei" ? "#cffafe" : jaChamei.length > 0 ? "#ecfeff" : "#f8faff", border: `1px solid ${jaChamei.length > 0 ? "#a5f3fc" : B.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: jaChamei.length > 0 ? "#0891b2" : B.muted }}>{jaChamei.length}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: jaChamei.length > 0 ? "#0891b2" : B.muted, textTransform: "uppercase", marginTop: 2 }}>✓ Já chamei</div>
            </div>
          </div>
        </div>
      </div>

      {/* Painel expansível de atraso */}
      {atrasoPanel && (
        <Card style={{ marginBottom: 12, border: `1px solid ${atrasoPanel === "precisaChamar" ? "#fecaca" : "#a5f3fc"}`, background: atrasoPanel === "precisaChamar" ? "#fff9f9" : "#f0feff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: atrasoPanel === "precisaChamar" ? "#dc2626" : "#0891b2" }}>
              {atrasoPanel === "precisaChamar" ? "📞 Preciso chamar" : "✓ Já chamei"}
            </div>
            <button onClick={() => setAtrasoPanel(null)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: B.muted }}>×</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(atrasoPanel === "precisaChamar" ? precisaChamar : jaChamei).map((c) => (
              <div key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 7, background: "white", border: `1px solid ${atrasoPanel === "precisaChamar" ? "#fecaca" : "#a5f3fc"}`, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar nome={c.nome} size={26} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: B.navy }}>{c.nome}</div>
                    <div style={{ fontSize: 10, color: B.muted }}>{c.proxima_reuniao || c.proximaReuniao ? `Próxima: ${fmtDate(c.proxima_reuniao || c.proximaReuniao)}` : "Sem data definida"}</div>
                  </div>
                </div>
                {atrasoPanel === "jaChamei" && (c.avisado_em || c.avisadoEm) && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#0891b2" }}>Chamei em</div>
                    <div style={{ fontSize: 11, color: B.navy, fontWeight: 600 }}>{fmtDate(c.avisado_em || c.avisadoEm)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, profissão, cidade..."
          style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, color: B.navy, outline: "none", minWidth: 240, flex: "1 1 200px" }}
        />
        <select value={ufFilter} onChange={(e) => setUfFilter(e.target.value)} style={selStyle}>
          <option value="">UF (todas)</option>
          {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterCurva} onChange={(e) => setFilterCurva(e.target.value)} style={selStyle}>
          <option value="all">Curva (todas)</option>
          {["A", "B", "C", "D"].map((k) => <option key={k} value={k}>Curva {k}</option>)}
        </select>
        <select value={filterPerfil} onChange={(e) => setFilterPerfil(e.target.value)} style={selStyle}>
          <option value="all">Perfil (todos)</option>
          {Object.entries(PERFIL_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterSeguro} onChange={(e) => setFilterSeguro(e.target.value)} style={selStyle}>
          <option value="all">Seguro (todos)</option>
          <option value="sim">Com seguro</option>
          <option value="nao">Sem seguro</option>
        </select>
        <input
          value={plMin} onChange={(e) => setPlMin(e.target.value)}
          placeholder="PL mínimo (R$)"
          type="number" min="0"
          style={{ ...selStyle, minWidth: 130 }}
        />
        <input
          value={plMax} onChange={(e) => setPlMax(e.target.value)}
          placeholder="PL máximo (R$)"
          type="number" min="0"
          style={{ ...selStyle, minWidth: 130 }}
        />
        {(ufFilter || filterCurva !== "all" || filterPerfil !== "all" || filterSeguro !== "all" || plMin || plMax) && (
          <button
            onClick={() => { setUfFilter(""); setFilterCurva("all"); setFilterPerfil("all"); setFilterSeguro("all"); setPlMin(""); setPlMax(""); }}
            style={{ fontSize: 11, padding: "7px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: "white", color: B.muted, cursor: "pointer", whiteSpace: "nowrap" }}
          >Limpar filtros</button>
        )}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort("nome")} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer" }}>Nome <SortIcon col="nome" /></th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Cidade/UF</th>
                <th onClick={() => toggleSort("pl")} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer", userSelect: "none" }}>
                  PL <SortIcon col="pl" />
                  <span onClick={(e) => { e.stopPropagation(); setShowPL((v) => !v); }} style={{ marginLeft: 6, fontSize: 11, cursor: "pointer" }}>{showPL ? "🙈" : "👁"}</span>
                </th>
                <th onClick={() => toggleSort("perfil")} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer" }}>Perfil <SortIcon col="perfil" /></th>
                <th onClick={() => toggleSort("proxima_reuniao")} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer" }}>Próx. Reunião <SortIcon col="proxima_reuniao" /></th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff" }}>Seguro</th>
                <th onClick={() => toggleSort("curva")} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: "pointer" }}>Curva <SortIcon col="curva" /></th>
                <th style={{ padding: "10px 12px", background: "#f5f7ff", borderBottom: `1px solid ${B.border}` }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum cliente</td></tr>}
              {rows.map((c, i) => {
                const dR = daysSince(c.ultima_reuniao || c.ultimaReuniao);
                const proximaReu = c.proxima_reuniao || c.proximaReuniao;
                const rW = isLate(c);
                const chameiFlg = rW && isChamei(c);
                const seguroVal = c.seguro_vida ?? c.seguroVida;
                const seguroNA = seguroVal === "nao_aplica";
                const hasSeguro = !seguroNA && (seguroVal === true || seguroVal === "true");
                const grupoNome = c.grupo_nome || c.grupoNome;
                return (
                  <tr key={c.id} onClick={() => navigate(`/clients/${slugify(c.nome)}`)} style={{ cursor: "pointer", borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar nome={c.nome} size={32} />
                        <div>
                          <span style={{ fontWeight: 600, color: B.navy }}>{c.nome}</span>
                          {grupoNome && <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600 }}>{grupoNome}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", color: B.gray, fontSize: 12 }}>{c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade || "—"}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: B.navy }}>{showPL ? money(c._pl) : <span style={{ color: B.muted, letterSpacing: 2 }}>••••</span>}</td>
                    <td style={{ padding: "10px 12px" }}><PBadge p={c.perfil} /></td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, color: chameiFlg ? "#0891b2" : rW ? "#dc2626" : "#444", fontWeight: rW ? 700 : 400 }}>{proximaReu ? fmtDate(proximaReu) : "—"}</span>
                      {chameiFlg && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, background: "#ecfeff", color: "#0891b2", border: "1px solid #a5f3fc", borderRadius: 999, padding: "1px 6px" }}>✓ chamei</span>}
                      {rW && !chameiFlg && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 999, padding: "1px 6px" }}>chamar</span>}
                    </td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 12, fontWeight: 600, color: seguroNA ? "#9ca3af" : hasSeguro ? "#16a34a" : "#9ca3af" }}>{seguroNA ? "N/A" : hasSeguro ? "Sim" : "Não"}</span></td>
                    <td style={{ padding: "10px 12px" }}><CBadge curva={c._curva} /></td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Editar</button>
                      <button onClick={async (e) => { e.stopPropagation(); if (window.confirm(`Excluir "${c.nome}"?\n\nEsta ação não pode ser desfeita.`)) { await deleteClient(c.id); setToast({ type: "success", text: `${c.nome} excluído.` }); } }} style={{ marginLeft: 6, background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Excluir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ═══ MODAL CADASTRO ═══ */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Cliente" : "Novo Cliente"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}` }}>Dados Pessoais</div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={form.nome} onChange={F("nome")} placeholder="Nome" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px", gap: 8 }}><Inp label="Cidade" value={form.cidade} onChange={F("cidade")} /><Inp label="UF" value={form.uf} onChange={F("uf")} /></div>
            <Inp label="Profissão" value={form.profissao} onChange={F("profissao")} />
            <Sel label="Estado Civil" value={form.estado_civil || form.estadoCivil || ""} onChange={F("estado_civil")} opts={[{ v: "", l: "—" }, { v: "Solteiro", l: "Solteiro" }, { v: "Casado", l: "Casado" }, { v: "Divorciado", l: "Divorciado" }, { v: "Viúvo", l: "Viúvo" }, { v: "União estável", l: "União estável" }]} />
            <Inp label="Filhos" value={form.filhos} onChange={F("filhos")} />
            <Inp label="Cônjuge" value={form.conjuge} onChange={F("conjuge")} />
            <Inp label="Data Nascimento" value={form.data_nascimento || form.dataNascimento || ""} onChange={F("data_nascimento")} type="date" />
            <div style={{ gridColumn: "1/-1" }}><Inp label="Hobbies" value={form.hobbies} onChange={F("hobbies")} /></div>

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Status e Perfil</div>
            <Sel label="Status" value={form.status} onChange={F("status")} opts={[{ v: "ativo", l: "Ativo" }, { v: "inativo", l: "Inativo" }]} />
            <Sel label="Perfil" value={form.perfil} onChange={F("perfil")} opts={Object.entries(PERFIL_MAP).map(([k, v]) => ({ v: k, l: v.label }))} />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Financeiro</div>
            <Inp label="PL Atual (R$)" value={form.pl_inicial ?? form.plInicial ?? ""} onChange={F("pl_inicial")} type="number" />
            <Inp label="Aporte Mensal (R$)" value={form.aporte_mensal ?? form.aporteMensal ?? ""} onChange={F("aporte_mensal")} type="number" />
            <Inp label="Meta Patrimonial (R$)" value={form.meta_patrimonio ?? form.metaPatrimonio ?? ""} onChange={F("meta_patrimonio")} type="number" />
            <Inp label="Liquidez Desejada (R$)" value={form.liquidez_desejada ?? form.liquidezDesejada ?? ""} onChange={F("liquidez_desejada")} type="number" />
            <Inp label="Taxa Contratada" value={form.taxa_contratada ?? form.taxaContratada ?? ""} onChange={F("taxa_contratada")} />
            <Inp label="Receita Mensal (R$)" value={form.receita_mensal ?? form.receitaMensal ?? ""} onChange={F("receita_mensal")} type="number" />
            <Sel label="Forma Pagamento" value={form.forma_pagamento ?? form.formaPagamento ?? "XP"} onChange={F("forma_pagamento")} opts={["XP", "BTG", "Boleto", "Outros"].map((v) => ({ v, l: v }))} />
            <Sel label="Declaração IR" value={form.declaracao_ir ?? form.declaracaoIR ?? "Simplificada"} onChange={F("declaracao_ir")} opts={["Simplificada", "Completa"].map((v) => ({ v, l: v }))} />
            <div style={{ gridColumn: "1/-1" }}><Inp label="Corretoras" value={form.corretoras || ""} onChange={F("corretoras")} placeholder="XP, BTG, Avenue…" /></div>

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Origem</div>
            <div style={{ gridColumn: "1/-1" }}>
              <Sel label="Origem" value={form.origem_cliente || form.origemCliente || ""} onChange={F("origem_cliente")} opts={[{ v: "", l: "—" }, ...LEAD_ORIGENS.map((o) => ({ v: o, l: o }))]} />
            </div>

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Datas</div>
            <Inp label="Início Carteira" value={form.inicio_carteira ?? form.inicioCarteira ?? ""} onChange={F("inicio_carteira")} type="date" />
            <Inp label="Última Reunião" value={form.ultima_reuniao ?? form.ultimaReuniao ?? ""} onChange={F("ultima_reuniao")} type="date" />
            <Inp label="Próxima Reunião" value={form.proxima_reuniao ?? form.proximaReuniao ?? ""} onChange={F("proxima_reuniao")} type="date" />
            <Inp label="Último Relatório" value={form.ultimo_relatorio ?? form.ultimoRelatorio ?? ""} onChange={F("ultimo_relatorio")} type="date" />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Reuniões e Relatórios</div>
            <Sel label="Periodicidade Reunião" value={form.periodicidade_reuniao || form.periodicidadeReuniao || "Trimestral"} onChange={F("periodicidade_reuniao")} opts={PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))} />
            <Sel label="Periodicidade Relatório" value={form.periodicidade_relatorio || form.periodicidadeRelatorio || ""} onChange={F("periodicidade_relatorio")} opts={[{ v: "", l: "—" }, ...PERIOD_OPTIONS.map((o) => ({ v: o, l: o }))]} />

            <div style={{ gridColumn: "1/-1", fontWeight: 700, fontSize: 11, color: B.muted, textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${B.border}`, marginTop: 6 }}>Atributos</div>
            <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 16px" }}>
              <Sel label="IPS Enviada" value={(form.envio_ips ?? form.envioIps) ? "sim" : "nao"}
                onChange={(e) => setForm((f) => ({ ...f, envio_ips: e.target.value === "sim" }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }]} />
              <Sel label="Seguro de Vida" value={(form.seguro_vida ?? form.seguroVida) ? "sim" : "nao"}
                onChange={(e) => setForm((f) => ({ ...f, seguro_vida: e.target.value === "sim" }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }]} />
              <Sel label="Previdência" value={form.pgbl && form.vgbl ? "ambos" : form.pgbl ? "pgbl" : form.vgbl ? "vgbl" : "nao"}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, pgbl: v === "pgbl" || v === "ambos", vgbl: v === "vgbl" || v === "ambos" })); }}
                opts={[{ v: "nao", l: "Não" }, { v: "pgbl", l: "PGBL" }, { v: "vgbl", l: "VGBL" }, { v: "ambos", l: "PGBL e VGBL" }]} />
              <Sel label="Sucessão discutida" value={form.sucessao ? "sim" : "nao"}
                onChange={(e) => setForm((f) => ({ ...f, sucessao: e.target.value === "sim" }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }]} />
              <Sel label="Desbalanceado" value={(form.cliente_desbalanceado ?? form.clienteDesbalanceado) ? "sim" : "nao"}
                onChange={(e) => setForm((f) => ({ ...f, cliente_desbalanceado: e.target.value === "sim" }))}
                opts={[{ v: "nao", l: "Não" }, { v: "sim", l: "Sim" }]} />
            </div>

            <div style={{ gridColumn: "1/-1" }}><Inp label="Observação Rápida" value={form.observacao_rapida ?? form.observacaoRapida ?? ""} onChange={F("observacao_rapida")} placeholder="Aparece destacada na ficha" /></div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Grupo (PJ+PF)" value={form.grupo_nome ?? form.grupoNome ?? ""} onChange={F("grupo_nome")} placeholder="Nome do grupo" /></div>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Link Rebalanceamento" value={form.link_rebalanceamento ?? form.linkRebalanceamento ?? ""} onChange={F("link_rebalanceamento")} placeholder="https://…" /></div>
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Planejamento / Metas" value={form.planejamento || ""} onChange={F("planejamento")} /></div>
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Observações" value={form.observacoes || ""} onChange={F("observacoes")} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CADASTRAR"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
