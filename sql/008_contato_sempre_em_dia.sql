-- Contatos: contas que ficam sempre "em dia" (não cobram registro de interação)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contato_sempre_em_dia BOOLEAN DEFAULT false;
