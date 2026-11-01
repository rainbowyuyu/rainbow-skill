# Blender 原生建模、仿真与渲染

需要真实三维资产、装配动画、液体碰撞或路径追踪时，读[Blender 建模与动画指南](../../assets/style-lab/guides/blender-model-motion.md)，并查看[流水研究室](../../assets/style-lab/lab/blender-flow.html)。用户安装位置为 `D:/blender/blender.exe`；已实查版本 5.1.2。后台脚本使用独立 `--background --factory-startup` 进程，保留用户正在打开的场景与全局偏好。可执行文件可用不代表 MCP 已连接。

[流水源帧研究](../../assets/style-lab/studies/blender-flow.md)学习“供水—导流—下落—承接”的空间因果、透明水的环境反射及镜头遮挡。原片没有公开求解器或渲染设置。本库的 Mantaflow 液体小样是原创实现；[脚本与使用说明](../../assets/style-lab/examples/blender-flow/API.md)记录实际参数、输出和外部缓存。

讲机器人、扫描、规划和内部执行时，读[空间解释镜头](../../assets/style-lab/guides/robot-spatial-explainer.md)与[林花钱 RoboCup 研究](../../assets/style-lab/studies/robocup-blender.md)。[原创小样](../../assets/style-lab/examples/robocup-blender/API.md)用同一实体连接射线命中、已知几何的代价场、A* 路线及开盖；镜头从低位整体抬升到场，再进入内部。按当前观察任务选大角度，不持续无目的绕转。扫描点显露只变局部大小，不缩放世界位置；路线安全距离要覆盖真实机体包络；绑定父级前更新矩阵，防止零件旋转丢失。本例是运动学与计算几何演示，非 SLAM、传感噪声或真实控制闭环。渲染与实查边界见[技术底稿](../../assets/style-lab/studies/robocup-blender-technical.md)。

## 执行次序

1. 固定单位、坐标、帧率、观察任务与实际尺寸。Blender 用 Z 向上；来自网页的 Y 向上几何、镜头和数据统一转换。
2. 先做轮廓、厚度、倒角和法线，明确零件父级及转轴；工作位姿和展示拆解偏移分开。
3. 液体分开 Domain、Flow、Effector。按最长域边除以分辨率估计格宽，检查入口、壁厚、倒角、接缝和水层能否被分辨。
4. 先 Bake Data，完成后 Bake Mesh。几何、流量、重力变化要重烘到可追溯的新缓存；灯光、相机变化可重用已有缓存。
5. 先检查灰模与接触，再调材质、环境和区域光。透明水用透射与合理 IOR，不用 Alpha=0 假装折射。路径追踪的噪声与降噪闪烁另验。
6. 保存可重开的 `.blend`、生成脚本、外部缓存位置、代表帧和短片。独立重开后跳帧渲染，确认缓存不是只在内存里有效。

水出现在盆外时不要直接称为飞溅：对照内水位、碰撞体、粒子位置与网格重建半径，区分溢流、漏水、网格外膨。提高渲染采样不能修复液体碰撞错误。

## 与现有方法衔接

- [机构](mechanics.md)：真实层级与装配位姿进入 Blender；解释用的拆解量不改变工作状态。
- [运镜](camera.md)：相机按世界锚点追踪，旋转、焦距与焦平面一起核对；后期文字不跟着景深糊掉。
- [材质](look.md)：固定灯光和色彩管理后比较材料；物体转动时反射随空间关系变化。
- [可视化](visualization.md)：公式、标注与实体读取同一状态和事件。按绝对帧重放流体缓存，不等于每一帧可以独立求解。

兼容本机 5.1：Eevee 标识为 `BLENDER_EEVEE`；Action 使用 slot/channelbag；Principled 用输入名称；`mesh.use_auto_smooth` 已移除。参见官方资料与本机 API 探测（外部或本机资源，未随公开包收录）。小网格示范不作为精度或工程守恒验证；源片采样、连续播放、音轨听审分别记录。
