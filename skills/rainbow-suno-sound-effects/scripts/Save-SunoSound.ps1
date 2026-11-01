#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SourceFile,
    [Parameter(Mandatory)][string]$Project,
    [Parameter(Mandatory)][string]$Cue,
    [Parameter(Mandatory)][string]$Job,
    [Parameter(Mandatory)][string]$TaskId,
    [string]$MetadataFile,
    [string]$Root = 'D:/projects/tts/音效'
)
$ErrorActionPreference = 'Stop'
foreach ($part in @($Project, $Cue, $Job)) {
    if ($part -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' -or $part -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
        throw 'Project, Cue and Job must be safe ASCII identifiers of 1-80 characters.'
    }
}
if ([string]::IsNullOrWhiteSpace($TaskId)) { throw 'TaskId is required.' }
$source = Get-Item -LiteralPath $SourceFile
if ($source.PSIsContainer -or $source.Extension.ToLowerInvariant() -notin @('.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus')) {
    throw 'SourceFile must be an existing local audio file.'
}
if ($source.Length -eq 0) { throw 'SourceFile is empty.' }
$metadata = if ($MetadataFile) {
    Get-Content -LiteralPath $MetadataFile -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
} else {
    Get-Content -LiteralPath (Join-Path $PSScriptRoot '../assets/metadata-template.json') -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
}
if ($metadata -isnot [System.Collections.IDictionary]) { throw 'Metadata must be a JSON object.' }
function Assert-NoSecrets($value) {
    if ($value -is [System.Collections.IDictionary]) {
        foreach ($key in $value.Keys) {
            if ([string]$key -match '(?i)(token|password|credential|api[_-]?key|skill[_-]?key|authorization|headers)') { throw 'Secret/authentication metadata is not accepted.' }
            Assert-NoSecrets $value[$key]
        }
    } elseif ($value -is [string]) {
        if ($value -match '(?i)([?&](code|token|signature|credential|x-amz-signature)=|bearers+)') { throw 'Do not archive authorization or signed URLs.' }
    } elseif ($value -is [System.Collections.IEnumerable]) {
        foreach ($item in $value) { Assert-NoSecrets $item }
    }
}
Assert-NoSecrets $metadata
$rootPath = [System.IO.Path]::GetFullPath($Root)
$jobPath = [System.IO.Path]::GetFullPath((Join-Path (Join-Path (Join-Path $rootPath $Project) $Cue) $Job))
$prefix = $rootPath.TrimEnd([char[]]@([char]92,[char]47)) + [System.IO.Path]::DirectorySeparatorChar
if (-not $jobPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Output escapes the selected library root.' }
if (Test-Path -LiteralPath $jobPath) { throw 'Job folder already exists; choose a new job ID. No files were overwritten.' }
$rawPath = Join-Path $jobPath 'raw'
$processedPath = Join-Path $jobPath 'processed'
[System.IO.Directory]::CreateDirectory($rawPath) | Out-Null
[System.IO.Directory]::CreateDirectory($processedPath) | Out-Null
$outputFile = Join-Path $rawPath $source.Name
[System.IO.File]::Copy($source.FullName, $outputFile, $false)
$sourceHash = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$outputHash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sourceHash -ne $outputHash) { throw 'Copy hash verification failed; archive is incomplete.' }
$metadata['schemaVersion'] = 1
$metadata['provider'] = 'Suno.cn'
$metadata['project'] = $Project
$metadata['cueId'] = $Cue
$metadata['jobId'] = $Job
$metadata['taskId'] = $TaskId
$metadata['status'] = 'downloaded-unreviewed'
$metadata['archivedAt'] = [DateTime]::UtcNow.ToString('o')
$metadata['raw'] = @{path=$outputFile; sha256=$outputHash; bytes=$source.Length}
$metadata['processedDirectory'] = $processedPath
$metadataPath = Join-Path $jobPath 'metadata.json'
$json = $metadata | ConvertTo-Json -Depth 32
[System.IO.File]::WriteAllText($metadataPath, $json, [System.Text.UTF8Encoding]::new($false))
@{status='downloaded-unreviewed'; audio=$outputFile; metadata=$metadataPath; sha256=$outputHash} | ConvertTo-Json
