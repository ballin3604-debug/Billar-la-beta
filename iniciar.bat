@echo off
setlocal
cd /d "%~dp0"
title Billar ^& Bar - Caja local
set PORT=3001

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js.
  echo Instala Node.js 22 LTS o superior desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo Compilando la interfaz...
  call npm run build
  if errorlevel 1 (
    echo.
    echo No se pudo compilar la interfaz.
    pause
    exit /b 1
  )
)

set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server/index.mjs

if errorlevel 1 (
  echo.
  echo El sistema se detuvo con un error. Revisa el mensaje de arriba.
  pause
)
