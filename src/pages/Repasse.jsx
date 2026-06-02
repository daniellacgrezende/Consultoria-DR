import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { money, moneyDec, fmtComp } from "../utils/formatters";
import { huid } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Modal from "../components/ui/Modal";
import { Inp, SecH } from "../components/ui/FormFields";

// Categorias componentes (sem repasse_final)
const CATS = [
  { key: "xp",          label: "XP",          color: "#7c3aed" },
  { key: "btg",         label: "BTG",         color: "#0891b2" },
  { key: "seguro_vida", label: "Seguro Vida",  color: "#16a34a" },
  { key: "seguro_rcp",  label: "Seguro RCP",   color: "#b45309" },
  { key: "cambio",      label: "Câmbio",       color: "#dc2626" },
  { key: "outros",      label: "Outros",       color: "#6b7280" },
];

const EMPTY_FORM = { competencia: "", xp: "", btg: "", seguro_vida: "", seguro_rcp: "", cambio: "", outros: "" };

// Repasse Final = soma dos componentes (ou valor legado em repasse_final/receita_bruta)
function totalRow(r) {
  const soma = CATS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
  return soma || Number(r.repasse_final || r.receita_bruta || 0);
}

export default function Repasse() {
  const { repasse, saveRepasse, deleteRepasse, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [anoFilter, setAnoFilter] = useState("todos");
  const [delConf, setDelConf] = useState(null);

  const sorted = useMemo(() => [...repasse].sort((a, b) => a.competencia.localeCompare(b.competencia)), [repasse]);
  const anos = useMemo(() => {
    const a = new Set(repasse.map((r) => r.competencia?.slice(0, 4)).filter(Boolean));
    return ["todos", ...[...a].sort((a, b) => b.localeCompare(a))];
  }, [repasse]);
  const filtrado = useMemo(() => anoFilter === "todos" ? sorted : sorted.filter((r) => r.competencia?.startsWith(anoFilter)), [sorted, anoFilter]);

  const chartData = useMemo(() => filtrado.map((r) => {
    const total = totalRow(r) || Number(r.receita_bruta || 0);
    const obj = { name: fmtComp(r.competencia), total };
    CATS.forEach((c) => { obj[c.key] = Number(r[c.key] || 0); });
    return obj;
  }), [filtrado]);

  const acumulado = useMemo(() => filtrado.reduce((s, r) => s + (totalRow(r) || Number(r.receita_bruta || 0)), 0), [filtrado]);
  const maiorRep = useMemo(() => filtrado.length ? filtrado.reduce((mx, r) => {
    const t = totalRow(r) || Number(r.receita_bruta || 0);
    return t > (totalRow(mx) || Number(mx.receita_bruta || 0)) ? r : mx;
  }, filtrado[0]) : null, [filtrado]);
  const crescUltimoMes = useMemo(() => {
    if (filtrado.length < 2) return null;
    const curr = totalRow(filtrado[filtrado.length - 1]) || Number(filtrado[filtrado.length - 1].receita_bruta || 0);
    const prev = totalRow(filtrado[filtrado.length - 2]) || Number(filtrado[filtrado.length - 2].receita_bruta || 0);
    if (!prev) return null;
    return { pct: ((curr - prev) / prev) * 100, val: curr - prev };
  }, [filtrado]);

  // Totais por categoria (período filtrado)
  const catTotals = useMemo(() => CATS.map((c) => ({
    ...c,
    total: filtrado.reduce((s, r) => s + Number(r[c.key] || 0), 0),
  })).filter((c) => c.total > 0), [filtrado]);

  const RF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditId(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (r) => {
    setEditId(r.id);
    const f = { competencia: r.competencia };
    CATS.forEach((c) => { f[c.key] = r[c.key] != null ? String(r[c.key]) : ""; });
    setModal(true);
    setForm(f);
  };

  const save = async () => {
    if (!form.competencia) { setToast({ type: "error", text: "Informe a competência." }); return; }
    if (!editId && repasse.some((r) => r.competencia === form.competencia)) { setToast({ type: "error", text: "Já existe lançamento para esta competência." }); return; }
    const entry = { competencia: form.competencia, id: editId || huid() };
    CATS.forEach((c) => { entry[c.key] = form[c.key] !== "" ? Number(form[c.key]) : null; });
    const soma = CATS.reduce((s, c) => s + (entry[c.key] || 0), 0);
    entry.repasse_final = soma || null;
    entry.receita_bruta = soma || null;
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
          <div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{maiorRep ? money(totalRow(maiorRep) || maiorRep.receita_bruta) : "—"}</div>
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

      {/* Breakdown por categoria */}
      {catTotals.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>
            Composição do Repasse {anoFilter !== "todos" ? anoFilter : ""}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {catTotals.map(({ key, label, color, total }) => {
              const pct = acumulado > 0 ? Math.round((total / acumulado) * 100) : 0;
              return (
                <div key={key} style={{ flex: "1 1 120px", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color }}>{money(total)}</div>
                  <div style={{ fontSize: 10, color: "#9baabf", marginTop: 2 }}>{pct}% do total</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
            Evolução Mensal
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 24, left: 16, bottom: 8 }}>
              <defs>
                {CATS.map((c) => (
                  <linearGradient key={c.key} id={`grad_${c.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={B.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: B.gray }} />
              <YAxis tick={{ fontSize: 11, fill: B.gray }} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}K` : `R$${v}`} width={64} />
              <Tooltip formatter={(v, name) => [moneyDec(v), CATS.find((c) => c.key === name)?.label || name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend formatter={(name) => CATS.find((c) => c.key === name)?.label || name} wrapperStyle={{ fontSize: 11 }} />
              {CATS.filter((c) => catTotals.some((ct) => ct.key === c.key)).map((c) => (
                <Area key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} fill={`url(#grad_${c.key})`} stackId="1" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${B.border}` }}><span style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Lançamentos ({filtrado.length})</span></div>
        {filtrado.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.gray }}>Nenhum lançamento{anoFilter !== "todos" ? ` em ${anoFilter}` : ""}.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f5f7ff" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>Competência</th>
                  {CATS.map((c) => (
                    <th key={c.key} style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, color: c.color, textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{c.label}</th>
                  ))}
                  <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>Repasse Final</th>
                  <th style={{ borderBottom: `1px solid ${B.border}` }}></th>
                </tr>
              </thead>
              <tbody>
                {[...filtrado].reverse().map((r, i) => {
                  const total = totalRow(r) || Number(r.receita_bruta || 0);
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>{fmtComp(r.competencia)}</td>
                      {CATS.map((c) => (
                        <td key={c.key} style={{ padding: "10px 12px", textAlign: "right", color: Number(r[c.key] || 0) > 0 ? c.color : "#d1d5db", fontWeight: Number(r[c.key] || 0) > 0 ? 700 : 400 }}>
                          {Number(r[c.key] || 0) > 0 ? money(r[c.key]) : "—"}
                        </td>
                      ))}
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: B.navy, whiteSpace: "nowrap" }}>{total > 0 ? money(total) : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => openEdit(r)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Editar</button>
                          <button onClick={() => setDelConf(r.id)} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtrado.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: B.navy, fontSize: 12 }}>TOTAL</td>
                    {CATS.map((c) => {
                      const t = filtrado.reduce((s, r) => s + Number(r[c.key] || 0), 0);
                      return <td key={c.key} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: t > 0 ? c.color : "#d1d5db", fontSize: 12 }}>{t > 0 ? money(t) : "—"}</td>;
                    })}
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: B.navy, fontSize: 13 }}>{money(acumulado)}</td>
                    <td></td>
                  </tr>
                </tfoot>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {CATS.map((c) => (
              <div key={c.key}>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{c.label}</div>
                <input type="number" value={form[c.key]} onChange={RF(c.key)} placeholder="0"
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none", color: B.navy }} />
              </div>
            ))}
          </div>
          {CATS.some((c) => Number(form[c.key] || 0) > 0) && (
            <div style={{ background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: B.gray, fontWeight: 700 }}>Repasse Final</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: B.navy }}>{money(CATS.reduce((s, c) => s + Number(form[c.key] || 0), 0))}</span>
            </div>
          )}
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
