export const huid = () => `h-${Math.random().toString(36).slice(2, 9)}`;
export const cuid = () => `c-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
export const today = () => new Date().toISOString().slice(0, 10);

export const daysSince = (d) => {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d + "T12:00:00").getTime()) / 86400000);
};

export const daysUntil = (d) => {
  if (!d) return null;
  const dt = new Date(d + "T12:00:00");
  if (isNaN(dt)) return null;
  return Math.floor((dt.getTime() - Date.now()) / 86400000);
};

export const getCurva = (p) => {
  const n = Number(p || 0);
  if (n >= 800000) return "A";
  if (n >= 500000) return "B";
  if (n >= 300000) return "C";
  return "D";
};

export const getCurrentPL = (client, history) => {
  const e = history.filter((h) => h.client_id === client.id).sort((a, b) => new Date(b.data) - new Date(a.data));
  return e.length > 0 ? Number(e[0].patrimonio) : Number(client.pl_inicial || 0);
};

export const calcIdade = (dataNasc) => {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

export const getLiquidezAtual = (client, aportes) => {
  const base = Number(client.reserva_emergencia_valor || 0);
  const movs = aportes.filter((a) => a.client_id === client.id && a.is_reserva);
  const entradas = movs.filter((a) => a.tipo === "aporte").reduce((s, a) => s + Number(a.valor || 0), 0);
  const saidas = movs.filter((a) => a.tipo === "resgate").reduce((s, a) => s + Number(a.valor || 0), 0);
  return base + entradas - saidas;
};

export const getPeriodDays = (p) => {
  if (!p) return 90;
  const m = { mensal: 30, bimestral: 60, trimestral: 90, semestral: 180, anual: 365 };
  if (m[p?.toLowerCase()]) return m[p.toLowerCase()];
  const n = parseInt(p);
  return isNaN(n) ? 90 : n;
};

export const getReuniaoStatusDynamic = (dSince, periodDays) => {
  if (dSince === null) return { label: "Nunca", color: "#6b7280", bg: "#f3f4f6" };
  const pd = periodDays || 90;
  const warn1 = Math.round(pd * 0.83);
  const warn2 = Math.round(pd * 0.5);
  if (dSince > pd) return { label: "Atrasado", color: "#dc2626", bg: "#fef2f2" };
  if (dSince > warn1) return { label: "Atenção", color: "#c2410c", bg: "#fff7ed" };
  if (dSince > warn2) return { label: "Regular", color: "#ca8a04", bg: "#fefce8" };
  return { label: "Em dia", color: "#16a34a", bg: "#f0fdf4" };
};
