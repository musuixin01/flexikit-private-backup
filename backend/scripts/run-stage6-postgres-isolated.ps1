# Run the real Stage 6 pairing regression against a newly created,
# loopback-only PostgreSQL cluster in the OS TEMP folder.
# NEVER connects to the installed PostgreSQL Windows service.
param(
  [Parameter(Mandatory = $true)][string]$IsolatedBackendRoot,
  [string]$PostgresBin = 'D:\Own_Softwares\Develop_software\PostgreSQL\18\bin'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$tempRoot = [IO.Path]::GetTempPath().TrimEnd('\')
$backendPath = [IO.Path]::GetFullPath($IsolatedBackendRoot)
if (!$backendPath.StartsWith(($tempRoot + '\'), [StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path $backendPath -Leaf) -notmatch '^flexikit-stage6-isolated-[a-f0-9]{32}$') {
  throw 'Refusing to run outside an isolated TEMP backend copy'
}
if (!(Test-Path -LiteralPath (Join-Path $backendPath 'node_modules\typeorm\package.json')) -or
    !(Test-Path -LiteralPath (Join-Path $PostgresBin 'initdb.exe')) -or
    !(Test-Path -LiteralPath (Join-Path $PostgresBin 'pg_ctl.exe'))) {
  throw 'Isolated dependencies or PostgreSQL tooling unavailable'
}
$testScript = Join-Path $PSScriptRoot 'stage6-extension-pair-postgres-isolated.mjs'
if (!(Test-Path -LiteralPath $testScript)) { throw 'Missing guarded test script' }
Copy-Item -LiteralPath $testScript -Destination (Join-Path $backendPath 'scripts\stage6-extension-pair-postgres-isolated.mjs') -Force

$base = Join-Path $tempRoot ('flexikit-stage6-pg-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $base | Out-Null
$data = Join-Path $base 'data'
$pwFile = Join-Path $base 'init-pw.tmp'
$randomPassword = [Convert]::ToBase64String(
  [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(30)
).Replace('+', 'A').Replace('/', 'B')
[IO.File]::WriteAllText($pwFile, $randomPassword + [Environment]::NewLine,
  (New-Object Text.UTF8Encoding($false)))
$started = $false

try {
  & (Join-Path $PostgresBin 'initdb.exe') -D $data -U stage6_test --no-instructions --encoding=UTF8 --locale=C --auth-host=scram-sha-256 --auth-local=scram-sha-256 --pwfile=$pwFile *> (Join-Path $base 'initdb.log')
  if ($LASTEXITCODE -ne 0) { throw 'Isolated initdb failed' }
  Remove-Item -LiteralPath $pwFile -Force

  $tcp = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $tcp.Start()
  $port = ([Net.IPEndPoint]$tcp.LocalEndpoint).Port
  $tcp.Stop()
  $log = Join-Path $base 'postgres.log'
  $argsForPgCtl = @(
    '-D', ('"' + $data + '"'),
    '-l', ('"' + $log + '"'),
    '-o', ('"-h 127.0.0.1 -p ' + $port + ' -c max_connections=30"'),
    '-w', '-t', '20', 'start'
  )
  Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList $argsForPgCtl -PassThru -RedirectStandardOutput (Join-Path $base 'startup.stdout') -RedirectStandardError (Join-Path $base 'startup.stderr') | Out-Null

  for ($i = 0; $i -lt 100; $i++) {
    & (Join-Path $PostgresBin 'pg_isready.exe') -h 127.0.0.1 -p $port -U stage6_test -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $started = $true; break }
    Start-Sleep -Milliseconds 200
  }
  if (!$started) {
    Get-Content -LiteralPath (Join-Path $base 'startup.stderr') -ErrorAction SilentlyContinue
    Get-Content -LiteralPath $log -Tail 10 -ErrorAction SilentlyContinue
    throw 'Isolated PostgreSQL failed to become ready'
  }

  $env:FLEXIKIT_STAGE6_TEMP_PG = 'isolated-test-only'
  $env:FLEXIKIT_STAGE6_PG_DATA = $data
  $env:FLEXIKIT_STAGE6_PG_PORT = [string]$port
  $env:FLEXIKIT_STAGE6_PG_PASSWORD = $randomPassword

  Push-Location $backendPath
  try {
    node scripts/stage6-extension-pair-postgres-isolated.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL test assertions failed' }
  } finally { Pop-Location }
} finally {
  Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue
  foreach ($name in @('FLEXIKIT_STAGE6_TEMP_PG', 'FLEXIKIT_STAGE6_PG_DATA',
                      'FLEXIKIT_STAGE6_PG_PORT', 'FLEXIKIT_STAGE6_PG_PASSWORD')) {
    Remove-Item -Path ('Env:' + $name) -ErrorAction SilentlyContinue
  }
  $pidFile = Join-Path $data 'postmaster.pid'
  if ($started -or (Test-Path -LiteralPath $pidFile)) {
    & (Join-Path $PostgresBin 'pg_ctl.exe') -D $data -m fast -w -t 15 stop *> (Join-Path $base 'shutdown.log')
  }
  if ((Split-Path $base -Leaf) -match '^flexikit-stage6-pg-[0-9a-f]{32}$') {
    $alive = $false
    if (Test-Path -LiteralPath $pidFile) {
      $clusterPid = (Get-Content -LiteralPath $pidFile -TotalCount 1).Trim()
      $process = Get-Process -Id $clusterPid -ErrorAction SilentlyContinue
      $alive = $null -ne $process -and $process.ProcessName -eq 'postgres'
    }
    if (!$alive) {
      Remove-Item -LiteralPath $base -Force -Recurse
      Write-Output 'ISOLATED_POSTGRES_CLEANUP=PASS'
    } else {
      Write-Warning 'Isolated postgres is still running; temporary directory retained'
    }
  }
}
