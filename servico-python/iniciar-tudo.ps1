# Liga tudo de uma vez: leitor de documentos, endereco seguro (tunel),
# aplicativo e navegador. Basta clicar duas vezes em INICIAR.bat.
#
# Parametros opcionais:
#   -SemAplicativo   nao inicia o aplicativo local (usar o site do Lovable)
#   -SemTunel        nao cria o endereco https (uso somente no proprio PC)

param(
  [switch]$SemAplicativo,
  [switch]$SemTunel
)

$ErrorActionPreference = "Stop"
$pastaServico = Split-Path -Parent $MyInvocation.MyCommand.Path
$pastaProjeto = Split-Path -Parent $pastaServico
Set-Location $pastaServico

function Passo($texto) { Write-Host "`n>> $texto" -ForegroundColor Cyan }
function Ok($texto)    { Write-Host "   $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   $texto" -ForegroundColor Yellow }

function Responde($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    return $r.StatusCode -eq 200
  } catch { return $false }
}

function Esperar($url, $segundos, $descricao) {
  for ($i = 0; $i -lt $segundos; $i++) {
    if (Responde $url) { return $true }
    Start-Sleep -Seconds 1
  }
  Aviso "$descricao nao respondeu em $segundos segundos."
  return $false
}

# ---------------------------------------------------------------- 1. Leitor
Passo "Preparando o leitor de documentos"
if (Responde "http://127.0.0.1:8000/situacao") {
  Ok "Leitor ja estava ligado."
} else {
  if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Ok "Criando o ambiente do leitor (primeira vez leva alguns minutos)..."
    & python -m venv .venv
  }
  $py = Join-Path $pastaServico ".venv\Scripts\python.exe"
  & $py -m pip install --upgrade pip --quiet
  & $py -m pip install -r requirements.txt --quiet
  Ok "Iniciando o leitor em http://127.0.0.1:8000 ..."
  Start-Process -FilePath $py `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $pastaServico -WindowStyle Minimized
  Esperar "http://127.0.0.1:8000/situacao" 90 "O leitor" | Out-Null
}

$ocr = "desconhecido"
try {
  $situacao = Invoke-RestMethod -Uri "http://127.0.0.1:8000/situacao" -TimeoutSec 5
  $ocr = if ($situacao.ocr) { "sim" } else { "nao" }
  Ok "Leitor ativo (versao $($situacao.versao), leitura de documentos digitalizados: $ocr)."
} catch { Aviso "Nao foi possivel confirmar a situacao do leitor." }

# ---------------------------------------------------------------- 2. Tunel
$enderecoTunel = $null
if (-not $SemTunel) {
  Passo "Criando o endereco seguro na internet"
  if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Aviso "cloudflared nao encontrado. Instale com: winget install -e --id Cloudflare.cloudflared"
  } else {
    $log = Join-Path $env:TEMP "tunel-leitor.log"
    if (Test-Path $log) { Remove-Item $log -Force }
    Start-Process -FilePath "cloudflared" `
      -ArgumentList "tunnel", "--url", "http://127.0.0.1:8000", "--logfile", $log `
      -WindowStyle Minimized
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Path $log) {
        $achado = (Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches |
          Select-Object -First 1).Matches
        if ($achado) { $enderecoTunel = $achado[0].Value; break }
      }
    }
    if ($enderecoTunel) {
      Ok "Endereco do leitor na internet: $enderecoTunel"
      Set-Content -Path (Join-Path $pastaServico "endereco-atual.txt") -Value $enderecoTunel
      Set-Clipboard -Value $enderecoTunel
      Ok "Endereco copiado. Cole em Configuracoes > Motores de analise e clique em Salvar e Testar."
    } else {
      Aviso "Nao foi possivel obter o endereco do tunel. Veja o arquivo: $log"
    }
  }
}

# ---------------------------------------------------------------- 3. Aplicativo
$enderecoApp = "http://localhost:8080"
if (-not $SemAplicativo) {
  Passo "Preparando o aplicativo"
  if (Responde $enderecoApp) {
    Ok "Aplicativo ja estava ligado."
  } elseif (-not (Test-Path (Join-Path $pastaProjeto "package.json"))) {
    Aviso "Pasta do aplicativo nao encontrada; sera aberto o site publicado."
    $enderecoApp = "https://judgement-chronicle.lovable.app"
  } else {
    if (-not (Test-Path (Join-Path $pastaProjeto "node_modules"))) {
      Ok "Instalando o aplicativo (primeira vez leva alguns minutos)..."
      Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm install" `
        -WorkingDirectory $pastaProjeto -Wait
    }
    Ok "Iniciando o aplicativo em $enderecoApp ..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" `
      -WorkingDirectory $pastaProjeto -WindowStyle Minimized
    Esperar $enderecoApp 120 "O aplicativo" | Out-Null
  }
} else {
  $enderecoApp = "https://judgement-chronicle.lovable.app"
}

# ---------------------------------------------------------------- 4. Navegador
Passo "Abrindo o navegador"
Start-Process $enderecoApp
Ok "Aberto: $enderecoApp"

Write-Host ""
Write-Host "Tudo pronto." -ForegroundColor Green
Write-Host "  Leitor:      http://127.0.0.1:8000/situacao  (OCR: $ocr)"
if ($enderecoTunel) { Write-Host "  Na internet: $enderecoTunel" }
Write-Host "  Aplicativo:  $enderecoApp"
Write-Host ""
Write-Host "Se estiver usando o aplicativo pelo seu computador, o endereco do leitor e"
Write-Host "http://127.0.0.1:8000 . Pelo site do Lovable, use o endereco da internet acima."
Write-Host ""
Write-Host "Para desligar tudo, feche as janelas minimizadas ou execute PARAR.bat."
Read-Host "Pressione Enter para fechar esta janela (os servicos continuam ligados)"
