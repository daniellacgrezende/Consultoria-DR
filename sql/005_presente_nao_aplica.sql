-- Presentes: marca clientes para quem não se aplica enviar presente (ex.: grupo familiar)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS presente_nao_aplica BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS presente_motivo TEXT DEFAULT '';
