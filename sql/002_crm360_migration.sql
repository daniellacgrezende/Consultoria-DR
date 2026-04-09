-- =============================================
-- CRM 360 - Migration 002
-- Rode no SQL Editor do Supabase
-- =============================================

-- 1. LEADS - novos campos
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tipo_reuniao TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperatura TEXT DEFAULT 'morna';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsavel TEXT DEFAULT '';

-- 2. TODOS - vincular a cliente/lead
ALTER TABLE todos ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'tarefa';

-- 3. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'reuniao',
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  outlook_event_id TEXT DEFAULT '',
  location TEXT DEFAULT '',
  color TEXT DEFAULT '#2563eb',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on calendar_events" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_calendar_dates ON calendar_events(start_at, end_at);

-- 4. DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'outro',
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);

-- 5. ALLOCATION PROFILES (modelo da companhia)
CREATE TABLE IF NOT EXISTS allocation_profiles (
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
  ('agressivo', 'Agressivo', 10, 45, 15, 18, 12, '#9f1239')
ON CONFLICT (id) DO NOTHING;

-- 6. CLIENT ALLOCATION (carteira real do cliente)
CREATE TABLE IF NOT EXISTS client_allocation (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  renda_fixa NUMERIC DEFAULT 0,
  renda_variavel NUMERIC DEFAULT 0,
  multimercado NUMERIC DEFAULT 0,
  internacional NUMERIC DEFAULT 0,
  alternativos NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_allocation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on client_allocation" ON client_allocation FOR ALL USING (true) WITH CHECK (true);

-- 7. Supabase Storage bucket (rodar manualmente no Dashboard > Storage)
-- Criar bucket "documents" com public = false
