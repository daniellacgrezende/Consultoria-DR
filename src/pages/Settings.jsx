import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function Settings() {
  return (
    <>
      <SecH eyebrow="Sistema" title="Configurações ⚙️" desc="Ajustes do sistema." />
      <Card><div style={{ padding: 40, textAlign: "center", color: B.gray }}>Configurações em desenvolvimento.</div></Card>
    </>
  );
}
