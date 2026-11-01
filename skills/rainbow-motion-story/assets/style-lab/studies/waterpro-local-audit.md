# WaterPro 本机能力与历史落地审计

审计日期：2026-10-24。用途：将已经有工程证据的水体方法纳入个人技能的路由与复用说明。本文是**本次文件审查**，不是本次重新完成 GPU 渲染、全片视觉验收或商业许可资格认证。没有修改旧影片，也没有复制商业库源码到技能。

来源路径、SHA256、证据层级和复用范围见 `evidence/waterpro/source-manifest.json`。文件存在、旧报告存在、当前代码实现、历史运行结果分别记录，不能互相替代。

## 1. 实际安装与推荐入口

共享商业库：

`D:/projects/manim_extend_rainbow/video_project/zju_marine_ep01/work/waterpro-v4/vendor-valid/threejs-water-pro`

本机 `package.json` 是 **threejs-water-pro 3.1.1**，入口 `build/index.js` / `build/index.d.ts`，包声明的 Three peer dependency 为 `>=0.181.0`。这仅是已安装版本，不是“网上最新版本”。历史成熟适配器采用 Three **0.183.0**，TSL/Node 材质及纹理更新行为须按这个版本核对。

- `spacex_falcon9_recovery/source/v02/vendor/waterpro` 与 `source/v03/vendor/waterpro` 是指向上述库的 Junction。只复用连接，不能复制整个 vendor。
- `shanghai_tower/source/v28/vendor/waterpro` 本次检查是实目录，不是 Junction；其包版本同为 3.1.1。不要据此另复制一份进技能。
- `beso_ai_research_2026/work/vendor/v16-waterpro-native/threejs-water-pro` 也有 3.1.1 副本；本轮只作定位辅助，不作为额外分发资源。

本地 `LICENSE.md` 是商业软件许可。共享技能只保存方法、项目作者的薄适配器接口说明、来源路径和验收要求；不把 vendor、商业派生着色器或参考素材打包。涉及对外平台分发时重新核对授权范围。本文不判定用户实际购买资格。

### 推荐调用链

| 需要 | 已有工程入口 | 可复用性质 |
|---|---|---|
| 原生海面、海平面穿越、水位查询 | `spacex_falcon9_recovery/source/v03/src/NativeOcean.ts` | 项目作者适配器；调用已许可的原生 WaterSystem，依赖 `LightingConfig.ts` |
| 更早原生海面案例 | `zju_marine_ep01/src/NativeWaterV7.ts` | 原生 WebGPU 路线；不是旧 V4/V6 WebGL 适配 |
| 城市河面、真实岸线、开挖剖面 | `shanghai_tower/source/v28/NativeRiverV21.ts` | 原生波面 + OSM 遮罩 + 显式剖面覆盖；需要该工程的天空/环境依赖 |
| 楼群完整倒影、屏外回退 | `shanghai_tower/source/v28/PlanarRiverReflectionV25.ts` | 项目作者的 Three 反射适配层；不是完整场景光追 |
| 航拍移动时水面闪点 | `shanghai_tower/source/v28/RiverNormalFilterV27.ts` | 法线源头 mip 过滤；依赖实际 Three/GPU 能力 |
| NS 早期教学水体/水团可视化 | `navier_stokes_water/source/WaterWorld.ts` 及 `docs/water-rendering.md` | 早期独立解析波与坡度跟随方案；**不是 WaterPro，不代表后期 V10 的浮标实现** |
| NS 后期水面与实体浮标 | `navier_stokes_water/source/v10/OceanWorld.ts`、`scripts/v02/generate_ocean_physics.py` | 读取保存波谱及体积浮力/阻尼/四元数积分轨迹；单向水→浮标近似，非 WaterPro |

这些是案例入口，而不是可脱离工程直接复制的一套库。先读取导入链、坐标约定、资源 URL、Three 版本、授权范围，再抽取项目需要的最小适配层。

## 2. 能力名称必须分开

| 名称 | 本次找到的证据 | 可以说 | 不应说 |
|---|---|---|---|
| WaterPro 原生 FFT/Gerstner | `NativeOcean.ts` / `NativeRiverV21.ts` 导入并调用 `WaterSystem.create`；SpaceX 历史 report 实际 backend 为 WebGPU | 使用原生 GPU 波面，固定 seed/tick，读取实际采样高度 | 完整三维 NS / 流固耦合 / 实测海况 |
| SSR | SpaceX `water.ssr.enabled=true`，64 steps、550 m 是该镜头参数 | 屏幕空间反射，与天空环境共同工作 | 所有屏外物体都能反射、全片路径追踪 |
| 镜像平面反射 | 上海 `PlanarRiverReflectionV25.ts`；NS Reflector | 镜像相机采集真实场景几何并回退天空 | 对每条波面进行多次物理光线反弹 |
| 原生 wake/spray/rain | 供应商本地 API 文档有相关子系统；随机访问适配器主动关闭 | 供应商具备这些接口，需另行连续仿真验收 | 已在现有任意倒序渲染中通过确定性验证 |
| 旧 WaterProCompat/WebGL 适配 | `zju_marine_ep01/src/WaterProMarine.ts` 和 `WaterSurfaceState.ts` | 商业派生的有限 24 模态方向谱适配 | 商业原生 GPU FFT 或可公开分发的自创基础库 |
| NS 早期教学海面 | `source/WaterWorld.ts` 及 `docs/water-rendering.md`；同一水位/坡度驱动浮标 | 早期米制解析重力波、同场景示意、平面反射 | 仅凭此早期入口便声称浮力积分，或反过来声称整个后期工程没有积分 |
| NS V10 积分浮标 | `source/v10/OceanWorld.ts::setBuoy` 读取保存轨迹；`scripts/v02/generate_ocean_physics.py::forces/integrate`；历史 `physics-validation.json` | 已有36条体积柱浮力、相对水速阻尼、恢复力矩与四元数积分，渲染插值保存位姿 | 完整自由表面 CFD、双向耦合、商业浮标实测标定 |
| Cycles | SpaceX 六秒镜头与上海收尾有独立渲染/交付记录 | 对明确的离线镜头使用路径追踪 | 原生 WaterPro 段也进行了全场景路径追踪 |
| 单纯浮体跟随 | NativeOcean 的 `surfaceHeightAt` 只是水位查询；NS **早期** `source/WaterWorld.ts` 从水位/坡度设置姿态 | 几何水线、坡度跟随、采样一致 | 高度查询自身就是动力学积分；此项不覆盖后期 NS V10 已积分轨迹 |

## 3. 值得提升为技能的成熟处理

### A. 随机访问时间和实际水位

SpaceX `createNativeOcean` 使用固定 `stepSize=1/60`、小固定 seed，显式检查真实 `water.backend`，需要 WebGPU 却选到 WebGL 就报错。生产帧从绝对秒数映射到 tick。

旧适配器的经验是：只 `syncToTick` 不足以保证已执行本帧 FFT 和更新 uniform。其针对 3.1.1 的策略是把时钟设到 `tick-1` 后执行一次固定步；为消化相机水位读回延迟，再重复同一个目标 tick 一次。**它不是推进两帧，也不是可无验证套用到任何版本的规定。**

输出使用 WaterPro 后处理链；未调用后处理的直接 `renderer.render()` 可能绕开水下效果。浮标/船体/水线和字幕锚点应采样同一已更新水面，禁止另写不同相位的 CPU 海浪伪装为 GPU 实际高度。

本地 API 文档对 GPU 高度跨设备不保证 bit-exact，也说明泡沫具有历史缓冲。任意跳帧导出优先关闭 wake/spray/rain 等历史状态，或实现并验证顺序预热/状态缓存，不以 seed 相同代替完整确定性证据。

### B. 灯光在所有 pass 之前一致

SpaceX V02 曾在 `water.update` 之后移动日光/target，导致 SSR、depth、shadow 与最终 capture 使用不同矩阵。V03 采用 `lighting.addSunSyncListener`，在原生同步后、原生采集之前恢复固定世界空间日光；不在最终渲染前再次突改。

可复用检查：太阳单位方向、HDR 太阳位置、体积云散射方向、水面高光、反射捕获、阴影视锥共用状态；高动态主体移动不能让阴影采样网格跟着随意漂移。`LightingConfig.ts` 中的数值只适合其米制构图，不是一套通用参数。

### C. 水面抗闪烁必须先过滤法线

上海 V27 的根因记录：两张 256² 法线纹理覆盖 72 m / 9 m，航拍一像素跨多米时，只采基级双线性纹理会把无法解析的斜率送入 Fresnel 和倒影方向。事后模糊倒影不能修复已经闪动的反射权重。

对应修复保持波谱/颜色/相机不变，通过公开 `getNormalTexture()` 配置完整九级 mip、三线性缩小、8×各向异性与计算写入后自动更新。运行时需检查 `float32-filterable` 和实际 mip 数。`RiverNormalFilterV27.ts` 的诊断读取了 Three backend 纹理状态，因此这是**绑定 Three 0.183 的适配方案**，升级时必须复核；不能把整个函数称为完全版本无关公共 API。

平均法线过滤不保留未解析斜率方差，不是完整 LEAN/Toksvig 模型。远处仍需合理反射粗糙度。禁止用整幅模糊、删反射、全局压平波浪来掩盖采样原因。

### D. 城市河面的反射只有一个 Fresnel 界面

上海 V28 当前适配捕获镜像几何的预乘线性 HDR RGBA，再与同一 PMREM 天空按 coverage 合成。倒影采样方向来自原生 FFT/Gerstner 法线，而非另加无关随机波纹；颜色和 alpha 用同一粗糙核，屏边渐退到相同天空。

此版本原生 SSR 已关闭；不要把较早 V25 的“SSR 补充接触”描述套到 V28。平面反射只是入射辐亮度，再进入一次原生 Fresnel；叠加第二层 Fresnel 会造成不自然块状明暗。天空跟随主相机时，镜像捕获不直接使用有限天空壳，避免斜截面制造黑白条带。

`PlanarRiverReflectionV25.ts` 通过 `updateBefore` 包装恢复渲染状态并替换天空采样函数，因此还应归为**有版本耦合的项目适配器**，不是任意 renderer 都能无条件安装的公共插件。保持 `try/finally` 恢复清屏、target、MRT、可见性等状态。

### E. 岸线和剖面是一套世界坐标覆盖

上海河面使用世界坐标 OSM mask，10 km 范围的 4096² 纹理具有 mip/各向异性过滤。基础开挖时，水面是独立场景组件，必须接收同一 `openingRadius_m`，同时裁掉 color/depth；不能让城市几何被切开而水面蓝片仍贯穿土层。

半径为零时覆盖必须精确等于一；开挖开始、结束检查同帧匹配，避免在接缝帧产生一跳。岸线与浮体接触区的尺度必须以米明确，不把海上大波 preset 原样用在城市河道。

### F. 真实感和实际求解不要混写

NS 必须按入口和版本区分。**早期** `source/WaterWorld.ts` 的浮标是水位/坡度姿态跟随，这个入口本身没有刚体浮力积分。**后期 V10** 的 `source/v10/OceanWorld.ts::setBuoy` 已读取保存的位置与四元数轨迹并插值；轨迹来自 `scripts/v02/generate_ocean_physics.py::forces/integrate`，按36条等面积体积柱计算浮力、相对水速阻尼与恢复力矩，并使用1/240秒步长、半隐式Euler与四元数积分，预热60秒后保存60fps位姿。不能用早期入口否定后期工程已有的积分能力。

V10 源码仍留有标记 temporary 的坡度跟随 fallback；实际复用应验证轨迹加载，缺数据时明确失败，不能静默退回后仍称“使用了物理积分”。其计算是单向水→浮标近似：浮标反作用未回写波面，阻尼等为声明的模型参数，没有完成商业浮标RAO标定或三维自由液面CFD。新项目可复用保存积分轨迹的流程，重新确认质量/惯性、几何排水体积、波谱、阻尼、吃水线、碰撞需要与随机seek，而不应重新退回简单高度绑定。更详细的跨版本核对见 `studies/production-water-lessons.md` 第4节。

“世界模型”“扩散反演”应链接实际计算结果与输出字段。不能仅因为水面漂亮或有 FFT 就声称完成数据驱动反演、三维 NS 求解、天气预测或流固耦合。

## 4. 历史验收证据与本轮边界

### SpaceX V03

`research/v03/runtime-graphics-qa/report.json` 记录历史三次实际 WebGPU still capture，frame0 与重复 frame6780：tick、日光矩阵及回调次数通过，重复 PNG 并不 bit-exact。`decoded-review.md` 记录 2,073,600 像素中 148 像素存在 1/255 的变化；不能把底层浮点原因视为已经唯一隔离。

覆盖仅同一浏览器进程的 fresh-scene 几个帧，不是全片、跨 GPU、同一持久 renderer 倒序 seek 的证明。**本轮只读取报告，没有重新执行 GPU。**

### 上海 V27

`work/v27/water/REPAIR_NOTES.md` 记录两张实际 GPU 纹理九级 mip 与设备能力；包括 442 帧原生连续样片检查安排。`final-water-visual-review.json/.md` 记录最终编码中的 174 个独特解码帧静帧/联系表检查，其中 81 帧是真正 native→Cycles 合成区间。

历史报告未发现所检查水域的新阻断问题，但明确不声明全片逐帧人工播放或零闪烁；材质从原生过渡到 Cycles 的变化仍可觉察。**本轮没有重新观看这 174 帧，也不将历史结论升格为当前新项目验收。**

### NS 文档与实现

本轮先核对早期 `source/WaterWorld.ts`，后补查 V10 `OceanWorld.ts::setBuoy`、V02轨迹生成脚本和保存的 `physics-validation.json`，并与 `production-water-lessons.md` 对齐。历史验证文件记录400秒、24001个轨迹点，静水平衡质心误差0、平均浮力/重量1.000109、步长减半位置RMSE约2.4e-5至4.0e-5米；这些是已保存近似模型的内部一致性证据，不是本轮重新计算或实海标定。没有新执行GPU、积分脚本或整片视觉审查；独立二维NS求解部分也不在本次WaterPro审计范围内。

## 5. 后续调用时的最小交付清单

1. 记录真实 renderer/backend、Three/WaterPro 版本、单位、seed、fps/tick 和许可来源路径。
2. 保存当前水面问题的同机位 before；至少覆盖近水面、逆光、远航拍、岸线/浮体、实体遮挡及目标接缝。
3. 一次只处理一个根因：波谱尺度 → 法线采样 → 单一 Fresnel/反射 → 灯光 pass → 岸线/水线 → 体积合成。
4. 保存运行时诊断、代表静帧、目标 fps 相邻帧、重复/倒序 seek 结果；数值自检不代替真实图像。
5. 把实际覆盖范围和残余限制写入 QA。只交付项目自己的适配器/说明/输出；不复制 vendor、商用派生库或大量旧片缓存。

本笔记不依赖联网资料：供应商能力描述来源于本机 3.1.1 文档，成熟经验来源于所列历史工程及验收记录。未来升级时应另行核对官方当前文档。
