@echo off
cd /d "%~dp0.."
title Virtual Ponto - Desktop
echo ========================================================
echo         VIRTUAL PONTO - INICIALIZADOR WINDOWS
echo ========================================================
echo.
echo Verificando servico do aplicativo...

netstat -ano | find "3000" | find "LISTENING" >nul
if %errorlevel% neq 0 (
    echo Iniciando servidor interno na porta 3000...
    start /b npx vite --host 0.0.0.0 --port 3000
    timeout /t 3 /nobreak >nul
)

echo Abrindo Virtual Ponto como aplicativo desktop...
start msedge --app=https://virtualponto.lovable.app
if %errorlevel% neq 0 (
    start msedge --app=http://localhost:3000
)
exit
