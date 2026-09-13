@echo off
REM Desliga o leitor de documentos, o endereco da internet e o aplicativo.
echo Desligando...
taskkill /F /IM cloudflared.exe >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080" ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
echo Pronto.
timeout /t 2 >nul
