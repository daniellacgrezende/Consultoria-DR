-- Distrato previsto: cliente sai dos alertas de reunião, relatório e contato
ALTER TABLE clients ADD COLUMN IF NOT EXISTS distrato_previsto DATE;
