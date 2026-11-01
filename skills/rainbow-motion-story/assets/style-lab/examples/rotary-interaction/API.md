# 理想转子机构：观察开口与轴向拆解

`lab/modules/rotary-interaction.js` 导出两个有限候选：

| id | variant | 时长 | 默认预览 |
| --- | --- | --- | --- |
| `mechanics-rotary-section` | `section` | 18 s | 8 s |
| `mechanics-rotary-explode` | `explode` | 18 s | 9 s |

均为 `loop: false`，阶段时间是 `[0, 2, 5, 10, 14, 16]`。默认 18 秒内输出轴转三圈、转子转一圈，标识 A/B/C 绑定同一物理顶点。最后回到完整装配；所有姿态均由绝对时间计算，可随机跳转或倒放。配色与 intensity 控件关闭。

```js
import {
  candidates, sampleRotaryInteraction, drawRotaryInteraction,
  buildRotaryScene, frameRotaryScene, frameRotaryState, makeRotaryProjector,
  visibleRotaryFaces,
} from '../../lab/modules/rotary-interaction.js';

const options = {
  shaftAngle: Math.PI * 1.6,
  viewYaw: 0.46,
  viewPitch: 0.46,
  cut: 1,
  explode: 0,
  labels: true,
};
const s = sampleRotaryInteraction(8, 'section', options);
drawRotaryInteraction(ctx, 8, canvas.width, canvas.height, options, s);
// 或 candidates[0].sample(8, options) / .draw(ctx, 8, width, height, options)
```

参数及覆盖顺序：

| 参数 | 范围 / 默认 | 含义 |
| --- | --- | --- |
| `shaftAngle` | 有限弧度 / 未设置 | 绝对输出轴角，优先于 `motionTime`；保留未取模角度和顶点身份 |
| `motionTime` | 有限秒数 / 跟随时间线 | 只覆盖运动相位；每 6 秒输出轴一圈，不改变拆解时间线 |
| `viewYaw` | −0.65 … 0.65 / 0.46 rad | 绕竖直轴观察 |
| `viewPitch` | 0.2 … 0.8 / 0.46 rad | 俯视角 |
| `cut` | 0 … 1 / 跟随时间线 | “观察开口”：完整前端盖先沿轴退出，再横向停放；没有透明擦除或任意 CSG |
| `explode` | 0 … 1 / 跟随时间线 | 后端盖、壳体、转子、前端盖沿装配轴的独立位移 |
| `labels` | boolean / true | 显示近物零件标签；固定顶点颜色和必要角度读数始终保留 |

`cut` 与 `explode` 可独立覆盖；二者都不改变 `shaftAngle`、`rotorAngle`、`center` 或 `apices`。未设置、`undefined`、`null` 或非有限数的覆盖值退回默认时间线/默认相机。时间线的非有限输入按 0 处理，有限时间限制在 `[0,18]`。对正在暂停或拆解的画面传入固定 `shaftAngle`，可单独调整前盖或视角；传入不同 `shaftAngle`，可保持拆解位置继续转动。

采样状态提供：

- `time`, `motionTime`, `shaftAngle`, `rotorAngle`, `shaftTurns`, `rotorTurns`。
- `center: {x,y}` 与 `apices: [{x,y},…]`，坐标 y 向上；轴线为 z，前端为正 z。
- `cut`, `explode`, `camera.{type,yaw,pitch,right,up,view,scale,principalPoint}`。
- `parts[]`：稳定的 `id`, `label`, `restPosition`, `travel`, `position`, `thickness`，运动件附 `angle`。
- `stageIndex`, `stage`, `annotation`, `variant`, `labels`, `sceneId`, `parameters`, `motionSource`。
- `drive.defaultShaftDemoRpm` / `defaultRotorDemoRpm` 标明默认时间线的 10 / 3⅓ rpm 演示与 `speedRatio: 3`，不是实际发动机额定转速。覆盖相位时 `speedKnownFromSample: false`；单个绝对角度不能推出即时转速，`instantaneousRpm` 为 `null`，UI 应使用自己的电机事件时间线。

`buildRotaryScene(state)` 返回实体面 `faces`、顶点标记 `markers` 与标签锚点 `landmarks`。壳体包括连续内壁、外壁和封闭环状端面；前后盖为带轴孔的有厚度实体。`frameRotaryScene` 根据实际实体投影边界得到绘图相机；`makeRotaryProjector` 为正投影，深度数值越大越靠近观察者。`visibleRotaryFaces` 进行背面剔除和全局面深度排序。固定颜色标记加入同一深度序列，因此会被实体前盖遮挡。

`state.camera` 是采样基础相机；渲染前使用 `frameRotaryScene(state, buildRotaryScene(state))` 得到实际取景相机。导出时用 `frameRotaryState(state)` 得到逐值相同的结果：它共享实体生成器的全部顶点，只跳过面、法向和材质数据的构造；没有另一套近似边界，也不使用依赖调用顺序的状态缓存。工作台 JSON 的每帧 `camera` 保存实际取景，`baseCamera` 保存基础相机。支持的相机域为 yaw ∈ `[−0.65,0.65]`、pitch ∈ `[0.2,0.8]` rad，不能把这个有限域的 Canvas 面排序扩展承诺为任意 orbit。

## 电机事件 API

纯 ES 模块 `lab/modules/rotary-session.js` 不依赖 DOM。事件为 `{time, rpm, angle}`，时间单位秒、角度单位弧度，速度是输出轴的演示 rpm。

| 导出 | 行为 |
| --- | --- |
| `DEFAULT_MOTOR` | `[{time:0,rpm:10,angle:0}]`；使用时复制数组和对象 |
| `validateMotor(events)` | 验证非空、首个时间为 0、时间严格递增、角度连续、速度 0–30 rpm；无效输入抛错 |
| `motorAt(events,t)` | 解析所在恒速段，返回 `{angle,rpm}`；负时间按 0，有限的后续时间可继续求值 |
| `setMotorSpeed(events,t,rpm)` | 返回新事件数组，保留 `t` 以前事件与 `t` 的连续角度；替换 `t` 及之后的全部计划 |
| `resumeSpeedAt(events,t)` | 返回 `t` 之前最近的正速度；没有时返回 10 rpm |
| `TAU` | `2π` |

每段使用 `angle(t) = event.angle + (t − event.time) × event.rpm × 2π / 60`。事件起点角度必须与前一段末端相等，允许的验证误差为 `1e−8 rad`。有限数检查不接受 `NaN` 或无穷值。

```js
import {
  DEFAULT_MOTOR, motorAt, setMotorSpeed, resumeSpeedAt,
} from '../../lab/modules/rotary-session.js';

let events = DEFAULT_MOTOR.map(e => ({...e}));
events = setMotorSpeed(events, 4, 18); // 4 s 角度不跳；之后以 18 rpm 继续
events = setMotorSpeed(events, 8, 0);  // 从 8 s 冻结，分镜仍能继续
events = setMotorSpeed(events, 11, resumeSpeedAt(events, 11));
const {angle, rpm} = motorAt(events, 12);
const state = sampleRotaryInteraction(12, 'explode', {shaftAngle: angle});
// rpm 是此时电机事件定义的速度；state 仅凭绝对轴角不能测出 rpm。
```

在同一个时间重新调速会替换该时间的事件；退回较早时间调速会清除它之后的旧计划。这个规则用于编辑剩余运动，不保留被覆盖的未来速度。手动开口、拆解与视角操作都不修改事件数组。

## 工作台与导出契约

入口为 `lab/rotary-interaction.html`，交互脚本为 `lab/rotary-interaction-studio.js`。工作台始终先由 `motorAt(motorEvents,t).angle` 求 `shaftAngle`，再调用候选的 `sample` 和 `draw`。播放倍率只控制时钟速度，默认电机事件仍为 10 rpm。

选择“手动检查结构”时拾取当前 `cut`/`explode`，操作不跳变；选择“按分镜演示”后恢复时间线。点阶段按钮会暂停、退出手动开口/拆解并跳至阶段时间，同时保留 `motorEvents`、视角和标注。时间条跳转本身保留手动模式。调速、冻结、视角拖动和结构滑杆会先暂停；再次播放才推进演示时间。冻结事件保持轴角，分镜可以继续开盖或回装。

“恢复分镜与默认转速”清除手动状态、视角覆盖和电机事件，恢复标注，但不重置当前时间。“从头播放”重置时间并开始播放，保留当前运动计划和观察设置。播放到终点停住，再点播放从 0 秒开始。

导出 JSON 的顶层字段：

| 字段 | 内容 |
| --- | --- |
| `schemaVersion`, `candidateId` | 版本 1 与候选 ID |
| `duration`, `fps`, `time` | 18 秒、30 Hz、导出时当前显示时间 |
| `motorEvents` | 完整的分段恒速事件 |
| `options` | `{manual,cut,explode,view,labels}`；当前的全段观察设置 |
| `angleUnit`, `geometry` | 弧度与理想教学几何说明 |
| `renderFrameRange` | `[0,539]`，18 秒视频实际使用的 540 帧 |
| `endpointFrame` | `540`，18 秒终点，仅作状态验证 |
| `code`, `guide` | 模块和复用指南的项目相对路径 |
| `frames` | 541 个状态点，`time = frame / 30`，含起点和终点 |

各状态点提供 `frame,time,shaftAngle,rotorAngle,cut,explode,camera,baseCamera,parts`。`camera` 由轻量的 `frameRotaryState(s)` 计算，与 `frameRotaryScene(s, buildRotaryScene(s))` 相同，含实际取景比例、画面中心和投影边界；`baseCamera` 是 `s.camera`。默认画布为 1600×900，其他输出分辨率沿同一参考画布等比例缩放。

```js
// 导出状态的关键区分：完整状态区间有 541 点，视频帧区间只有 540 帧。
const states = Array.from({length: 541}, (_, frame) => {
  const t = frame / 30;
  const s = sampleRotaryInteraction(t, variant, {
    shaftAngle: motorAt(motorEvents, t).angle,
    labels,
    ...(manual ? {cut, explode} : {}),
    ...(view ? {viewYaw: view.yaw, viewPitch: view.pitch} : {}),
  });
  return {frame, time:t, shaftAngle:s.shaftAngle, rotorAngle:s.rotorAngle,
    cut:s.cut, explode:s.explode, parts:s.parts,
    baseCamera:s.camera, camera:frameRotaryState(s)};
});
const videoStates = states.slice(0, 540); // t=0 … 17.966… s
const terminalState = states[540];       // t=18 s
```

导出保存当前计划而非所有操作轨迹：电机变化有事件历史；当前手动开口/拆解与视角用于全段；分镜模式下开口/拆解随时间线变化。JSON 不保存视角拖动路径、开口滑杆手势或播放倍率的历史，也不直接生成 MP4。PNG 下载保存当前暂停帧。

这些是原创的理想教学几何：壳体和运动学取自 `rotary-geometry.js`，转子为经边界检验的直边三角形。并非 Mazda 13B 的生产曲面、内齿、气口、密封或燃烧模型；没有功率或压力推断。渲染使用不透明 Canvas 多边形、法向光照近似与二维柔和底影；并非路径追踪或 CAD 布尔求交。前盖移开后观察到的壳体端面是真实环带网格，不是透明矩形覆盖层。

验证：从项目根执行 `node scripts/test_rotary_interaction.mjs`。测试包括全圈带标记运动、边界保持、独立参数、前盖双阶段路径、正投影正交基、网格端面/内壁、相机极限取景、随机顺序采样与实际 Canvas 命令确定性。轻量取景与完整网格路径在两个候选的全部 1082 个导出状态、极限视角和随机手动状态逐值比较；测试打印两种路径的本地计时，不将设备相关时长设为硬性性能承诺。几何公式与更密集的边界测试由 `test_rotary_geometry.mjs` 独立承担。
