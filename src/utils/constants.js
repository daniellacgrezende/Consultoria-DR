export const B = {
  brand: "#D30000", brandDark: "#9D0207",
  navy: "#1D3557", navy2: "#264773",
  black: "#0A0809", offwhite: "#FAFAF9",
  gray: "#5A585A", muted: "#9E9C9E",
  soft: "#FAFAF9", border: "rgba(10,8,9,0.06)",
  success: "#1AAF1A", warning: "#E89B00", danger: "#D30000", info: "#2A7DE1",
  shadow: "0 1px 3px rgba(10,8,9,0.03), 0 6px 20px rgba(10,8,9,0.05)",
  shadowHover: "0 2px 6px rgba(10,8,9,0.05), 0 10px 28px rgba(10,8,9,0.07)",
};

export const STATUS_MAP = {
  ativo: { label: "Ativo", bg: "#E5FBE5", color: "#1AAF1A" },
  inativo: { label: "Inativo", bg: "#f3f4f6", color: "#9E9C9E" },
};

export const PERFIL_MAP = {
  conservador: { label: "Conservador", color: "#2A7DE1" },
  moderado: { label: "Moderado", color: "#8200C2" },
  equilibrado: { label: "Equilibrado", color: "#1AAF1A" },
  arrojado: { label: "Arrojado", color: "#FF5400" },
  agressivo: { label: "Agressivo", color: "#D30000" },
};

export const CURVA_MAP = {
  A: { label: "Curva A", color: "#D30000", bg: "#FDE8E8" },
  B: { label: "Curva B", color: "#2A7DE1", bg: "#E8F0FE" },
  C: { label: "Curva C", color: "#8200C2", bg: "#F3E5FF" },
  D: { label: "Curva D", color: "#9E9C9E", bg: "#f3f4f6" },
};

export const LEAD_ETAPAS_MAIN = ["Lead", "Qualificação", "Reunião", "Diagnóstico/Proposta", "Fechamento", "Cliente"];
export const LEAD_ETAPAS_EXIT = ["Perdido", "Nutrição"];
export const LEAD_ETAPAS = [...LEAD_ETAPAS_MAIN, ...LEAD_ETAPAS_EXIT];

export const LEAD_ETAPA_COLORS = {
  "Lead":                { bg: "#f0f4ff", color: "#061841", border: "#d5ddf5" },
  "Qualificação":        { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "Reunião":             { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  "Diagnóstico/Proposta":{ bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  "Fechamento":          { bg: "#ecfdf5", color: "#0f766e", border: "#99f6e4" },
  "Cliente":             { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  "Perdido":             { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  "Nutrição":            { bg: "#fefce8", color: "#854d0e", border: "#fde047" },
};

export const LEAD_ORIGENS = [
  "Networking", "Indicação", "Grupo Primo - Portfel", "Grupo Primo - Faculdade HUB",
  "Grupo Primo - Thiago Nigro", "Grupo Primo - Bruno Perini", "Grupo Primo - Finclass",
  "Grupo Primo - Campanhas",
];

export const PERIOD_OPTIONS = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];

export const LEAD_TEMPERATURAS = [
  { v: "fria", l: "Fria", color: "#3b82f6" },
  { v: "morna", l: "Morna", color: "#f59e0b" },
  { v: "quente", l: "Quente", color: "#dc2626" },
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
  { id: "dashboard", label: "Dashboard", icon: "Home" },
  { id: "pipeline", label: "Pipeline", icon: "Target" },
  { id: "tasks", label: "Tarefas", icon: "CheckSquare" },
  { id: "calendar", label: "Calendário", icon: "Calendar" },
  { id: "meetings", label: "Reuniões", icon: "ClipboardList" },
  { id: "clients", label: "Clientes", icon: "Users" },
  { id: "allocation", label: "Alocação", icon: "PieChart" },
  { id: "repasse", label: "Repasse", icon: "DollarSign" },
  { id: "reports", label: "Relatórios", icon: "TrendingUp" },
  { id: "noticias", label: "Notícias", icon: "Newspaper" },
  { id: "seguro", label: "Seguro de Vida", icon: "Shield" },
  { id: "backup", label: "Back-Up", icon: "HardDrive" },
  { id: "settings", label: "Configurações", icon: "Settings" },
];

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
  nome: "", telefone: "", email: "", origem: "Indicação", suborigem: "", patrimonio_estimado: "",
  etapa: "Lead", data_primeira_reuniao: "", data_ultima_interacao: "", motivo_negativa: "",
  notas: "", convertido_em: "", tipo_reuniao: "", valor_estimado: "", temperatura: "morna",
  responsavel: "",
};
