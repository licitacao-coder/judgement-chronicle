CREATE TABLE public.relatorio_numeracao (
  ano text PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.relatorio_numeracao TO authenticated;
GRANT ALL ON public.relatorio_numeracao TO service_role;

ALTER TABLE public.relatorio_numeracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY numeracao_select_auth ON public.relatorio_numeracao
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER touch_relatorio_numeracao
  BEFORE UPDATE ON public.relatorio_numeracao
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.proximo_numero_relatorio(_ano text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proximo integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  INSERT INTO public.relatorio_numeracao (ano, ultimo_numero)
  VALUES (_ano, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo_numero = public.relatorio_numeracao.ultimo_numero + 1
  RETURNING ultimo_numero INTO _proximo;

  RETURN _proximo;
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_numero_relatorio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_relatorio(text) TO authenticated, service_role;

INSERT INTO public.relatorio_numeracao (ano, ultimo_numero)
SELECT r.ano, COALESCE(MAX(NULLIF(regexp_replace(r.numero_relatorio, '\D', '', 'g'), ''))::integer, 0)
FROM public.relatorios r
WHERE r.ano IS NOT NULL AND r.numero_relatorio IS NOT NULL
GROUP BY r.ano
ON CONFLICT (ano) DO NOTHING;