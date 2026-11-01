param(
    [string]$ProjectPath='D:\projects\manim_extend_rainbow',
    [ValidateRange(3,3650)][int]$InactiveDays=3,
    [switch]$Apply,
    [string]$ReviewedManifest,
    [string]$ReportPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $ProjectPath 'video_project')).TrimEnd('\')
if (-not $ReportPath) { $ReportPath=Join-Path $ProjectPath ('work\version-storage-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json') }
function Assert-Local([string]$Path,[bool]$AllowMissing=$false) {
    $full=[IO.Path]::GetFullPath($Path)
    if ($full -ne $root -and -not $full.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) {throw "Outside video root: $full"}
    $cursor=$full
    while ($cursor) {
        if ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor)) {
            if ([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) {throw "Reparse ancestor: $cursor"}
        } elseif (-not $AllowMissing) {throw "Missing path: $cursor"}
        $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
}
Assert-Local $root
if (-not $Apply) {
    & python (Join-Path $PSScriptRoot 'plan-version-storage.py') --root $root --days $InactiveDays --report $ReportPath
    if ($LASTEXITCODE -ne 0) {throw 'Inventory failed'}
    return
}
if (-not $ReviewedManifest) {throw 'Apply requires a reviewed scan manifest'}
$review=Get-Content -LiteralPath $ReviewedManifest -Raw | ConvertFrom-Json
if ($review.root -ne $root -or $review.days -ne $InactiveDays -or $review.schema -ne 1) {throw 'Manifest scope mismatch'}
$lockPath=Join-Path $ProjectPath 'work\rainbow-version-storage.lock'
$lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$results=[Collections.Generic.List[object]]::new()
$before=(Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).Substring(0,1))).Free
try {
    $freshPath=$ReportPath+'.preflight.json'
    & python (Join-Path $PSScriptRoot 'plan-version-storage.py') --root $root --days $InactiveDays --report $freshPath
    if ($LASTEXITCODE -ne 0) {throw 'Preflight inventory failed'}
    $fresh=Get-Content -LiteralPath $freshPath -Raw | ConvertFrom-Json
    $processes=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(node|python|ffmpeg|blender|chrome|chrome-headless-shell)\.exe$'})
    foreach ($item in $review.actions) {
        $row=[ordered]@{kind=$item.kind;path=$item.path;status='skipped';deletedBytes=0L;error=$null}
        try {
            $current=@($fresh.actions | Where-Object {$_.kind -eq $item.kind -and $_.path -eq $item.path -and $_.fingerprint -eq $item.fingerprint})
            if ($current.Count -ne 1) {throw 'No longer eligible or changed since review'}
            if (@($processes | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($item.project,[StringComparison]::OrdinalIgnoreCase) -ge 0 }).Count) {throw 'Project appears in a running process; preserved'}
            Assert-Local $item.path
            if ($item.kind -eq 'archive') {
                if ($item.destination -ne $current[0].destination) {throw 'Archive destination mismatch'}
                Assert-Local $item.destination $true
                if (Test-Path -LiteralPath $item.destination) {throw 'Archive destination exists'}
                $parent=Split-Path -Parent $item.destination
                New-Item -ItemType Directory -Path $parent -Force | Out-Null
                # Write recovery mapping before the same-volume move.
                $mapping=$item.destination+'.mapping.json'
                $item | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $mapping -Encoding utf8
                Move-Item -LiteralPath $item.path -Destination $item.destination -ErrorAction Stop
                try {New-Item -ItemType Junction -Path $item.path -Target $item.destination -ErrorAction Stop | Out-Null}
                catch {Move-Item -LiteralPath $item.destination -Destination $item.path;throw}
                $row.status='archived';$row['destination']=$item.destination
            } elseif ($item.kind -eq 'remove-dependencies') {
                if ((Split-Path -Leaf $item.path) -ne 'node_modules' -or $item.package_hash -ne $current[0].package_hash) {throw 'Dependency/lockfile check failed'}
                $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($item.path)
                $files=[Collections.Generic.List[object]]::new();$dirs=[Collections.Generic.List[string]]::new()
                while ($stack.Count) {
                    $dir=$stack.Pop();Assert-Local $dir;$dirs.Add($dir)
                    foreach ($entry in ([IO.DirectoryInfo]::new($dir)).GetFileSystemInfos()) {
                        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {continue}
                        if ($entry -is [IO.DirectoryInfo]) {$stack.Push($entry.FullName)} else {$files.Add($entry)}
                    }
                }
                $cutoff=[DateTime]::UtcNow.AddDays(-$InactiveDays)
                if (@($files | Where-Object {$_.LastWriteTimeUtc -ge $cutoff -or $_.CreationTimeUtc -ge $cutoff}).Count) {throw 'Recently modified dependency; preserved'}
                foreach ($file in $files) {
                    Assert-Local $file.FullName
                    $size=$file.Length;$mtime=$file.LastWriteTimeUtc;$file.Refresh()
                    if ($file.Length -ne $size -or $file.LastWriteTimeUtc -ne $mtime) {throw 'Dependency changed during cleanup'}
                    Remove-Item -LiteralPath $file.FullName -ErrorAction Stop
                    $row.deletedBytes+=$size
                }
                foreach ($dir in ($dirs | Sort-Object Length -Descending)) {
                    Assert-Local $dir
                    if (([IO.DirectoryInfo]::new($dir)).GetFileSystemInfos().Count -eq 0) {Remove-Item -LiteralPath $dir -ErrorAction Stop}
                }
                $row.status='dependencies-removed';$row['restore']='Run npm ci in the directory containing the preserved package-lock.json. Existing junctions are preserved.'
            }
        } catch {$row.error=$_.Exception.Message;$row.status='skipped-or-failed'}
        $results.Add([pscustomobject]$row)
        # Journal each completed or failed action; interrupted runs retain progress.
        [pscustomobject]@{timestamp=(Get-Date).ToString('o');root=$root;days=$InactiveDays;freeBeforeBytes=$before;results=@($results)} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding utf8
    }
} finally {$lock.Dispose()}
if ($results.Count -eq 0) {[pscustomobject]@{timestamp=(Get-Date).ToString('o');root=$root;days=$InactiveDays;results=@()} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding utf8}
$results | Format-Table kind,path,status,deletedBytes -AutoSize
Write-Output "Report: $ReportPath"
