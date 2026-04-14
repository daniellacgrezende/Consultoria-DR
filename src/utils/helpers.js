export const huid = () => `h-${Math.random().toString(36).slice(2, 9)}`;
export const cuid = () => `c-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
export const slugify = (nome) => (nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const addDays = (dateStr, days) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
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
  const m = { mensal: 30, bimestral: 60, trimestral: 90, quadrimestral: 120, semestral: 180, anual: 365 };
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
  liquidezAtual: c.liquidez_atual,
  liquidezProdutos: c.liquidez_produtos,
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
  proximoRelatorio: c.proximo_relatorio,
  indicadoPor: c.indicado_por,
});

// Colunas válidas da tabela clients no Supabase
const CLIENT_DB_COLS = new Set([
  "id", "nome", "data_nascimento", "cidade", "uf", "estado_civil", "filhos", "conjuge",
  "profissao", "hobbies", "status", "perfil", "pl_inicial", "aporte_mensal", "meta_patrimonio",
  "liquidez_desejada", "liquidez_atual", "liquidez_produtos", "taxa_contratada", "valor_minimo_contrato", "receita_mensal",
  "forma_pagamento", "declaracao_ir", "planejamento", "seguro_vida", "valor_seguro",
  "seguro_observacao", "sucessao", "cliente_desbalanceado", "inicio_carteira", "ultima_reuniao",
  "proxima_reuniao", "avisado_em", "ultimo_relatorio", "envio_ips", "observacoes",
  "observacao_rapida", "notas_gerais", "link_rebalanceamento", "periodicidade_reuniao",
  "periodicidade_relatorio", "pgbl", "vgbl", "renda_bruta_tributavel", "reserva_emergencia_valor",
  "reserva_emergencia_meta", "reserva_emergencia_produto", "grupo_id", "grupo_nome",
  "corretoras", "origem_cliente", "proximo_relatorio", "indicado_por",
]);

// Converte valor para número, retornando 0 se vazio/inválido
const toNum = (v) => { const n = Number(v); return (v === "" || v == null || isNaN(n)) ? 0 : n; };

// Mapeia do frontend (camelCase) para o banco (snake_case)
export const mapClientToDB = (c) => {
  // Garante que os campos snake_case existem
  // snake_case tem prioridade (formulário de edição usa snake_case)
  const db = {
    id: c.id,
    nome: c.nome ?? "",
    data_nascimento: c.data_nascimento ?? c.dataNascimento ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    estado_civil: c.estado_civil ?? c.estadoCivil ?? "",
    filhos: c.filhos ?? "",
    conjuge: c.conjuge ?? "",
    profissao: c.profissao ?? "",
    hobbies: c.hobbies ?? "",
    status: c.status ?? "ativo",
    perfil: c.perfil ?? "moderado",
    pl_inicial: toNum(c.pl_inicial ?? c.plInicial),
    aporte_mensal: toNum(c.aporte_mensal ?? c.aporteMensal),
    meta_patrimonio: toNum(c.meta_patrimonio ?? c.metaPatrimonio),
    liquidez_desejada: toNum(c.liquidez_desejada ?? c.liquidezDesejada),
    liquidez_atual: toNum(c.liquidez_atual ?? c.liquidezAtual),
    liquidez_produtos: c.liquidez_produtos ?? c.liquidezProdutos ?? "",
    taxa_contratada: c.taxa_contratada ?? c.taxaContratada ?? "",
    valor_minimo_contrato: toNum(c.valor_minimo_contrato ?? c.valorMinimoContrato),
    receita_mensal: toNum(c.receita_mensal ?? c.receitaMensal),
    forma_pagamento: c.forma_pagamento ?? c.formaPagamento ?? "XP",
    declaracao_ir: c.declaracao_ir ?? c.declaracaoIR ?? "Simplificada",
    planejamento: c.planejamento ?? "",
    seguro_vida: c.seguro_vida ?? c.seguroVida ?? false,
    valor_seguro: toNum(c.valor_seguro ?? c.valorSeguro),
    seguro_observacao: c.seguro_observacao ?? c.seguroObservacao ?? "",
    sucessao: c.sucessao ?? false,
    cliente_desbalanceado: c.cliente_desbalanceado ?? c.clienteDesbalanceado ?? false,
    inicio_carteira: c.inicio_carteira ?? c.inicioCarteira ?? "",
    ultima_reuniao: c.ultima_reuniao ?? c.ultimaReuniao ?? "",
    proxima_reuniao: c.proxima_reuniao ?? c.proximaReuniao ?? "",
    avisado_em: c.avisado_em ?? c.avisadoEm ?? "",
    ultimo_relatorio: c.ultimo_relatorio ?? c.ultimoRelatorio ?? "",
    envio_ips: c.envio_ips ?? c.envioIps ?? false,
    observacoes: c.observacoes ?? "",
    observacao_rapida: c.observacao_rapida ?? c.observacaoRapida ?? "",
    notas_gerais: c.notas_gerais ?? c.notasGerais ?? "",
    link_rebalanceamento: c.link_rebalanceamento ?? c.linkRebalanceamento ?? "",
    periodicidade_reuniao: c.periodicidade_reuniao ?? c.periodicidadeReuniao ?? "Trimestral",
    periodicidade_relatorio: c.periodicidade_relatorio ?? c.periodicidadeRelatorio ?? "",
    pgbl: c.pgbl ?? false,
    vgbl: c.vgbl ?? false,
    renda_bruta_tributavel: toNum(c.renda_bruta_tributavel ?? c.rendaBrutaTributavel),
    reserva_emergencia_valor: toNum(c.reserva_emergencia_valor ?? c.reservaEmergenciaValor),
    reserva_emergencia_meta: toNum(c.reserva_emergencia_meta ?? c.reservaEmergenciaMeta),
    reserva_emergencia_produto: c.reserva_emergencia_produto ?? c.reservaEmergenciaProduto ?? "",
    grupo_nome: c.grupo_nome ?? c.grupoNome ?? "",
    grupo_id: c.grupo_id ?? c.grupoId ?? "",
    corretoras: c.corretoras ?? "",
    origem_cliente: c.origem_cliente ?? c.origemCliente ?? "",
    proximo_relatorio: c.proximo_relatorio ?? c.proximoRelatorio ?? "",
    indicado_por: c.indicado_por ?? c.indicadoPor ?? "",
  };

  return db;
};

// Colunas válidas da tabela leads no Supabase
const LEAD_DB_COLS = new Set([
  "id", "nome", "telefone", "email", "origem", "suborigem", "patrimonio_estimado",
  "etapa", "data_primeira_reuniao", "data_ultima_interacao", "motivo_negativa",
  "notas", "convertido_em", "tipo_reuniao", "valor_estimado", "temperatura", "responsavel",
]);

// Campos numéricos da tabela leads
const LEAD_NUMERIC_COLS = new Set(["patrimonio_estimado", "valor_estimado"]);

// Mapeia lead para o banco (remove campos desconhecidos)
export const mapLeadToDB = (l) => {
  const db = {};
  for (const [k, v] of Object.entries(l)) {
    if (LEAD_DB_COLS.has(k)) db[k] = LEAD_NUMERIC_COLS.has(k) ? toNum(v) : v;
  }
  return db;
};
