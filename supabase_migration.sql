-- =============================================
-- PORTFEL CRM - Migração Supabase
-- Cole este SQL no SQL Editor do Supabase
-- =============================================

-- 1. CLIENTES
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  data_nascimento TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  uf TEXT DEFAULT '',
  estado_civil TEXT DEFAULT '',
  filhos TEXT DEFAULT '',
  conjuge TEXT DEFAULT '',
  profissao TEXT DEFAULT '',
  hobbies TEXT DEFAULT '',
  status TEXT DEFAULT 'ativo',
  perfil TEXT DEFAULT 'moderado',
  pl_inicial NUMERIC DEFAULT 0,
  aporte_mensal NUMERIC DEFAULT 0,
  meta_patrimonio NUMERIC DEFAULT 0,
  liquidez_desejada NUMERIC DEFAULT 0,
  taxa_contratada TEXT DEFAULT '',
  valor_minimo_contrato NUMERIC DEFAULT 0,
  receita_mensal NUMERIC DEFAULT 0,
  forma_pagamento TEXT DEFAULT 'XP',
  declaracao_ir TEXT DEFAULT 'Simplificada',
  planejamento TEXT DEFAULT '',
  seguro_vida BOOLEAN DEFAULT FALSE,
  valor_seguro NUMERIC DEFAULT 0,
  seguro_observacao TEXT DEFAULT '',
  sucessao BOOLEAN DEFAULT FALSE,
  cliente_desbalanceado BOOLEAN DEFAULT FALSE,
  inicio_carteira TEXT DEFAULT '',
  ultima_reuniao TEXT DEFAULT '',
  proxima_reuniao TEXT DEFAULT '',
  avisado_em TEXT DEFAULT '',
  ultimo_relatorio TEXT DEFAULT '',
  envio_ips BOOLEAN DEFAULT FALSE,
  observacoes TEXT DEFAULT '',
  observacao_rapida TEXT DEFAULT '',
  notas_gerais TEXT DEFAULT '',
  link_rebalanceamento TEXT DEFAULT '',
  periodicidade_reuniao TEXT DEFAULT 'Trimestral',
  periodicidade_relatorio TEXT DEFAULT '',
  pgbl BOOLEAN DEFAULT FALSE,
  vgbl BOOLEAN DEFAULT FALSE,
  renda_bruta_tributavel NUMERIC DEFAULT 0,
  reserva_emergencia_valor NUMERIC DEFAULT 0,
  reserva_emergencia_meta NUMERIC DEFAULT 0,
  reserva_emergencia_produto TEXT DEFAULT '',
  grupo_id TEXT DEFAULT '',
  grupo_nome TEXT DEFAULT '',
  corretoras TEXT DEFAULT '',
  origem_cliente TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. HISTÓRICO DE PL
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  patrimonio NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. REPASSE
CREATE TABLE IF NOT EXISTS repasse (
  id TEXT PRIMARY KEY,
  competencia TEXT NOT NULL UNIQUE,
  receita_bruta NUMERIC DEFAULT 0,
  impostos NUMERIC DEFAULT 0,
  receita_liquida NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. APORTES E RESGATES
CREATE TABLE IF NOT EXISTS aportes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('aporte', 'resgate')),
  valor NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT DEFAULT '',
  is_reserva BOOLEAN DEFAULT FALSE,
  is_pgbl BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. HISTÓRICO DE REUNIÕES
CREATE TABLE IF NOT EXISTS reunioes_hist (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TO-DO LIST
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  done_at TEXT,
  data TEXT DEFAULT '',
  vencimento TEXT DEFAULT '',
  ordem INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. LEADS
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  origem TEXT DEFAULT 'Indicação',
  suborigem TEXT DEFAULT '',
  patrimonio_estimado NUMERIC DEFAULT 0,
  etapa TEXT DEFAULT '1ª Reunião',
  data_primeira_reuniao TEXT DEFAULT '',
  data_ultima_interacao TEXT DEFAULT '',
  motivo_negativa TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  convertido_em TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. RADAR (PROSPECÇÃO)
CREATE TABLE IF NOT EXISTS radar (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  origem TEXT DEFAULT '',
  patrimonio_estimado NUMERIC DEFAULT 0,
  prioridade TEXT DEFAULT 'Média',
  observacoes TEXT DEFAULT '',
  data_mapeamento TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CONTROLE DE ENVIO DE RELATÓRIOS
CREATE TABLE IF NOT EXISTS rel_envios (
  client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  mes_envio TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ÍNDICES para performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_history_client ON history(client_id);
CREATE INDEX IF NOT EXISTS idx_aportes_client ON aportes(client_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_client ON reunioes_hist(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);
CREATE INDEX IF NOT EXISTS idx_repasse_competencia ON repasse(competencia);

-- =============================================
-- RLS (Row Level Security) - desabilitado por padrão
-- Habilite quando implementar autenticação
-- =============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repasse ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunioes_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar ENABLE ROW LEVEL SECURITY;
ALTER TABLE rel_envios ENABLE ROW LEVEL SECURITY;

-- Policies: permitir tudo por enquanto (ajuste quando tiver auth)
CREATE POLICY "Allow all on clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on history" ON history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on repasse" ON repasse FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on aportes" ON aportes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reunioes_hist" ON reunioes_hist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on todos" ON todos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on radar" ON radar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on rel_envios" ON rel_envios FOR ALL USING (true) WITH CHECK (true);
