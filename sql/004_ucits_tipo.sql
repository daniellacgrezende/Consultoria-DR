-- Adiciona campo tipo à tabela intl_portfolios para distinguir ETFs (EUA) de UCITS
ALTER TABLE intl_portfolios ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'etf';

-- Garante que registros existentes fiquem com tipo 'etf'
UPDATE intl_portfolios SET tipo = 'etf' WHERE tipo IS NULL;
