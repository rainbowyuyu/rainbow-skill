# 机械按键：从一次按压到触点接触

`lab/modules/switch-anatomy.js` 提供两个 18 秒、`loop:false` 的原创教学候选。

| id | variant | 默认预览 |
| --- | --- | --- |
| `mechanics-switch-section` | `section` | 9.5 s：同一触点的局部视图 |
| `mechanics-switch-explode` | `explode` | 7.8 s：沿轴拆解 |

两者阶段节点均为 `[0,2,5,8,12,15]`。展示层在 18 秒时间线上显式计算 `press`，调用纯机构模块 `sampleSwitchMechanism(time,{press,explode:0})`。机构模块自身的 12 秒默认周期在这里不使用；`state.time` 是 18 秒展示时间，`state.mechanism.time` 仍采用核心的时间范围。

```js
import {
  candidates, sampleSwitchAnatomy, drawSwitchAnatomy,
  buildSwitchScene, frameSwitchState, makeSwitchProjector,
  visibleSwitchFaces,
} from '../../lab/modules/switch-anatomy.js';

const options = {press:0.25, cut:1, explode:0, focus:1,
  viewYaw:-0.52, viewPitch:0.42, labels:true};
const state = sampleSwitchAnatomy(6.5, 'section', options);
drawSwitchAnatomy(ctx, 6.5, canvas.width, canvas.height, options, state);
// 同样可用 candidates[0].sample(t, options) 与 .draw(ctx,t,w,h,options)。
```

## 参数与状态

| 参数 | 范围 / 默认 | 行为 |
| --- | --- | --- |
| `press` | 0–1 / 跟随分镜 | 总行程归一化输入；0 为释放，1 为压到底 |
| `cut` | 0–1 / 跟随分镜 | 前、左两面组成的教学壳盖沿外侧整体移开 |
| `explode` | 0–1 / 跟随分镜 | 展示零件沿装配轴的分离位置 |
| `focus` | 0–1 / 跟随分镜 | 从完整对象连续变为实际触点局部的相机目标与比例 |
| `viewYaw` | −0.75 … −0.12 rad / −0.52 | 前左侧有限观察域 |
| `viewPitch` | 0.25 … 0.60 rad / 0.42 | 俯视角 |
| `labels` | boolean / true | 显示局部间隙标注与拆解时五个零件标签 |

有限参数被限制到对应范围；未设置、`null` 或非有限覆盖值使用默认分镜/相机。非有限时间按 0，有限时间限制在 `[0,18]`。配色与 intensity 控件关闭。

俯视角上限 0.60 rad 用于保留按到底时的触点视线。更高角度下键帽会真实遮住接触部位；此例限制观察域，没有通过透明键帽或错误绘制顺序强行露出触点。

`sampleSwitchAnatomy` 返回：

- `time,variant,stageIndex,annotation,press,cut,explode,focus,labels`。
- `mechanism`：完整的核心状态，含位移、弹簧曲线、表面间隙、触点、斜面传动、力与参数。
- `parts`：七个稳定 ID：`base,housing,stem,keycap,spring,moving-contact,fixed-contact`。`operatingPosition,displayOffset,position` 是 `[x,y,z]` 数组；原始 `restPosition` 保持核心的 `{x,y,z}` 形式。
- `camera`：已完成取景的正投影相机，含 `yaw,pitch,target,scale,principalPoint,overviewScale,focus,stageBounds`。坐标为毫米、Y 向上，按压为 −Y；默认参考画布 1600×900。
- `operatingAssembly`：拆解是否为零；拆解状态只是展示，不代表分离后的零件仍构成可工作的电路。
- `sceneId,units,openingMethod,focusMethod,physicalPathTracing:false,productionGeometry:false`。

`cut`、`explode`、`focus` 和视角只改变展示，不重算按压状态。固定 `press` 后随意开壳、拆开或推近，核心中的弹簧长度、触点间隙、闭合状态和力均保持不变。两触片共用一个拆解位移；显示已闭合时不会把两个接触面视觉上拆成两处。

## 看得见的因果

默认原创参数为总行程 4 mm、触发行程 2 mm、初始触点表面间隙 0.6 mm。向下移动的键轴同时压缩回位弹簧并带动斜面，斜面驱动随动件与动触片；触点闭合后的过行程由理想柔性支路吸收。渲染直接使用核心提供的 `actuator.camProfile`、`followerProfile`、`supportPoints`、`compliance` 和触片曲线，不在画面上独立估计触点位置。

触点为两个半径 0.3 mm 的球形接触垫。`contact.fixedTip` 和 `movingTip` 是两者相向的**表面**，不是球心；`gapMm` 是表面间隙。闭合后两个表面重合，球心保持一倍直径间距，不互相穿入。

剖面候选在 5.1–7 秒连续推近触点，在约 7.2 秒首次闭合；观众能先看到非零间隙，再看到接触。释放时仍在局部视图中观察间隙重新打开，随后退回整体。局部视图使用同一世界中的触片、弹簧和壳体；没有替换成另一张示意图。推近后允许外围对象离开画框，但触点及附近传动支路保持在观察窗口中。

拆解候选先移开壳盖，再沿轴分离键帽、键轴、回位弹簧与触片组；回装完成后执行按压。直接调用采样 API 可检查不同显示组合，画面会标为拆解示意；工作台另加门控，先释放再拆解，先回装再按压。

## 渲染接口

`buildSwitchScene(state)` 返回不透明实体 `faces`、真实世界锚点 `landmarks` 和材质说明。实体包括有厚度的壳壁、弹簧连续线管、触片厚带、接触球、斜面与随动件，以及座、导向、紧固件等附属结构。壳壁分成小面片，避免大面以中心深度排序时错误遮住内部触点；接触球采用更密的曲面细分和连续法向着色。`visibleSwitchFaces(scene,camera)` 根据当前视角进行背面剔除与全局面深度排序。有限视角域内的多边形排序不等同于通用三维碰撞/遮挡证明。

`frameSwitchState(state)` 计算已在 `state.camera` 中保存的最终相机；它使用覆盖实体的固定装配包络完成整体取景，再连续插值到真实触点目标，不需要为了 JSON 导出生成全部网格。接入方直接保存 `state.camera` 即可。`makeSwitchProjector(camera)` 将 `{x,y,z}` 或数组点映射为 `{x,y,depth,scale}`；深度越大越接近观察者。

```js
// 18 s、30 fps：541 个状态点包括 t=18 s 终点；视频采用前 540 帧。
const samples = Array.from({length:541}, (_,frame) => {
  const t = frame / 30;
  const s = sampleSwitchAnatomy(t, 'section', options);
  return {frame,time:t,press:s.press,cut:s.cut,explode:s.explode,focus:s.focus,
    camera:s.camera,parts:s.parts,travelMm:s.mechanism.travelMm,
    contactGapMm:s.mechanism.contact.gapMm,closed:s.mechanism.contact.closed};
});
const videoFrames = samples.slice(0,540);
```

这是受 Anatomy 技术插图方法启发的原创 Canvas 实现，学习实体层次、统一明暗、装配对应和读数共用模型；未调用上游 SVG kit。尺寸和弹性常数为原创教学设定，不对应具体品牌开关或生产 CAD；核心没有触点弹跳、迟滞、摩擦、惯性、电负载或有限元求解。着色是正投影多边形材质近似，不是路径追踪。

验证运行 `node scripts/test_switch_anatomy.mjs`，结果写入 `qa/switch-anatomy.json`。测试检查有限分镜、物理/展示独立性、相机进入局部的时机、实际表面间隙投影、极限视角的整体取景、斜面支路网格，以及真实 Canvas 命令的有限值与随机跳转一致性。纯机构公式另由 `test_switch_mechanism.mjs` 验证。
