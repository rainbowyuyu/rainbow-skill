# 公式与可视化

学习 3Blue1Brown 的公式变化或需要原生 Manim 渲染时，先读 [公式与图形语言](../../assets/style-lab/guides/manim-formula-language.md)，再到 [Manim 研究室](../../assets/style-lab/lab/manim-formula.html)比较四个原创例子：同一高度复制成两个面积项、差商随割线逼近、矩阵列对应基向量、旋转点的高度生成正弦。原生实现是 Manim Community 0.19.1/Cairo；旁边的 SVG 参数控件单独标识。GL 官方实例与影片源码的具体研究范围见 [源研究](../../assets/style-lab/studies/3b1b-manim-source.md)，迁移命令见 [API](../../assets/style-lab/examples/manim-formula/API.md)。

先给 quantityId 和出现位置，再做符号匹配；一项变多项要显式复制。参数、测量线与读数共享状态。有限差商和极限分别表示，矩阵插值的中间帧不套用终态面积结论，复平面的实部不能标成幅值。预建公式字面、用 DecimalNumber 更新读数，不每帧编译 LaTeX。保留清晰末态供观众读完，不能用字形顺滑替代数学正确性。

需要把实体观测逐步交给符号、公式和结论时，使用 [Motionface 文字与图形指南](../../assets/style-lab/guides/motionface-type.md)及[六方法工作台](../../assets/style-lab/lab/motionface.html)。`mf-card-convergence` 保留合力、质量、加速度三张卡的身份，再形成同一个关系；`mf-focus-handoff` 让当前位置、目标和差距共享数据；`mf-trace-assembly` 按支撑、跨度、杆件的语义次序建立结构；`mf-concept-bridge` 让同一观测对象换位，把留出的空间交给下一概念。文字、单位和实体读同一个状态，阅读阶段停止大幅动作。这些是原创 Canvas 教学示例，不是求解器、模型推理或工程受力计算；[API](../../assets/style-lab/examples/motionface-type/API.md)列出参数与边界，[研究记录](../../assets/style-lab/studies/motionface.md)区分公开页面、源码阅读和两部登录作品的静态观察。

整体画风与教学任务脱节时，可用 [审美方向指南](../../assets/style-lab/guides/aesthetic-direction.md)比较结构说明、材料微距和尺度回收。候选共享同一对象和参数，按观察任务调整构图；数据颜色与材料配色分别管理。尺度夸张和暖色圆弧属于视觉示意，不能替代物理场或真实尺寸比较。

按当前画面问题阅读 [公式与可视化的候选与选择方法](../../assets/style-lab/guides/visualization.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/visualization.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。

需要在不同表示之间交接时，读 [纸面、方向场与局部推导](../../assets/style-lab/guides/generative-style.md)，按观察任务选候选：

| 当前问题 | 候选与代码 | 接口 |
|---|---|---|
| 平面中的对象需要进入同一三维空间 | `visualization-paper-space` · [paper-space.js](../../assets/style-lab/lab/modules/paper-space.js) | [纸面接口](../../assets/style-lab/examples/ai-draw/paper-space-api.md) |
| 已看见点云，却不明白局部方向怎样产生轨迹 | `visualization-directed-flow` · [generative-flow.js](../../assets/style-lab/lab/modules/generative-flow.js) | [方向与观测接口](../../assets/style-lab/examples/ai-draw/generative-flow-api.md) |
| 上层推导讲完后，需要保留曲线并引入多个可能来源 | `visualization-observation-fan` · [generative-flow.js](../../assets/style-lab/lab/modules/generative-flow.js) | [方向与观测接口](../../assets/style-lab/examples/ai-draw/generative-flow-api.md) |

[AI绘图深入研究](../../assets/style-lab/studies/ai-draw-deep.md)区分参考观察和原创实现。纸面为解析形变，方向场与一对多关系为示意；不称真实布料、扩散求解或原作者源码还原。配色与材料随当前主题选择，三种候选可以分别使用。

当公式需要由实体操作逐步建立，或周期结论需要和最终状态对上时，读 [洗牌叙事与解释节奏](../../assets/style-lab/guides/shuffle-story.md)，在 [解释工作台](../../assets/style-lab/lab/shuffle-story.html)选择原创候选。代码 [shuffle-explanation.js](../../assets/style-lab/lab/modules/shuffle-explanation.js)将运动位置与已完成状态分开，实体落定后再更新因子或轮次；等号只在数值相等时出现。

[全片研究](../../assets/style-lab/studies/shuffle-story.md)补查476条静态样本、434个源帧与23张联系表，记录颜色身份、实体到数量及版式交接。抽帧间隔限制了可判断的变化时刻，不能据此确认完整连续丝滑或声音同步。做数量比较时注明位数、对数或数量坐标；表示容量足够不等于已证明均匀随机。

传输过程的窗口、确认和标签需要共同变化时，选 [窗口接力](../../assets/style-lab/lab/transmission-effects.html)，方法见 [指南](../../assets/style-lab/guides/transmission-effects.md)。同一事件表区分接收与确认返回，确认后才移动窗口；变焦不改变刻度意义，读数阶段保持结果。代码是有限教学事件演示，不称完整TCP仿真。
