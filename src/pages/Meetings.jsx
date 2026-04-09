import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function Meetings() {
  return (
    <>
      <SecH eyebrow="Agenda" title="Reuniões 📋" desc="Acompanhe e registre as reuniões com seus clientes." />
      <Card><div style={{ padding: 40, textAlign: "center", color: B.gray }}>Módulo de reuniões será implementado na próxima sprint.</div></Card>
    </>
  );
}
