# WaterPro 与已有水体方案的复用

2026-10-24 从本机 Falcon、上海中心、NS 与 Blender 实例整理；2026-10-27 补充能力边界表与生产路径。

先读 [路线索引](../../rainbow-motion-story/assets/style-lab/guides/production-toolkit.md)，需要深入接入时读 [WaterPro 审计](../../rainbow-motion-story/assets/style-lab/studies/waterpro-local-audit.md) 与 [水体经验](../../rainbow-motion-story/assets/style-lab/studies/production-water-lessons.md)。后两者保存真实入口、拒绝版本和历史 QA 范围；不用把长笔记复制进每个技能。

## 选路线

- 原生海面采用已有商业 WaterPro 接入。已观察本机版本 3.1.1；Falcon 原生适配器使用 Three 0.183.0。共享包路径、31 个读取时来源哈希见 来源清单（外部或本机资源，未随公开包收录）。这是本地版本记录，非最新版本声明。
- 城市河面采用上海 V28 的世界坐标岸线、剖面覆盖与镜像反射。当前原生 SSR 关闭；不要套用旧 V25 的说明。
- 波浪教学和浮标采用 NS V10 的保存波谱、GPU/CPU 同相位与离线积分轨迹。早期 `WaterWorld.ts` 只有坡度跟随；V10 读取单向浮力近似模型的轨迹，两者分开。
- 倾倒、碰撞、破碎或体积液体转到 [Blender 原生流程](../../rainbow-motion-story/references/modules/blender.md)，读取实际 Mantaflow/Cycles 小样与缓存说明。

| 当前镜头需要 | 首选入口 | 不要用 |
|---|---|---|
| 海平面穿越、读实际水位、船体与火箭近景 | Falcon V03 `NativeOcean.ts` | 早期 WebGL 适配 |
| 城市江面、真实岸线、开挖剖面 | 上海 V28 `NativeRiverV21.ts` | 旧 V25 反射说明 |
| 楼群完整倒影、屏外回退 | 上海 V28 `PlanarRiverReflectionV25.ts` | 把镜像反射说成路径追踪 |
| 航拍移动时水面闪点、摩尔纹 | 上海 V28 `RiverNormalFilterV27.ts` | 用整图模糊压平闪点 |
| 波浪教学、剖面、实体浮标 | NS V10 `OceanWorld.ts` + 离线积分轨迹 | 用 `WaterWorld.ts` 声称浮力积分 |
| 倒水、碰撞、体积液体、离线光追 | Blender Mantaflow/FLIP + Cycles | 用海面波谱承担体积液体 |

## 能力名称必须分开

这张表防止"能渲染水面"被扩写成"物理仿真完成"。每条都用具体证据说话。

| 名称 | 实际证据 | 可以说 | 不应说 |
|---|---|---|---|
| WaterPro 原生 FFT/Gerstner | `NativeOcean.ts` / `NativeRiverV21.ts` 调 `WaterSystem.create`；历史 run 实际 backend 为 WebGPU | 原生 GPU 波面、固定 seed/tick、读实际采样高度 | 完整三维 NS / 流固耦合 / 实测海况 |
| SSR | `water.ssr.enabled=true`，64 steps、550 m 属该镜头参数 | 屏幕空间反射，与天空环境共同工作 | 屏外物体都能反射 / 全片路径追踪 |
| 镜像平面反射 | `PlanarRiverReflectionV25.ts`、NS Reflector | 镜像相机采集真实几何并回退天空 | 逐波面多次物理光线反弹 |
| 原生 wake/spray/rain | 供应商本地 API 有子系统；接入层主动关闭 | 供应商具备这些接口，需另行连续仿真验收 | 已在任意倒序渲染中通过确定性验证 |
| 旧 WaterProCompat/WebGL 适配 | `WaterProMarine.ts`、`WaterSurfaceState.ts` | 商业派生的有限 24 模态方向谱适配 | 商业原生 GPU FFT |
| NS 早期教学海面 | `source/WaterWorld.ts` + `docs/water-rendering.md` | 早期米制解析重力波、同场景示意 | 浮力积分 / 完整 CFD |
| NS V10 积分浮标 | `OceanWorld.ts::setBuoy`、`generate_ocean_physics.py::forces/integrate`、`physics-validation.json` | 36 条体积柱浮力、相对水速阻尼、恢复力矩、四元数积分 | 双向耦合 / 商业 RAO 标定 |

## 必须带走的修复经验

1. **时钟和读回。** 记录实际 backend、seed、fps 和 tick。Falcon 针对 3.1.1 的同目标 tick 双次更新，是为刷新波面并消化 GPU 水位读回；升级版本后重新验证，不照抄为通用 API。wake/spray/rain/foam 的历史状态要关闭、顺序预热或缓存验证，固定 seed 不等于全部可任意 seek。
2. **同一光场。** 世界太阳、HDR、云、水反和阴影共享方向。在原生 depth/SSR/shadow 捕获之前完成同步；Falcon 使用 `lighting.addSunSyncListener`。只在最终 render 前补灯光会让 pass 错位。
3. **单一反射界面。** 镜像捕获几何的预乘 HDR RGB 和 coverage，使用同一核过滤，缺失区回同一天空。它是入射辐亮度，随后只做一次原生 Fresnel；不要叠到已经含 Fresnel 的水色上。有限天空壳不要在镜像捕获中产生硬截面。
4. **先滤法线，再做 Fresnel。** 上海 V27 在计算法线源头更新完整 mip、三线性缩小与设备能力诊断。针对 Three 0.183 的 backend 诊断和 `updateBefore` 包装有版本耦合。平均法线不保存未解析斜率方差，远景仍需恰当粗糙度；末端模糊不等价。
5. **水与实体同源。** 波谱/时间/单位一致，实际姿态决定水线；反射里也裁掉水下实体。渲染 footprint 只影响显示，不改变浮力。开挖时水面和地面使用同一覆盖，color/depth 同步裁切。
6. **按输出取证。** 同机位分解 mask/native/scatter/planar/final；检查近景、远景、逆光、岸线/浮体和接缝。分别记录 GPU 状态、重复帧、相邻帧与最终编码。数值通过不替代连续画面检查。
7. **尺度不迁移。** 水色、阴影视锥、`normalBias`、波长与雾距离都跟实际尺度绑定。公里级海面参数搬进水面杯子或上海航拍会直接穿帮，必须按米制重选。
8. **吸收系数是线性值。** 不要把每米吸收系数当 sRGB 十六进制再转换，那会得到乳白或过透的水。
9. **种子有实现缺陷。** 3.1.1 的大日期式种子经 float32 哈希会丢索引低位，出现同心谱伪影；该校验使用小种子 7。这是"固定种子并验证具体实现"，不是"7 是普适正确值"。
10. **反射不能替代表面。** 只有入射辐亮度走镜像，最终颜色仍由原生水色 + 一次 Fresnel 决定；两者混排过一次，出现过双界面白条和灰河。

## 与影片其他部分共用的成熟方案

水不是孤立的。以下五条来自旧片实战，接入时和水体按同一份状态表执行；详读 [成熟方案索引](../../rainbow-motion-story/assets/style-lab/studies/mature-production-recipes.md)。

| 问题 | 做法 | 现成入口 |
|---|---|---|
| 水、浮标、公式、声音各走各的时钟 | 四种时钟显式映射：成片负责剪辑，物理/解释时刻控制采样，相机独立路径，源曲时刻定位音乐 | `lab/adapter.js::drawFrame`、`lab/modules/camera-time.js::actionClock` |
| 从外景切进船载/机载视角就翻转 | 位姿与投影一起交接，眼点绑定真实安装点，roll 取最短角差 | `assets/camera-handoff.mjs`、`lab/camera-driver.js` |
| 文字在动的水面上跳位、公式失去身份 | 固定字位与语义阅读窗；先变化、再结果、再稳定阅读；水面运动不参与排版 | `modules/type-life.js`、`guides/motionface-type.md` |
| 音效比浪花晚、音乐盖旁白 | 接触声读接触事件，掠过声读实际相对速度；自然句源先测时再排留白 | `examples/sound-design/API.md` |
| 长片渲染中断、缓存错接 | 输入指纹、逐帧原子落盘、缺帧恢复、编码核验 | `references/case-study-pid-v06.md` |

## 可执行辅助与真实边界

[原创数学工具 API](../../rainbow-motion-story/assets/style-lab/examples/production-toolkit/API.md) 提供 `timeAtFrame`、`sampleWaveSurface`、`composeReflection`、`fresnelSchlick` 和 `blendWaterInterface`。已对同谱梯度/水位导数、HDR/coverage 和单界面混合做 CPU 检查；它不运行 WaterPro、不积分刚体，也不证明 GPU 无闪烁。

```
复用前的五项检查
[ ] backend 与版本：实际 WebGPU/WebGL、WaterPro 版本、Three 版本、固定 tick
[ ] 单位与尺度：米制、波长、clipmap、雾距离、吸收系数是线性值
[ ] 状态源：太阳/云/HDR/阴影/水面同一帧状态，同步发生在捕获之前
[ ] 反射单界面：预乘色与 coverage 同核过滤，回退同一天空，只做一次 Fresnel
[ ] 输出取证：GPU 状态 → 重复帧 → 相邻帧 → 接缝 → 编码，逐级记录
```

这五项里任何一项没有记录的，交付说明里只能写"未检查"，不能写"已通过"。

商业 WaterPro 和标有商业派生声明的旧 `WaterProMarine.ts` / `WaterSurfaceState.ts` 不进入共享技能。案例接口须在本工程确认导入链、资源、许可和状态恢复后使用。

原生 FFT/Gerstner、解析波、SSR、平面反射、Cycles、单向浮力与双向流固耦合准确区分。现有远景云未完成通用实体射线距离裁切，不能宣称能自然穿云。历史报告仅覆盖其实际镜头；本轮没有重渲染旧片，也没有新增试听或连续观看记录。
