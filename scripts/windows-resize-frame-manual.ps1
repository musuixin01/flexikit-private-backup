# Interactive visual A/B launcher for the isolated FlexiKit resize test.
# Keeps the regular FlexiKit desktop process, installed EXE and user data intact.
# Launch Standard, close that test window, then launch Custom for comparison.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Standard', 'Custom')]
  [string]$Frame
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$exe = 'D:\AI_Cache\flexikit-resize-isolated\debug\flexikit-resize-test.exe'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Build the opt-in isolated resize-test binary first: $exe"
}
$existing = @(Get-Process -Name 'flexikit-resize-test' -ErrorAction SilentlyContinue)
if ($existing.Count -gt 0) {
  throw 'Close the existing isolated resize test window before launching another comparison.'
}
$oldFrame = [Environment]::GetEnvironmentVariable('FLEXIKIT_RESIZE_TEST_FRAME', 'Process')
$oldTransparent = [Environment]::GetEnvironmentVariable('FLEXIKIT_RESIZE_TRANSPARENT', 'Process')
$oldBrowserFlags = [Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', 'Process')
try {
  $env:FLEXIKIT_RESIZE_TEST_FRAME = $Frame.ToLowerInvariant()
  $env:FLEXIKIT_RESIZE_TRANSPARENT = '0'
  # Default GPU composition: no diagnostic flags in manual physical drag.
  Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
  $proc = Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Path $exe -Parent) -PassThru
  Write-Output "Isolated visual test started: $Frame PID=$($proc.Id)"
  Write-Output 'Drag the right edge, bottom edge and lower-right corner quickly five times each.'
  Write-Output 'Close this test window normally before trying the other frame mode.'
  Write-Output 'The actual FlexiKit desktop process has not been touched.'
} finally {
  [Environment]::SetEnvironmentVariable('FLEXIKIT_RESIZE_TEST_FRAME', $oldFrame, 'Process')
  [Environment]::SetEnvironmentVariable('FLEXIKIT_RESIZE_TRANSPARENT', $oldTransparent, 'Process')
  [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', $oldBrowserFlags, 'Process')
}
