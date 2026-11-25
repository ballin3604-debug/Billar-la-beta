param(
  [string]$App = "C:\Billar-Bar-la-Beta-Instalador\app",
  [string]$Source = "C:\Users\pc\Desktop\desktop\billar2311"
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[X] $msg" -ForegroundColor Red }

function Get-CandidateDbFiles([string]$SourcePath) {
  $preferredRoots = @(
    'C:\Billar-Bar-la-Beta-Instalador',
    'C:\Billar Bar la Beta',
    'C:\Users\pc\AppData\Local',
    'C:\Users\pc\AppData\Roaming',
    'C:\ProgramData'
  ) | Where-Object { Test-Path $_ } | Select-Object -Unique

  $fallbackRoots = @('C:\') | Where-Object { Test-Path $_ }

  $found = @()
  foreach ($root in $preferredRoots) {
    try {
      $items = Get-ChildItem $root -Recurse -Filter 'billar.db' -ErrorAction SilentlyContinue
      foreach ($item in $items) {
        $p = $item.FullName
        if ($p -like '*\node_modules\*') { continue }
        if ($SourcePath -and $p.StartsWith($SourcePath, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
        if ($p -like '*\billar2311\*') { continue }
        if ($p -like '*\Billar Desktop\*') { continue }
        if ($p -like '*\backup-data-antes-actualizar-*') { continue }
        $found += $item
      }
    } catch {}
  }

  if ($found.Count -eq 0) {
    foreach ($root in $fallbackRoots) {
      try {
        $items = Get-ChildItem $root -Recurse -Filter 'billar.db' -ErrorAction SilentlyContinue
        foreach ($item in $items) {
          $p = $item.FullName
          if ($p -like '*\node_modules\*') { continue }
          if ($p -like '*\Windows\*') { continue }
          if ($p -like '*\Program Files\*') { continue }
          if ($p -like '*\Program Files (x86)\*') { continue }
          if ($SourcePath -and $p.StartsWith($SourcePath, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
          if ($p -like '*\billar2311\*') { continue }
          if ($p -like '*\Billar Desktop\*') { continue }
          if ($p -like '*\backup-data-antes-actualizar-*') { continue }
          $found += $item
        }
      } catch {}
    }
  }

  return $found | Group-Object FullName | ForEach-Object { $_.Group[0] }
}

function Resolve-AppDir([string]$InputPath, [string]$SourcePath) {
  $inputResolved = $null
  if ($InputPath -and (Test-Path $InputPath)) { $inputResolved = (Resolve-Path $InputPath).Path }

  # 1) Si el puerto 3001 está activo, intentar inferir desde el proceso
  $conn = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    try {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$conn.OwningProcess)" -ErrorAction SilentlyContinue
      if ($proc -and $proc.CommandLine) {
        $cmd = $proc.CommandLine
        $m = [regex]::Match($cmd, '"?([A-Z]:\\[^"]*?server\\index\.mjs)"?', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($m.Success) {
          $serverIndex = $m.Groups[1].Value
          $appFromProc = Split-Path -Parent (Split-Path -Parent $serverIndex)
          if ($appFromProc -and (Test-Path (Join-Path $appFromProc 'data\billar.db'))) {
            return (Resolve-Path $appFromProc).Path
          }
        }
      }
    } catch {}
  }

  # 2) Buscar billar.db en disco
  $dbs = Get-CandidateDbFiles -SourcePath $SourcePath
  if (-not $dbs -or $dbs.Count -eq 0) { return $null }

  $candidates = @()
  foreach ($db in $dbs) {
    $dataDir = Split-Path -Parent $db.FullName
    $appDir = Split-Path -Parent $dataDir
    if (-not $appDir) { continue }
    $hasServer = (Test-Path (Join-Path $appDir 'server\index.mjs')) -or (Test-Path (Join-Path $appDir 'server\database.mjs'))
    $hasDist = Test-Path (Join-Path $appDir 'dist\index.html')
    $hasRuntime = Test-Path (Join-Path $appDir 'runtime\node.exe')
    $hasExe = Test-Path (Join-Path $appDir 'BillarBar.exe')
    $score = 0
    if ($hasServer) { $score += 4 }
    if ($hasDist) { $score += 2 }
    if ($hasRuntime) { $score += 2 }
    if ($hasExe) { $score += 2 }
    if ($inputResolved -and $appDir.StartsWith($inputResolved, [System.StringComparison]::OrdinalIgnoreCase)) { $score += 3 }
    if ($db.FullName -like '*\Billar-Bar-la-Beta-Instalador\*') { $score += 2 }
    $candidates += [pscustomobject]@{
      Db = $db.FullName
      DataDir = $dataDir
      AppDir = $appDir
      Score = $score
      LastWrite = $db.LastWriteTime
      Length = $db.Length
    }
  }

  if ($candidates.Count -eq 0) { return $null }

  $sorted = $candidates | Sort-Object @{Expression='Score';Descending=$true}, @{Expression='LastWrite';Descending=$true}
  if ($sorted.Count -gt 1) {
    Write-Warn "Se encontraron varias bases de datos candidatas:"
    foreach ($c in $sorted | Select-Object -First 5) {
      Write-Host ("  - {0} | {1} bytes | {2}" -f $c.Db, $c.Length, $c.LastWrite) -ForegroundColor Gray
    }
  }

  $best = $sorted | Select-Object -First 1
  Write-Ok "Base de datos del cliente detectada: $($best.Db)"
  return $best.AppDir
}

$App = $App.Trim().Trim('"')
$Source = $Source.Trim().Trim('"')

Write-Step "Buscando carpeta de actualizacion..."
if (-not (Test-Path $Source)) { Write-Fail "No existe la carpeta de actualizacion: $Source"; exit 1 }
$Source = (Resolve-Path $Source).Path

$sourceIndex = Join-Path $Source 'dist\index.html'
$sourceServer = Join-Path $Source 'server\index.mjs'
if (-not (Test-Path $sourceIndex) -or -not (Test-Path $sourceServer)) {
  $nested = Get-ChildItem $Source -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } | Where-Object {
    (Test-Path (Join-Path $_ 'dist\index.html')) -and (Test-Path (Join-Path $_ 'server\index.mjs'))
  } | Select-Object -First 1
  if ($nested) {
    Write-Warn "Se detecto actualizacion en subcarpeta: $nested"
    $Source = $nested
  } else {
    Write-Fail "La carpeta de actualizacion no es valida. Debe contener dist\index.html y server\index.mjs"
    exit 1
  }
}
Write-Ok "Actualizacion: $Source"

Write-Step "Buscando instalacion real del cliente..."
$appResolved = Resolve-AppDir -InputPath $App -SourcePath $Source
if (-not $appResolved) {
  Write-Fail "No se encontro ninguna base de datos billar.db del cliente. No se actualizo nada."
  Write-Host "Si el sistema nunca se uso en esta PC, no hay data que preservar. Instala/abre el sistema primero o indica la carpeta correcta." -ForegroundColor Yellow
  exit 1
}
$appResolved = (Resolve-Path $appResolved).Path
Write-Ok "Sistema detectado en: $appResolved"

$appData = Join-Path $appResolved 'data'
$dbPath = Join-Path $appData 'billar.db'
if (-not (Test-Path $dbPath)) {
  Write-Fail "No se encontro data\billar.db en $appResolved. Se cancela para proteger los datos."
  exit 1
}

# 1) Respaldo de data
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $appResolved "backup-data-antes-actualizar-$stamp"
Write-Step "Respaldando data a: $backupDir"
Copy-Item $appData $backupDir -Recurse -Force
Write-Ok "Respaldo de data creado."

# 2) Cerrar sistema si está corriendo en puerto 3001
$conn = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  $procId = [int]$conn.OwningProcess
  Write-Warn "El sistema esta abierto en puerto 3001 (PID $procId). Se cerrara temporalmente..."
  try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch { Write-Warn "No se pudo detener PID ${procId}: $($_.Exception.Message)" }
  $waited = 0
  while ($waited -lt 15) {
    Start-Sleep -Seconds 1
    $waited++
    $still = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
    if (-not $still) { break }
  }
  if (Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue) {
    Write-Fail "No se pudo liberar el puerto 3001. Cierra el sistema manualmente y vuelve a ejecutar."
    exit 1
  }
  Write-Ok "Sistema cerrado."
} else {
  Write-Ok "El sistema no estaba corriendo en puerto 3001."
}

# 3) Copiar actualización sin tocar data
Write-Step "Copiando actualizacion..."
Write-Step "Origen:  $Source"
Write-Step "Destino: $appResolved"
Write-Warn "Excluyendo data, node_modules, .git. La base de datos NO se toca."

$robocopyArgs = @(
  $Source, $appResolved, '/E',
  '/XD', 'data', 'node_modules', '.git',
  '/XF', '*.log', 'Actualizar.bat', 'Actualizar.ps1', 'Actualizar-Automatico.bat', 'Actualizar-Automatico.ps1',
  '/R:2', '/W:1', '/NFL', '/NDL', '/NP'
)
& robocopy @robocopyArgs | Out-Host
$rc = $LASTEXITCODE
if ($rc -ge 8) {
  Write-Fail "Robocopy fallo con codigo $rc. La carpeta data NO fue tocada."
  exit $rc
}
Write-Ok "Actualizacion copiada (robocopy codigo $rc)."

# 4) Reiniciar sistema
Write-Step "Iniciando el sistema..."
$started = $false
$exe = Join-Path $appResolved 'BillarBar.exe'
$iniciarConsola = Join-Path $appResolved 'Iniciar-consola.bat'
$iniciarBat = Join-Path $appResolved 'iniciar.bat'
$iniciarBat2 = Join-Path $appResolved 'Iniciar.bat'
$runtimeNode = Join-Path $appResolved 'runtime\node.exe'
$systemNode = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1

if (Test-Path $exe) {
  Start-Process -FilePath $exe -WorkingDirectory $appResolved; $started = $true; Write-Ok "Iniciado con BillarBar.exe"
} elseif (Test-Path $iniciarConsola) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$iniciarConsola`"" -WorkingDirectory $appResolved; $started = $true; Write-Ok "Iniciado con Iniciar-consola.bat"
} elseif (Test-Path $iniciarBat) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$iniciarBat`"" -WorkingDirectory $appResolved; $started = $true; Write-Ok "Iniciado con iniciar.bat"
} elseif (Test-Path $iniciarBat2) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$iniciarBat2`"" -WorkingDirectory $appResolved; $started = $true; Write-Ok "Iniciado con Iniciar.bat"
} elseif (Test-Path $runtimeNode) {
  Start-Process -FilePath $runtimeNode -ArgumentList '--disable-warning=ExperimentalWarning', 'server/index.mjs' -WorkingDirectory $appResolved -WindowStyle Hidden; $started = $true; Write-Ok "Iniciado con runtime\node.exe"
} elseif ($systemNode -and (Test-Path (Join-Path $appResolved 'server\index.mjs'))) {
  Start-Process -FilePath $systemNode -ArgumentList '--disable-warning=ExperimentalWarning', 'server/index.mjs' -WorkingDirectory $appResolved -WindowStyle Hidden; $started = $true; Write-Ok "Iniciado con Node del sistema"
}

if (-not $started) {
  Write-Warn "No se encontro lanzador conocido. Inicia el sistema manualmente."
} else {
  Start-Sleep -Seconds 4
  $up = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
  if ($up) { Write-Ok "Servidor escuchando en puerto 3001." }
  else { Write-Warn "El proceso se lanzo, pero el puerto 3001 aun no responde. Espera unos segundos o revisa la ventana del sistema." }
}

Write-Host ""
Write-Ok "Actualizacion completada. data/ NO fue modificada."
Write-Host "Respaldo: $backupDir" -ForegroundColor Gray
Write-Host "Base de datos preservada: $dbPath" -ForegroundColor Gray
Write-Host "Verifica que las mesas activas sigan con su tiempo y consumo." -ForegroundColor Gray
