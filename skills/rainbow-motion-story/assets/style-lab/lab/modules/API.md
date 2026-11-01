# 可复用动作模块 API

这是一套原创方法演示。来源研究与可复用代码分开记录，不把参考作品的影像、音乐或水印当作原创素材。浏览器直接加载 ES modules，不增加依赖。当前候选数量与模块分布以 `index.js` 的实际注册为准，不在文档中维护另一套固定总数。

```js
import {candidates,candidateById} from './modules/index.js';
const demo=candidateById['mechanics-linked-gears'];
const options={intensity:.65,palette:'titanium'};
demo.draw(canvas.getContext('2d'),2.5,canvas.width,canvas.height,options);
const state=demo.sample(2.5,options);
```

读取当前清单：

```js
import {candidates,modules} from './modules/index.js';
const inventory = {
  total: candidates.length,
  byModule: Object.fromEntries(Object.entries(modules).map(([name,items]) => [name,items.length])),
  referenceIds: [...new Set(candidates.flatMap(item => item.referenceIds))]
};
```

- `t` 是绝对秒数。调用者可按 30fps、任意拖动或倒放；内部不读取时钟，不累计积分，不用无种子随机。
- `duration` 是各候选声明的演示时长；`loop:false` 表示有限镜头，到末帧保持，重新播放才回到起点。每次求值用当前绝对时间，缓存只用于重复利用离屏画布，不存储运动状态。
- `draw(ctx,t,w,h,options)` 以 1600×900 设计坐标绘制。调用方保持 16:9，推荐输出 1600×900 或 1920×1080；不要在画布之外再施加摄像机状态。
- `sample` 返回相同演示的数据：转角、长度、流量、能量、相机位姿或点的位置等。可以接入 Three.js/Blender；这里的 Canvas 渲染不等于物理渲染器。
- `intensity:0..1` 只在适用的表现层控制镜头幅度或快门曝光等，不修改齿比、连杆长度、流量守恒与能量关系。部分候选刻意不受强度滑杆影响；不应为了滑杆存在而改物理参数。
- `palette` 是 `titanium`、`ember` 或 `porcelain`。瓷白方案使用浅背景、深墨蓝文字；其他两种为暗色演示环境。
- 元数据包含 `id/module/title/description/referenceIds/usage/recipe/stages/parameters/codeFile`。`referenceIds` 对应研究目录中的来源记录；实际ID清单从候选注册读取，具体观看或源码阅读范围以各研究记录为准。

## 接入自己项目时

先选观察任务，再选候选。不要把所有动作串成一条连续炫技蒙太奇。替换 `sample` 的教学数据时，应让实体、标签和公式继续读取同一份数据。时间切片或音频乐句由项目时间线传入，库里的乐句包络没有声明分析过任何曲目的鼓点。

机构候选保留装配轴与部件 ID，剖切保留壳体厚度。行星齿轮角速度满足固定齿圈条件下 12/12/36 齿的 4:1 比例，但二维轮齿轮廓是示意。曲柄滑块由闭式几何求解；能量式是理想无阻尼振子的解析状态；流道是准一维不可压缩运动学，不能称完整流体仿真。

`look-multisample-shutter` 在当前曝光窗口重新求 16 个时间状态，再做均值合成，不保存上一帧拖影。当前是浏览器颜色域下的预览近似；生产合成可在场景线性色域做同样采样。它的文字在合成之后绘制。

`mechanics-axial-exploded` 固定装配轴与中心转子，外部件先移动、内部件随后移动；到位后再显示标签，回装次序反转。`visualization-entity-formula` 先展示实体，依次抽取位移与速度，最后组成能量式；参数与实体共用同一解析状态。

景深候选将同一深度的几何合为一组后虚化，避免每个面重复执行滤镜。`blurredGroup` 的离屏层为 800×450，合成回 1600×900 的逻辑画布；文字独立保持清晰。缓存仅复用画布分配，每次绘制清空并按绝对时间重建，可在需要更高几何锐度的生产渲染中提高离屏分辨率。

## 已有自动检查

运行 `node lab/modules/selftest.mjs`检查有限数值、任意seek的同状态、循环周期与有限镜头边界，并检查齿比、连杆定长、能量和流量等关系。分类基线从入口候选派生，另行验证六个明确模块、唯一ID、查找表与模块注册完整性。历史一次验收覆盖58个候选、3种配色、3种强度、301个时间点，157,122次采样及86,510,412个有限数值通过；这些数字只描述当时的测试范围，不代表当前注册总量。当前结果以脚本本次输出为准。

洗牌解释新增专项检查：`node scripts/test_shuffle_explanation.mjs`验证精确排列与连续性，`node scripts/test_shuffle_story_contract.mjs`核对讲稿和镜头契约。入口总数从 `candidates.length`读取，模块分布从`modules`统计；不要手写测试结果替代实际运行。

这些检查不代表视觉审片或音频听审已经通过。画廊还需要查看完整入场、观察停留与退场；代码样例默认无声。

修复回归：曝光离屏 Canvas 固定使用软件读取后端，逐次重置滤镜/变换/合成；默认主画布乱序绘制后PNG字节相同。环绕相机检查包括辅助几何的完整包络。二维路线桥接保留101个采样点ID，晶格增长共用64个节点与144条唯一连接。


## 特种运镜与文字

`camera-flight.js` 含穿梭绕飞/俯冲/第一人称/离体漂移。`camera-time.js` 含子弹时刻与强空间伸缩的希区柯克变焦。`camera-driver.js` 按帧输出 `shotTime/worldTime/camera/state`；`applyCameraShot` 把worldTime传给场景更新器，镜头仍读取成片时间。切勿把子弹时刻两种时钟合并。`cameraEndpoints`供衔接设计读取首尾；不同候选不是自动连续的一条路径。

`stageTimes` 为阶段按钮的实际秒数，`stages`为对应标签，`previewTime`选代表帧；这三个元数据可选。新有限镜头的 `sample(t)` 会夹紧到0…duration。所有时间仍按绝对帧求值。

`type-life.js` 提供语义强调、随对象标注、公式身份变形和配色注意力交接。正文的阅读窗口保持稳定，强度只调整表演幅度。正式公式动画须核对定义域和变形条件，不能把漂亮变形当数学证明。

Canvas的roll为画面坐标旋转，Three相机局部rotateZ取反，适配器已处理。一般候选针孔主点是(800,480)，飞行候选为(800,468)。相机的principalPoint元数据与适配器setViewOffset已处理归一化取景偏移，Three投影测试直接比较屏幕坐标，不再在测试外补像素。

文案分镜用 `node scripts/inspect_story.mjs examples/storyboard/cup-75s.json` 检查时间覆盖、先用后解释、依赖顺序、阅读窗口和来源ID。它不判断文案有趣程度、事实真假或口语自然度。指南在 [script.md](../../guides/script.md)。

`shuffle-explanation.js`提供`visualization-choice-product`与`storytelling-perfect-shuffle`。前者按六个位置逐项形成乘法，后者使用八张牌的精确out-shuffle；固定身份、目标排列和阶段时间可用于接入自己的对象。[讲稿工作台](../shuffle-story.html)同步展示原创口播和画面依据，[接口说明](../../examples/shuffle-story/API.md)保留使用条件。

`transmission-effects.js`提供`look-tracking-exposure`与`visualization-window-relay`。前者每个曝光子时刻重新计算相机和数据块，比较无模糊、时间采样与运动量级匹配的单帧高斯滤镜；后者让发送、接收、确认和窗口前沿读取同一事件表。使用[传输视觉工作台](../transmission-effects.html)并排比较，[API](../../examples/transmission-effects/API.md)列出快门、帧率、子样本数与固定/跟随机位参数。`node scripts/test_transmission_effects.mjs`核对曝光积分、实际合成权重、相机相对速度及窗口因果关系；Canvas显示空间均值不是线性HDR渲染，六包确认示意也不是完整TCP。

`aesthetic-direction.js`提供`look-editorial-cutaway`、`look-industrial-focus`与`look-orbital-return`，均为14秒有限镜头。它们共享圆环身份、8枚固定件与设计单位尺寸，分别采用左右分栏、顶部横排、中心轴三种构图。使用[审美工作台](../aesthetic-direction.html)并排比较，或在主库「材质与视觉」选用；[API](../../examples/aesthetic-direction/API.md)给出统一故事阶段与状态接口。`node scripts/test_aesthetic_direction.mjs`核对网格尺寸、组件平移、连续投影、三种版式安全区、任意定位与稳定阅读。材料是原创Canvas表现，不是光线追踪或物理仿真。

`mofs-explanation.js`提供`story-mofs-result`、`story-mofs-build`与`story-mofs-predict`：三种开场均为38秒计划分镜，12秒后共用同一条解释链。`stories/storyById/CUES`保存逐句口播、问题、动作依据、来源ID与阅读窗；`sampleMofs(t,variant)`返回同一框架及两颗球的状态。孔口通行按原创几何判断，内表面停留属于概念示意，`physicalSimulation:false`与`adsorptionComputed:false`随计划保留。[文案工作台](../mofs-writing.html)支持逐句定位、本机改写与JSON/PNG导出，改写保留`originalNarration`；时长仍是`planned`，没有配音实录。[指南](../../guides/mofs-writing.md)、[接口](../../examples/mofs-explanation/API.md)、[原片写作研究](../../studies/mofs-script.md)和[科学依据](../../studies/mofs-writing-principles.md)分别说明接入与证据范围。

`camera-depth.js`新增`camera-focus-handoff`、`camera-focus-track`、`camera-parallax-reveal`，共用固定对象、14秒有限时钟。`sampleCameraDepth(t,variant,options)`返回位姿、光轴焦深、毫米制薄透镜弥散圈直径；`depthMode:sharp`仅关闭绘制虚化。使用[运镜工作台](../camera-depth.html)调光圈/焦距/锚点并导出421个30fps镜头采样（含14秒端点）。[API](../../examples/camera-depth/API.md)与[技术推导](../../studies/camera-depth-technical.md)列出单位及高斯预览限制。

`applyCameraPose()`把pose.fov作为有效FOV，因此每次重置Three相机`zoom=1`、`filmOffset=0`并匹配principalPoint；避免上一镜的相机状态改变下一镜构图。`qa_camera_adapter.mjs`使用实际Three相机和各候选自己的投影器验证复用。

`rotary-interaction.js`提供18秒有限候选[mechanics-rotary-section](../#mechanics-rotary-section)与[mechanics-rotary-explode](../#mechanics-rotary-explode)。[机构工作台](../rotary-interaction.html)让前盖、轴向拆离、相机与轴角分别控制；`sample(t,options)`与`draw(...)`共用传入的`shaftAngle`，默认分镜仍按绝对时间求值。`cut`、`explode`覆盖手动结构状态，`viewYaw`、`viewPitch`覆盖机位，`labels`控制标注。模型为设计单位的理想单转子，真实发动机几何、燃烧和功率不在此接口内；[运动学核对](../../studies/rotary-kinematics.md)与[指南](../../guides/rotary-interaction.md)说明边界。

`rotary-session.js`把演示轴速保存为分段恒速事件。`motorAt(events,t)`返回弧度轴角与rpm；`setMotorSpeed(events,t,rpm)`保留修改时刻的角度并替换该时刻及之后的方案；`resumeSpeedAt(events,t)`读取该历史时刻之前最近的非零速度。事件按绝对时间积分，因此乱序定位和JSON往返不改变相位。冻结以0 rpm事件表示，恢复不重置轴角。工作台导出同一事件表、候选ID、显示选项与541个30fps状态点；`renderFrameRange:[0,539]`用于18秒渲染，`endpointFrame:540`仅记录终点。

`node scripts/test_rotary_session.mjs`的8项语义检查已通过，覆盖改速连续性、冻结、恢复、乱序重播、提前修改替换未来和序列化复现。转子交互专项另检查1,496个采样与22次Canvas命令记录绘制；后者不等于浏览器像素审片。[原片研究](../../studies/rotary-interaction.md)只声明四张联系表静态审阅和三段额外静音播放，不把这些范围写成全片或音轨审阅。

## Motionface 文字与可视化研究

`motionface-type.js` 提供四个14秒有限候选：`mf-card-convergence` 让同名观测翻面并归入 `F = ma`，`mf-mask-typeset` 按语义词组揭示主句，`mf-focus-handoff` 将注意力从位置交给误差，`mf-trace-assembly` 按支撑、跨度和杆件逐步描出结构。它们分别接入「公式与可视化」和「材质与视觉」；[专用工作台](../motionface.html)用于改文案、节奏、配色和减少动态。

另有两个14秒独立模块：`motionface-kinetic.js` 的 `mf-type-orbit-lock` 把环形字粒连续排成完整句子，见[环字接口](../../examples/motionface-type/TYPE_ORBIT.md)；`motionface-concepts.js` 的 `mf-concept-bridge` 保留观测球身份，在文字与主体之间连续换位并交接概念，见[对象接棒接口](../../examples/motionface-type/CONCEPT_BRIDGE.md)。两项均可从本注册表按ID调用；它们是基于已观察作品方法的原创实现，不是原片素材或源站算法。

```js
import {candidateById} from './modules/index.js';
const scene = candidateById['mf-focus-handoff'];
const options = {mfPalette:'paper',tempo:1,intensity:.65,reducedMotion:false,
  headline:'先看位置，再读差距。',result:'目标与当前，共用同一把尺子。'};
scene.draw(ctx,6,1600,900,options);
const sameState = scene.sample(6,options);
```

`mfPalette` 为 `paper/lime/coral`；主工作台已有 `porcelain/titanium/ember` 分别映射到这三种方案。`tempo` 在0.75–1.35内改变阶段安排，有限镜头总时长仍为14秒，阶段窗口见 `sample().timings`。`headline/kicker/result` 为可替换文案；减少动态保留信息顺序，通过淡入交接。三个观测、公式及测量误差读取同一组教学数据；桥结构仅是二维示意，不称真实受力计算。

运行 `node scripts/test_motionface_type.mjs` 检查固定身份、数值关系、累计弧长描线、阅读停留、乱序采样与Canvas命令复现；报告在 `qa/motionface/state-and-drawing.json`。录制绘制命令不代表浏览器实际字体、像素审片或原站动效完整复刻，具体范围另见来源研究与视觉检查。
