import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { slugify, huid } from "../utils/helpers";
import { SecH } from "../components/ui/FormFields";

const fmt = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => Number(v || 0).toFixed(2) + "%";

/* --- Algoritmo de rebalanceamento buy-only --- */
function calcRebalance(classes, aporte) {
  const totalAtual = classes.reduce((s, c) => s + c.totalValor, 0);
  const totalApos = totalAtual + aporte;

  const shortfalls = classes.map((c) => {
    const alvo = (c.target_pct / 100) * totalApos;
    return Math.max(0, alvo - c.totalValor);
  });
  const totalShortfall = shortfalls.reduce((s, v) => s + v, 0);

  return classes.map((c, i) => {
    let aporteClass = 0;
    if (aporte <= 0) {
      aporteClass = 0;
    } else if (totalShortfall <= 0) {
      aporteClass = aporte * (c.target_pct / 100);
    } else if (totalShortfall <= aporte) {
      aporteClass = shortfalls[i];
    } else {
      aporteClass = aporte * (shortfalls[i] / totalShortfall);
    }
    return { ...c, aporteClass, shortfall: shortfalls[i] };
  });
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

function Inp({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${B.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", color: B.navy }} />
    </div>
  );
}

export default function RebalanceIntl() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clients, getIntlPortfolio, saveIntlPortfolio, saveIntlClass, deleteIntlClass, saveIntlProduct, deleteIntlProduct, setToast } = useData();

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
    const p = await getIntlPortfolio(client.id);
    setPortfolio(p);
    setLoading(false);
  }, [client?.id]);

  useEffect(() => { load(); }, [load]);

  if (!client) return <div style={{ padding: 40, color: B.gray }}>Cliente nao encontrado.</div>;

  const handleCreatePortfolio = async () => {
    await saveIntlPortfolio(client.id);
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
    await saveIntlClass(cls, isNew);
    setClassModal(false);
    setEditingClass(null);
    setClassForm({ nome: "", target_pct: "" });
    await load();
    setToast({ type: "success", text: isNew ? "Classe adicionada." : "Classe atualizada." });
  };

  const openClassEdit = (cls) => {
    setEditingClass(cls);
    setClassForm({ nome: cls.nome, target_pct: String(cls.target_pct) });
    setClassModal(true);
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Remover esta classe e todos os produtos?")) return;
    await deleteIntlClass(id);
    await load();
    setToast({ type: "success", text: "Classe removida." });
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
    await saveIntlProduct(prod, isNew);
    setProductModal(false);
    setEditingProduct(null);
    setProductForm({ ticker: "", valor_atual: "" });
    await load();
    setToast({ type: "success", text: isNew ? "ETF adicionado." : "ETF atualizado." });
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
    await deleteIntlProduct(id);
    await load();
    setToast({ type: "success", text: "ETF removido." });
  };

  /* --- Calculos --- */
  const classesComValor = (portfolio?.classes || []).map((c) => ({
    ...c,
    totalValor: (c.products || []).reduce((s, p) => s + Number(p.valor_atual || 0), 0),
  }));
  const totalPortfolio = classesComValor.reduce((s, c) => s + c.totalValor, 0);
  const totalTarget = (portfolio?.classes || []).reduce((s, c) => s + Number(c.target_pct || 0), 0);
  const aporteNum = Number(String(aporte).replace(",", ".")) || 0;
  const classesRebal = calcRebalance(classesComValor, aporteNum);
  const totalApos = totalPortfolio + aporteNum;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 48px" }}>
      {/* Cabecalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={() => navigate(`/clients/${slug}`)}
          style={{ background: "none", border: "none", color: B.navy, cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>
          ←
        </button>
        <SecH eyebrow="Conta Internacional" title={`Rebalanceamento — ${client.nome.split(" ")[0]}`} desc="Asset allocation e simulacao de aporte em USD" />
      </div>

      {loading && <div style={{ padding: 48, textAlign: "center", color: B.gray }}>Carregando...</div>}

      {/* Sem portfolio */}
      {!loading && !portfolio && (
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🌎</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: B.navy, marginBottom: 8 }}>Nenhuma carteira internacional cadastrada</div>
          <div style={{ fontSize: 13, color: B.gray, marginBottom: 22 }}>Crie a carteira para cadastrar classes de ativos e ETFs.</div>
          <button onClick={handleCreatePortfolio}
            style={{ background: B.brand, color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Criar Carteira Internacional
          </button>
        </div>
      )}

      {!loading && portfolio && (
        <>
          {/* Totais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Total da Carteira", value: `$ ${fmt(totalPortfolio)}`, color: B.navy },
              { label: "Alvo Total", value: pct(totalTarget), color: Math.abs(totalTarget - 100) < 0.01 ? "#16a34a" : "#dc2626", hint: Math.abs(totalTarget - 100) >= 0.01 ? `(falta ${pct(100 - totalTarget)})` : "OK" },
              { label: "Classes", value: portfolio.classes?.length || 0, color: B.navy },
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
                + Classe
              </button>
            </div>

            {!portfolio.classes?.length && (
              <div style={{ padding: 32, textAlign: "center", color: B.gray, fontSize: 13 }}>
                Nenhuma classe ainda. Clique em "+ Classe" para comecar.
              </div>
            )}

            {!!portfolio.classes?.length && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8faff" }}>
                      {[
                        { h: "Classificacao", align: "left" },
                        { h: "Produtos (ETFs)", align: "left" },
                        { h: "Total (USD)", align: "right" },
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
                                  title={`$ ${fmt(p.valor_atual)} — clique para editar`}
                                  style={{ fontSize: 10, fontWeight: 700, background: "#e8eeff", color: B.navy, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                                  {p.ticker}
                                </span>
                              ))}
                              <button onClick={() => openProductAdd(cls.id)}
                                style={{ fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1px dashed #86efac", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                                + ETF
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy, whiteSpace: "nowrap" }}>$ {fmt(cls.totalValor)}</td>
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
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: B.navy }}>$ {fmt(totalPortfolio)}</td>
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
                  <span style={{ padding: "6px 10px", background: "#f8faff", fontSize: 12, fontWeight: 700, color: B.navy, borderRight: `1px solid ${B.border}` }}>USD $</span>
                  <input type="number" value={aporte} onChange={(e) => setAporte(e.target.value)} placeholder="0"
                    style={{ border: "none", outline: "none", padding: "6px 10px", fontSize: 13, fontFamily: "inherit", width: 130, color: B.navy }} />
                </div>
                {aporteNum > 0 && (
                  <span style={{ fontSize: 11, color: B.gray }}>
                    Total apos aporte: <strong style={{ color: B.navy }}>$ {fmt(totalApos)}</strong>
                  </span>
                )}
              </div>

              {aporteNum <= 0 && (
                <div style={{ padding: 28, textAlign: "center", color: B.gray, fontSize: 12 }}>
                  Digite um valor de aporte acima para ver a sugestao de rebalanceamento.
                </div>
              )}

              {aporteNum > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8faff" }}>
                        {[
                          { h: "Classificacao", align: "left" },
                          { h: "Aportar em", align: "left" },
                          { h: "Valor (USD)", align: "right" },
                          { h: "% do Aporte", align: "right" },
                          { h: "% Final Estimada", align: "right" },
                        ].map(({ h, align }) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: align, fontSize: 9, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classesRebal.map((cls, i) => {
                        const pctDoAporte = aporteNum > 0 ? (cls.aporteClass / aporteNum) * 100 : 0;
                        const valorFinal = cls.totalValor + cls.aporteClass;
                        const pctFinal = totalApos > 0 ? (valorFinal / totalApos) * 100 : 0;
                        const temAporte = cls.aporteClass > 0.01;
                        const totalProd = (cls.products || []).reduce((s, p) => s + Number(p.valor_atual || 0), 0);
                        return (
                          <tr key={cls.id} style={{ borderBottom: `1px solid ${B.border}`, background: temAporte ? (i % 2 === 0 ? "#f0fdf4" : "#e8fdf1") : (i % 2 === 0 ? "white" : "#fafbff") }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: B.navy, whiteSpace: "nowrap" }}>{cls.nome}</td>
                            <td style={{ padding: "9px 12px" }}>
                              {temAporte ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {(cls.products || []).map((p) => {
                                    const peso = totalProd > 0 ? Number(p.valor_atual || 0) / totalProd : 1 / (cls.products?.length || 1);
                                    const aporteETF = cls.aporteClass * peso;
                                    return (
                                      <span key={p.id} style={{ fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#15803d", borderRadius: 5, padding: "2px 9px", whiteSpace: "nowrap" }}>
                                        {p.ticker} <span style={{ fontWeight: 400 }}>$ {fmt(aporteETF)}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: B.muted }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: temAporte ? "#16a34a" : B.muted, whiteSpace: "nowrap" }}>
                              {temAporte ? `$ ${fmt(cls.aporteClass)}` : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: temAporte ? "#16a34a" : B.muted, fontWeight: 600 }}>
                              {temAporte ? pct(pctDoAporte) : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 700, color: B.navy }}>{pct(pctFinal)}</span>
                              <span style={{ fontSize: 10, color: Math.abs(pctFinal - cls.target_pct) < 1 ? "#16a34a" : B.muted, marginLeft: 5 }}>
                                (alvo {pct(cls.target_pct)})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: "#f0f4ff", borderTop: `2px solid ${B.border}` }}>
                        <td style={{ padding: "9px 12px", fontWeight: 800, color: B.navy }}>Total</td>
                        <td />
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>$ {fmt(aporteNum)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy }}>100%</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: B.navy }}>$ {fmt(totalApos)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Classe */}
      <ModalBox open={classModal} onClose={() => setClassModal(false)}>
        <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 16 }}>{editingClass ? "Editar Classe" : "Nova Classe de Ativo"}</div>
        <Inp label="Nome da Classe" value={classForm.nome} onChange={(e) => setClassForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: RV - Global (Core)" />
        <Inp label="% Alvo" type="number" value={classForm.target_pct} onChange={(e) => setClassForm((f) => ({ ...f, target_pct: e.target.value }))} placeholder="Ex: 22" />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => setClassModal(false)} style={{ flex: 1, padding: 10, background: "white", border: `1px solid ${B.border}`, borderRadius: 7, cursor: "pointer", color: B.gray }}>Cancelar</button>
          <button onClick={handleSaveClass} style={{ flex: 2, padding: 10, background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Salvar</button>
        </div>
      </ModalBox>

      {/* Modal Produto */}
      <ModalBox open={productModal} onClose={() => setProductModal(false)}>
        <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 4 }}>{editingProduct ? "Editar ETF" : "Novo ETF"}</div>
        <div style={{ fontSize: 11, color: B.gray, marginBottom: 14 }}>
          Classe: <strong>{portfolio?.classes?.find((c) => c.id === productClassId)?.nome}</strong>
        </div>
        <Inp label="Ticker" value={productForm.ticker} onChange={(e) => setProductForm((f) => ({ ...f, ticker: e.target.value }))} placeholder="Ex: VT, IVV, QQQ" />
        <Inp label="Valor Atual (USD)" type="number" value={productForm.valor_atual} onChange={(e) => setProductForm((f) => ({ ...f, valor_atual: e.target.value }))} placeholder="0.00" />
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
