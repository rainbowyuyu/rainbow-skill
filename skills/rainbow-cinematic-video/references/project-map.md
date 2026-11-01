# 《AI 进化史》工程定位

本页是本机案例索引，不是新项目的固定目录。文件不存在时定位用户实际工程，不重新安装或假称已读取。

## 预告工程基线（继续制作前核实是否有更新）

- 根目录：`D:/projects/manim_extend_rainbow/video_project/ai_evolution_trailer`
- 最近完成的预览：`output/AI进化史_V10_预览1080p.mp4`；片尾短版 `output/V10_片尾与论文预览.mp4`。
- 规格：1920×1080，30 fps，6420 帧，214 秒。V10 技术核验 20 项通过，**仍待用户审美确认和新版 4K 授权**；继续工作时查更晚版本。
- Remotion 4.0.526、React 19；本地 TTS 环境为 `D:/projects/tts`。

## 修改路由

| 位置 | 内容 |
|---|---|
| `src/Film.tsx`、`src/Root.tsx` | 主合成、来源／字幕层、1080p／4K 注册 |
| `src/timeline.json`、`src/route.json` | 六章、旁白、帧区间；背景运动素材的路由 |
| `src/scenes/Brand.tsx` | SignatureTitle；图形、rainbow鱼、片名共享父级 |
| `src/rainbow-mark.json`、`public/brand/rainbow-vector.svg` | 用户 Logo 的真实描摹轮廓 |
| `src/scenes/Journey.tsx` | 总览、章节标题与章内讲解 |
| `src/scenes/LabVisual.tsx`、`MonteCarlo.tsx`、`EmbodiedLab.tsx` | 干净的机制图、π 实验、具身闭环 |
| `src/scenes/Continuum.tsx` | 贯穿片头片尾的帧驱动粒子环境 |
| `src/scenes/LiteratureRoom.tsx`、`src/literature.json` | 真实 PDF 空间展示、图表聚焦与元数据 |
| `research/pdfs`、`public/papers` | 原 PDF、原文提取和整页截图 |
| `manim/technical.py` | 精确技术动画 |
| `scripts/tts.py`、`scripts/audio.py` | 本片 TTS 适配与混音 |
| `src/captions.json`、`public/audio/master.wav` | 正式字幕与已混音声音 |
| `scripts/render.mjs`、`scripts/qa_v10.py` | 渲染入口与当前专项核验 |
| `research/generation-ledger.json` | 付费生成历史；费用以此和平台账单核对 |

## 本机可复用命令

在工程根目录运行；新版本先增加独立输出名，避免覆盖 V10：

```powershell
npm run check
$env:TRAILER_STILLS='120,4970,5320,5410,5452,5476,6400'
node scripts/render.mjs stills
$env:TRAILER_CONCURRENCY='6'
node scripts/render.mjs review-v10
python scripts/qa_v10.py
```

`scripts/compose_v9_assets.py` 会重写旧版时间线和场景，不应作为“刷新素材”随意重跑。按具体缺失步骤调用工具。旧 README 和旧 QA 可能检查已弃用 Logo 或版本路径，先读代码再沿用。

## 已检查的论文定位示例

| ID | PDF 物理页序 | 聚焦矩形，单位 PDF 点 |
|---|---:|---|
| alexnet | 5 | 102, 75, 509, 272 |
| gan | 3 | 104, 338, 510, 596 |
| attention | 4 | 106, 68, 511, 491 |
| ddpm | 4 | 104, 80, 507, 180 |
| nerf | 5 | 30, 30, 386, 234 |
| genie | 2 | 301, 83, 535, 402 |

这些位置只对应本项目保存的 PDF 版本；换文件时重新核实页码、哈希与图注。V10 是风格迭代案例，不意味着之后只能用这六篇论文。

## 第一章《看见与选择》工程案例

2026-09-23 已核实的局部修复基线；未来任务先查是否有更晚版本，不把本文日期当成自动选择文件的依据。

- 根目录：`D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch01_vision_choice`。
- 完整输出：`output/v9/第一章_看见与选择_V9_分类引言修正版_1080p.mp4`。
- 局部输出：`output/v9/V9_猫狗分类引言_局部预览.mp4`（全片 1:02–1:30）。
- 规格：1920×1080，30 fps，60,544 帧，约 33:38.13；保留 V8。上述输出未代表用户已确认新版 4K。

| 位置 | 作用／注意 |
|---|---|
| `src/FilmV9.tsx`、`src/OpeningV9.tsx` | 该版合成、片头与分层；不要改成预告工程路径 |
| `src/timeline-v9.json`、`src/timeline.json` | 新时间线与旧动画锚点；数字索引可能共享旧场景路由 |
| `src/scenes/ClassificationIntroV9.tsx` | 专用分类引言；按正式旁白阶段驱动，不再复用三个任务总览 |
| `src/scenes/Teaching.tsx`、`TaskVisual.tsx`、`StoryVisual.tsx` | 教学组件分派；读清早返回和优先级再修改 |
| `src/experiments.json`、`public/experiments/v4` | 保存样本、响应、指标、轨迹与搜索记录 |
| `src/captionLayout.ts` | 字幕行数与安全区布局 |
| `public/audio/v8/master.wav` | 这次 V9 纯视觉修复所复用的音轨；版本名不同不代表过期，查实际引用 |
| `scripts/render_v9.mjs` | `classification-stills`／`classification-patch` 为本次局部入口 |
| `scripts/assemble_v9_classification.py` | 65–90 秒 patch 的专用拼接脚本，帧范围为该案例固定值，不可未经修改套给其他段 |
| `output/v9/classification-checks.json` | 帧数、解码、类型、未改画面与音频包哈希核验 |

本次教训：旁白已说分类，但 beat 3 的 `visual: overview` 命中了三任务组件；覆盖全前景的背景视频又遮住文字。修复采用专用可视化和仅背景短溶解，没有新付费生成。仍需按真实播放审查其他片头接缝，不因这次局部通过便宣称整个工程已无历史问题。
