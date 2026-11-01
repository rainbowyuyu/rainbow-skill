# Blender：把零件、装配与镜头放进同一个场景

先做一个轮廓可读、运动关系明确的真实模型，再用材质和灯光说明它的形状。沿用[机构指南](anatomy-mechanics.md)的一份状态驱动所有部件，以及[运镜与景深指南](camera-depth.md)的世界锚点、轴深和按帧求值；在 Blender 中交付可打开的 `.blend`、生成脚本、实际渲染帧与检查记录。

本页为原创工作流与官方文档整理。用户提供的[柳疯衫·awa《Blend建模动画分享一流水》](https://www.douyin.com/video/7699790483135972799)是研究入口；下文将实际画面观察与本项目选择的实现方法分开。软件实查为 **Blender 5.1.2，build `ec6e62d40fa9`**；资料于 2026-10-23 获取。

打开[流水研究室](../lab/blender-flow.html)查看案例。本地制作入口是 [build_waterfall.py](../examples/blender-flow/build_waterfall.py)，提供 build、bake、render 阶段；命令与缓存交付见 [API](../examples/blender-flow/API.md)，运行记录（外部或本机资源，未随公开包收录）保留场景、缓存与渲染参数。当前案例以流体变化为动画，提供整体、近景和侧面三个固定机位；后文的装配关键帧、连续运镜是通用扩展方法，不代表这个小样已实现全部功能。首轮下盆外侧水膜问题及后续修订范围见 API 和验收记录；不将缓存生成和渲染成功写成视觉验收全部通过。

## 本次参考：上槽、水帘与下盆

参考片为 8.336 秒、1280×720、24 fps。研究抽取了覆盖全片的 50 张、约 6 fps 样帧并检查接触表：水从后上方进入浅青色长斜槽，约 1.5 秒从前端流出，约 2.5 秒在下方方盆积水；约 4.17 秒切到正面，亮天空和暖黄色环境让水帘边界更明显。约 6.17–7.67 秒侧面近景中，槽壁大面积遮住水；若目的是解释流路，应重新选机位。约 7.83 秒回到全貌。可追溯素材身份见源记录（外部或本机资源，未随公开包收录），采样见帧清单（外部或本机资源，未随公开包收录）。时间为抽帧观察的近似点，不是作者的工程时间线。

可以借鉴的是“供水—导流—自由下落—承接”的空间因果，以及用背景明暗帮助读出透明水面。标题提及 Blender，但公开片段没有 `.blend`、求解器、缓存、材质或渲染器设置；不能据画面反推作者用了 Mantaflow、FLIP 插件或 Cycles。**本项目采用 Mantaflow 是自己的实现选择。**

## 将水槽画面做成可检查的 Mantaflow 场景

先做一个有底板、侧壁和开放出口的上槽，以及有真实厚度的下盆。低细节碰撞代理与可见模型可以分开，但底板、出口和接水面必须重合，不能让水穿过可见表面。新建 Domain、Flow 和 Effector，确认三者的角色和所在集合；不要把能渲染的水样网格误当成已经运行流体求解。

| 部件 | Mantaflow 设置 | 首轮验证 |
|---|---|---|
| 计算域 | Liquid Domain 包住入口、斜槽、完整落差和接水盆 | 域边界之外液体会碰撞或消失；域不要因背景场景变得过大 |
| 供水 | Liquid Flow；持续供水用 Inflow，初始水量用 Geometry | 发射体有可被网格分辨的体积；法线向外；Use Flow 与初速度按需要明确设置 |
| 槽与盆 | Effector，Collision | 有厚度、法线正确；检查接缝与槽底，不以增加 Surface Thickness 掩盖错误模型 |
| 液面 | Domain 启用 Mesh，烘焙液面 | 网格缓存存在且逐帧变化；渲染的不是计算域方盒 |

[Domain 分辨率](https://docs.blender.org/manual/en/5.1/physics/fluid/type/domain/settings.html)按包围盒最长轴划分：近似单元宽度 `h = 最长边 / Resolution Divisions`。例如最长边 2 m、分辨率 64 时，`h≈31 mm`，10 mm 的槽壁或极薄水帘无法可靠表示。首轮用粗网格验证流路，核对壁厚、入口尺寸、出口和水层相对 `h` 的大小，再缩小域或提高分辨率。让关键厚度跨多个单元是实用起点，仍需实测漏水；不能宣称某个固定分辨率对所有尺度都够用。

保存实际尺寸、场景重力、fps、Time Scale、CFL 和步数上下限。保持米制和常规重力时，别通过改变 Time Scale 把错误落差“调像”参考。快速流动碰撞可能需要更多自适应时间步；移动发射体/碰撞体的 Sampling Substeps 负责采样间隙，不能代替空间分辨率。[Flow](https://docs.blender.org/manual/en/5.1/physics/fluid/type/flow.html)的 Inflow、Geometry 和 Outflow 具有不同物理含义；若为控制画面使用排水体，应记录其位置和作用。

正式试做使用 [Modular Cache](https://docs.blender.org/manual/en/5.1/physics/fluid/type/domain/cache.html)：先指定当前项目内唯一缓存目录和正数帧范围，保存场景，**Bake Data 完成后再 Bake Mesh**。`Replay` 可用于临时预览，不作为交付证据。修改碰撞几何、流量、分辨率、重力或模拟时间后要重新烘焙受影响缓存，建议新建版本目录保留可回退结果；单纯改相机或灯光一般不需要重算流体。

[Mesh Upres 与平滑](https://docs.blender.org/manual/en/5.1/physics/fluid/type/domain/liquid/mesh.html)改变粒子重建的表面，不能凭空补回粗模拟没有求出的流路。Mesh 已打开但没有网格缓存时，Blender 可能显示原 Domain；因此“看到一个对象”不能判定水体成功。记录 data/mesh 缓存帧数、大小及路径，并实际检查入口、首次出流、下落中段、首次撞盆与后期积水。`.blend` 通常仍引用外部流体缓存，交付时缓存目录一并保留；重开场景，随机跳到已烘焙帧并重渲染，才说明可重放。

缓存路径应相对 `.blend` 保存，或提供明确的重定位步骤；把 `.blend` 和缓存复制出去，却保留原机器的绝对路径，并没有验证移植成功。另做一次新位置打开、原缓存不可被该新路径读取的检查，再记录迁移结论。渲染范围取保存的模拟区间并检查对应 mesh 文件，不能用脚本默认帧数覆盖已经改变的模拟长度。

盆内水位尚低、盆外却出现水膜时，先区分碰撞数据中已有越界粒子，与液面重建半径使表面膨胀。前者检查底壁接缝、倒角后的有效厚度及网格分辨率，后者检查粒子半径、mesh upres 和表面重建；二者都不靠透明材质隐藏。独立碰撞代理可用未倒角的闭合厚壁，但必须匹配可见湿面并有充分接缝重叠。对初始水体也检查实际顶面标高和 Flow 的体素表面扩张，不能只凭对象名称写着“below sill”就认定水在堰口以下。

流体求解必须从初始条件按时间推进；“按绝对帧重放”指读取已完成的缓存，并不声称任意一帧可以独立求解。用曲线形变、噪声位移或预设水帘做出的版本应标为程序化外观动画；真实 Mantaflow 缓存则标为数值流体小样。它们都需要画面验收，有限网格的流体小样也不自动具备工程精度或水量守恒验证。

水材质先用 Principled、`Transmission Weight=1`、`Metallic=0`、近似清水 `IOR≈1.333`，粗糙度从较低值试起；这是外观起点，不是源视频参数。不要用 `Alpha=0` 代替折射。先让宽区域光或明暗相间的环境在水面形成可读反射，再适量调整粗糙度和有尺度依据的吸收。背景颜色能帮助读水，但不会改变水的流动机制。

先关闭景深和运动模糊检查水帘拓扑、槽壁穿透、撞击位置及漏水，再逐项恢复效果。运动模糊涉及每帧变形的液面，使用缓存的速度向量并按引擎检查 Deformation Motion Blur；不能只开相机模糊就假定流体速度被正确读取。最终镜头应同时交代出口、悬空落差和接水区，避免槽壁在关键时刻挡住全部水帘。

## 先固定场景协议

| 项目 | 建议约定 | 容易混淆的地方 |
|---|---|---|
| 单位 | 米，`scene.unit_settings.system='METRIC'`，`scale_length=1` | 显示为毫米不会把已有网格自动缩小；毫米数据显式乘 `0.001` |
| 世界坐标 | Blender 的 `+Z` 向上，右手坐标系 | 现有 `+Y` 向上数据可用 `(x,y,z) → (x,-z,y)` 旋转到 Blender；相机和路径也用同一转换 |
| 转轴 | 对象原点放在实际轴心；装配体使用 Empty | 不靠偏移网格后绕错误原点旋转补救 |
| 时间 | 帧率与区间写入场景；`t=(frame-start)/fps` | 12 秒、30 fps 渲染 360 帧；另取端点检查时，不重复追加到视频 |
| 状态 | 工作状态、拆解展示偏移、相机状态分别定义 | 拆解量不改变接触条件、弹簧压缩或机构读数 |
| 结果 | 固定随机种子；直接跳到某帧仍能求出同一状态 | 不能用上一帧累加位移或墙钟时间制作离线动画 |

创建装配层级时先列清“谁携带谁”。一个 `DisplayRoot` 控制展示拆解，下面的 `OperatingRoot` 控制真实工作位姿，零件网格挂在所属装配体下。这样附属螺钉跟随承载件，展示位移也不会误进入机构计算。世界空间拆解方向需变换到父级局部空间后再赋值；父级已转动时，两者不再相同。

给已有对象换父级且保持位置，可先保存 `world = child.matrix_world.copy()`，设置 `child.parent = parent`，再恢复 `child.matrix_world = world`。这是普通、无约束对象的实用写法；已有约束、非均匀缩放或切变时应检查求值后的世界矩阵。[Parent Inverse](https://docs.blender.org/manual/en/5.1/scene_layout/object/editing/parent.html)解释了为什么换父级可能造成位置跳动。先处理缩放，再绑定复杂动画。

## 建模顺序：轮廓、厚度、倒角、法线

1. **轮廓和接口。** 用实际尺寸做低细节块体，先检查轴线、接触面、孔径和装配间隙。壳体要有厚度；用于观察的半壳应是明确的展示设计。布尔修改器适合孔槽，但不能把有破面、重叠面的问题留给材质掩盖。
2. **缩放与倒角。** 新建零件在绑定动画前应用缩放，或直接在网格坐标里构建最终尺寸，使 `scale=(1,1,1)`。倒角宽度从实际尺寸决定，先以 2–4 段试渲染；近景再按轮廓需求增加。`Clamp Overlap` 能限制倒角交叠，不能代替拓扑检查。
3. **平面和曲面。** 宽平面应保持平直，圆柱侧面连续，端面仍可平坦。`Shade Smooth` 改着色插值，不会增加轮廓几何。先检查法线和负缩放，再决定锐边、按角度平滑及自定义法线。
4. **稳定高光。** [Bevel 的 Harden Normals](https://docs.blender.org/manual/en/5.1/modeling/modifiers/generate/bevel.html)可让倒角过渡到周围平面；必要时在其后添加 [Weighted Normal](https://docs.blender.org/manual/en/5.1/modeling/modifiers/normals/weighted_normal.html)，保留锐边。它调整面角法线，不修复凹陷几何或穿插。不要无条件给每个有机曲面套同一组合。

先用灰色材质和单个大区域光看侧面、顶面、倒角交会处。高光被拉成不合理波纹时，暂停贴图工作，核对面是否共面、布尔结果和法线。镜头推进后看得见的边缘，才需要更密几何；看不见的螺纹不必以高面数建模。

## 用反射读材质，而不只换颜色

[Principled BSDF](https://docs.blender.org/manual/en/5.1/render/shader_nodes/shader/principled.html)先只设置 `Base Color`、`Metallic`、`Roughness`；普通塑料的 `Metallic=0`，裸露金属通常为 `1`，涂层和混合材质应按表面结构处理。金属 Base Color 影响反射色，不能把白色塑料仅靠降低粗糙度当成金属。

试灯时可以从塑料 `Roughness=0.35–0.55`、金属 `0.2–0.4` 开始，但这些是制作起点，不是实测材料参数。用同一机位比较高光宽度、表面反射与轮廓；细噪声只能补充材质尺度，不应把每一块表面都变成砂纸。

基础布光用一个较大的主区域光，再按暗面和轮廓需要加填光或窄条光。[Area Light](https://docs.blender.org/manual/en/5.1/render/lights/light_object.html)的尺寸、位置、形状都参与反射造型：大光源通常产生更宽的高光和较软的阴影；条形光适合读出圆柱及倒角方向。改变面积时也记录 `Normalize` 状态，它决定总功率是否随面积保持不变。先调反射位置和面积，再调能量；材料没有可反射的环境时，只降粗糙度不能补出空间信息。

所有灯位属于同一个场景。相机环绕时，固定光源的反射应随视角合理移动；不要让每个镜头临时附着一块没有记录的“美化高光”。需要跟随相机的摄影灯时，明确把它当作灯光设计并记录父级关系。

## 动作先说明关系，再修速度曲线

机械教学动画让一个驱动量决定相关零件：例如行程 `p` 同时决定轴心位置、弹簧长度和触点间隙。先在开始、接触阈值、最大行程、回位处检查几何，再调段落时长。任意逐帧按压动画不等于动力学求解，不能据此推断弹性回弹时间。

装配、拆解和信息展示常用 Bézier 缓入缓出；匀速转轴用 Linear，突变状态用 Constant。[F-Curve 插值](https://docs.blender.org/manual/en/5.1/editors/graph_editor/fcurves/properties.html)决定两关键帧之间的求值。自动 Bézier 手柄可能产生超调，接触面、刚性轴和相机近裁剪都要看邻帧。逐帧烘焙解析状态时，设 Linear 可避免采样点之间再被默认缓动修改；运动模糊还会读取子帧，必须检查采样密度是否足够。

Blender 5.1 中，插入关键帧后可这样设置当前对象所用 slot 的曲线：

```python
from bpy_extras import anim_utils

obj.location = (0, 0, 0)
obj.keyframe_insert(data_path="location", frame=1)
obj.location = (0, 0, 1)
obj.keyframe_insert(data_path="location", frame=24)

ad = obj.animation_data
bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
if bag is not None:
    for curve in bag.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR"
```

相机对象的位置与相机数据的焦距、光圈属于不同 data-block。修改曲线时应取实际存放动画的那个 data-block 的 `animation_data`，不能遍历 Action 的第一个 slot 后假定所有动画已修改。本机已运行上述 location 插值路线；第 12 帧得到 `z=0.478260875`，对应 `11/23`。

## 相机抵达一个可解释的位置

先用三分之四视角交代完整轮廓，再沿真实空间靠近接口或触点；需要看装配归属时使用拆解镜头，需要看工作条件时回装。近景使用原来的零件，不换成另一个构造不同的放大模型。

Blender 相机沿本地 `−Z` 看，`+Y` 为相机上方。脚本可用 `(target-camera.location).to_track_quat('-Z','Y')` 计算朝向；路径接近竖直时额外检查横滚。焦距、传感器尺寸、sensor fit 与画幅共同决定取景，单独设置“50 mm”不能保证与网页预演一致。

先关闭景深验收所有必要零件，再设置 `camera.data.dof.use_dof=True` 并用目标位置的 Empty 作为 `focus_object`。需要手写距离时使用沿光轴的正深度，不把相机到目标的斜距当作焦平面深度。拉焦在观众认出前后对象之后发生，焦点到达后保留读图时间。具体单位与对照方式沿用[焦点与空间](camera-depth.md)，光学接口见[官方 Camera](https://docs.blender.org/manual/en/5.1/render/cameras.html)。

## 色彩和渲染器保持明确

在项目开始固定工作空间、显示输出、view transform、look、曝光和 gamma。[Blender 5.1 默认线性工作空间为 Linear Rec.709](https://docs.blender.org/manual/en/5.1/render/color_management/color_spaces.html)；颜色贴图正确标记 sRGB，法线、粗糙度、位移等数据贴图标为 Non-Color。给节点输入网页十六进制颜色时，需要从 sRGB 解码并转换到所选线性工作空间；不能直接把 0–255 除以 255 当作线性颜色。

SDR 制作可从 sRGB 显示、AgX、固定曝光开始。[AgX](https://docs.blender.org/manual/en/5.1/render/color_management/displays_views.html)会压缩高光并降低强曝光颜色的饱和度；它不是品牌色严格匹配的保证。输出 PNG 后不再重复套 gamma 或另一套 tone mapping。需要后续合成和调色时保存场景线性 OpenEXR，并记录最终显示转换。

| 路线 | 用途 | 实际检查 |
|---|---|---|
| Eevee | 快速排镜、实体动作预演、满足其限制的最终画面 | 阴影漏光、屏幕边界反射、遮挡物后的反射信息、透明材质和景深 |
| Cycles | 复杂反射、折射、间接照明与最终材质比较 | 采样噪声、降噪是否抹掉细节、运动中的闪烁、渲染时间 |

[Eevee 限制文档](https://docs.blender.org/manual/en/5.1/render/eevee/limitations/limitations.html)明确屏幕空间效果依赖可见深度，不能默认等同于 [Cycles 路径追踪](https://docs.blender.org/manual/en/5.1/render/cycles/introduction.html)。换引擎后重新比较反射、阴影、透明边缘与曝光；不能因同用 Principled 就宣称画面相同。Windows 的无显示环境存在 Eevee 限制；是否能后台渲染以本机实际输出为准，不能只凭引擎字符串可赋值判断。

## 旧教程迁移到本机 5.1 的检查表

| 变化 | 当前写法和边界 |
|---|---|
| 4.0 重做 Principled 输入 | 按输入名称访问，不写数字下标；`Specular IOR Level`、`Transmission Weight`、`Emission Color` 等替代旧名称。见 [4.0 API](https://developer.blender.org/docs/release_notes/4.0/python_api/) |
| 4.1 删除 `Mesh.use_auto_smooth` / `auto_smooth_angle` | 使用面平滑、sharp edge 或按角度平滑工具；已有自定义法线自动生效。见 [4.1 API](https://developer.blender.org/docs/release_notes/4.1/python_api/) |
| 4.4 引入 slotted Action，5.0 删除 `action.fcurves` | 从相应 slot 的 channelbag 取 F-Curves；不硬编码 `layers[0]` 后忽略 slot。见 [4.4 动画](https://developer.blender.org/docs/release_notes/4.4/animation_rigging/)及 [5.0 API](https://developer.blender.org/docs/release_notes/5.0/python_api/) |
| 5.0 改 Eevee 标识 | 本机用 `scene.render.engine='BLENDER_EEVEE'`；4.2–4.5 常见的 `BLENDER_EEVEE_NEXT` 在本机被拒绝；Cycles 为 `CYCLES` |
| 5.x 节点与合成接口继续变化 | 本机 `Material.use_nodes=True` 仍可运行但出现 6.0 移除预告；合成器迁移不能沿用旧 `scene.node_tree` 假设，按安装版本检查 |

官方页面快照、访问时间、重定向、SHA256 和本机探测见 evidence/blender-technical（外部或本机资源，未随公开包收录）。这里核实的是 API 可用性和一个线性关键帧数值，不能替代资产渲染验收。

## 最低交付与验收

保存 `.blend`、生成脚本、相机/灯光/材质参数、渲染设置和实际检查记录。采用本机可执行文件运行，例如 `& 'D:/blender/blender.exe' --background --python '<项目脚本.py>'`；CLI 无需假定 Blender MCP 服务已启动。生产脚本应把输出位置作为明确参数，不改用户全局偏好。

验收按画面问题选择代表帧：完整轮廓、最大拆解、接触阈值前后、最大行程、近景和末帧。重新打开保存的 `.blend` 渲染其中一帧，确认资产和配置确实在文件里；看实际 PNG，检查穿插、遮挡、画幅、阴影、高光及焦点。还需看邻帧和短片原速播放，检查突跳、曲线超调、反射闪烁与停留节奏。固定帧号和种子重跑一次，用于检查结果是否可复现。

报告分别写清：已检查数值、已打开静帧、已看过哪些片段、是否完整播放、是否审听音轨。命令退出码为 0、渲染出图片、画面质量合格是三个不同的判断。当前指南的验收条目是制作要求，除明确标注的源抽帧观察和 API 探测外，不宣称已经全部通过。

## 可复制任务书

```text
使用本机 D:/blender/blender.exe 制作原创装配体的短动画，先约定单位、Z 向上坐标、帧率和输出画幅。建真实有厚度的零件、合理倒角和法线，保存可重开的 .blend 与生成脚本。

一个驱动量决定机构状态；工作位姿与拆解展示偏移分离，附属件跟随所属装配体。先认出整体，再观察局部因果，近景继续使用原来的零件。动画按绝对帧求值，明确哪些只是指定轨迹而非动力学仿真。

先灰模和区域光验收轮廓、厚度与接触，再加入 Principled 材质、反射和景深。固定工作空间、AgX/其他视图转换、曝光及渲染器；按 Blender 安装版本使用当前 API。

交付 .blend、脚本、参数、代表静帧、短预览和范围明确的验收记录。检查开始/阈值/极值/末帧及邻帧，打开实际图像，重开 .blend 重渲染；完整播放检查与静帧检查分别记录。对参考视频只引用实际观察到的内容，不推断作者未展示的插件或制作设置。
```
