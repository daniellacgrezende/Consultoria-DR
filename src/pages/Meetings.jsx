import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, daysUntil, getPeriodDays, today, slugify, addDays } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import SearchBox from "../components/ui/SearchBox";
import { SecH } from "../components/ui/FormFields";

const GRACE_DAYS = 10; // margem após vencimento antes de virar "Atrasado"

/* ─── Status logic ─── */
function getStatus(c) {
  const diasSem = daysSince(c.ultima_reuniao || c.ultimaReuniao);
  const period  = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
  const dAv     = daysSince(c.avisado_em || c.avisadoEm);
  // "chamei" válido se registrado dentro do período + margem
  const chamei  = dAv !== null && dAv <= period + GRACE_DAYS;

  // Nunca reuniu ou passou do prazo + margem de 10 dias
  if (diasSem === null || diasSem > period + GRACE_DAYS) {
    if (chamei) return { key: "aguardando", label: "Aguardando", color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" };
    return       { key: "atrasado",  label: "Atrasado",  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
  }

  // Dentro da margem de 10 dias após vencimento → hora de agendar
  if (diasSem > period) return { key: "agendar", label: "Agendar", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };

  // Últimos 25% do período → hora de agendar
  if (diasSem >= Math.round(period * 0.75)) return { key: "agendar", label: "Agendar", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };

  return { key: "emdia", label: "Em dia", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" };
}

/* ─── Badge ─── */
function StatusBadge({ st }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
      color: st.color, background: st.bg, border: `1px solid ${st.border}`,
      borderRadius: 999, padding: "3px 10px",
    }}>
      {st.label}
    </span>
  );
}

/* ═══════════════════════════════════════════ */
export default function Meetings() {
  const navigate  = useNavigate();
  const { clients, reunioes, saveClient, setToast } = useData();
  const [sortCol, setSortCol]   = useState("status");
  const [sortDir, setSortDir]   = useState("asc");
  const [rhFilter, setRhFilter] = useState(null);
  const [rhSearch, setRhSearch] = useState("");
  const [rhShowSug, setRhShowSug] = useState(false);

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  /* ─── Enriched rows ─── */
  const rows = useMemo(() => {
    const STATUS_ORDER = { atrasado: 0, agendar: 1, aguardando: 2, emdia: 3 };
    const enriched = active.map((c) => ({
      ...c,
      diasSem:    daysSince(c.ultima_reuniao || c.ultimaReuniao),
      diasAte:    daysUntil(c.proxima_reuniao || c.proximaReuniao),
      periodDays: getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao),
      st:         getStatus(c),
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    enriched.sort((a, b) => {
      if (sortCol === "status")  return dir * (STATUS_ORDER[a.st.key] - STATUS_ORDER[b.st.key]);
      if (sortCol === "diasSem") return dir * ((b.diasSem ?? -1) - (a.diasSem ?? -1));
      if (sortCol === "diasAte") return dir * ((a.diasAte ?? 99999) - (b.diasAte ?? 99999));
      return 0;
    });
    return enriched;
  }, [active, sortCol, sortDir]);

  const counts = useMemo(() => ({
    atrasado:   rows.filter((r) => r.st.key === "atrasado").length,
    agendar:    rows.filter((r) => r.st.key === "agendar").length,
    aguardando: rows.filter((r) => r.st.key === "aguardando").length,
    emdia:      rows.filter((r) => r.st.key === "emdia").length,
  }), [rows]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  /* ─── Actions ─── */
  const markRealizada = async (c) => {
    const period = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
    const proxima = addDays(today(), period);
    await saveClient({ ...c, ultima_reuniao: today(), proxima_reuniao: proxima, avisado_em: "" }, false);
    setToast({ type: "success", text: `Reunião realizada. Próxima: ${fmtDate(proxima)}` });
  };

  // Chamei o cliente para reunião (independente de ele aceitar ou não)
  const markChamei = async (c) => {
    await saveClient({ ...c, avisado_em: today() }, false);
    setToast({ type: "success", text: `Registrado: você chamou ${c.nome.split(" ")[0]} hoje.` });
  };

  // Cliente não quis reunião: registra a tentativa e avança a próxima data pelo período
  const markRecusou = async (c) => {
    const period = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
    const proxima = addDays(today(), period);
    await saveClient({ ...c, avisado_em: today(), proxima_reuniao: proxima }, false);
    setToast({ type: "success", text: `${c.nome.split(" ")[0]} não quis reunião — tentativa registrada, próxima data ajustada.` });
  };

  /* ─── Alertas rápidos ─── */
  const atrasados = rows.filter((r) => r.st.key === "atrasado").slice(0, 6);
  const aAgendar  = rows.filter((r) => r.st.key === "agendar").slice(0, 6);

  /* ─── Histórico ─── */
  const rhFiltered = useMemo(() =>
    reunioes.filter((r) => !rhFilter || r.client_id === rhFilter)
             .sort((a, b) => b.data.localeCompare(a.data)),
  [reunioes, rhFilter]);

  const Th = ({ col, children }) => (
    <th
      onClick={col ? () => toggleSort(col) : undefined}
      style={{
        padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700,
        color: sortCol === col ? B.navy : "#8899bb",
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: `1px solid ${B.border}`, background: "#F5F7FF",
        cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
      }}
    >
      {children}{col && sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <>
      <SecH eyebrow="Agenda" title="Reuniões" desc="Controle de frequência e pendências por cliente." />

      {/* ─── Summary bar ─── */}
      <div style={{
        display: "flex", background: "white", border: `1px solid ${B.border}`,
        borderRadius: 10, marginBottom: 18, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {[
          { label: "Atrasado",   value: counts.atrasado,   color: "#DC2626", warn: counts.atrasado > 0 },
          { label: "Agendar",    value: counts.agendar,    color: "#D97706", warn: counts.agendar > 0 },
          { label: "Aguardando", value: counts.aguardando, color: "#0891B2" },
          { label: "Em dia",     value: counts.emdia,      color: "#16A34A" },
        ].map((item, i, arr) => (
          <div key={i} style={{
            flex: 1, padding: "12px 16px", textAlign: "center",
            borderRight: i < arr.length - 1 ? `1px solid ${B.border}` : "none",
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: item.warn ? item.color : item.color, letterSpacing: "-1px", lineHeight: 1 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Alert panels ─── */}
      {(atrasados.length > 0 || aAgendar.length > 0) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: atrasados.length > 0 && aAgendar.length > 0 ? "1fr 1fr" : "1fr",
          gap: 12, marginBottom: 18,
        }}>
          {atrasados.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Atrasado — mais de 10 dias sem contato
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {atrasados.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #FECACA", borderRadius: 7, padding: "7px 10px" }}>
                    <Avatar nome={c.nome} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>
                        {c.diasSem !== null ? `${c.diasSem}d sem reunião` : "Nunca reuniu"} · {c.periodicidade_reuniao || "Trimestral"}
                      </div>
                    </div>
                    <button
                      onClick={() => markChamei(c)}
                      style={{ fontSize: 9.5, fontWeight: 700, background: "#ECFEFF", color: "#0891B2", border: "1px solid #A5F3FC", borderRadius: 5, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap" }}
                    >Chamei</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aAgendar.length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Hora de agendar
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {aAgendar.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #FDE68A", borderRadius: 7, padding: "7px 10px" }}>
                    <Avatar nome={c.nome} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: "#D97706", fontWeight: 600 }}>
                        Próxima: {fmtDate(c.proxima_reuniao || c.proximaReuniao)}
                        {c.diasAte !== null && ` · em ${c.diasAte}d`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tabela principal ─── */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th col="diasSem">Última Reunião</Th>
                <Th>Periodicidade</Th>
                <Th col="diasAte">Próxima</Th>
                <Th>Último Contato</Th>
                <Th col="status">Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: B.muted }}>Nenhum cliente ativo</td></tr>
              )}
              {rows.map((c, i) => {
                const dAv     = daysSince(c.avisado_em || c.avisadoEm);
                const chameiRecentemente = dAv !== null && dAv <= c.periodDays;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${B.border}`, background: i % 2 === 0 ? "white" : "#FAFBFF" }}>

                    {/* Nome */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar nome={c.nome} size={28} />
                        <div>
                          <div style={{ fontWeight: 600, color: B.navy, fontSize: 12 }}>{c.nome}</div>
                          <div style={{ fontSize: 10, color: B.muted }}>{c.profissao}</div>
                        </div>
                      </div>
                    </td>

                    {/* Última reunião */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, color: B.muted }}>{fmtDate(c.ultima_reuniao || c.ultimaReuniao) || "—"}</div>
                      {c.diasSem !== null && (
                        <div style={{ fontSize: 10, color: c.diasSem > c.periodDays ? "#DC2626" : B.muted, fontWeight: 600 }}>
                          há {c.diasSem}d
                        </div>
                      )}
                    </td>

                    {/* Periodicidade */}
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: B.navy, background: "#F0F4FF", border: `1px solid ${B.border}`, borderRadius: 999, padding: "2px 10px" }}>
                        {c.periodicidade_reuniao || c.periodicidadeReuniao || "Trimestral"}
                      </span>
                    </td>

                    {/* Próxima */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, color: B.muted }}>{fmtDate(c.proxima_reuniao || c.proximaReuniao) || "—"}</div>
                      {c.diasAte !== null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: c.diasAte < 0 ? "#DC2626" : c.diasAte <= 14 ? "#D97706" : B.muted }}>
                          {c.diasAte < 0 ? `${Math.abs(c.diasAte)}d atrás` : c.diasAte === 0 ? "hoje" : `em ${c.diasAte}d`}
                        </div>
                      )}
                    </td>

                    {/* Último contato (chamei / avisei) */}
                    <td style={{ padding: "10px 14px" }}>
                      {(c.avisado_em || c.avisadoEm) ? (
                        <div>
                          <div style={{ fontSize: 11, color: "#0891B2", fontWeight: 600 }}>Chamei em</div>
                          <div style={{ fontSize: 11, color: B.muted }}>{fmtDate(c.avisado_em || c.avisadoEm)}</div>
                          {dAv !== null && <div style={{ fontSize: 10, color: B.muted }}>há {dAv}d</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#C4CBD8" }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge st={c.st} />
                    </td>

                    {/* Ações */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <button
                          onClick={() => navigate(`/clients/${slugify(c.nome)}`)}
                          style={{ fontSize: 10, fontWeight: 600, background: B.brand, color: "white", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                        >Ficha</button>

                        <button
                          onClick={() => markRealizada(c)}
                          style={{ fontSize: 10, fontWeight: 600, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                        >Realizada</button>

                        {/* Mostrar "Chamei" quando ainda não chamou ou chamou há muito tempo */}
                        {!chameiRecentemente && (
                          <button
                            onClick={() => markChamei(c)}
                            style={{ fontSize: 10, fontWeight: 600, background: "#ECFEFF", color: "#0891B2", border: "1px solid #A5F3FC", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                          >Chamei</button>
                        )}

                        {/* Mostrar "Não quis" quando já chamou recentemente */}
                        {chameiRecentemente && c.st.key !== "emdia" && (
                          <button
                            onClick={() => markRecusou(c)}
                            style={{ fontSize: 10, fontWeight: 600, background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                          >Não quis</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Histórico ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: B.navy }}>Histórico de Reuniões</span>
        <span style={{ fontSize: 12, color: B.muted }}>{reunioes.length} registro(s)</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <div style={{ flex: 1, maxWidth: 340 }}>
          <SearchBox
            placeholder="Filtrar por cliente..."
            value={rhSearch}
            onChange={(e) => { setRhSearch(e.target.value); setRhShowSug(true); }}
            onFocus={() => setRhShowSug(true)}
            onBlur={() => setTimeout(() => setRhShowSug(false), 150)}
            suggestions={rhShowSug ? clients.filter((c) => c.nome.toLowerCase().includes(rhSearch.toLowerCase())).slice(0, 6) : []}
            onSelect={(c) => { setRhFilter(c.id); setRhSearch(c.nome); setRhShowSug(false); }}
          />
        </div>
        {rhFilter && (
          <button
            onClick={() => { setRhFilter(null); setRhSearch(""); }}
            style={{ padding: "8px 14px", background: "white", color: B.muted, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >✕ Limpar</button>
        )}
      </div>

      {rhFiltered.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: B.muted, background: "white", border: `1px solid ${B.border}`, borderRadius: 12 }}>
          Nenhum registro{rhFilter ? " para este cliente" : ""}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rhFiltered.slice(0, 20).map((r) => {
            const cl = clients.find((c) => c.id === r.client_id);
            return (
              <div key={r.id} style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 11, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar nome={cl?.nome || "?"} size={28} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>{cl?.nome || "—"}</div>
                      <div style={{ fontSize: 11, color: B.muted }}>{cl?.profissao || "—"}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: B.navy }}>{fmtDate(r.data)}</div>
                    <button
                      onClick={() => cl && navigate(`/clients/${slugify(cl.nome)}`)}
                      style={{ fontSize: 10, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginTop: 2 }}
                    >Ver ficha →</button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#445566", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#F8FAFF", border: `1px solid ${B.border}`, borderRadius: 8, padding: "10px 12px" }}>
                  {r.texto}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
