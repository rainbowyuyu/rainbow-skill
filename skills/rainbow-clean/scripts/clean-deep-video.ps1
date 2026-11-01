param(
    [string]$ProjectPath='D:\projects\manim_extend_rainbow',
    [switch]$Apply,
    [string]$ReviewedManifest,
    [string]$ReportPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $ProjectPath 'video_project')).TrimEnd('\')
if (-not $ReportPath) {$ReportPath=Join-Path $ProjectPath ('work\deep-video-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')}
function Assert-Safe([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if ($full -ne $root -and -not $full.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Path outside video root'}
    for ($cursor=$full;$cursor;$cursor=[IO.Path]::GetDirectoryName($cursor)) {
        if ([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) {throw "Reparse point: $cursor"}
    }
}
function Assert-Unchanged($Entry,[switch]$Hash) {
    Assert-Safe $Entry.path
    $f=Get-Item -LiteralPath $Entry.path -Force
    if ($f.Length -ne $Entry.size -or $f.LastWriteTimeUtc.Ticks -ne $Entry.mtime_ticks -or $f.CreationTimeUtc.Ticks -ne $Entry.ctime_ticks) {throw "Changed file: $($Entry.path)"}
    if ($Hash -and (Get-FileHash -LiteralPath $Entry.path -Algorithm SHA256).Hash -ne $Entry.sha256) {throw "Hash changed: $($Entry.path)"}
}
Assert-Safe $root
if (-not $Apply) {
    & python (Join-Path $PSScriptRoot 'plan-deep-video-clean.py') --root $root --report $ReportPath
    if ($LASTEXITCODE -ne 0) {throw 'Deep scan failed'}
    return
}
if (-not $ReviewedManifest) {throw 'Apply requires reviewed manifest'}
$lock=[IO.File]::Open((Join-Path $ProjectPath 'work\rainbow-version-storage.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$results=[Collections.Generic.List[object]]::new();$removedDirs=[Collections.Generic.List[string]]::new()
$before=(Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).Substring(0,1))).Free
try {
    $preflight=$ReportPath+'.preflight.json'
    & python (Join-Path $PSScriptRoot 'plan-deep-video-clean.py') --root $root --report $preflight --reviewed $ReviewedManifest
    if ($LASTEXITCODE -ne 0) {throw 'Preflight failed; no deletion'}
    $plan=Get-Content -LiteralPath $preflight -Raw | ConvertFrom-Json
    $keepers=@{};$projects=@{};$blocked=@{}
    foreach ($item in $plan.items) {
        $name=Split-Path -Leaf $item.project
        if (-not $projects.ContainsKey($item.project)) {
            $processes=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(node|python|ffmpeg|blender|chrome|chrome-headless-shell)\.exe$'})
            $blocked[$item.project]=@($processes | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($name,[StringComparison]::OrdinalIgnoreCase) -ge 0}).Count -gt 0
            $projects[$item.project]=$true
        }
        $row=[ordered]@{path=$item.path;kind=$item.kind;status='skipped';deletedBytes=0L;error=$null}
        try {
            if ($blocked[$item.project]) {throw 'Running project; preserved'}
            Assert-Unchanged $item
            if ($item.PSObject.Properties.Name -contains 'keeper') {
                if (-not $keepers.ContainsKey($item.keeper.path)) {Assert-Unchanged $item.keeper -Hash;$keepers[$item.keeper.path]=$true}
                else {Assert-Unchanged $item.keeper}
            }
            if ($item.PSObject.Properties.Name -contains 'manifest') {Assert-Unchanged $item.manifest}
            $f=Get-Item -LiteralPath $item.path
            if ($f.LastWriteTimeUtc -ge [DateTime]::UtcNow.AddDays(-3) -or $f.CreationTimeUtc -ge [DateTime]::UtcNow.AddDays(-3)) {throw 'File is recent; preserved'}
            Remove-Item -LiteralPath $item.path -ErrorAction Stop
            $row.status='deleted';$row.deletedBytes=$item.size
        } catch {$row.error=$_.Exception.Message;$row.status='skipped-or-failed'}
        $results.Add([pscustomobject]$row)
        if ($results.Count % 100 -eq 0) {
            [pscustomobject]@{timestamp=(Get-Date).ToString('o');freeBeforeBytes=$before;results=@($results)} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding utf8
        }
    }
    # Only prune empty directories inside the exact reviewed generated bundles.
    foreach ($bundle in $plan.bundles) {
        if (-not @($results | Where-Object {$_.status -eq 'deleted' -and $_.path.StartsWith($bundle.path+'\',[StringComparison]::OrdinalIgnoreCase)}).Count) {continue}
        if (-not (Test-Path -LiteralPath $bundle.path)) {continue}
        try {
            Assert-Safe $bundle.path
            $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($bundle.path);$dirs=[Collections.Generic.List[string]]::new()
            while ($stack.Count) {
                $dir=$stack.Pop();Assert-Safe $dir;$dirs.Add($dir)
                foreach ($entry in ([IO.DirectoryInfo]::new($dir)).GetDirectories()) {if (-not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {$stack.Push($entry.FullName)}}
            }
            foreach ($dir in ($dirs | Sort-Object Length -Descending)) {
                Assert-Safe $dir
                if (([IO.DirectoryInfo]::new($dir)).GetFileSystemInfos().Count -eq 0) {Remove-Item -LiteralPath $dir;$removedDirs.Add($dir)}
            }
        } catch {$results.Add([pscustomobject]@{path=$bundle.path;kind='empty-directory';status='skipped-or-failed';deletedBytes=0;error=$_.Exception.Message})}
    }
} finally {
    $total=0L;foreach ($r in $results) {$total+=$r.deletedBytes}
    [pscustomobject]@{timestamp=(Get-Date).ToString('o');root=$root;freeBeforeBytes=$before;freeAfterBytes=(Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).Substring(0,1))).Free;deletedBytes=$total;results=@($results);removedEmptyDirectories=@($removedDirs)} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $ReportPath -Encoding utf8
    $lock.Dispose()
}
Write-Output ("Deleted {0:N3} GiB; {1} empty bundle directories; report {2}" -f ($total/1GB),$removedDirs.Count,$ReportPath)
