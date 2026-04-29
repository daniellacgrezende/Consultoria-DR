import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { money, moneyDec, fmtComp } from "../utils/formatters";
import { huid } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Modal from "../components/ui/Modal";
import { Inp, SecH } from "../components/ui/FormFields";

export default function Repasse() {
  const { repasse, saveRepasse, deleteRepasse, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ competencia: "", receita_bruta: "" });
  const [anoFilter, setAnoFilter] = useState("todos");
  const [delConf, setDelConf] = useState(null);

  const sorted = useMemo(() => [...repasse].sort((a, b) => a.competencia.localeCompare(b.competencia)), [repasse]);
  const anos = useMemo(() => {
    const a = new Set(repasse.map((r) => r.competencia?.slice(0, 4)).filter(Boolean));
    return ["todos", ...[...a].sort((a, b) => b.localeCompare(a))];
  }, [repasse]);
  const filtrado = useMemo(() => anoFilter === "todos" ? sorted : sorted.filter((r) => r.competencia?.startsWith(anoFilter)), [sorted, anoFilter]);

  const chartData = useMemo(() => filtrado.map((r) => ({ name: fmtComp(r.competencia), receitaBruta: Number(r.receita_bruta || 0) })), [filtrado]);
  const maiorRep = useMemo(() => filtrado.length ? filtrado.reduce((mx, r) => Number(r.receita_bruta || 0) > Number(mx.receita_bruta || 0) ? r : mx, filtrado[0]) : null, [filtrado]);
  const acumulado = useMemo(() => filtrado.reduce((s, r) => s + Number(r.receita_bruta || 0), 0), [filtrado]);
  const crescUltimoMes = useMemo(() => {
    if (filtrado.length < 2) return null;
    const curr = Number(filtrado[filtrado.length - 1].receita_bruta || 0);
    const prev = Number(filtrado[filtrado.length - 2].receita_bruta || 0);
    if (!prev) return null;
    return { pct: ((curr - prev) / prev) * 100, val: curr - prev, curr, prev };
  }, [filtrado]);

  const RF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditId(null); setForm({ competencia: "", receita_bruta: "" }); setModal(true); };
  const openEdit = (r) => { setEditId(r.id); setForm({ competencia: r.competencia, receita_bruta: r.receita_bruta }); setModal(true); };

  const save = async () => {
    if (!form.competencia) { setToast({ type: "error", text: "Informe a competência." }); return; }
    if (!editId && repasse.some((r) => r.competencia === form.competencia)) { setToast({ type: "error", text: "Já existe lançamento para esta competência." }); return; }
    const entry = { competencia: form.competencia, receita_bruta: form.receita_bruta, id: editId || huid() };
    await saveRepasse(entry, !editId);
    setModal(false);
    if (!editId && form.competencia) setAnoFilter(form.competencia.slice(0, 4));
    setToast({ type: "success", text: editId ? "Atualizado." : "Adicionado." });
  };

  const delRep = async (id) => {
    await deleteRepasse(id);
    setDelConf(null);
    setToast({ type: "success", text: "Removido." });
  };

  const GradDef = ({ id, c = B.navy }) => (<defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.28} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient></defs>);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Financeiro Pessoal" title="Repasse 💸" desc="Controle de receita bruta, impostos e líquido mês a mês." />
        <button onClick={openNew} style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginTop: 4 }}>+ Novo Lançamento</button>
      </div>

      {/* Filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#8899bb", fontWeight: 700, textTransform: "uppercase" }}>Período:</span>
        <select value={anoFilter} onChange={(e) => setAnoFilter(e.target.value)} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: B.navy, outline: "none", cursor: "pointer" }}>
          {anos.map((ano) => <option key={ano} value={ano}>{ano === "todos" ? "Todos os anos" : ano}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: "3px solid #b45309" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>Maior Repasse</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{maiorRep ? money(maiorRep.receita_bruta) : "—"}</div>
          {maiorRep && <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{fmtComp(maiorRep.competencia)}</div>}
        </div>
        <div style={{ background: "white", border: `1px solid ${crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#bbf7d0" : "#fecaca") : B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626") : B.navy}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>vs. Mês Anterior</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626") : B.navy }}>{crescUltimoMes ? `${crescUltimoMes.pct >= 0 ? "+" : ""}${crescUltimoMes.pct.toFixed(1)}%` : "—"}</div>
          {crescUltimoMes && <div style={{ fontSize: 11, color: crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600, marginTop: 2 }}>{crescUltimoMes.val >= 0 ? "+" : ""}{money(crescUltimoMes.val)}</div>}
        </div>
        <MiniStat label="Média Mensal" value={money(filtrado.length ? acumulado / filtrado.length : 0)} sub="por mês" />
        <MiniStat label={`Acumulado ${anoFilter === "todos" ? "(Todos)" : anoFilter}`} value={money(acumulado)} sub="total" />
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
            Evolução Mensal
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData} margin={{ top: 20, right: 24, left: 16, bottom: 8 }}>
              <GradDef id="rb" c="#2563eb" />
              <CartesianGrid strokeDasharray="3 3" stroke={B.border} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: B.gray }} />
              <YAxis
                tick={{ fontSize: 11, fill: B.gray }}
                tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}K` : `R$${v}`}
                width={70}
              />
              <Tooltip
                formatter={(v) => [moneyDec(v), "Receita Bruta"]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Area type="monotone" dataKey="receitaBruta" stroke="#2563eb" strokeWidth={3} fill="url(#rb)" dot={{ r: 5, fill: "#2563eb", strokeWidth: 2, stroke: "white" }} activeDot={{ r: 7 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${B.border}` }}><span style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Lançamentos ({filtrado.length})</span></div>
        {filtrado.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum lançamento{anoFilter !== "todos" ? ` em ${anoFilter}` : ""}.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f5f7ff" }}>{["Competência", "Receita Bruta", ""].map((h) => (<th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>))}</tr></thead>
              <tbody>
                {[...filtrado].reverse().map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: B.navy, fontSize: 14 }}>{fmtComp(r.competencia)}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 800, fontSize: 16, color: "#2563eb" }}>{r.receita_bruta ? money(r.receita_bruta) : "—"}</span></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Editar</button>
                        <button onClick={() => setDelConf(r.id)} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>Remover</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtrado.length > 0 && (
                <tfoot><tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: B.navy }}>TOTAL</td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: "#2563eb", fontSize: 15 }}>{money(filtrado.reduce((s, r) => s + Number(r.receita_bruta || 0), 0))}</td>
                  <td></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>{editId ? "Editar" : "Novo Lançamento"}</h3>
            <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <Inp label="Competência *" type="month" value={form.competencia} onChange={RF("competencia")} />
          <Inp label="Receita Bruta (R$) *" type="number" value={form.receita_bruta} onChange={RF("receita_bruta")} placeholder="Valor total" />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "ADICIONAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>Remover lançamento?</h3>
          <p style={{ color: B.gray, fontSize: 13, marginBottom: 22 }}>Esta ação não pode ser desfeita.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => delRep(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
