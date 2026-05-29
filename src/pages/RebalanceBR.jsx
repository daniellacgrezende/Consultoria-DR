import { useState, useEffect, useCallback, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { slugify, huid } from "../utils/helpers";
import { SecH } from "../components/ui/FormFields";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => Number(v || 0).toFixed(2) + "%";
const round100 = (v) => Math.round(v / 100) * 100;

const CLASSES_PRESET_BR = [
  "Agricultura", "Alimentos", "Bancários", "Bancos", "Commodities",
  "Consumo & Varejo", "Corretoras de Seguros", "Energia Elétrica", "FIIs",
  "Financeiro", "Industrial", "Máquinas e Equipamentos", "Materiais",
  "Papel e Celulose", "Petróleo & Gás", "Saúde", "Seguradoras", "Tecnologia", "Utilities",
];

/* Algoritmo por ticker — alvo % é de cada acao */
function calcSuggestion(tickers, aporte, min = 100) {
  if (aporte <= 0) return { items: [], totalSugerido: 0 };
  const roundMin = (v) => Math.round(v / min) * min;
  const totalAtual = tickers.reduce((s, t) => s + Number(t.valor_atual || 0), 0);
  const totalApos = totalAtual + aporte;
  const ranked = tickers
    .map((t) => ({ ...t, shortfall: Math.max(0, (t.target_pct / 100) * totalApos - Number(t.valor_atual || 0)) }))
    .filter((t) => t.shortfall > 1)
    .sort((a, b) => b.shortfall - a.shortfall);
  if (!ranked.length) return { items: [], totalSugerido: 0 };
  const totalShortfall = ranked.reduce((s, t) => s + t.shortfall, 0);
  let restante = aporte;
  const allocs = [];
  for (let i = 0; i < ranked.length; i++) {
    const t = ranked[i];
    const isLast = i === ranked.length - 1;
    const raw = isLast ? restante : aporte * (t.shortfall / totalShortfall);
    const rounded = roundMin(raw);
    if (rounded < min) continue;
    allocs.push({ ...t, valor: rounded });
    restante -= rounded;
    if (restante < min) break;
  }
  if (allocs.length > 0) {
    const soma = allocs.reduce((s, t) => s + t.valor, 0);
    const diff = roundMin(aporte - soma);
    if (Math.abs(diff) >= min) allocs[0].valor += diff;
  }
  const totalSugerido = allocs.reduce((s, t) => s + t.valor, 0);
  return { items: allocs, totalSugerido };
}

function ModalBox({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: 24 }}>
        {children}
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, onKeyDown, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", color: B.navy }} />
    </div>
  );
}

export default function RebalanceBR() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clients, getBrPortfolio, saveBrPortfolio, saveBrClass, deleteBrClass, saveBrProduct, deleteBrProduct, setToast } = useData();

  const client = clients.find((c) => slugify(c.nome) === slug || c.id === slug);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aporte, setAporte] = useState("");
  const [minAlocacao, setMinAlocacao] = useState("100");
  const [sortTicker, setSortTicker] = useState(false);

  const [classModal, setClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({ nome: "" });

  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productClassId, setProductClassId] = useState(null);
  const [productForm, setProductForm] = useState({ ticker: "", valor_atual: "", target_pct: "", grupo: "" });

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    const p = await getBrPortfolio(client.id);
    setPortfolio(p);
    setLoading(false);
  }, [client?.id]);

  useEffect(() => { load(); }, [load]);

  if (!client) return <div style={{ padding: 40, color: B.gray }}>Cliente nao encontrado.</div>;

  const handleCreatePortfolio = async () => {
    await saveBrPortfolio(client.id);
    await load();
  };

  const handleSaveClass = async () => {
    if (!classForm.nome.trim()) return;
    const isNew = !editingClass;
    const cls = {
      id: editingClass?.id || huid(),
      portfolio_id: portfolio.id,
      nome: classForm.nome.trim(),
      target_pct: 0,
      ordem: isNew ? (portfolio?.classes?.length || 0) : editingClass.ordem,
    };
    await saveBrClass(cls, isNew);
    setClassModal(false);
    setEditingClass(null);
    setClassForm({ nome: "" });
    await load();
    setToast({ type: "success", text: isNew ? "Setor adicionado." : "Setor atualizado." });
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Remover este setor e todas as acoes?")) return;
    await deleteBrClass(id);
    await load();
    setToast({ type: "success", text: "Setor removido." });
  };

  const handleSaveProduct = async () => {
    if (!productForm.ticker.trim()) return;
    const isNew = !editingProduct;
    const prod = {
      id: editingProduct?.id || huid(),
      class_id: productClassId,
      ticker: productForm.ticker.trim().toUpperCase(),
      valor_atual: Number(productForm.valor_atual) || 0,
      target_pct: Number(productForm.target_pct) || 0,
      grupo: productForm.grupo.trim() || null,
    };
    await saveBrProduct(prod, isNew);
    setProductModal(false);
    setEditingProduct(null);
    setProductForm({ ticker: "", valor_atual: "", target_pct: "", grupo: "" });
    await load();
    setToast({ type: "success", text: isNew ? "Acao adicionada." : "Acao atualizada." });
  };

  const openProductAdd = (classId) => {
    setProductClassId(classId);
    setEditingProduct(null);
    setProductForm({ ticker: "", valor_atual: "", target_pct: "", grupo: "" });
    setProductModal(true);
  };

  const openProductEdit = (prod) => {
    setProductClassId(prod.class_id);
    setEditingProduct(prod);
    setProductForm({ ticker: prod.ticker, valor_atual: String(prod.valor_atual), target_pct: String(prod.target_pct || ""), grupo: prod.grupo || "" });
    setProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    await deleteBrProduct(id);
    await load();
    setToast({ type: "success", text: "Acao removida." });
  };

  /* --- Calculos --- */
  const classesOrdenadas = (portfolio?.classes || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Todos os tickers flat
  const allTickers = classesOrdenadas.flatMap((c) =>
    (c.products || []).map((p) => ({ ...p, classe: c.nome }))
  );

  // Colapsa grupos: cada grupo vira um "ticker virtual" com valor somado e target do grupo (1x)
  const _gruposGlobal = {};
  allTickers.forEach((t) => { if (t.grupo) { if (!_gruposGlobal[t.grupo]) _gruposGlobal[t.grupo] = []; _gruposGlobal[t.grupo].push(t); } });
  const _processedGrupos = new Set();
  const effectiveTickers = [];
  allTickers.forEach((t) => {
    if (t.grupo && _gruposGlobal[t.grupo]?.length > 1) {
      if (_processedGrupos.has(t.grupo)) return;
      _processedGrupos.add(t.grupo);
      const members = _gruposGlobal[t.grupo];
      effectiveTickers.push({ ...members[0], ticker: members.map((m) => m.ticker).join("/"), valor_atual: members.reduce((s, m) => s + Number(m.valor_atual || 0), 0) });
    } else {
      effectiveTickers.push(t);
    }
  });

  const totalPortfolio = allTickers.reduce((s, t) => s + Number(t.valor_atual || 0), 0);
  const totalTarget = effectiveTickers.reduce((s, t) => s + Number(t.target_pct || 0), 0);
  const aporteNum = Number(String(aporte).replace(",", ".")) || 0;
  const minAllocNum = Number(String(minAlocacao).replace(",", ".")) || 100;
  const suggestion = calcSuggestion(effectiveTickers, aporteNum, minAllocNum);
  const totalApos = totalPortfolio + aporteNum;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 48px" }}>
      {/* Cabecalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={() => navigate(`/clients/${slug}`)}
          style={{ background: "none", border: "none", color: B.navy, cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>
          ←
        </button>
        <SecH eyebrow="Carteira Acoes Brasil" title={`Rebalanceamento — ${client.nome.split(" ")[0]}`} desc="Asset allocation e simulacao de aporte em BRL" />
      </div>

      {loading && <div style={{ padding: 48, textAlign: "center", color: B.gray }}>Carregando...</div>}

      {!loading && !portfolio && (
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🇧🇷</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: B.navy, marginBottom: 8 }}>Nenhuma carteira de acoes cadastrada</div>
          <div style={{ fontSize: 13, color: B.gray, marginBottom: 22 }}>Crie a carteira para cadastrar setores e acoes.</div>
          <button onClick={handleCreatePortfolio}
            style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Criar Carteira de Acoes
          </button>
        </div>
      )}

      {!loading && portfolio && (
        <>
          {/* Totais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total da Carteira", value: `R$ ${fmt(totalPortfolio)}`, color: B.navy },
              { label: "Alvo Total", value: pct(totalTarget), color: Math.abs(totalTarget - 100) < 0.01 ? "#16a34a" : "#dc2626", hint: Math.abs(totalTarget - 100) >= 0.01 ? `(falta ${pct(100 - totalTarget)})` : "OK" },
              { label: "Acoes", value: allTickers.length, color: B.navy },
            ].map(({ label, value, color, hint }) => (
              <div key={label} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                {hint && <div style={{ fontSize: 10, color, marginTop: 2 }}>{hint}</div>}
              </div>
            ))}
          </div>

          {/* Tabela de carteira */}
          <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Carteira Atual</div>
              <button onClick={() => { setEditingClass(null); setClassForm({ nome: "" }); setClassModal(true); }}
                style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                + Setor
              </button>
            </div>

            {!portfolio.classes?.length && (
              <div style={{ padding: 32, textAlign: "center", color: B.gray, fontSize: 13 }}>
                Nenhum setor ainda. Clique em "+ Setor" para comecar.
              </div>
            )}

            {!!portfolio.classes?.length && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8faff" }}>
                      {["Setor", "Acao", "Valor (R$)", "Atual %", "Alvo %", "Desvio", ""].map((h, j) => (
                        <th key={j} onClick={h === "Acao" ? () => setSortTicker((v) => !v) : undefined}
                          style={{ padding: "8px 12px", textAlign: j >= 2 && j <= 5 ? "right" : "left", fontSize: 9, fontWeight: 700, color: h === "Acao" ? B.navy : "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap", cursor: h === "Acao" ? "pointer" : "default", userSelect: "none" }}>
                          {h}{h === "Acao" && <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortTicker ? "▲" : "↕"}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortTicker ? (
                      allTickers.slice().sort((a, b) => a.ticker.localeCompare(b.ticker)).map((p, i) => {
                        const pctAtual = totalPortfolio > 0 ? (Number(p.valor_atual) / totalPortfolio) * 100 : 0;
                        const desvio = pctAtual - Number(p.target_pct || 0);
                        const desvioColor = Math.abs(desvio) < 1 ? "#16a34a" : Math.abs(desvio) < 3 ? "#b45309" : "#dc2626";
                        return (
                          <tr key={p.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                            <td style={{ padding: "9px 12px", color: "#6b7280", fontSize: 12 }}>{p.classe}</td>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: B.navy, cursor: "pointer" }} onClick={() => openProductEdit(p)}>{p.ticker}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>R$ {fmt(p.valor_atual)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: B.navy }}>{pct(pctAtual)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>{pct(p.target_pct)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: desvioColor, whiteSpace: "nowrap" }}>{desvio >= 0 ? "+" : ""}{pct(desvio)}</td>
                            <td />
                          </tr>
                        );
                      })
                    ) : classesOrdenadas.map((cls) => {
                      const prods = cls.products || [];
                      if (!prods.length) {
                        return (
                          <tr key={cls.id} style={{ borderBottom: `1px solid ${B.border}` }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: B.navy }}>{cls.nome}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <button onClick={() => openProductAdd(cls.id)}
                                style={{ fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px dashed #86efac", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                                + Acao
                              </button>
                            </td>
                            <td colSpan={4} />
                            <td style={{ padding: "9px 12px" }}>
                              <button onClick={() => handleDeleteClass(cls.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 11 }}>✕</button>
                            </td>
                          </tr>
                        );
                      }

                      // Build display items: groups collapsed into one row, singles as-is
                      const grupoMap = {};
                      prods.forEach((p) => { if (p.grupo) { if (!grupoMap[p.grupo]) grupoMap[p.grupo] = []; grupoMap[p.grupo].push(p); } });
                      const processedIds = new Set();
                      const displayItems = [];
                      prods.forEach((p) => {
                        if (processedIds.has(p.id)) return;
                        if (p.grupo && grupoMap[p.grupo]?.length > 1) {
                          grupoMap[p.grupo].forEach((m) => processedIds.add(m.id));
                          displayItems.push({ type: "group", grupo: p.grupo, members: grupoMap[p.grupo] });
                        } else {
                          processedIds.add(p.id);
                          displayItems.push({ type: "single", product: p });
                        }
                      });
                      const rowCount = displayItems.length;

                      return displayItems.map((item, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === displayItems.length - 1;
                        const sectorCell = isFirst ? (
                          <td rowSpan={rowCount} style={{ padding: "9px 12px", fontWeight: 600, color: B.navy, verticalAlign: "middle", borderRight: `1px solid ${B.border}` }}>
                            <div>{cls.nome}</div>
                            <button onClick={() => openProductAdd(cls.id)}
                              style={{ fontSize: 9, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px dashed #86efac", borderRadius: 4, padding: "1px 6px", cursor: "pointer", marginTop: 4, display: "block" }}>
                              + Acao
                            </button>
                          </td>
                        ) : null;
                        const actionCell = isFirst ? (
                          <td rowSpan={rowCount} style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                            <button onClick={() => handleDeleteClass(cls.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 11 }}>✕</button>
                          </td>
                        ) : null;

                        if (item.type === "group") {
                          const combinedValor = item.members.reduce((s, m) => s + Number(m.valor_atual || 0), 0);
                          const combinedTarget = Number(item.members[0].target_pct || 0);
                          const combinedAtual = totalPortfolio > 0 ? (combinedValor / totalPortfolio) * 100 : 0;
                          const combinedDesvio = combinedAtual - combinedTarget;
                          const desvioColor = Math.abs(combinedDesvio) < 1 ? "#16a34a" : Math.abs(combinedDesvio) < 3 ? "#b45309" : "#dc2626";
                          return (
                            <tr key={item.grupo + cls.id} style={{ borderBottom: isLast ? `1px solid ${B.border}` : "1px solid #f0f4ff", background: "white" }}>
                              {sectorCell}
                              <td style={{ padding: "9px 12px" }}>
                                {item.members.map((m, mi) => (
                                  <Fragment key={m.id}>
                                    {mi > 0 && <span style={{ color: "#aaa", fontWeight: 400, margin: "0 3px" }}>·</span>}
                                    <span onClick={() => openProductEdit(m)} style={{ fontWeight: 700, color: B.navy, cursor: "pointer" }}>{m.ticker}</span>
                                  </Fragment>
                                ))}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>R$ {fmt(combinedValor)}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: B.navy }}>{pct(combinedAtual)}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>{pct(combinedTarget)}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: desvioColor, whiteSpace: "nowrap" }}>{combinedDesvio >= 0 ? "+" : ""}{pct(combinedDesvio)}</td>
                              {actionCell}
                            </tr>
                          );
                        }

                        const p = item.product;
                        const pctAtual = totalPortfolio > 0 ? (Number(p.valor_atual) / totalPortfolio) * 100 : 0;
                        const desvio = pctAtual - Number(p.target_pct || 0);
                        const desvioColor = Math.abs(desvio) < 1 ? "#16a34a" : Math.abs(desvio) < 3 ? "#b45309" : "#dc2626";
                        return (
                          <tr key={p.id} style={{ borderBottom: isLast ? `1px solid ${B.border}` : "1px solid #f0f4ff", background: "white" }}>
                            {sectorCell}
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: B.navy, cursor: "pointer" }} onClick={() => openProductEdit(p)}>{p.ticker}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>R$ {fmt(p.valor_atual)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: B.navy }}>{pct(pctAtual)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>{pct(p.target_pct)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: desvioColor, whiteSpace: "nowrap" }}>{desvio >= 0 ? "+" : ""}{pct(desvio)}</td>
                            {actionCell}
                          </tr>
                        );
                      });
                    })}
                    <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 800, color: B.navy }} colSpan={2}>Total</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: B.navy }}>R$ {fmt(totalPortfolio)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy }}>100%</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: Math.abs(totalTarget - 100) < 0.01 ? "#16a34a" : "#dc2626" }}>{pct(totalTarget)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Simulador */}
          {allTickers.length > 0 && (
            <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Simulador de Aporte</div>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${B.border}`, borderRadius: 7, overflow: "hidden" }}>
                  <span style={{ padding: "6px 10px", background: "#f8faff", fontSize: 12, fontWeight: 700, color: B.navy, borderRight: `1px solid ${B.border}` }}>R$</span>
                  <input type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} placeholder="0"
                    style={{ border: "none", outline: "none", padding: "6px 10px", fontSize: 13, fontFamily: "inherit", width: 130, color: B.navy }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${B.border}`, borderRadius: 7, overflow: "hidden" }}>
                  <span style={{ padding: "6px 10px", background: "#f8faff", fontSize: 11, fontWeight: 700, color: "#8899bb", borderRight: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>Mín R$</span>
                  <input type="number" value={minAlocacao} onChange={(e) => setMinAlocacao(e.target.value)} placeholder="100"
                    style={{ border: "none", outline: "none", padding: "6px 10px", fontSize: 13, fontFamily: "inherit", width: 80, color: B.navy }} />
                </div>
                {aporteNum > 0 && (
                  <span style={{ fontSize: 11, color: B.gray }}>Total apos aporte: <strong style={{ color: B.navy }}>R$ {fmt(totalApos)}</strong></span>
                )}
              </div>

              {aporteNum <= 0 && (
                <div style={{ padding: 28, textAlign: "center", color: B.gray, fontSize: 12 }}>
                  Digite um valor de aporte para ver a sugestao de rebalanceamento.
                </div>
              )}

              {aporteNum > 0 && (() => {
                const { items, totalSugerido } = suggestion;
                const naoAlocado = aporteNum - totalSugerido;
                return (
                  <div style={{ padding: "0 0 16px" }}>
                    {items.length === 0 ? (
                      <div style={{ padding: 28, textAlign: "center", color: B.gray, fontSize: 12 }}>
                        Nenhuma sugestao: aporte insuficiente ou carteira ja balanceada.
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: "8px 16px 0" }}>
                          <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: "#f0f4ff" }}>
                                {["Acao", "Setor", "Valor (R$)"].map((h, j) => (
                                  <th key={j} style={{ padding: "8px 12px", textAlign: j === 2 ? "right" : "left", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `2px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, i) => (
                                <tr key={`${item.ticker}-${i}`} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 800, fontSize: 13, color: B.navy, whiteSpace: "nowrap" }}>{item.ticker}</td>
                                  <td style={{ padding: "8px 12px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{item.classe}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#16a34a", whiteSpace: "nowrap" }}>R$ {item.valor.toLocaleString("pt-BR")}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#f0fdf4", borderTop: `2px solid #86efac` }}>
                                <td style={{ padding: "8px 12px", fontWeight: 800, fontSize: 12, color: B.navy }} colSpan={2}>Total Sugerido</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#16a34a", whiteSpace: "nowrap" }}>R$ {totalSugerido.toLocaleString("pt-BR")}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {naoAlocado >= 100 && (
                          <div style={{ margin: "10px 20px 0", fontSize: 11, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "7px 12px" }}>
                            Nao alocado: <strong>R$ {naoAlocado.toLocaleString("pt-BR")}</strong> — valor restante apos arredondamentos.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Modal Setor */}
      <ModalBox open={classModal} onClose={() => setClassModal(false)}>
        <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 16 }}>{editingClass ? "Editar Setor" : "Novo Setor"}</div>
        {!editingClass && (() => {
          const usados = (portfolio?.classes || []).map((c) => c.nome);
          const disponiveis = CLASSES_PRESET_BR.filter((p) => !usados.includes(p));
          if (!disponiveis.length) return null;
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Sugestoes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {disponiveis.map((nome) => (
                  <button key={nome} onClick={() => setClassForm({ nome })}
                    style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
                      background: classForm.nome === nome ? B.brand : "#f0f4ff",
                      color: classForm.nome === nome ? "white" : B.navy,
                      border: `1px solid ${classForm.nome === nome ? B.brand : B.border}` }}>
                    {nome}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        <Inp label="Nome do Setor" value={classForm.nome} onChange={(e) => setClassForm({ nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSaveClass()} placeholder="Ex: Bancarios" />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => setClassModal(false)} style={{ flex: 1, padding: 10, background: "white", border: `1px solid ${B.border}`, borderRadius: 7, cursor: "pointer", color: B.gray }}>Cancelar</button>
          <button onClick={handleSaveClass} style={{ flex: 2, padding: 10, background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Salvar</button>
        </div>
      </ModalBox>

      {/* Modal Acao */}
      <ModalBox open={productModal} onClose={() => setProductModal(false)}>
        <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 4 }}>{editingProduct ? "Editar Acao" : "Nova Acao"}</div>
        <div style={{ fontSize: 11, color: B.gray, marginBottom: 14 }}>
          Setor: <strong>{portfolio?.classes?.find((c) => c.id === productClassId)?.nome}</strong>
        </div>
        <Inp label="Ticker" value={productForm.ticker} onChange={(e) => setProductForm((f) => ({ ...f, ticker: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleSaveProduct()} placeholder="Ex: PETR4, VALE3, ITUB4" />
        <Inp label="Valor Atual (R$)" type="number" value={productForm.valor_atual} onChange={(e) => setProductForm((f) => ({ ...f, valor_atual: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleSaveProduct()} placeholder="0.00" />
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Grupo (opcional)</div>
          <input value={productForm.grupo} onChange={(e) => setProductForm((f) => ({ ...f, grupo: e.target.value }))}
            placeholder="Ex: KLBN — para agrupar ações da mesma empresa"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", color: B.navy }} />
          <div style={{ fontSize: 10, color: "#9baabf", marginTop: 3 }}>Ações com o mesmo grupo são somadas. Use o mesmo % Alvo em todas.</div>
        </div>
        <Inp label={productForm.grupo.trim() ? "% Alvo (do grupo inteiro)" : "% Alvo"} type="number" value={productForm.target_pct} onChange={(e) => setProductForm((f) => ({ ...f, target_pct: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleSaveProduct()} placeholder="Ex: 5" />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => setProductModal(false)} style={{ flex: 1, padding: 10, background: "white", border: `1px solid ${B.border}`, borderRadius: 7, cursor: "pointer", color: B.gray }}>Cancelar</button>
          {editingProduct && (
            <button onClick={() => { handleDeleteProduct(editingProduct.id); setProductModal(false); }}
              style={{ padding: "10px 14px", background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>
              Remover
            </button>
          )}
          <button onClick={handleSaveProduct} style={{ flex: 2, padding: 10, background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Salvar</button>
        </div>
      </ModalBox>
    </div>
  );
}
