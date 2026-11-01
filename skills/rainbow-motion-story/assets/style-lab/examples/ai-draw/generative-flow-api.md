# AI 绘图：方向与一对多关系

两个原创的 12 秒有限镜头，共用现有 `sample/draw` 接口，无新增依赖。时间超出区间时保持首尾状态；状态直接由绝对时间求值，支持倒放与乱序定位。

```js
import { directedFlow, observationFan } from '../../lab/modules/generative-flow.js';

const options = { palette: 'titanium', intensity: .65 };
directedFlow.draw(canvas.getContext('2d'), 7.4, 1600, 900, options);
const frame = directedFlow.sample(7.4, options);
```

| 候选 | 观察任务 | 过程与停留 |
|---|---|---|
| `visualization-directed-flow` | 分布、局部方向和轨迹有什么区别 | 0–1.4 秒观察云团；1.4–4 秒展开曲线带；4.05–4.9 秒方向显现；5.5–9.4 秒同一批点沿场前进；之后停住 |
| `visualization-observation-fan` | 同一观测为何可能关联多个来源 | 先看单个来源、扰动与观测；3.6–5.3 秒只擦上层；5.8 秒后图卡依次进入并接到共同观测；9.2 秒后完整停留 |

`directedFlow.sample()` 提供固定 `id/seed` 的216个点、7条流线、15个方向箭头，以及局部焦点。点沿解析曲线推进；`velocity` 描述执行阶段的真实屏幕位移速度，`direction` 是该点所属流线的单位切向。云团向曲线带的表示转换阶段，`velocity` 不用于描述变形速度。物理/模型项目接入时，应替换解析流线、点状态和向量，继续由同一份数据驱动标注与画面。它不是旧点云候选的换色：先建立方向，再执行运动，观众能验证箭头和位移是否一致。

`observationFan.sample()` 分开返回 `upper`、`base` 和 `cards`。擦除只裁切 `upper.bounds`；底部轴线、曲线、观测点从不进入擦除区域。新卡片使用原创环形、折面、波纹绘图，不包含原视频图像。所有分支拥有不同来源ID与共同的 `observationId`，最终观察点保持在同一位置。

三种配色均可用：`titanium` 使用深金/青色流线和墨绿黑板；`ember` 采用暖色强调与褐墨黑板；`porcelain` 使用浅底、深墨文字。`intensity` 仅影响点云柔光，不修改路径、点身份或方向场。画布按16:9输出。

本次实际查看了 `evidence/ai-draw/detail-0.jpg`（118–122.5秒）与 `detail-2.jpg`（168–173秒）的静态联系表。学习到的是“分布先被看清，再变成曲线”和“擦上层而保留下方解释锚点”；没有由画面推断原作者源码、模型或求解方法，也没有新增原速观看或原声听审。

两个候选均明确标为**示意**。方向场由解析曲线构造，一对多分支用于解释关系，均不是训练模型采样、实际扩散后验或概率权重。这里的“金色/黑板”是对当前观察任务的设计选择，不要求未来视频套用同一种画风。

验证：`node scripts/test_generative_flow.mjs`。报告写入 `qa/generative-flow.json`，覆盖乱序确定性、端点保持、点身份、速度方向一致、边界连续、擦除范围和分批入场。数值验证不替代最终视觉审阅。
