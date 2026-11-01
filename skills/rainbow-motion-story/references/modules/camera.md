# 运镜与景深

穿梭绕飞、俯冲、第一人称、离体漂移、子弹时刻和希区柯克变焦使用同一指南的新候选节。技术定义与来源见 [特种运镜研究](../../assets/style-lab/studies/camera-moves.md)。[camera-driver.js](../../assets/style-lab/lab/camera-driver.js)把镜头时钟和世界时钟分开接入Three.js；有限镜头停在末帧，不自动瞬移循环。

按当前画面问题阅读 [运镜与景深的候选与选择方法](../../assets/style-lab/guides/camera.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/camera.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。


### 镜头与表示方式一起交接

参考[连续交接指南](../../assets/style-lab/guides/continuity.md)和[汽车飞行逐帧研究](../../assets/style-lab/studies/car-ignition-deep.md)。同时检查世界锚点与屏幕锚点：主体/路径身份连续，还要避免中间侧视使曲线压成直线。近景回答作用点，全景回答行为结果；公式接力先保留主体，再让环境退去。源码是否共享数据不能从参考画面断定，自己的实现应保存点ID与统一状态。

需要跟随高速对象或从总览进入窗口特写时，读 [传输效果指南](../../assets/style-lab/guides/transmission-effects.md)，用 [双视图工作台](../../assets/style-lab/lab/transmission-effects.html)比较固定与跟随机位。曝光取相对屏幕运动，每个子时刻重算相机；局部放大沿用同一框和刻度，回稳后再读结果。

### 焦点与空间

[工作台](../../assets/style-lab/lab/camera-depth.html)增加固定机位移焦、移动追焦和侧移揭示。对象不偷偷改变位置；每帧按真实锚点求相机光轴深度，光圈与焦距单独调节，保留稳定阅读和有限末帧。[指南](../../assets/style-lab/guides/camera-depth.md)说明选用与接入，[原片研究](../../assets/style-lab/studies/camera-depth.md)区分失焦、机位运动及实际观察，[技术核对](../../assets/style-lab/studies/camera-depth-technical.md)解释CoC单位与引擎差异。旧表现样例不升级标称为物理渲染；新实现也不把高斯虚化称作真实散景。
