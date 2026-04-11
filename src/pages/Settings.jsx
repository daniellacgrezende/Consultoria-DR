import { useState } from "react";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { SecH, Inp } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";

const FIXED_STAGES = ["lead", "cliente", "perdido", "nutricao"];

export default function Settings() {
  const { pipelineStages, savePipelineStage, deletePipelineStage, setToast } = useData();

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", tipo: "main", color: "#1D3557", bg: "#f0f4ff", border_color: "#d5ddf5" });
  const [delConf, setDelConf] = useState(null);

  const mainStages = pipelineStages.filter((s) => s.tipo === "main");
  const exitStages = pipelineStages.filter((s) => s.tipo === "exit");

  const startEdit = (s) => { setEditId(s.id); setEditForm({ ...s }); };

  const saveEdit = async () => {
    await savePipelineStage({ ...editForm }, false);
    setEditId(null);
    setToast({ type: "success", text: "Etapa atualizada." });
  };

  const confirmDelete = async (id) => {
    if (FIXED_STAGES.includes(id)) { setToast({ type: "error", text: "Esta etapa não pode ser removida." }); return; }
    await deletePipelineStage(id);
    setDelConf(null);
    setToast({ type: "success", text: "Etapa removida." });
  };

  const saveNew = async () => {
    if (!newForm.nome?.trim()) { setToast({ type: "error", text: "Informe o nome." }); return; }
    const id = newForm.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (pipelineStages.find((s) => s.id === id)) { setToast({ type: "error", text: "Já existe uma etapa com esse nome." }); return; }
    const maxOrdem = pipelineStages.filter((s) => s.tipo === newForm.tipo).reduce((m, s) => Math.max(m, s.ordem), 0);
    await savePipelineStage({ id, ...newForm, ordem: maxOrdem + 1 }, true);
    setNewModal(false);
    setToast({ type: "success", text: "Etapa criada." });
  };

  const F = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));
  const NF = (k) => (e) => setNewForm((f) => ({ ...f, [k]: e.target.value }));

  const StageRow = ({ s }) => {
    const isEditing = editId === s.id;
    const isFixed = FIXED_STAGES.includes(s.id);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: isEditing ? "#f8faff" : "white", border: `1px solid ${isEditing ? "#818CF8" : B.border}`, marginBottom: 6 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: isEditing ? editForm.color : s.color, flexShrink: 0 }} />
        {isEditing ? (
          <>
            <input value={editForm.nome} onChange={F("nome")} style={{ flex: 1, padding: "4px 8px", border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 13, color: B.navy, fontFamily: "inherit" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: B.muted }}>Cor:</div>
            <input type="color" value={editForm.color} onChange={F("color")} style={{ width: 30, height: 26, border: `1px solid ${B.border}`, borderRadius: 4, cursor: "pointer", padding: 1 }} />
            <button onClick={() => setEditId(null)} style={{ background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveEdit} style={{ background: B.brand, color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: B.navy }}>{s.nome}</span>
            <span style={{ fontSize: 10, color: B.muted, background: s.tipo === "exit" ? "#fef2f2" : "#f0f4ff", border: `1px solid ${s.tipo === "exit" ? "#fecaca" : B.border}`, borderRadius: 999, padding: "1px 7px" }}>{s.tipo === "exit" ? "Saída" : "Principal"}</span>
            <button onClick={() => startEdit(s)} style={{ background: "#f0f4ff", color: B.navy, border: `1px solid ${B.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Editar</button>
            <button onClick={() => isFixed ? setToast({ type: "error", text: "Esta etapa não pode ser removida." }) : setDelConf(s.id)} style={{ background: isFixed ? "#f9fafb" : "#fff5f5", color: isFixed ? "#c4cbd8" : "#dc2626", border: `1px solid ${isFixed ? "#e5e7eb" : "#fecaca"}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: isFixed ? "default" : "pointer" }}>✕</button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <SecH eyebrow="Sistema" title="Configurações" desc="Gerencie as etapas do pipeline e outras configurações." />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${B.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Etapas do Pipeline</div>
          <button onClick={() => { setNewForm({ nome: "", tipo: "main", color: "#1D3557", bg: "#f0f4ff", border_color: "#d5ddf5" }); setNewModal(true); }} style={{ background: B.brand, color: "white", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Nova Etapa</button>
        </div>

        {mainStages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 8 }}>Etapas Principais (funil)</div>
            {mainStages.map((s) => <StageRow key={s.id} s={s} />)}
          </div>
        )}

        {exitStages.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 8 }}>Saídas Alternativas</div>
            {exitStages.map((s) => <StageRow key={s.id} s={s} />)}
          </div>
        )}

        {pipelineStages.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: B.muted, fontSize: 12 }}>Carregando etapas…</div>
        )}
      </Card>

      {/* Modal Nova Etapa */}
      <Modal open={newModal} onClose={() => setNewModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.navy }}>Nova Etapa</h3>
            <button onClick={() => setNewModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.muted }}>×</button>
          </div>

          <Inp label="Nome da Etapa *" value={newForm.nome} onChange={NF("nome")} placeholder="Ex: Apresentação" />

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>Tipo</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["main", "exit"].map((t) => (
                <button key={t} onClick={() => setNewForm((f) => ({ ...f, tipo: t }))} style={{ flex: 1, padding: "8px", borderRadius: 7, border: `1px solid ${newForm.tipo === t ? B.navy : B.border}`, background: newForm.tipo === t ? B.navy : "white", color: newForm.tipo === t ? "white" : B.navy, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {t === "main" ? "Principal" : "Saída alternativa"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 6 }}>Cor</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="color" value={newForm.color} onChange={NF("color")} style={{ width: 44, height: 36, border: `1px solid ${B.border}`, borderRadius: 6, cursor: "pointer", padding: 2 }} />
              <span style={{ fontSize: 12, color: B.muted }}>{newForm.color}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setNewModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={saveNew} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>CRIAR</button>
          </div>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <Modal open={!!delConf} onClose={() => setDelConf(null)}>
        <div style={{ padding: "26px 30px" }}>
          <h3 style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 16, fontWeight: 700 }}>Remover etapa?</h3>
          <p style={{ color: B.gray, fontSize: 13, marginBottom: 22 }}>Leads nessa etapa não serão afetados, mas a coluna sumirá do pipeline.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDelConf(null)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.gray, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => confirmDelete(delConf)} style={{ flex: 1, padding: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Remover</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
