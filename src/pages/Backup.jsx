import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function Backup() {
  return (
    <>
      <SecH eyebrow="Dados" title="Back-Up 💾" desc="Exporte e importe seus dados." />
      <Card><div style={{ padding: 40, textAlign: "center", color: B.gray }}>Módulo de backup será implementado na próxima sprint.</div></Card>
    </>
  );
}
