param([int]$Port = 8080, [string]$BindAddress = '127.0.0.1')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path build/squelch-java.jar)) { & ./build.ps1 }
    $java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { 'java' }
    & $java -jar build/squelch-java.jar $Port $BindAddress
    if ($LASTEXITCODE -ne 0) { throw 'Squelch exited with an error.' }
} finally { Pop-Location }
