# 公式与可视化

AI绘图参考提供图像、点云、分布、曲线的身份接力；MOFs提供节点到网络的方法。原创粒子动画不称为训练模型运行结果。

| 可运行候选 | 适用情况 | 动作重点 |
|---|---|---|
| [实体的量，进入公式](../lab/#visualization-entity-formula) · `visualization-entity-formula` | 适合力学、能量、速率与量纲解释。 | 先看实体，再量位移；位移符号进入势能项。 |
| [散点聚成一条答案](../lab/#visualization-cloud-aggregation) · `visualization-cloud-aggregation` | 适合优化、概率分布、观测到推理的表示转换。 | 散点保存位置，不在每帧重新抽样。 |
| [流动在收窄处加速](../lab/#visualization-flow-continuity) · `visualization-flow-continuity` | 适合质量守恒、数据吞吐和流道截面解释。 | 先看流线进入与离开，再强调窄口。 |
| [多种状态，汇成同一答案](../lab/#visualization-multistate-confluence) · `visualization-multistate-confluence` | 适合算法候选、实验曲线、统计比较。 | 先分开建立语义。 |
| [同一条路线，从平面进入空间](../lab/#visualization-route-bridge) · `visualization-route-bridge` | 适合预测轨迹、运动规划、数据到实体场景的接力。 | 候选线先共用二维坐标，选中后保留同一采样点ID。 |
| [一个晶胞，长成一片结构](../lab/#visualization-lattice-growth) · `visualization-lattice-growth` | 适合晶格、多孔材料、网络拓扑和从局部到整体的结构解释。 | 只建立一个晶胞，先让八个角与十二条边被认出。 |

公式出现取决于概念是否已建立。先看到事件，提取量，再把符号放进关系。读公式时相机少动。分项合成不让整行字互相穿过，可先变为小点汇入，再显示完整关系。

符号飞行最后一段淡出旧符号，目标槽位随后显现；避免落点叠字。变量、单位和色彩一致。旁白时序以真实音频为准，不用字数猜讲到哪一词。

数学排版保持基线、上下标、矢量和负号。样例Canvas符号用于时序研究，出版级公式另做SVG或数学字体核对。真实数据读取保存值，揭示动画不改变数值。

表示转换保留关键锚点或拓扑。粒子移动，不每帧重生；颜色变化有明确语义。接求解器时先取真实状态，再派生标签和箭头。调参需要重新求解，两条旧曲线插值不能称新仿真。

代码：[visualization.js](../lab/modules/visualization.js)。验收缩图能找到当前项，飞行结束、合成和退场看邻帧，不残留无主符号。


[统一代码接口](../lab/modules/API.md) · [返回方法库](../lab/)

文字强调、动态标注和配色层次使用 [文字与色彩指南](type-color.md)，可在工作台对照 type-life.js 的候选。

新增 [一位一位选，乘法自己长出来](../lab/#visualization-choice-product)：六张牌逐位选定，剩余选择数再进入乘法，最终核对 `6! = 720`。在[视觉与讲稿工作台](../lab/shuffle-story.html)逐句观察，[复用指南](shuffle-story.md)说明怎样让公式从对象操作中出现。

传输数据与确认信号的交接见 [传输效果指南](transmission-effects.md)和[窗口工作台](../lab/transmission-effects.html)；同一事件驱动窗口与读数，放大只改投影，不改单位和确认状态。
