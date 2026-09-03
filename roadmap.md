# Gerador de Relatório de Ocorrência em Sessão Pública

## Concluído
- Backend (banco, storage privado, autenticação e-mail + Google, papéis e RLS)
- Template Word oficial convertido em modelo com placeholders
- Identidade visual institucional (tipografia e paleta)
- Autenticação: /auth (login, cadastro com matrícula/cargo, Google)
- Upload com hash/detecção de duplicidade e leitura de PDF/DOCX/TXT
- Análise automática: processo, licitantes, ocorrências, linha do tempo, enquadramento preliminar
- Formulário de revisão em abas com evidências, checklist e pré-visualização
- Geração do Word oficial com versionamento e auditoria

## Pendente
- Geração opcional de PDF
- Telas administrativas (usuários e papéis)
- Resolver aviso do linter de segurança sobre execução de funções SECURITY DEFINER
- Teste ponta a ponta com os PDFs enviados (Pregão 9/2026, Grupo 1)
