# 金属与电子封装：三个原创 WebGL 片段

以有厚度的几何、环境反射和真实深度关系学习材质与结构。代码不复制原片模型；芯片数量、孔位、尺寸比例和运动时间均为本例示意，不能用于制造或电学计算。

## 打开与调用

使用已构建的 glass-package.bundle.js（外部或本机资源，未随公开包收录），无需复制或安装 `node_modules`。工作台为 [金属与电子研究室](../../lab/glass-metal.html)。

```js
import {createScene, sample, candidates, duration}
  from './glass-package.bundle.js';

const view = createScene(canvas);
view.resize(1600, 900);
const result = view.render(12, {
  id: 'metal',       // metal | stack | route
  roughness: .27,   // clamps to 0.12–0.68; changes copper and gold
  orbit: 0,         // camera-angle adjustment, radians
});
// result.labels: {id, text, x, y, depth, visible, occluded, anchor}
// x/y are normalized canvas coordinates; apply text in a separate HTML layer.
view.dispose();
```

`duration=24`。`sample(t,{id,roughness,orbit})` 为无副作用、可逆序的绝对时间采样，返回 `phase/caption/focus/camera/groups/separation/labels/pulse/reading`。`createScene` 不自行启动时钟；由工作台或影片逐帧调用 `render`。切换候选只切换同一场景内的显示组，不累积生成模型。

`render` 返回采样状态，并将标签投影为归一化画布位置；`visible` 表示位于屏幕可视范围内，`occluded` 是与不透明几何的光线检测。遮挡标签应隐藏或放到侧边，不能把隐藏部件的文字贴在前景零件上。玻璃不参与标签遮挡检测，标签是否足够清楚仍需按镜头检查。`stats` 给出调用数、三角面数、渲染尺寸和实现范围。

`resize(w,h)` 设置实际渲染像素，像素比固定为 1 以使输出尺寸和性能可控；容器缩放可由 CSS 完成。渲染器启用抗锯齿与 `preserveDrawingBuffer`，可在绘制后用 Canvas 的 PNG 导出。初始化失败应显示 WebGL 错误，不用静图冒充运行结果。

## 三个候选怎样不同

| ID | 24 秒内的安排 | 适合的问题 |
|---|---|---|
| `metal` | 总览 → 3–8 秒靠近铜线 → 8–17 秒微距掠过 → 17–23 秒返回 | 看清倒角、金属暗侧和高光，比较粗糙度 |
| `stack` | 整体 → 3–8 秒沿 y 轴分离 → 8–18 秒固定观察 → 18–23 秒回装 | 说明芯片、布线层、玻璃芯、焊点的层级 |
| `route` | 0–5 秒先看通路 → 5–19 秒沿铜线与通孔追踪 → 结果保留、21–22 秒退去 | 说明导体穿过绝缘基体，区分路径与材料 |

三个候选不靠换色区分。玻璃芯通过带孔轮廓挤出，通孔内有铜圆柱；`route` 将玻璃截面推进至前景通孔轴线，用开口半圆槽暴露铜柱；镜头从截面一侧观察，使下层路线可见。金属候选近景只放大少量铜线，避免密集细线产生摩尔纹。拆解偏移以装配位置为基准，所有部件沿同一轴移动，装回后回到原坐标。

## 材质与灯光

渲染使用 Three.js 0.183.0：

- 铜、金色接触面和焊点使用金属 PBR，保留较暗侧面与宽窄反射。当前铜使用各向同性反射，没有声称提供真实拉丝。各向异性试验在倒角几何与透射组合中出现黑色伪影，已通过同帧隔离比较停用；保留金属反射和粗糙度，不用随机噪点伪装拉丝。
- 环境反射来自代码生成的宽、窄棚拍光板，经 PMREM 预过滤；环境固定在世界中，相机移动时反射自然变化。主光与填光的色温略有差别。
- 芯片、介质和玻璃使用不同材质参数。硅片外观使用带金属感的艺术参数（`metalness=.55/.7`），用于区分表面，不是硅材料实测光学常数。玻璃有实际厚度、孔与边缘，采用 `MeshPhysicalMaterial` 透射；透射属于实时近似，不能当作光线追踪或精确折射测量。
- 孔和铜柱读取同一份 `packageVias/cutawayVias`；焊球上下接触面由 `contactPlanes` 约束，避免铜柱穿过未打孔玻璃或焊球扎进基板。实体遮挡由 WebGL 深度缓冲处理。地面承接柔化阴影；阴影来自 PCF shadow map，不是光追。模型边缘有小倒角，反射不靠把所有表面提高到白色。
- 电容的银色端帽包覆缩短的陶瓷体，可见端面与侧面保持间距，避免共面深度冲突产生闪烁或棋盘纹。端帽与陶瓷的连接是隐藏搭接，不是把两层同尺寸表面叠在一起。
- 发光标记只是路径说明。它沿导体的折线弧长行进，并有淡入淡出；不表示电子的实际速度、大小或金属自身会发光。其局部光仅用于提高标记的辨识度。

## 修改与复建

可维护源码分为 [纯状态](../../lab/modules/glass-package-state.js) 和 [渲染器](../../lab/modules/glass-package-renderer.js)。修改几何、导体线路或孔位时，状态中的 `routePoints`、标签锚点和实际几何必须一起核对。

```powershell
node scripts/build_glass_package.mjs
node scripts/test_glass_package.mjs
```

构建脚本使用既有共享目录 `video_project/shared/node/` 内的 Three.js 与 esbuild；可用 `MOTION_SHARED_NODE` 指定该父目录。它只输出约 560 KB 的浏览器 bundle 和 Three.js 许可，不复制 `node_modules`。具体共享包 ID 在脚本中明确列出，若环境迁移应修改此映射。第三方许可见 [THREE-LICENSE.txt](THREE-LICENSE.txt)。

状态测试覆盖倒序采样、镜头连续性、拆装顺序、停留窗、导体路线和信号淡出，并检查铜柱与孔的间隙、焊点接触高度、端帽包覆间距，以及最终倒角玻璃的实际包围盒和有限几何属性。它不替代浏览器中的反射、穿模、标签和材质审美检查。这里没有电磁仿真、电子轨迹仿真、热应力计算，也没有声轨。
