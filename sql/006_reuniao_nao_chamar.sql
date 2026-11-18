-- Reuniões: marca clientes que não precisam ser chamados (saem dos alertas de agendar/atrasado)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reuniao_nao_chamar BOOLEAN DEFAULT false;
