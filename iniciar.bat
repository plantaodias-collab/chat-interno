@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════╗
echo ║   CHAT INTERNO - SERVIDOR              ║
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

echo ✓ Node.js encontrado
echo.

REM Verificar se pasta node_modules existe
if not exist "node_modules" (
    echo ⚠ Dependências não instaladas. Instalando...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo ✗ Erro ao instalar dependências
        pause
        exit /b 1
    )
    echo.
)

REM Verificar se banco de dados existe
if not exist "chat.db" (
    echo ⚠ Banco de dados não encontrado. Execute setup primeiro:
    echo.
    echo   npm run setup
    echo.
    pause
    exit /b 1
)

echo ✓ Iniciando servidor...
echo.
echo Acesse em:
echo   • http://localhost:3000
echo   • http://127.0.0.1:3000
echo.
echo Para acessar de outra máquina use: http://SEU_IP:3000
echo Descubra seu IP digitando: ipconfig
echo.
echo Pressione CTRL+C para parar o servidor
echo ═════════════════════════════════════════
echo.

npm start
