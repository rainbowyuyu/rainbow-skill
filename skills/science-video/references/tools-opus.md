# 工具与 Opus

## 本机入口（使用前检查，路径不代表服务已连接）

| 能力 | 入口与边界 |
|---|---|
| Blender | `D:/blender/blender.exe`；后台CLI独立运行，MCP另需Blender与插件服务 |
| Opus | `C:/Users/USER/.codex/tools/claude/README.md`、`run.mjs`、`Start-Claude.ps1` |
| rainbow鱼 TTS | `D:/projects/tts`；先读 `RAINBOW_AUDIO_WORKFLOW.md`、`BROADCAST_NARRATION.md` 与当前脚本参数 |
| 品牌原始素材 | `C:/Users/USER/Desktop/logo`；本包带有限的规范副本 |
| Lux3D | 已安装 `aholo-lux3d` 插件；先读当前 `skills/lux3d/SKILL.md`，发现工具、格式、任务与报价 |
| Remotion / Three.js / Manim | 当前项目 lockfile、实际CLI与已有入口优先，不混装不同版本 |
| GPU | 本次任务需要且获得相应授权时 `ssh fusion-gpu`；先查占用和环境，在任务目录隔离运行 |

检查ffmpeg、ffprobe、Python/Pillow、Node、字体、LaTeX。缺项时选择可行路线，不擅改全局配置。参考旧项目只提取所需组件，任务文件留在当前工程。

本机Lux3D说明当前位于 `C:/Users/USER/.codex/plugins/cache/lux3d/aholo-lux3d/0.1.1/skills/lux3d/SKILL.md`；插件升级后按技能目录定位最新版，不复制旧插件代码进本包。

## Opus：一个有边界的组件一次提交

实际请求前读全局README。runner每次从CC Switch的 `C:/Users/USER/.claude/settings.json` 读取当前provider，只注入子进程；不硬编码网关，不复制凭据到工程、参数、提示词或日志，不自动换provider/HTTP。

任务文件内嵌：目标、输入输出接口、必要源码和依赖版本、不可变数据、帧区间、坐标单位、前后锚点、文字安全区、允许修改范围和验收命令。自动runner没有读取项目文件的工具，不能只给路径。动画要求每帧绝对求值、固定种子、完整组件与资源释放；一次只委托一个机制或修复。

```powershell
$opusRun = Join-Path (Get-Location) ('work/opus-runs/' + [guid]::NewGuid().ToString('N'))
node 'C:/Users/USER/.codex/tools/claude/run.mjs' --prompt 'work/opus-task.md' --output $opusRun --model claude-opus-5-5 --transport native --effort low --max-tokens 32768 --timeout-seconds 1200
```

effort/额度按任务调整，不改全局偏好。需要原生工具编辑才从目标工程用 `Start-Claude.ps1 -PromptFile ...`，不加权限绕过参数。仅整理技能不发送在线请求；不在每次普通任务前付费smoke。

保留 `response.partial.md`、`response.md`、`report.json`。检查完整结束、非空正文、requested/returnedModel、stopReason、completionReceived、退出码及采用文件。返回模型名不能独立证明底层权重。Codex审代码、集成、编译、渲染短片；调用成功不等于画面通过。超时保留证据，再缩小任务或本地实现，不把本地补写标为Opus成果。

## 模块化

场景、相机、旁白、字幕、生成转场、仿真和来源分模块，共用时间线。协作按组件/文件分工，避免并发改同一入口。新版本隔离scratch/output，原始资产只读。
