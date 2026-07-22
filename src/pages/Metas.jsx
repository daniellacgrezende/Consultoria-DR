import { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { huid } from "../utils/helpers";

function fM(v) {
  const n = Number(v || 0);
  return "R$ " + (n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "M";
}

function fR(v) {
  const n = Number(v || 0);
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mesLabel(mes) {
  if (!mes) return "";
  const [y, m] = mes.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(". de ", "/").replace(".", "");
}

function pctOf(real, meta) {
  if (real == null || !meta || Number(meta) === 0) return null;
  return ((Number(real) / Number(meta)) * 100).toFixed(1);
}

function statusColor(pct) {
  if (pct == null) return B.gray;
  const n = Number(pct);
  if (n >= 100) return "#16a34a";
  if (n >= 80) return "#b45309";
  return "#dc2626";
}

const EMPTY_FORM = { mes: "", auc_meta: "", auc_supermeta: "", auc_real: "", receita_planejada: "", receita_real: "" };

function ModalInput({ label, value, onChange, type = "number", placeholder, hint }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, fontFamily: "inherit", outline: "none", color: B.navy }} />
      {hint && <div style={{ fontSize: 9, color: "#9baabf", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function Metas() {
  const { metas, saveMeta, deleteMeta, setToast } = useData();
  const [modal, setModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const sorted = useMemo(() => [...metas].sort((a, b) => a.mes.localeCompare(b.mes)), [metas]);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMes = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const currentIdx = sorted.findIndex((m) => m.mes === currentMes);
  const current = sorted[currentIdx] || sorted[sorted.length - 1];
  const prev = currentIdx > 0 ? sorted[currentIdx - 1] : sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const momReceita = current?.receita_real != null && prev?.receita_real != null
    ? ((Number(current.receita_real) - Number(prev.receita_real)) / Number(prev.receita_real)) * 100
    : null;

  const chartData = sorted.map((m) => ({
    label: mesLabel(m.mes),
    meta: m.auc_meta != null ? Number(m.auc_meta) / 1e6 : null,
    supermeta: m.auc_supermeta != null ? Number(m.auc_supermeta) / 1e6 : null,
    real: m.auc_real != null ? Number(m.auc_real) / 1e6 : null,
    receita_plan: m.receita_planejada != null ? Number(m.receita_planejada) : null,
    receita_real: m.receita_real != null ? Number(m.receita_real) : null,
  }));

  const openNew = () => { setEditRow(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      mes: row.mes,
      auc_meta: row.auc_meta ?? "",
      auc_supermeta: row.auc_supermeta ?? "",
      auc_real: row.auc_real ?? "",
      receita_planejada: row.receita_planejada ?? "",
      receita_real: row.receita_real ?? "",
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.mes) return;
    const isNew = !editRow;
    const row = {
      id: editRow?.id || huid(),
      mes: form.mes,
      auc_meta: form.auc_meta !== "" ? Number(form.auc_meta) : null,
      auc_supermeta: form.auc_supermeta !== "" ? Number(form.auc_supermeta) : null,
      auc_real: form.auc_real !== "" ? Number(form.auc_real) : null,
      receita_planejada: form.receita_planejada !== "" ? Number(form.receita_planejada) : null,
      receita_real: form.receita_real !== "" ? Number(form.receita_real) : null,
    };
    await saveMeta(row, isNew);
    setModal(false);
    setToast({ type: "success", text: isNew ? "Mês adicionado." : "Mês atualizado." });
  };

  const handleDelete = async () => {
    if (!editRow || !confirm("Remover este mês?")) return;
    await deleteMeta(editRow.id);
    setModal(false);
    setToast({ type: "success", text: "Mês removido." });
  };

  const pMeta = current ? pctOf(current.auc_real, current.auc_meta) : null;
  const pSuper = current ? pctOf(current.auc_real, current.auc_supermeta) : null;
  const pReceita = current ? pctOf(current.receita_real, current.receita_planejada) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SecH eyebrow="Financeiro Pessoal" title="Metas & Performance" desc="Evolucao de AuC e receita vs metas mensais." />
        <button onClick={openNew}
          style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 8, flexShrink: 0 }}>
          + Mes
        </button>
      </div>

      {/* Cards de resumo do mes atual */}
      {current && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            {
              label: `AuC Real · ${mesLabel(current.mes)}`,
              value: current.auc_real != null ? fM(current.auc_real) : "—",
              sub: current.auc_meta ? `Meta: ${fM(current.auc_meta)}` : null,
              pct: pMeta,
              hint: "da meta",
              topColor: pMeta == null ? B.navy : Number(pMeta) >= 100 ? "#16a34a" : Number(pMeta) >= 80 ? "#f59e0b" : "#dc2626",
            },
            {
              label: "vs Supermeta",
              value: current.auc_supermeta ? fM(current.auc_supermeta) : "—",
              sub: current.auc_real != null ? `Real: ${fM(current.auc_real)}` : null,
              pct: pSuper,
              hint: "da supermeta",
              topColor: "#7c3aed",
            },
            {
              label: "Receita do Mes",
              value: current.receita_real != null ? fR(current.receita_real) : "—",
              sub: current.receita_planejada ? `Planejada: ${fR(current.receita_planejada)}` : null,
              pct: pReceita,
              hint: "do planejado",
              topColor: "#0891b2",
            },
          ].map(({ label, value, sub, pct, hint, topColor }) => (
            <div key={label} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${topColor}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: topColor }}>{value}</div>
              {sub && <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{sub}</div>}
              {pct != null && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "#8899bb" }}>{hint}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(pct) }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: "#e8eeff", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: `${Math.min(Number(pct), 100)}%`, background: statusColor(pct), borderRadius: 999, transition: "width 0.4s" }} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Crescimento MoM */}
          <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${momReceita != null && momReceita >= 0 ? "#16a34a" : momReceita != null ? "#dc2626" : B.navy}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Crescimento Receita</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: momReceita != null ? (momReceita >= 0 ? "#16a34a" : "#dc2626") : B.navy }}>
              {momReceita != null ? `${momReceita >= 0 ? "+" : ""}${momReceita.toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>vs mes anterior</div>
            {prev?.receita_real != null && (
              <div style={{ fontSize: 10, color: "#9baabf", marginTop: 4 }}>Anterior: {fR(prev.receita_real)}</div>
            )}
          </div>
        </div>
      )}

      {/* Graficos */}
      {sorted.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 16 }}>
              AuC ao Longo do Ano
              <span style={{ display: "flex", gap: 12, fontSize: 10, fontWeight: 500, color: "#8899bb" }}>
                <span><span style={{ display: "inline-block", width: 18, height: 2, background: "#16a34a", verticalAlign: "middle", marginRight: 4 }} />Real</span>
                <span><span style={{ display: "inline-block", width: 18, height: 2, background: "#2563eb", borderTop: "2px dashed #2563eb", verticalAlign: "middle", marginRight: 4 }} />Meta</span>
                <span><span style={{ display: "inline-block", width: 18, height: 2, background: "#7c3aed", borderTop: "2px dashed #7c3aed", verticalAlign: "middle", marginRight: 4 }} />Supermeta</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eeff" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8899bb" }} />
                <YAxis tickFormatter={(v) => `${v.toFixed(0)}M`} tick={{ fontSize: 10, fill: "#8899bb" }} width={38} />
                <Tooltip
                  formatter={(v, name) => [v != null ? `R$ ${Number(v).toFixed(1)}M` : "—", name]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="supermeta" stroke="#7c3aed" strokeDasharray="5 3" strokeWidth={1.5} dot={false} name="Supermeta" connectNulls />
                <Line type="monotone" dataKey="meta" stroke="#2563eb" strokeDasharray="5 3" strokeWidth={1.5} dot={false} name="Meta" connectNulls />
                <Area type="monotone" dataKey="real" stroke="#16a34a" fill="#dcfce7" fillOpacity={0.5} strokeWidth={2.5} dot={{ r: 3, fill: "#16a34a" }} name="Real" connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 16 }}>
              Receita Mensal
              <span style={{ display: "flex", gap: 12, fontSize: 10, fontWeight: 500, color: "#8899bb" }}>
                <span><span style={{ display: "inline-block", width: 12, height: 12, background: "#0891b2", borderRadius: 2, verticalAlign: "middle", marginRight: 4, opacity: 0.85 }} />Real</span>
                <span><span style={{ display: "inline-block", width: 18, height: 2, background: "#f59e0b", verticalAlign: "middle", marginRight: 4 }} />Planejada</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eeff" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8899bb" }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: "#8899bb" }} width={38} />
                <Tooltip
                  formatter={(v, name) => [v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—", name]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="receita_real" fill="#0891b2" name="Real" opacity={0.85} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="receita_plan" stroke="#f59e0b" strokeWidth={2} dot={false} name="Planejada" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Tabela historica */}
      {sorted.length > 0 ? (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>
            Historico Mensal
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8faff" }}>
                  {["Mes", "AuC Meta", "AuC Supermeta", "AuC Real", "% Meta", "% Supermeta", "Rec. Planejada", "Rec. Real", "Cresc. MoM", ""].map((h, i) => (
                    <th key={i} style={{ padding: "7px 12px", textAlign: i === 0 || i === 9 ? "left" : "right", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const pm = pctOf(row.auc_real, row.auc_meta);
                  const ps = pctOf(row.auc_real, row.auc_supermeta);
                  const prevRow = sorted[idx - 1];
                  const mom = row.receita_real != null && prevRow?.receita_real != null
                    ? ((Number(row.receita_real) - Number(prevRow.receita_real)) / Number(prevRow.receita_real)) * 100
                    : null;
                  const isCurrent = row.mes === currentMes;
                  const metaC = statusColor(pm);
                  return (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${B.border}`, background: isCurrent ? "#fef9ef" : "white" }}>
                      <td style={{ padding: "8px 12px", fontWeight: isCurrent ? 700 : 400, color: B.navy, whiteSpace: "nowrap" }}>
                        {isCurrent && <span style={{ fontSize: 8, background: B.navy, color: "white", borderRadius: 3, padding: "1px 4px", marginRight: 6, verticalAlign: "middle" }}>ATUAL</span>}
                        {mesLabel(row.mes)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#4b5563" }}>{row.auc_meta != null ? fM(row.auc_meta) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#7c3aed" }}>{row.auc_supermeta != null ? fM(row.auc_supermeta) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: metaC }}>{row.auc_real != null ? fM(row.auc_real) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: metaC }}>{pm ? `${pm}%` : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: Number(ps) >= 100 ? "#16a34a" : "#6b7280" }}>{ps ? `${ps}%` : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#6b7280" }}>{row.receita_planejada != null ? fR(row.receita_planejada) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: B.navy }}>{row.receita_real != null ? fR(row.receita_real) : "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: mom == null ? "#9baabf" : mom >= 0 ? "#16a34a" : "#dc2626" }}>
                        {mom != null ? `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button onClick={() => openEdit(row)}
                          style={{ background: "#f0f4ff", border: `1px solid ${B.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 10, fontWeight: 600, color: B.navy, cursor: "pointer" }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: B.navy, marginBottom: 8 }}>Nenhuma meta cadastrada</div>
            <div style={{ fontSize: 13, color: B.gray, marginBottom: 22 }}>Adicione as metas de AuC e receita mes a mes.</div>
            <button onClick={openNew}
              style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              + Adicionar Mes
            </button>
          </div>
        </Card>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 440, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 18 }}>
              {editRow ? `Editar · ${mesLabel(editRow.mes)}` : "Novo Mes"}
            </div>

            {!editRow && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Mes</div>
                <input type="month" value={form.mes} onChange={F("mes")}
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", color: B.navy }} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
              <ModalInput label="AuC Meta (R$)" value={form.auc_meta} onChange={F("auc_meta")} placeholder="ex: 36000000" />
              <ModalInput label="AuC Supermeta (R$)" value={form.auc_supermeta} onChange={F("auc_supermeta")} placeholder="ex: 38600000" />
              <ModalInput label="AuC Real (R$)" value={form.auc_real} onChange={F("auc_real")} placeholder="preencher ao fechar o mes" />
              <div />
              <div style={{ gridColumn: "1 / -1", height: 1, background: B.border, margin: "4px 0" }} />
              <ModalInput label="Receita Planejada (R$)" value={form.receita_planejada} onChange={F("receita_planejada")} placeholder="ex: 13200" />
              <ModalInput label="Receita Real (R$)" value={form.receita_real} onChange={F("receita_real")} placeholder="preencher ao fechar o mes" />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setModal(false)}
                style={{ flex: 1, padding: "9px 0", background: "white", border: `1px solid ${B.border}`, borderRadius: 7, cursor: "pointer", color: B.gray, fontSize: 12 }}>
                Cancelar
              </button>
              {editRow && (
                <button onClick={handleDelete}
                  style={{ padding: "9px 14px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                  Remover
                </button>
              )}
              <button onClick={handleSave}
                style={{ flex: 2, padding: "9px 0", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
