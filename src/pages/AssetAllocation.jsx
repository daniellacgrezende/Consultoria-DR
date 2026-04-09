import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function AssetAllocation() {
  return (
    <>
      <SecH eyebrow="Carteira" title="Alocação de Ativos 📊" desc="Perfis de investidor e enquadramento de carteira." />
      <Card><div style={{ padding: 40, textAlign: "center", color: B.gray }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: B.navy, marginBottom: 8 }}>Asset Allocation em desenvolvimento</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>Compare a carteira real de cada cliente com o modelo do perfil de investidor.<br />Identifique gaps e gere recomendações de enquadramento.</p>
      </div></Card>
    </>
  );
}
