# 旧工程的水体、反射与实体交互：可复用经验

核对日期：2026-10-24。范围只含本地 `navier_stokes_water`、`shanghai_tower`、`spacex_falcon9_recovery` 三个工程。先以交付说明和 QA 找到可追溯实现，再读对应源码；不凭版本号认定画面更好。本次是源码、参数、已保存报告的复核，**没有新跑 GPU 渲染、没有本轮重新观看整片或听审**。下文“像素检查”均指列出的既有检查记录。

全部项目路径均以 `D:/projects/manim_extend_rainbow/video_project/` 为根。没有复制 WaterPro 商业源码，没有修改既有影片，也不将材质渲染、教学动画和计算证据混为一谈。

## 值得收入技能的成熟方案

| 方案 | 已有实现与证据 | 可复用部分 | 仍须明确的边界 |
|---|---|---|---|
| 原生 WaterPro 工程接入 | Falcon V03 `source/v03/src/NativeOcean.ts::createNativeOcean/update`；`research/v03/runtime-graphics-qa/report.json` | 明确米制、真实 backend 检查、帧时间→固定 tick、受控随机子系统、原生水下后处理 | 商业依赖就地使用；不能把 SSR 称为路径追踪；原生 persistent wake/spray 不保证任意 seek |
| 稳定太阳与阴影 | Falcon V03 `LightingConfig.ts::stabilizeSun` 与 `NativeOcean.ts` 的 `addSunSyncListener` | 同一世界太阳方向供物体、HDR、水反与阴影；在原生各 pass 前同步；稳定阴影视锥 | 固定视锥只适合包络已知的镜头，不可无限扩张；需实际检查阴影分辨率 |
| 城市江面反射诊断与合成 | 上海 `source/v28/PlanarRiverReflectionV25.ts::installPlanarRiverReflectionV25`；V26修复记录与V27编码检查 | 单个界面 Fresnel、几何预乘色与覆盖率一起过滤、同一天空回退、五模式诊断、异常状态恢复 | 平面反射及波面方向偏移是近似；不是逐波面路径追踪或标定的黄浦江波谱 |
| 航拍法线抗闪烁 | 上海 `source/v28/RiverNormalFilterV27.ts::enableRiverNormalFilteringV27`；`work/v27/water/REPAIR_NOTES.md` | 在 Fresnel/反射方向之前滤除不可解析斜率；compute 后刷新 normal mip；实际 GPU 能力检查 | 仅针对该工程 Three 0.183 + WaterPro 3.1.1 的已核对路径；平均法线不等于完整斜率方差模型 |
| 连续海面与可读微波 | NS V10 `source/v10/shaders.ts::surfaceVertex/spectrumNormal/windSlope/reflectedSky` | 共享世界坐标与时间；近远海连续网格；几何频率和屏幕频率分别过滤；角域环境预滤波 | 48分量线性有限水深统计海况；非破碎浪；额外微法线不参与动力学 |
| 实体浮标与水线 | NS `scripts/v02/generate_ocean_physics.py::Sea/forces/integrate`；V10 `OceanWorld.ts::sample/setBuoy/update` | 同波谱高度/法线；体积积分浮力、相对流速阻尼、姿态轨迹；真实水线交点与湿漆材质 | 单向水→浮标近似；没有反作用回写；没有商业浮标 RAO 标定或自由液面 CFD |
| 材质升级不改变实验 | NS V10 `docs/v10/画面与生成来源.md`、`public/v02/physics/physics-manifest.json` | 保留计算数据/种子/镜头；只改变高光与频率过滤；读原计算力向量和相同模拟时刻 | 不能分别调速、调振幅来制造对照；海况参数变化应重算并保存响应 |

## 1. WaterPro：先把接入做好，再谈“真实”

### 原生路径与时钟

Falcon V03 的 `NativeOcean.ts` 明确使用授权的 WaterPro 3.1.1、TSL / GPU FFT、`three/webgpu`，并检查实际 `water.backend`。请求 WebGPU 但实际退到 WebGL 时直接报错，不将兼容路径冒称原生 GPU 路线。

`update(time)` 把绝对秒数映射到 `tick = round(time / (1/60))`。在该版本中 `syncToTick` 本身不刷新 FFT 与表面 uniforms，所以接入层做两次同目标 tick 的固定步：第一次计算目标波面，第二次消化原生一帧延迟的相机高度采样。**这是版本相关的接口事实，不是通用 WaterPro API 规则**；升级依赖后必须重新核对，不能盲拷“两次 update”。

该工程关掉了 persistent wake、粒子、雨波、喷雾等历史状态，保留 FFT/Gerstner、水深岸边泡沫、折射、SSR、水下 fog 与 caustics。这是降低历史依赖的接入策略；完整任意 seek 仍需单独验证。注释也明确 `syncToTick` 不会重置所有状态子系统。

同文件记录一个已定位的版本问题：WaterPro 3.1.1 中大日期式种子经过 float32 哈希会丢索引低位，出现同心谱伪影；此接入使用小种子7。技能应记录“固定种子并验证具体实现”，不将种子7包装为普适正确值。

### 尺度、材质和光源

`createNativeOcean` 把公里演示预设缩到船体与火箭的米制场景；波长、clipmap、海底深度、雾距离同时按实际尺度选择。吸收系数以线性数值构造，避免把每米吸收系数当作 sRGB 十六进制颜色再转换，导致乳白或过透。

`LightingConfig.ts::stabilizeSun` 固定太阳方向与阴影空间包络。WaterPro每次固定步会改动灯光，因此同步回调发生在原生深度/SSR/阴影捕获之前；只在最终 `renderer.render()` 前补灯光会让不同 pass 用不同光源矩阵。

可迁移的是顺序与单位，不能直接迁移该工程的水色、阴影视锥和 `normalBias` 到室内水杯、上海航拍或其他尺度。

### 实际证据等级

- **源码**：`spacex_falcon9_recovery/source/v03/src/NativeOcean.ts`、`LightingConfig.ts`、`World.ts`。
- **实际 GPU 状态**：`research/v03/runtime-graphics-qa/report.json`：frame0和frame6780是真实WebGPU，tick正确，太阳矩阵一致，回调已执行，无UV/buffer警告。
- **重复帧像素**：`research/v03/runtime-graphics-qa/decoded-review.md`：frame6780两次新场景捕获，2,073,600像素中148个RGB像素有至多1/255差异，alpha相同。不是bit-exact，也未测持久renderer的任意倒序seek，不能宣称所有帧严格一致。
- **连续片段**：`research/v03/deck-temporal-qa/review.md`：120帧甲板片段、配准统计与异常点人工复核；未见所查区域旧版明显影子突变，不能外推为全片无闪烁。
- **来源/限制**：`research/v03/environment-provenance.json`：原生正文是FFT/Gerstner/SSR；单独片尾复用Cycles/OPTIX。远景云未实现通用实体射线距离截断，不能把“能渲染远云”扩写为“已能穿云遮挡”。

## 2. 城市河流：把阴影和反射问题拆开看

上海 V25 曾把已经含 Fresnel、天空/SSR与透射的水色再次混上镜像色，形成双界面和可见条带。V26最早“一次Fresnel”探针虽然去掉了白条，仍有大片灰河和硬楼形暗块，报告明确判为**未通过**。所以不能只读修复标题就把第一探针收入推荐。

最终可追溯链：

1. `work/v26/water/README.md` 记录五模式同机位诊断与三轮修复。
2. `source/v28/PlanarRiverReflectionV25.ts` 保留最终 authored 集成；文件名V25不代表内容仍是V25。V29同名继续沿用。
3. `work/v27/water/final-water-visual-review.md` 记录最终编码的174个独立帧检查，其中包括两段完整邻帧联系表与11张全尺寸帧。

五模式：`mask`看水域几何/裁切，`native`看原生天空与透射，`scatter`临时抑制界面反射，`planar`看输入镜像辐亮度，`final`看正常合成。必须在同一相机、同一时间、同一已编译管线比较，并在生产前复位为 `final`。原生水材质并不采样城市shadow map时，宽黑带不能靠随便降低城市阴影解决。

一次具体根因是**有限天空穹顶被虚拟镜像相机的裁切平面切掉**。`work/v26/water/finite-sky-clip-proof.json`用实际F400相机和2000m穹顶记录了射线相交；旧的暗带样本碰到裁切面下方的天空，邻近亮带却幸存。它不是“反射都太黑”，也不是简单水平UV反转。

### 最小辐射合成契约

镜像捕获时隐藏有限天空穹顶，仅捕获真实城市几何到透明黑背景。对**线性预乘RGB和coverage alpha采用完全相同的核与权重**：

```text
C = Σ wi · (alpha_i · geometryRadiance_i)
A = Σ wi · alpha_i
Σ wi = 1; wi >= 0
L_mirror = C + (1 - A) · L_sky(reflectionDirection)
L_incoming = mix(L_sky, L_mirror, smoothBorderValidity)
L_water = (1 - F) · L_body + F · L_incoming
```

最后一行只表示单界面能量混合契约，实际透射/吸收仍由当前材质处理。不要在 `L_water` 之后再加第二个镜面层。`F0=((1.333-1)/(1.333+1))²≈0.02037` 是项目空气/水界面参数；不能把同值硬套到玻璃/金属。

`installPlanarRiverReflectionV25`中的 `sampleRadiance` 使用13tap归一化核、mip和随屏幕导数扩张的各向异性角域范围。实际FFT反射方向参与UV偏移；图像边界回退到同一套天空采样。禁止颜色key掉黑色、二值深度mask切天空、强行用黑色夹边、色与alpha使用不同模糊半径。捕获临时状态在 `finally` 恢复，包括背景、天空可见性、clear、renderTarget、MRT、autoClear。

这仍然是**带法线方向扰动和粗糙度积分的平面光栅反射**，不追踪每个变形波面的真实路径。V29片尾另用Qwen/Wan生成式夜景，来源是 `output/v29/本次修改与来源.md`；它不是该水体数学方法或光追正确性的验收证据。

## 3. 抗闪烁：在不可解析频率进入高光之前过滤

### 上海航拍：mip应作用于法线，不只是最终倒影

V27根因是256×256法线分别覆盖72m与9m，而航拍一个像素常覆盖数米江面。基级双线性采样将不可解析的细斜率送进Fresnel与反射方向，产生“胡椒点”；最终倒影再模糊不能消除早已变化的Fresnel权重。

`RiverNormalFilterV27.ts::enableRiverNormalFilteringV27`在原纹理公开访问接口上启用完整9级mip、compute写入后自动更新、三线性缩小与8倍各向异性。运行时核验真实GPU mip层数与 `float32-filterable`。保留同一JS纹理对象，重新分配GPU存储；没有修改WaterPro源码。

参考：`work/v27/water/normal-filter-static-review.md`、`REPAIR_NOTES.md`。该修复针对实际Three 0.183，不能用另一个根目录依赖版本的实现来推断。它平均packed normals后再归一化，**未保存不可解析斜率方差**，所以不等于完整LEAN/Toksvig微表面模型。

### NS：几何波、物理波与显示法线各司其职

V10 `shaders.ts`：

- `surfaceVertex`：近海与扩展方环网格共享坐标/边界；只对小于几何单元的波做平滑截止，避免远海变成静止大平板。
- `spectrumNormal(p,footprint)`：用保存48波分量的解析梯度，按屏幕足迹衰减不可解析频率。近景不再依赖0.58m网格插值法线，以免呈肋状塑料。
- `windSlope(p,footprint)`：世界空间漂移的可微噪声斜率，五次插值使网格边界导数连续；它只影响材质，不参与位移、浮力或压力。
- `reflectedSky`：固定角域采样与离线预滤波HDR，避免少量十字形tap把云映成分离的大镜像。无逐帧随机种子。

`docs/v10/画面与生成来源.md`记录这里为WebGL光栅、环境照明和局部平面反射；没有路径追踪。`public/v10/materials/ocean-reflection-soft.json`保留派生HDR的源哈希与滤波参数。

## 4. 水与浮标：同一个波面、同一时刻、可检查的浸入

### 共用数据契约

`public/v02/physics/ocean-spectrum.json`保存振幅、波数、频率、相位和单位。CPU `Sea.eta`、渲染 `OceanWorld.ts::sample(x,z,t,depth=0)`与GPU `shaders.ts::wave`使用相同的相位约定：

```text
q_i = kx_i*x + kz_i*z - omega_i*t + phase_i
eta = Σ a_i*cos(q_i)
gx = Σ -a_i*kx_i*sin(q_i)
gz = Σ -a_i*kz_i*sin(q_i)
n = normalize(-gx,1,-gz)
```

渲染过滤不能反过来改变浮标的物理采样。换相机或分辨率时，浮标的受力不该变化。还须区别固定空间频率 `omega` 与内禀频率 `intrinsicOmega`：脚本包含背景流Doppler映射，不能在速度、位移、压力中随意混用。

### 轨迹与几何必须一致

`generate_ocean_physics.py::forces`使用实际浮体的36条等面积体积柱计算浸入、浮力、恢复力矩，附加龙骨与连接杆排水体积。阻尼基于**浮体局部速度相对水速**，而非世界空间速度；水平运动含近似流体加速度、相对拖曳与弱系泊。`integrate`以1/240s半隐式Euler和四元数积分，60s预热后保存60fps轨迹。

V10 `setBuoy(t)`读取保存位置并做四元数slerp，不用“中心海面高度减常数”替代已经积分好的运动。文件仍有标记为temporary的fallback，但加载流程要求实际保存轨迹；抽取时应让缺数据显式失败，不默认启用fallback。波高1.35倍实验使用独立重算的 `public/v07/physics/buoy-higher-waves.json`；两场景插值段明确为演示过渡，不是中间海况的再积分。

水线：V10 `update`沿浮体周向64段，在已旋转的真实浮体坐标上对海面求11次二分交点。湿漆粗糙度也以同 `wave` 水位计算；水下物体不应参与镜像中“水上浮标”的轮廓，反射pass据实际波面裁掉水下部分。剖面期间保留浮标周围可见水域，避免剪掉支撑水面后看起来悬空。

### 已保存的数值证据与像素证据

`public/v02/physics/physics-validation.json`记录400s、24001个轨迹点：色散残差8.88e-16、静水平衡质心误差0、步长减半位置RMSE约2.4e-5至4.0e-5m、平均浮力/重量1.000109、四元数范数最大误差2.22e-16；龙骨始终浸没。它支持该近似模型的内部一致性，不证明真实海况预测、真实浮标标定或商业海上性能。

`work/v10/qa/water-final-review/late-final-review.md`查看了17张编码晚段静帧及1797帧数值统计。F9450与F9750的浸入与画面相符；未见所查帧浮标离水空隙、额外镜像金属筒、突跳。报告明确没有正常速度播放或主观听音。

## 5. 不可作为推荐预设的历史结果

| 曾出的问题 | 证据 | 应保留的教训 |
|---|---|---|
| NS V4重复材质条带，用户要求退回旧水感 | `docs/v05/water-world-review-r2.json`与README的V5说明 | “更新版”不等于“更真实”；保留同机位质感基线 |
| NS V9大范围平行刷纹；V10中间测试巨大蜂窝镜像亮圈 | `work/v10/qa/water-final-review/water-final-review.md` | 先处理波面梯度和环境角域分辨率，不能不断叠sine与镜面亮斑 |
| 上海V25白条/色块、V26第一探针硬暗块 | `work/v26/water/README.md` | 只消除单一缺陷仍不能算验收；诊断分开反射、透射、几何与天空 |
| 上海V26 residual stipple被过宽松接受 | `work/v27/water/normal-filter-static-review.md` | 原静态通过不能覆盖镜头移动时的采样噪点；用户指出后应提升动态门槛 |
| NS浮标强倒影看成额外金属筒、装置段浮标残留 | V10 `late-final-review.md`与V5 `water-world-review-r2.json` | 反射也需要实体裁切和显示状态；关闭主体不能只关主pass |

## 6. 建议抽取的原创无依赖 helper 与检查

只抽取下列通用数学与契约，不拷商业water shader：

1. `sampleSpectralSurface(components,x,z,t)`：返回高度、梯度、单位法线和固定 `(x,z)` 处水位的时间导数 `dη/dt`；这个导数不是波的相速度，也不是流体质点的完整速度。做CPU单波解析值、有限差分梯度、相位周期、逆序时间和无输入变异测试。输出不含camera footprint，不以该导数冒充浮体所需的三维相对流速。
2. `filterSlopeForPixel(components,x,z,t,footprint)`：只供显示法线使用。足迹为0时回到解析法线；足迹增加时不可解析模式连续衰减；参数必须注明世界单位/像素，不能任意以距离替代。
3. `composePremultipliedReflection(samples,weights,sky,borderValidity)`：检查权重非负且和为1、coverage在[0,1]；全透明回天空、全覆盖回几何、常色经核不变；一次Fresnel作为独立下一步。禁止对HDR RGB强行钳制到[0,1]。
4. `dielectricSchlick(cosTheta,iorFrom,iorTo)`：掠射趋近1、法向为F0；参数验证。标记为Schlick近似，不冒称精确Fresnel或粗糙微表面求解。
5. `findWaterlineLocal(surfaceSample,pose,localRay,range)`：以真实姿态进行有括区间求根；无交点返回明确状态，而不是把泡沫贴到浮体顶部/底部。先测平水、倾斜圆柱、完全干/全浸没，再上GPU。
6. `compareRepeatFrames`与ROI诊断：记录同一时刻原始像素误差；运动场景先配准、排除字幕和遮挡变化。亮度差值用于定位问题，不作为“真实感得分”。

不要把这几个helper包装成完整流体模拟器。需要倾倒、破碎、碰撞或双向耦合时应进入对应可验证的流体求解流程；需要全场光追时应进入实际Cycles或相应路径追踪器，并保留渲染与采样记录。

## 新项目采用时的最小验收

1. 写清actual backend、版本、单位、波形数据与hash、太阳方向、相机范围、是否双向耦合、何种反射。
2. 选近景、远景、掠射、水上/水下、实体接触、岸线或剖面、夜景等实际需要的镜头；不要只检查一张漂亮帧。
3. 分开验证数值契约、GPU运行状态、原始重复帧、编码连续片段和正常速度主观观看；每种通过只覆盖自己的范围。
4. 同机位反射分解诊断后再调参数；不要把虚拟天空裁切误判成建筑阴影，也不要靠全画面模糊掩盖法线aliasing。
5. 版本与质量分离：保存明确的基线和拒绝记录，不默认继承“最新版本通过”；保留最终输入hash与实际交付hash。

本轮建议状态：以上方法可入技能作为带证据的可选路线；具体数值、商业接口适配和已有影片画面仍是各工程实例，不能宣称已在新项目通用验收。
