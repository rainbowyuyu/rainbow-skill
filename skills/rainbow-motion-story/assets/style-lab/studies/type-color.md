# 文字、配色与信息动效：公开资料与样本观察

记录日期：2026-10-23。任务是补充可复用方法库；未修改已有视频工程。

这次通过官方文档、公开仓库目录和页面媒体链接检索，取得 6 个可解码样本。已查看联系表，并对 3 个变化窗口增加邻帧检查。没有进行完整原速播放；ffprobe 未发现这些样本含音频流，因此没有听审结论。确切帧号、PTS、来源、SHA256 和访问失败情况均见 sources.json（外部或本机资源，未随公开包收录）。

原视频/GIF 位于项目 `work/type-color-media/`，不进入安装后的技能素材。下面的小型联系表作为署名研究证据保留，不表示取得原片再发布许可。

## 实际检查的媒体

| 来源与范围 | 看见了什么 | 转成自己的方法 | 边界 |
|---|---|---|---|
| [Android MotionLayout](https://developer.android.com/develop/ui/views/animations/motionlayout)，`motion-simple.mp4`，3.233s；14 帧，0–3.200s | 0–0.733s：同一品红方块沿固定虚线从左移到右；1.000–1.500s 反向。位置变化时，颜色、形状和路径保持稳定 | 选择一个主变量，用共同的对象 ID 保持连续性。移动前先给出路径，让观众知道去哪里 | 触控演示，不能据此判定影片镜头的速度曲线 |
| 同页 `custom-attribute.mp4`，7.381s；16 帧，0–7.340s，另看 1.155–1.732s 的 7 个邻帧 | 方块右移时从品红逐渐经过紫色变为蓝色；方块和路径持续可追踪 | 位移和属性由同一进度值驱动。用于状态变化时，同时保留文字或符号，避免让颜色承担全部解释 | 未测得其插值色域；不称为 OKLCH 或感知均匀渐变 |
| [Carbon 公开仓库](https://github.com/carbon-design-system/carbon-website)，`default-slider-demo.mp4`，9.467s；20 帧，0–9.433s | 0–1.5s：滑块与数值由 50 变为 85；5.5s 输入框是 7，滑块靠左；6.0s 两者变为 74 | 公式数字、滑块、实体读同一状态。观众能验证“数值改变造成哪一个视觉变化” | 这是状态一致性证据，静帧不能证明全程运动速度连续 |
| [Datawrapper 配色指南](https://blog.datawrapper.de/colors-for-data-vis-style-guides/)，Pew 导航 GIF，17.410s；22 帧，0–16.410s | 导航布局保持不变，当前类别依次出现黄、酒红、绿、蓝、橙和橄榄色；选中状态还保留类别文字 | 颜色角色与类别含义绑定，布局承担阅读稳定性。更换章节时改变焦点，维持其余内容 | 来源讨论的是历史网站配色；不把旧页面字体、尺寸直接当现代视频模板 |
| Carbon `hero-video.mp4`，10.636s；23 帧，0–10.594s，另看 8.759–9.510s 的 7 个邻帧 | 0–1.001s：巨大的 n 形字面轮廓稳定，内部蓝色流动质感改变。3.503–4.505s：实体字体样张保留清楚的行列关系。8.759→8.884s 硬切到设备画面，随后黑色近景边缘逐渐揭出设备 | 标题轮廓可以固定，内部材质负责气氛；阅读文字保持独立。镜头切换后可利用前景边缘建立纵深 | 实际存在硬切；没有证据称两个场景属于同一物体或一次连续运镜 |
| Carbon `shell_animation_trim.mp4`，4.617s；20 帧，0–4.600s，另看 0.950–1.550s 的 7 个邻帧 | 左侧导航收窄，主标题、卡片、文字和分层图形一起重新分布，背景网格仍能充当参照 | 成组的内容共享父级变换；保留可追踪的标题或实体锚点，再移动其他元素 | 本段是界面重排演示，不代表片中所有元素应同速运动 |

联系表：位置移动（外部或本机资源，未随公开包收录）、属性变化（外部或本机资源，未随公开包收录）、滑块数值（外部或本机资源，未随公开包收录）、类别配色（外部或本机资源，未随公开包收录）、字形与场景（外部或本机资源，未随公开包收录）、成组重排（外部或本机资源，未随公开包收录）。

邻帧：颜色随位移变化（外部或本机资源，未随公开包收录）、界面重排（外部或本机资源，未随公开包收录）、前景边缘揭示（外部或本机资源，未随公开包收录）。

## 文档依据与适用范围

1. [Carbon Motion overview](https://carbondesignsystem.com/guidelines/motion/overview/)区分低干扰的 productive motion 和重要时刻的 expressive motion。落到科普片：解释窗口减少运动，关键结果才释放大幅变化。页面的 70–700ms 等 token 面向 UI，不能直接当成一句中文讲解的阅读时长。
2. [Carbon choreography](https://carbondesignsystem.com/guidelines/motion/choreography/)强调语义一致、空间连续和分批出现。它的网格运动限制属于 Carbon 界面语言；三维飞行、真实抛物线和机构运动仍应遵从各自空间关系。
3. [Android MotionLayout](https://developer.android.com/develop/ui/views/animations/motionlayout)说明可定位到任意进度的声明式转场与关键帧。方法库采用同一思想：任意 `t` 得到完整状态，倒序定位也不依赖上一帧。
4. [Heer & Robertson, 2007](https://idl.uw.edu/papers/animated-transitions)，*Animated Transitions in Statistical Data Graphics*，DOI `10.1109/TVCG.2007.70539`。已读摘要和图注：散点到柱图可先调整 x 位置，再由点变为柱。可借鉴“先改一个编码、再改另一个编码”的分阶段方法；这里未阅读全文、未查看关联 Vimeo，也不把论文结果概括成“动画总能提高理解”。
5. [WCAG 2.2 对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)提供普通文字 4.5:1、大字 3:1 的最低阈值；[颜色使用](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)要求用可见的第二线索表达重要含义。这是网页可访问性依据，下面的影片规则是保守借鉴，不能由几个色值推断整片通过 WCAG。
6. [WCAG 交互动画](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)说明用户应能关闭非必要交互运动。学习工作台宜提供停止、拖动和减弱运动；视频内容中的必要运动还应留有静止观察段。
7. [MDN OKLCH](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)解释感知明度 L、色度 C 和色相 h。可在设计配色时独立控制明度和色度。它不会自动保证文字对比，也不会把普通 sRGB 插值变成 OKLCH。
8. [Datawrapper 配色指南](https://blog.datawrapper.de/colors-for-data-vis-style-guides/)区分类别色、强调色、非数据灰色、顺序梯度和发散梯度。片中品牌色与数值色标应分别定义。

访问限制：Material 2 地址返回 JavaScript 外壳，未读到实际文章；Carbon `/guidelines/motion/usage/` 和旧 IBM animation 地址返回 404。Carbon Motion 页中的 Kaltura 播放器仅核对了公开源文件中的视频 ID，未取得这些内嵌视频，因此没有把其说明文字写成已观看结论。Berkeley 的旧论文站证书请求失败；最终使用可访问的 UW 作者页面。

## 本次代码接入

| 候选 | 实际方法 | 对应观察与依据 |
|---|---|---|
| `type-semantic-emphasis` | 两行词位稳定；“变化→结果”重音交接；3.5–8.5s 物体与词位保持静止 | Carbon productive/expressive 的用途区分；强调落定后供阅读 |
| `type-anchored-label` | 标签从测量点上方沿半椭圆移到下方，短线避开圆点，8.2–8.8s 交给误差 | 先保留对象身份，再调整其说明位置；空间关系可追踪 |
| `type-equation-identity` | 同一 V、I、R 沿独立弧线由 `V = IR` 移到 `I = V/R`；旧乘号退出、分数线出现；数值与电路共用状态 | 分阶段改变编码；Carbon 滑块样本体现同源数值一致性 |
| `type-palette-attention` | 目标、当前、误差的颜色与文字标识固定，焦点权重分段交接 | 颜色角色稳定；重要信息保留非颜色线索 |

实现采用 sRGB 通道插值，不声明 OKLCH。候选本身的画面、定位和边界由其测试报告负责；本页只记录来源与方法映射。可执行选择方法、6 组角色配色和接入要点见 [文字与配色指南](../guides/type-color.md)。
