import { useData } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import { B } from "../utils/constants";
import { today } from "../utils/helpers";
import Card from "../components/ui/Card";
import { SecH } from "../components/ui/FormFields";

export default function Backup() {
  const { clients, history, repasse, aportes, reunioes, leads, radar, todos, setToast } = useData();

  const exportJSON = () => {
    const data = { clients, history, repasse, aportes, reunioes, leads, radar, todos, version: "crm360-v1", exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ConsultoriaDR_Backup_${today()}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setToast({ type: "success", text: "Backup exportado!" });
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.clients) throw new Error("Arquivo inválido");

        // Import each entity
        if (data.clients?.length) {
          await supabase.from("clients").delete().neq("id", "");
          await supabase.from("clients").insert(data.clients);
        }
        if (data.history?.length) {
          await supabase.from("history").delete().neq("id", "");
          await supabase.from("history").insert(data.history);
        }
        if (data.repasse?.length) {
          await supabase.from("repasse").delete().neq("id", "");
          await supabase.from("repasse").insert(data.repasse);
        }
        if (data.aportes?.length) {
          await supabase.from("aportes").delete().neq("id", "");
          await supabase.from("aportes").insert(data.aportes);
        }
        if (data.reunioes?.length) {
          await supabase.from("reunioes_hist").delete().neq("id", "");
          await supabase.from("reunioes_hist").insert(data.reunioes);
        }
        if (data.leads?.length) {
          await supabase.from("leads").delete().neq("id", "");
          await supabase.from("leads").insert(data.leads);
        }
        if (data.radar?.length) {
          await supabase.from("radar").delete().neq("id", "");
          await supabase.from("radar").insert(data.radar);
        }
        if (data.todos?.length) {
          await supabase.from("todos").delete().neq("id", "");
          await supabase.from("todos").insert(data.todos);
        }

        setToast({ type: "success", text: `✅ ${data.clients.length} clientes importados! Recarregue a página.` });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setToast({ type: "error", text: "Erro ao importar: arquivo inválido." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <SecH eyebrow="Dados" title="Back-Up 💾" desc="Exporte e importe seus dados." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", border: "none" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 6 }}>📤 Exportar Dados (JSON)</div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 14px", lineHeight: 1.6 }}>Baixa um arquivo com <strong style={{ color: "white" }}>todos os seus dados</strong> — clientes, histórico, aportes, reuniões, leads, tarefas e repasse.</p>
          <button onClick={exportJSON} style={{ background: "white", color: "#16a34a", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>⬇ Exportar JSON</button>
        </Card>
        <Card style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 6 }}>📥 Importar Dados (JSON)</div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 14px", lineHeight: 1.6 }}>Restaura um backup. <strong style={{ color: "#fbbf24" }}>Atenção:</strong> substitui todos os dados atuais.</p>
          <label style={{ background: "white", color: "#2563eb", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "inline-block" }}>
            ⬆ Importar JSON
            <input type="file" accept=".json" style={{ display: "none" }} onChange={importJSON} />
          </label>
        </Card>
      </div>

      <Card style={{ background: `linear-gradient(135deg,${B.navy},${B.navy2})`, border: "none" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 12 }}>📊 Resumo dos Dados</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { l: "Clientes", v: clients.length, c: "#A78BFA" },
            { l: "Histórico PL", v: history.length, c: "#60A5FA" },
            { l: "Aportes", v: aportes.length, c: "#FCD34D" },
            { l: "Reuniões", v: reunioes.length, c: "#C4B5FD" },
            { l: "Leads", v: leads.length, c: "#34D399" },
            { l: "Radar", v: radar.length, c: "#FB923C" },
            { l: "Tarefas", v: todos.length, c: "#F472B6" },
            { l: "Repasse", v: repasse.length, c: "#38BDF8" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
