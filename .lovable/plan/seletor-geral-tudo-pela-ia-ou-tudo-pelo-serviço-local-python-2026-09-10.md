# Seletor geral: tudo pela IA ou tudo pelo serviço local (Python)

Hoje o serviço local só lê o documento e monta o Painel de Itens. Todo o resto — resumo,
identificação de licitantes, ocorrências, linha do tempo, enquadramento preliminar e redação
dos textos — depende da IA. A mudança faz o serviço local cobrir também essas etapas e
concentra a escolha em **um único seletor geral**.

## Como você vai usar

1. No topo do aplicativo (ao lado do seu nome) passa a existir um seletor geral:
   **Usar IA** ou **Usar Local**. Ele vale para todas as telas e fica gravado.
2. Com **Usar Local** selecionado, tudo passa pelo serviço do órgão: leitura do arquivo,
   extração dos dados do certame, licitantes, ocorrências, linha do tempo, enquadramento
   preliminar e os textos de relato, providências e repercussão.
3. Com **Usar IA**, funciona exatamente como hoje.
4. **Usar Local** só habilita quando o endereço do serviço está cadastrado e respondendo.
   Se o serviço cair durante uma análise, aparece o aviso com a opção de refazer com IA.
5. Cada análise continua registrando qual motor foi usado, versão e duração.
6. Os seletores das telas de análise e de Itens aceitos passam a seguir o seletor geral
   (deixam de ser escolhas separadas).

## O que muda no serviço local (pasta `servico-python`)

Duas novas rotas, no mesmo formato de dados que a IA devolve hoje:

- `POST /analise` — devolve dados do certame (órgão, modalidade, número, ano, objeto, sessão,
  agente, UASG, plataforma), lista de licitantes com CNPJ e situação, ocorrências com tipo,
  resumo, manifestação, eventos em ordem cronológica com data/hora/autor/mensagem e trecho de
  origem, e sugestões de enquadramento (Lei 14.133/2021 e edital) marcadas como preliminares.
- `POST /redacao` — devolve relato, providências e repercussão a partir dos fatos e evidências,
  em linguagem formal, sem afirmar responsabilidade, dolo, má-fé, penalidade ou sanção.

A extração é por regras e expressões regulares sobre o texto (com OCR quando o PDF é imagem):
blocos de sessão, mensagens do chat com data/hora, situações de item, recursos, intenções,
diligências, desclassificações, inabilitações e desistências. Todo campo não localizado volta
vazio, para conferência humana — nada é inventado.

## Detalhes técnicos

- `configuracao_motor` ganha o motor geral já existente (`motor_padrao`) como fonte da verdade do
  seletor; a preferência do usuário fica em `perfis.motor_preferido` (migration: coluna nova
  com valor padrão `INTERNO`).
- Novo `src/lib/motores/analiseLocal.server.ts`: chama `/analise` e `/redacao`, valida a resposta
  com Zod e converte para os mesmos tipos `Extracao` já usados em `pipeline.functions.ts`.
- `analisarDocumento` e `redigirRelato` passam a aceitar `motor` e escolher entre `chamarIA` e o
  serviço local, gravando `motor`/`motor_versao`/`duracao_ms`.
- Novo `src/components/SeletorMotor.tsx` no `AppShell`, com estado compartilhado via TanStack Query;
  `painel.tsx`, `index.tsx` e `processos.$processoId.tsx` passam a ler esse estado em vez de terem
  seletor próprio.
- `servico-python/extracao.py` ganha os módulos de análise; `main.py` expõe as duas rotas com a
  mesma autenticação por chave. `LEIA-ME.md` e `INSTALAR-WINDOWS.md` atualizados.

## Limite honesto

O serviço local trabalha por regras, não por interpretação de linguagem. Em documentos com
redação fora do padrão, ele tende a localizar menos ocorrências e produzir textos mais secos que
a IA. A conferência humana continua obrigatória nos dois motores.
