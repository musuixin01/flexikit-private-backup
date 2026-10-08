# Build or stage the Windows gnullvm development executable and its exact runtime.
# The linker imports "libunwind.whl" (not libunwind.dll); keeping only the
# compiler's libunwind.dll somewhere on PATH does not make the EXE standalone.
[CmdletBinding()]
param(
  [string]$TargetDir = 'D:\AI_Cache\flexikit-gnullvm-target',
  [string]$CompilerRoot = 'D:\Own_Tools\Windhawk\Compiler',
  [string]$WindresDir = 'D:\DevTools\QT\Tools\mingw1310_64\bin',
  [switch]$SkipBuild,
  [switch]$SkipFrontend,
  [switch]$Release
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compilerBin = Join-Path $CompilerRoot 'bin'
$compilerRuntimeBin = Join-Path $CompilerRoot 'x86_64-w64-mingw32\bin'
$clang = Join-Path $compilerBin 'clang-20.exe'
$clangCpp = Join-Path $compilerBin 'clang++.exe'
$windres = Join-Path $WindresDir 'windres.exe'
$unwindSource = Join-Path $compilerRuntimeBin 'libunwind.dll'
$profile = if ($Release) { 'release' } else { 'debug' }

foreach ($required in @($clang, $clangCpp, $windres, $unwindSource)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Missing Windows gnullvm build input: $required"
  }
}

$resolvedTarget = [System.IO.Path]::GetFullPath($TargetDir)
$runtimeDir = Join-Path $resolvedTarget 'gnullvm-runtime'
$exeDir = Join-Path $resolvedTarget $profile
$exe = Join-Path $exeDir 'flexikit-desktop.exe'
$runningTarget = @(Get-Process -Name flexikit-desktop -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $exe })
if (-not $SkipBuild -and $runningTarget.Count -gt 0) {
  throw "Close the running FlexiKit Desktop before rebuilding: $exe"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

# The checked-in source code never contains compiler DLL binaries. This local
# alias mirrors the exact name encoded in the custom gnullvm EXE import table.
$runtimeAlias = Join-Path $runtimeDir 'libunwind.whl'
Copy-Item -LiteralPath $unwindSource -Destination $runtimeAlias -Force

if (-not $SkipBuild) {
  if (-not $SkipFrontend) {
    Push-Location (Join-Path $repoRoot 'apps\web')
    try {
      & npm.cmd run build:desktop
      if ($LASTEXITCODE -ne 0) { throw "Desktop web build failed (exit $LASTEXITCODE)" }
    } finally {
      Pop-Location
    }
  }

  $env:CARGO_TARGET_DIR = $resolvedTarget
  $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNULLVM_LINKER = $clang
  $env:CC_x86_64_pc_windows_gnullvm = $clang
  $env:CXX_x86_64_pc_windows_gnullvm = $clangCpp
  $env:CC_X86_64_PC_WINDOWS_GNULLVM = $clang
  $env:CXX_X86_64_PC_WINDOWS_GNULLVM = $clangCpp
  $env:PATH = "$runtimeDir;$WindresDir;$compilerRuntimeBin;$compilerBin;$env:PATH"

  Push-Location (Join-Path $repoRoot 'apps\desktop\src-tauri')
  try {
    $argsForCargo = @('+stable-x86_64-pc-windows-gnullvm', 'build', '-j', '4')
    if ($Release) { $argsForCargo += '--release' }
    & cargo @argsForCargo
    if ($LASTEXITCODE -ne 0) { throw "Tauri gnullvm build failed (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

$webviewLoader = Join-Path $exeDir 'WebView2Loader.dll'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Executable does not exist; run this script without -SkipBuild first: $exe"
}
if (-not (Test-Path -LiteralPath $webviewLoader -PathType Leaf)) {
  throw "WebView2Loader.dll is missing beside the executable: $webviewLoader"
}

New-Item -ItemType Directory -Path $exeDir -Force | Out-Null
$runtimeDestination = Join-Path $exeDir 'libunwind.whl'
$sourceHash = (Get-FileHash -LiteralPath $unwindSource -Algorithm SHA256).Hash
$currentHash = if (Test-Path -LiteralPath $runtimeDestination -PathType Leaf) {
  (Get-FileHash -LiteralPath $runtimeDestination -Algorithm SHA256).Hash
} else { '' }
if ($currentHash -ne $sourceHash) {
  if ($runningTarget.Count -gt 0) {
    throw "Close FlexiKit Desktop before updating its loaded runtime: $runtimeDestination"
  }
  Copy-Item -LiteralPath $unwindSource -Destination $runtimeDestination -Force
}
$destinationHash = (Get-FileHash -LiteralPath $runtimeDestination -Algorithm SHA256).Hash
if ($sourceHash -ne $destinationHash) {
  throw "libunwind.whl staging hash mismatch: $runtimeDestination"
}

Write-Output 'FlexiKit Windows gnullvm build/runtime staging: PASS'
Write-Output "Executable: $exe"
Write-Output "Runtime:    $runtimeDestination"
Write-Output "Loader:     $webviewLoader"
Write-Output 'The EXE and its DLL/runtime dependencies must be moved as a set.'
