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
- Tela Usuários: cadastro de servidores, perfis de acesso, situação ativo/inativo e matriz de permissões
- Tela Documentos: relação dos arquivos recebidos, situação de leitura e download seguro
- Contas reais criadas: administrador e analista, com navegação por perfil
- Numeração sequencial automática do número do relatório (por ano)
- Exclusão de processos analisados e documentos recebidos (somente administrador)
- Correções: permissão do analista para gerar o Word, data/horário da sessão preservados ao salvar, modalidade sem repetição do ano
- Painel de Configurações: estrutura do template Word (seções, campos, origem do dado e validação de placeholders)

## Concluído recentemente
- Tela de visualização do relatório gerado, com imprimir, baixar Word e registro da versão final oficial
- Modelo oficial substituído pelo novo documento (papel timbrado de Marabá, 7 seções, campos automáticos)

## Concluído recentemente
- Painel de Itens Aceitos e Habilitados: extração do Termo de Julgamento por item, prévia, filtros, resumos, histórico e exportação Excel/CSV

## Concluído recentemente
- Modo duplo de análise: motor interno (padrão) + serviço de leitura do órgão (Python/OCR) selecionável por documento, com registro do motor usado, aba de configuração para administrador, teste de conexão e opção de refazer no motor interno

## Pendente
- Geração opcional de PDF
- Teste ponta a ponta com os PDFs enviados (Pregão 9/2026, Grupo 1)
- Instalação do serviço de leitura do órgão (pasta servico-python) pela equipe de TI
