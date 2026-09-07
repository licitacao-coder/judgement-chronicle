ALTER TABLE public.painel_itens
  ADD COLUMN IF NOT EXISTS valor_negociado_unitario numeric,
  ADD COLUMN IF NOT EXISTS valor_negociado_total numeric,
  ADD COLUMN IF NOT EXISTS origem_valor text,
  ADD COLUMN IF NOT EXISTS valor_referencia_unitario numeric,
  ADD COLUMN IF NOT EXISTS valor_referencia_total numeric,
  ADD COLUMN IF NOT EXISTS percentual_diferenca numeric;