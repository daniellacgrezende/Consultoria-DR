import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

export default function Calendar() {
  return (
    <>
      <SecH eyebrow="Agenda" title="Calendário 📅" desc="Visualize e gerencie seus compromissos." />
      <Card>
        <div style={{ padding: 40, textAlign: "center", color: B.gray }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: B.navy, marginBottom: 8 }}>Calendário em desenvolvimento</div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Integração com Microsoft Outlook será implementada na próxima sprint.<br />
            Visualização mensal, semanal e diária com eventos vinculados a clientes.
          </p>
        </div>
      </Card>
    </>
  );
}
