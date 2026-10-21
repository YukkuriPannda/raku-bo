#Requires -Version 7.0
param(
    [int]$Pr,
    [string]$Target = $env:RAKUBO_TAILDROP_TARGET,
    [switch]$SelfCheck
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-Checked([string]$Program, [string[]]$Arguments, [switch]$Capture) {
    if ($Capture) { $output = & $Program @Arguments }
    else { & $Program @Arguments | Out-Host }
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)" }
    if ($Capture) { return ($output -join "`n") }
}

function Assert-Pr($Info, [string]$Branch, [string]$Revision) {
    if ($Info.state -ne 'OPEN' -or !$Info.isDraft -or $Info.isCrossRepository -or
        $Info.headRefName -cne $Branch -or $Info.headRefOid -cne $Revision) {
        throw 'Open draft PR in this repository with the same branch and pushed HEAD required.'
    }
}

function Find-Target($Status, [string]$Name) {
    if (!$Name -or $Name -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*$') {
        throw 'Specify a Taildrop hostname or IPv4 address with -Target or RAKUBO_TAILDROP_TARGET.'
    }
    if ($Status.BackendState -ne 'Running') { throw 'Tailscale is not running.' }
    $peers = @($Status.Peer.PSObject.Properties.Value | Where-Object {
        $_.HostName -ieq $Name -or ([string]$_.DNSName).TrimEnd('.') -ieq $Name.TrimEnd('.') -or
        $_.TailscaleIPs -contains $Name
    })
    if (!$Status.Self.UserID -or $peers.Count -ne 1 -or !$peers[0].Online -or $peers[0].UserID -ne $Status.Self.UserID) {
        throw 'Exactly one online device belonging to the current Tailscale user required.'
    }
    return $peers[0].TailscaleIPs[0]
}

if ($SelfCheck) {
    $info = [pscustomobject]@{ state='OPEN'; isDraft=$true; isCrossRepository=$false; headRefName='fix/example'; headRefOid='abc' }
    Assert-Pr $info 'fix/example' 'abc'
    foreach ($field in @('state', 'isDraft', 'isCrossRepository', 'headRefName', 'headRefOid')) {
        $bad = $info.PSObject.Copy()
        $bad.$field = switch ($field) { state {'CLOSED'} isDraft {$false} isCrossRepository {$true} default {'different'} }
        $rejected = $false
        try { Assert-Pr $bad 'fix/example' 'abc' } catch { $rejected = $true }
        if (!$rejected) { throw "PR guard missed $field" }
    }
    $peer = [pscustomobject]@{ HostName='phone'; DNSName='phone.example.ts.net.'; TailscaleIPs=@('100.64.0.2'); Online=$true; UserID=1 }
    $status = [pscustomobject]@{ BackendState='Running'; Self=@{UserID=1}; Peer=[pscustomobject]@{key=$peer} }
    foreach ($name in @('phone', 'phone.example.ts.net', '100.64.0.2')) {
        if ((Find-Target $status $name) -ne '100.64.0.2') { throw 'Target selection failed' }
    }
    foreach ($name in @('', 'unknown', 'phone;command')) {
        $rejected = $false
        try { Find-Target $status $name | Out-Null } catch { $rejected = $true }
        if (!$rejected) { throw "Target guard missed $name" }
    }
    $peer.Online = $false
    try { Find-Target $status 'phone' | Out-Null; throw 'Offline target accepted' }
    catch { if ($_.Exception.Message -eq 'Offline target accepted') { throw } }
    $peer.Online = $true; $peer.UserID = 2
    try { Find-Target $status 'phone' | Out-Null; throw 'Other user accepted' }
    catch { if ($_.Exception.Message -eq 'Other user accepted') { throw } }
    Write-Host 'PR and Taildrop preflight self-check passed (no build, send, or PR changes).'
    exit 0
}

if ($Pr -lt 1) { throw 'Use -Pr <number> -Target <device>.' }
$mobile = Split-Path $PSScriptRoot -Parent
$repo = Split-Path $mobile -Parent
Push-Location $repo
try {
    $revision = Invoke-Checked git @('rev-parse', 'HEAD') -Capture
    $branch = Invoke-Checked git @('branch', '--show-current') -Capture
    if (!$branch -or $branch -in @('main', 'develop')) { throw 'Use the PR working branch.' }
    function Assert-Unchanged {
        if ((Invoke-Checked git @('rev-parse', 'HEAD') -Capture) -cne $revision -or
            (Invoke-Checked git @('branch', '--show-current') -Capture) -cne $branch -or
            (Invoke-Checked git @('status', '--porcelain', '--untracked-files=no') -Capture) -or
            (Invoke-Checked git @('ls-files', '--others', '--exclude-standard', '--', 'mobile') -Capture)) {
            throw 'HEAD changed or uncommitted source found. Commit and push before delivery.'
        }
    }
    function Read-Pr {
        return (Invoke-Checked gh @('pr', 'view', "$Pr", '--json', 'number,state,isDraft,isCrossRepository,headRefName,headRefOid,body,url') -Capture | ConvertFrom-Json)
    }
    Assert-Unchanged
    Assert-Pr (Read-Pr) $branch $revision
    $tailscale = Join-Path $env:ProgramFiles 'Tailscale/tailscale.exe'
    $destination = Find-Target (Invoke-Checked $tailscale @('status', '--json') -Capture | ConvertFrom-Json) $Target
    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk' }
    $tools = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    $signer = Join-Path $tools.FullName 'lib/apksigner.jar'
    $java = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr/bin/java.exe'
    if (!(Test-Path $java) -and $env:JAVA_HOME) { $java = Join-Path $env:JAVA_HOME 'bin/java.exe' }
    if (!(Test-Path $signer) -or !(Test-Path $java)) { throw 'JDK and Android build-tools required for signature verification.' }

    Invoke-Checked node @((Join-Path $PSScriptRoot 'build-android.mjs'), '--no-upload')
    Assert-Unchanged
    $apk = Join-Path $mobile "build/rakubo-pr-$Pr-$($revision.Substring(0,7)).apk"
    Copy-Item (Join-Path $mobile 'android/app/build/outputs/apk/release/app-release.apk') $apk
    $cert = Invoke-Checked $java @('-jar', $signer, 'verify', '--print-certs', $apk) -Capture
    $fingerprint = [regex]::Match($cert, 'SHA-256 digest:\s*([a-fA-F0-9]{64})').Groups[1].Value
    if (!$fingerprint -or $fingerprint -ieq 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c') {
        throw 'Missing certificate or public React Native debug signature.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($apk)
    try {
        $stream = $zip.GetEntry('assets/index.android.bundle').Open()
        try { $embeddedHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) }
        finally { $stream.Dispose() }
    } finally { $zip.Dispose() }
    $bundle = Join-Path $mobile 'android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle'
    if ($embeddedHash -ne (Get-FileHash $bundle -Algorithm SHA256).Hash) { throw 'APK bundle mismatch.' }
    $metadata = [ordered]@{
        Revision=$revision; File=(Split-Path $apk -Leaf); Bytes=(Get-Item $apk).Length
        Sha256=(Get-FileHash $apk -Algorithm SHA256).Hash; CertificateSha256=$fingerprint
        EmbeddedBundleMatches=$true; Target=$Target; SentAt=$null; PrUpdated=$false
    }
    $record = [IO.Path]::ChangeExtension($apk, '.build.json')
    $metadata | ConvertTo-Json | Set-Content $record -Encoding utf8
    Assert-Unchanged
    Assert-Pr (Read-Pr) $branch $revision
    $currentDestination = Find-Target (Invoke-Checked $tailscale @('status', '--json') -Capture | ConvertFrom-Json) $Target
    if ($currentDestination -ne $destination) { throw 'Taildrop target changed during build.' }
    Invoke-Checked $tailscale @('file', 'cp', $apk, "${destination}:")
    $metadata.SentAt = [DateTimeOffset]::Now.ToString('o')
    $metadata | ConvertTo-Json | Set-Content $record -Encoding utf8
    # Read the latest body after sending; keep other edits and never mark a failed send as complete.
    $info = Read-Pr
    Assert-Pr $info $branch $revision
    $body = $info.body + "`n`n## 検証用APKの自動送信 ($($metadata.SentAt))`n`n" +
        "- HEAD: $revision`n- APK: $($metadata.File) ($($metadata.Bytes) bytes)`n" +
        "- SHA-256: $($metadata.Sha256)`n- 専用署名・バンドル一致を確認済み。Metro不要、本番Worker接続。`n" +
        "- Taildrop: $Target へ送信成功（終了コード0）。受信・インストール・実機動作は本人の検証待ち。`n"
    $bodyFile = Join-Path $mobile "build/pr-$Pr-delivery-body.md"
    $body | Set-Content $bodyFile -Encoding utf8
    Invoke-Checked gh @('pr', 'edit', "$Pr", '--body-file', $bodyFile)
    $metadata.PrUpdated = $true
    $metadata | ConvertTo-Json | Set-Content $record -Encoding utf8
    Write-Host "完了: $apk → $Target / $($info.url)。実機で検証してください。"
} finally { Pop-Location }
