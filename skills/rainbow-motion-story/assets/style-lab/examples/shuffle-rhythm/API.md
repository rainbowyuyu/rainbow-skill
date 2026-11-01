# 52 张牌：同一动画，三种配声

入口：`../../lab/shuffle-rhythm.js`。复用 `sound-design.js` 的确定性合成器；无第三方声音、原片画面或音乐资产，不新增依赖。这是原创的图形节奏实验，不是纸张实录或真实洗牌动力学仿真。

## 工作台接口

```js
import {
  duration,modes,chapters,readHolds,motionContacts,
  sample,draw,buildPlan,renderAudio,audioControlAt,
} from '../../lab/shuffle-rhythm.js';
import {encodeWav} from '../../lab/sound-design.js';

const state = sample(frame / fps);
draw(ctx,frame / fps,canvas.width,canvas.height,{mode:'restrained'});
const plan = buildPlan('restrained');
const audio = renderAudio('restrained',48000);
const wav = encodeWav(audio);
```

`duration` 恒为 18 秒；`sample(t)` 与 `draw(...)` 没有播放历史。时间超出区间时停在首尾，非有限时间抛错。画布逻辑尺寸 1600×900，其他宽高采用等比留边。`draw` 返回与 `sample` 相同的状态，`options.mode` 不改变动画，便于工作台做公平的声画对照。

`renderAudio(mode,sampleRate=48000)` 返回：

```js
{
  left:Float32Array, right:Float32Array,
  sampleRate,duration:18,plan,cues,metrics
}
```

左右声道长度均为 `18 × sampleRate`。采样率可用 8000–192000 的整数。工作台可把两声道复制到 AudioBuffer，并用 AudioContext 时钟对齐 playhead；seek 时停止旧声源、从新偏移位置重播同一缓存。不要用 requestAnimationFrame 时间作为音频时钟，也不要每帧重新合成。

## 三种配法

| mode | 画面 | 声音 |
|---|---|---|
| `restrained` | 相同 52 张牌与时序 | 精选交织接触、归拢、翻开；连续摩擦声较低 |
| `dense` | 完全相同 | 所有 316 个接触事件均触发，单次声音增益降低 |
| `legato` | 完全相同 | 更少接触声，更连续的轻摩擦连接动作 |

三种方案都保护读数静音，不用“满屏声音”冒充力度。固定增益在设计中明确声明，没有自动归一化、隐形压限或削波；三种配法**没有等响度匹配**，因此声音偏好不能单凭响度大小判断。

“纸面接触”由现有木质轻碰与短滤波空气合成信号混合；“纸面摩擦”使用同一合成器的滤波空气过程。名称指设计用途，不证明真实材料属性。没有用金属声替代每个纸牌动作。

## 编排与章节

模块导出 `chapters=[{time,title}]`，工作台应直接读取它。真实时序如下：

| 时段 | 动作 |
|---|---|
| 0–.7 s | 建立完整牌叠 |
| .7–2.1 s | 52 张牌按固定身份拆成左右两叠 |
| 2.46–5.785 s | 分批交织，52 个独立抵达事件 |
| 6.15–6.7 s | 对齐、归拢 |
| 6.95–8.45 s | 牌叠静止，音频完全为零 |
| 8.55–10.163 s | 逐张摊开，翻到牌面 |
| 10.45–11.0 s | 收回同一牌叠 |
| 11.2–12.3 / 12.5–13.6 / 13.8–14.9 s | 三次不同的固定重排 |
| 15.2–16.202 s | 展开最终顺序 |
| 16.4–18 s | 终态读数，音频完全为零 |

动作轨迹使用五次缓动与连续抬升包络；快速重排有不同横向通道和抬升高度。完整矩形卡片按高度绘制，不把一张牌拆成独立深度排序的三角形。它仍是 2.5D 图形示意，没有刚体、连续碰撞或真实手部驱动。

## 身份和排列

牌 ID 从 `card-01` 到 `card-52`，全片不创建或删除。第一次交织结果为 `01,27,02,28,…,26,52`。后面三个排列用固定种子 Fisher–Yates 生成一次并保存，`permutationStages` 导出全部五个阶段的完整排列。固定种子只用于可复现，不代表随机性证明或密码学安全。

`sample(t)` 的关键字段：

```js
{
  time,duration,phase,stage,reading,
  cards:[{id,rank,suit,value,position:[x,y,z],rotation,
          width,height,flip,faceUp}],
  permutation:[/* 52 IDs */],motionContacts,
  contactPulses:[{eventId,cardId,age,strength}],
  round,completedReorders,permutationMeaning,evidence:'illustrative'
}
```

位置采用逻辑画布单位：X 横向、Y 桌面纵向、Z 为向上的高度；绘制时屏幕 Y 为 `y−z`。`rotation` 为画布平面弧度。`flip` 是 0–1 的翻面进度。

交接过程中，`permutation` 定义为“已抵达的牌按目标顺序在前，未抵达牌按原顺序在后”。它始终是 52 个 ID 的双射，但不能把这个语义清单当成运动中每张牌的空间层级；实体位置由 `cards.position` 给出。所有动作结束后的清单才是完整牌叠顺序。

## 声音跟随动作

`motionContacts` 的每一项含 `id,kind,time,contact,start,cardId,position,priority`。声音事件完全从这组数组选择或延展，不能独立猜一个“差不多”的音效时间。

`buildPlan(mode)` 返回 `cues,contacts,readHolds,masterGain,soundOrigin,levelPolicy`。每个 cue 有：

```js
{
  id,eventId,anchor:'contact',anchorTime,anchorOffset,
  start,end,duration,sound,kind,gain,seed,cardId,
  panTrack:[[time,pan],...],params
}
```

保证 `start + anchorOffset === anchorTime === motionContact.time`。连续摩擦可从动作开始前往终点，因此其 anchorOffset 为正；“接触对齐”指设计时间，而不是合成波形绝对峰值都落在同一采样点。短声的攻击包络需要几个毫秒建立，实际听觉瞬态仍需主观复核。

`panTrack` 每 1/60 秒从对应卡片的实际轨迹取样，合成时线性插值，使用等功率左右声像。`audioControlAt(cue,t)` 返回 `pan,readGain,active`，可供 UI 查看声像与静音策略。

`readHolds` 前 70 ms 渐弱到精确零；窗口结束后保留短恢复包络。此处没有环境底噪、假人声或 TTS，所以可以直接检查静音。若加入真实音乐和讲解，需单独做 duck、响度与真峰值检查，不能把本样例的采样峰值当成最终成片的真峰值。

## 检查

```powershell
node research/motion_atelier/scripts/test_shuffle_rhythm.mjs
```

检查 52 个身份与排列、阶段最终顺序、几何边界、任意 seek、接触位置和速度、所有 cue 的事件来源与时间、空间声像、48 kHz 双声道确定性、采样峰值、DC、单声道兼容与读窗精确静音。还记录三种模式的 Canvas 调用一致性，保证比较时画面不变。

测试不代替听音、运动穿插的视觉审查或真正的纸牌碰撞求解；不自动声称原参考片听感已复刻。
