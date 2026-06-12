export const money = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const moneyDec = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("pt-BR");
};

// Formata data de aniversário: "1900-MM-DD" → "DD/MM" | "AAAA-MM-DD" → "DD/MM/AAAA"
export const fmtBirthday = (d) => {
  if (!d || d.length < 10) return "";
  const y = d.slice(0, 4);
  const m = d.slice(5, 7);
  const day = d.slice(8, 10);
  return y === "1900" ? `${day}/${m}` : `${day}/${m}/${y}`;
};

// Faz o parse do texto digitado → formato DB
// Aceita: "DD/MM", "DD/MM/AAAA", "YYYY-MM-DD"
export const parseBirthday = (text) => {
  if (!text || !text.trim()) return null;
  const t = text.trim();
  // Já está no formato DB
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // DD/MM/AAAA
  const full = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (full) {
    const [, d, m, y] = full;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD/MM
  const partial = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (partial) {
    const [, d, m] = partial;
    return `1900-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
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
