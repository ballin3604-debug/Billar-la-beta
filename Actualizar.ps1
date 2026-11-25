param(
  [string]$Source
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[X] $msg" -ForegroundColor Red }

$programDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $programDir

Write-Host ""
Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host "  ACTUALIZAR BILLAR BAR LA BETA" -ForegroundColor White
Write-Host "  No toca la carpeta data ni la base de datos" -ForegroundColor DarkCyan
Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host ""

if (-not $Source) {
  $Source = Read-Host "Arrastra o pega la ruta de la carpeta de actualizacion (la carpeta extraida del ZIP)"
}

$Source = $Source.Trim().Trim('"')
if (-not $Source) {
  Write-Fail "No se indico la carpeta de actualizacion."
  exit 1
}

if (-not (Test-Path $Source)) {
  Write-Fail "No existe la ruta: $Source"
  exit 1
}

$sourceResolved = (Resolve-Path $Source).Path
$sourceIndex = Join-Path $sourceResolved 'dist\index.html'
$sourceServer = Join-Path $sourceResolved 'server\index.mjs'
if (-not (Test-Path $sourceIndex) -or -not (Test-Path $sourceServer)) {
  Write-Fail "La carpeta no parece una actualizacion valida. Debe contener dist\index.html y server\index.mjs"
  exit 1
}

$port3001 = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
  Write-Fail "El sistema parece estar abierto (puerto 3001 en uso, PID $($port3001.OwningProcess))."
  Write-Host "Cierra el sistema Billar antes de actualizar y vuelve a ejecutar este archivo." -ForegroundColor Yellow
  exit 1
}

$dataDir = Join-Path $programDir 'data'
if (-not (Test-Path $dataDir)) {
  Write-Warn "No se encontro la carpeta data en $programDir. Se continuara, pero verifica que esta es la carpeta correcta del sistema."
} else {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupDir = Join-Path $programDir "backup-data-antes-actualizar-$stamp"
  Write-Step "Creando respaldo de data en: $backupDir"
  Copy-Item $dataDir $backupDir -Recurse -Force
  Write-Ok "Respaldo de data creado."
}

Write-Step "Copiando actualizacion desde: $sourceResolved"
Write-Step "Destino: $programDir"
Write-Warn "Se excluye data/ para no tocar la base de datos ni los cronometros."

$excludeDirs = @('data', 'node_modules', '.git')
$robocopyArgs = @(
  $sourceResolved,
  $programDir,
  '/E',
  '/XD'
) + $excludeDirs + @('/XF', '*.log', 'Actualizar.bat', 'Actualizar.ps1', '/R:2', '/W:1', '/NFL', '/NDL', '/NP')

& robocopy @robocopyArgs | Out-Host
$rc = $LASTEXITCODE
if ($rc -ge 8) {
  Write-Fail "Robocopy fallo con codigo $rc. No se completo la actualizacion."
  exit $rc
}

Write-Ok "Archivos actualizados correctamente (robocopy codigo $rc)."
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor White
Write-Host "1. Inicia el sistema normalmente (Iniciar.bat / acceso directo)." -ForegroundColor Gray
Write-Host "2. Verifica que las mesas activas sigan con su tiempo y consumo." -ForegroundColor Gray
Write-Host "3. Si el sistema pide dependencias faltantes, ejecuta npm install en esta carpeta." -ForegroundColor Gray
Write-Host ""
Write-Ok "Actualizacion terminada. La carpeta data no fue modificada."
