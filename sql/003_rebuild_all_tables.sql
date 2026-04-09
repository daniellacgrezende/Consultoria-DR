-- =============================================
-- CRM 360 - REBUILD COMPLETO
-- ATENÇÃO: Apaga e recria TODAS as tabelas
-- Rode no SQL Editor do Supabase
-- =============================================

-- Drop tudo (ordem inversa por causa das foreign keys)
DROP TABLE IF EXISTS rel_envios CASCADE;
DROP TABLE IF EXISTS client_allocation CASCADE;
DROP TABLE IF EXISTS allocation_profiles CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS reunioes_hist CASCADE;
DROP TABLE IF EXISTS aportes CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS radar CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS repasse CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- ═══════════════════════════════════════
-- 1. CLIENTES
-- ═══════════════════════════════════════
CREATE TABLE clients (
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 2. HISTÓRICO DE PL
-- ═══════════════════════════════════════
CREATE TABLE history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  patrimonio NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 3. REPASSE
-- ═══════════════════════════════════════
CREATE TABLE repasse (
  id TEXT PRIMARY KEY,
  competencia TEXT NOT NULL,
  receita_bruta NUMERIC DEFAULT 0,
  impostos NUMERIC DEFAULT 0,
  receita_liquida NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 4. APORTES E RESGATES
-- ═══════════════════════════════════════
CREATE TABLE aportes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT DEFAULT '',
  is_reserva BOOLEAN DEFAULT FALSE,
  is_pgbl BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 5. HISTÓRICO DE REUNIÕES
-- ═══════════════════════════════════════
CREATE TABLE reunioes_hist (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 6. TAREFAS (TO-DO)
-- ═══════════════════════════════════════
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  done_at TEXT,
  data TEXT DEFAULT '',
  vencimento TEXT DEFAULT '',
  ordem INTEGER DEFAULT 0,
  prioridade TEXT DEFAULT 'normal',
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  lead_id TEXT,
  tipo TEXT DEFAULT 'tarefa',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 7. LEADS (PIPELINE)
-- ═══════════════════════════════════════
CREATE TABLE leads (
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
  tipo_reuniao TEXT DEFAULT '',
  valor_estimado NUMERIC DEFAULT 0,
  temperatura TEXT DEFAULT 'morna',
  responsavel TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 8. RADAR (PROSPECÇÃO)
-- ═══════════════════════════════════════
CREATE TABLE radar (
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

-- ═══════════════════════════════════════
-- 9. CONTROLE DE RELATÓRIOS
-- ═══════════════════════════════════════
CREATE TABLE rel_envios (
  client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  mes_envio TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 10. EVENTOS DE CALENDÁRIO
-- ═══════════════════════════════════════
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'reuniao',
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  lead_id TEXT,
  outlook_event_id TEXT DEFAULT '',
  location TEXT DEFAULT '',
  color TEXT DEFAULT '#2563eb',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 11. DOCUMENTOS
-- ═══════════════════════════════════════
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'outro',
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- 12. PERFIS DE ALOCAÇÃO (MODELO)
-- ═══════════════════════════════════════
CREATE TABLE allocation_profiles (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  renda_fixa NUMERIC DEFAULT 0,
  renda_variavel NUMERIC DEFAULT 0,
  multimercado NUMERIC DEFAULT 0,
  internacional NUMERIC DEFAULT 0,
  alternativos NUMERIC DEFAULT 0,
  color TEXT DEFAULT '#2563eb'
);

INSERT INTO allocation_profiles (id, nome, renda_fixa, renda_variavel, multimercado, internacional, alternativos, color) VALUES
  ('conservador', 'Conservador', 80, 5, 10, 3, 2, '#2563eb'),
  ('moderado', 'Moderado', 55, 15, 15, 10, 5, '#7c3aed'),
  ('equilibrado', 'Equilibrado', 35, 25, 20, 12, 8, '#0891b2'),
  ('arrojado', 'Arrojado', 20, 35, 20, 15, 10, '#dc2626'),
  ('agressivo', 'Agressivo', 10, 45, 15, 18, 12, '#9f1239');

-- ═══════════════════════════════════════
-- 13. ALOCAÇÃO DO CLIENTE (CARTEIRA REAL)
-- ═══════════════════════════════════════
CREATE TABLE client_allocation (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  renda_fixa NUMERIC DEFAULT 0,
  renda_variavel NUMERIC DEFAULT 0,
  multimercado NUMERIC DEFAULT 0,
  internacional NUMERIC DEFAULT 0,
  alternativos NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_history_client ON history(client_id);
CREATE INDEX idx_aportes_client ON aportes(client_id);
CREATE INDEX idx_reunioes_client ON reunioes_hist(client_id);
CREATE INDEX idx_leads_etapa ON leads(etapa);
CREATE INDEX idx_repasse_competencia ON repasse(competencia);
CREATE INDEX idx_calendar_dates ON calendar_events(start_at, end_at);
CREATE INDEX idx_documents_client ON documents(client_id);

-- ═══════════════════════════════════════
-- RLS + POLICIES
-- ═══════════════════════════════════════
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repasse ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunioes_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar ENABLE ROW LEVEL SECURITY;
ALTER TABLE rel_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_allocation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON repasse FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON aportes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reunioes_hist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON todos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON radar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON rel_envios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON client_allocation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON allocation_profiles FOR ALL USING (true) WITH CHECK (true);
