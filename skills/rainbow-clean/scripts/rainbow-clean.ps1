param(
    [switch]$Apply,
    [switch]$DryRun,
    [ValidateRange(0,3650)][int]$CodexOlderThanDays = 3,
    [ValidateRange(0,3650)][int]$LogOlderThanDays = 14,
    [ValidateRange(1,3650)][int]$DriveOlderThanDays = 30,
    [string]$ReportPath = (Join-Path (Get-Location) ("rainbow-clean-report-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Apply -and $DryRun) { throw 'Choose either -Apply or -DryRun, not both.' }
$doDelete = [bool]$Apply
$nowUtc = [DateTime]::UtcNow
$codexCutoff = $nowUtc.AddDays(-$CodexOlderThanDays)
$logCutoff = $nowUtc.AddDays(-$LogOlderThanDays)
$driveCutoff = $nowUtc.AddDays(-$DriveOlderThanDays)
$userProfile = $env:USERPROFILE
$local = $env:LOCALAPPDATA

# ContentsAll removes children while preserving the root directory.
# ContentsOlder removes only files older than the target cutoff, then empty directories.
$targets = @(
    [pscustomobject]@{Path='C:\tmp'; Mode='ContentsAll'; Cutoff=$null; Reason='C:\tmp temporary files'},
    [pscustomobject]@{Path='C:\temp'; Mode='ContentsAll'; Cutoff=$null; Reason='C:\temp temporary files'},
    [pscustomobject]@{Path='C:\Windows\Temp'; Mode='ContentsAll'; Cutoff=$null; Reason='Windows temporary files'},
    [pscustomobject]@{Path=(Join-Path $local 'Temp'); Mode='ContentsAll'; Cutoff=$null; Reason='user AppData Local Temp'},
    [pscustomobject]@{Path=(Join-Path $local 'NVIDIA\DXCache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable NVIDIA DirectX cache'},
    [pscustomobject]@{Path=(Join-Path $local 'NVIDIA\GLCache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable NVIDIA OpenGL cache'},
    [pscustomobject]@{Path=(Join-Path $local 'D3DSCache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable Direct3D shader cache'},
    [pscustomobject]@{Path=(Join-Path $local 'pip\Cache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable pip package cache'},
    [pscustomobject]@{Path=(Join-Path $local 'npm-cache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable npm package cache'},
    [pscustomobject]@{Path=(Join-Path $local 'CrashDumps'); Mode='ContentsAll'; Cutoff=$null; Reason='old application crash dumps'},
    [pscustomobject]@{Path=(Join-Path $local 'SquirrelTemp'); Mode='ContentsAll'; Cutoff=$null; Reason='installer update temporary files'},
    [pscustomobject]@{Path=(Join-Path $local 'electron\Cache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable Electron cache'},
    [pscustomobject]@{Path=(Join-Path $local 'electron-builder\Cache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable Electron builder cache'},
    [pscustomobject]@{Path=(Join-Path $userProfile '.codex\render-cache'); Mode='ContentsAll'; Cutoff=$null; Reason='rebuildable Codex render cache'},
    [pscustomobject]@{Path=(Join-Path $local 'Codex\Logs'); Mode='ContentsOlder'; Cutoff=$logCutoff; Reason="Codex logs older than $LogOlderThanDays days"}
    ,[pscustomobject]@{Path='D:\QQMusicCache'; Mode='ContentsOlder'; Cutoff=$driveCutoff; Reason="D: QQMusic rebuildable cache older than $DriveOlderThanDays days"}
)

function Assert-SafePath([string]$Path, [string]$Root) {
    $full = [IO.Path]::GetFullPath($Path)
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $driveRoot = [IO.Path]::GetPathRoot($base)
    if (-not $full.StartsWith($driveRoot, [StringComparison]::OrdinalIgnoreCase) -or
        ($full -ne $base -and -not $full.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase))) {
        throw "Path outside intended C: cache root: $Path"
    }
    $cursor = $full
    while ($cursor) {
        $attributes = [IO.File]::GetAttributes($cursor)
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $cursor" }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}

# Future runs retain recent temp files and all application runtime binaries.
foreach ($target in $targets) {
    if ($target.Path -match '(?i)^(C:\\tmp|C:\\temp|C:\\Windows\\Temp|.*\\AppData\\Local\\Temp|.*\\SquirrelTemp)$') {
        $target.Mode = 'ContentsOlder'
        $target.Cutoff = $nowUtc.AddDays(-1)
    }
}
# Only known disposable git staging trees qualify; custom Codex tmp projects stay intact.
$staging = Join-Path $userProfile '.codex\.tmp'
if (Test-Path -LiteralPath $staging -PathType Container) {
    Assert-SafePath $staging $staging
    foreach ($entry in (Get-ChildItem -LiteralPath $staging -Directory -Force)) {
        if ($entry.Name -match '^git-[a-zA-Z0-9]+$' -and
            -not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -and
            $entry.LastWriteTimeUtc -lt $codexCutoff -and $entry.CreationTimeUtc -lt $codexCutoff) {
            $targets += [pscustomobject]@{Path=$entry.FullName; Mode='WholeOldTree'; Cutoff=$codexCutoff; Reason='inactive Codex git staging tree'}
        }
    }
}

function Get-TreeItems([string]$Root) {
    $files = [Collections.Generic.List[object]]::new()
    $dirs = [Collections.Generic.List[object]]::new()
    $stack = [Collections.Generic.Stack[string]]::new()
    $stack.Push($Root)
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { Assert-SafePath $dir $Root; $items = ([IO.DirectoryInfo]::new($dir)).GetFileSystemInfos() }
        catch { throw "Unable to safely scan $dir : $($_.Exception.Message)" }
        foreach ($item in $items) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            if ($item -is [IO.DirectoryInfo]) { $dirs.Add($item); $stack.Push($item.FullName) }
            else { $files.Add($item) }
        }
    }
    [pscustomobject]@{Files=$files; Dirs=$dirs}
}

function Get-FreeBytes([string]$Drive) { try { return [long]((Get-PSDrive -Name $Drive).Free) } catch { return 0L } }
$freeBeforeC = Get-FreeBytes 'C'
$freeBeforeD = Get-FreeBytes 'D'
$summary = [Collections.Generic.List[object]]::new()
$totalCandidates = 0L
$totalCandidateBytes = 0L
$totalDeleted = 0L
$totalDeletedBytes = 0L
$totalFailed = 0L
$failureDetails = [Collections.Generic.List[object]]::new()

foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target.Path -PathType Container)) { continue }
    try {
        Assert-SafePath $target.Path $target.Path
        $tree = Get-TreeItems -Root $target.Path
    } catch {
        $totalFailed++
        if ($failureDetails.Count -lt 200) { $failureDetails.Add([pscustomobject]@{Path=$target.Path; Error=$_.Exception.Message}) }
        continue
    }
    $files = @($tree.Files)
    $dirs = @($tree.Dirs)
    if ($target.Mode -eq 'WholeOldTree') {
        $recent = @(@($files) + @($dirs) | Where-Object { $_.LastWriteTimeUtc -ge $target.Cutoff -or $_.CreationTimeUtc -ge $target.Cutoff })
        if ($recent.Count -gt 0) { continue }
    }
    if ($target.Mode -eq 'ContentsOlder') {
        $files = @($files | Where-Object { $_.LastWriteTimeUtc -lt $target.Cutoff -and $_.CreationTimeUtc -lt $target.Cutoff })
    }
    $measure = $files | Measure-Object -Property Length -Sum
    $candidateBytes = if ($null -eq $measure) { 0L } else { [long]$measure.Sum }
    $candidateCount = [long]$files.Count
    $deleted = 0L; $deletedBytes = 0L; $failed = 0L
    if ($doDelete -and $candidateCount -gt 0) {
        Write-Output ("Cleaning: {0} ({1:N3} GiB)" -f $target.Path, ($candidateBytes/1GB))
        $writeBlocked = $false
        try {
            $probe = Join-Path $target.Path ('.rainbow-clean-write-test-' + [Guid]::NewGuid().ToString('N'))
            [IO.File]::Open($probe, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write).Dispose()
            Remove-Item -LiteralPath $probe -Force -ErrorAction Stop
        } catch {
            $writeBlocked = $true
            $failed++
            if ($failureDetails.Count -lt 200) { $failureDetails.Add([pscustomobject]@{Path=$target.Path; Error=('Target is not writable; skipped without changing ACL: ' + $_.Exception.Message)}) }
        }
        if (-not $writeBlocked) { foreach ($file in $files) {
            try {
                Assert-SafePath $file.FullName $target.Path
                $file.Refresh()
                if ($target.Cutoff -and ($file.LastWriteTimeUtc -ge $target.Cutoff -or $file.CreationTimeUtc -ge $target.Cutoff)) { continue }
                $size = [long]$file.Length
                Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop
                $deleted++; $deletedBytes += $size
            }
            catch {
                $failed++
                if ($failureDetails.Count -lt 200) { $failureDetails.Add([pscustomobject]@{Path=$file.FullName; Error=$_.Exception.Message}) }
            }
        }
        # Remove only empty child directories, deepest first. This avoids deleting
        # folders that still contain a newer or locked file.
        foreach ($dir in ($dirs | Sort-Object { $_.FullName.Length } -Descending)) {
            if ($target.Mode -eq 'ContentsOlder' -and $dir.LastWriteTimeUtc -ge $target.Cutoff) { continue }
            try {
                Assert-SafePath $dir.FullName $target.Path
                if (@(([IO.DirectoryInfo]::new($dir.FullName)).GetFileSystemInfos()).Count -eq 0) { Remove-Item -LiteralPath $dir.FullName -Force -ErrorAction Stop }
            } catch {
                $failed++
                if ($failureDetails.Count -lt 200) { $failureDetails.Add([pscustomobject]@{Path=$dir.FullName; Error=$_.Exception.Message}) }
            }
        }
        }
    }
    $totalCandidates += $candidateCount
    $totalCandidateBytes += $candidateBytes
    $totalDeleted += $deleted
    $totalDeletedBytes += $deletedBytes
    $totalFailed += $failed
    $summary.Add([pscustomobject]@{Path=$target.Path; Reason=$target.Reason; Mode=$target.Mode; CandidateFiles=$candidateCount; CandidateGiB=[math]::Round($candidateBytes/1GB,3); DeletedFiles=$deleted; DeletedGiB=[math]::Round($deletedBytes/1GB,3); Failed=$failed})
}

$report = [pscustomobject]@{
    Timestamp=(Get-Date).ToString('o'); Apply=$doDelete; CodexOlderThanDays=$CodexOlderThanDays; LogOlderThanDays=$LogOlderThanDays; DriveOlderThanDays=$DriveOlderThanDays;
    FreeBeforeCGiB=[math]::Round($freeBeforeC/1GB,3); FreeAfterCGiB=[math]::Round((Get-FreeBytes 'C')/1GB,3); ReclaimedCGiB=[math]::Round(((Get-FreeBytes 'C')-$freeBeforeC)/1GB,3);
    FreeBeforeDGiB=[math]::Round($freeBeforeD/1GB,3); FreeAfterDGiB=[math]::Round((Get-FreeBytes 'D')/1GB,3); ReclaimedDGiB=[math]::Round(((Get-FreeBytes 'D')-$freeBeforeD)/1GB,3);
    CandidateFiles=$totalCandidates; CandidateGiB=[math]::Round($totalCandidateBytes/1GB,3); DeletedFiles=$totalDeleted; DeletedGiB=[math]::Round($totalDeletedBytes/1GB,3); Failed=$totalFailed; FailedItems=@($failureDetails); Targets=@($summary)
}
$parent = Split-Path -Parent $ReportPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding utf8
$mode = if ($doDelete) { 'APPLIED' } else { 'DRY-RUN' }
Write-Output "rainbow-clean $mode"
Write-Output ("Candidates: {0:N0} files / {1:N3} GiB" -f $totalCandidates, ($totalCandidateBytes/1GB))
if ($doDelete) { Write-Output ("Deleted:   {0:N0} files / {1:N3} GiB" -f $totalDeleted, ($totalDeletedBytes/1GB)) }
Write-Output ("C: free:   {0:N3} -> {1:N3} GiB" -f ($freeBeforeC/1GB), ((Get-FreeBytes 'C')/1GB))
Write-Output ("D: free:   {0:N3} -> {1:N3} GiB" -f ($freeBeforeD/1GB), ((Get-FreeBytes 'D')/1GB))
Write-Output ("Skipped/failed items: {0:N0}" -f $totalFailed)
Write-Output "Report: $ReportPath"
$summary | Where-Object { $_.CandidateFiles -gt 0 } | Format-Table Path,CandidateGiB,DeletedGiB,Failed,Reason -AutoSize
