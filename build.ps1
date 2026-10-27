param([switch]$Test)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $javac = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/javac.exe' } else { 'javac' }
    $java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { 'java' }
    $jar = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/jar.exe' } else { 'jar' }
    New-Item -ItemType Directory -Force build/classes | Out-Null
    $sources = @(Get-ChildItem src/main/java -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
    & $javac --release 17 -encoding UTF-8 -d build/classes @sources
    if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed. Install JDK 17 or later.' }
    Copy-Item src/main/resources/* build/classes -Recurse -Force
    & $jar --create --file build/squelch-java.jar --main-class squelch.App -C build/classes .
    if ($LASTEXITCODE -ne 0) { throw 'JAR packaging failed.' }
    if ($Test) {
        New-Item -ItemType Directory -Force build/test-classes | Out-Null
        $tests = @(Get-ChildItem src/test/java -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
        & $javac --release 17 -encoding UTF-8 -cp build/classes -d build/test-classes @tests
        if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
        & $java -cp 'build/classes;build/test-classes;src/test/resources' squelch.Tests
        if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
    }
    Write-Host 'Ready: build/squelch-java.jar'
} finally { Pop-Location }
