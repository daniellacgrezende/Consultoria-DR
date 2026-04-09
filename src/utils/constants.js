export const B = { navy: "#061841", navy2: "#061e49", gray: "#6e6e6e", soft: "#f0f4ff", border: "#d5ddf5" };

export const STATUS_MAP = {
  ativo: { label: "Ativo", bg: "#dcfce7", color: "#16a34a" },
  inativo: { label: "Inativo", bg: "#f3f4f6", color: "#6b7280" },
};

export const PERFIL_MAP = {
  conservador: { label: "Conservador", color: "#2563eb" },
  moderado: { label: "Moderado", color: "#7c3aed" },
  equilibrado: { label: "Equilibrado", color: "#0891b2" },
  arrojado: { label: "Arrojado", color: "#dc2626" },
  agressivo: { label: "Agressivo", color: "#9f1239" },
};

export const CURVA_MAP = {
  A: { label: "Curva A", color: "#b45309", bg: "#fef3c7" },
  B: { label: "Curva B", color: "#1d4ed8", bg: "#dbeafe" },
  C: { label: "Curva C", color: "#6d28d9", bg: "#ede9fe" },
  D: { label: "Curva D", color: "#4b5563", bg: "#f3f4f6" },
};

export const LEAD_ETAPAS = ["Prospect", "1ª Reunião", "2ª Reunião", "Follow Up", "Convertido", "Perdido"];

export const LEAD_ETAPA_COLORS = {
  "Prospect": { bg: "#f0f4ff", color: "#061841", border: "#d5ddf5" },
  "1ª Reunião": { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "2ª Reunião": { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  "Follow Up": { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  "Convertido": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "Perdido": { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

export const LEAD_ORIGENS = [
  "Networking", "Indicação", "Grupo Primo - Portfel", "Grupo Primo - Faculdade HUB",
  "Grupo Primo - Thiago Nigro", "Grupo Primo - Bruno Perini", "Grupo Primo - Finclass",
  "Grupo Primo - Campanhas",
];

export const PERIOD_OPTIONS = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];

export const LEAD_TEMPERATURAS = [
  { v: "fria", l: "🥶 Fria", color: "#3b82f6" },
  { v: "morna", l: "🌤 Morna", color: "#f59e0b" },
  { v: "quente", l: "🔥 Quente", color: "#dc2626" },
];

export const TIPO_REUNIAO = [
  { v: "presencial", l: "Presencial" },
  { v: "online", l: "Online" },
  { v: "telefone", l: "Telefone" },
];

export const DOCUMENT_TYPES = [
  { v: "contrato", l: "Contrato" },
  { v: "declaracao_ir", l: "Declaração IR" },
  { v: "comprovante", l: "Comprovante" },
  { v: "ips", l: "IPS" },
  { v: "relatorio", l: "Relatório" },
  { v: "outro", l: "Outro" },
];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "🏠", group: null },
  { id: "pipeline", label: "Pipeline", icon: "🎯", group: "vendas" },
  { id: "calendar", label: "Calendário", icon: "📅", group: "vendas" },
  { id: "tasks", label: "Tarefas", icon: "✅", group: "vendas" },
  { id: "clients", label: "Clientes", icon: "👥", group: "clientes" },
  { id: "meetings", label: "Reuniões", icon: "📋", group: "clientes" },
  { id: "allocation", label: "Alocação", icon: "📊", group: "clientes" },
  { id: "reports", label: "Relatórios", icon: "📈", group: "relatorios" },
  { id: "backup", label: "Back-Up", icon: "💾", group: "config" },
  { id: "settings", label: "Configurações", icon: "⚙️", group: "config" },
];

export const NAV_GROUPS = {
  vendas: "MEU PAINEL",
  clientes: "CLIENTES",
  relatorios: "RELATÓRIOS",
  config: "CONFIGURAÇÕES",
};

export const EMPTY_CLIENT = {
  nome: "", dataNascimento: "", cidade: "", uf: "", estadoCivil: "", filhos: "", conjuge: "",
  profissao: "", hobbies: "", status: "ativo", perfil: "moderado", plInicial: "", aporteMensal: "",
  metaPatrimonio: "", liquidezDesejada: "", taxaContratada: "", valorMinimoContrato: "",
  receitaMensal: "", formaPagamento: "XP", declaracaoIR: "Simplificada", planejamento: "",
  seguroVida: false, valorSeguro: "", seguroObservacao: "", sucessao: false,
  clienteDesbalanceado: false, inicioCarteira: "", ultimaReuniao: "", proximaReuniao: "",
  avisadoEm: "", ultimoRelatorio: "", envioIps: false, observacoes: "", grupoId: "", grupoNome: "",
  corretoras: "", origemCliente: "", observacaoRapida: "", linkRebalanceamento: "", notasGerais: "",
  periodicidadeReuniao: "Trimestral", periodicidadeRelatorio: "", pgbl: false, vgbl: false,
  rendaBrutaTributavel: "", reservaEmergenciaValor: "", reservaEmergenciaMeta: "",
  reservaEmergenciaProduto: "",
};

export const EMPTY_LEAD = {
  nome: "", telefone: "", email: "", origem: "Indicação", suborigem: "", patrimonioEstimado: "",
  etapa: "Prospect", dataPrimeiraReuniao: "", dataUltimaInteracao: "", motivoNegativa: "",
  notas: "", convertidoEm: "", tipoReuniao: "", valorEstimado: "", temperatura: "morna",
  responsavel: "",
};
