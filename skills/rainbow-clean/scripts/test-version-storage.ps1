$ErrorActionPreference='Stop'
$fixture=Join-Path $env:TEMP ('rainbow-storage-test-'+[guid]::NewGuid().ToString('N'))
$root=Join-Path $fixture 'video_project'
New-Item -ItemType Directory -Path (Join-Path $fixture 'work') -Force | Out-Null
foreach ($name in @('topic_v01','topic_v02','topic_v03','topic_v04','inactive','donor','consumer','recent')) {
    $p=Join-Path $root $name
    New-Item -ItemType Directory -Path $p -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $p 'source.ts'),'fixture')
}
foreach ($name in @('inactive','donor','recent')) {
    $p=Join-Path $root $name
    [IO.File]::WriteAllText((Join-Path $p 'package.json'),'{}')
    [IO.File]::WriteAllText((Join-Path $p 'package-lock.json'),'{"lockfileVersion":3,"packages":{}}')
    New-Item -ItemType Directory -Path (Join-Path $p 'node_modules') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $p 'node_modules\data.js'),('x'*2048))
}
foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File) {
    [IO.File]::SetCreationTimeUtc($file.FullName,[datetime]::UtcNow.AddDays(-10))
    [IO.File]::SetLastWriteTimeUtc($file.FullName,[datetime]::UtcNow.AddDays(-10))
}
[IO.File]::SetLastWriteTimeUtc((Join-Path $root 'topic_v02\source.ts'),[datetime]::UtcNow)
[IO.File]::SetLastWriteTimeUtc((Join-Path $root 'recent\source.ts'),[datetime]::UtcNow)
New-Item -ItemType Junction -Path (Join-Path $root 'consumer\node_modules') -Target (Join-Path $root 'donor\node_modules') | Out-Null
$script=Join-Path $PSScriptRoot 'organize-version-storage.ps1'
$scan=Join-Path $fixture 'work\scan.json'
& $script -ProjectPath $fixture -ReportPath $scan | Out-Null
$r=Get-Content -LiteralPath $scan -Raw | ConvertFrom-Json
if ($r.actions.Count -ne 2) {throw 'Expected old v1 archive and independent dependency cleanup only'}
& $script -ProjectPath $fixture -Apply -ReviewedManifest $scan -ReportPath (Join-Path $fixture 'work\apply.json') | Out-Null
$r=Get-Content -LiteralPath (Join-Path $fixture 'work\apply.json') -Raw | ConvertFrom-Json
if (@($r.results | Where-Object status -eq 'skipped-or-failed').Count) {throw ($r.results | ConvertTo-Json -Depth 5)}
if (-not (Test-Path -LiteralPath (Join-Path $root '_history\topic\topic_v01\source.ts'))) {throw 'Archive missing'}
if (-not ((Get-Item -LiteralPath (Join-Path $root 'topic_v01')).Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Compatibility junction missing'}
if (Test-Path -LiteralPath (Join-Path $root 'inactive\node_modules\data.js')) {throw 'Eligible dependency survived'}
foreach ($name in @('donor','recent')) {if (-not (Test-Path -LiteralPath (Join-Path $root "$name\node_modules\data.js"))) {throw 'Protected dependency deleted'}}
Write-Output "PASS: recent projects, newest two versions, incoming junction donor protection, archive compatibility, scoped dependency removal. Fixture: $fixture"
