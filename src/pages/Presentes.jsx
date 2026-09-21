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
  if (dias === null)  return { bg: "#F9FAFB", border: "#E5E7EB", text: "#6B7280",  badge: "#6B7280"  }; // nunca enviado
  if (dias > 365)     return { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626",  badge: "#DC2626"  }; // +1 ano
  if (dias > 180)     return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706",  badge: "#D97706"  }; // 6m–1a
  return               { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A",  badge: "#16A34A"  }; // ok
}

export default function Presentes() {
  const navigate = useNavigate();
  const { clients, history, saveClient, setToast } = useData();

  const [search, setSearch]       = useState("");
  const [picking, setPicking]     = useState(null); // id do cliente com form aberto
  const [pickDate, setPickDate]   = useState(today());
  const [pickDesc, setPickDesc]   = useState("");
  const [justSaved, setJustSaved] = useState(null);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const rows = useMemo(() => {
    let r = active.map((c) => ({
      ...c,
      dias: daysSince(c.ultimo_presente),
      curva: getCurva(getCurrentPL(c, history)),
    }));
    if (search.trim()) r = r.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()));
    r.sort((a, b) => {
      // Nunca enviado → topo
      if (a.dias === null && b.dias === null) return a.nome.localeCompare(b.nome);
      if (a.dias === null) return -1;
      if (b.dias === null) return 1;
      return b.dias - a.dias; // mais antigo primeiro
    });
    return r;
  }, [active, history, search]);

  const nunca    = rows.filter((c) => c.dias === null).length;
  const maisAno  = rows.filter((c) => c.dias !== null && c.dias > 365).length;
  const meiAno   = rows.filter((c) => c.dias !== null && c.dias > 180 && c.dias <= 365).length;
  const recente  = rows.filter((c) => c.dias !== null && c.dias <= 180).length;

  const abrirForm = (c) => {
    setPicking(c.id);
    setPickDate(today());
    setPickDesc(c.presente_descricao || "");
  };

  const registrar = async (c) => {
    await saveClient({ ...c, ultimo_presente: pickDate, presente_descricao: pickDesc }, false);
    setPicking(null);
    setJustSaved(c.id);
    setTimeout(() => setJustSaved(null), 2500);
    setToast({ type: "success", text: `Presente para ${c.nome.split(" ")[0]} registrado em ${fmtDate(pickDate)}.` });
  };

  return (
    <>
      <SecH eyebrow="Relacionamento" title="Presentes & Lembranças" desc="Registre quando enviou um presente ou lembrança para cada cliente." />

      {/* Resumo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Nunca enviado",  value: nunca,   color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
          { label: "Há mais de 1 ano", value: maisAno, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          { label: "6 meses – 1 ano", value: meiAno,  color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
          { label: "Últimos 6 meses", value: recente, color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
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
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${B.border}` }}>Último presente</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${B.border}` }}>Descrição</th>
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

                  {/* Último presente */}
                  <td style={{ padding: "10px 16px" }}>
                    {c.ultimo_presente ? (
                      <div>
                        <div style={{ fontSize: 12, color: B.gray }}>{fmtDate(c.ultimo_presente)}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: u.text }}>
                          {c.dias === 0 ? "hoje" : `há ${c.dias}d`}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>Nunca registrado</span>
                    )}
                  </td>

                  {/* Descrição */}
                  <td style={{ padding: "10px 16px", maxWidth: 260 }}>
                    {c.presente_descricao ? (
                      <span style={{ fontSize: 12, color: B.gray, fontStyle: "italic" }}>"{c.presente_descricao}"</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                    )}
                  </td>

                  {/* Ação */}
                  <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {saved ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>✓ Registrado!</span>
                    ) : picking === c.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="date"
                            value={pickDate}
                            max={today()}
                            onChange={(e) => setPickDate(e.target.value)}
                            style={{ fontSize: 12, padding: "5px 8px", border: `1.5px solid ${B.navy}`, borderRadius: 6, outline: "none", fontFamily: "inherit", color: B.navy }}
                          />
                          <button
                            onClick={() => setPicking(null)}
                            style={{ fontSize: 11, background: "white", color: B.muted, border: `1px solid ${B.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>✕</button>
                        </div>
                        <input
                          type="text"
                          value={pickDesc}
                          onChange={(e) => setPickDesc(e.target.value)}
                          placeholder="Descrição (ex: vinho, livro…)"
                          style={{ fontSize: 12, padding: "5px 10px", border: `1.5px solid ${B.border}`, borderRadius: 6, outline: "none", fontFamily: "inherit", color: B.navy, width: 220, boxSizing: "border-box" }}
                        />
                        <button
                          onClick={() => registrar(c)}
                          style={{ fontSize: 11, fontWeight: 700, background: "#16A34A", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", alignSelf: "flex-end" }}
                        >Salvar</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => abrirForm(c)}
                        style={{ fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: "6px 14px", border: "none", background: "#061841", color: "white" }}
                      >🎁 Registrar</button>
                    )}
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
