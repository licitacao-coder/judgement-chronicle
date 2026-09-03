-- Papéis gerenciáveis por administradores
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Administradores podem editar qualquer perfil
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Configuração da estrutura do template Word
CREATE TABLE public.configuracao_template (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT 'Modelo oficial',
  ativo boolean NOT NULL DEFAULT true,
  secoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  usuario_atualizacao uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracao_template TO authenticated;
GRANT ALL ON public.configuracao_template TO service_role;

ALTER TABLE public.configuracao_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_template_select_auth ON public.configuracao_template
  FOR SELECT TO authenticated USING (true);

CREATE POLICY config_template_insert_admin ON public.configuracao_template
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY config_template_update_admin ON public.configuracao_template
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY config_template_delete_admin ON public.configuracao_template
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER touch_configuracao_template
  BEFORE UPDATE ON public.configuracao_template
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.configuracao_template (nome, ativo, secoes, campos, observacoes)
VALUES (
  'Modelo oficial',
  true,
  '[
    {"chave":"FINALIDADE","titulo":"Finalidade e natureza do registro","ordem":1,"obrigatoria":true,"texto_padrao":"Registro preliminar e informativo de fatos ocorridos em sessão pública."},
    {"chave":"IDENTIFICACAO","titulo":"Identificação do processo e do certame","ordem":2,"obrigatoria":true,"texto_padrao":""},
    {"chave":"LICITANTE","titulo":"Identificação do licitante","ordem":3,"obrigatoria":true,"texto_padrao":""},
    {"chave":"RELATO","titulo":"Relato cronológico dos fatos","ordem":4,"obrigatoria":true,"texto_padrao":""},
    {"chave":"PROVIDENCIAS","titulo":"Providências adotadas na sessão","ordem":5,"obrigatoria":false,"texto_padrao":""},
    {"chave":"REPERCUSSAO","titulo":"Repercussão no certame","ordem":6,"obrigatoria":false,"texto_padrao":""},
    {"chave":"ENQUADRAMENTO","titulo":"Enquadramento preliminar","ordem":7,"obrigatoria":true,"texto_padrao":"Indicação preliminar, sem juízo de responsabilidade ou sanção."},
    {"chave":"DOCUMENTOS","titulo":"Documentos comprobatórios","ordem":8,"obrigatoria":true,"texto_padrao":""},
    {"chave":"ENCAMINHAMENTO","titulo":"Encaminhamento","ordem":9,"obrigatoria":false,"texto_padrao":""},
    {"chave":"ASSINATURA","titulo":"Assinatura","ordem":10,"obrigatoria":true,"texto_padrao":""}
  ]'::jsonb,
  '[
    {"chave":"NUMERO_RELATORIO","rotulo":"Número do relatório","origem":"MANUAL","obrigatorio":true},
    {"chave":"ANO","rotulo":"Ano","origem":"MANUAL","obrigatorio":true},
    {"chave":"PROCESSO_SEI","rotulo":"Processo SEI","origem":"EXTRACAO","obrigatorio":true},
    {"chave":"MODALIDADE_CERTAME","rotulo":"Modalidade e número do certame","origem":"EXTRACAO","obrigatorio":true},
    {"chave":"OBJETO","rotulo":"Descrição do objeto","origem":"EXTRACAO","obrigatorio":true},
    {"chave":"LICITANTE","rotulo":"Razão social do licitante","origem":"EXTRACAO","obrigatorio":true},
    {"chave":"CNPJ","rotulo":"CNPJ/CPF do licitante","origem":"EXTRACAO","obrigatorio":true},
    {"chave":"RELATO","rotulo":"Relato dos fatos","origem":"IA_REVISADO","obrigatorio":true},
    {"chave":"PROVIDENCIAS","rotulo":"Providências","origem":"IA_REVISADO","obrigatorio":false},
    {"chave":"REPERCUSSAO","rotulo":"Repercussão","origem":"IA_REVISADO","obrigatorio":false},
    {"chave":"ENQUADRAMENTO","rotulo":"Enquadramento preliminar","origem":"IA_REVISADO","obrigatorio":true},
    {"chave":"DOCUMENTOS","rotulo":"Documentos comprobatórios","origem":"MANUAL","obrigatorio":true},
    {"chave":"DATA","rotulo":"Data do relatório","origem":"AUTOMATICO","obrigatorio":true},
    {"chave":"AGENTE","rotulo":"Agente de contratação","origem":"EXTRACAO","obrigatorio":false}
  ]'::jsonb,
  'Estrutura de referência para conferência da geração do documento Word oficial.'
);