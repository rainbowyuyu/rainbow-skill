# 水体接入的原创数学小工具

入口：[water-contracts.mjs](water-contracts.mjs)。纯 ECMAScript module，无 npm 依赖。用于把已有水体经验变成可验证的输入/输出契约；不是 WaterPro 包、GPU renderer、浮力求解器或完整流体模拟器。

方法来源：[成熟路线](../../guides/production-toolkit.md)、[历史水体实现](../../studies/production-water-lessons.md)。商业包仍留在已有授权位置，不随技能分发。

## 绝对帧与同一波面

```js
import {timeAtFrame, sampleWaveSurface} from './water-contracts.mjs';

// 这是接口演示的单波参数，不是实测海况或通用材质预设。
const components = [{amplitude:0.2, kx:0.8, kz:0.1, omega:1.6, phase:0}];
const time = timeAtFrame(45, 30);
const surface = sampleWaveSurface(components, {x:2, z:3, time, seaLevel:0});
// surface.height / elevation / slopeX / slopeZ / normal / velocityY
```

坐标为米制，Y 向上；`amplitude` 为 m，`kx/kz` 为 rad/m，`omega` 为 rad/s，`phase` 为 rad，`time` 为 s。相位为 `kx*x + kz*z - omega*time + phase`。

`velocityY` 是固定 `(x,z)` 处的水位导数 `∂η/∂t`，不是波的相速度，也不是流体质点完整速度。数据中的 `intrinsicOmega` 不能随意代入 `omega`；水平流速、压力、色散关系与刚体运动仍由原工程模型计算。

此接口没有 camera/footprint 参数：改变镜头不能改变物理水面。显示 shader 可以独立过滤不可解析频率，但实体、水线与保存轨迹须保持原物理契约。读取 NS V10 浮标时继续用其保存轨迹与四元数插值，不把 `surface.height` 直接赋给刚体质心来取代积分。

`timeAtFrame` 接受非负整数帧和正 fps。波面采样接受有限数值时间，可反向查询，不修改输入。空波谱明确代表静水；缺失或非有限模式字段直接报错。

## 预乘颜色、覆盖率和同一天空

```js
import {composeReflection} from './water-contracts.mjs';

const reflected = composeReflection([
  {premultiplied:[4, 2, 1], coverage:1, weight:1},
  {premultiplied:[0, 0, 0], coverage:0, weight:3},
], [0.1, 0.2, 0.3], 1);
// radiance = [1.075, 0.65, 0.475], coverage = 0.25
```

输入 RGB 必须是场景线性、已经乘 coverage 的辐亮度；不是截屏 sRGB。各 tap 的 `coverage` 为 0–1，权重非负且总和大于零；函数归一化权重，RGB 与 coverage 使用同一核。HDR >1 保留，零覆盖 tap 不能带有非零预乘色。

`background` 为该反射射线对应的同一环境/天空。`edgeConfidence` 为 0–1，同时衰减预乘色和 coverage，屏边退回天空，不退回黑色。输出：

```text
Lincident = filteredPremultiplied + (1-filteredCoverage)*Lsky
```

这是**入射反射辐亮度**，未乘 Fresnel。接入已经计算 Fresnel 的 WaterPro 材质时，将它放在正确的反射输入处，不能再叠到最终水色上。

## 一个界面只混合一次

```js
import {fresnelSchlick, blendWaterInterface} from './water-contracts.mjs';
const iorFrom = 1.0, iorTo = 1.333; // 单纯接口示例，按实际介质选择
const f0 = ((iorFrom - iorTo) / (iorFrom + iorTo)) ** 2;
const F = fresnelSchlick(0.8, f0);
const color = blendWaterInterface(reflected.radiance, [0.03,0.08,0.10], F);
```

上段只有在自行实现界面混合时采用。若 renderer 已完成这一步，禁止再调用 `blendWaterInterface`。`fresnelSchlick` 是 Schlick 近似，`cosTheta` 钳制至 0–1；不处理全反射或完整粗糙微表面。`belowSurface` 由调用方提供，函数不计算体积吸收、折射、散射或焦散。

## 运行检查

在方法库根目录执行：

```powershell
node scripts/test_water_contracts.mjs
```

或显式读取已有 NS 工程波谱（不复制数据）：

```powershell
node scripts/test_water_contracts.mjs --spectrum D:/projects/manim_extend_rainbow/video_project/navier_stokes_water/public/v02/physics/ocean-spectrum.json
```

基础 9 组检查覆盖有限差分梯度/时间导数、周期/坐标一致性、任意顺序采样、输入不变、透明边缘与 HDR、参数错误、数值溢出和单界面混合。即使输入有限，若中间运算溢出也显式报错。指定波谱后第 10 组核对实际 48 模态数据的读取与重复采样。输出 qa/production-toolkit/water-contracts.json（外部或本机资源，未随公开包收录）。

这些是本轮新执行的 CPU 数学检查，不是供应商 API、GPU 像素、物理标定、整片视觉或声音验收。工程中的实际版本适配器、浮标积分与运行时检查见研究笔记。
