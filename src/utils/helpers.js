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

export const getReuniaoStatus = (dSince) => {
  if (dSince === null) return { label: "Nunca", color: "#6b7280", bg: "#f3f4f6" };
  if (dSince > 90) return { label: "Crítico", color: "#dc2626", bg: "#fef2f2" };
  if (dSince > 75) return { label: "Atenção", color: "#c2410c", bg: "#fff7ed" };
  if (dSince > 45) return { label: "Regular", color: "#ca8a04", bg: "#fefce8" };
  return { label: "Em dia", color: "#16a34a", bg: "#f0fdf4" };
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

// Mapeia campos do Supabase (snake_case) para o formato do frontend
// Usado para manter compatibilidade com componentes que esperam camelCase
export const mapClientFromDB = (c) => ({
  ...c,
  // Aliases para compatibilidade
  dataNascimento: c.data_nascimento,
  estadoCivil: c.estado_civil,
  plInicial: c.pl_inicial,
  aporteMensal: c.aporte_mensal,
  metaPatrimonio: c.meta_patrimonio,
  liquidezDesejada: c.liquidez_desejada,
  taxaContratada: c.taxa_contratada,
  valorMinimoContrato: c.valor_minimo_contrato,
  receitaMensal: c.receita_mensal,
  formaPagamento: c.forma_pagamento,
  declaracaoIR: c.declaracao_ir,
  seguroVida: c.seguro_vida,
  valorSeguro: c.valor_seguro,
  seguroObservacao: c.seguro_observacao,
  clienteDesbalanceado: c.cliente_desbalanceado,
  inicioCarteira: c.inicio_carteira,
  ultimaReuniao: c.ultima_reuniao,
  proximaReuniao: c.proxima_reuniao,
  avisadoEm: c.avisado_em,
  ultimoRelatorio: c.ultimo_relatorio,
  envioIps: c.envio_ips,
  observacaoRapida: c.observacao_rapida,
  notasGerais: c.notas_gerais,
  linkRebalanceamento: c.link_rebalanceamento,
  periodicidadeReuniao: c.periodicidade_reuniao,
  periodicidadeRelatorio: c.periodicidade_relatorio,
  rendaBrutaTributavel: c.renda_bruta_tributavel,
  reservaEmergenciaValor: c.reserva_emergencia_valor,
  reservaEmergenciaMeta: c.reserva_emergencia_meta,
  reservaEmergenciaProduto: c.reserva_emergencia_produto,
  grupoNome: c.grupo_nome,
  grupoId: c.grupo_id,
  origemCliente: c.origem_cliente,
});

// Mapeia do frontend (camelCase) para o banco (snake_case)
export const mapClientToDB = (c) => {
  const db = { ...c };
  // Remove aliases camelCase (o banco usa snake_case)
  const camelKeys = [
    "dataNascimento", "estadoCivil", "plInicial", "aporteMensal", "metaPatrimonio",
    "liquidezDesejada", "taxaContratada", "valorMinimoContrato", "receitaMensal",
    "formaPagamento", "declaracaoIR", "seguroVida", "valorSeguro", "seguroObservacao",
    "clienteDesbalanceado", "inicioCarteira", "ultimaReuniao", "proximaReuniao",
    "avisadoEm", "ultimoRelatorio", "envioIps", "observacaoRapida", "notasGerais",
    "linkRebalanceamento", "periodicidadeReuniao", "periodicidadeRelatorio",
    "rendaBrutaTributavel", "reservaEmergenciaValor", "reservaEmergenciaMeta",
    "reservaEmergenciaProduto", "grupoNome", "grupoId", "origemCliente",
  ];
  camelKeys.forEach((k) => delete db[k]);

  // Garante que os campos snake_case existem
  db.data_nascimento = c.dataNascimento ?? c.data_nascimento ?? "";
  db.estado_civil = c.estadoCivil ?? c.estado_civil ?? "";
  db.pl_inicial = c.plInicial ?? c.pl_inicial ?? 0;
  db.aporte_mensal = c.aporteMensal ?? c.aporte_mensal ?? 0;
  db.meta_patrimonio = c.metaPatrimonio ?? c.meta_patrimonio ?? 0;
  db.liquidez_desejada = c.liquidezDesejada ?? c.liquidez_desejada ?? 0;
  db.taxa_contratada = c.taxaContratada ?? c.taxa_contratada ?? "";
  db.valor_minimo_contrato = c.valorMinimoContrato ?? c.valor_minimo_contrato ?? 0;
  db.receita_mensal = c.receitaMensal ?? c.receita_mensal ?? 0;
  db.forma_pagamento = c.formaPagamento ?? c.forma_pagamento ?? "XP";
  db.declaracao_ir = c.declaracaoIR ?? c.declaracao_ir ?? "Simplificada";
  db.seguro_vida = c.seguroVida ?? c.seguro_vida ?? false;
  db.valor_seguro = c.valorSeguro ?? c.valor_seguro ?? 0;
  db.seguro_observacao = c.seguroObservacao ?? c.seguro_observacao ?? "";
  db.cliente_desbalanceado = c.clienteDesbalanceado ?? c.cliente_desbalanceado ?? false;
  db.inicio_carteira = c.inicioCarteira ?? c.inicio_carteira ?? "";
  db.ultima_reuniao = c.ultimaReuniao ?? c.ultima_reuniao ?? "";
  db.proxima_reuniao = c.proximaReuniao ?? c.proxima_reuniao ?? "";
  db.avisado_em = c.avisadoEm ?? c.avisado_em ?? "";
  db.ultimo_relatorio = c.ultimoRelatorio ?? c.ultimo_relatorio ?? "";
  db.envio_ips = c.envioIps ?? c.envio_ips ?? false;
  db.observacao_rapida = c.observacaoRapida ?? c.observacao_rapida ?? "";
  db.notas_gerais = c.notasGerais ?? c.notas_gerais ?? "";
  db.link_rebalanceamento = c.linkRebalanceamento ?? c.link_rebalanceamento ?? "";
  db.periodicidade_reuniao = c.periodicidadeReuniao ?? c.periodicidade_reuniao ?? "Trimestral";
  db.periodicidade_relatorio = c.periodicidadeRelatorio ?? c.periodicidade_relatorio ?? "";
  db.renda_bruta_tributavel = c.rendaBrutaTributavel ?? c.renda_bruta_tributavel ?? 0;
  db.reserva_emergencia_valor = c.reservaEmergenciaValor ?? c.reserva_emergencia_valor ?? 0;
  db.reserva_emergencia_meta = c.reservaEmergenciaMeta ?? c.reserva_emergencia_meta ?? 0;
  db.reserva_emergencia_produto = c.reservaEmergenciaProduto ?? c.reserva_emergencia_produto ?? "";
  db.grupo_nome = c.grupoNome ?? c.grupo_nome ?? "";
  db.grupo_id = c.grupoId ?? c.grupo_id ?? "";
  db.origem_cliente = c.origemCliente ?? c.origem_cliente ?? "";

  return db;
};
