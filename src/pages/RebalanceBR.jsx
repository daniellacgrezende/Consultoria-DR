import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { slugify, huid } from "../utils/helpers";
import { SecH } from "../components/ui/FormFields";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => Number(v || 0).toFixed(2) + "%";
const round100 = (v) => Math.round(v / 100) * 100;

const CLASSES_PRESET_BR = [
  "Agricultura",
  "Alimentos",
  "Bancários",
  "Bancos",
  "Commodities",
  "Consumo & Varejo",
  "Corretoras de Seguros",
  "Energia Elétrica",
  "FIIs",
  "Financeiro",
  "Industrial",
  "Máquinas e Equipamentos",
  "Materiais",
  "Papel e Celulose",
  "Petróleo & Gás",
  "Saúde",
  "Seguradoras",
  "Tecnologia",
  "Utilities",
];

function calcSuggestion(classes, aporte) {
  if (aporte <= 0) return { items: [], totalSugerido: 0 };
  const totalAtual = classes.reduce((s, c) => s + c.totalValor, 0);
  const totalApos = totalAtual + aporte;
  const ranked = classes
    .map((c) => ({ ...c, shortfall: Math.max(0, (c.target_pct / 100) * totalApos - c.totalValor) }))
    .filter((c) => c.shortfall > 1)
    .sort((a, b) => b.shortfall - a.shortfall);
  if (ranked.length === 0) return { items: [], totalSugerido: 0 };
  const totalShortfall = ranked.reduce((s, c) => s + c.shortfall, 0);
  let restante = aporte;
  const classAllocs = [];
  for (let i = 0; i < ranked.length; i++) {
    const cls = ranked[i];
    const isLast = i === ranked.length - 1;
    const raw = isLast ? restante : aporte * (cls.shortfall / totalShortfall);
    const rounded = round100(raw);
    if (rounded < 100) continue;
    classAllocs.push({ ...cls, aporteClass: rounded });
    restante -= rounded;
    if (restante < 100) break;
  }
  if (classAllocs.length > 0) {
    const soma = classAllocs.reduce((s, c) => s + c.aporteClass, 0);
    const diff = round100(aporte - soma);
    if (Math.abs(diff) >= 100) classAllocs[0].aporteClass += diff;
  }
  const items = [];
  for (const cls of classAllocs) {
    const prods = cls.products || [];
    if (!prods.length) continue;
    if (prods.length === 1) {
      items.push({ ticker: prods[0].ticker, classe: cls.nome, valor: cls.aporteClass });
      continue;
    }
    const totalProdVal = prods.reduce((s, p) => s + Number(p.valor_atual || 0), 0);
    let restProd = cls.aporteClass;
    prods.forEach((p, pi) => {
      const isLastP = pi === prods.length - 1;
      const peso = totalProdVal > 0 ? Number(p.valor_atual || 0) / totalProdVal : 1 / prods.length;
      const raw = isLastP ? restProd : cls.aporteClass * peso;
      const rounded = round100(raw);
      if (rounded >= 100) {
        items.push({ ticker: p.ticker, classe: cls.nome, valor: rounded });
        restProd -= rounded;
      } else if (isLastP && restProd >= 100) {
        items.push({ ticker: p.ticker, classe: cls.nome, valor: round100(restProd) });
      }
    });
  }
  const totalSugerido = items.reduce((s, x) => s + x.valor, 0);
  return { items, totalSugerido };
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

  const [classModal, setClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({ nome: "", target_pct: "" });

  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productClassId, setProductClassId] = useState(null);
  const [productForm, setProductForm] = useState({ ticker: "", valor_atual: "" });

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
      target_pct: Number(classForm.target_pct) || 0,
      ordem: isNew ? (portfolio?.classes?.length || 0) : editingClass.ordem,
    };
    await saveBrClass(cls, isNew);
    setClassModal(false);
    setEditingClass(null);
    setClassForm({ nome: "", target_pct: "" });
    await load();
    setToast({ type: "success", text: isNew ? "Setor adicionado." : "Setor atualizado." });
  };

  const openClassEdit = (cls) => {
    setEditingClass(cls);
    setClassForm({ nome: cls.nome, target_pct: String(cls.target_pct) });
    setClassModal(true);
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Remover este setor e todas as ações?")) return;
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
    };
    await saveBrProduct(prod, isNew);
    setProductModal(false);
    setEditingProduct(null);
    setProductForm({ ticker: "", valor_atual: "" });
    await load();
    setToast({ type: "success", text: isNew ? "Ação adicionada." : "Ação atualizada." });
  };

  const openProductAdd = (classId) => {
    setProductClassId(classId);
    setEditingProduct(null);
    setProductForm({ ticker: "", valor_atual: "" });
    setProductModal(true);
  };

  const openProductEdit = (prod) => {
    setProductClassId(prod.class_id);
    setEditingProduct(prod);
    setProductForm({ ticker: prod.ticker, valor_atual: String(prod.valor_atual) });
    setProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    await deleteBrProduct(id);
    await load();
    setToast({ type: "success", text: "Acao removida." });
  };

  const classesComValor = (portfolio?.classes || [])
    .map((c) => ({
      ...c,
      totalValor: (c.products || []).reduce((s, p) => s + Number(p.valor_atual || 0), 0),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const totalPortfolio = classesComValor.reduce((s, c) => s + c.totalValor, 0);
  const totalTarget = (portfolio?.classes || []).reduce((s, c) => s + Number(c.target_pct || 0), 0);
  const aporteNum = Number(String(aporte).replace(",", ".")) || 0;
  const suggestion = calcSuggestion(classesComValor, aporteNum);
  const totalApos = totalPortfolio + aporteNum;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 48px" }}>
      {/* Cabecalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={() => navigate(`/clients/${slug}`)}
          style={{ background: "none", border: "none", color: B.navy, cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>
          ←
        </button>
        <SecH eyebrow="Carteira Ações Brasil" title={`Rebalanceamento — ${client.nome.split(" ")[0]}`} desc="Asset allocation e simulacao de aporte em BRL" />
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
              { label: "Setores", value: portfolio.classes?.length || 0, color: B.navy },
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
              <button onClick={() => { setEditingClass(null); setClassForm({ nome: "", target_pct: "" }); setClassModal(true); }}
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
                      {[
                        { h: "Setor", align: "left" },
                        { h: "Acoes", align: "left" },
                        { h: "Total (R$)", align: "right" },
                        { h: "Atual %", align: "right" },
                        { h: "Alvo %", align: "right" },
                        { h: "Desvio", align: "right" },
                        { h: "", align: "left" },
                      ].map(({ h, align }) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: align, fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classesComValor.map((cls, i) => {
                      const pctAtual = totalPortfolio > 0 ? (cls.totalValor / totalPortfolio) * 100 : 0;
                      const desvio = pctAtual - cls.target_pct;
                      const desvioColor = Math.abs(desvio) < 1 ? "#16a34a" : Math.abs(desvio) < 3 ? "#b45309" : "#dc2626";
                      return (
                        <tr key={cls.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                          <td style={{ padding: "9px 12px", fontWeight: 600, color: B.navy, whiteSpace: "nowrap" }}>{cls.nome}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                              {(cls.products || []).map((p) => (
                                <span key={p.id} onClick={() => openProductEdit(p)}
                                  title={`R$ ${fmt(p.valor_atual)} — clique para editar`}
                                  style={{ fontSize: 10, fontWeight: 700, background: "#e8eeff", color: B.navy, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                                  {p.ticker}
                                </span>
                              ))}
                              <button onClick={() => openProductAdd(cls.id)}
                                style={{ fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px dashed #86efac", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                                + Acao
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>R$ {fmt(cls.totalValor)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: B.navy }}>{pct(pctAtual)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>{pct(cls.target_pct)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: desvioColor, whiteSpace: "nowrap" }}>
                            {desvio >= 0 ? "+" : ""}{pct(desvio)}
                          </td>
                          <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                            <button onClick={() => openClassEdit(cls)} style={{ background: "none", border: "none", cursor: "pointer", color: B.muted, fontSize: 11, marginRight: 4 }}>✎</button>
                            <button onClick={() => handleDeleteClass(cls.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 11 }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 800, color: B.navy }}>Total</td>
                      <td />
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
          {!!portfolio.classes?.length && (
            <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Simulador de Aporte</div>
                <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1px solid ${B.border}`, borderRadius: 7, overflow: "hidden" }}>
                  <span style={{ padding: "6px 10px", background: "#f8faff", fontSize: 12, fontWeight: 700, color: B.navy, borderRight: `1px solid ${B.border}` }}>R$</span>
                  <input type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} placeholder="0"
                    style={{ border: "none", outline: "none", padding: "6px 10px", fontSize: 13, fontFamily: "inherit", width: 130, color: B.navy }} />
                </div>
                {aporteNum > 0 && (
                  <span style={{ fontSize: 11, color: B.gray }}>
                    Total apos aporte: <strong style={{ color: B.navy }}>R$ {fmt(totalApos)}</strong>
                  </span>
                )}
              </div>

              {aporteNum <= 0 && (
                <div style={{ padding: 28, textAlign: "center", color: B.gray, fontSize: 12 }}>
                  Digite um valor de aporte acima para ver a sugestao de rebalanceamento.
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
                                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `2px solid ${B.border}`, whiteSpace: "nowrap" }}>Acao</th>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `2px solid ${B.border}` }}>Setor</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `2px solid ${B.border}`, whiteSpace: "nowrap" }}>Valor (R$)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, i) => (
                                <tr key={`${item.ticker}-${i}`} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 800, fontSize: 13, color: B.navy, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{item.ticker}</td>
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
                  <button key={nome} onClick={() => setClassForm((f) => ({ ...f, nome }))}
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
        <Inp label="Nome do Setor" value={classForm.nome} onChange={(e) => setClassForm((f) => ({ ...f, nome: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleSaveClass()} placeholder="Ex: Bancarios" />
        <Inp label="% Alvo" type="number" value={classForm.target_pct} onChange={(e) => setClassForm((f) => ({ ...f, target_pct: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleSaveClass()} placeholder="Ex: 20" />
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
