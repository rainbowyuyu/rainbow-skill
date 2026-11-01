# 机构与拆解

按当前画面问题阅读 [机构与拆解的候选与选择方法](../../assets/style-lab/guides/mechanics.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/mechanics.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。

转子专题在 [机构工作台](../../assets/style-lab/lab/rotary-interaction.html)比较 `mechanics-rotary-section`（实体前盖退出后观察内部）与 `mechanics-rotary-explode`（沿轴拆离和回装），均为18秒原创候选。[接口](../../assets/style-lab/examples/rotary-interaction/API.md)与 [指南](../../assets/style-lab/guides/rotary-interaction.md)说明怎样接入：运动角、顶点、标记和读数取同一状态；开盖、拆解与机位独立，切换显示不能重置运动。绝对时间采样应支持乱序定位，回装恢复原始变换。

[原片研究](../../assets/style-lab/studies/rotary-interaction.md)只说明实际可见的输入与反馈，静态采样、播放运行和声音听审分别保留范围，不据画面复刻源码。自己的 [运动学核验](../../assets/style-lab/studies/rotary-kinematics.md)支持轴与转子3:1及完整带标记周期；直边三角转子限制 `0≤e/R≤0.25`，不代表13B生产曲面、密封、齿形或燃烧。前盖移开是观察开口，不称任意网格布尔剖切；演示速度不能直接推出真实功率。


可拆解机械新增 [按键工作台](../../assets/style-lab/lab/switch-anatomy.html)与 [制作指南](../../assets/style-lab/guides/anatomy-mechanics.md)，源自 Inspire King 对 Anatomy 的介绍及[固定版本源码研究](../../assets/style-lab/studies/anatomy-mechanics.md)。两条原创18秒分镜分别走向同一触点或轴向拆开再回装。机构状态、显示偏移与镜头分离；凸轮/随动件连接输入与触片，过行程用理想弹性耦合吸收。

操作控制器 switch-session.js 从当前采样位置续接新请求：先释放再拆开，先回装再按压。它保证有限参数下的位置连续与操作门控，不模拟动量或碰撞动力学。遮挡需在实际允许机位检查；Canvas 面片深度排序不是任意场景的深度缓冲。JSON区分完整分镜和手动冻结状态，只有操作历史与过渡计划齐备才可声称还原交互过程。
