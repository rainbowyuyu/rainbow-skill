# Isolated regression checks: never touches the real Manim project.
$ErrorActionPreference = 'Stop'
$fixture = Join-Path $env:TEMP ('rainbow-clean-test-' + [guid]::NewGuid().ToString('N'))
$script = Join-Path $PSScriptRoot 'clean-manim-project.ps1'
$video = Join-Path $fixture 'video_project'
New-Item -ItemType Directory -Path $video -Force | Out-Null
$empty = Join-Path $fixture 'empty.json'
& $script -ProjectPath $fixture -DryRun -ReportPath $empty | Out-Null
if ((Get-Content -LiteralPath $empty -Raw | ConvertFrom-Json).CandidateFiles -ne 0) { throw 'Empty scan failed' }
$files = @(
    'example\work\scene-qa\preview.mp4',
    'example\work\scene-qa\public\original.mp4',
    'example\work\qwen-test\generated\provider.mp4',
    'rainbow_arc_2026_v16\work\scene-qa\current.mp4',
    'example\work\valuable.mp4'
)
foreach ($rel in $files) {
    $p = Join-Path $video $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $p) -Force | Out-Null
    [IO.File]::WriteAllText($p, 'fixture')
    [IO.File]::SetCreationTimeUtc($p, [datetime]::UtcNow.AddDays(-10))
    [IO.File]::SetLastWriteTimeUtc($p, [datetime]::UtcNow.AddDays(-10))
}
$scan = Join-Path $fixture 'scan.json'
& $script -ProjectPath $fixture -DryRun -ReportPath $scan | Out-Null
$r = Get-Content -LiteralPath $scan -Raw | ConvertFrom-Json
if ($r.CandidateFiles -ne 1 -or $r.Candidates[0].Path -ne (Join-Path $video $files[0])) { throw 'Protected asset exclusion failed' }
# A modified candidate must survive apply; no real user files are involved.
[IO.File]::WriteAllText((Join-Path $video $files[0]), 'changed fixture')
[IO.File]::SetLastWriteTimeUtc((Join-Path $video $files[0]), [datetime]::UtcNow.AddDays(-9))
$applied = Join-Path $fixture 'apply.json'
& $script -ProjectPath $fixture -Apply -ReviewedManifest $scan -ReportPath $applied | Out-Null
$r = Get-Content -LiteralPath $applied -Raw | ConvertFrom-Json
if ($r.DeletedFiles -ne 0 -or $r.Failed -ne 1) { throw 'Changed candidate was not preserved' }
foreach ($rel in $files) { if (-not (Test-Path -LiteralPath (Join-Path $video $rel))) { throw 'Unexpected deletion' } }
$delivery = Join-Path $video 'example\delivery'
New-Item -ItemType Directory -Path $delivery -Force | Out-Null
$sample = Join-Path $delivery 'topic_V1_16p.mp4'
& 'C:\ffmpeg\bin\ffmpeg.exe' -v error -f lavfi -i 'color=c=black:s=16x16:d=0.1' -c:v libx264 $sample
if ($LASTEXITCODE -ne 0) { throw 'Fixture video generation failed' }
foreach ($name in @('topic_V2_16p.mp4','topic_V3_16p.mp4','different_topic_V99_16p.mp4','topic_V1_vertical.mp4')) { Copy-Item -LiteralPath $sample -Destination (Join-Path $delivery $name) }
foreach ($file in Get-ChildItem -LiteralPath $delivery -File) {
    [IO.File]::SetCreationTimeUtc($file.FullName, [datetime]::UtcNow.AddDays(-10))
    [IO.File]::SetLastWriteTimeUtc($file.FullName, [datetime]::UtcNow.AddDays(-10))
}
$history = Join-Path $fixture 'history.json'
& $script -ProjectPath $fixture -DryRun -ReportPath $history | Out-Null
$r = Get-Content -LiteralPath $history -Raw | ConvertFrom-Json
$rows = @($r.Candidates | Where-Object Kind -eq 'historical-delivery')
if ($rows.Count -ne 1 -or $rows[0].Path -ne $sample -or $rows[0].Replacement -ne (Join-Path $delivery 'topic_V3_16p.mp4')) { throw 'Delivery title/aspect/version isolation failed' }
# A newly discovered eligible file must not be added to the reviewed delete set.
$unreviewed = Join-Path $video 'example\work\scene-qa\unreviewed.mp4'
[IO.File]::WriteAllText($unreviewed, 'fixture')
[IO.File]::SetCreationTimeUtc($unreviewed, [datetime]::UtcNow.AddDays(-10))
[IO.File]::SetLastWriteTimeUtc($unreviewed, [datetime]::UtcNow.AddDays(-10))
& $script -ProjectPath $fixture -Apply -ReviewedManifest $history -ReportPath $applied | Out-Null
$r = Get-Content -LiteralPath $applied -Raw | ConvertFrom-Json
if ($r.DeletedFiles -ne 2 -or $r.Failed -ne 0 -or -not (Test-Path -LiteralPath $unreviewed)) { throw 'Reviewed manifest apply failed' }
foreach ($name in @('topic_V2_16p.mp4','topic_V3_16p.mp4','different_topic_V99_16p.mp4','topic_V1_vertical.mp4')) {
    if (-not (Test-Path -LiteralPath (Join-Path $delivery $name))) { throw 'Retained delivery was deleted' }
}
Write-Output "PASS: empty scan, protected media/current version, changed and unreviewed files, title/aspect isolation, newest two versions, fixture apply. Fixture retained: $fixture"
