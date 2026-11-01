# Motionface 方法学习：原创文字与可视化候选

源代码：`../../lab/modules/motionface-type.js`。设计画布 1600 × 900，Canvas 2D；无外部依赖、无远端字体、无音轨。四项均为 14 秒有限镜头，末帧停留，不自动循环。

## 来源边界

根任务实际观察了 Motionface 公开首页的三张实体卡扇出、翻面、收束与连线分发过程；`mf-card-convergence` 复现其**方法**，内容、图形、文案和代码均为原创。其余三项是围绕文字/图形信息交接做的**原创延展**，不是来源作品的逐帧复刻。后续经用户授权登录，对 Focus 与 Mindset 做静态帧研究，并在独立模块补充[环字落定](TYPE_ORBIT.md)与[对象接棒](CONCEPT_BRIDGE.md)。没有复用源站图片、字体资源、商业模板或音轨；未解锁付费源码，也未学习完整作品库。具体范围见[研究记录](../../studies/motionface.md)。

## 导出

```js
import {
  candidates, motionfacePalettes, motionfaceDefaults,
  sampleCardConvergence, drawCardConvergence,
  sampleMaskTypeset, drawMaskTypeset,
  sampleFocusHandoff, drawFocusHandoff,
  sampleTraceAssembly, drawTraceAssembly,
  normalizeMotionfaceOptions, partialPolyline, layoutMaskTypeset
} from '../../lab/modules/motionface-type.js';

const item = candidates.find(x => x.id === 'mf-focus-handoff');
const options = { palette: 'paper', intensity: 0.65, reducedMotion: false };
const state = item.sample(8.7, options);
item.draw(canvas.getContext('2d'), 8.7, canvas.width, canvas.height, options);
console.log(state.phase, state.readHold, state.measurement.error); // 同一数值源
```

`draw()` 的 w/h 是实际 Canvas 像素大小，可使用 DPR 放大。函数内将设计坐标缩放到 w/h；调用者负责 CSS 显示尺寸。`sample*()` 和 `draw*()` 也可直接调用。不要把 draw 的最后一个可选 `supplied` 状态传入其他候选或另一个时间。

| 候选 | 方法与用途 | 默认时间 / 建议审片 |
| --- | --- | --- |
| `mf-card-convergence` | 顺序翻面、图形身份持续、收束成一个关系 | 0 / 2.1 / 3.3 / 5.9 / 7.8 / 9.8 s |
| `mf-mask-typeset` | 词组遮罩、基线落定、结果阅读 | 0.8 / 1.8 / 3.2 / 4.3 / 7.3 / 9 s |
| `mf-focus-handoff` | 位置测量→差距→一句结果 | 1 / 3.2 / 5.4 / 6.8 / 8.7 s |
| `mf-trace-assembly` | 支撑→桥面→杆件→短标注 | 1.2 / 2.8 / 4.8 / 6.5 / 7.5 / 9 s |

## 参数

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `palette` | `paper` / `lime` / `coral` | 奶油纸墨 / 黑白酸柠 / 深靛珊瑚。主工作台旧值 titanium→lime、ember→coral、porcelain→paper。 |
| `intensity` | 0–1，默认 .65 | 只影响扇出幅度、字组入场距离、图形尺寸或强调线重，不改变科学数据。 |
| `headline` | 字符串 | 替换主句。推荐 8–22 个汉字；独立工作台上限48，API上限180。遮罩候选两组共用字号，按实际测量先换行，再选能容纳整体的最大字号。 |
| `kicker` | 字符串 | 顶部短引导。推荐 5–20 个汉字。 |
| `result` | 字符串 | 最后留住的结论。推荐 8–24 个汉字。 |
| `reducedMotion` | 布尔，默认 false | 取消大幅翻转/旋转、用淡化代替；仍保留信息次序。 |
| `tempo` | .75–1.35，默认 1 | 可选的镜头内部节奏缩放。**如果播放器已改变时钟速度，则这里保持 1，避免二次加速。** |
| `mfPalette` | 同 palette | 可覆盖上层通用配色值；一般无需使用。 |

直接 `sample*` / `draw*` 缺省为 paper；主工作台的通用 `candidate()` 包装会把缺省 palette 转为 titanium，所以在独立作品里建议明确传 `palette:'paper'`。NaN、非数值时间归零，负时间夹到0、超长时间夹到14秒；任意跳转/倒序取样均无历史依赖。模板参数中的无效数字恢复默认，不产生 NaN 几何。

## 状态与身份

所有状态含 `time`、`phaseTime`、`phase`、`phaseIndex`、`timings`、`readHold` / `readingHold`、`copy`、规范化的 `options`。`timings` 为 `{id,label,start,end,reading}` 数组；时间按当前内部 tempo 计算，可直接生成阶段按钮。

- 翻面关系：`cards[].id` 恒定；`relation.force === relation.mass * relation.acceleration`。本例数值是 **6 N = 2 kg × 3 m/s²**，不是从动画自动发现定律。二维 `scaleX` 模拟翻面，不是真正三维相机。
- 位置差距：`measurement.error === measurement.target - measurement.current`；实体位置、刻度、读数和差值共享变量。只展示教学插值，不宣称 PID 或真实控制仿真。
- 桁架：`strokes[].id` 与 `nodes[].id` 恒定；按累计弧长画线。仅结构示意，不包含有限元或载荷求解。
- 阅读停留：最后阶段的主体位置、字号、图形和读数静止。不要再在外层叠加持续缩放/呼吸，以免破坏阅读。

### 遮罩文字的整体排版

`mf-mask-typeset` 在 x=80–945、y=200–550 的标题区域内排版，两个语义组之间留24px间隔。两组使用同一字号；先按实际字体宽度换行，再在116–18px内寻找能容纳总行数的最大字号。每组内部均衡行长，避免短首句成为巨大标题、长后句缩成一行小字。48字以内通常为2–4行；180字API边界允许更多行，建议实际视频仍拆成短句。

排版只依赖完整文案和字体测量，不依赖当前动画进度；因此揭示中不会突然重排。`layoutMaskTypeset(ctx, sampleMaskTypeset(t, options).words)` 返回可检查的共同字号、行高、区域与各组行文/基线，返回数组独立复制。其位置不会越过下方y=587规则线，也不进入右侧图形区域。所有语义组仍按原时间次序揭示。

## 编排方式

先把当前段落压成一个问题，再选择与信息关系匹配的方法：**从多个观测到关系→翻面汇聚；一句主张到结论→词组遮罩；当前状态到误差→聚焦接力；先搭结构再解释作用→语义描线。** 不要将四套同时叠在一个画面里。

进入阅读窗后才安排需要完整听清的关键解释。音效由上层项目根据动作点另行设计：翻面可以轻点、结构接合可以短击，但本模块本身没有音轨，不代表已学习或复刻 Motionface 音效。
