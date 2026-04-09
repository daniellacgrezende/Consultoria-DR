export const money = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const moneyDec = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("pt-BR");
};

export const fmtComp = (c) => {
  if (!c) return "—";
  const [y, m] = c.split("-");
  const ms = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${ms[parseInt(m) - 1]}/${y?.slice(2)}`;
};

export const fmtDaysUntil = (days) => {
  if (days === null) return "—";
  if (days === 0) return "Hoje";
  if (days > 0) return `em ${days}d`;
  return `${Math.abs(days)}d atrás`;
};

export const parseNum = (v) => {
  const n = Number(String(v || "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};
