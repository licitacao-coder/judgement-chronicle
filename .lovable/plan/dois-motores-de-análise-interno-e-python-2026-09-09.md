# Dois motores de análise: interno e Python

Objetivo: manter tudo o que já funciona e acrescentar a possibilidade de enviar o mesmo documento
para um serviço Python próprio (do órgão), escolhendo qual motor usar em cada análise.
Nada é substituído: o motor atual continua o padrão.

## Como você vai usar

1. Nas telas de Documentos e do Painel de Itens aparece a escolha do motor:
   - **Motor interno (padrão)** — como é hoje, sem serviço extra.
   - **Motor Python (do órgão)** — envia o arquivo ao seu serviço e recebe os dados de volta.
2. A opção Python só aparece habilitada quando o endereço do serviço estiver configurado
   e respondendo; caso contrário fica visível com o aviso "serviço indisponível".
3. Cada análise guarda qual motor foi usado, data/hora e duração, e isso aparece na lista de
   análises, nos detalhes do item e nas exportações (Excel/CSV) — assim você compara a qualidade
   dos dois na prática.
4. Se o serviço Python falhar no meio da análise, o sistema avisa e oferece refazer no motor
   interno com um clique, sem perder o arquivo enviado.

## Configuração (tela Configurações, só administrador)

- Endereço do serviço Python e chave de acesso (guardada de forma protegida, nunca exibida).
- Botão "Testar conexão", que mostra versão e situação do serviço.
- Escolha do motor padrão do sistema: interno ou Python.
- Enquanto nada for configurado, o sistema funciona exatamente como hoje.

## O serviço Python (entregue como código pronto para o órgão hospedar)

Uma pasta `servico-python/` no projeto, independente do aplicativo, com:

- API FastAPI com três rotas: situação, extração do Termo de Julgamento (itens aceitos e
  habilitados) e leitura geral do documento para o relatório de ocorrência.
- Leitura com pdfplumber (texto e tabelas), OCR com pytesseract para PDFs digitalizados como
  imagem — o ponto que hoje não é coberto.
- Mesmo contrato de dados do motor interno: item, especificação, quantidade, unidade, melhor
  lance, valor negociado, origem do valor, valor de referência, percentual de diferença,
  licitante, CNPJ, situação original e trecho de evidência.
- Autenticação por chave, validação de entrada e limite de tamanho de arquivo.
- Dockerfile, `requirements.txt` e instruções de instalação em português, para rodar em servidor
  do órgão ou em qualquer provedor — sem dependência desta plataforma.

## Detalhes técnicos

- Camada de motores em `src/lib/motores/`: `motorInterno.ts` (extrai a lógica atual de
  `painel.functions.ts` e `pipeline.functions.ts`, sem alterar o comportamento) e
  `motorPython.ts` (chamada HTTP autenticada, tempo limite, validação Zod da resposta).
- Um seletor único (`selecionarMotor`) decide o motor por parâmetro da chamada, caindo para o
  interno quando o Python está inativo ou responde erro.
- Migration: colunas `motor`, `motor_versao`, `duracao_ms` em `painel_importacoes` e
  `documentos`; tabela `configuracao_motor` (endereço, motor padrão, situação) com RLS e GRANT;
  a chave do serviço fica em segredo do backend, fora do banco.
- Chamadas ao Python acontecem sempre no servidor (server functions), nunca no navegador.
- Rota interna de teste de conexão restrita a administrador.

## Custo e dependência

- Sem o serviço Python configurado: nada muda no custo atual.
- Com o serviço Python: a leitura e o OCR rodam no servidor do órgão; o consumo de inteligência
  artificial desta plataforma cai para as análises feitas por esse motor.
- O código Python é seu e roda em qualquer lugar, o que reduz a dependência desta plataforma sem
  perder o que já está pronto.

## Fora deste plano

- Hospedar o serviço Python (isso é feito por você/TI do órgão; entrego o código e o passo a passo).
- Geração de PDF, que segue como item pendente separado.
