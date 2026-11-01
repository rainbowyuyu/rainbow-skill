# 从洗牌动作走到可理解的讲解

本模块把参考中“逐张选牌→选择数接到乘积”和“固定身份→重排→读定”的办法写成两个原创候选。实体数量、配色、时长和画面均重新设计；不包含原视频画面、音轨或作者代码，也不复原实体纸牌接触物理。

观察依据来自[全片视觉研究](../../studies/shuffle-visual-story.md)与[讲稿研究](../../studies/shuffle-script.md)：参考约 24.2–26.2 秒将逐张落位接到乘积，82.2 秒交织落定后才更新顺序判断。这里只借用“实体先完成、结论后出现”的组织办法。参考时间来自 0.1–0.2 秒抽帧观察，不能视为作者源程序的精确触发时间。

源码：[`lab/modules/shuffle-explanation.js`](../../lab/modules/shuffle-explanation.js)

```js
import {
  candidates, choiceProductCandidate, outShuffleCandidate,
  sampleChoiceProduct, sampleOutShuffle, choiceProduct, outShuffle,
  SHUFFLE_ORDERS
} from '../../lab/modules/shuffle-explanation.js';

choiceProductCandidate.draw(ctx, 8.8, 1600, 900, {palette: 'titanium'});
const state = sampleChoiceProduct(8.8);
console.log(state.phase, state.annotation, state.formula);
// 可直接跳到任意时间；采样和绘制不依赖先前帧。
```

## 两个可独立选择的候选

| 候选 | 分类 | 时长 | 推荐缩略帧 | 结果阅读窗口 |
|---|---|---:|---:|---|
| `visualization-choice-product` | visualization | 20 s | 15.7 s | 15.1–20 s（14.4 开始显现） |
| `storytelling-perfect-shuffle` | storytelling | 22 s | 19.7 s | 19.3–22 s（18.6 开始显现） |

均为 `loop:false`，结束后停留。负时间/非有限输入固定到初始帧。支持 `titanium`、`ember`、`porcelain` 色板；数学状态和固定身份色不随强度改变，因此关闭 intensity 控件。时间是秒，设计画布为 1600×900，可按比例输出。

## 六张牌逐位计数

固定身份 `A…F`，示例选中顺序 `C,F,A,E,B,D`。每张牌始终存在，上方未选区留下空位，下方对应固定槽位。它只是 720 个排列中的一个。

| 开始秒 | 当前阶段 `phase` | 这一位选择数 |
|---:|---|---:|
| 0 | establish | 尚未选择 |
| 1.5 | choose-1 | 6 |
| 3.65 | choose-2 | 5 |
| 5.8 | choose-3 | 4 |
| 7.95 | choose-4 | 3 |
| 10.1 | choose-5 | 2 |
| 12.25 | choose-6 | 1 |
| 14.4 | result | 完整乘积 |

每一步前 0.9 秒落牌，随后 0.4 秒把实际选择数接到公式，然后留约 0.85 秒读清楚。`chosenCount` 只在牌落定后增加，`factorCount` 只在因子接力完成后增加。结果在 14.4–15.1 秒显现，之后稳定停留。公式右侧等号在新因子接力时暂退，避免把中间动画误读成错误等式。

`choiceProduct(n, selectedCount)` 返回 `{factors, product}`，空前缀为 `{factors:[], product:1}`。为维持 JavaScript 整数精度，限制整数 `n` 在 1–18，前缀数在 0–n；片内只使用 6。

采样返回 `cards`、`selectedIds`、`remainingIds`、`chosenCount`、`factorCount`、`choicesAtStart`、`factors`、`formula`。因子的 `sourceId` 与刚选定的牌身份相连。

## 八张牌精确外洗

`outShuffle(order)` 将偶数长度数组平分，上半叠第一张先出，随后上下交替。返回新数组，不修改输入。片内 8 张牌的状态从函数逐轮计算：

```text
初始    A B C D E F G H
第一轮  A E B F C G D H
第二轮  A C E G B D F H
第三轮  A B C D E F G H
```

每轮开始秒为 `1.5, 7.2, 12.9`。相对轮次起点：分半 0–1.7 秒，交织 1.7–3.9 秒，合齐 3.9–4.8 秒，阅读 4.8–5.7 秒。交织的四对牌错开 0.3 秒出发，每对运动 1.3 秒。`sourceIndex` 和 `targetIndex` 由精确重排计算，再用于生成轨迹。原顺序参考条全程存在，最终只画平行竖线对应，不画交错路径。

`phase` 为 `establish`、`split-1/2/3`、`interleave-1/2/3`、`gather-1/2/3`、`read-1/2/3`、`compare`。`settledOrder` 只在整轮合齐后提交，`sourceOrder/targetOrder` 可用于讲解当前动作；不要把尚在移动的 targetOrder 当成已完成的物理顺序。

“三轮返回”只描述这里 8 张牌的精确外洗。不是随机性证明，不适用于一般洗牌，更不表示 52 张牌三轮归位。

## 与讲稿、音乐衔接

两候选都提供 `time`、`stageIndex`、`phase`、`annotation`、`geometryStable`、`readHold`；元数据提供严格等长的 `stageTimes`/`stages`，以及 `duration`、`previewTime`。`geometryStable` 只表示牌的几何已经静止；`readHold` 还要求因子和结果文字/对照连线已经稳定，不能将结果淡入阶段算成读定。`annotation` 是当前画面的讲解锚点，不是实测配音，也不代表原参考旁白的转录。

建议在 `readHold` 安排解释句结尾或无旁白窗口；不要把配音塞满因子传递、交织和落定的每一瞬间。声音事件可绑定落牌、因子提交、整轮归位，但无需每一张牌都发一个重音。正式使用时需以新 TTS 的实际句长重新排拍点；此模块不生成音频。

## 验证

[讲稿工作台](../../lab/shuffle-story.html)使用 [narration-plans.js](narration-plans.js) 的 `plans` 和 `beatAt(id,t)`。讲稿与镜头 JSON 保存问题链、画面证据、稳定读窗和依赖，路径相对于 `motion_atelier` 根目录；它不含合成语音。无效与负时间归零，末端钳位到候选时长。

```powershell
node research/motion_atelier/scripts/test_shuffle_explanation.mjs
node research/motion_atelier/scripts/test_shuffle_story_contract.mjs
```

测试独立枚举全部六张牌排列，与逐位乘积交叉核对；验证三轮外洗、身份/颜色、读定几何、阶段连接的位移和速度、任意跳转及 Canvas 调用一致性。报告写入 `qa/shuffle-explanation.json`。这些检查不替代浏览器画面验收和实际音画听审。
