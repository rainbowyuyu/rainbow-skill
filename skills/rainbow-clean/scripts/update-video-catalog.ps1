param([string]$ProjectPath='D:\projects\manim_extend_rainbow',[string]$ReportPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $ProjectPath 'video_project')).TrimEnd('\')
if (-not $ReportPath) {$ReportPath=Join-Path $ProjectPath ('work\video-catalog-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')}
& python (Join-Path $PSScriptRoot 'build-video-catalog.py') --root $root --report $ReportPath
if ($LASTEXITCODE -ne 0) {throw 'Catalog inventory failed'}
$plan=Get-Content -LiteralPath $ReportPath -Raw | ConvertFrom-Json
$catalog=Join-Path $root '_catalog'
function Assert-CatalogDestination([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path)
    if ($full -ne $catalog -and -not $full.StartsWith($catalog+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Outside catalog'}
    for ($cursor=$full;$cursor;$cursor=[IO.Path]::GetDirectoryName($cursor)) {
        if ((Test-Path -LiteralPath $cursor) -and ([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint)) {throw "Catalog destination is a link: $cursor"}
    }
}
Assert-CatalogDestination $catalog
New-Item -ItemType Directory -Path $catalog -Force | Out-Null
$index=[Collections.Generic.List[string]]::new()
$index.Add('# 视频项目统一目录');$index.Add('');$index.Add('按主题浏览，每个主题提供 publish、cover、output、source、assets、work、history 七类目录。入口链接到唯一实体文件，不复制项目或素材；最近三天活跃项目保持原位置。');$index.Add('')
$count=0;$conflicts=[Collections.Generic.List[string]]::new()
foreach ($topic in $plan.topics) {
    $topicRoot=Join-Path $catalog $topic.family
    Assert-CatalogDestination $topicRoot
    foreach ($category in $topic.categories) {
        $dir=Join-Path $topicRoot $category;Assert-CatalogDestination $dir
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    foreach ($link in $topic.links) {
        $destination=Join-Path (Join-Path $topicRoot $link.category) $link.label
        $target=[IO.Path]::GetFullPath($link.target)
        if (-not $target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($catalog+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Invalid or cyclic catalog target'}
        if (Test-Path -LiteralPath $destination) {
            $existing=Get-Item -LiteralPath $destination -Force
            if (($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $existing.Target -eq $target) {$count++;continue}
            $conflicts.Add($destination);continue
        }
        Assert-CatalogDestination $destination
        New-Item -ItemType Junction -Path $destination -Target $target | Out-Null
        $count++
    }
    $readme=Join-Path $topicRoot 'README.md';Assert-CatalogDestination $readme
    @("# $($topic.family)",'',"当前项目：``$($topic.current)``。",'','- publish：最新成片、文案与四比例封面的实体发布包入口','- cover：封面与发布视觉','- output：渲染成片、交付与发布包','- source：源码、脚本及 project 完整工程入口','- assets：原始素材、音频、模型','- work：工作中间目录和研究记录','- history：历史版本与归档','','这些入口不额外占用素材空间；暂无对应内容的分类为空。删除入口不等于删除原文件，禁止递归清理链接目标。需要开发已归档版本时，先按归档映射恢复原目录。') | Set-Content -LiteralPath $readme -Encoding utf8
    $index.Add("- [$($topic.family)]($($topic.family)/README.md)")
}
$index.Add('');$index.Add('新项目建议采用同名的七类目录；现有项目通过兼容入口渐进统一，实际运行仍从 source/project 对应的原工程目录启动。')
$readme=Join-Path $catalog 'README.md';Assert-CatalogDestination $readme
$index | Set-Content -LiteralPath $readme -Encoding utf8
[pscustomobject]@{topics=$plan.topics.Count;links=$count;conflicts=@($conflicts);catalog=$catalog} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ($ReportPath+'.result.json') -Encoding utf8
Write-Output "Catalog: $catalog; topics=$($plan.topics.Count); links=$count; conflicts=$($conflicts.Count)"
