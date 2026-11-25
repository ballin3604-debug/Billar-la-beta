@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo  ACTUALIZAR BILLAR BAR LA BETA
echo  No toca la carpeta data ni la base de datos
echo ==============================================
echo.

set "SRC=%~1"
if "%SRC%"=="" (
  set /p "SRC=Arrastra o pega la ruta de la carpeta de actualizacion: "
)

if "%SRC%"=="" (
  echo [X] No se indico la carpeta de actualizacion.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Actualizar.ps1" -Source "%SRC%"
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo [X] La actualizacion termino con errores. Revisa los mensajes de arriba.
) else (
  echo [OK] Proceso finalizado.
)
echo.
pause
exit /b %EXITCODE%
