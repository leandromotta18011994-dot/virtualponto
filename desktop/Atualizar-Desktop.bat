@echo off
title Atualizar Virtual Ponto - Desktop
echo ========================================================
echo    ATUALIZAR VIRTUAL PONTO - VERSAO DO DESKTOP
echo ========================================================
echo.

set "TARGET=%USERPROFILE%\OneDrive\Desktop\virtualponto"
if not exist "%TARGET%" set "TARGET=%USERPROFILE%\Desktop\virtualponto"
set "DTOOLS=%USERPROFILE%\OneDrive\Desktop\desktop"
if not exist "%DTOOLS%" set "DTOOLS=%USERPROFILE%\Desktop\desktop"

if not exist "%TARGET%\.git" (
    [ERRO] Copia do projeto nao encontrada em:
    echo        %TARGET%
    echo.
    pause
    exit /b 1
)

echo [1/3] Buscando atualizacoes no GitHub...
git -C "%TARGET%" fetch origin
if errorlevel 1 goto :erro

echo [2/3] Aplicando a versao mais recente...
git -C "%TARGET%" reset --hard origin/main
if errorlevel 1 goto :erro

echo [3/3] Sincronizando dependencias...
pushd "%TARGET%"
call npm install --no-audit --no-fund
popd

if /i not "%~dp0"=="%DTOOLS%\" (
    if exist "%DTOOLS%\" if exist "%~dp0Abrir-VirtualPonto-Windows.bat" (
        copy /y "%~dp0Abrir-VirtualPonto-Windows.bat" "%DTOOLS%" >nul
    )
)

echo.
echo Pronto! Versao atual no desktop:
git -C "%TARGET%" log --oneline -1
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] Nao foi atualizado. Verifique a internet e tente de novo.
echo.
pause
exit /b 1
