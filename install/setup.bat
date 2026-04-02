@echo off
title Instalador Adega System

echo ======================================
echo INICIANDO INSTALACAO DO SISTEMA ADEGA
echo ======================================

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
:: 2. Iniciar servico (auto detect)
:: ==============================
echo Verificando servico PostgreSQL...

for /f "tokens=*" %%i in ('sc query state^= all ^| findstr /i "postgresql"') do (
    set service=%%i
)

net start postgresql-x64-16 >nul 2>nul

:: ==============================
:: 3. Criar banco
:: ==============================
set PGPASSWORD=123

echo Verificando banco...

psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='adega'" | find "1" >nul

IF %ERRORLEVEL% NEQ 0 (
    echo Criando banco adega...
    psql -U postgres -c "CREATE DATABASE adega;"
) ELSE (
    echo Banco ja existe!
)

:: ==============================
:: 4. Criar tabelas
:: ==============================
echo Criando estrutura do banco...

psql -U postgres -d adega -f banco.sql

:: ==============================
:: 5. Final
:: ==============================
echo ======================================
echo SISTEMA INSTALADO COM SUCESSO!
echo ======================================

pause