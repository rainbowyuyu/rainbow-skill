# 材质与视觉

标题要显露、停住并把注意力交回画面时，使用 [Motionface 文字与图形方法](../../assets/style-lab/guides/motionface-type.md)。在[工作台](../../assets/style-lab/lab/motionface.html)比较卡片汇聚、遮罩排字、焦点接力、轨迹组装、环字落定与对象接棒，可换三组配色、改中文长句、逐帧检查并导出代码调用。先固定最终版式，再按词组揭示；不要让公式字形随弹性缩放变形，也不要把所有文字都变成循环呼吸。[公开源码研究](../../assets/style-lab/studies/motionface-public-code.md)记录扫光与锐字分层、语义组装和持久对象；[Focus](../../assets/style-lab/studies/motionface-focus.md)与[Mindset](../../assets/style-lab/studies/motionface-mindset.md)记录经用户授权登录后观察的两部作品。只转译已观察到的方法，不声称完整素材库或付费源码复刻。

需要在用户的 Blender 中实际建模、烘焙液体或路径追踪时，转到[Blender 原生流程](blender.md)和[流水研究室](../../assets/style-lab/lab/blender-flow.html)。先核对几何、碰撞与缓存，再调整清水折射、区域光和 AgX；水膜穿过槽壁不是靠提高渲染采样能解决的问题。示范与源片的实现区别见[流水研究](../../assets/style-lab/studies/blender-flow.md)。

象征物、版画剪影与片头揭示使用 [象征物片头指南](../../assets/style-lab/guides/symbolic-title-sequence.md)。在 [片头工作台](../../assets/style-lab/lab/symbolic-titles.html)比较轮廓接力、负形穿越和双世界；先定物件与主题的关系，再选色盘和转换。给新形态留一次辨认窗口，最终片名完整停留。[来源研究](../../assets/style-lab/studies/magpie-title.md)分别记录用户概念短片与原剧设计师访谈，不能把图形隐喻当作科学机制或推断出原片渲染管线。

网页选型与 AI 审美判断使用 [网页审美方法](../../assets/style-lab/guides/web-aesthetic-direction.md)。先定任务和真实内容，再比较编辑式、控制台式、展廊式骨架；在 [网页工作台](../../assets/style-lab/lab/web-aesthetic.html)保持同一内容试排、筛选和导出。它使用真实 HTML 交互，不是视频中的 Canvas 界面；[见构 UI 与源铺研究](../../assets/style-lab/studies/jiangou-ui.md)记录实际查看范围，商业模板与原创代码分开。

需要选择整体视觉方向时，读 [审美方向指南](../../assets/style-lab/guides/aesthetic-direction.md)，在 [三方案工作台](../../assets/style-lab/lab/aesthetic-direction.html)比较同一圆环的纸白剖面、黑场微距和暖色尺度回收。先写当前观察任务，再比较层级、留白与材料；同一时刻切换或并排，结合灰度检查和设计决策导出。几何事实不随风格改变，解析光照与图形圆弧的边界见 [接口](../../assets/style-lab/examples/aesthetic-direction/API.md)。[公开设计资料](../../assets/style-lab/studies/aesthetic-design-principles.md)提供选择依据，不把比例配方当通用美学规则。

文字动效、注意力交接和整体配色使用 [文字、可视化与色彩](../../assets/style-lab/guides/type-color.md)。公开资料与实际观看范围见 [研究记录](../../assets/style-lab/studies/type-color.md)，可运行文字候选在 [type-life.js](../../assets/style-lab/lab/modules/type-life.js)。

按当前画面问题阅读 [材质与视觉的候选与选择方法](../../assets/style-lab/guides/look.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/look.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。

画风变化需要服务解释时，读 [纸面、金色方向场与墨绿黑板](../../assets/style-lab/guides/generative-style.md)：纸面用于共同坐标进入空间，点群用于分布与方向，黑板用于保留底层关系的局部推导。它们是可选的表现结构，不是下一期视频必须照搬的配色模板。

对应 [paper-space.js](../../assets/style-lab/lab/modules/paper-space.js)、[generative-flow.js](../../assets/style-lab/lab/modules/generative-flow.js)；选用前看 [纸面接口](../../assets/style-lab/examples/ai-draw/paper-space-api.md) 或 [方向与观测接口](../../assets/style-lab/examples/ai-draw/generative-flow-api.md) 的材质和实现边界。[深入研究](../../assets/style-lab/studies/ai-draw-deep.md)记录实际静态审阅与播放范围；程序化纸张和点云不冒充真实布料模拟或模型推理。

高速位移生硬或模糊抢走阅读时，读 [传输效果指南](../../assets/style-lab/guides/transmission-effects.md)，在 [双视图工作台](../../assets/style-lab/lab/transmission-effects.html)保持同一时间对照单时刻、时间曝光与空间柔化。先验证相对屏幕运动，每个子样本重求相机，HUD后合成；色域和透明遮挡的边界见 [官方资料核对](../../assets/style-lab/studies/motion-blur-technical.md)。

金属反射、电子封装层级和信号通路使用 [金属与电子指南](../../assets/style-lab/guides/metal-electronics.md)，在 [三候选研究室](../../assets/style-lab/lab/glass-metal.html)比较金属近景、原位拆层与互连追踪。已实现的是WebGL光栅PBR与绝对时间状态；局部开孔、金属化等另列为待制作食谱。[接口与边界](../../assets/style-lab/examples/glass-package/API.md)说明共享几何规格、透射近似及信号示意的范围。
