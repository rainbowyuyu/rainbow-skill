# 速率曲线：位移、变速与弧长

入口：`../../lab/rate-curves.js`。纯 ESM，无依赖；每次从绝对时间求值，不读取播放状态。相同输入得到相同结果，允许暂停、倒序拖动、乱序渲染。

这些是原创数学运动候选，用来比较动作的起落与停留。不能用“采用了弹簧”代替真实机构的质量、驱动力、接触和约束计算。碰撞曲线尤其不适合直接驱动相机。

## 一次采样

```js
import {PRESETS, sampleCurve, sampleMotion} from '../../lab/rate-curves.js';

const normalized = sampleCurve('minimum-jerk', .4);
const world = sampleMotion('minimum-jerk', .96, {
  duration: 2.4, // seconds
  origin: 3,    // metres; pixels/radians can also be used consistently
  distance: 8,  // signed displacement
});
// world.position, velocity, acceleration, jerk: m, m/s, m/s², m/s³
// world.normalized retains normalized values.
```

`u = timeSeconds / duration`。设位移为 Δ、持续时间为 T、归一化位置为 p(u)：

```text
x(t) = origin + Δ p(t/T)
v(t) = Δ/T   · p′(t/T)
a(t) = Δ/T²  · p″(t/T)
j(t) = Δ/T³  · p‴(t/T)
```

时间加倍时，同一归一化位置的速度减半、加速度变为四分之一、jerk 变为八分之一。Δ 可以为负，导数保留符号；不能把绝对值速度曲线误当作有方向的速度。若所有位移都用像素，结果就是 px/s 等单位，不能标成物理速度。

`sampleCurve(id,u,options={})` 返回：

```js
{
  position, velocity, acceleration, jerk, // derivatives w.r.t. u
  u,
  domain: 'finite' | 'settling',
  parameters: {},             // resolved parameters for this preset
  derivativeSide: 'two-sided' | 'left' | 'right',
  atDiscontinuity: false,
  discontinuities: [{
    u, order, kind,
    left: {position, velocity, acceleration, jerk},
    right: {position, velocity, acceleration, jerk},
    leftVelocity, rightVelocity,
  }],
}
```

`order=1/2/3` 表示速度、加速度或 jerk 的第一个跳变。这里的有限单侧值不包含冲量；事件本身若不可导，不能把单侧值称作该时刻的普通导数。内部设计接点取右侧；普通有限曲线的 u=1 取区间内左侧；碰撞事件与最终碰撞取右侧。

`sampleMotion` 返回同样的信息、`timeSeconds/duration/distance/origin` 和 `normalized`。顶层四个运动量已换成实际单位；`discontinuities` 的 u 与导数仍是归一化记录。实际事件时间为 `event.u * duration`，事件两侧的速度乘 `distance / duration`，加速度乘 `distance / duration²`。不要把归一化事件值画在带 m/s 的坐标轴上。

## 十二种候选

| ID | 动作与用途 | 拼接性质或适用边界 |
|---|---|---|
| `linear` | 匀速计量与输送 | 接静止段时速度跳变，C0 |
| `ease-in` | 逐渐加速离场，p=u³ | 终点仍有速度；用于向下一镜交接 |
| `ease-out` | 快速进入后减速，p=1−(1−u)³ | 起点已有速度，需承接已有动作 |
| `ease-in-out` | 余弦启停，p=(1−cos πu)/2 | 速度接得上，加速度在端点跳变，C1 |
| `minimum-jerk` | 10u³−15u⁴+6u⁵，平稳拆解与运镜 | 接静止段是 C2，jerk 仍可跳变 |
| `anticipate-release` | 0–.22 回撤，随后释放至目标 | 有意反向；各段用五次曲线，C2 |
| `overshoot-settle` | .72 抵达目标之外，随后归位 | 设计曲线，C2；不是弹簧方程 |
| `spring-underdamped` | 欠阻尼阶跃响应 | 真实衰减且可越界，u=1 后继续 |
| `spring-critical` | 临界阻尼阶跃响应 | 不越界、渐近到达，u=1 后继续 |
| `hesitate-commit` | .34 到 .42；.34–.52 留白；随后完成 | 中段真停留，各交接 C2 |
| `impact-rebound` | 落下、三次回弹、最终非弹性接触 | 空中共同重力，碰撞有速度跳变；仅 C0 |
| `rush-hold-release` | .22 到 .68；.22–.70 留白；随后交接 | 快速建立状态，再给复杂画面读窗；C2 |

“最小跃度”指固定时长、固定两端位置且速度与加速度都为零时，最小化 jerk 平方积分的五次解。不是任意运动下都具有最小 jerk。

`PRESETS`（别名 `curves`）含 `id,title,feeling,useCase,risk,domain,boundaryContinuity,parameters`。参数元数据含 `key,label,min,max,step,default`，可直接驱动工作台：

| 预设 | 参数 | 默认与允许范围 |
|---|---|---|
| anticipate | `anticipation` | .12，0–.3；初次回撤距离/总位移 |
| overshoot | `overshoot` | .12，0–.3；超出目标距离/总位移 |
| underdamped | `omega` / `zeta` | 12 / .42；2–24 / .1–.95 |
| critical | `omega` | 8.5；2–24 |
| impact | `rebound` | .16；.02–.3；首跳高度/初始下落高度 |

参数越界会报错。仅当前预设列出的参数参与求值；统一工作台可以保留其他预设的参数，但导出时宜只保存当前 `parameters`，避免误以为无关参数生效。

## 弹簧与碰撞的边界

弹簧求解的是 `p″ + 2ζωp′ + ω²(p−1) = 0`，初始 p=0、p′=0。`omega` 是对 u 的固有角频率；实际角频率为 `omega / duration` rad/s。所有弹簧在 u<0 保持原位；u=0 施加阶跃目标，速度连续、加速度开始变化。

```js
// Continue the tail; never substitute position=1 immediately after duration.
sampleMotion('spring-underdamped', 4.5, {
  duration: 2.4, distance: 1, omega: 12, zeta: .42,
});
```

工作台可以扩大观察窗，但“看起来已稳定”不等于响应数学上在该时刻结束。若成片必须有限时长停住，应增加一段匹配位置、速度与加速度的独立桥接，并记录这是设计交接；不能偷偷截断弹簧响应后宣称 C2。

碰撞使用共同的归一化重力 g、恢复系数 `e = sqrt(rebound)`，三次反弹速度满足 `v_after = -e*v_before`。初始下落和三段反弹飞行共用单位时长；最后接触采用 e=0 停住。每一段抛物线内部 a=g、jerk=0，接触处有冲量，既不能宣称加速度处处有限，也不能把曲线上的折点自动模糊成平滑运动。参数是教学运动，不是测量到的真实材料恢复系数。

有限设计曲线 u<0 保持0、u>1保持1。原区间端点的单侧速度不一定为零；查看事件表后再拼接。`sampleCurve('linear',1).velocity` 为1，下一时刻的保持段为0，这个跳变是明确记录的。

## CSS 三次贝塞尔：先反解横轴

```js
import {sampleBezier} from '../../lab/rate-curves.js';
const ease = sampleBezier(.5, [.25, .1, .25, 1]);
// position ~= .802403387584857; it is not cubicY(.5).
```

控制点为 `[x1,y1,x2,y2]`，x1/x2须在[0,1]，y可以越界。先二分求出参数 s 使 x(s)=u，再求 y(s)。导数采用链式法则：`dy/du=y′/x′`，二阶与三阶继续对 u 求导。`parameter` 是反解后的 s，`solveError` 是 x(s)−u 的绝对误差。

u须在[0,1]。当 x′接近0且无法用对角线恒等关系消去奇点时，返回 `singular:true`，相应三个导数为 `null`。这能避免把无穷大或未定义的导数伪装成0。完全位于 y=x 的贝塞尔曲线有可去奇点，直接返回 p=u、p′=1、其余为0。图表应分段跳过空导数。

## 变速必须积分

```js
import {buildTimeRemap} from '../../lab/rate-curves.js';
const remap = buildTimeRemap([
  {time:0, speed:0},
  {time:2, speed:2},
  {time:3, speed:2},
  {time:4, speed:0},
], {sourceOffset:5});

remap.sample(1); // sourceTime=5.5, speed=1, acceleration=1
remap.sourceDuration; // 5 seconds of source media across 4 timeline seconds
remap.sample(4).sourceTime; // 10 = sourceOffset + integrated source duration
```

速度在节点之间线性变化，源时间用梯形面积的解析积分。不能使用 `sourceTime=t*speed(t)`；它通常会跳帧、倒退或错误消费素材。节点时间从0开始且严格增加，speed为非负；speed=0支持真正停格，负速度不在此接口范围。区间外保持源时间。

内部节点的源时间与速度连续，速度斜率可以跳变，所以源时间通常为 C1、并非自动 C2。端点若速度不为0，接保持段也会有速度跳变。此函数没有自动归一化曲线面积；需要消耗多少源时长应通过速度计划显式决定。返回的 `acceleration` 是播放速度对时间的导数，单位1/s，不是物体加速度。

## 等弧长路径，不把曲线参数当距离

```js
import {buildArcLengthTable, sampleArcLength, sampleCurve}
  from '../../lab/rate-curves.js';

const path = q => [8*q, 1.4*Math.sin(Math.PI*q), 2*Math.sin(2*Math.PI*q)];
const table = buildArcLengthTable(path, {segments:1024});

function cameraAt(seconds) {
  const progress = sampleCurve('minimum-jerk', seconds/4).position;
  const distanceState = sampleArcLength(table, progress);
  return {
    position: path(distanceState.parameter),
    distance: distanceState.distance,
  };
}
```

表格按参数均匀取样，以线段弦长近似累计弧长。`sampleArcLength` 用距离反查参数，返回 `point,parameter,distance,totalLength,tangent,degenerate`；`point/tangent` 属于近似折线。示例再次调用原始 `path(parameter)`，以保持在原曲线上，但距离仍是弦长近似。增加segments并比较收敛，不能直接声称任意复杂路径都是精确等速。

fraction限定到[0,1]。本例使用不越界的单调进度；直接传入带回弹的进度会在边界被截住，需先设计能延伸的路径。零长路径返回原点与零切线，并以 `degenerate:true` 标明，不能把它用于未保护的归一化朝向计算。表格是可保存的普通数据；使用者提供的 path 也应是确定函数。

## 验收

在方法库根目录运行：

```powershell
node scripts/test_rate_curves.mjs
```

测试检查端点、单调/有意回退、解析导数对数值差分、C0/C1/C2事件、弹簧方程残差和持续尾部、恢复系数与共同重力、实际单位缩放、CSS横轴反解、速度面积、弧长近似收敛、乱序确定性与非法参数。数值正确不等于观众感觉舒适；真实应用还需观察完整入场、停留、出场以及与旁白的对应。
