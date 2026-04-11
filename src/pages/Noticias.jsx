import { SecH } from "../components/ui/FormFields";
import Card from "../components/ui/Card";
import { B } from "../utils/constants";

const SOURCES = [
  { label: "Valor Econômico", url: "https://www.valor.com.br/financas", desc: "Mercado financeiro e investimentos" },
  { label: "InfoMoney", url: "https://www.infomoney.com.br", desc: "Notícias, análises e cotações" },
  { label: "Exame Invest", url: "https://exame.com/invest", desc: "Investimentos e economia" },
  { label: "BTG Pactual Insights", url: "https://www.btgpactual.com/research", desc: "Research e análises BTG" },
  { label: "XP Research", url: "https://conteudos.xpi.com.br/assessores/", desc: "Relatórios e recomendações XP" },
  { label: "Tesouro Direto", url: "https://www.tesourodireto.com.br/titulos/historico-de-precos-e-taxas.htm", desc: "Taxas e preços em tempo real" },
];

export default function Noticias() {
  return (
    <>
      <SecH eyebrow="Mercado" title="Notícias" desc="Acesse as principais fontes do mercado financeiro." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {SOURCES.map((s) => (
          <Card key={s.url} style={{ cursor: "pointer" }} onClick={() => window.open(s.url, "_blank")}>
            <div style={{ fontWeight: 700, fontSize: 14, color: B.navy, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: B.gray, marginBottom: 14 }}>{s.desc}</div>
            <div style={{ fontSize: 11, color: B.brand, fontWeight: 600 }}>Acessar →</div>
          </Card>
        ))}
      </div>
    </>
  );
}
