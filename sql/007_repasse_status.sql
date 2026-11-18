-- Repasse de clientes para outra consultora ("Repasse para Poliana – pendente" / "Repassado para Poliana")
ALTER TABLE clients ADD COLUMN IF NOT EXISTS repasse_status TEXT DEFAULT '';
