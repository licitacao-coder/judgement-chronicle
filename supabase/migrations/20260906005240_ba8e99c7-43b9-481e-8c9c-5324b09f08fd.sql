CREATE TABLE public.painel_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  nome_documento text,
  identificacao_processo text,
  versao integer NOT NULL DEFAULT 1,
  total_itens integer NOT NULL DEFAULT 0,
  valor_total numeric,
  atual boolean NOT NULL DEFAULT true,
  usuario uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.painel_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.painel_importacoes(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  numero_item integer,
  especificacao text,
  quantidade numeric,
  unidade text,
  valor_unitario numeric,
  valor_total numeric,
  licitante text,
  cnpj text,
  situacao text,
  pagina integer,
  status_conferencia text NOT NULL DEFAULT 'NECESSITA_CONFERENCIA',
  validacao_total text,
  diferenca numeric,
  trecho_origem text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX painel_itens_importacao_idx ON public.painel_itens (importacao_id);
CREATE INDEX painel_itens_processo_idx ON public.painel_itens (processo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.painel_importacoes TO authenticated;
GRANT ALL ON public.painel_importacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.painel_itens TO authenticated;
GRANT ALL ON public.painel_itens TO service_role;

ALTER TABLE public.painel_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.painel_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY painel_importacoes_all_auth ON public.painel_importacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY painel_itens_all_auth ON public.painel_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);