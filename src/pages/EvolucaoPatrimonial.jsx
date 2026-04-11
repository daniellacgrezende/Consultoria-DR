import { useState, useMemo } from "react";
import { useData } from "../hooks/useData";
import { B, CURVA_MAP } from "../utils/constants";
import { money } from "../utils/formatters";
import { getCurva, getCurrentPL } from "../utils/helpers";
import Modal from "../components/ui/Modal";
import { Inp, Sel } from "../components/ui/FormFields";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Card from "../components/ui/Card";
import { SecH } from "../components/ui/FormFields";
import Avatar from "../components/ui/Avatar";
import { CBadge } from "../components/ui/Badge";

const PERIODOS = [
  { v: "3", l: "3 meses" },
  { v: "6", l: "6 meses" },
  { v: "12", l: "12 meses" },
  { v: "all", l: "Tudo" },
];

function VarBadge({ pct }) {
  const pos = pct >= 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 7px",
      background: pos ? "#f0fdf4" : "#fef2f2",
      color: pos ? "#16a34a" : "#dc2626",
    }}>
      {pos ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function lastDayOfMonth(yearMonth) {
  // yearMonth = "YYYY-MM"
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export default function EvolucaoPatrimonial() {
  const { clients, history, addHistory, setToast } = useData();
  const [periodo, setPeriodo] = useState("12");
  const [selectedClient, setSelectedClient] = useState("all");

  // Modal lançar PL
  const [plModal, setPlModal] = useState(false);
  const [plForm, setPlForm] = useState({ client_id: "", mes: new Date().toISOString().slice(0, 7), patrimonio: "" });

  const active = useMemo(() => clients.filter((c) => c.status === "ativo"), [clients]);

  const savePL = async () => {
    if (!plForm.client_id) { setToast({ type: "error", text: "Selecione um cliente." }); return; }
    if (!plForm.patrimonio) { setToast({ type: "error", text: "Informe o valor do PL." }); return; }
    const data = lastDayOfMonth(plForm.mes);
    await addHistory({ client_id: plForm.client_id, data, patrimonio: Number(plForm.patrimonio) });
    setPlModal(false);
    setToast({ type: "success", text: `PL lançado para ${data}.` });
  };

  // All history sorted by date
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.data) - new Date(b.data)),
    [history]
  );

  // Build monthly chart data
  const chartData = useMemo(() => {
    const monthSet = new Set();
    sortedHistory.forEach((h) => { if (h.data) monthSet.add(h.data.slice(0, 7)); });
    if (monthSet.size === 0) return [];

    const now = new Date();
    const cutoff =
      periodo === "all"
        ? null
        : new Date(now.getFullYear(), now.getMonth() - parseInt(periodo) + 1, 1);

    const months = [...monthSet].sort().filter((m) => {
      if (!cutoff) return true;
      return new Date(m + "-01") >= cutoff;
    });

    return months.map((month) => {
      let total = 0;
      if (selectedClient === "all") {
        active.forEach((client) => {
          const entries = sortedHistory.filter(
            (h) => h.client_id === client.id && h.data?.slice(0, 7) <= month
          );
          if (entries.length > 0) {
            total += Number(entries[entries.length - 1].patrimonio || 0);
          } else {
            total += Number(client.pl_inicial || 0);
          }
        });
      } else {
        const client = active.find((c) => c.id === selectedClient);
        if (client) {
          const entries = sortedHistory.filter(
            (h) => h.client_id === client.id && h.data?.slice(0, 7) <= month
          );
          total =
            entries.length > 0
              ? Number(entries[entries.length - 1].patrimonio || 0)
              : Number(client.pl_inicial || 0);
        }
      }

      const [y, m] = month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("pt-BR", {
        month: "short", year: "2-digit",
      });

      return { month, label, aum: total };
    });
  }, [sortedHistory, active, periodo, selectedClient]);

  // Per-client summary table
  const clientSummary = useMemo(() => {
    return active
      .map((client) => {
        const entries = sortedHistory
          .filter((h) => h.client_id === client.id)
          .sort((a, b) => new Date(b.data) - new Date(a.data));
        const current =
          entries.length > 0 ? Number(entries[0].patrimonio) : Number(client.pl_inicial || 0);
        const previous =
          entries.length > 1 ? Number(entries[1].patrimonio) : Number(client.pl_inicial || 0);
        const variation = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        return { client, current, variation, curva: getCurva(current) };
      })
      .sort((a, b) => b.current - a.current);
  }, [active, sortedHistory]);

  const totalAUM = clientSummary.reduce((s, r) => s + r.current, 0);
  const firstPoint = chartData[0]?.aum ?? 0;
  const lastPoint = chartData[chartData.length - 1]?.aum ?? totalAUM;
  const totalVar = firstPoint > 0 ? ((lastPoint - firstPoint) / firstPoint) * 100 : 0;
  const totalVarAbs = lastPoint - firstPoint;

  const formatYAxis = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return v;
  };

  const CustomTooltip = ({ active: a, payload, label }) => {
    if (!a || !payload?.length) return null;
    return (
      <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 8, padding: "8px 12px", boxShadow: B.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: B.navy, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: B.navy }}>{money(payload[0].value)}</div>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <SecH eyebrow="Patrimônio" title="Evolução Patrimonial" desc="Acompanhe a evolução do patrimônio da carteira ao longo do tempo." />
        <button
          onClick={() => { setPlForm({ client_id: "", mes: new Date().toISOString().slice(0, 7), patrimonio: "" }); setPlModal(true); }}
          style={{ padding: "8px 18px", background: B.brand, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >+ Lançar PL</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.navy}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>AUM Total Atual</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{money(totalAUM)}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>{active.length} clientes ativos</div>
        </div>

        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${totalVar >= 0 ? "#16a34a" : "#dc2626"}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Variação no Período</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalVar >= 0 ? "#16a34a" : "#dc2626" }}>
            {totalVar >= 0 ? "+" : ""}{totalVar.toFixed(2)}%
          </div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>
            {(totalVarAbs >= 0 ? "+" : "") + money(totalVarAbs)} no período
          </div>
        </div>

        <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${B.brand}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Registros de Histórico</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: B.navy }}>{history.length}</div>
          <div style={{ fontSize: 11, color: "#9baabf", marginTop: 2 }}>atualizações lançadas</div>
        </div>
      </div>

      {/* Chart */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: B.navy }}>Evolução do AUM</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Client selector */}
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ fontSize: 11, padding: "5px 8px", borderRadius: 7, border: `1px solid ${B.border}`, background: "#f8faff", color: B.navy, fontFamily: "inherit", outline: "none" }}
            >
              <option value="all">Carteira total</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {/* Period filter */}
            <div style={{ display: "flex", gap: 4 }}>
              {PERIODOS.map((p) => (
                <button
                  key={p.v}
                  onClick={() => setPeriodo(p.v)}
                  style={{
                    fontSize: 11, padding: "5px 10px", borderRadius: 7, border: `1px solid ${periodo === p.v ? B.navy : B.border}`,
                    background: periodo === p.v ? B.navy : "white", color: periodo === p.v ? "white" : B.navy,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: periodo === p.v ? 700 : 400,
                  }}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>
            Nenhum dado de histórico encontrado. Adicione lançamentos de patrimônio na ficha dos clientes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={B.navy} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={B.navy} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eeff" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: B.gray }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: B.gray }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="aum" stroke={B.navy} strokeWidth={2}
                fill="url(#aumGrad)" dot={false} activeDot={{ r: 4, fill: B.navy }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Per-client table */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 13, color: B.navy, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${B.border}` }}>
          Evolução por Cliente
        </div>
        {clientSummary.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: B.gray, fontSize: 12 }}>Nenhum cliente ativo</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 80px", gap: 8, padding: "0 10px", marginBottom: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: "uppercase" }}>Cliente</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: "uppercase", textAlign: "right" }}>Patrimônio Atual</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: "uppercase", textAlign: "right" }}>Variação (últ. lançamento)</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: B.gray, textTransform: "uppercase", textAlign: "center" }}>Curva</div>
            </div>

            {clientSummary.map(({ client, current, variation, curva }) => (
              <div key={client.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 80px", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "#f8faff", border: `1px solid ${B.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar nome={client.nome} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: B.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.nome}</div>
                    <div style={{ fontSize: 10, color: B.gray }}>{client.profissao || "—"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 700, fontSize: 12, color: B.navy }}>
                  {money(current)}
                </div>
                <div style={{ textAlign: "right" }}>
                  <VarBadge pct={variation} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <CBadge curva={curva} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal Lançar PL */}
      <Modal open={plModal} onClose={() => setPlModal(false)}>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.navy }}>Lançar PL Mensal</h3>
            <button onClick={() => setPlModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: B.gray }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: B.muted, marginBottom: 16, marginTop: 0 }}>
            A data de referência será automaticamente o último dia do mês selecionado.
          </p>
          <Sel
            label="Cliente *"
            value={plForm.client_id}
            onChange={(e) => setPlForm((f) => ({ ...f, client_id: e.target.value }))}
            opts={[{ v: "", l: "Selecione..." }, ...active.map((c) => ({ v: c.id, l: c.nome }))]}
          />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", marginBottom: 4 }}>Mês de Referência *</label>
            <input
              type="month"
              value={plForm.mes}
              onChange={(e) => setPlForm((f) => ({ ...f, mes: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 13, color: B.navy, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
            {plForm.mes && (
              <div style={{ fontSize: 11, color: B.muted, marginTop: 4 }}>
                Data de fechamento: <strong>{lastDayOfMonth(plForm.mes)}</strong>
              </div>
            )}
          </div>
          <Inp
            label="Patrimônio / PL (R$) *"
            type="number"
            value={plForm.patrimonio}
            onChange={(e) => setPlForm((f) => ({ ...f, patrimonio: e.target.value }))}
            placeholder="0"
          />
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => setPlModal(false)} style={{ flex: 1, padding: "10px", background: "white", border: `1px solid ${B.border}`, color: B.muted, borderRadius: 7, cursor: "pointer" }}>Cancelar</button>
            <button onClick={savePL} style={{ flex: 2, padding: "10px", background: B.brand, color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>LANÇAR</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
