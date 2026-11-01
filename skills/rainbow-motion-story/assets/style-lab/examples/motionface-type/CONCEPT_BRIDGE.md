# 同一物体，接住下一组概念

候选：`mf-concept-bridge`；模块：`lab/modules/motionface-concepts.js`。原创建模为 Canvas 2D 观测球，无来源脑图、声音、水印和受限仓库代码。

## 来源与转化

Motionface Mindset，具体源窗口 **5.583333–6.583333s**：[研究与证据](../../studies/motionface-mindset.md)。原片同一个脑图在 Fast → Slow 之间移位，让下一组字出现在腾出的空白。这里只迁移「身份不断、构图让位、下一问题延后进入」的关系，示例改成 **看见 → 判断**。

## 调用

```js
import {
  sampleConceptBridge, drawConceptBridge, conceptBridge,
  motionfaceConceptDefaults, normalizeConceptBridgeOptions
} from '../../lab/modules/motionface-concepts.js';

const options = {
  mfPalette: 'paper', // paper / lime / coral，亦接受既有 palette 别名
  intensity: .65,
  tempo: 1,          // .75–1.35；不改变观测数据
  reducedMotion: false,
  headline: '看见，然后判断。',
  kicker: '一个对象，接住两个问题',
  result: '同一个观测，换一个问题。'
};
const state = sampleConceptBridge(7.6, options);
drawConceptBridge(ctx, 7.6, 1600, 900, options);
// 或用符合总库 API 的 candidate：
conceptBridge.draw(ctx, 7.6, 1600, 900, options);
```

所有采样按绝对秒，不依赖上一帧；`t < 0` 固定首态、`t > 14` 固定末态。`tempo` 只压缩/拉长动作阶段，外部总时长维持 14 秒。headline/kicker/result 最多 180 字符；长句统一换行缩放，不逐词随机改变字号。

## 默认关键时刻

| 秒 | 画面 | 观众任务 |
|---|---|---|
| 0–0.65 | 观测球处于「看见 / 判断」之间 | 认出同一个东西 |
| 0.65–2.55 | 词组退开，球放大为中心对象 | 从名称进入实体 |
| 2.7–3.85 | 出现当前位置72cm与目标100cm | 先知道输入是什么 |
| 3.85–5.1 | 中央解释稳定 | 读清两项输入 |
| 5.1–6.65 | 物体和旧标签一起移动到左侧 | 留下记忆，为新问题让位 |
| 6.8–8.7 | 右侧依次出现标尺、差距、100−72=28cm | 理解相同输入如何支持另一种判断 |
| 8.7–14 | 完整结果静止 | 看完整，再接下一段 |

源片时刻与原创时刻不是一一对齐，不应宣称像素级复刻。

## 三条可复用规则

1. **对象先让位，下一问题后进入。** 本例物体6.65s到位、6.8s才引入新标题；这个短空隙属于阅读组织，不是装饰停顿。
2. **旧标签随实体迁移，不抢新标签的地方。** 当前位置与目标仍在物体下方，透明度降为次级；新推论在右侧独立阅读区出现。
3. **布局可变，身份和数据不变。** `observation-entity` 和 `observation-72` 全程固定；标尺位置、差距尺寸与数字都由同一输入计算。

## 数据与边界

本例 current = 72 cm、target = 100 cm 是固定教学输入。`error = target − current`；标尺650px代表100cm，几何差距182px对应28cm。球的屏幕位移只是版面交接，不是current值随时间变化，不是物理模拟、机器人定位或模型真实推理。

低动态模式固定实体位置、半径与旋转，保留信息淡入。循环不是默认能力；末态保持，不会突然重启。要接长片，应使用观测球或28cm结果作为下一镜锚点。

## 检查

```powershell
node scripts/test_motionface_concepts.mjs
```

报告：`qa/motionface/concepts-state-and-drawing.json`。覆盖实体身份、连续运动、统一数据、随机与倒序定位、三套配色、三档强度/tempo、低动态、阅读窗、Canvas状态恢复、长句布局。该报告不代替浏览器字体/像素检查、连续播放和主观音频检查。
