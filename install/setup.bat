@echo off
title Instalador Adega System

echo ======================================
echo INICIANDO INSTALACAO DO SISTEMA ADEGA
echo ======================================

:: Ajusta PATH do PostgreSQL (pode mudar versão)
set PATH=%PATH%;C:\Program Files\PostgreSQL\16\bin

:: ==============================
:: 1. Verificar PostgreSQL
:: ==============================
where psql >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL NAO encontrado!

    echo Baixando PostgreSQL...
    powershell -Command "Invoke-WebRequest -Uri https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe -OutFile postgres.exe"

    echo Instalando PostgreSQL...
    start /wait postgres.exe --mode unattended --unattendedmodeui none --superpassword "123"
) ELSE (
    echo PostgreSQL ja instalado!
)

:: ==============================
:: 2. Iniciar servico
:: ==============================
echo Iniciando servico PostgreSQL...
net start postgresql-x64-16 >nul 2>nul

:: ==============================
:: 3. Criar banco
:: ==============================
set PGPASSWORD=123

psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='adega_db'" | find "1" >nul

IF %ERRORLEVEL% NEQ 0 (
    echo Criando banco adega_db...
    psql -U postgres -c "CREATE DATABASE adega_db;"
) ELSE (
    echo Banco ja existe!
)

:: ==============================
:: 4. Criar tabelas
:: ==============================
echo Criando estrutura do banco...
psql -U postgres -d adega_db -f banco.sql

:: ==============================
:: 5. Subir backend
:: ==============================
echo Iniciando backend...

cd ../backend
call npm install
start cmd /k "node server.js"

:: ==============================
:: FINAL
:: ==============================
echo ======================================
echo SISTEMA PRONTO!
echo Backend: http://localhost:3000
echo ======================================

pause