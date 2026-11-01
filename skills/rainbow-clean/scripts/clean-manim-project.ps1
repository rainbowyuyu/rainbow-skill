param(
    [string]$ProjectPath = 'D:\projects\manim_extend_rainbow',
    [switch]$Apply,
    [switch]$DryRun,
    [string]$ReviewedManifest,
    [ValidateRange(1,3650)][int]$IntermediateOlderThanDays = 3,
    [string]$ReportPath = (Join-Path (Get-Location) ("rainbow-manim-clean-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Apply -and $DryRun) { throw 'Choose either -Apply or -DryRun, not both.' }
if ($Apply -and -not $ReviewedManifest) { throw 'Apply requires -ReviewedManifest pointing to a reviewed dry-run JSON report.' }
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "Project path does not exist: $ProjectPath" }
$projectRoot = [IO.Path]::GetFullPath($ProjectPath).TrimEnd('\')
$videoRoot = Join-Path $projectRoot 'video_project'
if (-not (Test-Path -LiteralPath $videoRoot -PathType Container)) { throw "video_project does not exist: $videoRoot" }
$cutoff = [DateTime]::UtcNow.AddDays(-$IntermediateOlderThanDays)
$doDelete = [bool]$Apply
# Whole-project protection takes precedence over file age. Refresh on every scan/apply.
$protectionPath=$ReportPath+'.project-protection.json'
$protectionParent=Split-Path -Parent $protectionPath
if ($protectionParent) {New-Item -ItemType Directory -Path $protectionParent -Force | Out-Null}
& python (Join-Path $PSScriptRoot 'plan-version-storage.py') --root $videoRoot --days 3 --report $protectionPath | Out-Null
if ($LASTEXITCODE -ne 0) {throw 'Project protection scan failed; no video deletion allowed'}
$protection=Get-Content -LiteralPath $protectionPath -Raw | ConvertFrom-Json
$protectedNames=@($protection.projects | Where-Object protected | ForEach-Object name)
$activeProcesses=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(node|python|ffmpeg|blender|chrome|chrome-headless-shell)\.exe$'})
foreach ($project in $protection.projects) {
    if (@($activeProcesses | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($project.name,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count) {$protectedNames+=$project.name}
}

function Assert-SafePath([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside project root: $Path" }
    $cursor = $full
    while ($cursor) {
        $attributes = [IO.File]::GetAttributes($cursor)
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $cursor" }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

function Test-Protected([string]$Path) {
    $rel=$Path.Substring($videoRoot.Length).TrimStart('\')
    if (($rel -split '\\')[0] -in $protectedNames) {return $true}
    return $Path -match '(?i)(?:^|\\)(?:publish|_catalog|_history|rainbow_arc_2026_v16|public|assets|originals|generated|audio|images|models|archive|archives|source|src|node_modules|\.git|\.venv[^\\]*|\.vendor|__pycache__|qwen[^\\]*)(?:\\|$)'
}

function Get-SafeVideos([string]$Root) {
    Assert-SafePath $Root
    foreach ($entry in ([IO.DirectoryInfo]::new($Root)).GetFileSystemInfos()) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Test-Protected $entry.FullName)) { continue }
        if ($entry -is [IO.DirectoryInfo]) { Get-SafeVideos $entry.FullName }
        elseif ($entry.Extension -ieq '.mp4') { $entry }
    }
}

function Get-VideoShape([string]$Path) {
    Assert-SafePath $Path
    $raw = & 'C:\ffmpeg\bin\ffprobe.exe' -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of json $Path 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Video validation failed: $Path" }
    $info = ($raw -join "`n") | ConvertFrom-Json
    if (@($info.streams).Count -ne 1 -or [double]$info.format.duration -le 0) { throw "No valid video stream: $Path" }
    return "$($info.streams[0].width)x$($info.streams[0].height)"
}

$files = @(Get-SafeVideos $videoRoot)
$candidates = [Collections.Generic.List[object]]::new()
$excluded = [Collections.Generic.List[object]]::new()

# Intermediate files: only work trees and QA research trees, and only after the age cutoff.
foreach ($file in $files) {
    $rel = $file.FullName.Substring($projectRoot.Length + 1)
    $isWork = $rel -match '(?i)\\work\\(?:[^\\]+\\)*(?:qa(?:-[^\\]+)?|scene-qa|media-qa-smoke)\\'
    $isQa = $rel -match '(?i)\\research\\qa-[^\\]+\\'
    $isCurrentRainbow = $rel -match '(?i)\\rainbow_arc_2026_v16\\'
    if (($isWork -or $isQa) -and -not $isCurrentRainbow -and $file.LastWriteTimeUtc -lt $cutoff -and $file.CreationTimeUtc -lt $cutoff) {
        $candidates.Add([pscustomobject]@{Path=$file.FullName; RelativePath=$rel; Kind='old-intermediate'; Reason="explicit QA MP4 older than $IntermediateOlderThanDays days; review source references before apply"; Size=$file.Length; LastWrite=$file.LastWriteTimeUtc; Creation=$file.CreationTimeUtc; Replacement=$null})
    }
}

# Match version tokens in the filename only, within the exact same delivery directory.
# Keep the newest two versions; different subjects, aspect labels and folders never merge.
$deliveries = @($files | Where-Object { $_.FullName -match '(?i)\\delivery\\' })
$deliveryRows = foreach ($file in $deliveries) {
    $rel = $file.FullName.Substring($projectRoot.Length + 1)
    $matchesVersion = [regex]::Matches($file.BaseName, '(?i)(?<![a-z0-9])v(\d+)(?=$|[_ .-])')
    if ($matchesVersion.Count -eq 1) {
        $match = $matchesVersion[0]
        $title = $file.BaseName.Remove($match.Index, $match.Length).Insert($match.Index, '{version}')
        [pscustomobject]@{File=$file; RelativePath=$rel; Family=($file.DirectoryName + '\' + $title).ToLowerInvariant(); Version=[int]$match.Groups[1].Value}
    }
}
foreach ($group in ($deliveryRows | Group-Object Family)) {
    $versions = @($group.Group.Version | Sort-Object -Unique -Descending)
    if ($versions.Count -lt 3) { continue }
    $retainFrom = $versions[1]
    $latest = $group.Group | Sort-Object Version -Descending | Select-Object -First 1
    foreach ($row in $group.Group) {
        $file = $row.File
        $isCurrentRainbow = $row.RelativePath -match '(?i)\\rainbow_arc_2026_v16\\'
        if ($row.Version -lt $retainFrom -and -not $isCurrentRainbow -and $file.LastWriteTimeUtc -lt $cutoff -and $file.CreationTimeUtc -lt $cutoff) {
            if ((Get-VideoShape $file.FullName) -ne (Get-VideoShape $latest.File.FullName)) { continue }
            $candidates.Add([pscustomobject]@{Path=$file.FullName; RelativePath=$row.RelativePath; Kind='historical-delivery'; Reason="same-title delivery v$($row.Version); keep newest two versions"; Size=$file.Length; LastWrite=$file.LastWriteTimeUtc; Creation=$file.CreationTimeUtc; Replacement=$latest.File.FullName})
        }
    }
}

# De-duplicate when a file matches both rules.
$unique = @($candidates | Group-Object Path | ForEach-Object { $_.Group | Select-Object -First 1 })
$totalBytes = 0L
foreach ($item in $unique) { $totalBytes += [long]$item.Size }
$deleted = 0L; $deletedBytes = 0L; $failed = [Collections.Generic.List[object]]::new()
$deletedItems = [Collections.Generic.List[object]]::new()
if ($doDelete) {
    $review = Get-Content -LiteralPath $ReviewedManifest -Raw | ConvertFrom-Json
    if ($review.Apply -or $review.ProjectPath -ne $projectRoot) { throw 'Expected a dry-run manifest for this project.' }
    $approved = @{}
    foreach ($row in $review.Candidates) { $approved[$row.Path] = $row }
    foreach ($item in $unique) {
        if (-not $approved.ContainsKey($item.Path)) { continue }
        try {
            Assert-SafePath $item.Path
            $old = $approved[$item.Path]
            $current = Get-Item -LiteralPath $item.Path -Force
            if ($current.Length -ne $old.Size -or $current.LastWriteTimeUtc -ne ([datetime]$old.LastWrite).ToUniversalTime() -or $current.CreationTimeUtc -ne ([datetime]$old.Creation).ToUniversalTime()) { throw 'File changed since reviewed scan; preserved.' }
            if ($current.LastWriteTimeUtc -ge $cutoff -or $current.CreationTimeUtc -ge $cutoff -or (Test-Protected $item.Path)) { throw 'Retention/protection check failed; preserved.' }
            if ($item.Replacement) {
                if ($item.Replacement -ne $old.Replacement -or (Get-VideoShape $item.Path) -ne (Get-VideoShape $item.Replacement)) { throw 'Replacement changed or invalid; preserved.' }
            }
            Remove-Item -LiteralPath $item.Path -Force -ErrorAction Stop
            $deleted++; $deletedBytes += [long]$item.Size
            $deletedItems.Add($item)
        } catch {
            $failed.Add([pscustomobject]@{Path=$item.Path; Error=$_.Exception.Message})
        }
    }
}
$report = [pscustomobject]@{
    Timestamp=(Get-Date).ToString('o'); Apply=$doDelete; ProjectPath=$projectRoot; IntermediateOlderThanDays=$IntermediateOlderThanDays;
    CandidateFiles=$unique.Count; CandidateGiB=[math]::Round($totalBytes/1GB,3); DeletedFiles=$deleted; DeletedGiB=[math]::Round($deletedBytes/1GB,3); Failed=$failed.Count;
    ByKind=@($unique | Group-Object Kind | ForEach-Object {[pscustomobject]@{Kind=$_.Name;Files=$_.Count;GiB=[math]::Round((($_.Group|Measure-Object Size -Sum).Sum)/1GB,3)}});
    Candidates=@($unique | Sort-Object Size -Descending | Select-Object Path,RelativePath,Kind,Reason,Size,@{n='GiB';e={[math]::Round($_.Size/1GB,4)}},LastWrite,Creation,Replacement);
    FailedItems=@($failed)
    DeletedItems=@($deletedItems)
}
$parent=Split-Path -Parent $ReportPath;if($parent -and -not(Test-Path $parent)){New-Item -ItemType Directory -Force -Path $parent|Out-Null}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding utf8
Write-Output ("rainbow-manim-clean {0}" -f ($(if($doDelete){'APPLIED'}else{'DRY-RUN'})))
Write-Output ("Candidates: {0:N0} files / {1:N3} GiB" -f $unique.Count,($totalBytes/1GB))
if($doDelete){Write-Output ("Deleted:   {0:N0} files / {1:N3} GiB" -f $deleted,($deletedBytes/1GB))}
Write-Output ("Failed:    {0:N0}" -f $failed.Count)
Write-Output "Report: $ReportPath"
$report.ByKind | Format-Table -AutoSize
$unique | Sort-Object Size -Descending | Select-Object -First 30 RelativePath,Kind,@{n='GiB';e={[math]::Round($_.Size/1GB,4)}},LastWrite | Format-Table -AutoSize
