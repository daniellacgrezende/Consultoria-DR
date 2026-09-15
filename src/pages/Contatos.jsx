import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { daysSince, slugify, getCurva, getCurrentPL } from "../utils/helpers";
import { fmtDate } from "../utils/formatters";
import Avatar from "../components/ui/Avatar";
import Card from "../components/ui/Card";
import { SecH } from "../components/ui/FormFields";
import { CBadge } from "../components/ui/Badge";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function urgencyColor(dias) {
  if (dias === null || dias > 30) return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", badge: "#DC2626" };
  if (dias > 14)                   return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706", badge: "#D97706" };
  return                           { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A", badge: "#16A34A" };
}

export default function Contatos() {
  const navigate = useNavigate();
  const { clients, history, saveClient, setToast } = useData();
  const [search, setSearch] = useState("");
  const [justSaved, setJustSaved] = useState(null); // id do cliente que acabou de ser salvo

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const rows = useMemo(() => {
    let r = active.map((c) => ({
      ...c,
      dias: daysSince(c.ultima_interacao),
      curva: getCurva(getCurrentPL(c, history)),
    }));
    if (search.trim()) r = r.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()));
    // Sem interação primeiro (null = nunca interagiu → topo), depois mais antigo primeiro
    r.sort((a, b) => {
      if (a.dias === null && b.dias === null) return a.nome.localeCompare(b.nome);
      if (a.dias === null) return -1;
      if (b.dias === null) return 1;
      return b.dias - a.dias;
    });
    return r;
  }, [active, history, search]);

  const semInteracao = rows.filter((c) => c.dias === null || c.dias > 30).length;
  const atencao      = rows.filter((c) => c.dias !== null && c.dias > 14 && c.dias <= 30).length;
  const ok           = rows.filter((c) => c.dias !== null && c.dias <= 14).length;

  const registrar = async (c) => {
    await saveClient({ ...c, ultima_interacao: today() }, false);
    setJustSaved(c.id);
    setTimeout(() => setJustSaved(null), 2000);
    setToast({ type: "success", text: `Interação com ${c.nome.split(" ")[0]} registrada.` });
  };

  return (
    <>
      <SecH eyebrow="Relacionamento" title="Contatos" desc="Clique em 'Interagi hoje' sempre que houver qualquer contato com o cliente." />

      {/* Resumo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Sem interação / +30d", value: semInteracao, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          { label: "Atenção (15–30d)",     value: atencao,      color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
          { label: "Em dia (≤14d)",        value: ok,           color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
        ].map((item) => (
          <div key={item.label} style={{ flex: 1, background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: item.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Buscar cliente…"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1.5px solid ${search ? B.navy : B.border}`, borderRadius: 9, fontSize: 13, color: B.navy, outline: "none", fontFamily: "inherit", background: search ? "#f0f4ff" : "white" }}
        />
      </div>

      {/* Lista */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F5F7FF" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${B.border}` }}>Cliente</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${B.border}` }}>Última interação</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${B.border}` }}>Situação</th>
              <th style={{ padding: "10px 16px", borderBottom: `1px solid ${B.border}` }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const u = urgencyColor(c.dias);
              const saved = justSaved === c.id;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#FAFBFF" }}>
                  {/* Nome */}
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar nome={c.nome} size={30} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            onClick={() => navigate(`/clients/${slugify(c.nome)}`)}
                            style={{ fontWeight: 600, color: B.navy, cursor: "pointer", textDecoration: "underline dotted" }}
                          >{c.nome}</span>
                          <CBadge curva={c.curva} />
                        </div>
                        <div style={{ fontSize: 11, color: B.muted }}>{c.profissao || "—"}</div>
                      </div>
                    </div>
                  </td>

                  {/* Última interação */}
                  <td style={{ padding: "10px 16px" }}>
                    {c.ultima_interacao ? (
                      <div>
                        <div style={{ fontSize: 12, color: B.gray }}>{fmtDate(c.ultima_interacao)}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: u.text }}>há {c.dias}d</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>Nunca registrado</span>
                    )}
                  </td>

                  {/* Situação */}
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                      color: u.badge, background: u.bg, border: `1px solid ${u.border}`,
                      borderRadius: 999, padding: "3px 10px",
                    }}>
                      {c.dias === null ? "Sem registro" : c.dias > 30 ? `${c.dias}d sem contato` : c.dias > 14 ? "Atenção" : "Em dia"}
                    </span>
                  </td>

                  {/* Ação */}
                  <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => registrar(c)}
                      style={{
                        fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 6,
                        padding: "6px 14px", border: "none", transition: "all 0.15s",
                        background: saved ? "#16A34A" : "#061841",
                        color: "white",
                      }}
                    >
                      {saved ? "✓ Registrado!" : "Interagi hoje"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
