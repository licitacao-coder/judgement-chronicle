ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS motor text NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS motor_versao text,
  ADD COLUMN IF NOT EXISTS duracao_ms integer;

ALTER TABLE public.painel_importacoes
  ADD COLUMN IF NOT EXISTS motor text NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS motor_versao text,
  ADD COLUMN IF NOT EXISTS duracao_ms integer;

CREATE TABLE IF NOT EXISTS public.configuracao_motor (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endereco_servico text,
  motor_padrao text NOT NULL DEFAULT 'INTERNO',
  situacao text NOT NULL DEFAULT 'NAO_VERIFICADO',
  versao_servico text,
  ultima_verificacao timestamp with time zone,
  mensagem_verificacao text,
  observacoes text,
  usuario_atualizacao uuid REFERENCES auth.users,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracao_motor TO authenticated;
GRANT INSERT, UPDATE ON public.configuracao_motor TO authenticated;
GRANT ALL ON public.configuracao_motor TO service_role;

ALTER TABLE public.configuracao_motor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver a configuracao do motor"
  ON public.configuracao_motor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Administradores podem criar a configuracao do motor"
  ON public.configuracao_motor FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Administradores podem alterar a configuracao do motor"
  ON public.configuracao_motor FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER configuracao_motor_updated_at
  BEFORE UPDATE ON public.configuracao_motor
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.configuracao_motor (motor_padrao)
SELECT 'INTERNO'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracao_motor);