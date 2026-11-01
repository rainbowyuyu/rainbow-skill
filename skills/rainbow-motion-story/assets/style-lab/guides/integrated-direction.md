# 从故事到成片：把技能接成一条生产链

本指南把写作、音乐、音效、运镜、速率、机构、可视化、文字和材质接到同一个故事与状态上。它适用于新片和完整重构；无人机送水是本次应用案例，不是以后所有视频的固定模板。

与本指南配套的[八段镜头配方](../examples/drone-delivery-rebuild/shot-recipes.json)处于 `planned-not-rendered` 状态。它提供候选及实现约束，没有生成成片，也没有替代实际仿真、旁白实录或完整审片。

本次完整重构的执行要求、研究底稿与交付顺序见[无人机送水任务书](../examples/drone-reconstruction/BRIEF.md)。接收线程先读任务书，再按这里的工作流选取局部技法。

## 先决定观众要跟着什么走

用一句可观察的任务串起全片。例如：“让一架带水的无人机，稳稳飞到另一端，把水交到人手里。”人物是否收到水是故事结果；误差如何减小是解释结果。宏大场景、公式和内部结构，都应该帮助观众看见这两件事。

每个段落写下 `question → before → action → evidence → after → nextQuestion`。先给对象或可见困难，再解释造成差异的机制。段落结束后，观众应能说出“发生了什么、为什么、接下来还缺什么”。只写“震撼开场”“高级材质”“炫酷转场”，还不能进入制作。

重构时先保存旧版的事实、资产权属和可复用代码，再写三个结构不同的开场候选。可以从一次失败倒回原因、从结果追问机制，或从一个微小部件展开到完整任务。三种调色不算三种叙事候选。旧版镜头顺序不自动继承。

| 生产问题 | 先读的模块 | 可直接试用的代码 |
|---|---|---|
| 有兴趣，也听得懂 | [故事逻辑](storytelling.md)、[文案](script.md)、[MOFs 文案研究](mofs-writing.md) | `lab/modules/storytelling.js`、`lab/modules/mofs-explanation.js` |
| 快剪以后还找得到同一对象 | [汽车连续性](continuity.md)、[洗牌叙事](shuffle-story.md) | `lab/modules/continuity.js`、`lab/modules/shuffle-explanation.js` |
| 界面重排仍能看清输入和结果 | [UI 连续编排](ui-continuity.md) | `lab/modules/ui-choreography.js`：跨容器交接、点击到结果 |
| 线稿需要体积、遮挡与工程阅读感 | [线稿语言](linework-language.md) | `lab/modules/engraved-mechanism.js`：黑场雕刻、纸白拆装 |
| 音乐什么时候释放，旁白何时停 | [音乐与呼吸](rhythm.md)、[洗牌节奏](shuffle-rhythm.md) | `lab/modules/rhythm.js`、`lab/sound-preview.js` |
| 同一声线怎样有轻重缓急 | [逐句表演](expressive-voice.md) | `D:/projects/tts/expressive_voice.py`：语气谱、真实句长、音乐窗口与失败恢复 |
| 什么动作值得听见 | [声音事件](sound-design.md)、[速度与情绪](emotion-motion.md) | `lab/sound-design.js`、`lab/emotion-motion.js` |
| 快慢、停留各在表达什么 | [速率曲线](rate-curves.md) | `lab/rate-curves.js` |
| 怎样进入空间和改变尺度 | [运镜](camera.md)、[焦点与景深](camera-depth.md) | `lab/modules/camera-flight.js`、`camera-time.js`、`camera-depth.js` |
| 怎么拆开，装回以后仍然正确 | [机构](mechanics.md)、[机械解剖](anatomy-mechanics.md)、[转子交互](rotary-interaction.md) | `lab/modules/mechanics.js`、`rotary-interaction.js`、`rotary-session.js` |
| 大角度镜头怎样带着数据走进实体 | [空间解释镜头](robot-spatial-explainer.md)、[Blender 源帧研究](../studies/robocup-blender.md) | `examples/robocup-blender/build_demo.py`：传感器→场→路径→内部，连续世界坐标 |
| 数据怎样长在实体上 | [可视化](visualization.md)、[生成过程](generative-style.md) | `lab/modules/visualization.js`、`generative-flow.js`、`type-life.js` |
| 公式怎样从实体中生长，并在变形中保持身份 | [Manim 公式语言](manim-formula-language.md)、[3b1b 源研究](../studies/3b1b-manim-source.md) | `examples/manim-formula/scenes.py`：显式复制分支、共享参数、基向量变换、相位投影；[原生研究室](../lab/manim-formula.html) |
| 同一部片的颜色和质感怎样统一 | [材料](look.md)、[审美](aesthetic-direction.md)、[文字色彩](type-color.md) | `lab/modules/look.js`、`aesthetic-direction.js`、`transmission-effects.js` |
| 当前问题适合哪种媒介 | [Lemo 图谱](lemo-opuscar.md) | `lab/lemo-catalog.json`、`lab/modules/lemo-trials.js` |

表中的裸路径均相对方法库根目录；同一行省略目录的文件位于该行已经写出的目录中。代码入口和真实候选 ID 以[模块 API](../lab/modules/API.md)及源文件为准。

`lab/rate-curves.js` 和 `lab/emotion-motion.js` 是实际状态/声音核心入口，分别导出 `sampleCurve/sampleMotion/buildTimeRemap` 与 `sample/getCueSheet/renderAudio`；交互页面由对应 `*-studio.js` 驱动。`lab/sound-preview.js` 含纯声音计划函数，也含需要浏览器 AudioContext 的试听器；离线声音制作优先用 `lab/sound-design.js`。

## 把参考拆成可迁移的方法

每一段选择一项主要观察任务，再查对应技能和 Lemo 条目。记录 `referenceId / commit / inspectedRange / borrowedMechanism / originalApplication / limitation`。参考可以教我们怎样揭示一个关系，不能替我们核实当前题材的结构与数据。

Lemo 的 `teardown` 用装配轴与局部标注讲内部关系；`lidar-survey` 用扫描前沿和统一锚点讲空间；`data-physical` 让数量变得可比较；`swiss-motion` 用网格和层级组织文字。将它们用在同一部片时，保持主角尺寸、标识、强调色和空间方向。只在观察任务改变时换媒介。

对每个候选先做“建立—变化—落定”三帧，再制作最难的一段连续动作。将候选放在相同讲稿、相同数据和同一段音乐下比较。记录选中理由，例如“实体和公式的关系更清楚”，不要只写“更炸裂”。

本库对 Lemo 的已知范围是59项可用风格与98项档案的文档分析、157张来源静帧的缩略联系表观察，以及14项原创静音技法试作。没有逐片完整看完全部来源影片，也没有完成来源音轨的主观听审。不得把这些范围写成157种风格均已完整复刻。正式镜头采用某个来源的时间结构前，还应完整查看相关动作及前后衔接。

## 一条主要视觉语言，多个局部解法

先做一张全片 look board：主角轮廓、三种主材料、天空和地面的明暗关系、一种关键强调色、固定字体层级。叙事用色保持语义稳定；选中路径与被拒路径除了颜色，还需线型和短标签区分。让图形在手机大小也能读懂。

大场景需要前景尺度物、中景主角和远景目的地。细节来自正确比例、构造接缝、合理粗糙度和光位；避免每个面都铺高频噪声。纹理绑定物体或世界坐标，灯光与几何共用空间。路面反射要随粗糙度与视角变化，水面要体现法线、吸收和环境；实现屏幕空间或近似反射，就准确标记实现，不把它写成光追。

材质切换必须有解释任务。外壳变成工程剖面，是为了看见传力和线路；地图转为空间点云，是为了看见新障碍及观测范围。保留主角的安装点与轮廓，切换后给观众一个稳定的观察窗口。透明材质不能解决前后遮挡错误。

[UI 与线稿的两组新研究](../lab/ui-line-studio.html)提供另一种交接：状态卡沿同一对象展开为工程图，图版讲完结构，再把实际结果收回原卡片。UI 重点检查对象身份、父级裁切与提交时机；线稿重点检查实体遮挡、局部排线和远景线密度。纸白图版可以承担停顿，黑场机构适合流程旅行；不要只因换媒介方便就给每段加一次变色。参考使用范围见 [MAX](../studies/max-ui-motion.md)与 [沁雨莲](../studies/qinyulian-linework.md)，当前新增代码为四个原创局部试作。

文字负责注意力，不复述屏幕上的整段旁白。每个阶段只强调正在发生的量；标题、标注和字幕保持少量稳定字号。标签从真实世界锚点投影，靠近对象并避开其他连线。背面部件的标签隐藏或说明遮挡，不能关闭深度测试强行透出。

## 从音乐编排开始，但不牺牲因果

[syy 声画接力研究](syy-rhythm.md)补充“连续运动里的重音”：对象与轨迹保持，局部强调接力，相机改角跨过事件，结尾由旧路径收束。三个原创候选把能量、声音密度和观察窗分开控制，适合在解释段和高潮之间试排。混轨周期候选不直接当作确定 BPM；音乐能量从音乐分轨测量，事件尾部与实际音频持续范围一致。

先听实际选用的曲目，记下乐句起落、主要重音、密度变化和可以留给环境声的间隙。本次无人机案例沿用用户指定的 `D:/CloudMusic/李化禹 - 唢风吟.mp3`，配方没有假定它的 BPM 或高潮时间；必须导入后重新标记。

每个解释段先确定观众必须听清的因果句，再安排动作。音乐密集时，可以把已经讲明的内容放大表现：一个完整飞行动作、多路径收束或装配闭合。高潮中的无旁白窗口要有可辨识的结果。不要把多个新概念塞进观众正在看大运镜的几秒钟。

旁白保持自然速度。想增加质感，就增加观察窗、延长镜头的抵达过程，或删掉重复解释，不整体拉慢声音。文案重构由故事需要决定；成稿再使用 `C:/Users/USER/.agents/skills/lieflat-less-ai-tone/SKILL.md` 做其规则内的清理，保留事实与限定条件。先听实际 TTS，核对术语、多音字、句尾和音乐遮蔽。

声音跟着事件表走。接触、扣合、通过镜头和路线确认各有自己的时间锚点；不要每条线和每个词都加 whoosh。近距离机械声可短、干、清楚；远景可以让风和空间承担尺度。主要解释句前后给声音避让窗口，ducking 的提前量、深度和恢复由实际音轨听审决定。静默保留必要环境底，不要误把播放器断音当作呼吸。

速率先服务表达。`minimum-jerk` 适合精密到位；`rush-hold-release` 适合快给结果再停住；`hesitate-commit` 适合可见的等待与确认；连续大运镜则需保持弧长速度、视线与滚转的连续。所有曲线都是候选，不是固定情绪字典。真实机体状态从控制或仿真数据读取，不能为了“弹性”给物理结果另加超调。

## 一个状态源，明确的时间映射

采用一个可序列化的项目状态，至少包含以下合同。

```text
identity  = objectId, partId, quantityId, candidateId, observationId
geometry  = restTransform, parentId, assemblyAxis, worldAnchor, bounds
physics   = pose, velocity, acceleration, force, actuatorCommand, units
control   = reference, measurement, error, P, I, D, saturation, filterState
planning  = observationTimestamp, candidates, rejectedIds, selectedId, reasonCode
camera    = position, quaternion/target, fov, roll, focusAnchor, focusDistance
story     = question, evidence, narrationCue, readWindow, handoffAnchor
sound     = eventId, semanticAnchor, onset, peak, end, priority, gain, pan
provenance= source, method, measured/simulated/illustrated, uncertainty
```

`renderTime` 是成片秒数；`worldTime` 是物理状态的采样时刻；相机使用自己的路径时间。子弹时刻可以让相机继续运动，世界缓慢前进；速度、液面、旋翼、曲线和数据标签必须读取同一个 `worldTime`。旁白 cue 以成片时间对齐，音乐另存 `musicSourceTime = musicMap(renderTime)`，保留源文件裁接和变速对应。统一记录 renderTime、worldTime、cameraTime、musicSourceTime 四个值；历史音乐指南的三时钟和相机指南的局部时钟分别映射到这些字段，不能只因同名就相互覆盖。

素材变速通过 `sourceTime = sourceStart + integral(rate(t))` 求值。相机路径先用弧长映射再缓动，不能把曲线参数当成距离。随机过程固定种子并存下样本；跳转、倒序定位和离线渲染应得到同一状态。渲染函数不依赖上一帧积累的副作用。

一段可接入的表现层写法如下；`simulationAt` 与 `plannerAt` 由实际项目实现，它们不是本库已有的飞控服务。

```js
// 核心合同：对象、数据和文字共用 worldTime；相机允许独立运动。
function sampleShot(renderTime, clocks, simulationAt, plannerAt, cameraAt) {
  const worldTime = clocks.worldAt(renderTime);
  const physics = simulationAt(worldTime);
  const planning = plannerAt(worldTime);
  return {
    renderTime, worldTime, physics, planning,
    camera: cameraAt(clocks.cameraAt(renderTime), physics),
    annotationSource: physics,
  };
}
```

镜头交接同时检查世界和屏幕。保存 `objectId / worldAnchor / screenAnchor / quantityId / sourceTime / cameraPose`。选择连续路径时检验边界位置与速度，视线变化也需连续；选择切镜时保留动作方向或关键对象。切镜可以有力量，连续漂移也可以有节奏，不必把全部转换糊成叠化。

现有摄影机适配入口是 `lab/camera-driver.js`，实际姿态适配在 `lab/adapter.js`。`sampleCameraShot(id, frame, fps)` 接收该镜头的局部帧；返回的 `worldTime` 也是示例局部时刻，不能直接当整片仿真秒数。先用显式偏置与时间映射转换为项目状态时间，再用同一世界变换映射 position、target、焦点锚点和距离单位，最后调用适配器。每段保存 sourceWorldStart、单位比例、坐标轴和主角锚点；接缝时比较转换后的状态。示例相机路径不是整部片已经连续、安全的航线。

## 无人机送水：怎样把技能用成故事

本次主线是“带着水抵达目标”。开场先见正在执行的任务，再用希区柯克变焦和短暂子弹时刻把观众带进误差、结构和路线。第一次总览只提示后面将解答什么，不在十几秒内完成全部讲解。

P、D、I 用同一无人机、同一目标及可控扰动说明。先看位置差怎样产生修正，再看接近目标时怎样减速，最后看持续侧风留下的偏差怎样消除。屏幕先给三项路线图，讲解顺序可以是 P→D→I，但公式位置固定；每次只亮当前项。还需说明这是选定外环的简化演示，真实多旋翼还包含姿态/角速度环和推力混合。

[新规划样例 API](../examples/drone-delivery-rebuild/API.md)提供恒高二维有限候选规划与点质量 PID 跟踪；它没有风场、传感器噪声、旋翼姿态或载荷液体动力学。样例只可接入对应的规划解释段。侧风 P/D/I 对照必须另建有单位、可重复的扰动实验，保持相同初态、风和目标，只改变待比较的控制项；不可把未知 `wind` 字段塞进样例后当它已经生效。三维大场景也不能把二维规划改个视角就宣称完成自由飞行规划。

采用密封水容器及明确安装结构。可以用一个有标识的透明训练容器展示液面响应，但不让运送过程凭空变成敞口杯。载荷质量影响惯性与控制；液面倾斜需跟随有效重力及加速度，不能给水面独立播放循环。模型未计算晃荡时标为示意，不声称液体仿真。

世界模型或扩散段回答“下一小段轨迹怎样选”。候选路径、碰撞约束和评价值来自同一份规划记录；先看观测改变，再看候选被淘汰，最后执行被选路径。PID负责跟踪给定目标，不能把语义理解放进 PID 公式。若未接真实推理后端，清楚标为教学回放；路径发光并不能证明实时推理。

末段进入无人机机载视角，镜头挂在真实机体或云台变换上。保留观测时间、目标、选中路径与有限状态，画面呈现“新障碍出现→路线拒绝→重规划→控制执行→送达”。需要展示的是简短决策摘要和可核验状态，不生成伪造的内部思考文字。最后看见水确实送达，再进入 AeroVLA 论文页。

尾页按用户要求使用“AeroVLA”标题，先查用户已有工程、模型报告与版本；历史出现的 `/data/AeroVLA` 路径不证明本次运行，也不能直接等同于公开同名项目。[公开仓库 XuPeng23/AeroVLA](https://github.com/XuPeng23/AeroVLA)可作为单独的文献参考：其接口为前视与下视双相机输入，自回归数值 token 输出 `3DoF + LAND`，不能改写成 diffusion policy。用户自己的 AeroVLA 使用哪种接口，应以其工程为准。扩散轨迹候选需要独立说明方法与实现。分别呈现“引用文献”“本片方法”“本次实测”。尚未实现的接口标为拟接入；没运行的实验不填成功率、延迟或鲁棒性数值。

## 每次只修一个真实观看问题

先做薄片验证，再做全片：最难的装配遮挡、相机近距离穿越、观测改变后的路线更新、液面与机体联动，各选一个短段。通过后才批量扩展。快剪片段完整看入场和退场，解释段则用正常速度听懂一次，不靠停在完美静帧验收。

| 检查层 | 实际要看什么 | 发现问题后的动作 |
|---|---|---|
| 因果 | 看得见原因先于结果，讲稿与动作同一步 | 调事件顺序或重写这句，不先补装饰 |
| 实体 | 比例、装配轴、碰撞、载荷、旋翼和镜头安全距离 | 修几何与状态源，禁止用透明掩盖穿模 |
| 物理与数据 | 单位、坐标系、误差符号、约束、饱和及相位 | 重算并保存来源，图和实体同步更新 |
| 连续性 | 相邻帧的姿态、光位、材质、焦点、字形和路由 ID | 检查跨镜合同、状态重置和缓存 |
| 阅读 | 字幕能读完，标注不交错，公式当前项清楚 | 延长真实 hold，减少同屏负荷 |
| 声音 | 正常音量下听清旁白，接触时机合理，高潮有空间 | 分轨听审，再听总混，重调 cue 与避让 |
| 性能 | 输出帧稳定，纹理无闪烁，快门采样无历史残留 | 分层分析，保留物理与时间合同 |
| 全片 | 每一段回答问题并自然引出下一段 | 按问题修段落，再检查两侧接缝 |

把体验反馈存成 `timeRange / observedProblem / cause / change / evidence / remainingRisk`。只有真的播放、听审或运行检查后才填通过；未做的项目写未检查。将成功做法回收到对应模块，记录适用条件和反例，不把一次成功的配色或速率升格为所有视频必须照做的风格。

发布给另一个创作线程时一并提供：本指南、所选配方、源资料、实际代码入口、已验证范围和还没做的部分。共享现有依赖；只带选中的模块与素材，不复制整套 `node_modules` 和全部研究缓存。
