@echo off
title alloc-platform
cd /d "%~dp0"

echo =============================================
echo   alloc-platform - Iniciando com Docker
echo =============================================
echo.

start "alloc-platform" cmd /k "docker compose up --build"

echo Aguardando a aplicacao subir (pode demorar alguns minutos na primeira vez)...
echo.

:wait
timeout /t 3 /nobreak > nul
curl -s --max-time 2 http://localhost:3000 > nul 2>&1
if errorlevel 1 goto wait

echo Pronto! Abrindo http://localhost:3000 ...
start http://localhost:3000
exit
