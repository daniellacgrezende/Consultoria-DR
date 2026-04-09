import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { B, PERFIL_MAP, EMPTY_CLIENT, LEAD_ORIGENS, PERIOD_OPTIONS } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, daysSince, huid, cuid } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import { SBadge, PBadge, CBadge } from "../components/ui/Badge";
import { Inp, Sel, Tarea, Chk, SecH } from "../components/ui/FormFields";

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [query, setQuery] = useState("");
  const [filterCurva, setFilterCurva] = useState("all");
  const [showAUM, setShowAUM] = useState(false);
  const [sortCol, setSortCol] = useState("nome");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    const load = async () => {
      const [c, h] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("history").select("*"),
      ]);
      setClients(c.data || []);
      setHistory(h.data || []);
    };
    load();
  }, []);

  const active = clients.filter((c) => c.status === "ativo");
  const getPL = (c) => getCurrentPL(c, history);
  const totalAUM = active.reduce((s, c) => s + getPL(c), 0);

  const rows = active
    .map((c) => ({ ...c, _pl: getPL(c), _curva: getCurva(getPL(c)) }))
    .filter((c) => filterCurva === "all" || c._curva === filterCurva)
    .filter((c) => !query || `${c.nome} ${c.profissao} ${c.cidade}`.toLowerCase().includes(query.toLowerCase()));

  const d = sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (sortCol === "nome") return d * a.nome.localeCompare(b.nome);
    if (sortCol === "pl") return d * (a._pl - b._pl);
    return 0;
  });

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async () => {
    if (!form.nome?.trim()) return;
    if (editId) {
      const { data } = await supabase.from("clients").update(form).eq("id", editId).select();
      if (data) setClients((p) => p.map((c) => (c.id === editId ? data[0] : c)));
    } else {
      const newClient = { ...form, id: cuid() };
      const { data } = await supabase.from("clients").insert(newClient).select();
      if (data) setClients((p) => [data[0], ...p]);
    }
    setModal(false);
  };

  const openNew = () => { setEditId(null); setForm(EMPTY_CLIENT); setModal(true); };
  const openEdit = (c) => { setEditId(c.id); setForm({ ...c }); setModal(true); };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Carteira" title="Clientes 👥" desc="Gestão completa da sua carteira de clientes." />
        <button onClick={openNew} style={{ padding: "8px 18px", background: B.navy, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Novo Cliente</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat icon="👥" label="Ativos" value={active.length} sub={`${rows.length} exibidos`} />
        <div onClick={() => setShowAUM((v) => !v)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}`, cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>💼 AUM {showAUM ? "🔓" : "🔒"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{showAUM ? money(totalAUM) : "• • • • •"}</div>
        </div>
        <MiniStat icon="📊" label="Curvas" value={`A:${active.filter((c) => getCurva(getPL(c)) === "A").length} B:${active.filter((c) => getCurva(getPL(c)) === "B").length} C:${active.filter((c) => getCurva(getPL(c)) === "C").length}`} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Buscar..." style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, color: B.navy, outline: "none", minWidth: 220 }} />
        {["all", "A", "B", "C", "D"].map((k) => (
          <button key={k} onClick={() => setFilterCurva(k)} style={{ padding: "5px 12px", borderRadius: 999, border: "1px solid", fontSize: 11, fontWeight: 700, cursor: "pointer", background: filterCurva === k ? "#e8eeff" : "white", color: filterCurva === k ? B.navy : "#8899bb", borderColor: filterCurva === k ? B.navy + "66" : "#dde4f5" }}>{k === "all" ? "Todos" : `Curva ${k}`}</button>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[{ col: "nome", label: "Nome" }, { col: null, label: "Cidade/UF" }, { col: "pl", label: "PL" }, { col: null, label: "Perfil" }, { col: null, label: "Curva" }, { col: null, label: "" }].map(({ col, label }) => (
                  <th key={label || "actions"} onClick={col ? () => toggleSort(col) : undefined} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, background: "#f5f7ff", cursor: col ? "pointer" : "default", whiteSpace: "nowrap" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum cliente</td></tr>}
              {rows.map((c, i) => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)} style={{ cursor: "pointer", borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar nome={c.nome} size={32} />
                      <div>
                        <span style={{ fontWeight: 600, color: B.navy }}>{c.nome}</span>
                        {c.grupo_nome && <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600 }}>🔗 {c.grupo_nome}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: B.gray, fontSize: 12 }}>{c.cidade && c.uf ? `${c.cidade}/${c.uf}` : "—"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: B.navy }} onClick={(e) => { e.stopPropagation(); setShowAUM((v) => !v); }}>{showAUM ? money(c._pl) : "• • •"}</td>
                  <td style={{ padding: "10px 12px" }}><PBadge p={c.perfil} /></td>
                  <td style={{ padding: "10px 12px" }}><CBadge curva={c._curva} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} wide>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar Cliente" : "Novo Cliente"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={form.nome} onChange={F("nome")} placeholder="Nome" /></div>
            <Inp label="Cidade" value={form.cidade} onChange={F("cidade")} />
            <Inp label="UF" value={form.uf} onChange={F("uf")} />
            <Inp label="Profissão" value={form.profissao} onChange={F("profissao")} />
            <Sel label="Estado Civil" value={form.estadoCivil || form.estado_civil || ""} onChange={F("estado_civil")} opts={[{ v: "", l: "—" }, { v: "Solteiro", l: "Solteiro" }, { v: "Casado", l: "Casado" }, { v: "Divorciado", l: "Divorciado" }, { v: "Viúvo", l: "Viúvo" }, { v: "União estável", l: "União estável" }]} />
            <Sel label="Status" value={form.status} onChange={F("status")} opts={[{ v: "ativo", l: "Ativo" }, { v: "inativo", l: "Inativo" }]} />
            <Sel label="Perfil" value={form.perfil} onChange={F("perfil")} opts={Object.entries(PERFIL_MAP).map(([k, v]) => ({ v: k, l: v.label }))} />
            <Inp label="PL Inicial (R$)" value={form.pl_inicial || form.plInicial || ""} onChange={F("pl_inicial")} type="number" />
            <Inp label="Aporte Mensal (R$)" value={form.aporte_mensal || form.aporteMensal || ""} onChange={F("aporte_mensal")} type="number" />
            <Inp label="Meta Patrimonial (R$)" value={form.meta_patrimonio || form.metaPatrimonio || ""} onChange={F("meta_patrimonio")} type="number" />
            <Inp label="Taxa Contratada" value={form.taxa_contratada || form.taxaContratada || ""} onChange={F("taxa_contratada")} />
            <Sel label="Forma Pagamento" value={form.forma_pagamento || form.formaPagamento || "XP"} onChange={F("forma_pagamento")} opts={["XP", "BTG", "Boleto", "Outros"].map((v) => ({ v, l: v }))} />
            <Inp label="Início Carteira" value={form.inicio_carteira || form.inicioCarteira || ""} onChange={F("inicio_carteira")} type="date" />
            <Inp label="Última Reunião" value={form.ultima_reuniao || form.ultimaReuniao || ""} onChange={F("ultima_reuniao")} type="date" />
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 6 }}>Origem</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {LEAD_ORIGENS.map((o) => (
                  <button key={o} type="button" onClick={() => setForm((f) => ({ ...f, origem_cliente: o }))} style={{ padding: "5px 14px", borderRadius: 999, border: "1px solid", fontSize: 11, fontWeight: 700, cursor: "pointer", background: (form.origem_cliente || form.origemCliente) === o ? B.navy : "white", color: (form.origem_cliente || form.origemCliente) === o ? "white" : "#8899bb", borderColor: (form.origem_cliente || form.origemCliente) === o ? B.navy : "#dde4f5" }}>{o}</button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1/-1" }}><Tarea label="Observações" value={form.observacoes} onChange={F("observacoes")} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.navy, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "CADASTRAR"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
