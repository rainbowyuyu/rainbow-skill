# 运镜与景深：把透视、取景和焦点分别看清

这份研究给木韦运镜参考补上可计算的摄影机基础，服务于原创代码对照。它不反求原视频的镜头参数，也不代表重新完整观看了38个案例。原视频的取样和观看范围见 [原研究](camera.md)；本次只做公开技术文档与源码核对。

研究日期为2026-10-23。9份成功访问的官方文档、源码或教科书条目已读相关章节，保存了21条逐字核对的短摘录。4次访问失败记录也保留，不列为已读来源。来源清单（外部或本机资源，未随公开包收录）含访问时间、最终URL、读取范围和SHA256。`latest/main/dev`内容会变化，当前结论对应保存的响应快照。PBRT图注与公式已读，未单独看其全部示例图片。

## 各来源支持的结论

| 来源 | 实际核对范围 | 对代码的约束 |
|---|---|---|
| [Blender Cameras](https://docs.blender.org/manual/en/latest/render/cameras.html) | 焦距、DOF、光圈、sensor fit | 焦距影响取景；dolly zoom需要位移和焦距同时变化；明确输出画幅与传感器适配 |
| [CameraDOFSettings](https://docs.blender.org/api/current/bpy.types.CameraDOFSettings.html) | `aperture_fstop / focus_distance / focus_object / use_dof` | 对焦对象和手动距离是不同控制途径；f-stop越小，其他条件相同下散焦越强 |
| [Blender camera.cc](https://raw.githubusercontent.com/blender/blender/main/source/blender/blenkernel/intern/camera.cc) | `BKE_camera_object_dof_distance()` | 使用视线方向点积计算焦深，而非简单的目标斜距 |
| [Three PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html)及[源码](https://raw.githubusercontent.com/mrdoob/three.js/dev/src/cameras/PerspectiveCamera.js) | FOV、zoom、filmGauge及对应计算 | FOV为垂直角；相机zoom影响有效FOV；filmGauge与画幅共同决定有效传感器高度 |
| [Three BokehShader](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/shaders/BokehShader.js) | 全部shader，尤其深度重建与模糊量 | `aperture`是艺术增益，不能直接传入摄影f-number |
| [Filament](https://google.github.io/filament/main/filament.html) | 相机光圈定义段 | `N=f/A`，A为入瞳直径；光圈同时影响曝光与景深 |
| [Filament PostProcessManager.cpp](https://raw.githubusercontent.com/google/filament/main/filament/src/PostProcessManager.cpp) | CoC推导与像素转换段 | `Kc=A*f/(s-f)`，乘`1-s/z`后为带符号CoC；深度来自视空间z；像素换算使用输出高/传感器高 |
| [PBRT第四版§5.2.3](https://pbr-book.org/4ed/Cameras_and_Film/Projective_Camera_Models#TheThinLensModelandDepthofField) | 薄透镜模型、公式与DOF光线采样 | 薄透镜方程、相似三角形散焦圆直径、焦平面与可接受清晰范围的区别 |

两个细节需要交叉核对。此次Three.js的`getFilmHeight()`文字注释声称横画幅高度等于filmGauge，实际实现是`filmGauge / max(aspect,1)`，本库按源码和显式传感器尺寸计算。Filament注释把`Ap`写作带米单位的aperture，后文却用`A=f/Ap`；实现中的`A`才是孔径直径。本文统一用无量纲`N`表示f-number，避免沿用含混记号。

## 推轨、变焦与拉焦改变了什么

**推轨 dolly**改变相机位置。近物和远物相对相机的距离变化比例不同，画面中的相对大小与遮挡关系随之变化。横移使近物掠过得更快；沿光轴推进也会让前后层次的相对尺度变化。静止的主体和背景足以呈现这种差异。

**变焦 zoom**在固定机位改变焦距或有效FOV。在理想针孔模型里，同一机位的投影坐标按焦距统一缩放，前后物体的透视比例由视点决定。真实变焦镜头还可能有畸变、入瞳位移等变化，本样例未模拟这些。不能只用两张不同构图的图证明“长焦压缩了空间”，应说明是否为了保持主体大小而移动过机位。

**拉焦 rack focus**移动关注的清晰平面。基础对照固定相机位置、朝向、焦距和传感器，只改变焦深`s(t)`。物体中心投影应保持不动，近物与远物轮流清晰。真实镜头的focus breathing可能改变构图，本库的针孔投影加薄透镜CoC模型忽略这一效应，应在光学边界中说明。

**dolly zoom**同时改变机位与FOV，使主体平面的投影高度保持稳定，背景仍因视点变化而伸缩。对垂直于光轴的主体平面，保持`d × tan(fovY/2)=K`。厚物体、旋转物体、偏置主体还要测投影包围盒，中心深度恒定并不保证整个轮廓完全恒定。

## 焦深应沿光轴计算

设相机位置为`C`、世界目标为`P`，单位视线方向为`F`，则正向轴深为：

```text
z = dot(P − C, F)
```

如果局部相机向负z看，则`z = −P_camera.z`。对焦目标的`s`也用同样计算。侧置物体与中央物体只要处于同一个平行于传感器的平面，轴深相同；它们的欧氏距离可以不同。使用欧氏距离会把平面焦点误做成球面。

相机移动、朝向改变或目标运动时，每帧重新计算`s`。目标坐标和相机位姿必须处在同一世界空间，且使用同一时间样本。目标位于相机后方或太接近镜头时，返回无效状态或使用明确的安全对焦策略，不能把负深度取绝对值后当成正常可见目标。本库可采用比Blender底层绝对值处理更严格的可见性检查。

## 薄透镜散焦圆的推导与单位

本节采用正的物方轴深。PBRT的推导用带方向的负物距，转成本文约定后得到同一关系。

| 量 | 含义 | 计算单位 |
|---|---|---|
| `f` | 焦距 | 毫米 |
| `N` | f-number，例如2.8 | 无量纲 |
| `A=f/N` | 理想圆形入瞳直径 | 毫米 |
| `s` | 正的对焦轴深，须大于f | 毫米 |
| `z` | 可见物体的正轴深，当前模型域取大于f | 毫米 |
| `h_sensor` | 输出裁切对应的有效传感器高度 | 毫米 |
| `H` | 当前实际渲染输出高度 | 像素 |

世界单位为米时，仅在光学函数入口把`s,z`乘1000。焦距和传感器尺寸已经是毫米，不重复转换。

薄透镜满足`1/f = 1/z + 1/v`，焦平面的像距与物点像距分别为：

```text
v_s = f*s / (s−f)
v_z = f*z / (z−f)
```

光锥在传感器平面的截面直径由相似三角形给出：

```text
c = A * abs(v_s−v_z) / v_z
  = f² * abs(z−s) / [N*z*(s−f)]          // 毫米直径
c_px = c / h_sensor * H                  // 输出上的像素直径
```

若要区分前景和背景，可保留`c_signed=f²*(z−s)/[N*z*(s−f)]`，本文约定焦平面后方为正。渲染器可以采用另一符号，但接口中必须写明。`c`在这里一直是**直径**，不能将它直接当光圈半径。

以`f=50mm,N=2.8,s=8m,h_sensor=20.25mm,H=900px`为例，焦平面8m处`c=0`；4m处`c≈0.11231mm≈4.9915px`；16m处`c≈0.05615mm≈2.4958px`。前后相等的“距离差”不会给出对称散焦，不能用`abs(z−s)`单独充当真实CoC。

针孔投影的垂直FOV使用：

```text
fovY = 2 * atan(h_sensor / (2*f))
```

本库选择36mm横向取景宽度、16:9水平适配，`h_sensor=36×9/16=20.25mm`。这是明确的输出裁切口径，不把它叫成所有全画幅相机的物理传感器高度。变成竖片、方片或有非方形像素时要重新选择sensor fit，不能继续硬用20.25。

## 景深范围需要清晰度判据

理想几何模型只有焦平面上的CoC为零，附近物体可以小到看起来清晰。可接受CoC阈值与输出分辨率、缩放、观看距离及任务有关。工作台可以给“当前输出上CoC≤1px”的演示标记，但1px不是所有摄影场景通用的景深标准。

比较光圈时，固定场景、机位、焦距、焦深和曝光；否则变暗也会改变观众判断。固定这些条件时，N翻倍使CoC减半。比较不同焦距时必须说明是否同机位、同主体大小，以及是否随之改变了距离；不能无条件断言“长焦景深总是更浅”。

景深的用途是安排观察顺序。要看零件接触、受力路径或公式与对象的对应，两端都应保留足够清晰度。只有把注意力从前景测量器交给后方主体时，才需要更明显的焦点转换。

## 预览与正式渲染的边界

Canvas候选按物体中心深度计算CoC，再按深度分组，用Gaussian blur近似散焦。`sigma≈c_px/2`是本库的视觉映射，不是圆形孔径点扩散函数与高斯分布的等价关系。物体自身有厚度、透明结构或交错遮挡时，这种分层近似会失真，尤其是前景散焦扩散到后景的边缘。

真实薄透镜渲染需要对孔径上的光线采样，或用经过校验的深度景深通道；光线采样还需足够样本避免噪点。光圈叶片、猫眼散景、像差、衍射、focus breathing及运动模糊都不是本预览CoC公式自动包含的效果。景深和运动模糊分开计算；需要叠加时，每个快门子样本都重新求相机、目标轴深和场景状态。

Three.js普通`PerspectiveCamera.focus`不自动让画面失焦。此次读取的`BokehShader`计算`clamp((focus+viewZ)*aperture, ±maxblur)`，其`aperture`不能直接填摄影上的`N=2.8`。迁移到不同DOF pass先核对深度单位、正负号、半径/直径、分辨率和光圈语义。正式Blender镜头可用`camera.data.dof`配置，以目标物体定义焦点，再用相同机位与FOV对照。

## 对照与验收

推轨/变焦比较使用同一组近、中、远物体，相同起始机位；末帧保持中央主体相同屏幕高度，观察背景相对主体的尺度变化。比较时暂关DOF、运动模糊和曝光动画，让透视变化本身可见。

拉焦对照固定位姿与投影。检查近→主体→远三个阶段，中心投影恒定，目标CoC在各自观察窗口接近零。镜头移动时锁焦则反过来检查：位姿可以变化，但每一帧都把当前目标的轴深送入对焦，不沿用旧距离。

数值验收包含`s=z`时CoC为零、N翻倍CoC减半、H翻倍像素CoC翻倍，以及同一轴深侧移物体不会改变CoC。输入负深度、非正N和`s≤f`应有明确错误或有效域处理。前后层次身份、视线与FOV、进出锚点都应可追溯。

视觉验收需要原速片段和关键邻帧，检查焦点到达是否晚于旁白要点、前景模糊边缘是否漏色、文字是否保持独立清晰，以及大运镜之后是否留下可阅读的停留。数值通过不替代这些观感检查。实际候选和接口见 [使用指南](../guides/camera-depth.md)。
