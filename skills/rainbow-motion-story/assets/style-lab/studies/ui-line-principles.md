# UI 连续动效与线稿：互补方法及接入依据

研究日期：2026-10-23。本文是两条新参考的辅助方法底稿，**尚未据此认领 MAX 或沁雨莲原片的画面、时间码、软件和音效**。原片观察应另存记录，再把可见动作对应到这里的候选方法。下文“建议”是原创实现设计，来源事实另列。

## 已读资料与真实入口

| 资料 | 本次读取范围 | 可迁移的做法 |
|---|---|---|
| [连续交接](../guides/continuity.md)及 `lab/modules/continuity.js` | 指南；`sampleShellToForce`、父变换、标签锚点与候选接口 | 先保留对象身份和空间锚点，再改变外形、环境与观察位置 |
| [文字与色彩](../guides/type-color.md)及 `lab/modules/type-life.js` | 指南；`equationIdentity` 的符号列表与绘制顺序 | 同一个对象在两个布局间仍用同一 ID；先动作，再稳定阅读 |
| [生成式视觉](../guides/generative-style.md)及 `lab/modules/paper-space.js` | 指南；纸面 UV、父变换、固定拓扑与纸面卡片 | 纹理和线稿绑定局部坐标，镜头变化不生成新噪点 |
| Lemo `blueprint` | 本地 STYLE 的材料、线型、制作顺序及相机规则；目录分析 | 中心线→轮廓→细节→剖面线→尺寸→注记；隐藏线有具体语义 |
| Lemo `engraving` | STYLE 的线宽、排线、遮挡、着色次序及相机规则；目录分析 | 轮廓与排线分层；线段沿形体渐粗渐细，前景遮挡背景线 |
| Lemo `urban-sketch` | STYLE 的线、淡彩、纸纹、确定性及运动层次；目录分析 | 线稿与色块保留材质差别；颜色可随事件到达，静态纸页不抖动 |
| Lemo `swiss-motion` | STYLE 的排版、遮罩显字、按距离重排及稳定读数；目录分析 | 固定网格和单信号色；父容器的运动把子元素组织起来 |

这些 Lemo 条目固定于提交 `3961ddb3d24d8876e0e2754f7790d66908acee51`。STYLE、DEMO 和源码链接从 [图谱目录](../lab/lemo-catalog.json) 读取。它们的固定配色、字体、节拍或时长是来源风格的选择，不强制施加到用户的新片。现有 14 项原创试作中只有 `blueprint`、`swiss-motion` 可直接运行对应局部练习；**没有名为 engraving 或 urban-sketch 的完整原创试作**。

## UI 动效：让布局变化也能被追踪

建议把每个元素写成 `id / parentId / localBounds / transform / clipId / role / content`。主卡片变大成为详情页时，仍然保留一个内容对象；子项位于容器局部坐标，不能一套代码移动卡片、另一套代码猜测标题应该在哪。交接时若确实需要两份 DOM，明确哪份拥有可见内容和交互，避免同一文本叠印。

容器可以负责尺度和位置变化，文字负责语义焦点，背景负责余势。先让主卡片抵达可读区域，再依信息顺序展开子项；选中项始终可指认。不是所有层都同时弹入。长距离位移与短距离状态切换分别校时，固定毫秒数不是普适规范。

裁切链必须完整：先应用父容器变换，再应用父 `clip`，之后绘制局部子内容。进入详情的内容超出圆角卡片时应被父裁切，除非设计上明确进入独立浮层。顶层弹出卡片脱离裁切时，应保存屏幕矩形和下一父节点的逆变换，再交接到新父节点；直接换父节点会跳位。

参考 Motion 官方文档：`layout` 可动画化同一组件布局，`layoutId` 可连接不同组件的共享元素；其布局动画使用 CSS transform，因此缩放可能使子元素、边框圆角和阴影失真。文档给出子元素也使用 layout、将圆角/阴影放在支持校正的样式属性中的处理办法。视频 Canvas/Three 实现也要独立决定文字与描边是否随容器缩放，不能把整个卡片粗暴缩放后就算完成。

**速率的接缝。** 若后段要停住阅读，前段速度应趋于零；若要继续甩到下一层，上一段终点速度与下一段初速应一致。只检查终点矩形相同会漏掉顿挫。`minimum-jerk` 适合静止起终点的平稳到位；连续过渡不要每段都重置成静止。弹簧未收敛时不能在段尾截断。

## 线稿：线有层级，也有理由出现

建议分出四种语义层：可见轮廓、内部结构、尺寸/引线、可选隐藏线。它们不能都用相同粗细和透明度。隐藏线只在确实解释内部关系时出现，并使用统一虚线约定；普通风格线稿中，被前景挡住的背景线要消失，不能把所有背面棱线一并画出来。

三种线稿候选各有自己的材质，不宜只换底色。

- **工程线稿**：用中心/装配关系建立对象，轮廓先可读，再添结构与尺寸。轻微纸纹固定，描边清楚，尺寸与实际几何共用端点。
- **钢笔观察稿**：少量断笔、轻微越界和淡彩构成纸上观察；每条线的扰动由 `strokeId + seed` 固定，不能每帧重新随机。颜色跟随事件出现，物体离开某区域后不无故失色。
- **排线图版**：明暗来自沿形体的线密度、粗细和交叉层次；排线在物体边界裁切，圆柱和弯面用相应方向，不能给整页铺统一斜线。近看有刀痕，远看应合成稳定明暗，避免摩尔纹。

**描画顺序由解释次序决定。** `strokeId / partId / role / points / start / duration / occluders` 构成一条笔画。先绘哪一条应与当前问题有关；不是从整个 SVG path 字符串第一点机械地画到最后。均匀描画速度需要按弧长截取，而非按点编号或曲线参数截取。若分多笔，抬笔不应拉出跨越空白的连接线。

SVG 可用归一化 `pathLength`、数值 `stroke-dasharray` 和 `stroke-dashoffset` 表示揭示进度；MDN 明确 dash offset 的百分比以当前 viewport 为参照，不是该路径长度，因此不要用百分比误当归一化弧长。闭合轮廓还需检查末端是否存在不合理接缝。

**纸纹与缩放。** 大尺度纸色起伏用固定低频纹理，细纤维只在足够像素大小下出现；相机拉远时做抗锯齿/低通和线宽下限，避免保留大量次像素纹理。纹理绑定纸面 UV；纸页运动时跟页走，纸页不动时同一像素的纸纹不会随机变化。线条“手绘抖动”和纸张“噪声闪烁”是两种不同实现。

## 两组方法如何接在一起

可以让一张 UI 状态卡展开为同一对象的工程图：卡片边界成为图版边框，状态进度变成结构绘制进度，原来的短标签转为局部标注。保留对象 ID、关键强调色和一个屏幕锚点；材质转换后先给观察窗。返回 UI 时将图版中的实际结果回收到原卡片的读数位置。

反方向也可行：先沿结构线看明白一件事，再把各个部件的当前状态收成 UI 面板。这里的布局变化必须映射真实部件，不把没有来源的彩块包装成仪表。不同语义层可以错峰运动，但数值、几何与文字读取同一状态。

声音可按本库 [sound-design](../guides/sound-design.md) 另行编排。UI 的确认声应绑定真实状态提交，线稿的摩擦声应跟随笔速与接触区间。原片没有实听以前，不据画面推断原音色和卡点。

## 可直接复用的真实 API

```js
// root = 当前安装或研究方法库；以下路径相对 root。
import { sampleMotion } from './lab/rate-curves.js';
import { candidateById } from './lab/modules/index.js';
import { sample as lemoSample } from './lab/modules/lemo-trials.js';

const travel = sampleMotion('minimum-jerk', t - start, {
  duration: 1.2, origin: 0, distance: 1,
}); // position, velocity, acceleration, jerk 均有实际返回值
const identityStudy = candidateById['type-equation-identity'].sample(t, {
  intensity: .65, palette: 'titanium',
});
const blueprintStudy = lemoSample(t, {id: 'blueprint'});
const swissStudy = lemoSample(t, {id: 'swiss-motion'});
```

`paper-space.js` 的真实导出是 `samplePaperSpace(t)`，其顶点带稳定 ID、UV、parent 和 world 字段；用于学习身份与材质绑定，不当作 UI 布局库。`continuity.js` 导出 `sampleShellToForce(t)`、`sampleQuantityToTerm(t)`、`vehicleToWorld(local, vehicle)`；前两者是原有题材示例，不应直接把车辆几何换名后当成新片资产。

原建议已落地为 [UI choreography](../examples/ui-choreography/API.md) 与 [engraved mechanism](../examples/engraved-mechanism/API.md)，各自有 `sample` 状态与 `draw` 渲染层。第一个管矩形/父子/裁切/文字身份，第二个管笔画/遮挡/描画与纸纹。二者共享一个叙事时钟和身份表；不让一个万能函数同时猜测布局、结构、笔画和音效。

## 验收要检查过程

| 检查 | 应怎样复查 |
|---|---|
| 对象身份 | 任意 seek 后同一对象 ID 与内容不变；过渡时不会双写或瞬间丢失 |
| 父子与裁切 | 取展开中间态、圆角边缘和子项越界处；切换父节点前后屏幕锚点连续 |
| 速率 | 检查段界左右位置与速度；正式停留段位置变化为零，弹簧尾巴不截断 |
| 文本 | 字体加载后测量；容器缩放不让字形拉宽；手机大小保持稳定阅读窗口 |
| 线稿遮挡 | 背面边、前后重叠和剖面切换逐段检查；隐藏线仅按明确设计出现 |
| 描画长度 | 进度相同对应同一弧长比例；多笔之间没有穿越空白的错误连线 |
| 纹理 | 同时刻重复画与倒序定位像素一致；缓慢推拉时没有纸纹随机跳变 |
| 交互可用 | 播放、暂停、逐帧和恢复状态一致；Reduced motion 减少非必要位移，仍保留对象变化和结果 |

对浏览器工作台，`prefers-reduced-motion: reduce` 表示用户希望移除、减小或替换非必要运动。可选择直接进入稳定结果或温和的局部显隐，避免大面积缩放/甩动；不要把语义状态也一并删掉。成片创意的原始运动版与工作台的减弱运动预览应分别标记。

## 外部一手文档

以下网页于 2026-10-23 实际取得并阅读有关段落，页面标题、最终地址、HTML 哈希和摘录见 sources.json（外部或本机资源，未随公开包收录）。没有执行其示例或据此认领浏览器实测。

1. [Motion：Layout animations](https://motion.dev/docs/react-layout-animations)：layout/layoutId、transform 性能机制、子元素失真、圆角与滚动容器补偿。
2. [MDN：stroke-dashoffset](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset)：数值偏移、pathLength 与百分比相对 viewport 的区别。
3. [MDN：prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)：用户偏好和非必要运动的替换方式。
