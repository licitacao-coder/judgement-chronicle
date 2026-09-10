CREATE TABLE public.configuracao_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text,
  modelo text,
  usuario_atualizacao uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracao_ia TO authenticated;
GRANT ALL ON public.configuracao_ia TO service_role;

ALTER TABLE public.configuracao_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores gerenciam a configuracao da IA"
ON public.configuracao_ia FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));