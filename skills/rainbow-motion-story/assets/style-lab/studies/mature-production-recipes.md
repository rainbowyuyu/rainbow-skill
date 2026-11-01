# 已有成熟方案：复用入口与证据索引

核对日期：2026-10-24。范围是已有源码、技能指南和保存的 QA 报告；本轮没有重渲染旧片、重新试听或重新核验整片审美。这里把已有方案串起来，不复制它们的完整教程。WaterPro、水面、云和自然光场由 `rainbow-atmospheric-scene` 的专项入口负责；本页负责它们接入影片后需要共同遵守的状态、摄影机、文字、声音与交付方法。

**成熟指“有可调用代码和明确检查记录”，不等于任何题材、任何机器直接套用都已经通过。** 用到一个配方时，只读该行的指南、接口及检查边界。旧案例的数值、帧号、音乐和人物不是下一片的默认值。

## 五条生产路径

| 当前问题 | 可直接复用 | 先读 | 验证与仍需检查 |
|---|---|---|---|
| 水、浮标、公式、路径或声音各走各的；暂停/倒序后状态不同 | 绝对时刻采样、同一状态源与四种时钟 | [连续交接](../guides/continuity.md)、[基础 API](../lab/modules/API.md)；全局技能 `references/case-study-pid-v06.md` | 顺序无关状态与样例几何已有检查；接入真实物理数据后仍查单位、实际状态和视觉遮挡 |
| 从外景接实体视角时翻转；多个镜头串联后滚转或镜头偏移累积 | 相机适配、正焦距、姿态球面插值与实际安装点 | [相机](../guides/camera.md)、[景深](../examples/camera-depth/API.md)；全局技能 `references/production-camera-music.md` | Canvas/Three 投影与乱序定位已查；仍查穿模、竖直视线退化、主体构图及正常速度观看 |
| 字幕/标签反复跳、公式换位失去身份、配色覆盖了数据意义 | 固定字位、语义阅读窗、对象锚点与颜色角色 | [文字与颜色](../guides/type-color.md)、[Motionface 方法](../guides/motionface-type.md) | 几何、稳定阅读状态、指定背景对比及浏览器样帧有记录；真实背景与编码后可读性重新检查 |
| 语速变形、配乐盖词、音效比动作晚或一直太满 | 自然句源、事件驱动声音、旁白/阅读窗避让 | [声音 API](../examples/sound-design/API.md)、[节奏](../guides/rhythm.md)；`rainbow-cinematic-video/references/audio.md` | 音效波形、同步、导出及历史成片 AAC 信号已查；没有由这些检查证明主观听感或发音正确 |
| 渲染中断要重来、旧帧混入新版、依赖重复占空间 | 输入指纹、自管帧缓存、临时输出再核验、锁文件分组共享依赖 | `rainbow-motion-story/references/case-study-pid-v06.md`；`rainbow-cinematic-video/references/quality-delivery.md` 与 `storage-cleanup.md` | 已用于完整片并保留报告；历史渲染入口有本机路径/端口，迁移前必须适配；本轮不执行清理 |

## 1. 同一状态驱动画面，分别映射四种时钟

**当前真实接口**

- `lab/modules/index.js` 导出 `candidateById`、`candidates`、`modules`。候选具有 `sample(t, options)` 与 `draw(ctx, t, width, height, options)`；正式接入时保留 `id`、单位和 `loop` 语义。
- `lab/adapter.js`：`drawFrame(canvas, {id, frame, fps=30, width=1920, height=1080, options={}})`。按绝对帧渲染并返回状态；不创建另一条现实时间动画。
- `lab/camera-driver.js`：`sampleCameraShot(id, frame, fps=30, options={})` 返回 `filmTime / shotTime / worldTime / camera / state`；`applyCameraShot(camera, shot, updateWorld)` 强制提供绝对时刻更新函数。
- `lab/modules/camera-time.js`：`actionClock(t)` 返回 `worldTime / temporalRate / frozen`。它是当前 12 秒子弹时刻示例的时间映射，不是所有视频的固定节奏。

**复用条件**：成片时间只负责剪辑；解释/物理时间控制实际状态采样；相机可以独立运动；音乐保留源曲时刻。冻结需要同时冻结实体、子部件、浮标、粒子、轨迹及数值，视角相关反射仍可改变。给计算值加“弹性超调”会改变科学含义，不能拿运动设计替代真实值。

**可查证据**

- 连续性数值报告（外部或本机资源，未随公开包收录）：2,882 个状态样本、50 个几何样本、20 次 Canvas 绘制；记录刚性安装点、对象身份、稳定阅读窗、公式基线与任意定位。报告明确不验证真实飞行、光追或参考原片复刻。
- 可视化修复报告（外部或本机资源，未随公开包收录）：路径点 ID 和移动标记共用折线；路径在过去的侧视退化区仍有可读宽度；速度箭头在零点先收缩再换方向。本报告是状态/几何检查。
- 对应浏览器记录（外部或本机资源，未随公开包收录）：列出实际查过的候选、时刻和接缝；不是连续人工逐帧观看。
- 实战来源：`D:/projects/manim_extend_rainbow/video_project/pid_embodied_control/source/v06/State.ts`、`Physics.ts` 及 `docs/v06/state-validation.json`。2026-10-24 读取该报告仍为 `passed:true`，包含绝对帧/分段回放一致性、传感器交接、讲述时刻与过冲事件对应。未重新运行整片。

## 2. 相机换镜保持真实位姿与投影

**当前真实接口**

```js
import {sampleCameraShot, applyCameraShot, cameraEndpoints}
  from '../lab/camera-driver.js';

const shot = sampleCameraShot('camera-bullet-time', frame, fps, options);
applyCameraShot(camera, shot, (worldTime, state) => {
  updateSceneFromSavedState(worldTime, state); // 当前工程的绝对时间更新函数
});
const endpoints = cameraEndpoints('camera-bullet-time', fps, options);
```

`lab/adapter.js` 的 `applyCameraPose(camera, pose)` 会重置 up 后应用绝对 roll，同时重置遗留的 `zoom`、`filmOffset` 和 view offset，保留渲染器宽高比。`pose` 包含世界坐标 `position / target`、角度制 `fov`、弧度制 `roll`；默认主点为 `[.5, 480/900]`，若当前构图需要居中应显式提供 `principalPoint:[.5,.5]`。

全局技能的 `C:/Users/USER/.codex/skills/rainbow-motion-story/assets/camera-handoff.mjs` 另提供：

- `blendViewPose(THREE, a, b, progress, minFocus=.1)`：方向 quaternion slerp，正焦距独立插值，roll 取最短角差，再重建 target。
- `dollyFov(distance, framingConstant)`：稳定选定焦平面的投影尺度；需要相机真实移动才能产生背景视差。

**可查证据**：camera-adapter.json（外部或本机资源，未随公开包收录） 记录 364 个投影样本、91 个带遗留投影设置的相机用例，最大投影误差 `7.98e-13`；绝对 roll 和 world clock 转发通过。camera-expansion.json（外部或本机资源，未随公开包收录） 记录末帧保持、显式重播、阶段定位、反向 seek 像素一致性。

**边界**：相机助手不规划避障，不保证所有竖直视线的 up 向量不退化，也不检查实体是否遮挡机载镜头。外景进入机载视角必须取同帧真实安装点、四元数、FOV 与近远裁面；不要在画面里隐藏挡住镜头的机体来伪造视线。历史 V06 的 `docs/v06/encoded-voyage-fpv-review.md` 是真实翻转修复的来源，当前电影仍须对自己的交接前后画面复看。

## 3. 文字与公式有身份、有停留，配色有含义

可直接通过 `candidateById` 取以下候选，接口仍为 `sample/draw`：

- `type-semantic-emphasis`：语义重音交接，3.5–8.5 秒原示例保持词位、基线和对象静止。
- `type-anchored-label`：标签围绕当前测量点迁移，短引线与目标对应。
- `type-equation-identity`：V、I、R 的身份跨布局保持；同一量不因切换公式又冒出一个副本。
- `type-palette-attention`：目标、观测、误差颜色固定，改变注意力权重。

复杂入场从 [Motionface 六方法](../examples/motionface-type/API.md) 选；先排最终句子再揭示，阅读段的字形、基线不继续呼吸。字幕是另一条稳定信息层，不能把标题的切片/环绕效果套给每一句字幕。

**可查证据**：type-life-invariants.json（外部或本机资源，未随公开包收录） 五组不变量通过；type-life-review.md（外部或本机资源，未随公开包收录） 记录 60 Hz 状态检查、120 Hz 标签/公式轨迹避让及实际深浅色样帧。标签与点至少留 12 px，引线小于 110 px，数字只适用于该 1600×900 示例构图，生产时按比例和实际字长复核。[角色配色 JSON](../examples/color/role-palettes.json) 提供六套配方和逐色对比数据。

**边界**：指定纯色/渐变端点的对比度不是运动背景、辉光、透明度和视频压缩后可读性的证明。使用全局 `rainbow-cinematic-video/references/shot-contract.md` 与 `visual-style.md` 的字幕/主体安全区约定，检查最长句、两行字幕、来源和品牌同时在场的最坏帧；不要将“有 safe-area 配置”等同于整片文字不遮挡。

## 4. 自然旁白与事件驱动音效

**当前真实接口**见 [声音 API](../examples/sound-design/API.md)：

```js
import {getScenePlan, renderScene, visualState, encodeWav}
  from '../lab/sound-design.js';

const options = {sampleRate:48000, offsetMs:0, gainDb:0,
  intensity:1, includeSpeechPlaceholder:false};
const plan = getScenePlan('contact-sync', 'B', options);
const pcm = renderScene('contact-sync', 'B', options);
const frameState = visualState('contact-sync', 2);
const wavBytes = encodeWav(pcm);
```

cue 保存 `eventId / anchor / anchorTime / anchorOffset / start / duration / priority / gain / pan / seed / policy`。接触声对应接触事件；掠过声读取实际相对速度；结果确认声放在动作完成后。环境不因音效偏移滑块一起移动，阅读窗可移除低优先级装饰声音。主观“有冲击”与物理计算、真实录音分开。

配音继续复用 `D:/projects/tts`，调用前读它的实际说明；不把 TTS 项目、个人音色或密钥复制进技能。自然句源先合成、测长，再编排画面。不要通过直接降低 AudioBuffer 播放速率延长正式旁白——它会变调；当前声音工作台变速只是预览工具。

**可查证据**

- [qa-numerical.json](../examples/sound-design/qa-numerical.json)：五组 A/B、8 种程序合成音色，PCM 有限值、端点防点击、单声道相容、锚点同步及避让；B 接触样例主峰比设计接触晚约 2.375/3.521 ms。设计锚点和实测瞬态分别保存。
- sound-media.json（外部或本机资源，未随公开包收录）：FFmpeg 对实际 WAV 的格式与 true peak 测量，不改源音频。sound-design-browser.json（外部或本机资源，未随公开包收录） 记录音频时钟、seek、暂停、A/B、JSON/WAV 导出及移动尺寸。
- sound-delivery.json（外部或本机资源，未随公开包收录） 明确 `listeningPerformed:false`。占位信号不是人语，不证明中文旁白清晰。
- 实战 `video_project/pid_embodied_control/work/v06/qa/final-encoded-audio-report.json` 为 `passed:true`，范围是最终 AAC 的所有句头句尾和留白进出信号比较；`subjectiveListeningChecked:false`。原句源、时间线、音乐留白应与这份证据一起理解，不能改写为已人工听审。

真正进入成片时按 `rainbow-cinematic-video/references/audio.md` 保留 narration、score、premaster、master，针对实际旁白和 BGM 重新听审；响度和短窗能量余量是排查工具，不是机械地规定每首歌都压同样 dB。

## 5. 可恢复渲染、可核验输出与共享依赖

当前生产实现在 `D:/projects/manim_extend_rainbow/video_project/pid_embodied_control/scripts/v06/render.mjs`，这是**项目入口，不是通用一键工具**。实际接受 `--frames=A-B`、`--out=...`、`--frames-dir=...`、`--composition=...`、`--concurrency=N`、`--reuse-bundle`、`--preserve-timeline`、`--build-only`、`--stills`、`--audit`、`--prune-frames` 等参数。

可提取的生产方式：

1. 用真实 bundle、参与渲染的资产、composition、宽高、fps、props、绝对帧区间及质量构成 `inputs.json` 指纹；不匹配则拒绝复用旧缓存。
2. 自管逐帧目录，先写 `.partial` 再重命名；只请求缺失或明显截断帧。JPEG 首尾字节只是筛查，后续仍要解码。
3. 使用明确输入 fps、起始帧与帧数编码到 `.encoding.mp4`；`ffprobe` 核对帧数和尺寸再改为正式名，保存 `.render.json` 与 SHA。
4. 缓存只在编码通过并显式请求时删除。源码/状态改变后相关音效、分镜和截图证据失效，不能只更新文件名。

**已核对的历史证据**：`docs/v06/encoded-qa/report.json` 的 `passed:true`；`visual-review.json` 与之指向相同成片 SHA `48f51ac9dbada6776c0ca0514897ef92ea05e82924b23d5dd28ff2572128820e`。报告为 8,828 帧完整解码、11 个边界窗口、132 个灰度联系图样本、12 个彩色代表帧；视觉状态是 `passed-with-editorial-observations`，不是整片原速人工观看完成。本页只复核已有报告字段，未再次计算影片 SHA 或重新编码。

**迁移前必改**：该渲染脚本仍包含 V06 的 temp 目录、8842 端口、Chrome 路径、资产列表与 composition 默认值。复制思路时把这些改为当前工程显式配置；不能把旧帧缓存接到新片，不能直接用这个脚本替代新项目的入口。

依赖复用以 `D:/projects/manim_extend_rainbow/video_project/shared/DEPENDENCIES.md` 为本机证据索引，顶部最新记录优先。按完整锁文件与包内容分组，不因顶层 Remotion/Three 版本相同就强行合并。`node_modules` 可能是 Windows junction，不沿链接递归清理、不在共享入口直接 `npm ci/npm install`。

方法库的 `scripts/shared-runtime.cjs` 已支持显式现有 `package.json` 路径；例如 `node scripts/qa_camera_adapter.mjs --dependencies=<existing-package.json>`。它读取共享包而不安装依赖。旧 QA 脚本若还写死工作区路径或 8850 端口，先查看参数和源代码再迁移，不能笼统称所有测试都可脱离工作区运行。

全局 `rainbow-cinematic-video/scripts/inspect_preview.py` 的真实接口包含 `--video / --times / --seams / --out-dir / --decode / --loudness`；输出接缝前后样帧、联系表和 `inspection.json`。需要清理时再读 `references/storage-cleanup.md`，使用 `version_cleanup.py plan` 与 `apply` 的依赖保护流程。整理技能本身不触发旧工程清理。

## 以短路由接入，不再增加另一份巨型手册

技能入口只需链接本页，并保持现有专题入口：

> 正式采用已验证方案时，先查 [成熟方案与证据索引](mature-production-recipes.md)：按状态、相机、文字、声音、可恢复交付选择现有 API；水体/云/自然光查 `rainbow-atmospheric-scene`。复用机制与检查方法，不复制旧片题材参数；只有当前片实际复查过的项目才标已验收。

每次真实项目修复只更新原专题与一条证据条目：`故障 → 实际入口 → 复用条件 → 已查范围 → 未查范围 → 项目报告`。短路由保持稳定，长期证据留在对应专题或案例，避免多个技能保存互相矛盾的同一份长教程。

本轮落盘检查：23 个相对链接均存在；实际导入上述四个 `type-*` 候选、`camera-bullet-time`、`sampleCameraShot` 与 `getScenePlan`，五个候选在插入另一次采样后回到相同 `t` 的状态完全一致。子弹时刻 f120/30 fps 采得 `worldTime=2.225`，`contact-sync/B` 返回 3 个 cue。这个轻量接口检查不代替历史数值套件、浏览器检查、全片渲染或听审。`qa/selftest-current.json` 当前仍记录 50 候选的历史快照，不能引用它作为后续新增候选已覆盖的证据。
