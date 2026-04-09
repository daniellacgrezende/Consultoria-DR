import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function Reports() {
  return (
    <>
      <SecH eyebrow="Análise" title="Relatórios 📈" desc="Evolução patrimonial e métricas da carteira." />
      <Card><div style={{ padding: 40, textAlign: "center", color: B.gray }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: B.navy, marginBottom: 8 }}>Relatórios em desenvolvimento</div>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>Evolução patrimonial consolidada e individual, gráficos comparativos, export em XLSX e PDF.</p>
      </div></Card>
    </>
  );
}
