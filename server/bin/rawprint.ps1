param(
  [string]$PrinterName,
  [string]$FilePath,
  [switch]$List
)

$ErrorActionPreference = 'Stop'

# Los nombres de impresora pueden tener acentos. Node lee stdout como UTF-8,
# así que forzamos esa codificación (sin BOM) también en Windows PowerShell 5.1.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

function Write-Stderr {
  param([string]$Message)
  [Console]::Error.WriteLine($Message)
}

try {
  if ($List) {
    $printers = @(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)
    $json = $printers | ConvertTo-Json -Compress
    if ($null -eq $json) { $json = '[]' }
    if ($printers.Count -eq 1) { $json = ConvertTo-Json @($printers[0]) -Compress }
    [Console]::Out.Write($json)
    exit 0
  }

  if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    Write-Stderr 'Falta el nombre de la impresora (-PrinterName).'
    exit 2
  }
  if ([string]::IsNullOrWhiteSpace($FilePath)) {
    Write-Stderr 'Falta la ruta del archivo a imprimir (-FilePath).'
    exit 2
  }
  if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Stderr "No se encontró el archivo a imprimir: $FilePath"
    exit 2
  }

  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  if ($bytes.Length -eq 0) {
    Write-Stderr 'El archivo a imprimir está vacío.'
    exit 2
  }

  if (-not ('RawPrinterHelper.WinSpool' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    public static class WinSpool
    {
        [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
        public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
        public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

        public static string LastError(string operation)
        {
            int code = Marshal.GetLastWin32Error();
            string msg = new Win32Exception(code).Message;
            return operation + ": " + msg + " (código " + code + ").";
        }
    }
}
'@
  }

  $hPrinter = [IntPtr]::Zero
  $docId = 0
  $docStarted = $false
  $pageStarted = $false

  try {
    $opened = [RawPrinterHelper.WinSpool]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
    if (-not $opened -or $hPrinter -eq [IntPtr]::Zero) {
      Write-Stderr ("No se pudo abrir la impresora '$PrinterName'. " + [RawPrinterHelper.WinSpool]::LastError('OpenPrinter'))
      exit 3
    }

    $docInfo = New-Object RawPrinterHelper.DOCINFOA
    $docInfo.pDocName = 'Ticket Billar Bar la Beta'
    $docInfo.pOutputFile = $null
    $docInfo.pDataType = 'RAW'

    $docId = [RawPrinterHelper.WinSpool]::StartDocPrinter($hPrinter, 1, $docInfo)
    if ($docId -le 0) {
      Write-Stderr ("No se pudo iniciar el documento de impresión. " + [RawPrinterHelper.WinSpool]::LastError('StartDocPrinter'))
      exit 4
    }
    $docStarted = $true

    if (-not [RawPrinterHelper.WinSpool]::StartPagePrinter($hPrinter)) {
      Write-Stderr ("No se pudo iniciar la página de impresión. " + [RawPrinterHelper.WinSpool]::LastError('StartPagePrinter'))
      exit 5
    }
    $pageStarted = $true

    $written = 0
    $ok = [RawPrinterHelper.WinSpool]::WritePrinter($hPrinter, $bytes, $bytes.Length, [ref]$written)
    if (-not $ok) {
      Write-Stderr ("No se pudieron enviar los datos a la impresora. " + [RawPrinterHelper.WinSpool]::LastError('WritePrinter'))
      exit 6
    }
    if ($written -ne $bytes.Length) {
      Write-Stderr ("Se escribieron $written bytes de $($bytes.Length) esperados.")
      exit 7
    }
  }
  finally {
    if ($pageStarted) { [void][RawPrinterHelper.WinSpool]::EndPagePrinter($hPrinter) }
    if ($docStarted) { [void][RawPrinterHelper.WinSpool]::EndDocPrinter($hPrinter) }
    if ($hPrinter -ne [IntPtr]::Zero) { [void][RawPrinterHelper.WinSpool]::ClosePrinter($hPrinter) }
  }

  [Console]::Out.Write('OK')
  exit 0
}
catch {
  Write-Stderr $_.Exception.Message
  exit 1
}
