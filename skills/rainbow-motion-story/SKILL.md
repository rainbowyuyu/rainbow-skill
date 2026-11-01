---
name: rainbow-motion-story
description: 把视频参考、文案、情感配音、音乐音效、运镜、机械拆解、文字配色、网页审美、Motionface 动效、Lemo Opuscar 风格和 WaterPro 等成熟制作方案串成可执行流程与代码候选；用于技能研究、分镜试做、整片重构或科普视频制作。
---

# 从一个可见的问题，到一部连续的影片

先分清任务是研究、局部优化还是整片重构。最新用户要求决定主题、主角与改动范围；旧作品提供经验和回退，不能限制已授权的新构思。仅整理技能时不启动影片渲染。整片重构须完成实际作品，不能把选用清单当作成片。

## 入口与制作次序

整合多条技能线或重构影片，先读 [整片导演流程](assets/style-lab/guides/integrated-direction.md)。从观众要理解的一个问题出发，把文案、实体、摄影机与声音写入同一份镜头约定，再按需读取下表。完整历史技法和既有案例保存在 [技法手册](references/technique-handbook-20261023.md)，无需每次全读。

**三个先查的入口**（不要凭印象挑技法）：

- [技法总索引](references/technique-index.md)：按"观众此刻要解决的问题"查表，27 行主表 + 量化参数速查 + 已知缺口。做片时先在这里定位，再读对应指南。
- [自动选型器](assets/style-lab/guides/auto-select.md) + `examples/auto-select/select.py`：给一份 brief（主题/时长/画幅/语气/要讲清什么），输出分镜级技法安排与声音层；支持 `--technique` 反查。
- [学到→复现→评价→调整闭环](references/reproduce-review-loop.md)：每次学新参考都走这条，六种证据等级不能混写。

1. **定位事实与当前工程。** 查最新人类要求、成片版本、实际资产和来源；区分论文结果、本次计算与原创示意。记录可播放原片的实际观看范围。
2. **设计因果故事。** 每段只推进一个观众判断，写明变化之前、发生的动作、结果和新问题。给出结构不同的候选，选择最能解释内容的一种，不等用户批准日常选择。
3. **分配音乐与注意力。** 实际分析用户曲目；旁白自然合成后校时。复杂机制有稳定观察窗，明确结果可让音乐接管。高潮由前面的任务推动。
4. **挑选技法并试做。** 每段先定观察任务，再查对应模块和 Lemo 源条目；记录比较过的候选、选用理由、代码入口与转换锚点。广泛使用技法指它们各有用处，不以叠加数量评判质量。
5. **统一状态后制作。** 实体、公式、路径、标注和音效读取同一事件/状态；场景采样由绝对帧或固定数据驱动。先验开场、最难机制和高潮，再扩展全片。
6. **检查并回写。** 分别检查数值、几何、连续画面、讲解与声音、编码。修复后重查受影响段及接缝；只把验证过的方法回写技能，题材参数留在工程里。新参考首次学习、复现与评价按 [学到→复现→评价→调整闭环](references/reproduce-review-loop.md) 执行，逐条标注证据等级，回写前过门槛检查。

## 按当前问题取用模块

以下链接均在本技能内。样例分布于 `assets/style-lab/lab/modules/`、`lab/` 和 `examples/`；下表中的裸文件名从对应指南或 API 查实际路径。

| 要解决的问题 | 首读资料 | 可复用入口 |
|---|---|---|
| 想复用旧工程的成熟方案、避免重复踩坑 | [成熟方案路由](assets/style-lab/guides/production-toolkit.md)、[生产方法与证据](assets/style-lab/studies/mature-production-recipes.md) | 四种时钟、镜头交接、文字身份、事件声音、可恢复渲染和共享依赖 |
| WaterPro、水面闪烁、河面倒影、浮标与水不一致 | [水体路线与证据](assets/style-lab/studies/production-water-lessons.md)、[环境技能接入](../rainbow-atmospheric-scene/references/waterpro-reuse.md) | 原生接入与版本约束；[原创水体数学 API](assets/style-lab/examples/production-toolkit/API.md) |
| 讲不清、故事无推进 | [文案与剪辑](assets/style-lab/guides/script.md)、[MOFs 操作式命名](assets/style-lab/guides/mofs-writing.md)、[洗牌解释](assets/style-lab/guides/shuffle-story.md) | mofs-explanation.js、shuffle-explanation.js、inspect_story.mjs |
| 音乐突兀、全程太满 | [音乐主导剪辑](references/music-led-edit.md)、[节奏](assets/style-lab/guides/rhythm.md) | rhythm.js、源曲/成片/解释时间映射 |
| 配音平淡、语气单一、后期慢放不自然 | [Qwen 本人配音](../rainbow-qwen-narration/SKILL.md)、[逐句表演](assets/style-lab/guides/expressive-voice.md)；历史比较见 [TTS 选型证据](assets/style-lab/studies/expressive-tts-options.md) | `D:/projects/tts/qwen_local_voice.py`；本地本人克隆、编辑/听审表演意图、真实句长、独立音乐留白 |
| 声音抢话、动作没重量或需要生成场景音效素材 | [音效时机](assets/style-lab/guides/sound-design.md)、[疏密选择](assets/style-lab/guides/shuffle-rhythm.md)、[苏诺音效接入](../rainbow-suno-sound-effects/SKILL.md) | sound-design.js、动作事件表；按场景选用 Suno.cn 音乐/音频处理，音效归档到 `D:/projects/tts/音效`，事件同步与分轨试听 |
| 音乐有节奏、画面却断开 | [声画接力](assets/style-lab/guides/syy-rhythm.md)、[syy 逐段研究](assets/style-lab/studies/syy-rhythm.md) | signal-relay.js：持续轨迹、焦点交接、三种音乐／音效编排；[分轨工作台](assets/style-lab/lab/syy-rhythm.html) |
| 缓动单一、动作没情绪 | [速率曲线](assets/style-lab/guides/rate-curves.md)、[运动情绪](assets/style-lab/guides/emotion-motion.md) | rate-curves.js、emotion-motion.js |
| 穿梭、希区柯克、子弹时刻、第一人称、离体 | [运镜](references/modules/camera.md)、[焦点与景深](assets/style-lab/guides/camera-depth.md) | camera-flight.js、camera-time.js、camera-depth.js |
| 镜头交接生硬、快速运动看不清 | [连续交接](assets/style-lab/guides/continuity.md)、[曝光与跟随](assets/style-lab/guides/transmission-effects.md) | continuity.js、transmission-effects.js |
| 片头漂亮却无主题、物件转换认不出 | [象征物片头](assets/style-lab/guides/symbolic-title-sequence.md)、[喜鹊片头美学研究](assets/style-lab/studies/magpie-title.md) | symbolic-titles.js：轮廓接力、负形入口、双世界共享物件；[三候选工作台](assets/style-lab/lab/symbolic-titles.html) |
| UI 动作割裂、素材跨面板跳位 | [界面连续编排](assets/style-lab/guides/ui-continuity.md) | ui-choreography.js：同一资产、裁切交接、提交与阅读窗口 |
| 想用有体积的线稿讲结构与流程 | [线稿语言](assets/style-lab/guides/linework-language.md) | engraved-mechanism.js：局部排线、实体遮挡、纸白拆装；[四候选工作台](assets/style-lab/lab/ui-line-studio.html) |
| 拆解错位、遮挡和操作脱节 | [机构](references/modules/mechanics.md)、[可拆解原理](assets/style-lab/guides/anatomy-mechanics.md)、[转子交互](assets/style-lab/guides/rotary-interaction.md) | mechanics.js、switch-session.js、rotary-session.js |
| 需要真实 Blender 模型、液体碰撞与路径追踪 | [Blender 原生流程](references/modules/blender.md)、[建模与动画](assets/style-lab/guides/blender-model-motion.md) | build_waterfall.py：建模、Mantaflow 烘焙、Cycles 渲染；[流水研究室](assets/style-lab/lab/blender-flow.html)、[脚本接口](assets/style-lab/examples/blender-flow/API.md) |
| 机器人解说缺少空间关系、大角度运镜与数据脱节 | [空间解释镜头](assets/style-lab/guides/robot-spatial-explainer.md)、[RoboCup 源帧研究](assets/style-lab/studies/robocup-blender.md) | build_demo.py：实体建模、射线命中、距离代价场、A* 路径、局部开盖与连续相机；[Blender 研究室](assets/style-lab/lab/robocup-blender.html) |
| 公式、数值和实体割裂 | [可视化](references/modules/visualization.md)、[纸面与方向场](assets/style-lab/guides/generative-style.md) | visualization.js、paper-space.js、generative-flow.js |
| 学习 3b1b、公式变形缺乏来由、图形与读数不同步 | [公式与图形语言](assets/style-lab/guides/manim-formula-language.md)、[官方源码研究](assets/style-lab/studies/3b1b-manim-source.md) | [Manim 研究室](assets/style-lab/lab/manim-formula.html)：四段原创 CE 原生渲染，符号复制、割线极限、矩阵基向量、旋转投影；[API](assets/style-lab/examples/manim-formula/API.md) |
| 文字显露生硬、对象与结论缺少交接 | [Motionface 文字与图形方法](assets/style-lab/guides/motionface-type.md)、[来源研究](assets/style-lab/studies/motionface.md) | 卡片汇聚、遮罩排字、焦点接力、轨迹组装、环字落定、对象接棒；[可编辑工作台](assets/style-lab/lab/motionface.html) |
| 路线只是装饰，缺少观测和执行过程 | [在线规划示例](assets/style-lab/examples/drone-delivery-rebuild/API.md) | replanning-example.mjs：观测、候选、提交、跟踪、重规划 |
| 配色只换色、材质与文字没层次 | [审美方向](assets/style-lab/guides/aesthetic-direction.md)、[文字与色彩](assets/style-lab/guides/type-color.md)、[材质](references/modules/look.md) | aesthetic-direction.js、type-life.js、look.js |
| 网页像模板、层级与用途不匹配 | [网页审美](assets/style-lab/guides/web-aesthetic-direction.md)、[见构 UI 研究](assets/style-lab/studies/jiangou-ui.md) | web-aesthetic.js：内容约定、三种结构、角色变量与选用导出；[网页工作台](assets/style-lab/lab/web-aesthetic.html) |
| 金属像塑料、玻璃与电子层级讲不清 | [金属与电子](assets/style-lab/guides/metal-electronics.md)、[Redknot 源帧研究](assets/style-lab/studies/redknot-glass.md) | glass-package：金属反射、同轴拆装、铜线与通孔追踪；[三候选工作台](assets/style-lab/lab/glass-metal.html) |
| 想比较更多媒介和视觉表达 | [Lemo 使用指南](assets/style-lab/guides/lemo-opuscar.md)、[157 项图谱](assets/style-lab/lab/lemo-atlas.html) | lemo-catalog.json、[14 项原创试作](assets/style-lab/examples/lemo-opuscar/API.md) |
| 接入长片、正式成片验收 | [生产交接](references/production-camera-music.md)、[V05 实战经验](references/case-study-pid-v05.md)、[V06 状态与渲染经验](references/case-study-pid-v06.md)、[V07 连续运镜与像素修复](references/case-study-pid-v07.md)、[验收](references/review.md) | 场景指纹、接缝审查、分轨听审；V06 用于同条件回放、机载视角、缓存恢复与状态同步声音 |

正式制作再结合 `rainbow-cinematic-video` 的逐句音画、数学、配音和交付流程；水体、云、自然光场读取 `rainbow-atmospheric-scene`。短片、封面及发布文案分别按当前需要读取 `rainbow-science-short`、`rainbow-video-cover`、`rainbow-science-promo-copy`，不一次加载所有技能。

动作接口、机体宽度航廊、飞行仪表、材质伪影和逐词动作同步，另见 [V08 PID + VLA 实战](references/case-study-pid-v08.md)。

## 一份镜头约定贯通各模块

每段至少保存 `question / evidence / before / action / after / nextAnchor`，以及 `stateSource / narrationCue / musicWindow / selectedTechnique / lemoSource / camera / labels / soundEvents / review`。规划时允许空时刻，正式制作前以自然语速句源和音乐实测补齐。

- **时钟与数据。** 成片时刻负责剪辑，物理/解释时刻控制回放与冻结，相机有独立路径时刻，源曲时刻定位音乐；四者映射显式保存。冻结时相机可移动，所有需要冻结的物体、粒子、姿态和数据使用同一解释时刻。科学数值不通过审美缓动改写。
- **身份与空间。** 同一物体、公式符号和路径 ID 跨镜保持。真实父子关系、单位、轴、装配位姿和线缆端点独立于镜头控制。遮挡由深度处理；二维绘制顺序不能当三维透视。
- **生命力与可读性。** 先让观众看到变化，再突出词句与结果，留阅读窗口，交回实体。持续缩放或闪烁不能代替语义动作。数据色有稳定含义，文字不被景深和运动模糊吞没。
- **文字与图形的终态。** 先排好完整句子与最终结构，再按语义组揭示；保留对象 ID、字形和基线。扫光与清晰字面分层，描线按实际弧长推进；对象首次出现与后续焦点切换分开，避免每个段落都重新入场。长句、反向定位、末帧与低动态模式均需检查。
- **声音与动作。** 接触声读取接触事件，掠过声读取实际相对速度，确认声读取提交事件。音轨响度合格仍需核对对白遮蔽；未实际试听不能声称听审通过。
- **声音与故事。** 每段根据提问、解释、对照、揭示、蓄势或收束选择一种主语气；个人音色保持一致，重音来自句义。2026-10-31 起新配音默认已有本地 Qwen3-TTS-0.6B Base + 本人参考，按上述技能核对本地入口；表演意图不冒充Base原生参数；Fish 停用，不静默回退。先自然合成、量真实句长，再排镜头与字幕；完整句后让音乐接手，不统一慢放或强压缩制造表现。旧片音轨和历史研究保留，不因此重录。
- **大胆但连贯。** 每个段落可尝试不同媒介：先保存结构、数据和空间锚点，再改变表达。正式场景和图解通过同一物体、路径或构件交接，不能靠淡入淡出隐藏跳位。

## 研究和表述的证据边界

HTTP 成功、标题、静帧、连续观看和听审分别记录；参考语气与事实分别核对。记录 `参考时间窗/观察 → 当前问题 → 原创代码 → 检查结果`。不复制原片水印、未经许可的音乐或角色。

Lemo 当前固定提交为 `3961ddb3d24d8876e0e2754f7790d66908acee51`：59 种 ready 风格、98 份电影档案、157 张来源缩略帧，14 项原创局部试作；完整来源影片观看为 0，原片主观听审未完成。使用具体风格时读它的 STYLE/DEMO/源码或镜头提示，并针对使用的动作进一步检查。代码 MIT、来源帧 CC BY 4.0，第三方素材和特殊声音许可另核对；详见图谱的逐项记录。

Canvas 预演、程序化候选和点云各按实现命名；不能当作光追、真实流体、训练扩散或高斯重建实测。展示模型能力时说明来自哪份计算/模型/论文。实时规划的“思考感”来自新观测、候选代价、约束淘汰与真实提交，不编造内部推理或任意抖动路径。

用户授权重构时先完成叙事改写，成稿再按 `C:/Users/USER/.agents/skills/lieflat-less-ai-tone/SKILL.md` 的实际规则清理。保留事实与限定，不用检测分数证明作者身份。

## 代码复用与交接

运行库在 [assets/style-lab](assets/style-lab/)，`python serve.py` 启动。沿用工程已有共享依赖，不复制 node_modules。多数预演支持 `sample(t, options)` / `draw(ctx,t,w,h,options)`；导入前核对实际 API，任意定位与倒序采样应一致。

新片应留下：来源清单、故事与音乐安排、镜头约定、选用方法、可执行代码、实际检查记录及交付路径。当前 [无人机送水完整重构任务书](assets/style-lab/examples/drone-reconstruction/BRIEF.md) 展示如何组合全部技能线，它是一个具体案例，不把无人机、PID、配色或时长变成其他影片的固定模板。
