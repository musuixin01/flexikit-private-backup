# Launch ONLY the isolated FlexiKit resize-test binary to visually compare
# WebView2 rendering paths. Does not modify machine/user environment variables,
# production desktop settings, installed applications or browser registry keys.
[CmdletBinding()]
param(
  [ValidateSet('Default', 'DisableDirectComposition', 'DisableGpuCompositing')]
  [string]$Mode = 'Default',
  [string]$Executable = 'D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$exe = [System.IO.Path]::GetFullPath($Executable)
if ([System.IO.Path]::GetFileName($exe) -ine 'flexikit-resize-test.exe') {
  throw 'Refusing to launch a production or non-isolated executable'
}
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Isolated executable was not found: $exe"
}
$running = @(Get-Process -Name 'flexikit-resize-test' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) {
  throw 'An isolated resize test is already running. Close that window normally before switching mode.'
}

$browserSwitch = switch ($Mode) {
  'Default' { $null }
  'DisableDirectComposition' { '--disable-direct-composition' }
  'DisableGpuCompositing' { '--disable-gpu-compositing' }
}

$originalFlags = [Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', 'Process')
$originalTransparent = [Environment]::GetEnvironmentVariable('FLEXIKIT_RESIZE_TRANSPARENT', 'Process')
try {
  # No inherited browser overrides: each option tests exactly one change.
  [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', $browserSwitch, 'Process')
  [Environment]::SetEnvironmentVariable('FLEXIKIT_RESIZE_TRANSPARENT', '0', 'Process')
  $proc = Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Path $exe -Parent) -PassThru
} finally {
  [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', $originalFlags, 'Process')
  [Environment]::SetEnvironmentVariable('FLEXIKIT_RESIZE_TRANSPARENT', $originalTransparent, 'Process')
}

Write-Output "Isolated FlexiKit rendering mode: $Mode"
Write-Output "PID: $($proc.Id)"
Write-Output "EXE: $exe"
Write-Output 'Test by dragging right/bottom/corner edges several times, then CLOSE this test window normally before comparing another mode.'
Write-Output 'A successful launch does NOT mean the resize flicker is fixed.'
