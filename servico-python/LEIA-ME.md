# Serviço Python de leitura de documentos (motor alternativo)

Este serviço é independente do aplicativo. Ele recebe o documento (Termo de Julgamento,
Ata da Sessão ou equivalente), lê o conteúdo — inclusive PDFs digitalizados como imagem,
por meio de OCR em português — e devolve os itens **Aceito e Habilitado** já estruturados,
no mesmo formato usado pelo aplicativo.

O serviço apenas lê e organiza dados. Ele não conclui responsabilidade, dolo, má-fé,
penalidade ou sanção: o resultado é preliminar e destinado à conferência humana.

## Instalação com Docker (recomendado)

```bash
cd servico-python
docker build -t leitor-licitacao .
docker run -d --name leitor-licitacao -p 8000:8000 \
  -e CHAVE_SERVICO="sua-chave-secreta-longa" \
  leitor-licitacao
```

Teste:

```bash
curl -H "X-Chave-Servico: sua-chave-secreta-longa" http://localhost:8000/situacao
```

Resposta esperada: `{"servico":"leitor-licitacao","versao":"python-1.0.0","ocr":true}`

## Instalação sem Docker (Ubuntu/Debian)

```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-por poppler-utils python3-venv
cd servico-python
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
CHAVE_SERVICO="sua-chave-secreta-longa" uvicorn main:app --host 0.0.0.0 --port 8000
```

## Ligação com o aplicativo

1. Publique o serviço em um endereço acessível pela internet, com HTTPS
   (por exemplo `https://leitor.seuorgao.gov.br`).
2. No aplicativo, entre em **Configurações → Motores de análise**, informe esse endereço
   e salve.
3. Guarde a mesma chave (`CHAVE_SERVICO`) no aplicativo, no segredo `MOTOR_PYTHON_CHAVE`.
4. Clique em **Testar conexão**. Com a situação "ativo", o motor Python passa a ficar
   disponível na tela do Painel de Itens.

## Variáveis de ambiente

| Variável | Função |
| --- | --- |
| `CHAVE_SERVICO` | Chave exigida no cabeçalho `X-Chave-Servico`. Vazia = serviço aberto (não recomendado). |
| `TAMANHO_MAXIMO_MB` | Limite de tamanho do arquivo recebido (padrão 40). |

## Rotas

| Rota | Função |
| --- | --- |
| `GET /situacao` | Versão do serviço e se o OCR está instalado. |
| `POST /itens-aceitos` | Itens "Aceito e Habilitado" com licitante, CNPJ, valores, referência e evidência. |
| `POST /texto` | Texto integral do documento, para uso na análise do relatório de ocorrência. |

## Segurança

- Publique sempre atrás de HTTPS e restrinja o acesso à rede do órgão quando possível.
- A chave nunca é registrada em log; o conteúdo dos documentos não é gravado em disco.
- O aplicativo chama este serviço somente a partir do servidor, nunca do navegador.
