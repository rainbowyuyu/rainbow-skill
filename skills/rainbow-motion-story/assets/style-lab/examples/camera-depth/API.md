# 焦点与空间：移焦、追焦、侧移揭示

[工作台](../../lab/camera-depth.html)用同一套原创展陈比较三个镜头：近景悬挂铜片、中景青瓷圆环与底座、远景三座石板门框。物件不随镜头移动，身份与世界坐标固定。

| ID / variant | 默认动作 | 时间 |
|---|---|---|
| `camera-focus-handoff` / `handoff` | 固定机位，从近景向中景移焦 | 2—5.5 s |
| `camera-focus-track` / `track` | 斜向推进，同时追踪中景锚点的光轴深度 | 2—9.5 s |
| `camera-parallax-reveal` / `parallax` | 平行侧移，前景让开同一个中景 | 2—9.5 s |

三个候选都为14秒，`loop:false`。共同章节时间为 `[0,2,5.5,9.5,11.5]`，11.5—14秒为稳定读图。它们提供可选方法；不同候选的首尾机位没有自动连接。

## 最小接入

依赖只有 `lab/modules/camera-depth.js` 与已有的 `common.js`，不新增 node_modules。

```js
import {candidates} from './lab/modules/camera-depth.js';
const shot = candidates.find(c => c.id === 'camera-focus-track');
const options = {
  focalLengthMm: 50,
  fNumber: 2.8,
  focusMode: 'directed',
  manualFocusM: 8,
  depthMode: 'dof',
};
const t = frame / fps;
shot.draw(canvas.getContext('2d'), t, 1600, 900, options);
const state = shot.sample(t, options);
```

`sample` 和 `draw` 使用绝对秒数；负数与无效时间归零，超过14秒保持末态。乱序定位不依赖上一帧。

| 参数 | 默认值与有效域 | 影响 |
|---|---|---|
| `focalLengthMm` | 50；28—85 mm | 固定机位下改变取景范围与CoC，不自动退远补偿 |
| `fNumber` | 2.8；1.4—16 | 薄透镜孔径比；预览保持曝光不变 |
| `focusMode` | `directed` | 可选 `directed / near / hero / far / manual` |
| `manualFocusM` | 8；2—24 m | 仅manual时使用，固定沿光轴的焦平面距离 |
| `depthMode` | `dof` | `sharp`只关闭分组虚化，不改几何、机位、焦点或CoC |

`directed`执行候选默认设计；`near/hero/far`每帧锁住相应世界锚点，距离随相机更新。样例关闭主库的强度与配色旋钮，避免比较时同时改动另一种条件。

## 状态与导出

```ts
type State = {
  time: number;
  variant: 'handoff' | 'track' | 'parallax';
  stageIndex: number;
  annotation: string; // 覆盖对焦模式时，也改为实际锁定对象
  camera: {
    position: [number,number,number]; // m
    target: [number,number,number];   // m
    roll: number;                   // 当前候选为0
    fov: number;                    // 垂直角，degrees
    focalLengthMm: number;
    sensorHeightMm: 20.25;
    sensorWidthMm: 36;
    fNumber: number;
    focusDistance: number;          // 光轴深度，m
    principalPoint: [0.5,0.52];
  };
  focus: {
    mode: string;
    anchorId: string;
    anchorPosition: [number,number,number];
    depthM: number;
    distanceKind: 'axial';
    lensImageDistanceMm: number;
  };
  objects: Array<{
    id: 'copper-leaf' | 'ceramic-orbit' | 'slate-portals';
    layer: 'near' | 'hero' | 'far';
    position: [number,number,number];
    depthM: number;
    cocMm: number;                  // 传感器上的非负直径，不截断
    cocPx: number;                  // 900px参考输出的直径，不截断
    cocReferenceHeight: 900;
    blurPx: number;                 // min(24,cocPx/2)，预览映射
    previewBlurPx: number;          // 同blurPx
    previewBlurClamped: boolean;
    projected: {x:number;y:number;depth:number;scale:number;visible:boolean};
  }>;
  readHold: boolean;
  geometryStable: boolean;
};
```

`focus.anchorId`是锚点身份，通常为`copper-leaf/focus`等，不等于物件ID。对应关系在`ANCHORS`中，例如 `ANCHORS.hero.objectId === 'ceramic-orbit'`。移焦途中使用`near-to-hero-focus`与连续插值位置；手动焦平面使用`manual-focus-plane`，位于相机光轴上。

工作台JSON包含0—14秒、30fps的421个采样点。14秒视频渲染0—419共420帧，最后一个采样点是14秒端点，用于核对和衔接。末端校验点不额外延长视频。

长焦时，前景悬挂线与部分背景上下文可以跨出画框，以形成有意的前景遮挡；中景主体圆环在支持的焦距与整段机位内保持在安全区域。前景铜片没有为揭示而平移，后景也没有靠透明度动画假装出现。

## 光学函数

```js
import {
  resolveOptions, sampleCameraDepth, drawCameraDepth,
  focalLengthToFov, thinLensImageDistanceMm,
  circleOfConfusionMm, circleOfConfusionPixels,
  opticalDepth, cameraBasis, makeProjector,
  SCENE, ANCHORS, MESHES, STAGE_TIMES,
} from './lab/modules/camera-depth.js';

focalLengthToFov(focalLengthMm, sensorHeightMm = 20.25); // 垂直度数
thinLensImageDistanceMm(objectDepthM, focalLengthMm);    // 像距mm
circleOfConfusionMm(objectDepthM, focusDepthM, focalLengthMm, fNumber);
circleOfConfusionPixels(cocMm, outputHeight = 900, sensorHeightMm = 20.25);
opticalDepth(pointInWorldMetres, camera);               // 正向光轴深度m
cameraBasis(camera);                                  // forward/right/up
makeProjector(camera, width = 1600, height = 900);      // point→投影
sampleCameraDepth(time, variant = 'handoff', options = {});
```

世界坐标、物方深度、焦深使用米。进入薄透镜计算时，`s,z`各乘1000；焦距、传感器尺寸和CoC本来就是毫米，不再转换。低层光学函数对非正、非有限值，或`z/s`不大于焦距的情况抛出`RangeError`。`opticalDepth`保留负深度，投影器将相机后方点标为不可见，不把负值取绝对值变成前景。

```text
F = normalize(camera.target − camera.position)
z = dot(object.position − camera.position, F)
s = dot(focusAnchor − camera.position, F)

v(z) = f*z / (z−f)
c = f²*abs(z−s) / (N*z*(s−f))        // 此行所有长度为mm
c_px = c / sensorHeightMm * outputHeight
fovY = 2*atan(sensorHeightMm / (2*f))  // 转为角度
```

例如物体在3m，焦平面在8m，50mm、f/2.8时，CoC约0.18718mm；对焦到3m后该平面的CoC为零。相同机位、焦距、焦点和亮度下，f-number翻倍使CoC减半。传感器高20.25mm来自36mm横幅的16:9裁切，不适用于所有输出画幅。

`drawCameraDepth(ctx,t,w,h,options,state,variant)`可接入已经采样的同一状态。比较时这样调用，只改变渲染方式：

```js
const state = sampleCameraDepth(t, 'track', options);
drawCameraDepth(left, t, 1600, 900, {...options, depthMode:'dof'}, state, 'track');
drawCameraDepth(right,t, 1600, 900, {...options, depthMode:'sharp'},state, 'track');
```

## 换成自己的机构和接触点

展陈里的`hero`是示例锚点，不能把它的8米等数值直接复用到另一个机械模型。先用实际物体在当前帧的世界变换求接触点，再计算相机光轴深度。场景、相机和锚点必须使用同一帧、同一单位：

```js
// localContact是部件局部坐标；下面的Three.js对象由正式工程提供。
part.updateWorldMatrix(true, false);
const worldContact = part.localToWorld(localContact.clone());
const anchor = worldContact.toArray(); // 确认工程单位也是m
const pose = sampleCameraDepth(frame / fps, 'track', options).camera;
const focusDepth = opticalDepth(anchor, pose);
if (focusDepth <= pose.focalLengthMm / 1000) {
  throw new Error('当前接触点不在可对焦的前方区域');
}
// 将focusDepth接到正式DOF实现；不要继续使用展陈sample的focus.depthM。
```

镜头路径也需要按机构尺度、装配轴与遮挡重新设计，随后核对接触点在画框内且可见。不能仅换一个锚点，就认为展陈的运镜已经适合发动机剖面。

Three.js相机使用相同垂直FOV、位置与target；本库主点为`[0.5,0.52]`，要匹配取景偏移。普通`PerspectiveCamera`不会自动显示景深。内置`BokehShader.aperture`是艺术增益，不是f-number，需核对具体DOF pass的单位。Blender可显式使用36mm水平sensor fit、16:9输出与真实焦点Empty，再对照正式渲染。

## 预览边界与检查

光学关系来自薄透镜模型，Canvas画面按整个物体中心深度分组，以高斯滤镜预览失焦。`sigma≈c_px/2`与24px上限是预览选择，并非孔径点扩散函数的物理等价物。每个物体内部的深度、复杂交错遮挡、透明散射、焦外光斑、镜头呼吸、像差和衍射均未模拟。光圈变化时保持曝光不变，专门比较景深。

主体材质、软接触影和背景光为原创绘制，不是光追。HUD在分组景深之后绘制，保持清晰。参考运镜的学习记录与光学推导分别见 [运镜研究](../../studies/camera-depth.md)、[技术资料](../../studies/camera-depth-technical.md)、来源快照（外部或本机资源，未随公开包收录）与[选择指南](../../guides/camera-depth.md)。

```powershell
node scripts/test_camera_depth.mjs
node scripts/test_camera_depth_studio.mjs
```

模块测试用独立光锥推导校验CoC，检查单位、光圈关系、焦平面、实际三角形遮挡、逆深度视差、追焦、全部支持焦距的主体安全区、C1边界、相同状态清晰对照、离屏滤镜重置与任意顺序绘制。工作台测试执行真实处理器核对参数和421点导出。浏览器的清晰度、边缘漏色与观感由视觉检查单独记录。
