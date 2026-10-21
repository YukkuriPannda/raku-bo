$ErrorActionPreference = 'Stop'

$sdk = 'C:\Users\Pannda\AppData\Local\Android\Sdk'
$jdk = 'C:\Program Files\Android\Android Studio\jbr'
$buildTools = Join-Path $sdk 'build-tools\36.0.0'
$androidJar = Join-Path $sdk 'platforms\android-36\android.jar'
$aapt = Join-Path $buildTools 'aapt.exe'
$d8 = Join-Path $buildTools 'd8.bat'
$apksigner = Join-Path $buildTools 'apksigner.bat'
$javac = Join-Path $jdk 'bin\javac.exe'
$jar = Join-Path $jdk 'bin\jar.exe'
$keystore = Join-Path (Join-Path $PSScriptRoot '..\..\..') 'mobile\android\app\debug.keystore'
$keystore = [IO.Path]::GetFullPath($keystore)
$buildRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'build'))
$ownedRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'

foreach ($path in @($androidJar, $aapt, $d8, $apksigner, $javac, $jar, $keystore)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required Android build file is missing: $path"
    }
}
if (-not $buildRoot.StartsWith($ownedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output escaped the owned probe directory: $buildRoot"
}

$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk 'bin') + [IO.Path]::PathSeparator + $env:PATH

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}
$classesDir = Join-Path $buildRoot 'classes'
$dexDir = Join-Path $buildRoot 'dex'
$unsignedApk = Join-Path $buildRoot 'transition-probe-unsigned.apk'
$signedApk = Join-Path $buildRoot 'transition-probe.apk'
New-Item -ItemType Directory -Path $classesDir, $dexDir -Force | Out-Null

$javaFiles = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Filter '*.java' -Recurse | ForEach-Object FullName)
if ($javaFiles.Count -eq 0) {
    throw 'No Java probe sources found.'
}

& $javac -source 8 -target 8 -classpath $androidJar -d $classesDir @javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }

$classFiles = @(Get-ChildItem -LiteralPath $classesDir -Filter '*.class' -Recurse | ForEach-Object FullName)
& $d8 --lib $androidJar --min-api 23 --output $dexDir @classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed with exit code $LASTEXITCODE" }

& $aapt package -f -M (Join-Path $PSScriptRoot 'AndroidManifest.xml') -I $androidJar -F $unsignedApk
if ($LASTEXITCODE -ne 0) { throw "aapt failed with exit code $LASTEXITCODE" }

& $jar uf $unsignedApk -C $dexDir 'classes.dex'
if ($LASTEXITCODE -ne 0) { throw "jar failed with exit code $LASTEXITCODE" }

& $apksigner sign --ks $keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $signedApk $unsignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed with exit code $LASTEXITCODE" }

& $apksigner verify --verbose $signedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed with exit code $LASTEXITCODE" }

Write-Output "Built and signed: $signedApk"
