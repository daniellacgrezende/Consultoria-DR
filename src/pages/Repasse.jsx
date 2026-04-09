import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { money, moneyDec, fmtComp } from "../utils/formatters";
import { parseNum } from "../utils/formatters";
import { huid } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Modal from "../components/ui/Modal";
import { Inp, SecH } from "../components/ui/FormFields";

export default function Repasse() {
  const { repasse, saveRepasse, deleteRepasse, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ competencia: "", receita_bruta: "", impostos: "", receita_liquida: "" });
  const [anoFilter, setAnoFilter] = useState("todos");
  const [delConf, setDelConf] = useState(null);

  const sorted = useMemo(() => [...repasse].sort((a, b) => a.competencia.localeCompare(b.competencia)), [repasse]);
  const anos = useMemo(() => {
    const a = new Set(repasse.map((r) => r.competencia?.slice(0, 4)).filter(Boolean));
    return ["todos", ...[...a].sort((a, b) => b.localeCompare(a))];
  }, [repasse]);
  const filtrado = useMemo(() => anoFilter === "todos" ? sorted : sorted.filter((r) => r.competencia?.startsWith(anoFilter)), [sorted, anoFilter]);

  const chartData = useMemo(() => filtrado.map((r) => ({ name: fmtComp(r.competencia), receitaBruta: Number(r.receita_bruta || 0), impostos: Number(r.impostos || 0), receitaLiquida: Number(r.receita_liquida || 0) })), [filtrado]);
  const maiorRep = useMemo(() => filtrado.length ? filtrado.reduce((mx, r) => Number(r.receita_liquida || 0) > Number(mx.receita_liquida || 0) ? r : mx, filtrado[0]) : null, [filtrado]);
  const acumulado = useMemo(() => filtrado.reduce((s, r) => s + Number(r.receita_bruta || 0), 0), [filtrado]);
  const crescUltimoMes = useMemo(() => {
    if (filtrado.length < 2) return null;
    const curr = Number(filtrado[filtrado.length - 1].receita_liquida || 0);
    const prev = Number(filtrado[filtrado.length - 2].receita_liquida || 0);
    if (!prev) return null;
    return { pct: ((curr - prev) / prev) * 100, val: curr - prev, curr, prev };
  }, [filtrado]);

  const RF = (k) => (e) => {
    const val = e.target.value;
    setForm((f) => {
      const nf = { ...f, [k]: val };
      if (k === "receita_bruta" || k === "impostos") {
        const rb = parseNum(k === "receita_bruta" ? val : nf.receita_bruta);
        const im = parseNum(k === "impostos" ? val : nf.impostos);
        nf.receita_liquida = String((rb - im).toFixed(2));
      }
      return nf;
    });
  };

  const openNew = () => { setEditId(null); setForm({ competencia: "", receita_bruta: "", impostos: "", receita_liquida: "" }); setModal(true); };
  const openEdit = (r) => { setEditId(r.id); setForm({ ...r }); setModal(true); };

  const save = async () => {
    if (!form.competencia) { setToast({ type: "error", text: "Informe a competência." }); return; }
    if (!editId && repasse.some((r) => r.competencia === form.competencia)) { setToast({ type: "error", text: "Já existe lançamento para esta competência." }); return; }
    const liq = parseNum(form.receita_bruta) - parseNum(form.impostos);
    const entry = { ...form, receita_liquida: String(liq.toFixed(2)) };
    if (!editId) entry.id = huid();
    else entry.id = editId;
    await saveRepasse(entry, !editId);
    setModal(false);
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
        <button onClick={openNew} style={{ background: B.navy, color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginTop: 4 }}>+ Novo Lançamento</button>
      </div>

      {/* Filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#8899bb", fontWeight: 700, textTransform: "uppercase" }}>Período:</span>
        {anos.map((ano) => (<button key={ano} onClick={() => setAnoFilter(ano)} style={{ padding: "5px 14px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 700, cursor: "pointer", background: anoFilter === ano ? B.navy : "white", color: anoFilter === ano ? "white" : "#8899bb", borderColor: anoFilter === ano ? B.navy : "#dde4f5" }}>{ano === "todos" ? "Todos" : ano}</button>))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: "3px solid #b45309" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>🏆 Maior Líquido</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{maiorRep ? money(maiorRep.receita_liquida) : "—"}</div>
          {maiorRep && <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{fmtComp(maiorRep.competencia)}</div>}
        </div>
        <div style={{ background: "white", border: `1px solid ${crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#bbf7d0" : "#fecaca") : B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626") : B.navy}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 5 }}>📅 vs. Mês Anterior</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: crescUltimoMes ? (crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626") : B.navy }}>{crescUltimoMes ? `${crescUltimoMes.pct >= 0 ? "+" : ""}${crescUltimoMes.pct.toFixed(1)}%` : "—"}</div>
          {crescUltimoMes && <div style={{ fontSize: 11, color: crescUltimoMes.pct >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600, marginTop: 2 }}>{crescUltimoMes.val >= 0 ? "+" : ""}{money(crescUltimoMes.val)}</div>}
        </div>
        <MiniStat icon="📊" label="Média Mensal" value={money(filtrado.length ? acumulado / filtrado.length : 0)} sub="bruta por mês" />
        <MiniStat icon="💰" label={`Acumulado ${anoFilter === "todos" ? "(Todos)" : anoFilter}`} value={money(acumulado)} sub="receita bruta total" />
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between" }}>
            <span>📊 Evolução Mensal</span>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ c: "#16a34a", l: "Líquida" }, { c: "#2563eb", l: "Bruta" }, { c: "#dc2626", l: "Impostos" }].map(({ c, l }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: B.gray }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{l}</div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
              <GradDef id="rl" c="#16a34a" /><GradDef id="rb" c="#2563eb" />
              <CartesianGrid strokeDasharray="3 3" stroke={B.border} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: B.gray }} />
              <YAxis tick={{ fontSize: 9, fill: B.gray }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
              <Tooltip formatter={(v, n) => [moneyDec(v), n === "receitaLiquida" ? "Líquida" : n === "receitaBruta" ? "Bruta" : "Impostos"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="receitaBruta" stroke="#2563eb" strokeWidth={1.5} fill="url(#rb)" fillOpacity={0.12} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="impostos" stroke="#dc2626" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="receitaLiquida" stroke="#16a34a" strokeWidth={2.5} fill="url(#rl)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${B.border}` }}><span style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>📋 Lançamentos ({filtrado.length})</span></div>
        {filtrado.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum lançamento{anoFilter !== "todos" ? ` em ${anoFilter}` : ""}.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f5f7ff" }}>{["Competência", "Receita Bruta", "Impostos", "Receita Líquida", ""].map((h) => (<th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>))}</tr></thead>
              <tbody>
                {[...filtrado].reverse().map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: B.navy, fontSize: 14 }}>{fmtComp(r.competencia)}</td>
                    <td style={{ padding: "12px 16px", color: "#2563eb", fontWeight: 600 }}>{r.receita_bruta ? money(r.receita_bruta) : "—"}</td>
                    <td style={{ padding: "12px 16px", color: "#dc2626", fontWeight: 600 }}>{r.impostos ? `- ${money(r.impostos)}` : "—"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 800, fontSize: 16, color: Number(r.receita_liquida || 0) >= 0 ? "#16a34a" : "#dc2626" }}>{r.receita_liquida ? money(r.receita_liquida) : "—"}</span></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏</button>
                        <button onClick={() => setDelConf(r.id)} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtrado.length > 0 && (
                <tfoot><tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: B.navy }}>TOTAL</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563eb" }}>{money(filtrado.reduce((s, r) => s + Number(r.receita_bruta || 0), 0))}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: "#dc2626" }}>- {money(filtrado.reduce((s, r) => s + Number(r.impostos || 0), 0))}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: "#16a34a", fontSize: 15 }}>{money(filtrado.reduce((s, r) => s + Number(r.receita_liquida || 0), 0))}</td>
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
          <div style={{ background: `linear-gradient(135deg,${B.navy},${B.navy2})`, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            <span style={{ color: "#60a5fa", fontWeight: 700 }}>Receita Bruta</span> → (−) Impostos → <span style={{ color: "#4ade80", fontWeight: 700 }}>Receita Líquida (auto)</span>
          </div>
          <Inp label="Competência *" type="month" value={form.competencia} onChange={RF("competencia")} />
          <Inp label="Receita Bruta (R$) *" type="number" value={form.receita_bruta} onChange={RF("receita_bruta")} placeholder="Valor total" />
          <Inp label="Impostos PJ (R$)" type="number" value={form.impostos} onChange={RF("impostos")} placeholder="Ex: 500" />
          <div style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 4 }}>✅ Receita Líquida</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#16a34a" }}>{money(parseNum(form.receita_bruta) - parseNum(form.impostos))}</div>
            <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>= Bruta − Impostos</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={save} style={{ flex: 2, padding: "10px", background: B.navy, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{editId ? "SALVAR" : "ADICIONAR"}</button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>⚠️ Remover lançamento?</h3>
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
