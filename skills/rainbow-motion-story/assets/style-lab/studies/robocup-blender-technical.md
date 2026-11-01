# RoboCup 参考研究：Blender 大角度摄影与材质的技术底稿

核对日期：2026-10-24。本页是官方资料与本机实现核对，**不推断林花钱参考视频的渲染器、焦距、插件、样本数或工程设置**；实际源片观察由对应研究记录另述。

## 已实查的环境

- 可执行文件：`D:/blender/blender.exe`，Blender **5.1.2**，build `ec6e62d40fa9`。
- CPU：Intel Core i7-14650HX，16 核、24 逻辑处理器。系统内存约 31.73 GiB，本次查询可用约 9.94 GiB。
- GPU：RTX 5060 Laptop，8151 MiB；本次查询空闲约 7453 MiB，驱动 610.74。空闲容量随其他进程变化。
- 在独立 `--background --factory-startup` 进程内，CPU 与 OptiX 各生成一张 **64×64、1 sample** PNG。API 已读回，未保存全局偏好、未打开或改动用户现有场景。
- 这是可执行性预检，不是复杂场景性能测试或视觉验收。记录：local-preflight.json（外部或本机资源，未随公开包收录），脚本：probe_blender_camera.py（外部或本机资源，未随公开包收录）。

## 大角度来自位置、空间关系与节奏

大视差主要来自相机位置变化；短焦使相机可以靠近主体并保留更宽视场。单纯缩短焦距而不改变位置，只改变取景，不能凭空产生新的前后透视关系。[1]

| 镜头任务 | 本项目建议起点，非源片参数 | 可读性检查 |
|---|---|---|
| 低机位英雄镜头 | 同一模型、相机靠近地面，24–35 mm 作为比较候选 | 轮组/底盘不被地面截断，最近零件不过分膨胀，主体完整出现 |
| 从低处掠向高处 | 沿弧线路径升高，目标由底盘缓慢交接到机构重心 | 不用瞬间改 look-at 造成甩头；转场两侧主体屏幕位置和速度能接上 |
| 环绕并倾侧 | 方位角、仰角、距离独立定义，roll 单独控制 | roll 服务转向，解释窗口逐渐回正；不能整段永远倾斜 |
| 俯视展开 | 先给整体归属，再抬升看拆装轴线 | 俯视时不要把上下零件压成同一轮廓，留出装配轴的阅读空间 |
| 穿梭推进 | 先验证相机包围体到实体的距离，再增加速度 | 不穿壳、不穿桌面；近裁剪与速度模糊不能掩盖碰撞 |

焦距范围只是原创试做起点，应按实际尺寸、画幅、sensor fit 与意图比较。运动先经过“认出整体—接近原因—看清结果”的观察顺序；大角度不等于每一秒都飞行。

Blender 相机沿局部 `−Z` 观察，局部 `+Y` 朝上。普通非极点路径可使用：

```python
from mathutils import Vector, Quaternion

base = (Vector(target) - camera.location).to_track_quat('-Z', 'Y')
camera.rotation_mode = 'QUATERNION'
camera.rotation_quaternion = base @ Quaternion((0, 0, 1), roll_radians)
```

roll 右乘是围绕相机局部轴旋转，保留中心目标；本次 25 个低位到高位绕飞样本的指向数值误差为 0。这个测试路径没有穿越正上方极点；世界 up 与观察方向接近平行时仍需设计连续 up、平行输运或明确的独立相机 rig。相邻四元数作同半球处理只能避免符号跳变，不能自动修复极点方向翻转。

关键帧按绝对帧生成；相机位置、目标与 roll 都要检查边界速度。已烘焙轨迹在子帧也要可求值，因为运动模糊会采样帧间状态。不要用依赖上一帧的累计状态，也不要将二维画面旋转误称为真实飞行。

## 景深：选择观察对象，不是统一把背景糊掉

[Camera 与 DOF 官方接口][1] 支持 `camera.data.dof.use_dof`、`focus_object`、`aperture_fstop`；本机逐项赋值读回成功。[2]

```python
camera.data.sensor_fit = 'HORIZONTAL'
camera.data.sensor_width = 36
camera.data.lens = 35
camera.data.dof.use_dof = True
camera.data.dof.focus_object = focus_empty
camera.data.dof.aperture_fstop = 4.0
```

先关景深检查装配结构，再启用焦点。用一个跟随实际要解释部件的 Empty 表示焦点；焦点在两个已有实体之间交接，抵达后保留稳定窗口。浅景深适合选择触点、螺栓、电子元件；机构整体和公式解释应保留足够清晰范围。f/4 仅为起点，越小通常离焦越强，不是“越低越高级”。文字是否进入三维景深取决于它属于实体还是说明层。

## 运动模糊：依据位移与曝光，不靠整帧高斯糊

Blender 5.1.2 本机正确入口：[3][4]

```python
scene.render.use_motion_blur = True
scene.render.motion_blur_position = 'CENTER'
scene.render.motion_blur_shutter = 0.35
scene.cycles.rolling_shutter_type = 'NONE'
```

`motion_blur_shutter` 的单位是**帧**，不是秒。30 fps 下 `0.35` 为约 `0.0117 s`；`0.5` 对应半帧曝光。旧写法 `scene.cycles.motion_blur_position` 在本机不存在，不能照搬旧教程。先用 0.25/0.35/0.5 对比同一动作；需要辨认齿轮与文字时缩短曝光或稳定镜头，高速穿越才允许更长拖影。

官方列出的限制包括：正交相机没有相机运动模糊；运动灯光不参与运动模糊；物理/粒子系统须先烘焙以获得一致状态。物体变形、相机与刚体的模糊要分别检查，打开总开关不证明每一种变形都正确。镜头切点不能让曝光跨越不连续状态。

## 倒角、反射与轮廓光

金属读得出厚度，依赖真实边缘和可反射的明暗结构。按实体尺寸建模、应用 scale，再设实际倒角宽度；近景提高几何段数，远景优先保留轮廓。`BEVEL.harden_normals` 和 `WEIGHTED_NORMAL.keep_sharp` 在本机可用，但法线工具不修复穿插和错误拓扑。[5]

大区域主光给宽高光，窄条侧后光帮助读出弧面与外轮廓；相机环绕时让固定灯位的反射自然移动。`AreaLight.normalize` 本机可用，比较面积时明确是否保持总功率。[6] 如果需要跟随镜头的摄影灯，记录其父级与意图，别让灯随镜头偷偷跳位。细密条纹和超锐微表面可能产生闪烁，先减少超出成像分辨率的细节，再检查采样与降噪。

SDR 候选采用 AgX、固定曝光和明确 look。`AgX - Medium High Contrast` 在本机可读回；它只是候选，不是全片统一“增强质感”的按钮。AgX 会压缩高亮并降低强曝光颜色饱和度；应以最终输出比较金属亮边是否仍有层次，不能用过曝白片代替金属。[7]

## 原有代码复用路线

| 已有代码 | 可复用部分 | 必须补充的部分 |
|---|---|---|
| `examples/blender-flow/build_waterfall.py` | 按尺寸 box、相机和区域光、Cycles/OptiX 初始化、AgX、分阶段生成/渲染 | 原例是流水与三个固定机位；不是现成连续绕飞或机器人 rig |
| `lab/modules/camera-flight.js`、`camera-time.js` | 路径与独立相机/解释时钟的预演 | JS 坐标、投影、相机朝向须转换到 Blender，不能原样复制 |
| `lab/modules/camera-depth.js` | 焦点、遮挡和阅读窗口的预演协议 | 真实 Blender DOF 最后由实际镜头渲染核对 |
| `guides/blender-model-motion.md` | 部件层级、按帧状态、材质、缓存、Action slot 的 5.1 写法 | 源片特定观察应记在新研究页，不能追加为未经验证的“作者参数” |

在新资产上先做 4–6 个代表静帧：低位整体、最高仰角、最大 roll、拆解极值、最近距离、终态；再做短动画检查反射闪烁、穿模、速度交接和焦点。GPU/CPU 出图与画面好看是不同结论。本轮预检没有大型渲染，也没有把 64×64 smoke 写成视觉验收。

## 一手来源与记录

本轮实际读取的官方页面、SHA256 与时间见 official-sources.json（外部或本机资源，未随公开包收录）。初次 urllib 403 后改用 requests 成功获取 8 个页面，证据保存在同目录。以下均为 Blender 5.1 文档，不表示源作者实际使用这些设置。

[1]: https://docs.blender.org/manual/en/5.1/render/cameras.html
[2]: https://docs.blender.org/api/5.1/bpy.types.CameraDOFSettings.html
[3]: https://docs.blender.org/manual/en/5.1/render/cycles/render_settings/motion_blur.html
[4]: https://docs.blender.org/api/5.1/bpy.types.RenderSettings.html
[5]: https://docs.blender.org/manual/en/5.1/modeling/modifiers/generate/bevel.html
[6]: https://docs.blender.org/manual/en/5.1/render/lights/light_object.html
[7]: https://docs.blender.org/manual/en/5.1/render/color_management/displays_views.html

GPU 路线另核对 [Cycles GPU Rendering](https://docs.blender.org/manual/en/5.1/render/cycles/gpu_rendering.html)：本机 OptiX 实测可运行，但 8 GiB 显存仍需按场景预算，不能因为有 RTX 就假定任何高面数/体积/8K 纹理组合都可用。
