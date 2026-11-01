# 一个动作的四种语气

入口：`../../lab/emotion-motion.js`。依赖同目录的 `rate-curves.js` 与 `sound-design.js`，无第三方包、音频采样或配乐文件。

这里将“快、慢、停、弹”转成原创可运行的动作候选。它借鉴参考片如何用动作与声音改变观感的问题，不逐帧复刻作者的画面、字词、音色或配色。参考片里的“停”并不等于静音；本候选特意选择短接触声之后安静，作为自己的对照方案。

## 运行和选项

```js
import {
  presets, durationFor, sample, draw,
  getCueSheet, renderAudio, audioControlAt,
} from '../../lab/emotion-motion.js';
import {encodeWav} from '../../lab/sound-design.js';

const options = {mode:'object', soundStyle:'matched', gain:.65};
const state = sample('fast', frame / fps, options);
draw(ctx, 'fast', frame / fps, canvas.width, canvas.height, options);
const audio = renderAudio('fast', {sampleRate:48000, ...options});
const wav = encodeWav(audio);
```

`presets` 只列四个基础候选，每项包含 `id,title,description,feeling,useCase,risk,duration`。`durationFor('fast'|'slow'|'stop'|'bounce')` 为4秒；另支持 `durationFor('reel')` 为15秒。

| 选项 | 范围与作用 |
|---|---|
| `mode` | `object` 或 `type`，默认object；用同一轨迹显示球形对象或“此刻”二字 |
| `soundStyle` | `matched` 或 `neutral`，默认matched；只改变声音 |
| `gain` | 线性0–1，默认.65；只改变声音，0是真静音 |
| `sampleRate` | 音频合成使用，整数8000–192000，默认48000Hz |

视觉采样不读取 `soundStyle/gain`。两种声音方案的图形状态逐项相同；`mode` 也不改变中心位置与导数。声音方案没有自动做等响度匹配，不能把“更响”当成“更合适”的证据。

## 动作计划

统一画幅、材质、底色与主体，让动作本身产生区别。数字为基础候选中的秒数。

| 候选 | 运动 | 落定与阅读 |
|---|---|---|
| fast | .12–.37短回撤；.37–1.18用五次曲线向终点推进 | 1.18抵达；1.42起为安静读窗 |
| slow | .35–3.20长推进；柔焦逐渐落清 | 3.20抵达；3.52起为安静读窗 |
| stop | .35–.60建立速度；之后匀速接近止挡；1.45理想非弹性接触 | 1.45后位置与速度完全保持；1.68起安静 |
| bounce | .30释放；共同加速度下落，三次反弹后2.65最终接触 | 2.65后完全静止；2.84起安静 |

fast、slow采用同一个归一化横向起终点；fast的短回撤是有意动作。stop在接触时存在速度跳变，不能说全程C2。bounce读取速率核心的共同加速度抛物线与恢复系数 `e=sqrt(.3)`，首跳高度为下落高度的.3；最后一次接触完全非弹性。位置满足支撑面约束，接触处加速度含理想冲量，有限值读数只代表指定侧。

这是归一化图形坐标的运动示例，未指定质量、米制尺度、真实材料或重力场。不能据此宣称完成某种材料、机构或流体的真实仿真。球面光照是Canvas渐变，柔焦是图形滤镜。

## 采样结构与单位

```js
sample(id,t,options) => {
  id, time, duration, mode,
  activeId, localTime, timeScale, offset,
  stage, reading, cut,
  object: {
    x, y, rotation, scaleX, scaleY, radius,
    velocity: {x,y},
    acceleration: {x,y},
    speed,
  },
  motion: {signedVelocity, speed, axis, acceleration, unit},
  floor, target: {x,y},
  contactPulses: [{eventId,time,age,strength}],
  events: [...], theme: {...}, overview,
}
```

x为画幅宽度比例，y为高度比例且向下为正。`velocity` 是这些坐标对成片秒数的导数；`speed=hypot(vx,vy)`，单位标作 `normalized-canvas/s`，不是m/s。要测逻辑像素速度，应使用 `hypot(vx*1200,vy*675)`；非正方形画幅不能把两个比例轴直接当同长度的米制坐标。

`motion.signedVelocity` 在横移动作中为vx，bounce中为vy，`motion.speed` 始终非负。音效使用同一归一化速度，频谱映射属于设计，不是多普勒或空气动力学求解。

t须为有限数字。负时间取起点，超过总时长取最终状态；任意顺序重复采样一致。精确接触时采用右侧速度；reel的事件时间会对齐到其基础事件，避免浮点回算落在接触前一侧。

## 15秒串联

`reel` 的0–3、3–6、6–9、9–12秒依次展示fast、slow、stop、bounce。各自4秒基础时间以4/3倍率压到3秒，因此位置读同一个状态，实际速度乘4/3，加速度乘(4/3)²。声音事件落点按同一时间映射；短音的持续时间也除以4/3，音高不作整体倍速处理。

3、6、9、12秒是明确剪辑边界。事件表记录 `kind:'cut'`，不假称跨段位置连续。12–15秒展示四个静态终态与简短总结，不再驱动主体，也不铺底噪。说明文字在最初.3秒入场，主体位置保持不动。

## 事件与音效

事件结构：

```js
{
  id, kind, time, anchor, priority,
  // sourceId/localTime/timeScale present on base-motion events
  // incomingVelocity/outgoingVelocity present on contacts
}
```

所有 `time` 是**当前片段的全局秒数**，reel已做映射。kind可能为onset、release、peak、arrival、contact、reading、cut。anchor为onset、peak、end或contact。图形接触脉冲、音效与阅读窗均来自这份事件表。

`getCueSheet(id,options)` 返回数组：

```js
{
  id, eventId, sourceId, sound,
  start, end, duration,
  anchor, anchorTime, anchorOffset,
  priority, gain, seed, params,
  clock: {offset,scale},
  // continuous air also includes speedReference, contactTimes and envelope
}
```

cue ID包含片段、基础动作、事件与音色，全片唯一。`start + anchorOffset = anchorTime`，并对应同ID视觉事件；主要瞬态可能略晚于合成音的起点，不能把设计落点冒充声峰实测。

matched用实际速度驱动短气流噪声，并给抵达或接触安排少量原创模态声；没有环境底噪。neutral在相同视觉事件上使用相同的短确认声、源种子和基础增益，不加入连续气流。neutral的声像仍随事件位置，时机保持对应。

`audioControlAt(cue,time)` 返回 `{speed,pan,envelope,frequency,unit}`。连续气流的主包络是 `clamp(actualSpeed / 1.6)`，加8ms起尾门控；理想接触前后用6ms声学门控，避免速度跳变把滤波噪声切成无关的数字点击。控制读取实际轨迹的导数，不用一条固定假速度包络。

`renderAudio` 输出：

```js
{left:Float32Array, right:Float32Array, sampleRate, duration, cues}
```

两轨长度精确为 `round(duration*sampleRate)`。没有隐藏限幅、压缩、自动归一化或人声占位。全局gain只乘一次；种子固定；源音和文件首尾归零。各阅读窗为真静音，reel最后3秒也是静音。没有通过安静读窗声称参考作者原片就是这种声音安排。

浏览器应把合成PCM放入AudioBuffer，用AudioContext时钟驱动画面。seek时从绝对偏移重建播放节点；不要用requestAnimationFrame次数累加声音事件。暂停、换方案时的旧节点短淡出由UI负责。

## 绘制与支撑面

`draw(ctx,id,t,width,height,options)` 直接调用sample并返回同一状态。使用1200×675逻辑画幅，按统一比例缩放并留边，避免竖向拉伸字体与物体。fast的拖影采样真实较早状态；slow的柔焦是明确的图形表现，未模拟镜头光学。

文字模式用实际字体墨迹ascent/descent定位底缘，支撑面与主体中心保持一致。横向止挡根据实际字体右边界定位，不能套球半径后让文字穿墙。换字体后仍需检查浏览器实际字形、遮挡和接触视觉；数值轨迹不能替代字形渲染验收。

## 检查范围

```powershell
node scripts/test_emotion_motion.mjs
```

结果写到 `qa/emotion-motion-numerical.json`。覆盖绝对时间与乱序采样、位置导数、速度缩放、支撑面与恢复系数、明确剪辑、声音事件对齐、实际速度气流、静音窗、PCM确定性、样本峰值、直流分量、单声道兼容、独立音源边缘与未叠加其他声音的调度边界。

正常气流噪声内部的相邻样本变化不是数字点击判据；检查将音源起尾和调度边界分开。Canvas调用记录仅验证确定性及有限数值，不宣称完成浏览器视觉验收。报告也不代替人工听感、真峰值测量或对观众情绪的验证。
