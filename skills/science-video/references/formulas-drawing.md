# 公式、手绘与论文

先让观众看见一次变化，再用公式解释关系。公式、图形和镜头共用对象ID与逐句时间线；颜色表示含义，不能随镜头任意变换。Opus组件委托按[工具规范](tools-opus.md)，本页不重复调用流程。

## LaTeX → SVG：可编辑、可验证

每条公式保存 `id/tex/meaning/units/assumptions/source`。数值从真实计算或明确教学例子产生，图形位置可插值，金额/统计结果不能插值出不存在的值。

当前本机MiKTeX与dvisvgm路线已在AI第五章使用。先确认工具；下列保存为 `work/formula.tex`，在项目目录执行：

```tex
\documentclass{article}
\usepackage{amsmath,amssymb}
\pagestyle{empty}
\begin{document}\noindent
$\displaystyle n_1\sin\theta_1=n_2\sin\theta_2$
\end{document}
```

```powershell
latex -interaction=nonstopmode -halt-on-error -no-shell-escape -output-directory=work work/formula.tex
dvisvgm --no-fonts --exact --bbox=min --output=work/formula.svg work/formula.dvi
```

检查返回码、正数viewBox、缺字、分数/上下标、单位及数学关系；保存SVG与源文件hash。不要把未编译源码截图当成成品。KaTeX/MathJax可作替代，但如实记录渲染器；独立TeX文档优先使用Codex内置编译器。

推导拆成有语义ID的项：被解释的物体点亮时，相应项才高亮；结果在运算结束的cue才显现。需要公式变形用 `MathTex`/`TransformMatchingTex`，或多步骤SVG按ID连续移动。保持对应项的位置可追踪，不整页替换。

## SVG手绘：精确、确定性渐绘

自有线稿按语义拆路径，统一笔画粗细与圆角，先描边再填色。所有进度由帧号求值，箭头/画笔/标签与真实对象锚点绑定。

```tsx
const p = Math.max(0, Math.min(1, (frame - start) / drawFrames));
const q = p*p*(3 - 2*p);
<path d={d} pathLength={1} strokeDasharray={1}
  strokeDashoffset={1-q} strokeLinecap="round" strokeLinejoin="round"/>
```

上例是轮廓渐绘，不自动产生正确手写笔顺。真实书写感需要笔画次序、抬笔及弧长采样；画笔不得直穿空白。纸纹与微小线宽变化固定seed，禁止每帧随机抖动。中文/公式单独排版，不能让生图工具“画正确的字”。

## Manim：推导、矩阵与数据块

本机 `D:/projects/manim_extend_rainbow/.venv/Scripts/python.exe -m manim --version` 在2026-10-12返回 Community 0.19.1；这是入口验证，不等于新场景渲染通过。项目优先使用自己的已装环境。

`Create`/`Write`画线，`MathTex`排公式，`TransformMatchingTex`匹配公式项；用 `ValueTracker`驱动连续量，离线渲染后以同fps导入Remotion。示例输出透明MOV：

```powershell
& 'D:/projects/manim_extend_rainbow/.venv/Scripts/python.exe' -m manim -qh --fps 30 -t --format=mov scene.py Demo
```

`scene.py`与`Demo`替换为当前实际场景。核对输出alpha、尺寸、fps与媒体首尾；不支持透明codec时改用RGBA PNG序列。可查本地 `yty_manim/basic_unit/squ_tex.py` 的 `SquTex` 和 `yty_manim/application/matrix_yty.py` 的 `MatrixCal`，先看接口再提取所需能力。

## Qwen手绘风格与二维↔三维

按[生成素材与接力](generation.md)选择当前支持的首尾帧接口。先自制准确无字首尾帧，锁定纸色、笔触、主体轮廓、视角与光向；生成画笔运动、手绘环境、草图到实体的短桥接。文字、公式与关键数值随后用确定性层合成。

逐帧查画笔接触、多余手指、线条突变、轮廓漂移、凭空增删及入口/出口速度。失败时缩短片段或直接SVG绘制。历史已查工程没有确认验收通过的Qwen手绘成片；此处是可执行路线，不能宣传为已完成案例。

## 算法与论文的视觉方法

- 每句有可见动作，不能只靠相机漂移：同一文件经历编码→损坏→修复，同一票据经历读取→漏项→补全→验算。实例先讲懂，再出现术语。
- 算法矩阵/热力图来自计算结果；指针、行列和实体块一一对应。跨cue保留对象状态；标签与被指物保持同一坐标，避免组件重挂载造成突然重置。
- 论文用真实PDF页与原图裁切，记录作者、年份、DOI、页码和裁框。完整页→目标图→局部高亮共用锚点；不拉伸、不重画伪造论文。
- 片尾可用纸页交错叠放、缓慢掠过与公式列；介绍文字放卡片下面。复杂公式留来源文件，5秒收束只显示能读懂的少量关系。
- 先检查数据/编译，再看实际成片：遮挡、手机可读性、指针路径、项与口播同步、正常速度衔接。静帧通过不等于运动通过。

## 可核实来源

AI第五章项目 `D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch05_reasoning_agents_v05/`：`scripts/compile_formulas_v04.py`、`research/v04/latex-validation.json`、`src/visuals/PaperFocusV04.tsx`、`src/visuals/Spatial.tsx`。DNA项目和精选参考见[能力证据](capability-evidence.md)及[视觉参考](visual-reference.md)；DNA相机Opus调用失败后由Codex本地实现，不冒称外部模型成果。

官方入口：[Manim](https://docs.manim.community/)、[dvisvgm参数](https://dvisvgm.de/Manpage/)、[SVG path](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path)、[Remotion](https://www.remotion.dev/docs/)。按已装版本核接口；旧工程只是复用线索，不是便携技能的强制依赖。
