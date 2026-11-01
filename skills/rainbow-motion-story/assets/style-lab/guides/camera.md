# 运镜、空间与景深

相机先回答观察任务：看轴线、接触、空间深度，还是两个部件的关联。运镜目录用于看机位如何接住主体，不按镜头数量评判质量。

| 可运行候选 | 适用情况 | 动作重点 |
|---|---|---|
| [多轴绕行，带克制横滚](../lab/#camera-orbit-bank) · `camera-orbit-bank` | 适合展示完整三维结构与宏大尺度，主体始终可追踪。 | 相机 position、target、fov、roll 都由绝对时间给出。 |
| [越过前景，接住下一个主体](../lab/#camera-occlusion-pass) · `camera-occlusion-pass` | 适合空间连续的章节交接和大场景推进。 | 遮挡物属于场景，应先可辨认。 |
| [先移焦，再推进](../lab/#camera-dolly-focus) · `camera-dolly-focus` | 适合从测量器或细节自然移交注意力到主体。 | 先让观众认出近处测量器。 |
| [主体不变，空间在呼吸](../lab/#camera-dolly-zoom) · `camera-dolly-zoom` | 适合空间关系揭示、尺度反差和章节转折，不适合精确尺寸比较。 | 锁定中心主体和目标平面。 |

大动作不等于持续高速。开阔段加速，抵达解释位后刹住。roll沿运动趋势倾斜再回正，不随意叠sin。穿越时检查近裁切面和实体包络。

pose包含position、target、FOV、roll、focusDistance，全部绝对时间求值。样条参数匀速不等于路程匀速：先采样弧长表，再按时间包络映射。接点检查位置与速度，必要时看加速度；全屏淡出不能修复几何跳变。

样例投影使用视图方向和透视除法，但Canvas遮挡有简化。迁入Three.js后使用真实深度、透明排序与裁切，不把绘制顺序当正确3D。

分层失焦样例不是光学求解。正式制作按深度与光圈实现，关键连接不能一端彻底失焦。公式读数独立清楚，对焦改变要能看出关注对象。

代码：[camera.js](../lab/modules/camera.js) 与 [common.js](../lab/modules/common.js)。检查原速连续段、边界邻帧、主体屏幕范围和遮挡持续时间。不同候选用同对象比较；别用更好的模型掩盖运镜问题。


[统一代码接口](../lab/modules/API.md) · [返回方法库](../lab/)

## 特种运镜的六个新候选

先读 [技术资料与设计推导](../studies/camera-moves.md)。该研究的10秒时间表是可调整配方；下面的实际代码为12秒，阶段定位以 `stageTimes` 为准。新代码没有使用参考作者的原始画面。

| 任务 | 候选 | 应当观察到的区别 |
|---|---|---|
| 在建筑或机构间穿行 | [穿梭绕飞](../lab/#camera-fpv-slalom) | 近处门框掠过，远景稳定，转弯带横滚并收回 |
| 高处越顶后俯冲拉平 | [穿梭俯冲](../lab/#camera-fpv-dive) | 路径有高度变化，俯仰与视差说明纵向空间 |
| 让观众站到物体身边 | [第一人称](../lab/#camera-first-person) | 视点绑定载体，停下观察时步态停止 |
| 快速退出身体看整体 | [离体漂移](../lab/#camera-soul-drift) | 同一角色从POV到第三人称，再准确回到眼部锚点 |
| 停住动作，绕看关键瞬间 | [子弹时刻](../lab/#camera-bullet-time) | 世界时钟冻结，相机继续环绕，碎片身份与位置不变 |
| 主体稳定，背景空间伸缩 | [希区柯克变焦](../lab/#camera-hitchcock-zoom) | 相机移动同时改变焦距，目标平面投影高度保持304逻辑像素 |

前两种飞行先验相机净距、转弯方向与近裁面，再评快感。路径前视目标不可与相机位置重合，竖直俯冲要防固定up退化。当前样例保持非退化视线；生产镜头如跨越正上/正下方，应使用连续四元数或平行运输框架。

第一人称的高度来自角色眼部/传感器，不能靠任意抖动暗示在走路。“灵魂漂移”在这里是明确的原创命名，表示从眼部退出、绕看同一人、回到当时眼部位置，不是有统一参数的标准电影术语。

希区柯克变焦保持 `d × tan(fovY/2) = K`，距离是目标沿视线的深度。只改FOV会改变主体大小；对厚物体、侧置主体还要验投影包围盒。子弹时刻用 `worldTime = τ(shotTime)`，冻结骨骼、粒子、施影物及材质动画；视角变化造成的反射变化仍可以发生。

## 按帧接入Three.js

```js
import {sampleCameraShot, applyCameraShot} from '../lab/camera-driver.js';
const shot = sampleCameraShot('camera-bullet-time', frame, fps, {intensity:.7});
const {focusDistance} = applyCameraShot(camera, shot, (worldTime, state) => {
  updateObjectsAt(worldTime, state); // 确定性求值，包含粒子与材质时间
});
// focusDistance 交给实际景深通道；普通PerspectiveCamera不自动产生景深。
```

`loop:false` 镜头到12秒保持末帧；再次播放从头开始，不把瞬移装作连续循环。离体候选是闭合往返，可循环。拼入自己的时间线时以 `cameraEndpoints()` 读取首尾，另设计匹配位置、朝向与速度的交接。独立候选之间不会自动无缝衔接。

Canvas样例的roll表示视图坐标旋转，Three相机局部rotateZ取相反号；[adapter.js](../lab/adapter.js)已处理这一差异并每帧重置绝对姿态。迁移时不要再次反号。适配器也按principalPoint设置取景偏移，使Three主点与预览一致。代码为 [飞行模块](../lab/modules/camera-flight.js)、[近裁与投影](../lab/modules/camera-flight-common.js)、[时间与变焦](../lab/modules/camera-time.js)。深度排序预览不能代替生产渲染的深度缓冲、透明排序、碰撞或光追。

验证命令：`node lab/modules/camera-flight-test.mjs`、`node scripts/camera-time-test.mjs`、`node scripts/qa_camera_adapter.mjs`、`node scripts/qa_camera_expansion.mjs`。前两者验几何与时间约束，第三项核对真实Three投影，最后一项验可拖动预览与章节交互；最终观感还要查看原速和近景邻帧。

相机跟随曝光、总览到同一窗口的局部推近，见 [传输效果指南](transmission-effects.md)与[双视图工作台](../lab/transmission-effects.html)。每个子样本重求相机，抵达后保留阅读时间。

## 用焦点组织空间

[焦点与空间工作台](../lab/camera-depth.html)补充固定机位移焦、移动追焦、侧移揭示三个14秒候选；可调光圈、焦距、对焦锚点，并和相同机位的全清晰画面对照。[详细指南](camera-depth.md)说明适用场景、光学参数与代码接入，[原片研究](../studies/camera-depth.md)将实际画面与原创实现分开。旧`camera-dolly-focus`仍为表现示意；新`camera-depth.js`使用轴深与薄透镜CoC，分层高斯仍是预览近似。
