# 同一解释，三种故事入口

打开 [文案工作台](../../lab/mofs-writing.html)，分别试“先看结果”“从连接搭起”“先做预测”。三个候选均为 38 秒的原创静音分镜；12 秒后使用完全相同的对象、尺寸、动作与相机，便于比较入口是否适合自己的内容。

| ID | 0—12 秒的安排 | 适合的问题 |
|---|---|---|
| `story-mofs-result` | 已完成的通过/阻挡结果 → 观察 → 明确回看过程 → 同一观察位 | 观众能先辨认结果，再追问原因 |
| `story-mofs-build` | 一个连接点 → 连杆逐步连接 → 完整框架 → 引入两种尺寸 | 对象结构本身需要先认识 |
| `story-mofs-predict` | 同场展示孔口与两颗球 → 比较大小 → 保留判断 → 进入解释 | 观众已有可见依据，可以先做预测 |

故事和代码均为原创。参考作品用于学习“问题—动作—结果—下一问”的组织，不复制其台词、素材、晶体或画面。科学概念另对照 Nobel Prize 官方 2025 年化学奖资料，见 资料记录（外部或本机资源，未随公开包收录） 与 [写作指南](../../guides/mofs-writing.md)。

## 调用

只需 `lab/modules/mofs-explanation.js` 与 `lab/modules/common.js`，浏览器原生 Canvas，不安装新依赖。

```js
import {candidates} from './lab/modules/mofs-explanation.js';
const shot = candidates.find(c => c.id === 'story-mofs-predict');
const seconds = frame / fps;
shot.draw(canvas.getContext('2d'), seconds, 1600, 900, {});
const state = shot.sample(seconds);
const cue = state.activeCue;
console.log(cue.narration, cue.question, cue.visibleEvidence);
```

`sample` 和 `draw` 按绝对秒数计算；任意定位、倒序定位、重复绘制得到同样状态。时间夹紧到 0—38 秒，结束停住；`loop:false`。三个方案保留固定配色与尺寸，关闭强度和配色旋钮，避免比较时暗中改变科学示意的条件。

`stories`、`storyById` 提供故事数据；`CUES` 按 `result/build/predict` 分组。`sampleMofs(time, variant)` 与 `sampleResult`、`sampleBuild`、`samplePredict` 均可直接使用。

每个 cue 提供：

```ts
type Cue = {
  id: string;
  start: number; end: number; // 秒；覆盖 [0,38]，无空档
  narration: string;         // 空字符串表示有意留白
  screenText: string;
  question: string;
  visibleEvidence: string;   // 此时画面真正提供什么
  sceneEvent: string;
  sourceIds: string[];       // 可在 SOURCES 中解析
  kind: string;
  evidenceWindow?: [number, number];
  resultOf?: string;        // 结果必须在对应动作之后
};
```

`state` 包含 `activeCue`、`cueIndex`、`cueProgress`、`stageIndex`、`camera`、`frameworks`、`guests`、`scene`、`sceneEvents`、`geometryStable` 与 `readHold`。`readHold` 只在标为观察停留且相机、模型、客体和结果标签已经停稳时为真。它不是单纯把没有口播的区间都算作稳定画面。

## 共同解释段

| 时间 | 可见动作与口播职责 |
|---|---|
| 12—15.8 s | 节点先被指认，连接随后强调；讲金属节点和有机配体 |
| 15.8—20.5 s | 转向孔口，框架保持完整；说明内部孔隙，再出现完整名称 |
| 20.5—24 s | 小球先抬升、对齐，再沿中轴进入；只描述正在做的动作 |
| 24—24.5 s | 动作完成，显示“小球通过”，留白读图 |
| 24.5—27.4 s | 大球以相同孔口与入射轴验证；停到计算出的接触位置 |
| 27.4—28 s | 动作完成，显示“大球被挡在孔口”，留白读图 |
| 28—35.2 s | 小球到内表面附近；解释吸附是另一件事，标明位置示意 |
| 35.2—38 s | 两个就近标签分别指出入口与内表面；完整静止读图 |

`build` 的连杆按固定广度优先顺序生成；每条边的起点必须已出现，最后一条边在 9.705 秒完成。三个方案 12 秒后的几何与相机完全相同。

## 数据与科学边界

这是三层八边形笼架：24 个节点、40 条连接；单位为设计单位，不对应某种实际 MOF 的配位结构。节点可代表金属离子或团簇，连杆示意有机配体。名称中的“潜在孔隙”不表示所有框架在所有条件下都保留相同开孔结构。

孔口节点半径 0.115、连杆半径 0.06、节点环半径 0.66。中心球通过净空取两项最小值：

```js
Math.min(0.66 - 0.115, 0.66 * Math.cos(Math.PI / 8) - 0.06) // 0.545
```

小球半径 0.22，大球半径 0.63。`stopHeight(radius)` 按球—节点球面、球—连杆圆柱的中心线几何距离计算停止高度，再留 0.025 的显示间隙。先抬升再横移，避免斜着穿过孔口边缘。

这里只计算几何通过，不计算吸附。吸附还受孔内化学环境、温度、压力等条件影响；小球靠近内表面只是概念位置示意。`physicalSimulation:false`、`adsorptionComputed:false` 一直保留。Canvas 用透视投影、渐变材质和深度排序表现空间，不是路径追踪；排序也不等于逐像素深度缓冲。

`timingBasis:'planned'` 表示时间来自分镜计划，未合成 TTS。自然讲述速度估计只辅助编排，不代替实际发音校对与音画对齐。工作台允许改写当前句，保留原句；导出后仍须按真实配音重新校时。

## 核验

```powershell
node scripts/test_mofs_explanation.mjs
node scripts/test_mofs_writing_studio.mjs
```

第一项独立核对球与节点/连杆距离、连通拓扑、身份、源节点先出现、结果后置、相机与路径连续性、随机定位、画面安全区和真实 Canvas 命令稳定性。第二项执行实际工作台事件处理器与真实 sampler，检查句子定位、编辑、持久化、导出与暂停。它们不验证原片听感、实际晶体、化学吸附或浏览器逐像素美观；视觉检查单独记录。
