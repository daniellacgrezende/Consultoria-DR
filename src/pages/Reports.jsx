import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP } from "../utils/constants";
import { money, fmtDate } from "../utils/formatters";
import { getCurva, getCurrentPL, huid, today } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { PBadge, CBadge } from "../components/ui/Badge";
import { Inp, SecH } from "../components/ui/FormFields";

export default function Reports() {
  const { clients, history, addHistory, updateHistory, deleteHistory, setToast } = useData();
  const [subTab, setSubTab] = useState("consolidada");
  const [indSearch, setIndSearch] = useState("");
  const [indSelId, setIndSelId] = useState(null);
  const [indShowSug, setIndShowSug] = useState(false);
  const [maintSearch, setMaintSearch] = useState("");
  const [maintSelId, setMaintSelId] = useState(null);
  const [maintShowSug, setMaintShowSug] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState({ data: today(), patrimonio: "" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ data: "", patrimonio: "" });

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);
  const getPL = (c) => getCurrentPL(c, history);
  const totalAUM = useMemo(() => active.reduce((s, c) => s + getPL(c), 0), [active, history]);
  const aumMedio = active.length ? totalAUM / active.length : 0;

  // Consolidada chart
  const evoData = useMemo(() => {
    const dates = [...new Set(history.map((h) => h.data))].sort();
    if (dates.length < 2) return [];
    return dates.map((date) => {
      let aum = 0;
      clients.forEach((c) => {
        const ents = history.filter((h) => h.client_id === c.id && h.data <= date).sort((a, b) => new Date(b.data) - new Date(a.data));
        aum += ents.length > 0 ? Number(ents[0].patrimonio || 0) : Number(c.pl_inicial || 0);
      });
      return { date: fmtDate(date), aum };
    });
  }, [history, clients]);

  // Individual
  const indClient = clients.find((c) => c.id === indSelId) || null;
  const indHist = useMemo(() => {
    if (!indClient) return [];
    const bd = {};
    history.filter((h) => h.client_id === indClient.id).forEach((h) => { bd[h.data] = Number(h.patrimonio); });
    return Object.entries(bd).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([d, pl]) => ({ date: fmtDate(d), pl }));
  }, [history, indClient]);
  const indPL = indClient ? getPL(indClient) : 0;
  const indGV = indClient ? indPL - Number(indClient.pl_inicial || 0) : 0;
  const indGP = indClient && Number(indClient.pl_inicial || 0) > 0 ? (indGV / Number(indClient.pl_inicial || 1)) * 100 : 0;
  const indProg = indClient && indClient.meta_patrimonio ? Math.min(100, Math.round((indPL / Number(indClient.meta_patrimonio)) * 100)) : 0;
  const indSugg = useMemo(() => !indSearch ? [] : active.filter((c) => c.nome.toLowerCase().includes(indSearch.toLowerCase())).slice(0, 6), [active, indSearch]);

  // Manutenção
  const maintClient = clients.find((c) => c.id === maintSelId) || null;
  const maintHist = useMemo(() => history.filter((h) => h.client_id === maintSelId).sort((a, b) => new Date(b.data) - new Date(a.data)), [history, maintSelId]);
  const maintSugg = useMemo(() => !maintSearch ? [] : clients.filter((c) => c.nome.toLowerCase().includes(maintSearch.toLowerCase())).slice(0, 6), [clients, maintSearch]);

  const addPLEntry = async () => {
    if (!maintSelId || !addForm.data || !addForm.patrimonio) { setToast({ type: "error", text: "Preencha data e patrimônio." }); return; }
    await addHistory({ client_id: maintSelId, data: addForm.data, patrimonio: Number(addForm.patrimonio) });
    setAddMode(false); setAddForm({ data: today(), patrimonio: "" });
    setToast({ type: "success", text: "Registro adicionado." });
  };

  const savePLEntry = async () => {
    if (!editForm.data || !editForm.patrimonio) return;
    await updateHistory(editId, { data: editForm.data, patrimonio: Number(editForm.patrimonio) });
    setEditId(null);
    setToast({ type: "success", text: "Atualizado." });
  };

  const GradDef = ({ id, c = B.navy }) => (<defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.28} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient></defs>);

  return (
    <>
      <SecH eyebrow="Histórico" title="Evolução Patrimonial" />
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(6,24,65,0.07)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {[{ id: "consolidada", label: "Consolidada" }, { id: "individual", label: "Individual" }, { id: "manutencao", label: "Manutenção" }].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: subTab === t.id ? B.navy : "transparent", color: subTab === t.id ? "white" : "#8899bb" }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ CONSOLIDADA ═══ */}
      {subTab === "consolidada" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 18 }}>
            <MiniStat label="Patrimônio Médio" value={money(aumMedio)} sub={`${active.length} clientes`} />
            <MiniStat label="Com Histórico" value={[...new Set(history.map((h) => h.client_id))].length} sub="com evolução" />
          </div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>Carteira Consolidada</div>
            {evoData.length < 2 ? <div style={{ padding: 32, textAlign: "center", color: B.gray }}>Sem histórico suficiente.</div> : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={evoData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <GradDef id="ag" /><CartesianGrid strokeDasharray="3 3" stroke={B.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: B.gray }} />
                  <YAxis tick={{ fontSize: 9, fill: B.gray }} tickFormatter={(v) => v >= 1e6 ? `R$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `R$${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={(v) => [money(v), "AUM"]} contentStyle={{ borderRadius: 7, fontSize: 12 }} />
                  <Area type="monotone" dataKey="aum" stroke={B.navy} strokeWidth={2.5} fill="url(#ag)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>PL por Cliente</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f5f7ff" }}>{["#", "Cliente", "Perfil", "Curva", "PL Atual", "PL Inicial", "Var %", "Meta", "Progresso"].map((h) => (<th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}`, whiteSpace: "nowrap" }}>{h}</th>))}</tr></thead>
                <tbody>
                  {[...active].sort((a, b) => getPL(b) - getPL(a)).map((c, i) => {
                    const pl = getPL(c), ini = Number(c.pl_inicial || 0), gv = pl - ini, gp = ini > 0 ? (gv / ini) * 100 : 0;
                    const prog = c.meta_patrimonio ? Math.min(100, Math.round((pl / Number(c.meta_patrimonio)) * 100)) : 0;
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                        <td style={{ padding: "11px 14px", color: B.gray, fontWeight: 700, fontSize: 11 }}>{i + 1}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 700, color: B.navy }}>{c.nome.split(" ").slice(0, 2).join(" ")}</td>
                        <td style={{ padding: "11px 14px" }}><PBadge p={c.perfil} /></td>
                        <td style={{ padding: "11px 14px" }}><CBadge curva={getCurva(pl)} /></td>
                        <td style={{ padding: "11px 14px", fontWeight: 700, color: B.navy }}>{money(pl)}</td>
                        <td style={{ padding: "11px 14px", color: B.gray }}>{money(ini)}</td>
                        <td style={{ padding: "11px 14px", fontWeight: 600, color: gp >= 0 ? "#16a34a" : "#dc2626" }}>{gp >= 0 ? "+" : ""}{gp.toFixed(1)}%</td>
                        <td style={{ padding: "11px 14px", color: B.gray }}>{c.meta_patrimonio ? money(c.meta_patrimonio) : "—"}</td>
                        <td style={{ padding: "11px 14px" }}>{c.meta_patrimonio ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                            <div style={{ flex: 1, height: 6, background: "#e8eeff", borderRadius: 999 }}><div style={{ width: `${prog}%`, height: "100%", background: prog >= 100 ? "#16a34a" : "#2563eb", borderRadius: 999 }} /></div>
                            <span style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>{prog}%</span>
                          </div>
                        ) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ═══ INDIVIDUAL ═══ */}
      {subTab === "individual" && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12 }}>Buscar Cliente</div>
            <SearchBox placeholder="Digite o nome..." value={indSearch} onChange={(e) => { setIndSearch(e.target.value); setIndShowSug(true); }} onFocus={() => setIndShowSug(true)} onBlur={() => setTimeout(() => setIndShowSug(false), 150)} suggestions={indShowSug ? indSugg : []} onSelect={(c) => { setIndSelId(c.id); setIndSearch(c.nome); setIndShowSug(false); }} />
          </Card>
          {indClient ? (
            <>
              <div style={{ background: `linear-gradient(135deg,${B.navy},${B.navy2})`, borderRadius: 11, padding: "18px 22px", marginBottom: 14, color: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Avatar nome={indClient.nome} size={40} />
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{indClient.nome}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}><PBadge p={indClient.perfil} /><CBadge curva={getCurva(indPL)} /></div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", marginBottom: 4 }}>PL Atual</div><div style={{ fontSize: 22, fontWeight: 700 }}>{money(indPL)}</div></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[{ l: "PL Inicial", v: money(indClient.pl_inicial) }, { l: "Var. R$", v: `${indGV >= 0 ? "+" : ""}${money(indGV)}`, neg: indGV < 0 }, { l: "Var. %", v: `${indGP >= 0 ? "+" : ""}${indGP.toFixed(1)}%`, neg: indGP < 0 }, { l: "Meta", v: indClient.meta_patrimonio ? `${indProg}%` : "—" }].map((x, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 9, opacity: 0.5, textTransform: "uppercase" }}>{x.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: x.neg ? "#f87171" : "white", marginTop: 3 }}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {indClient.meta_patrimonio && (
                <Card style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Progresso para a Meta</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 10, background: "#e8eeff", borderRadius: 999 }}><div style={{ width: `${indProg}%`, height: "100%", background: indProg >= 100 ? "#16a34a" : "#2563eb", borderRadius: 999 }} /></div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: indProg >= 100 ? "#16a34a" : B.navy }}>{indProg}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: B.gray }}><span>{money(indPL)}</span><span>Meta: {money(indClient.meta_patrimonio)}</span></div>
                </Card>
              )}
              <Card>
                <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Evolução — {indClient.nome.split(" ")[0]}</div>
                {indHist.length < 2 ? <div style={{ padding: 24, textAlign: "center", color: B.gray }}>Apenas 1 registro. Adicione via Manutenção.</div> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={indHist} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                      <GradDef id="ig" /><CartesianGrid strokeDasharray="3 3" stroke={B.border} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: B.gray }} />
                      <YAxis tick={{ fontSize: 9, fill: B.gray }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                      <Tooltip formatter={(v) => [money(v), "PL"]} contentStyle={{ borderRadius: 7, fontSize: 12 }} />
                      <Area type="monotone" dataKey="pl" stroke={B.navy} strokeWidth={2.5} fill="url(#ig)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </>
          ) : <div style={{ padding: 40, textAlign: "center", color: B.gray, background: "white", borderRadius: 12, border: `1px solid ${B.border}` }}>Digite o nome de um cliente.</div>}
        </>
      )}

      {/* ═══ MANUTENÇÃO ═══ */}
      {subTab === "manutencao" && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12 }}>Buscar Cliente</div>
            <SearchBox placeholder="Digite o nome..." value={maintSearch} onChange={(e) => { setMaintSearch(e.target.value); setMaintShowSug(true); }} onFocus={() => setMaintShowSug(true)} onBlur={() => setTimeout(() => setMaintShowSug(false), 150)} suggestions={maintShowSug ? maintSugg : []} onSelect={(c) => { setMaintSelId(c.id); setMaintSearch(c.nome); setMaintShowSug(false); setEditId(null); setAddMode(false); }} />
          </Card>
          {maintClient ? (
            <>
              <div style={{ background: `linear-gradient(135deg,${B.navy},${B.navy2})`, borderRadius: 11, padding: "16px 20px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar nome={maintClient.nome} size={36} />
                  <div><div style={{ fontSize: 16, fontWeight: 700 }}>{maintClient.nome}</div><div style={{ fontSize: 12, opacity: 0.6 }}>PL: {money(getPL(maintClient))}</div></div>
                </div>
                <button onClick={() => { setAddMode(true); setAddForm({ data: today(), patrimonio: "" }); setEditId(null); }} style={{ background: "white", color: B.navy, border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Adicionar</button>
              </div>
              {addMode && (
                <Card style={{ marginBottom: 12, border: "2px solid #bbf7d0", background: "#f0fdf4" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#166534", marginBottom: 12 }}>Novo Registro</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
                    <Inp label="Data" type="date" value={addForm.data} onChange={(e) => setAddForm((f) => ({ ...f, data: e.target.value }))} style={{ marginBottom: 0 }} />
                    <Inp label="Patrimônio (R$)" type="number" value={addForm.patrimonio} onChange={(e) => setAddForm((f) => ({ ...f, patrimonio: e.target.value }))} placeholder="0" style={{ marginBottom: 0 }} />
                    <button onClick={addPLEntry} style={{ padding: "9px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
                    <button onClick={() => setAddMode(false)} style={{ padding: "9px 16px", background: "white", color: B.gray, border: `1px solid ${B.border}`, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </Card>
              )}
              <Card>
                <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>📋 Histórico — {maintHist.length} registro(s)</div>
                {maintHist.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: B.gray }}>Nenhum registro.</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "#f5f7ff" }}>{["Data", "Patrimônio", "Ações"].map((h) => (<th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{h}</th>))}</tr></thead>
                    <tbody>
                      {maintHist.map((h, i) => (
                        <tr key={h.id} style={{ borderBottom: `1px solid ${B.border}`, background: editId === h.id ? "#f0f4ff" : i % 2 === 0 ? "white" : "#fafbff" }}>
                          {editId === h.id ? (
                            <>
                              <td style={{ padding: "8px 14px" }}><input type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 13, color: B.navy, outline: "none" }} /></td>
                              <td style={{ padding: "8px 14px" }}><input type="number" value={editForm.patrimonio} onChange={(e) => setEditForm((f) => ({ ...f, patrimonio: e.target.value }))} style={{ background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 13, color: B.navy, outline: "none", width: 140 }} /></td>
                              <td style={{ padding: "8px 14px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={savePLEntry} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Salvar</button>
                                  <button onClick={() => setEditId(null)} style={{ background: "white", color: B.gray, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: "11px 14px", color: B.gray }}>{fmtDate(h.data)}</td>
                              <td style={{ padding: "11px 14px", fontWeight: 700, color: B.navy }}>{money(h.patrimonio)}</td>
                              <td style={{ padding: "11px 14px" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => { setEditId(h.id); setEditForm({ data: h.data, patrimonio: String(h.patrimonio) }); setAddMode(false); }} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏</button>
                                  <button onClick={async () => { await deleteHistory(h.id); setToast({ type: "success", text: "Removido." }); }} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          ) : <div style={{ padding: 40, textAlign: "center", color: B.gray, background: "white", borderRadius: 12, border: `1px solid ${B.border}` }}>Busque um cliente.</div>}
        </>
      )}
    </>
  );
}
