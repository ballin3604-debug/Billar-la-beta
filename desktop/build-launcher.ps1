param(
    [switch]$SkipShortcut
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$desktopSourceDir = $PSScriptRoot
$root = Split-Path -Parent $desktopSourceDir
$iconPath = Join-Path $desktopSourceDir 'launcher.ico'
$sourcePath = Join-Path $desktopSourceDir 'BillarLauncher.cs'
$exePath = Join-Path $desktopSourceDir 'BillarBar.exe'

function New-IconPng {
    param(
        [int]$Size,
        [string]$Path
    )

    # Nuevo logo oficial de Billar Bar la Beta.
    $logoPath = Join-Path $root 'public\assets\logo-billar-beta.jpg'
    if (-not (Test-Path -LiteralPath $logoPath)) {
        throw "No se encontró el logo: $logoPath"
    }

    $source = [System.Drawing.Image]::FromFile($logoPath)
    try {
        $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.DrawImage($source, 0, 0, $Size, $Size)
        } finally {
            $graphics.Dispose()
        }
        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
    } finally {
        $source.Dispose()
    }
}

Write-Host 'Generando icono...' -ForegroundColor Cyan
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('billar-icon-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    $sizes = @(256, 128, 64, 48, 32, 16)
    $pngPaths = @()
    foreach ($size in $sizes) {
        $pngPath = Join-Path $tempDir ('icon-{0}.png' -f $size)
        New-IconPng -Size $size -Path $pngPath
        $pngPaths += $pngPath
    }

    $pngData = @()
    foreach ($pngPath in $pngPaths) {
        $pngData += ,([System.IO.File]::ReadAllBytes($pngPath))
    }

    $memory = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($memory)
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count

    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $size = $sizes[$i]
        $dimension = if ($size -ge 256) { 0 } else { $size }
        $writer.Write([byte]$dimension)
        $writer.Write([byte]$dimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$pngData[$i].Length)
        $writer.Write([UInt32]$offset)
        $offset += $pngData[$i].Length
    }

    foreach ($data in $pngData) {
        $writer.Write([byte[]]$data)
    }

    $writer.Flush()
    [System.IO.File]::WriteAllBytes($iconPath, $memory.ToArray())
    $writer.Dispose()
    $memory.Dispose()
}
finally {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

Write-Host "Icono listo: $iconPath" -ForegroundColor Green

if (-not (Test-Path $sourcePath)) {
    throw "No se encontró el código del lanzador: $sourcePath"
}

$cscCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) {
    throw 'No se encontró el compilador de .NET Framework (csc.exe).'
}

Write-Host 'Compilando lanzador...' -ForegroundColor Cyan
& $csc /nologo /target:winexe /platform:anycpu /optimize+ `
    "/win32icon:$iconPath" `
    "/out:$exePath" `
    /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll `
    $sourcePath

if ($LASTEXITCODE -ne 0) {
    throw "La compilación falló (código $LASTEXITCODE)."
}

if (-not (Test-Path $exePath)) {
    throw "No se generó el ejecutable: $exePath"
}

Write-Host "Lanzador listo: $exePath" -ForegroundColor Green

if (-not $SkipShortcut) {
    $desktopPath = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktopPath 'Billar Bar la Beta.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $root
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Abrir Billar Bar la Beta'
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Remove-Item -LiteralPath (Join-Path $desktopPath 'Billar & Bar.lnk') -Force -ErrorAction SilentlyContinue
    Write-Host "Acceso directo: $shortcutPath" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Listo. Abre el sistema con el icono "Billar Bar la Beta" del escritorio.' -ForegroundColor Cyan
