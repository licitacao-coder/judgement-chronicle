# Instalação do serviço de leitura (Windows 10/11)
# Execute no PowerShell, dentro da pasta "servico-python":
#   powershell -ExecutionPolicy Bypass -File .\instalar-windows.ps1

$ErrorActionPreference = "Stop"
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $pasta

Write-Host "1/5 Verificando o Python..." -ForegroundColor Cyan
$python = "python"
& $python --version
if ($LASTEXITCODE -ne 0) {
  throw "Python nao encontrado. Instale em https://www.python.org/downloads/windows/ marcando 'Add python.exe to PATH'."
}

Write-Host "2/5 Criando o ambiente isolado..." -ForegroundColor Cyan
if (-not (Test-Path ".\ambiente")) { & $python -m venv ambiente }
$py = ".\ambiente\Scripts\python.exe"

Write-Host "3/5 Instalando as bibliotecas..." -ForegroundColor Cyan
& $py -m pip install --upgrade pip
& $py -m pip install -r requirements.txt

Write-Host "4/5 Conferindo os programas de leitura de imagem..." -ForegroundColor Cyan
$tess = Get-Command tesseract -ErrorAction SilentlyContinue
if (-not $tess) {
  Write-Host "   Tesseract nao encontrado (necessario para documentos digitalizados)." -ForegroundColor Yellow
  Write-Host "   Instale com:  winget install -e --id UB-Mannheim.TesseractOCR" -ForegroundColor Yellow
}
$popp = Get-Command pdftoppm -ErrorAction SilentlyContinue
if (-not $popp) {
  Write-Host "   Poppler nao encontrado (necessario para converter paginas em imagem)." -ForegroundColor Yellow
  Write-Host "   Instale com:  winget install -e --id oschwartz10612.Poppler" -ForegroundColor Yellow
}

Write-Host "5/5 Iniciando o servico em http://127.0.0.1:8000 ..." -ForegroundColor Cyan
if (-not $env:CHAVE_SERVICO) {
  Write-Host "   Dica: defina uma chave de acesso antes de expor na internet:" -ForegroundColor Yellow
  Write-Host '   $env:CHAVE_SERVICO = "uma-chave-longa-e-secreta"' -ForegroundColor Yellow
}
& $py -m uvicorn main:app --host 127.0.0.1 --port 8000
