@echo off
title Instalador Adega System

echo ===============================
echo Verificando PostgreSQL...
echo ===============================

where psql >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL NAO encontrado!

    echo Baixando PostgreSQL...
    powershell -Command "Invoke-WebRequest -Uri https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe -OutFile postgres.exe"

    echo Instalando PostgreSQL...
    start /wait postgres.exe --mode unattended --unattendedmodeui none --superpassword "123"

    echo Instalacao concluida!
) ELSE (
    echo PostgreSQL ja instalado!
)

echo ===============================
echo Verificando servico...
echo ===============================

net start postgresql-x64-16 >nul 2>nul

echo ===============================
echo Criando banco...
echo ===============================

set PGPASSWORD=123

psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='adega'" | find "1" >nul
IF %ERRORLEVEL% NEQ 0 (
    echo Criando banco adega...
    psql -U postgres -c "CREATE DATABASE adega;"
) ELSE (
    echo Banco ja existe!
)

echo ===============================
echo Criando tabelas...
echo ===============================

psql -U postgres -d adega -f banco.sql

echo ===============================
echo FINALIZADO COM SUCESSO!
echo ===============================

pause