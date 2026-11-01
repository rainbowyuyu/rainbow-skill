# 技法总索引：按观众的问题查表

**用法：先写下这一段观众此刻要解决的问题，再在下表找到那一行，只读该行的指南与证据；不要按效果名（"来个粒子""加个模糊"）横向堆叠技法。** 每行的 lab 入口可直接播放、逐帧、导出；代码接口给出可 import 的候选 id 或 API 文件。

路径均相对 `C:/Users/USER/.codex/skills/rainbow-motion-story/`。下表"lab"列省略 `assets/style-lab/` 前缀；`modules/` 指 `assets/style-lab/lab/modules/`。

---

## 1. 主表

| 观众此刻要解决的问题 | 首读指南 | 可运行入口 (lab) | 代码接口 | 证据 / 研究 | 定量参数要点 |
|---|---|---|---|---|---|
| 速度太快/太慢，情绪不对，快慢停弹没有反差 | `guides/emotion-motion.md` | `lab/emotion-motion.html` | `modules/` 无独立模块；`examples/emotion-motion/API.md` 的四种语气计划 | `studies/emotion-motion.md` | 15.03 s 短片用 4 个语气词分担 0.27–15.0 s；快/慢/停 RMS −11.08 / −22.00 / −9.53 dBFS |
| 缓动单一，动作没有性格，全片都套同一条 ease | `guides/rate-curves.md` | `lab/rate-curves.html`（12 种动作安排对照） | `examples/rate-curves/API.md`：Bezier 反解、速率积分、弧长查表 | `studies/rate-curves.md`；`assets/style-lab/evidence/rate-curves-technical.json` | 12 条曲线：linear / ease-in / ease-out / ease-in-out / minimum-jerk / anticipate-release / overshoot-settle / spring-underdamped / spring-critical / hesitate-commit / impact-rebound / rush-hold-release；minimum-jerk 为 `p(u)=10u³−15u⁴+6u⁵` |
| 音乐有节奏，画面却接不住；每个起音都切一刀 | `guides/syy-rhythm.md`、`guides/rhythm.md` | `lab/syy-rhythm.html`、`lab/shuffle-rhythm.html` | `modules/signal-relay.js`；`examples/signal-relay/API.md` | `studies/syy-rhythm.md`、`studies/syy-signal.md` | 4.21 起音/秒、相邻间隔中位 0.232 s；视觉峰仅 0.14 次/秒（1:30）；视觉峰到最近起音中位 −0.010 s，19/24 在 ±80 ms |
| 动作落点和音乐对不上，切点该吸到哪 | `guides/rhythm.md`、`guides/shuffle-rhythm.md` | `lab/shuffle-rhythm.html`（同一条洗牌三种配声） | `examples/shuffle-rhythm/API.md` | `studies/shuffle-rhythm.md`、`studies/shuffle-rhythm-visual.md`、`studies/shuffle.md` | 重复操作周期 0.655 s ±0.017；0.667 s = 112.3 BPM 的 1.248 拍（无公共周期）；改 90 BPM 才严格同拍 |
| 音效时机不对：先响后碰、确认声提前、盖住旁白 | `guides/sound-design.md` | `lab/sound-design.html` | `examples/sound-design/API.md`；`modules/` 的 rhythm 家族 | `studies/sound-design.md`、`studies/shuffle-sound-signal.md` | 掠过在最近点前 0.15–0.45 s 进入；小状态确认 0.08–0.25 s、提交时触发一次；30 fps 一帧 33.33 ms |
| 声音太满，全片没有呼吸 | `guides/sound-design.md`、`guides/emotion-motion.md` | `lab/sound-design.html` | 同上；`modules/rhythm.js` 的 `rhythm-phrase-envelope` | `studies/syy-rhythm.md`、`studies/syy-signal.md` | "呼吸"抽低频：20–120 Hz 降 8.5 / 10.9 dB，中频只降约 1.5 dB，高频不动；同段 pix_diff 1.64→1.38→0.90 |
| 镜头只会绕 Y 轴；穿梭、离体、子弹时刻做不出重量 | `references/modules/camera.md`、`guides/camera.md` | `lab/index.html` 运镜模块；`examples/video/index.html` 六段样例 | `modules/camera.js`（orbit-bank / occlusion-pass / dolly-focus / dolly-zoom）、`camera-flight.js`（fpv-slalom / fpv-dive / first-person / soul-drift）、`camera-time.js`（bullet-time / hitchcock-zoom） | `studies/camera-moves.md`、`studies/camera.md`、`studies/camera-depth.md`（38 镜逐镜量） | 83 镜、中位 6.20 s、均值 6.56、P25 4.74、P75 8.50；5.08 s 出现 11 次；切点到最近 onset 中位 +3 ms |
| 前后景层次糊成一片，焦点不会交接 | `guides/camera-depth.md` | `lab/camera-depth.html`（28–85 mm、f/1.4–f/16） | `modules/camera-depth.js`：`camera-focus-handoff`、`camera-focus-track`、`camera-parallax-reveal`；`examples/camera-depth/API.md` | `studies/camera-depth.md`、`studies/camera-depth-technical.md` | 拉焦归一化进度 6% → 57% → 37%（前段几乎不动，不是 smoothstep 的 50%）；慢弧移 −105 到 −118 px/s、9.2 s 累计 −1008 px，同时尺度 +17.2% |
| 快速运动看不清，或者全都糊掉 | `guides/transmission-effects.md` | `lab/transmission-effects.html` | `modules/transmission-effects.js`：`look-tracking-exposure`、`visualization-window-relay` | `studies/motion-blur-technical.md`、`studies/transmission-deep.md`、`studies/review-pieces.md` | 180° 快门@30 fps = 1/60 s ≈ 16.67 ms；600 px/s × 1/60 = 10 px 轨迹；16 中点样本 ≈ 0.625 px 间距；模糊由**相对**运动决定，跟随机位不代表主体锐利 |
| 下一镜接不住上一镜，越切越散 | `guides/continuity.md` | `lab/index.html` 交接模块 | `modules/continuity.js`：`continuity-shell-to-force`、`continuity-quantity-to-term` | `references/case-study-pid-v05.md`、`studies/review-rotor.md` | 交接至少比较位置与速度；长运镜再比加速度；smoothstep 端点速度为零但加速度仍可能跳变 |
| UI 动作割裂，素材跨面板跳位，点击没有归属 | `guides/ui-continuity.md`、`guides/linework-language.md` | `lab/ui-line-studio.html`（四个候选） | `modules/ui-choreography.js`；`examples/ui-choreography/API.md` | `studies/max-ui-motion.md`、`studies/ui-line-principles.md`、`studies/review-ui.md` | 全片 `pix_diff<0.5` 占 51.0%；运动段中位 0.067 s（2 帧）；按钮 24.467 s 一帧内 52×28 → 208×67 px；整体上移 97 px 分两段，中间谷 0.13 s，τ≈0.24 s（仅平均） |
| 机械拆开之后看不懂，零件归属不明 | `guides/anatomy-mechanics.md`、`references/modules/mechanics.md` | `lab/switch-anatomy.html`、`lab/rotary-interaction.html` | `modules/mechanics.js`：`mechanics-axial-exploded`、`mechanics-section-cut`、`mechanics-linked-gears`、`mechanics-slider-crank`；`examples/switch-anatomy/API.md` | `studies/anatomy-mechanics.md`、`studies/rotary-interaction.md`、`studies/rotary-kinematics.md` | 11 镜中 10 镜均 4.86 s / 中位 4.57 s / 3.77–6.70 s；超过 5 s 的三镜都有镜内二次运动；372 onset / 61.09 s = 6.09 次/秒 |
| 需要真正的"可切开"结构，而不是端盖缩小退场 | `guides/rotary-interaction.md`、`guides/anatomy-mechanics.md` | `lab/rotary-interaction.html`、`lab/repro-rotor.html` | `modules/rotary-interaction.js`：`mechanics-rotary-section`、`mechanics-rotary-explode`、`ideal-rotary-assembly`；`examples/rotary-interaction/API.md` | `studies/rotary-cutaway.md`、`studies/rotary-kinematics.md`、`studies/review-rotor.md` | 剖切区放宽到 8.3–89%；R 240→360、E 55→70 使宽度差 32.6%→1.8%；`0≤e/R≤0.25`；截面封口几何**仍未做**，见 §4 |
| 文字生硬地"淡入淡出"，接不住对象 | `guides/motionface-type.md` | `lab/motionface.html` | `modules/motionface-type.js`、`motionface-kinetic.js`、`motionface-concepts.js`；`examples/motionface-type/API.md` | `studies/motionface.md`、`studies/motionface-focus.md`、`studies/motionface-mindset.md`、`studies/motionface-public-code.md` | 6 秒首页动画按 0/18/…/179 帧取样，五段各 1.2 s；文字分类 21 条；方法为遮罩排字、焦点交接、轨迹组装、环字落定 |
| 文字、颜色、画面各说各的 | `guides/type-color.md` | `lab/index.html` 文字模块 | `modules/type-life.js`：`type-semantic-emphasis`、`type-anchored-label`、`type-equation-identity`、`type-palette-attention` | `studies/type-color.md` | 正文对比 ≥4.5:1、大字 ≥3:1（WCAG 2.2，保守借鉴）；Carbon 的 70–700 ms 是 UI token，不是中文阅读时长 |
| 公式像贴上去的字幕，数值和实体脱节 | `guides/visualization.md`、`guides/manim-formula-language.md` | `lab/manim-formula.html`（四段 CE 原生渲染） | `modules/visualization.js`（entity-formula / cloud-aggregation / flow-continuity / multistate-confluence / route-bridge / lattice-growth）；`examples/manim-formula/API.md` | `studies/3b1b-manim-source.md` | 先看到事件→提取量→符号进关系；读公式时相机少动；符号飞行末段淡出旧符号再显目标槽位 |
| 数据在讲，但观众看不出规模与比较 | `guides/visualization.md`、`guides/type-color.md` | `lab/index.html` 可视化模块 | `modules/visualization.js`、`paper-space.js`、`generative-flow.js` | `studies/ai-draw-deep.md`、`studies/story-craft.md` | 散点保存位置不在每帧重抽样；同一采样点 ID 跨二维/三维保留 |
| 颜色和材质越堆越乱，金属像塑料 | `guides/look.md`、`guides/aesthetic-direction.md`、`guides/metal-electronics.md` | `lab/aesthetic-direction.html`、`lab/glass-metal.html` | `modules/look.js`（material-palette / depth-atmosphere / multisample-shutter / editorial-layout）、`motif.js`、`aesthetic-direction.js` | `studies/aesthetic-deep.md`、`studies/redknot-glass.md`、`studies/redknot-technical.md` | 有限配色 + 轮廓接力；同一物件三种构图对照；玻璃前部剖视为预算几何，不是连续移动剖切面 |
| 要真实建模、液体碰撞与路径追踪 | `guides/blender-model-motion.md`、`references/modules/blender.md` | `lab/blender-flow.html`、`lab/robocup-blender.html` | `assets/style-lab/examples/blender-flow/build_waterfall.py`（见 `assets/style-lab/examples/blender-flow/API.md`）；`assets/style-lab/examples/robocup-blender/build_demo.py`（见 `assets/style-lab/examples/robocup-blender/API.md`） | `studies/blender-flow.md`、`studies/robocup-blender-technical.md`、`studies/review-blend.md` | 8.336 s / 24 fps / 200 帧；切点 4.167 / 6.083 / 7.542 s；甩镜 dx −78.9→+0.2、dy 0.6→−55.3 px/帧，第 164 帧以 16.6/16.6 交接 |
| 水面在动但"不像水"：闪烁、倒影、浮标穿帮 | `studies/production-water-lessons.md`、`studies/waterpro-local-audit.md`、外部 `../rainbow-atmospheric-scene/references/waterpro-reuse.md` | 无独立 lab；按工程接入 | `examples/production-toolkit/API.md`：绝对帧、同一波面、预乘颜色/覆盖率、单次界面混合 | `studies/production-water-lessons.md`、`studies/waterpro-local-audit.md` | WaterPro 3.1.1 + Three 0.183；固定 tick 1/60，两次同目标 tick 消化一帧延迟（版本相关）；法线 256² 覆盖 72 m vs 9 m 导致"胡椒点"；13-tap 平面反射；浮力 1/240 步长、预热 60 s |
| 想要更多风格，但不想变成换色器 | `guides/lemo-opuscar.md` | `lab/lemo-atlas.html`（157 项图谱）、`lab/lemo-review.html` | `lab/modules/lemo-trials.js`：14 个原创技法候选；`examples/lemo-opuscar/API.md`；目录 `lab/lemo-catalog.json` | `studies/lemo-analysis-a.md`、`studies/lemo-analysis-b.md`、`studies/lemo-analysis-c.md` | 59 ready 风格 / 98 电影档案 / 157 缩略帧 / 14 原创试作；提交 `3961ddb…`；14 项 id 见 §3 |
| 片头漂亮但无主题，物件转换认不出 | `guides/symbolic-title-sequence.md` | `lab/symbolic-titles.html`（三候选） | `modules/symbolic-titles.js`；`examples/symbolic-titles/API.md` | `studies/magpie-title.md`、`studies/review-magpie.md` | 37.80 s、12 个 A 档真切点，中位 3.00 s；爆发:停留 ≈ 1:1.6；开场 4.5 s 换四次构图，首镜仅 0.97 s；门缝长停留 2.73 s |
| 网页式的动态排版，字粒与尺度怎么切 | `guides/motionface-type.md`、`guides/web-aesthetic-direction.md` | `lab/motionface.html`、`lab/web-aesthetic.html` | `modules/motionface-kinetic.js`、`web-aesthetic.js`；`examples/web-aesthetic/API.md` | `studies/motionface-focus.md`、`studies/jiangou-ui.md`、`studies/motionface-public-code.md` | 同一物体承载两组概念；环字收束成可读句；字粒尺度切换处必须可读 |
| 开场没人看到第二句就划走 | `guides/mofs-writing.md`、`guides/script.md`、`guides/shuffle-story.md` | `lab/mofs-writing.html`（同一解释链三种开场） | `modules/mofs-explanation.js`：`story-mofs-result` / `-build` / `-predict`；`modules/mofs-explanation.js`；`examples/mofs-explanation/API.md` | `studies/mofs.md`、`studies/mofs-script.md`、`studies/mofs-writing-principles.md`、`studies/review-mofs.md` | 开题句停 3.70 s；单动作句 1.53–1.71 s；换行中位 1.84 s；每行约 18 字；阅读中位约 8.0 字/秒；数字句 7.2 字/秒（比同段慢 23%） |
| 一镜到底却越看越平，没有局部替换 | `guides/shuffle-story.md`、`references/case-study-pid-v07.md` | `lab/shuffle-story.html`、`lab/repro-shuffle.html` | `modules/shuffle-explanation.js`：`storytelling-perfect-shuffle`、`visualization-choice-product` | `studies/shuffle-visual-story.md`、`studies/shuffle.md` | 13.33 s 不切开场靠四段小位移推进（16.41 / 6.56 / 5.74 / 18.60 像素差）；长镜靠"同一构图里的局部替换" |
| 传一个包/走一条流程，讲了半天没走通 | `guides/transmission-effects.md`、`guides/continuity.md` | `lab/transmission-effects.html`、`lab/repro-pieces.html` | `modules/transmission-effects.js`：`visualization-window-relay` | `studies/transmission-deep.md`、`studies/review-pieces.md` | 三层分工：世界全糊 / 字幕轻软化 / HUD 零糊；369.333 s 世界层 T 保留 0.156；同一窗口推近后保留刻度再推进状态 |
| 整片多线并行，不知道怎么排先后 | `guides/integrated-direction.md` | `examples/video/index.html` | `references/technique-handbook-20261023.md` 全局 | `studies/mature-production-recipes.md`、`references/case-study-pid-v0{3,5,6,7,8}.md` | 每段写全 `question/evidence/before/action/after/nextAnchor`；四时钟（成片/物理/相机/源曲）显式映射 |

---

## 2. 量化参数速查

只收本次研究里能追溯到具体文件、有测法的数字。**没有来源的数字不放进来**；需要新数字时回到对应研究的测量脚本重算，不要从旧结论外推。

### 2.1 节奏、切点与音画同步

| 量 | 值 | 来源 |
|---|---|---|
| syy 起音密度 | 4.21 次/秒（699 / 166.14 s） | `assets/style-lab/studies/syy-rhythm.md` |
| syy 相邻起音间隔中位 | 0.232 s（46% 落在 0.23 s，检测器下限饱和） | 同上 |
| syy 周期骨架 | 0.470 s (r=0.408) / 0.940 s (r=0.517) / 1.868 s (r=0.477) | 同上；`studies/syy-signal.md` |
| syy 视觉事件密度 | `pix_diff≥4.0` 峰 24 个 = 0.14 次/秒；与音频密度比 1:30 | `studies/syy-rhythm.md` |
| syy 视觉峰到起音偏移 | 中位 −0.010 s，均值 −0.020 s，绝对中位 0.013 s，最大 0.121 s；19/24 在 ±80 ms | 同上 |
| syy 真切点 | 全片仅 105.767 s 一处中段硬切（14.400 淡入、165.933 淡出）；换场用 ~0.17 s 压暗+降饱和完成 | 同上 |
| syy 冲击持续 | `pix_diff>3.0` 的 44 段中 42 段 ≤0.067 s（≤2 帧） | 同上 |
| syy 低频呼吸 | 20–120 Hz 在 108–120 s 降 8.5 dB、120–132 s 降 10.9 dB；中频 ~1.5 dB | 同上 |
| syy 日期牌换牌 | 0.13–0.17 s 一张（88–123 s 约 6 张/秒） | 同上 |
| camera38 切点 | 83 镜；中位 6.20 s、均值 6.56、P25 4.74、P75 8.50、最短 0.36、最长 19.24 | `studies/camera-depth.md` |
| camera38 切点到 onset | 有符号偏差中位 **+3 ms**；前后 40/41；≤40 ms 27 个、≤60 ms 35 个、≤100 ms 63 个 | 同上 |
| camera38 拍内相位 | 中位 0.249 拍（随机基线 0.25）→ 不跟 BPM 网格 | 同上 |
| camera38 静音 | 全片 2.4%，15 段，最长 0.44 s（236.10–236.54） | 同上 |
| blend 切点 | 3 个：4.167 / 6.083 / 7.542 s；峰值 60.07 / 39.54 / 41.10 | `studies/blender-flow.md` |
| blend 相机交接 | dx −78.9 → +0.2 px/帧（衰减约 1/400）；dy +0.6 → −55.3（×90）；第 164 帧 16.6/16.6 交叉；合成谷 23.5 px/帧 | 同上 |
| blend 定帧尾 | S4 第 188 帧后 pix_diff 0.38–0.49、灰度差 0.53–0.67，持续 0.54 s | 同上 |
| magpie 真切点 | A 档 12 个；中位 3.00 s、均值 2.87、最短 0.43、最长 5.50 | `studies/magpie-title.md` |
| magpie 动/停比 | 爆发:停留 ≈ 1:1.6；最长停留 3.07 s（末 3 秒）、次长 2.73 s（门缝 10.1–12.8 s） | 同上 |
| mech 镜长 | 11 镜；去开场后 10 镜均值 4.86 s、中位 4.57 s、范围 3.77–6.70 | `studies/anatomy-mechanics.md` |
| mech onset | 372 / 61.09 s = 6.09 次/秒；5 s 分箱 27–34，方差极小；`silence_ratio` 0.005 | 同上 |
| mech 切点吸 onset | 7 个切点到最近 onset：+0.111 / −0.068 / −0.016 / +0.051 / +0.026 / −0.035 / +0.007 s（中位绝对 0.035 s） | 同上 |
| shuffle 重复周期 | 0.655 s ±0.017（119.4–124.167 s 七个圆点填充） | `studies/shuffle.md` |
| shuffle 声音颗粒 | ~7 Hz 连续层；簇内 IOI 中位 0.140 s（p25 0.117 / p75 0.186）；簇间间隙 0.279 s | 同上 |
| shuffle onset 频谱 | 质心中位 2507 Hz（372–5737）；tonal/noise 332/293；flatness 中位 0.017 | 同上 |
| ui 切点 | `cuts=[]`（阈值 0.35）；9.23 s 与 10.67 s 为一帧硬切，4.50 s 性质未定 | `studies/max-ui-motion.md` |

### 2.2 运动量、曝光与像素指标

| 量 | 值 | 来源 |
|---|---|---|
| 快门与轨迹 | 180°@30 fps → T=1/60 s≈16.67 ms；600 px/s → 10 px 轨迹；16 样本 ≈ 0.625 px 步距 | `studies/motion-blur-technical.md` |
| 相对运动原则 | 相机与主体同速时主体可近似固定，静止背景反向扫过；后处理 velocity buffer ≠ 曝光内轨迹 | 同上 |
| blend 逐帧差 (pd) | S1 4.69 / S2 5.95 / S3 15.93 / S4 0.59–0.66；复现修后 2.92 / 3.97 / 10.35 / 0.50–0.59 | `studies/review-blend.md` |
| blend 影调 | S3 V 186.5、S 81.1；修后 193.9 / 78.9；S3 边缘 E 3.91（复现 1.54） | 同上 |
| blend 甩镜 | 中位速度 19.28 px/帧（960 宽）；交接点 f167 / 6.958 s | 同上 |
| ui 静止额度 | `pix_diff<0.5` 51.0%；`≥5.0` 4.0%；最长静置 2.30 s（15.03–17.30）与 2.37 s（32.33–34.67） | `studies/max-ui-motion.md` |
| ui 运动段 | 43 段，中位 0.067 s、均值 0.163 s、最长 1.633 s；24 段仅 1 帧 | 同上 |
| ui 按钮 | 24.467 s 一帧 52×28 → 208×67 px；上移 97 px 分两段（62% / 36%），谷 0.13 s；τ≈0.24 s（R²=0.997，仅平均） | 同上 |
| magpie 明度 | 全片 val 平均绝对差 19.35（修后 11.43）；结构运动 0.01117（复现 0.00453，41%） | `studies/review-magpie.md` |
| mofs 影调 | luma 79.5 / 79.8 / 119.6（改前 19.1 / 22.9 / 21.4，改后 47.4 / 60.9 / 56.5） | `studies/review-mofs.md` |
| mofs 密度 | 9.60 s coverage 0.711（改前 0.203）；edges 0.319（0.040→0.241）；motion 35.2（0.73→17.4） | 同上 |
| mech 版式 | 纸白 0.244 / 0.333 / 0.401 / 0.296；卡宽 0.867；字幕单行 48 px、基线 1224 | `studies/review-mech.md` |
| mech 运动 | 推进窗 pix_diff 1.48（复现 0.65）；峰 3.68@20.133（复现 0.99@20.767） | 同上 |
| pieces 三层 | 世界 T 保留 0.156；字幕 T 27552（修后 46204）；世界 T 15932（9729）；帧差均值 5.33（1.76） | `studies/review-pieces.md` |
| rotor 主体 | 宽 52.0% → 50.2%；高 91.5% → 68.1%；剖切区 8.3–89% | `studies/review-rotor.md` |
| camera38 速度 | 拉开横移 +86.8 px/s（复现 +213.9）；飞跃纵向 −12.7（复现 −81.8） | `studies/review-camera38.md` |
| gpt 影调 | val 5.6 s 11.1 / 42 s 15.0 / 124 s 15.5；sat 192.0 / 121.7 / 134.9 | `studies/review-gpt.md` |

### 2.3 文字、文案与阅读

| 量 | 值 | 来源 |
|---|---|---|
| 字幕换行停留 | 中位 1.84 s、均值 2.00；p10 0.60、p25 1.10、p75 2.60、p90 3.47 | `studies/mofs.md` |
| 每行字数 | 中位约 18 字（扣英文缩写 15–18）；p90 约 27；实测 6–21 最常见 | 同上 |
| 字宽标定 | 6 字 = 246 px → 41 px/字；1080p 字高约 50 px | 同上 |
| 阅读速度 | 中位约 8.0 字/秒（p25 5.7 / p75 9.6 / p90 12.3）；短标签 3.1–4.0；长解释 7.9–9.3 | 同上 |
| 数字句放慢 | 7.2 字/秒，比同段 9.3 慢约 23% | 同上 |
| 开场句 | 3.70 s（一句 + 一个实体道具）；单动作句 1.53–1.71 s | 同上 |
| 名词解释三槽位 | 1.21 → 2.03 → 2.11 s（递增） | 同上 |
| 最长单句 | 8.94 s 未换行；最长连续静音 0.86 s | 同上 |
| 对比度 | 正文 4.5:1、大字 3:1（WCAG 2.2） | `studies/type-color.md` |

### 2.4 声音事件的时间与电平

| 量 | 值 | 来源 |
|---|---|---|
| 掠过提前量 | 最近点前 0.15–0.45 s 进入，随后回落 | `assets/style-lab/guides/sound-design.md` |
| 小状态确认 | 0.08–0.25 s 短声，提交时触发一次 | 同上 |
| 帧/采样换算 | 30 fps 一帧 33.33 ms；48 kHz 一采样 0.0208 ms | 同上 |
| 情绪段 RMS | 快 −11.08 / 慢 −22.00 / 停 −9.53 dBFS | `studies/emotion-motion.md` |
| 全片 RMS | shuffle −17.284 dBFS（100 ms 中位 −18.031）；syy −15.33 dBFS；mech 均值 −12.1 dB | `studies/shuffle-sound-signal.md`、`syy-signal.md`、`anatomy-mechanics.md` |
| 低能量窗判据 | 10 ms RMS < −45 dBFS 且 ≥250 ms → 0 段；100 ms 下四分位 −19.70 dBFS 且 ≥300 ms → 23 段 | `studies/syy-signal.md` |
| 避让参数（试做起点） | 预下降 100–250 ms、恢复 300–800 ms；`g = 10^(dB/20)` | `studies/sound-design.md` |
| 响度标准 | EBU R128 −23.0 LUFS、≤−1 dBTP（广播工作流，非本库强制） | 同上 |

---

## 3. 复现与评价闭环

每支片按同一口径走一遍，结论写回 `studies/review-<片名>.md`：

1. **同口径测**：参考与复现用同一分辨率、同一算子（`pix_diff` / `hist_diff` / `sat` / `val` / `edges` / `grid`），帧差在不同分辨率下不可直接比。参照 `studies/review-blend.md` 的分辨率核验（960 宽重算 61.55 vs 记录 60.07）。
2. **先核位置再核速度**：`review-camera38` 的教训——像素流很快时主体可能已被推出画；先核主体屏幕位置，再核速度。
3. **分项记账**：影调用"均值 + p10/p90 + edge"三项，不用单一亮度；运动用分段 `pix_diff` 分布，不用全长均值（`review-gpt`：一条速度表满足不了 41 s 与 50 s 的 2.7 倍差）。
4. **改前/改后两列并列**：只写实测，不写"看起来更接近"。表格形制见各 `review-*.md`。
5. **保留"仍不合格"**：每份 review 必须有一节列出未通过项与未测项（音画同步、主观听审、1:1 重测等），不把未测写成通过。
6. **下次改进写成动作**：每条给一个可执行的下一步（重画、换地平线法、按事件密度分段、改整卡亮度脉冲）。

可运行的复现入口（`assets/style-lab/lab/`）：

| 片 | 入口 | 复现 API |
|---|---|---|
| shuffle | `repro-shuffle.html` | `window.__repro`：`duration / fps / pips / cycles / phases / setTime / toDataURL` |
| pieces | `repro-pieces.html` | 无全局 API；按 KEYDOWN 逐帧 |
| mofs | `repro-mofs.html` | `window.__repro`、`window.__showGuides` |
| camera38 | `repro-camera38.html` | `window.__api`、`window.__ready` |
| mech | `repro-mech.html` | `window.repro`：`setT / play / pause / render / getState` |
| rotor | `repro-rotor.html` | `window.__repro` |
| ui | `repro-ui.html` | `window.__repro`：`duration / frames / params / onsets / setTime` |
| gpt | `repro-gpt.html` | `window.__renderAt`、`__frameStats`、`__stats`；常量 `PARAMS / TRACKS / TRACK_RGB` |
| magpie | `repro-magpie.html` | `window.__magpie`、`__magpieOnsets` |
| blend | `repro-blend.html` | `window.__repro`：`duration / cuts / s3cross / measureAt / statsNow` |

静帧证据：`assets/style-lab/lab/shots/`（各片 s1–s4 关键帧 PNG）。

---

## 4. 已知缺口

按影响排序，全部是"技能里还没有复现或研究不足"的部分，不是待办清单的随手摘抄。

### 4.1 复现层面明确未通过

- **blend S2/S3 构图重画**：S2 原片是斜槽俯拍入盆全景（水平地平线 + 左侧暖黄林带 8.6%），复现是竖直水幕 + 右侧孤立金团（2.4%）；S3 原片是斜槽大平面 + 右侧白桦林出口，复现是 6 根等宽立柱。属重画不是调参。白闪切点（f181→f182 帧差 30.4 vs 42.6）也偏弱。来源 `studies/review-blend.md`。
- **rotor 截面封口**：当前剖切仍是"端盖缩放退场"，不是真截面封口；缺排气、线束、底座（高度差 23.4 点）；C 段约 84°/2.1 s 仍在转。来源 `studies/review-rotor.md`。
- **ui 亮场段与运动预算**：全片 `pix_diff≥1.0` 只到 12.7%（原片 67.1%）；0–8 s 与 17–22 s 仍是静帧；白底蓝色同心环没做（原片 174.4 亮度 / 34.1% 蓝占比 vs 复现 238.7 / 2.2%）。来源 `studies/review-ui.md`。
- **magpie 构图与饱和**：S4 五秒半是静帧（1% 运动）；S1 仍暗 28 个单位；饱和配比错（S5 段 127.4 vs 110.7，S7 @12.0 105.4 vs 73.2）。来源 `studies/review-magpie.md`。
- **mech 运动量**：推进 0.65 / 1.48（44%）；滚动 0.28 / 4.39（6%）；卡内仍是大色块。来源 `studies/review-mech.md`。
- **mofs 亮度与运动**：亮度差 32–63 点；9.60 s 运动只到一半；211.30 背影无纹理。来源 `studies/review-mofs.md`。
- **pieces 偏亮与细节**：整体偏亮 1.2–1.4 倍；世界层细节只有六成（9729 vs 15932）。来源 `studies/review-pieces.md`。
- **camera38 纵向与影调**：S4 纵向仍 −75.4（未测，须换地平线法）；S2/S3 场景细节不足；S1 拉焦前 69% 不动、末段跳 27pp。来源 `studies/review-camera38.md`。
- **gpt 分段速度与色相**：41 s 窗运动仍低 48%；117.7 s 冲击 1.44 vs 11.84；亮度质心 x 0.57 vs 0.44。来源 `studies/review-gpt.md`。

### 4.2 研究有观察、没有量化

- **thud / 低频重音的具体频段与时长**：本库只有 syy 的三段统计（20–120 / 400–1200 / 4–10 kHz）与"低频降 8–11 dB"的呼吸结论，**没有针对单个重音事件测过频段、中心频率、衰减时长**。不要凭听感填数。
- **whoosh 的精确提前量与包络形状**：`guides/sound-design.md` 给的 0.15–0.45 s 是试做起点，不是从哪支片量出来的。
- **缓动曲线的 RMSE / 拟合残差**：`studies/rate-curves.md` 只给设计起点与代码注意点，**没有对参考片拟合过曲线参数**；复现评价用的是 `pix_diff`/速度，不是贝塞尔残差。任何"cubic-bezier(x,y,x2,y2) 拟合误差 X%"的数字目前都没有来源。
- **音画同步的主观听审**：所有研究都注明"未完成主观听审"；blend、gpt、magpie、ui 的音频只验了渲染成功与 onset 数。`studies/` 里没有一份经过人工听审的结论。
- **Lemo 原片观看**：完整来源影片观看为 0；157 张缩略帧不等于看过 157 部片。样式选择只能读 STYLE/DEMO/源码或镜头提示。

### 4.3 技能里完全没有的方法

- **三维截面封口几何**（CSG 剖切面 + 盖面 + 接触阴影）：`guides/mechanics.md` 明确"不是任意网格布尔剖切"；`guides/metal-electronics.md` 的玻璃剖视是预移除几何。要真剖切需另建。
- **真实流体求解**：blend 只有逐帧差，没有流场；WaterPro 是 FFT/Gerstner + 平面反射近似，不是路径追踪，也不是 CFD。`studies/production-water-lessons.md` 已划边界。
- **生成式视频 / 重绘**：`studies/camera-depth.md` 里 149.2–149.5 s 那段 0.3 s 叠化只能判"生成式过渡"，没有可复用的生成管线。
- **多语言 / 多语速字幕排版**：字幕参数全部来自中文单行 1080p（mofs 117 条），英文、竖屏 9:16、双行拆句时的行高与基线未测。
- **竖屏适配**：ui 与 magpie 的原片是竖屏容器取 16:9 条带，其余研究均为横屏；没有一份竖屏安全区与字幕位置的量化。
- **长期记忆/自动排期**：本文件负责"查"，`assets/style-lab/examples/auto-select/select.py` 负责"排"——输入 brief 输出逐拍时间轴与声音层，支持 `--technique` 反查。两者都只做技法层面的建议：题材事实、科学数值、真实资产仍须人工确认；选型器匹配不到关键词时写进 `unresolved`，不猜。竖屏与 45 秒以下短片的段预算仍有实现边界，见 `guides/auto-select.md`。

---

## 5. 索引维护

- 新增研究：先落 `assets/style-lab/studies/<名字>.md`，再在 §1 加一行、§2 加可追溯数字、§4 删掉已补的缺口。
- 新增可运行入口：放 `assets/style-lab/lab/repro-<名字>.html` 或 `lab/<模块>.html`，并在 `lab/index.html` 挂链。
- 新增候选：写进 `assets/style-lab/lab/modules/<模块>.js` 的 `candidates` 数组，id 用 `<模块>-<动作>` 形式，随后在 `modules/index.js` 注册。
- 每条数字必须带来源文件；来源写不出文件名时，这个数字不属于本索引。
