param([string]$Root = (Split-Path -Parent $PSScriptRoot))
# Run through Windows PowerShell5.1. Uses installed Windows OCR, no network/model download.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-Result($operation, $type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
    $task.Wait()
    return $task.Result
}
$language = New-Object Windows.Globalization.Language 'zh-Hans-CN'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) { throw 'Installed Chinese OCR engine unavailable.' }
$manifestPath = Join-Path $Root 'evidence/shuffle-story/subtitle-frames.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$frames = New-Object System.Collections.Generic.List[object]
foreach ($frame in $manifest.frames) {
    $file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($frame.path)) ([Windows.Storage.StorageFile])
    $stream = Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @($result.Lines | ForEach-Object { @{text=$_.Text;words=@($_.Words | ForEach-Object { @{text=$_.Text;rect=@{x=$_.BoundingRect.X;y=$_.BoundingRect.Y;width=$_.BoundingRect.Width;height=$_.BoundingRect.Height}}})} })
    $frames.Add(@{id=$frame.id;time=$frame.time;sourceFrameNumber=$frame.sourceFrameNumber;cropSha256=$frame.sha256;text=$result.Text;lines=$lines})
    $bitmap.Dispose(); $stream.Dispose()
    if ($frames.Count % 40 -eq 0) { Write-Output ('OCR crops: '+$frames.Count) }
}
$output = @{engine='Windows.Media.Ocr';language='zh-Hans-CN';sourceSha256=$manifest.sourceSha256;subjectiveListening=$false;asr=$false;frames=$frames}
$path = Join-Path $Root 'evidence/shuffle-story/subtitle-ocr-raw.json'
$output | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Output ('Saved '+$frames.Count+' OCR records to '+$path)
