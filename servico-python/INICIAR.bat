@echo off
REM Atalho para ligar tudo de uma vez (clique duas vezes neste arquivo).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-tudo.ps1" %*
if errorlevel 1 pause
