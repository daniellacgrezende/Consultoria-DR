import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";
import { B, PERFIL_MAP } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurrentPL } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { PBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Inp, SecH } from "../components/ui/FormFields";

const ASSET_CLASSES = ["renda_fixa", "renda_variavel", "multimercado", "internacional", "alternativos"];
const ASSET_LABELS = { renda_fixa: "Renda Fixa", renda_variavel: "Renda Variável", multimercado: "Multimercado", internacional: "Internacional", alternativos: "Alternativos" };
const ASSET_COLORS = ["#2563eb", "#dc2626", "#f59e0b", "#0891b2", "#7c3aed"];

export default function AssetAllocation() {
  const { clients, history, setToast } = useData();
  const [profiles, setProfiles] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState(null);
  const [showSug, setShowSug] = useState(false);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => {
    Promise.all([
      supabase.from("allocation_profiles").select("*"),
      supabase.from("client_allocation").select("*"),
    ]).then(([p, a]) => {
      setProfiles(p.data || []);
      setAllocations(a.data || []);
    });
  }, []);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);
  const sugg = useMemo(() => !search ? [] : active.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase())).slice(0, 6), [active, search]);
  const selClient = clients.find((c) => c.id === selId);
  const selProfile = selClient ? profiles.find((p) => p.id === selClient.perfil) : null;
  const selAllocation = selClient ? allocations.find((a) => a.client_id === selClient.id) : null;
  const pl = selClient ? getCurrentPL(selClient, history) : 0;

  const modelData = selProfile ? ASSET_CLASSES.map((k, i) => ({ name: ASSET_LABELS[k], value: Number(selProfile[k] || 0), fill: ASSET_COLORS[i] })) : [];
  const actualData = selAllocation ? ASSET_CLASSES.map((k, i) => ({ name: ASSET_LABELS[k], value: Number(selAllocation[k] || 0), fill: ASSET_COLORS[i] })) : [];

  const startEdit = () => {
    const base = selAllocation || {};
    setForm(ASSET_CLASSES.reduce((acc, k) => ({ ...acc, [k]: base[k] || 0 }), {}));
    setEditing(true);
  };

  const saveAllocation = async () => {
    const total = ASSET_CLASSES.reduce((s, k) => s + Number(form[k] || 0), 0);
    if (Math.abs(total - 100) > 0.5) { setToast({ type: "error", text: `Total deve ser 100%. Atual: ${total.toFixed(1)}%` }); return; }

    if (selAllocation) {
      await supabase.from("client_allocation").update({ ...form, updated_at: new Date().toISOString() }).eq("id", selAllocation.id);
      setAllocations((p) => p.map((a) => a.id === selAllocation.id ? { ...a, ...form } : a));
    } else {
      const entry = { id: `alloc-${Date.now()}`, client_id: selId, ...form };
      const { data } = await supabase.from("client_allocation").insert(entry).select();
      if (data) setAllocations((p) => [...p, data[0]]);
    }
    setEditing(false);
    setToast({ type: "success", text: "Alocação atualizada." });
  };

  const totalForm = ASSET_CLASSES.reduce((s, k) => s + Number(form[k] || 0), 0);

  const startEditProfile = (p) => {
    setEditingProfileId(p.id);
    setProfileForm(ASSET_CLASSES.reduce((acc, k) => ({ ...acc, [k]: p[k] || 0 }), {}));
  };

  const saveProfile = async () => {
    const total = ASSET_CLASSES.reduce((s, k) => s + Number(profileForm[k] || 0), 0);
    if (Math.abs(total - 100) > 0.5) { setToast({ type: "error", text: `Total deve ser 100%. Atual: ${total.toFixed(1)}%` }); return; }
    await supabase.from("allocation_profiles").update({ ...Object.fromEntries(ASSET_CLASSES.map((k) => [k, Number(profileForm[k] || 0)])) }).eq("id", editingProfileId);
    setProfiles((prev) => prev.map((p) => p.id === editingProfileId ? { ...p, ...profileForm } : p));
    setEditingProfileId(null);
    setToast({ type: "success", text: "Perfil atualizado." });
  };

  const totalProfileForm = ASSET_CLASSES.reduce((s, k) => s + Number(profileForm[k] || 0), 0);

  // ─── New profile ───
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", color: "#2563eb", renda_fixa: 0, renda_variavel: 0, multimercado: 0, internacional: 0, alternativos: 0 });
  const totalNewForm = ASSET_CLASSES.reduce((s, k) => s + Number(newForm[k] || 0), 0);

  const openNewProfile = () => {
    setNewForm({ nome: "", color: "#2563eb", renda_fixa: 0, renda_variavel: 0, multimercado: 0, internacional: 0, alternativos: 0 });
    setNewModal(true);
  };

  const saveNewProfile = async () => {
    if (!newForm.nome?.trim()) { setToast({ type: "error", text: "Informe o nome do perfil." }); return; }
    if (Math.abs(totalNewForm - 100) > 0.5) { setToast({ type: "error", text: `Total deve ser 100%. Atual: ${totalNewForm.toFixed(1)}%` }); return; }
    const id = newForm.nome.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (profiles.find((p) => p.id === id)) { setToast({ type: "error", text: "Já existe um perfil com esse nome." }); return; }
    const entry = { id, nome: newForm.nome, color: newForm.color, ...Object.fromEntries(ASSET_CLASSES.map((k) => [k, Number(newForm[k] || 0)])) };
    const { data, error } = await supabase.from("allocation_profiles").insert(entry).select();
    if (error) { setToast({ type: "error", text: `Erro: ${error.message}` }); return; }
    if (data) setProfiles((p) => [...p, data[0]]);
    setNewModal(false);
    setToast({ type: "success", text: "Perfil criado!" });
  };

  // ─── Delete profile ───
  const [delConf, setDelConf] = useState(null);

  const deleteProfile = async (id) => {
    const { error } = await supabase.from("allocation_profiles").delete().eq("id", id);
    if (error) { setToast({ type: "error", text: `Erro: ${error.message}` }); return; }
    setProfiles((p) => p.filter((pr) => pr.id !== id));
    setDelConf(null);
    setToast({ type: "success", text: "Perfil removido." });
  };

  return (
    <>
      <SecH eyebrow="Carteira" title="Alocação de Ativos" desc="Compare a carteira real vs modelo do perfil." />

      {/* Perfis modelo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Alocação por Perfil</span>
          <button onClick={openNewProfile} style={{ background: B.brand, color: "white", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Novo Perfil</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f5f7ff" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>Perfil</th>
                {ASSET_CLASSES.map((k) => (
                  <th key={k} style={{ padding: "10px 14px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", borderBottom: `1px solid ${B.border}` }}>{ASSET_LABELS[k]}</th>
                ))}
                <th style={{ padding: "10px 14px", borderBottom: `1px solid ${B.border}` }} />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => {
                const isEditingThis = editingProfileId === p.id;
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#fafbff" }}>
                    <td style={{ padding: "10px 14px" }}><PBadge p={p.id} /></td>
                    {ASSET_CLASSES.map((k) => (
                      <td key={k} style={{ padding: "8px 14px", textAlign: "center" }}>
                        {isEditingThis ? (
                          <input type="number" value={profileForm[k] ?? ""} onChange={(e) => setProfileForm((f) => ({ ...f, [k]: e.target.value }))} style={{ width: 60, padding: "4px 6px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 13, color: B.navy, outline: "none", textAlign: "right" }} />
                        ) : (
                          <span style={{ fontWeight: 600, color: B.navy }}>{p[k]}%</span>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {isEditingThis ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: Math.abs(totalProfileForm - 100) <= 0.5 ? "#16a34a" : "#dc2626" }}>{totalProfileForm.toFixed(1)}%</span>
                          <button onClick={() => setEditingProfileId(null)} style={{ background: "white", color: B.gray, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                          <button onClick={saveProfile} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => startEditProfile(p)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Editar</button>
                          <button onClick={() => setDelConf(p.id)} style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Buscar cliente */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12 }}>Analisar Cliente</div>
        <SearchBox placeholder="Buscar cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setShowSug(true); }} onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 150)} suggestions={showSug ? sugg : []} onSelect={(c) => { setSelId(c.id); setSearch(c.nome); setShowSug(false); setEditing(false); }} />
      </Card>

      {selClient && (
        <>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg,${B.navy},${B.navy2})`, borderRadius: 11, padding: "18px 22px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar nome={selClient.nome} size={40} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{selClient.nome}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}><PBadge p={selClient.perfil} /></div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, opacity: 0.5 }}>PL Atual</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{money(pl)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Modelo */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Modelo — {PERFIL_MAP[selClient.perfil]?.label || selClient.perfil}</div>
              {selProfile ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={modelData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false} fontSize={10}>{modelData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie><Tooltip formatter={(v) => [`${v}%`]} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                    {modelData.map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: B.gray }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: d.fill }} />{d.name}: {d.value}%</div>
                    ))}
                  </div>
                </>
              ) : <div style={{ padding: 20, textAlign: "center", color: B.gray }}>Perfil não encontrado.</div>}
            </Card>

            {/* Carteira Real */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between" }}>
                <span>Carteira Real</span>
                {!editing && <button onClick={startEdit} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{selAllocation ? "Editar" : "+ Cadastrar"}</button>}
              </div>
              {editing ? (
                <div>
                  {ASSET_CLASSES.map((k, i) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: ASSET_COLORS[i], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: B.navy, width: 120 }}>{ASSET_LABELS[k]}</span>
                      <input type="number" value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} style={{ width: 70, padding: "4px 8px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 13, color: B.navy, outline: "none", textAlign: "right" }} />
                      <span style={{ fontSize: 11, color: B.gray }}>%</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: "8px 12px", background: Math.abs(totalForm - 100) <= 0.5 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${Math.abs(totalForm - 100) <= 0.5 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(totalForm - 100) <= 0.5 ? "#16a34a" : "#dc2626" }}>Total: {totalForm.toFixed(1)}%</span>
                    {Math.abs(totalForm - 100) > 0.5 && <span style={{ fontSize: 11, color: "#dc2626" }}>Deve ser 100%</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "8px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={saveAllocation} style={{ flex: 2, padding: "8px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Salvar</button>
                  </div>
                </div>
              ) : selAllocation ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={actualData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false} fontSize={10}>{actualData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Pie><Tooltip formatter={(v) => [`${v}%`]} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                    {actualData.map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: B.gray }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: d.fill }} />{d.name}: {d.value}%</div>
                    ))}
                  </div>
                </>
              ) : <div style={{ padding: 20, textAlign: "center", color: B.gray }}>Nenhuma alocação cadastrada.</div>}
            </Card>
          </div>

          {/* Comparativo */}
          {selProfile && selAllocation && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>Comparativo: Modelo vs Real — Gaps</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {ASSET_CLASSES.map((k, i) => {
                  const modelo = Number(selProfile[k] || 0);
                  const real = Number(selAllocation[k] || 0);
                  const gap = real - modelo;
                  const isOk = Math.abs(gap) <= 3;
                  return (
                    <div key={k} style={{ background: isOk ? "#f0fdf4" : gap > 0 ? "#fef2f2" : "#fffbeb", border: `1px solid ${isOk ? "#bbf7d0" : gap > 0 ? "#fecaca" : "#fde68a"}`, borderRadius: 8, padding: "12px", textAlign: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: ASSET_COLORS[i], margin: "0 auto 6px" }} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>{ASSET_LABELS[k]}</div>
                      <div style={{ fontSize: 11, color: B.gray }}>Modelo: {modelo}%</div>
                      <div style={{ fontSize: 11, color: B.gray }}>Real: {real}%</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isOk ? "#16a34a" : gap > 0 ? "#dc2626" : "#92400e", marginTop: 4 }}>
                        {isOk ? "OK" : gap > 0 ? `+${gap.toFixed(1)}%` : `${gap.toFixed(1)}%`}
                      </div>
                      {!isOk && (
                        <div style={{ fontSize: 10, color: gap > 0 ? "#dc2626" : "#92400e", marginTop: 2 }}>
                          {gap > 0 ? `Reduzir ${money(pl * gap / 100)}` : `Aportar ${money(pl * Math.abs(gap) / 100)}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {!selClient && (
        <div style={{ padding: 40, textAlign: "center", color: B.gray, background: "white", borderRadius: 12, border: `1px solid ${B.border}` }}>Selecione um cliente para analisar a alocação.</div>
      )}

      {/* Modal Novo Perfil */}
      <Modal open={newModal} onClose={() => setNewModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.navy }}>Novo Perfil de Alocação</h3>
            <button onClick={() => setNewModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
            <Inp label="Nome do Perfil *" value={newForm.nome} onChange={(e) => setNewForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Ultra Conservador" />
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 4 }}>Cor</label>
              <input type="color" value={newForm.color} onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))} style={{ width: 44, height: 36, border: `1px solid ${B.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
            </div>
          </div>
          {ASSET_CLASSES.map((k, i) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ASSET_COLORS[i], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: B.navy, width: 120 }}>{ASSET_LABELS[k]}</span>
              <input type="number" value={newForm[k] || ""} onChange={(e) => setNewForm((f) => ({ ...f, [k]: e.target.value }))} style={{ width: 70, padding: "4px 8px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 13, color: B.navy, outline: "none", textAlign: "right" }} />
              <span style={{ fontSize: 11, color: B.gray }}>%</span>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "8px 12px", background: Math.abs(totalNewForm - 100) <= 0.5 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${Math.abs(totalNewForm - 100) <= 0.5 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(totalNewForm - 100) <= 0.5 ? "#16a34a" : "#dc2626" }}>Total: {totalNewForm.toFixed(1)}%</span>
            {Math.abs(totalNewForm - 100) > 0.5 && <span style={{ fontSize: 11, color: "#dc2626" }}>Deve ser 100%</span>}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => setNewModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveNewProfile} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>CRIAR PERFIL</button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>Remover perfil?</h3>
          <p style={{ color: B.gray, fontSize: 13, marginBottom: 22 }}>Clientes com este perfil não serão afetados, mas o modelo de alocação será removido.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => deleteProfile(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
