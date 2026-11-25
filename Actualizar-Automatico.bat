@echo off
setlocal
cd /d "%~dp0"

set "APP=C:\Billar-Bar-la-Beta-Instalador\app"
set "SRC=C:\Users\pc\Desktop\desktop\billar2311"

if not "%~1"=="" set "APP=%~1"
if not "%~2"=="" set "SRC=%~2"

echo.
echo ============================================================
echo  ACTUALIZACION AUTOMATICA - BILLAR BAR LA BETA
echo  No toca data/ (base de datos, mesas, consumo, turnos)
echo ============================================================
echo  APP: %APP%
echo  SRC: %SRC%
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Actualizar-Automatico.ps1" -App "%APP%" -Source "%SRC%"
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo [X] La actualizacion termino con errores.
) else (
  echo [OK] Proceso finalizado.
)
echo.
pause
exit /b %EXITCODE%
