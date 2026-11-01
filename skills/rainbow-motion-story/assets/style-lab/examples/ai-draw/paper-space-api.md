# 纸面进入空间：瓷白纸与墨蓝坐标

候选 ID：`visualization-paper-space`。代码位于 `../../lab/modules/paper-space.js`。这是现有候选工作台的一个方法组件，不创建新页面，不引入 npm 依赖。

研究依据为 [AI 画图研究记录](../../studies/ai-draw.md) 的 38–43 秒密集联系表。参考中先移开图片、随后纸面变形、最后引入空间坐标。本例选择原创的开口圆弧纸拱来表达同一逻辑：不复刻原片图片、人物、配音、纹理或纸团形状，也不声称还原作者源码。

## 调用

```js
import {paperSpace,samplePaperSpace} from '../../lab/modules/paper-space.js';

const t = frame / fps;
const state = samplePaperSpace(t);
paperSpace.draw(ctx,t,canvas.width,canvas.height);
```

总长 13 秒，`loop:false`。超出 13 秒保持终态；负时间和非有限时间按 0 秒处理。任意 seek 不依赖前一帧。标准画幅为 1600×900，draw 将其等比坐标映射到指定画布尺寸。

本候选有意使用独立的瓷白/墨蓝材质，不套用通用深底配色。通过 `PAPER_PALETTE` 可统一更改色彩，不建议仅替换局部标题颜色破坏整片对比度。强度滑块不影响几何。

## 编排

| 时段 | 动作 | 连续锚点 |
|---|---|---|
| 0–1.05 s | 瓷白格纸、墨线和三张原创几何卡片建立关系 | 纸面中心与 UV 标点 |
| 1.05–3.29 s | 三张卡片错开启动，先抬起、再滑走、最后落定 | 每张卡片 ID、原位和目标位 |
| 3.5–6.2 s | 同一矩形弯成浅曲面，镜头开始绕中心走 | 固定顶点、格子与墨线 |
| 6.2–7.15 s | 几何和相机同时停留 | 可读的中间态 |
| 7.15–9.6 s | 曲面继续卷成开口纸拱，机位绕向另一侧 | 固定接触线与中心 |
| 9.7–10.4 s | 小型空间坐标逐步进入 | 同一房间尺度 |
| 10.4–13 s | 完整空间对象静止，供讲解收束 | 无新动作抢注意力 |

卡片是程序绘制的轨道、远山、波纹图形，没有外部图片依赖。它们的纹理与纸面纤维在创建时使用固定种子，动画期间不重新随机采样。

## 表面与材质约定

网格为 32×20 个单元，693 个顶点、1280 个三角形。每个顶点始终保留 `id,index,parentId,uv`，拓扑不变。局部 X 跨纸张宽度，Z 沿纸张深度，Y 向上；宽度 6.4、深度 4.2，均为未标定的演示世界单位。

对 `x=(u−.5)W`、`a=(u−.5)θ`，形变为：

```text
X = x sin(a) / a
Y = x (1 − cos(a)) / a
Z = (v − .5) D
```

零点采用解析级数，避免除零和突然跳动。`θ` 从 0 到 1.8 rad，停留后再到 4.5 rad，始终小于 2π，因此不会闭合交叉。解析表面的局部弧长保持，离散网格以短弦近似。纸面中心的接触母线不动。

这是解析可展曲面的教学表现，没有求解弹性、弯曲刚度、碰撞或真实布料动力学。不能把 4.5 rad 的演示弯曲当成某种纸张材料的真实实验结果。

纸面有固定纤维、低对比网格和同一条墨线。纹理以 UV 映射到每个三角形，背面用较淡的图案；明暗读取实际变形法线与固定方向光。所有纸面和卡片三角形进入同一深度队列，卡片不会始终盖在纸面最前层。

## 投影与影子

`projectedPaperScene(state)` 返回透视相机、投影三角形和全局深度排序。渲染使用 Canvas 分片纹理映射，不是 WebGL 光栅器或光追。

接触影子由变形后的实际网格顶点沿 `LIGHT_DIRECTION` 投到固定地面，再绘制到离屏遮罩。低高度网格形成较紧的接触层，整体投影形成较软的外层。透明度在组合遮罩时统一应用，重叠网格不会逐个重复叠成一坨黑色。

这比跟画面走的固定椭圆具有正确的位置关系，但仍是方向光平面阴影近似，不含光追软阴影、物体间自阴影、真实多次反射或物理景深。需要真实资产时可将同一顶点/UV 数据移到 Three.js 或 Blender。

## 状态 API

```js
samplePaperSpace(t) => {
  time,duration,phase,evidence:'illustrative',
  parent:{id,position,yaw},
  vertices:[{id,index,parentId,uv,local,world,normal,shadow}],
  topology:[{id,vertices:[i0,i1,i2]}],
  cards:[{id,parentId,origin,target,progress,travel,lift,
          local,world,yaw,corners,pattern}],
  bend,camera,orbit,stage,axisAlpha,reading,cardClear,
  light,fixedAnchor
}
```

导出的 `surfacePoint(u,v,theta)`、`surfaceNormal(u,theta)` 和 `shadowProjection(point)` 可直接用于附着标签、标点或替换程序图案。附着内容应从 UV 读位置，禁止另用屏幕坐标动画假装它在跟纸面运动。

## 验证

```powershell
node research/motion_atelier/scripts/test_paper_space.mjs
```

报告保存到 `qa/paper-space.json`。检查包括顶点/UV/父层身份、局部长度、非退化三角形、开口截面不自交、卡片先退场、真实顶点投影阴影、共享深度排序、投影安全区、读数时机位与几何静止、任意 seek 和阶段速度连续。

数值检查不代替浏览器审美检查；纹理清晰度、边缘接缝、透明层效果应在最终输出尺寸下审看。任何把时间压缩后的版本都需要重新检查阅读停留。
