# 从同一主体到作用点，从实体量到公式项

这两个原创候选在现有候选库中运行，分别归入“机构”和“可视化”。参考依据为 [汽车飞行研究记录](../../studies/car-ignition.md) 的密集抽帧观察，尤其是 83–87.5 秒的低机位作用点、42–47 秒的实体量与代价公式接力。这里复现的是叙事方法，并未取得或重建作者源代码，也未验证参考片的车辆控制解。

入口：`../../lab/modules/continuity.js`。与现有工作台使用相同 `candidate.sample/draw` 接口，不增加依赖或新页面。

```js
import {shellToForce,quantityToTerm} from '../../lab/modules/continuity.js';

const option = {palette:'titanium'}; // 另有 ember / porcelain
const t = frame / fps;
const state = shellToForce.sample(t, option);
shellToForce.draw(ctx,t,1600,900,option);
// 或 quantityToTerm.sample / quantityToTerm.draw
```

两个候选均为 12 秒、`loop:false`，超出时长保持终态。负数与非有限时间按 0 秒处理。状态只依赖输入时间，倒放、跳转、单帧输出不需要预热。通用工作台的 intensity 不改变这两个候选的装配关系或教学数据；配色可以切换。

## 候选与时序

| 候选 | 时段 | 画面与交接 |
|---|---|---|
| `continuity-shell-to-force` | 0–1.25 s | 建立完整载具与地面关系 |
| | 1.25–3.15 s | 两侧壳体和顶盖沿固定局部方向让位，四喷口留在底盘 |
| | 3.25–4.75 s | 相机平滑降低，显露底部作用点 |
| | 5.1–6.45 s | 排气与向上反作用力依次建立，标注连到实际喷口出口 |
| | 6.5–8.7 s | 机位、壳体、喷口和力的长度保持，供阅读 |
| | 8.75–12 s | 力与排气收束，相机回升、壳体闭合，恢复相同外形 |
| `continuity-quantity-to-term` | 0–1.2 s | 建立观察姿态，显示待解释的公式 |
| | 1.2–2.75 s | 归一化速度从 .30 到 .90，向下箭头变长 |
| | 3.15–4.4 s | v 标签交给第一项，先到位再高亮 |
| | 4.4–5.05 s | 第一处稳定读数窗 |
| | 5.25–6.8 s | 归一化倾角从 .10 到 .70，实体随之倾斜 |
| | 7.2–8.55 s | θ 标签沿空白走廊绕过公式和已到位标签，再高亮第二项 |
| | 8.6–12 s | 两项合并，保持读数与主体姿态 |

## 数据与坐标约定

载具固定 ID 为 `inspection-probe-01`。局部坐标中 X 沿长轴、Y 向上、Z 为横向。父变换先进行局部 XY 平面倾斜，再绕 Y 轴旋转，最后平移。所有底盘、喷口、壳体、影子源点使用这一变换。单位是教学世界单位，未标定真实汽车尺寸。

四个喷口的局部安装点为 `(±1.36, −.20, ±.67)`。出口始终在对应安装点局部 Y 方向下方 .47，连接结构属于底盘；外壳只沿声明的 `offset` 离开。没有把底部喷口与壳体一起移到空中。

```js
shellToForce.sample(t) => {
  time, phase, stage, evidence:'illustrative',
  vehicle:{id,position,yaw,roll},
  nozzles:[{id,parentId,local,world,exit,direction}],
  shells:[{id,parentId,local,offset,world}],
  camera:{position,target,fov,roll,near,focusDistance},
  open, inspect, exhaust, force, readWindow,
  label:{id,anchor,position,elbow,alpha,text},
  shadows:[{id,sourceId,center}], lightDirection, groundY
}
```

几何输出通过 `buildVehicleGeometry(state,theme,{closed,showForces})` 提供。所有面统一透视并按深度排序；不透明面的前后关系、近面裁切交由现有 `camera-flight-common.js`。这是轻量 Canvas 面绘制器，透明排气与平均面深度排序不能替代逐像素深度缓存；复杂交叉模型应转到 Three.js/Blender。

影子由实际部件顶点按固定方向光投向同一地面，再取各部件凸包。它能跟随拆壳位置，不是画面上静止的椭圆，但仍是平面投影近似，**不是光追**。

## 公式语义

公式是归一化教学代价：

`J = wᵥ v² + wθ θ²`，其中 `wᵥ = .6`，`wθ = .4`。

v 是箭头编码的归一化速度读数，主体保留可观察的取样姿态；不把该箭头数值冒称为位置的时间导数。θ 是归一化倾角，实际演示的机体转角为 `θ × .54` 弧度。对应真实数据时，应先明确速度尺度与倾角尺度，再替换示例参数。θ 本身不是以弧度显示的角度值。

初值代价为 `.6 × .3² + .4 × .1² = .058`；速度改变后为 `.490`；最终为 `.6 × .9² + .4 × .7² = .682`。只在一个参数变化完成后才启动另一个，显示数据与可视化读取同一状态。固定公式基线为逻辑画布 y=468。

```js
quantityToTerm.sample(t) => {
  vehicle, nozzles, camera, offsetX,
  v, theta, thetaRadians, weights, terms, J,
  velocityArrow:{base,tip}, angleAnchor,
  labels:{velocity,angle}, // 每项含 source/target/position/handoff/alpha
  connectors:{velocity,angle},
  formula:{baseline,positions,highlight},
  readWindow, stage, evidence:'fixed-teaching-example'
}
```

`projectContinuityPoint(point,camera,offsetX)` 和 `vehicleToWorld(local,vehicle)` 可用于接入项目标注。公式段在逻辑画布中左移世界投影 325 px，右侧留给固定公式，不对单个物体或箭头独立缩放。

## 验证与接入

运行：

```powershell
node research/motion_atelier/scripts/test_car_continuity.mjs
```

脚本检查刚性连接、身份、影子投影来源、镜头与装配阶段速度连续、阅读窗口、逐项代价、公式基线、标签安全区与不重叠、任意时间跳转，以及可重复的 Canvas 绘制调用。记录 Canvas 调用不是浏览器视觉验收，数值通过也不证明具备真实飞行能力。

接入视频时保留对应阅读窗，并用经过验证的几何/尺寸/作用力替换示意数据。若压缩时间，应重新测标签速度与读数停留；不要把 12 秒动画整体加速到一闪而过。
