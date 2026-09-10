# Instalar o serviço de leitura no Windows e deixá-lo acessível

O serviço roda no seu computador (ou num servidor do órgão) e o aplicativo o consulta
pela internet. Ele apenas lê documentos e devolve os dados encontrados; nunca conclui
responsabilidade, dolo, má-fé, penalidade ou sanção.

## 1. Programas necessários (uma única vez)

Abra o **PowerShell como administrador** e execute:

```powershell
winget install -e --id Python.Python.3.13
winget install -e --id UB-Mannheim.TesseractOCR
winget install -e --id oschwartz10612.Poppler
winget install -e --id Cloudflare.cloudflared
```

> Funciona com Python 3.12, 3.13 ou 3.14. Se você já tem um deles instalado,
> não precisa instalar outro.

Feche e abra o PowerShell novamente para os programas entrarem no caminho do sistema.

- Python: executa o serviço.
- Tesseract e Poppler: leitura de documentos digitalizados como imagem (OCR), em português.
- cloudflared: cria o endereço seguro (https) para o aplicativo alcançar o serviço.

## 2. Baixar a pasta do serviço

Baixe o projeto (botão de download do código no Lovable ou o repositório do GitHub) e
copie a pasta `servico-python` para um local fixo, por exemplo `C:\leitura-documentos`.

> **Se a instalação já falhou antes** com mensagens sobre `pydantic-core` e `Pillow`,
> apague o ambiente antigo e refaça — as bibliotecas foram atualizadas e agora têm
> versão pronta para o Python 3.12, 3.13 e 3.14:
>
> ```powershell
> Remove-Item -Recurse -Force .\.venv, .\ambiente -ErrorAction SilentlyContinue
> python -m venv .venv
> .\.venv\Scripts\Activate.ps1
> python -m pip install --upgrade pip
> python -m pip install -r requirements.txt
> python -m uvicorn main:app --host 127.0.0.1 --port 8000
> ```

## 3. Definir a chave de acesso e iniciar

No PowerShell, dentro da pasta:

```powershell
cd C:\leitura-documentos
$env:CHAVE_SERVICO = "escolha-uma-chave-longa-e-secreta"
powershell -ExecutionPolicy Bypass -File .\instalar-windows.ps1
```

Na primeira vez a instalação leva alguns minutos. Ao final aparece
`Uvicorn running on http://127.0.0.1:8000`. **Deixe essa janela aberta** enquanto usar.

Teste no navegador: `http://127.0.0.1:8000/situacao` deve responder com a versão do
serviço e se o OCR está disponível.

## 4. Criar o endereço acessível pela internet

Abra uma **segunda** janela do PowerShell e execute:

```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

Ele exibirá um endereço parecido com:

```
https://algum-nome-aleatorio.trycloudflare.com
```

Esse é o endereço do serviço. Mantenha esta janela aberta também. O endereço muda
sempre que o comando é reiniciado; para um endereço fixo, a equipe de TI pode criar um
túnel nomeado no Cloudflare ou publicar o serviço num servidor do órgão.

## 5. Informar o endereço no aplicativo

1. Entre no aplicativo com o perfil administrador.
2. Vá em **Configurações → Motores de análise**.
3. Cole o endereço (`https://...trycloudflare.com`) em “Endereço do serviço do órgão”.
4. Clique em **Salvar motores** e depois em **Testar conexão** — a situação deve ficar
   **Ativo**.
5. Se quiser que ele seja usado sem escolher a cada vez, mude “Motor usado por padrão”
   para **Serviço do órgão**.

Se você definiu `CHAVE_SERVICO` no passo 3, a mesma chave precisa ser guardada no
aplicativo. Peça isso no chat e ela é cadastrada com segurança (nome
`MOTOR_PYTHON_CHAVE`).

## 6. Uso no dia a dia

No **Painel de Itens**, escolha em “Motor de leitura” a opção do serviço do órgão e
clique em **Extrair itens**. Se o serviço estiver desligado, o aplicativo avisa e
oferece o botão “Refazer no motor interno”.

Para deixar o serviço sempre ligado, sem janelas abertas, a equipe de TI pode
registrá-lo como serviço do Windows (NSSM) ou instalá-lo num servidor Linux usando o
`Dockerfile` desta pasta.
