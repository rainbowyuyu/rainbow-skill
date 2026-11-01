# Motionface 官方社区公开源码研究

日期：2026-10-24（Asia/Shanghai）。研究方式：公开 GitHub Atom 提交记录、固定提交的 Markdown / HTML / Python / TypeScript 源码阅读。没有执行第三方仓库代码或安装其依赖；源码阅读与静态帧观察分别记录。后续补充审阅了公开数据文字样例的12张静态帧，未做原作连续播放或音轨听审。Motionface 首页11帧观察另见 [页面研究](motionface.md)。

## 版本与许可

| 来源 | 本次固定提交 | 核验结论 |
|---|---|---|
| `vibe-motion/skills` | `4c86c0d016a3ba22ee673428a494f3c44f84111f`，2026-10-05 | README 标明不再维护并转向 motionface.cc。当前根 `LICENSE`、spotlight 和 pixel2motion 的 `LICENSE` 请求均404；未核实统一许可，不复制其代码进可分发库。 |
| `vibe-motion/skills` 历史 SVG assembly | `35e9f71ac35ec388fae3769ca0e3ca85bd50272f`，2026-09-04 | 后续 `cb3c905e4bc362e02e040035b5c88b13fdd54cf4` 提交明确删除 `svg-assembly-animator`。本次只研究删除前公开文件，不称它为现行可安装技能。 |
| `vibe-motion/remotion-code-motion-explainer` | `d93c64393ae4c2a5485a3f8ddf4413c1e6fbe994`，2026-07-27 | `LICENSE` 明确 MIT，版权为 Bingo and Vibe Motion contributors。若实际复制或改编大段源码必须保留通知。`SOURCES.md` 明确第三方影像、品牌和无明确许可工程不自动包含在授权中。 |

提交取自各仓库 `commits/main.atom` 的首条 entry；固定提交 raw 文件已下载并记录 SHA-256。Git HTTPS连接失败、GitHub API返回限流；改读公开 Atom 与 raw，不登录，不更改远端。

## 1. 文字聚光：观察到的是两种实现

### 历史 spotlight skill：摇摆局部照亮

实读 `light-spotlight-render/SKILL.md`、`assets/light_spotlight_template.html`、`scripts/render_light_spotlight.py`。

模板由暗色底字和两层亮色文字组成。亮字受同一 SVG mask 控制，一层使用高斯辉光，另一层保持字缘清楚。mask 内的形状绕 `svgOrigin=(400,130)` 摆动；形状本体缩放另以 `(400,267)` 为中心，所以放大光束不会把摆动转轴一同搬走。GSAP `power1.inOut` 在正负摆角间无限往返。生成器暴露文字、角度、周期、灯形缩放、辉光和颜色。

**可取规则：**文字轮廓不需要变形，亮度与遮罩就能交接注意力；光束旋转中心与光锥大小是两个参数；辉光和锐利字面分层。

**本库适配：**采用一次有限扫光→完整读句→结果保留。让扫光与揭示共用进度和阅读方向，结束后全句保持足够对比。绝对 `t` 驱动替代无限 wall-clock 轮播；不要让科学公式的某一半永久藏在暗处。

**源码与说明差别：**文档称 standalone HTML，但模板通过 CDN 请求 GSAP。因此原模板不是完全离线、无外部依赖的成品；本库不依赖其运行方式。

### MIT explainer：扫光与单向文字揭示

实读 `assets/shot-library/src/VibeMotionShots.tsx` 的 `WideSpotlightReveal`（364–420行）。它以 Remotion 帧计算：

- 扫光在第0–74帧从横向−28%扫到112%，采用 `Easing.bezier(0.16,1,0.3,1)`。
- 文字在第14–54帧用 `clipPath: inset(...)` 从左到右揭出，不改变文字的字号、基线和形状。
- 强调线在第42–78帧由0延至680；扫光层用模糊，文字保持清晰。
- 参数为 `eyebrow/title/accent`；目录标记4秒。这里的帧区间不能脱离实际composition fps直接写成秒数。

**可取规则：**环境动作先到、语句随后读清、强调线最后落定，三个层级错开；光是引导，不承担全部可读性。一次揭示后不重新遮住已讲过的词。

**适配注意：**原函数大量绝对像素值，不能只改画布宽高就视为响应式；中文长句要先测量、拆语义块，再算mask和换行。标题不是逐字蹦跳字幕。

## 2. SVG assembly：先有正确终态，再从拆散状态回来

历史文件 `svg-assembly-animator/SKILL.md`、`references/animation_logic.md` 和 `assets/animation_template.html` 均实读。

方法包括底座→骨架→大面→细部；按层错开到达；围绕连接点或中心缩放；先布局正确终态，再定义拆散位姿。参考模板使用整体−180°回转、主体弹性入场、部件飞回，轴向压缩／拉伸与过冲加强速度感。

**不能直接继承的实现：**模板把第一个path当主体，其余当零件；使用 `Math.random()` 和随机stagger；极端远距离与 `scaleX=.05/scaleY=4` 面向风格化装配。它没有验证真实机械装配次序、碰撞或拓扑，也不能保证每次重播完全相同。

**本库规则：**

1. 用语义ID而不是第几个path识别文字／图元／部件；定义装配依赖与锚点。
2. 先构成可读终态，拆散只改变各actor的变换；结束时恢复同一几何、比例、字位和颜色。
3. 顺序按解释因果决定：坐标系→对象→测量→关系→结论；不能所有东西随机炸入。
4. 强度控制只作用表现，科学量／机械尺寸不被挤扁。短标题可轻微过冲，公式字形与数字单位采用不变形的位移／裁切。
5. 若用随机性，必须从ID与seed派生；每个部件的初态固定，按绝对时间求值。
6. 让前件结束和后件启动有可追踪交接；读结果时停止大幅动作。

## 3. Pixel2Motion：从图形拓扑借鉴到文字系统

实读 `pixel2motion/SKILL.md` 的几何结构、动画QA和Final Frame Contract部分，以及 `references/reveal-patterns.md`、`references/motion-personality.md`。

- 把图形拆为少量有意义的actor；持久ID、明确transform origin、路径方向和最终版式。
- 不用过多锯齿描边节点换取表面像素拟合；路径复杂度直接影响可编辑性和运动稳定性。
- 交叉路径揭示需检查“另一支提前露出”；可按交叉次序拆fill与mask。路径交接要保留总体速度曲线，而不是每段重新ease-out。
- 最终动画帧与静态终态应同一管线比较；重要接缝要密采样，均匀几帧可能漏掉停住再弹出的缺陷。
- 其20:50:30和具体毫秒数是来源配方，不能称普适定律，也不适用于所有中文阅读句窗。本库按信息量与口播窗口安排。
- 来源对CSS变量与keyframes兼容性的结论是其案例经验；本次未独立验证浏览器版本，不把它改写成所有浏览器的绝对限制。

**文字优化落点：**段落先读全义，再分组进入；保持固定词位和最终基线；入场、停留、接力各有职责；文字的生命力来自语义次序和层级变化，不是每字永久呼吸。

## 4. Continuous editable explainer：让一个系统连续改变

实读 `SKILL.md`、四份production/design/reconstruction指南、`SOURCES.md`，程序化检索63条 `shot-library.json`，重点阅读 `ProductionSystem.tsx` 的类型、`GraphCard/KnowledgeWorld/SrtDrivenVideo` 和聚光相关镜头。

### 最值得接入的规则

每句保存：输入状态、动作、可见结果、焦点、下一镜锚点。用持久对象表贯通段落；既有实体变状态，而不是每段重新换一个装饰卡片。先设计信息最密的一帧，再安排谁何时出现。

正式状态共用 `frame + fps + props + seeded data`；音效来自可见事件；标签绑定语句cue；数值、公式、粒子和实体使用同一源值。动作片段按“定位→预备→变化→检查结果→接力”编排，不把每4秒视为必须重置画面的理由。

### 具体实现与适配边界

`ProductionSystem.tsx` 保留 `KnowledgeNode{id,x,y,width}`、`KnowledgeEdge{id,from,to}` 与 `CameraState`。`KnowledgeWorld` 根据当前beat和上一beat镜头状态插值，固定节点和边被聚焦，非重点降权；`SrtDrivenVideo` 始终挂载知识画布，以opacity切换可见性。

同时源码存在本库需进一步处理的点：

- `GraphCard` 入场progress读取 **每个beat的localFrame**，会在下一beat重新入场，即使React对象一直挂载。持久挂载不等于视觉持久。本库应使用actor首次出现时刻与独立焦点包络。
- 连线dash长度固定680，并非真实曲线长度；不同长度的边需要归一化 `pathLength=1` 或测长，才能准确完整揭示。
- 选中节点的scale在 `1/1.08` 间直接切换，焦点opacity也是即时条件值；本库应显式缓动焦点交接，不修改数据。
- 默认fallback graph中的企业关系只是来源示例，不搬入科普工程当最新事实。
- 63条目录读取不等于63镜头视觉审阅；README的65 compositions是来源声明，本次未执行其bundle验证。

## 公开 demo 与实际观察范围

- [数据与动态文字展示](https://github.com/vibe-motion/remotion-code-motion-explainer/blob/d93c64393ae4c2a5485a3f8ddf4413c1e6fbe994/assets/showcase/shot-gallery-data-type.mp4)
- [连续讲解与导演展示](https://github.com/vibe-motion/remotion-code-motion-explainer/blob/d93c64393ae4c2a5485a3f8ddf4413c1e6fbe994/assets/showcase/shot-gallery-director.mp4)
- [公开镜头目录](https://github.com/vibe-motion/remotion-code-motion-explainer/blob/d93c64393ae4c2a5485a3f8ddf4413c1e6fbe994/assets/shot-library/shot-library.json)
- spotlight目录还声明 `assets/shot-library/previews/wide-spotlight-reveal.mp4`；本次只核对目录字段，未请求该媒体文件，不保证该路径资产已发布。

## 后续静态帧审阅

`shot-gallery-data-type.mp4` 已从上述固定提交公开链接保存，仅用于本地研究。ffprobe 确认 1440×540、12fps、6秒、只有视频流；以0.5秒间隔检查12张静态帧。看见柱形、数字卡、代码揭示、分段标题与强调线，约3秒后再次展示前段序列。见 联系表（外部或本机资源，未随公开包收录）与 带哈希的来源清单（外部或本机资源，未随公开包收录）。连续导演展示仍只核对链接。静态帧不证明所有中间帧连续或音画同步。

## 本轮建议与验证

建议新增原创有限候选：语义扫光、分组错落装配、图形→数字／公式接力、持续画布的焦点接力。它们可复用已有 `sample/draw` 和三套配色；分别检查任意seek、负/超界时间、中文长句、阅读停留、统一对象ID与数值、渲染保存栈和末帧稳定。

不得把这些候选称为 Motionface 全库复刻。源码机制、网页视觉观察、原创实现和本地QA是四种不同证据，交付时分别说明。
