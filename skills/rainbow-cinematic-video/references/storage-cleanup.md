# 新版本完成后的版本与空间清理

这一步是成片交付的受控收尾，不是后台定时任务，也不是按 `V12`、`v14` 这样的名字整目录删除。它只在新版完整成片已经输出、最终技术 QA 通过、成片 SHA 和依赖清单已落盘后触发。失败、`partial`、在途生成任务、运行中的渲染进程或不确定的唯一输入都会阻止清理。

## 保护原则

先从当前时间线、媒体清单、音频句源 manifest、实验／checkpoint、论文、字体、源码和渲染脚本建立传递依赖。保留：

- 最新完整成片、字幕、正式母带和至少一个可回退的完整成片；
- 当前时间线、Remotion／Manim 源码、锁文件、渲染与 QA 入口；
- 实际使用的图片／视频、论文原文件与定位页、实验数据和 checkpoint；
- 仍被新版句源、字幕对齐或旧版本复现脚本引用的独立音频；
- 来源、生成任务／费用台账、QA 报告、SHA 和重渲染说明。

候选通常是失败候选、旧版可重建无声分段、Remotion bundle、已经证明与当前 `public/` 逐文件相同的旧 `bundle/public` 副本。旧版唯一成片和历史记录按任务需要保留。`node_modules`、虚拟环境和链接目录不作为候选；遇到 junction、symlink 或 Windows reparse point 只记录并跳过，不能跟随进入目标。

## 两阶段执行

项目中使用技能附带的 `scripts/version_cleanup.py`，配置为项目相对路径的 JSON。它会拒绝绝对路径、`..`、越过项目根目录的路径、活动生产进程和不支持的清理根目录。

```powershell
$skill = 'C:/Users/USER/.codex/skills/rainbow-cinematic-video'
$root = 'D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch02_creation'
python -X utf8 "$skill/scripts/version_cleanup.py" plan `
  --root $root `
  --config research/cleanup/version-cleanup-policy.json `
  --manifest research/cleanup/version-cleanup-plan.json

# 复核 JSON 中每个 path、bytes、reason、source 和 skipped 后才执行：
python -X utf8 "$skill/scripts/version_cleanup.py" apply `
  --root $root `
  --config research/cleanup/version-cleanup-policy.json `
  --manifest research/cleanup/version-cleanup-plan.json
```

`plan` 会重新读取最终 QA、核对最新成片 SHA、记录候选字节数并保存 `free_before`；`apply` 会再次检查 QA、配置哈希、文件大小／mtime、源副本 SHA 和活动进程，逐文件写入 `.deleted.jsonl`，然后复核成片 SHA 和 `free_after`。计划过期或有任何文件改变时应停止并重新 plan。删除结果和跳过原因留在项目 `research` 中，不写入 Skill 目录。

## 配置要求

配置至少包含 `final_file`、`qa_file`、`required_files`、`protected_paths` 与 `rules`。`duplicate_tree` 必须给出仍保留的 `source`；脚本只有在源与副本逐文件大小和 SHA 相同才删除副本。`regenerable` 必须写出明确的 `rebuild` 说明，不能把“看起来像缓存”当作证据。只把用户已授权的项目目录写进规则；不要把历史预算、凭据或服务器密码写进配置。

不要把清理放在生成 API 提交之前。生成任务状态未知时保留相关任务和输入；有 ID 先查询原任务，避免重提。清理后至少重新检查最新 MP4 的规格／完整解码、字幕和音频存在，以及关键字体、论文、实验与选中媒体仍可访问；长片不因清理而整片重渲染，必要时先做依赖检查和一个短样段。

## V8 交付后的主清理与可选回退策略

V8 长片完成时，主清理策略至少保护：最终 1080p MP4 及其字幕／母带、当前源码与锁文件、LaTeX SVG 及源 JSON、实验数据／checkpoint、论文 PDF 与定位图、选中媒体、公式／声音／QA 证据、渲染入口，以及 **V7 完整成片和冻结 bundle**。V7 的共享源码若已变化，不能只保留 MP4；冻结 bundle 是恢复旧片的必要依赖。

可选回退分段（例如旧版无声 chunks、可由当前时间线重建的中间 bundle）单独使用第二份 policy 和 manifest。先确认没有脚本、时间线或回退入口引用，再按文件级 SHA／大小证明可重建后清理；别因文件名含 `V08`、`V7` 或 `chunk` 就直接删除。主清理完成后才评估可选分段，并在记录中分别写出逻辑候选字节数与实际释放字节数（硬链接／别名可能释放为 0）。

V8 例行收尾顺序为：完整成片 → 最终 QA 与 51／30 抽样 → 成片 SHA／依赖 manifest → `plan` → 人工复核候选 → `apply` → 复核最新 MP4 SHA、LaTeX、声音、论文与回退入口。清理失败或任一保护项缺失时保留候选并报告原因，不用“空间不足”绕过保护。

## 自动触发位置

将清理调用放在“完整 render → final QA → 生成依赖清单／交付记录”之后，并让失败返回码阻止删除。它可以由项目的 delivery 脚本调用，也可以由同一命令链调用；不创建系统计划任务，不在只生成局部预览时触发。每次新版使用新的 manifest，不能复用已 `applied` 的计划。
