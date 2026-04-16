@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════╗
echo ║   CHAT INTERNO - CONFIGURAÇÃO INICIAL   ║
echo ╚════════════════════════════════════════╝
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Node.js não está instalado ou não está no PATH
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js encontrado:
node --version
echo.

REM Instalar dependências
echo [1/2] Instalando dependências do projeto...
echo.
call npm install

if %errorlevel% neq 0 (
    echo ✗ Erro ao instalar dependências
    pause
    exit /b 1
)

echo.
echo [2/2] Executando configuração...
echo.
call npm run setup

if %errorlevel% neq 0 (
    echo ✗ Erro na configuração
    pause
    exit /b 1
)

echo.
echo ═════════════════════════════════════════
echo ✓ Configuração concluída com sucesso!
echo.
echo Próximas instruções:
echo 1. Execute: iniciar.bat
echo    (ou npm start)
echo.
echo 2. Acesse: http://localhost:3000
echo.
echo 3. Faça login com os dados que você criou
echo.
pause
