import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurva, getCurrentPL } from "../utils/helpers";
import Card from "../components/ui/Card";
import MiniStat from "../components/ui/MiniStat";
import Avatar from "../components/ui/Avatar";
import { CBadge } from "../components/ui/Badge";
import { SecH } from "../components/ui/FormFields";

export default function Seguro() {
  const navigate = useNavigate();
  const { clients, history } = useData();

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);
  const getPL = (c) => getCurrentPL(c, history);
  const comSeguro = active.filter((c) => c.seguro_vida || c.seguroVida);
  const semSeguro = active.filter((c) => !(c.seguro_vida || c.seguroVida));
  const totalSeguro = comSeguro.length;
  const premioTotal = comSeguro.reduce((s, c) => s + Number(c.valor_seguro || c.valorSeguro || 0), 0);

  const ClientRow = ({ c, bg }) => (
    <div onClick={() => navigate(`/clients/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${B.border}`, cursor: "pointer", background: bg, marginBottom: 8 }}>
      <Avatar nome={c.nome} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
        <div style={{ fontSize: 11, color: B.gray }}>{c.profissao}</div>
        {(c.seguro_observacao || c.seguroObservacao) && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, fontStyle: "italic" }}>{c.seguro_observacao || c.seguroObservacao}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <CBadge curva={getCurva(getPL(c))} />
        <div style={{ fontSize: 11, color: B.navy, fontWeight: 700, marginTop: 3 }}>{money(getPL(c))}</div>
        {(c.valor_seguro || c.valorSeguro) > 0 && <div style={{ fontSize: 10, color: "#16a34a" }}>Seg: {money(c.valor_seguro || c.valorSeguro)}/mês</div>}
      </div>
    </div>
  );

  return (
    <>
      <SecH eyebrow="Proteção" title="Seguro de Vida" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Com seguro" value={totalSeguro} sub={`${Math.round((totalSeguro / Math.max(active.length, 1)) * 100)}% da base`} />
        <MiniStat label="Sem seguro" value={semSeguro.length} warn={semSeguro.length > 0} />
        <MiniStat label="Prêmio total/mês" value={money(premioTotal)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            Com Seguro <span style={{ marginLeft: "auto", background: "#dcfce7", color: "#16a34a", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>{totalSeguro}</span>
          </div>
          {comSeguro.map((c) => <ClientRow key={c.id} c={c} bg="#f0fdf4" />)}
          {totalSeguro === 0 && <div style={{ padding: 24, textAlign: "center", color: B.gray }}>Nenhum cliente com seguro</div>}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            Sem Seguro <span style={{ marginLeft: "auto", background: "#fee2e2", color: "#dc2626", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>{semSeguro.length}</span>
          </div>
          {semSeguro.map((c) => <ClientRow key={c.id} c={c} bg="#fff5f5" />)}
          {semSeguro.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#16a34a", fontWeight: 600 }}>Todos possuem seguro!</div>}
        </Card>
      </div>
    </>
  );
}
