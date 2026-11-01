---
name: mg-styles-15
description: 15 种 MG 动态设计风格，每种一支 10 秒成片，附完整提示词与源码，用代码逐帧渲染。用户要做品牌短片、产品动效、MG 动画、动态标题、数据动效，或说「要扁平矢量/等轴 2.5D/3D 渲染/逐帧手绘/拼贴/液态/形变/包豪斯/合成波/弥散玻璃/综艺花字/贴纸人科普/赛博 HUD/像素 风格」，或想照某种动态设计风格做一支短片时使用。也用于「给我看有哪些动效风格」「按这个风格做个宣传片」「模仿 Buck/Pentagram 那种质感」。
---

# MG Styles 15：15 种动态设计风格的提示词 + 源码

来源 `Vincentwei1021/mg-styles-15`（MIT）。每种风格一支 10 秒成片，画面全部由代码绘制（SVG / Canvas / WebGL / Three.js，3D 那支用 Blender），配乐与音效由 `audio.py` 合成。

**它不是预装渲染器**：`prompts/` 是给 AI 的提示词，`demos/` 是可直接跑的原片源码。要用某种风格，先读提示词，再读同号 demo 的实现。

## 目录

| 编号 | 风格 | 提示词 | 源码 |
|---|---|---|---|
| 01 | 扁平矢量 Flat / Vector 2D | `prompts/01-flat-vector.md` | `demos/01-flat-vector/` |
| 02 | 线条动画 Line Art | `prompts/02-line-art.md` | `demos/02-line-art/` |
| 03 | 等轴 2.5D Isometric | `prompts/03-isometric.md` | `demos/03-isometric/` |
| 04 | 3D 渲染系 CGI（C4D/Blender 质感） | `prompts/04-3d-render.md` | `demos/04-3d-render/` |
| 05 | 逐帧手绘 / 线条沸腾 Cel & Line Boil | `prompts/05-cel-boil.md` | `demos/05-cel-boil/` |
| 06 | 拼贴剪贴 Collage | `prompts/06-collage.md` | `demos/06-collage/` |
| 07 | 液态流动 Liquid | `prompts/07-liquid.md` | `demos/07-liquid/` |
| 08 | 形变 Morphing | `prompts/08-morph.md` | `demos/08-morph/` |
| 09 | 几何构成 / 包豪斯 Bauhaus | `prompts/09-bauhaus.md` | `demos/09-bauhaus/` |
| 10 | 复古 80s Synthwave / VHS / Y2K | `prompts/10-synthwave.md` | `demos/10-synthwave/` |
| 12 | 弥散渐变 / 玻璃拟态 Aurora & Glass | `prompts/12-aurora-glass.md` | `demos/12-aurora-glass/` |
| 18 | 综艺花字（9:16 竖屏） | `prompts/18-hanazi.md` | `demos/18-hanazi/` |
| 19 | 粗描边贴纸人科普 MG | `prompts/19-paperclip.md` | `demos/19-paperclip/` |
| 20 | 像素风 Pixel Art | `prompts/20-pixel.md` | `demos/20-pixel/` |
| 22 | 赛博朋克 HUD / FUI | `prompts/22-hud.md` | `demos/22-hud/` |

编号不连续是原仓库的保留（11、13–17、21 未发布）。

## 做法

1. **选风格**：按内容线索选，不要按好看程度选。产品流程与关系 → 01/03；需要亲近感的故事 → 05/06/19；数据与机制 → 03/09/12；竖屏短视频 → 18；科技/军工调性 → 22。
2. **读提示词**：`prompts/<编号>.md` 里「提示词」代码块整段可用。只有 `Creative seed`（故事、品牌、文案、配色）需要替换；`Signature features` 是风格识别依据，删了就变成通用模板。
3. **改输出规格**：`Output` 段默认 1920×1080 / 30fps / 10.000 s / H.264 + AAC / −14 LUFS / −1 dBTP。改画幅（如 1080×1920）或时长就在这里改。
4. **写实现**：新页面必须暴露 `window.renderAt(t)` 与可选的 `window.DEMO = {width, height, fps, duration}`，在两者就绪后设 `window.__ready = true`。渲染器只认这三个。
5. **渲染**：
   ```bash
   cd "C:/Users/USER/.claude/skills/mg-styles-15"
   npm install                       # 首次；d3 / three / puppeteer-core / opentype.js / simplex-noise
   MG_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" \
     node harness/render.mjs demos/01-flat-vector --stills 0.5,2,4.25
   ```
   Windows 上 `harness/render.mjs` 默认的 macOS Chrome 路径不存在，必须设 `MG_CHROME`。成片用 `node harness/render.mjs <页面目录>`，可加 `--audio <wav>`、`--fps`、`--duration`、`--scale`。
6. **评审**：成片交给另一轮，用 `rubric.md` 逐项打分，把问题贴回制作轮再改。原片就是这么改两轮，终评 7.57–8.21。

## 与其它视频技能的分工

- 要**整片叙事**（剧本、分镜、配音、混音）：用 `xilo-opus-video` 或 `wtt-code-animation-studio`。
- 要**艺术史画风**（油画、壁画、浮世绘、敦煌）：用 `huashu-art-motion` 的风格配方。
- 要**中文口播 + 固定画风**：用 `dashi-animationstyle`。
- 要**短片风格库**（60 余种电影质感）：用 `lemo-opuscar`。
- 要**纯动态设计、品牌感、10 秒 MG**：用本技能。

## 边界

- 只有提示词和源码，不含视频生成模型；画面质量取决于实现，不取决于提示词长度。
- 3D 那支（04）需要 Blender，本机为 `D:/blender/blender.exe`。
- 少数 demo 用了 CC0 / 公有领域照片，复用前核对单文件来源。
- 原片评分是 AI 评委自评，不是外部验收。

## 字体：本机实测的限制（2026-10-27）

仓库**不含字体文件**，`assets/fonts/fonts.css` 里的 `@font-face` 指向的路径需要自己放文件，清单见 `assets/fonts/README.md`。缺字体的后果分两种：

- **直接用系统字体回退**：画面能出，但字形与作者成片不同。01-flat-vector 就是这样跑通的。
- **永远不就绪**：多数 demo 在 `window.__ready = true` 之前会 `await document.fonts.ready` 和 `document.fonts.load(...)`。字体文件缺失时 Promise 可能一直挂着，渲染器 `waitForFunction` 超时退出——03-isometric、19-paperclip 在本机就是这种情况，不是安装坏了。

要做出接近原片的效果，把 `assets/fonts/README.md` 列出的字体放进对应路径（阿里普惠体、HarmonyOS Sans SC、JetBrains Mono、Unbounded 等，授权各自核对）。只想先看构图，可临时改成系统字体族再渲染，但不要把这个改动当成最终交付。

