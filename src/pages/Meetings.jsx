import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../hooks/useData";
import { B } from "../utils/constants";
import { fmtDate } from "../utils/formatters";
import { daysSince, daysUntil, getPeriodDays, today, slugify, addDays } from "../utils/helpers";
import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
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

  // Modal de confirmação de data
  const [actionModal, setActionModal] = useState(null); // { type, client, date }
  // Barra de desfazer
  const [undoBar, setUndoBar] = useState(null); // { label, snapshot }
  useEffect(() => {
    if (!undoBar) return;
    const t = setTimeout(() => setUndoBar(null), 6000);
    return () => clearTimeout(t);
  }, [undoBar]);

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
  const openAction = (type, c) => setActionModal({ type, client: c, date: today() });

  const confirmAction = async () => {
    const { type, client: c, date } = actionModal;
    // Snapshot para desfazer
    const snapshot = {
      ultima_reuniao: c.ultima_reuniao,
      proxima_reuniao: c.proxima_reuniao,
      avisado_em: c.avisado_em,
    };

    if (type === "realizada") {
      const period = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
      const proxima = addDays(date, period);
      await saveClient({ ...c, ultima_reuniao: date, proxima_reuniao: proxima, avisado_em: "" }, false);
      setToast({ type: "success", text: `Reunião realizada em ${fmtDate(date)}. Próxima: ${fmtDate(proxima)}` });
      setUndoBar({ label: `Desfazer "Realizada" — ${c.nome.split(" ")[0]}`, snapshot: { ...c, ...snapshot } });
    } else if (type === "chamei") {
      await saveClient({ ...c, avisado_em: date }, false);
      setToast({ type: "success", text: `Registrado: chamou ${c.nome.split(" ")[0]} em ${fmtDate(date)}.` });
      setUndoBar({ label: `Desfazer "Chamei" — ${c.nome.split(" ")[0]}`, snapshot: { ...c, ...snapshot } });
    } else if (type === "recusou") {
      const period = getPeriodDays(c.periodicidade_reuniao || c.periodicidadeReuniao);
      const proxima = addDays(date, period);
      await saveClient({ ...c, avisado_em: date, proxima_reuniao: proxima }, false);
      setToast({ type: "success", text: `${c.nome.split(" ")[0]} não quis — próxima data ajustada.` });
      setUndoBar({ label: `Desfazer "Não quis" — ${c.nome.split(" ")[0]}`, snapshot: { ...c, ...snapshot } });
    }
    setActionModal(null);
  };

  const handleUndo = async () => {
    if (!undoBar) return;
    await saveClient(undoBar.snapshot, false);
    setToast({ type: "success", text: "Ação desfeita." });
    setUndoBar(null);
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
                      onClick={() => openAction("chamei", c)}
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
                          onClick={() => openAction("realizada", c)}
                          style={{ fontSize: 10, fontWeight: 600, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                        >Realizada</button>

                        {!chameiRecentemente && (
                          <button
                            onClick={() => openAction("chamei", c)}
                            style={{ fontSize: 10, fontWeight: 600, background: "#ECFEFF", color: "#0891B2", border: "1px solid #A5F3FC", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                          >Chamei</button>
                        )}

                        {chameiRecentemente && c.st.key !== "emdia" && (
                          <button
                            onClick={() => openAction("recusou", c)}
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

      {/* ─── Modal confirmação de data ─── */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)}>
        {actionModal && (
          <div style={{ padding: "24px 28px", minWidth: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: B.navy }}>
                {actionModal.type === "realizada" ? "Reunião Realizada" : actionModal.type === "chamei" ? "Registrar Contato" : "Não Quis Reunião"}
              </h3>
              <button onClick={() => setActionModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.muted }}>×</button>
            </div>

            {/* Cliente */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8faff", border: `1px solid ${B.border}`, borderRadius: 8, marginBottom: 16 }}>
              <Avatar nome={actionModal.client.nome} size={28} />
              <div style={{ fontSize: 13, fontWeight: 600, color: B.navy }}>{actionModal.client.nome}</div>
            </div>

            {/* Data */}
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", marginBottom: 6 }}>
              {actionModal.type === "realizada" ? "Data da reunião" : "Data do contato"}
            </label>
            <input
              type="date"
              value={actionModal.date}
              max={today()}
              onChange={(e) => setActionModal((m) => ({ ...m, date: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 14, color: B.navy, fontFamily: "inherit", outline: "none", marginBottom: 18 }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setActionModal(null)}
                style={{ flex: 1, padding: "9px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={confirmAction}
                style={{ flex: 2, padding: "9px", background: actionModal.type === "realizada" ? "#16a34a" : actionModal.type === "chamei" ? "#0891B2" : "#BE123C", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                {actionModal.type === "realizada" ? "Confirmar Realizada" : actionModal.type === "chamei" ? "Confirmar Contato" : "Confirmar Não Quis"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Barra de desfazer ─── */}
      {undoBar && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: B.navy, color: "white", borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 1000, fontSize: 13, fontWeight: 500 }}>
          <span>{undoBar.label}</span>
          <button onClick={handleUndo}
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Desfazer
          </button>
          <button onClick={() => setUndoBar(null)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
