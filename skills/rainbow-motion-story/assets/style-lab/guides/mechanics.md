# 机构拆解与剖面

转子发动机参考提供整机落定、轴向拆开、解释、回装的观察。软件教程中的模型外观不能直接充当真实结构证据。

[转子机构工作台](../lab/rotary-interaction.html)可独立操作运动相位、观察开口、轴向拆解和机位；配套 [交互指南](rotary-interaction.md)、[参考拆解](../studies/rotary-interaction.md)与 [运动学核验](../studies/rotary-kinematics.md)分别说明用法、可见证据和几何依据。

| 可运行候选 | 适用情况 | 动作重点 |
|---|---|---|
| [顺着装配轴拆开](../lab/#mechanics-axial-exploded) · `mechanics-axial-exploded` | 适合电机、轴承、镜头、阀门等轴向装配件。 | 整机、零件静止位置和实心轴共用一个固定装配轴。 |
| [剖开外壳，内部继续转](../lab/#mechanics-section-cut) · `mechanics-section-cut` | 适合腔体、转子、流道和内部结构解释。 | 先显示完整壳体，剖切前不让内部发光穿透。 |
| [齿轮联动，比例算出来](../lab/#mechanics-linked-gears) · `mechanics-linked-gears` | 适合解释减速比和同一机构中的多种运动。 | 固定内齿圈，显示每个轮的齿数。 |
| [曲柄、连杆与滑块](../lab/#mechanics-slider-crank) · `mechanics-slider-crank` | 适合机械运动学、能量转换与相位解释。 | 给出固定轴和滑块导轨。 |
| [移开前盖，观察同一副转子](../lab/#mechanics-rotary-section) · `mechanics-rotary-section` | 解释外部遮挡与内部运动的对应关系。 | 前盖先沿轴退出再移开，机构相位保持连续。 |
| [转子机构沿轴拆解与回装](../lab/#mechanics-rotary-explode) · `mechanics-rotary-explode` | 解释装配次序与轴向层次。 | 拆解位移独立于运动，回装从原始变换求得。 |

分离距离按投影可分辨程度确定，不机械等距排开。最大拆解幅度先检查画幅、标签、安全区，再安排镜头；不能靠零件即将出画时突然改FOV补救。

每件存 `id,parent,restPose,assemblyAxis,explodeDistance,stageOffset,labelAnchor`。局部轴先变换到世界空间；父件旋转后不能继续用原全局轴。回装反向求同一状态，不累积减回去。

真实产品查制造商或图纸；原创教学机构明确简化。外观、偏心和齿比不能凭美观推导参数。示例没有产品型号，不冒充原厂内部结构。

两个转子候选共用理想运动学，轴三圈对应一个带标记转子周期。直边三角形采用 `0≤e/R≤0.25`，不是13B生产轮廓；未实现密封、齿形或功率模型。观察开口通过实体前盖拆离形成，不是任意网格的布尔剖切。[代码接口](../examples/rotary-interaction/API.md)保留相位、显示与相机的独立参数。

标签靠近部件，短引线不穿主体。剖口应有切面或厚度，让观众知道移除了什么。完全透明常使前后关系难读，可让主讲件不透明、壳体降权。

代码：[mechanics.js](../lab/modules/mechanics.js)。程序化剖面用于方法演示；移入真实mesh时做剖切盖面、深度、接触阴影，不能强制置顶掩盖穿模。检查完整装配、最大分离、回装和倾斜机位；退场不得残留标签和零件。


[统一代码接口](../lab/modules/API.md) · [返回方法库](../lab/)
