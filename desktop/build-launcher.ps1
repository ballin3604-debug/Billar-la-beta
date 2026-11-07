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

function New-RoundedPath {
    param(
        [single]$X,
        [single]$Y,
        [single]$Width,
        [single]$Height,
        [single]$Radius
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconPng {
    param(
        [int]$Size,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::Transparent)

    try {
        $s = [single]$Size

        # Fondo redondeado con degradado verde petróleo.
        $bgRect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
        $bgPath = New-RoundedPath 0.5 0.5 ($s - 1) ($s - 1) ($s * 0.22)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $bgRect,
            [System.Drawing.Color]::FromArgb(255, 13, 43, 36),
            [System.Drawing.Color]::FromArgb(255, 4, 9, 16),
            [single]55
        )
        $graphics.FillPath($bgBrush, $bgPath)
        $bgBrush.Dispose()

        $borderPen = New-Object System.Drawing.Pen(
            [System.Drawing.Color]::FromArgb(110, 16, 185, 129),
            [single]([Math]::Max(1.0, $s * 0.006))
        )
        $graphics.DrawPath($borderPen, $bgPath)
        $borderPen.Dispose()
        $bgPath.Dispose()

        # Bola clara.
        $cx = $s * 0.5
        $cy = $s * 0.47
        $ballRadius = $s * 0.305
        $ballRect = New-Object System.Drawing.RectangleF(
            ($cx - $ballRadius),
            ($cy - $ballRadius),
            ($ballRadius * 2),
            ($ballRadius * 2)
        )
        $ballBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $ballRect,
            [System.Drawing.Color]::FromArgb(255, 250, 252, 255),
            [System.Drawing.Color]::FromArgb(255, 186, 202, 216),
            [single]60
        )
        $graphics.FillEllipse($ballBrush, $ballRect)
        $ballBrush.Dispose()

        # Círculo oscuro y número 8.
        $innerRadius = $ballRadius * 0.62
        $innerRect = New-Object System.Drawing.RectangleF(
            ($cx - $innerRadius),
            ($cy - $innerRadius),
            ($innerRadius * 2),
            ($innerRadius * 2)
        )
        $innerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $innerRect,
            [System.Drawing.Color]::FromArgb(255, 18, 29, 46),
            [System.Drawing.Color]::FromArgb(255, 5, 10, 18),
            [single]55
        )
        $graphics.FillEllipse($innerBrush, $innerRect)
        $innerBrush.Dispose()

        $fontSize = [single]([Math]::Max(4.0, $s * 0.235))
        $font = New-Object System.Drawing.Font(
            'Segoe UI',
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF(0, ($cy - $innerRadius), $s, ($innerRadius * 2))
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
        $graphics.DrawString('8', $font, $textBrush, $textRect, $format)
        $textBrush.Dispose()
        $font.Dispose()
        $format.Dispose()

        # Punto verde de acento.
        if ($Size -ge 24) {
            $dotRadius = $s * 0.072
            $dotCx = $s * 0.815
            $dotCy = $s * 0.815
            $dotRect = New-Object System.Drawing.RectangleF(
                ($dotCx - $dotRadius),
                ($dotCy - $dotRadius),
                ($dotRadius * 2),
                ($dotRadius * 2)
            )
            $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
            $graphics.FillEllipse($dotBrush, $dotRect)
            $dotBrush.Dispose()

            $highlightRadius = $dotRadius * 0.34
            $highlightRect = New-Object System.Drawing.RectangleF(
                ($dotCx - $dotRadius * 0.42),
                ($dotCy - $dotRadius * 0.48),
                ($highlightRadius * 2),
                ($highlightRadius * 2)
            )
            $highlightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 255, 255, 255))
            $graphics.FillEllipse($highlightBrush, $highlightRect)
            $highlightBrush.Dispose()
        }

        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bmp.Dispose()
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
    $shortcutPath = Join-Path $desktopPath 'Billar & Bar.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $root
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Abrir Billar & Bar'
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-Host "Acceso directo: $shortcutPath" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Listo. Abre el sistema con el icono "Billar & Bar" del escritorio.' -ForegroundColor Cyan
