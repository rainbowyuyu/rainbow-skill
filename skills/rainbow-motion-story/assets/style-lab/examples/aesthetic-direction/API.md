# 同一个圆环的三种视觉方向

从[审美参考深入观察](../../studies/aesthetic-deep.md)提炼的原创代码练习。三种候选讲同一件事：**认识圆环 → 聚焦轮廓 → 看到材料与结构 → 回到完整物件 → 稳定阅读**。没有复制原视频画面、品牌、音轨或源码，也不把参考中的视觉隐喻解释为真实物理过程。

源码：[aesthetic-direction.js](../../lab/modules/aesthetic-direction.js)。仅依赖现有 `common.js`，不新增依赖。背景、构图、光线与对象绘制独立实现，没有沿用公共科幻地面网格。

```js
import {
  candidates,
  sampleEditorial, drawEditorial,
  sampleIndustrial, drawIndustrial,
  sampleOrbital, drawOrbital,
  FACTS, STAGE_TIMES
} from '../../lab/modules/aesthetic-direction.js';

// 三个候选使用相同的时间单位和故事阶段。
const selected = candidates.find(c => c.variant === 'industrial');
selected.draw(ctx, 6.9, 1600, 900);
const state = selected.sample(6.9);

// 也可直接使用独立接口：draw(ctx, time, width, height, options)。
drawEditorial(ctx, 7.7, 1600, 900);
console.log(sampleEditorial(12).readHold); // true
```

| 候选 | 视觉方向 | 建议预览 | 时长 |
|---|---|---:|---:|
| `look-editorial-cutaway` | 纸白左右分栏、朱砂小焦点、六十度剖块 | 7.7 s | 14 s |
| `look-industrial-focus` | 顶部横排、右下斜向金属近景、左下说明 | 6.9 s | 14 s |
| `look-orbital-return` | 中轴暖色曲面、顶部标题、底部短句、尺度收回 | 10.1 s | 14 s |

三者均属于 `look`，`loop:false`。`variant` 分别为 `editorial / industrial / orbital`。它们的区别是构图、光线、尺度与节奏组织，不是给同一个画面替换三套颜色。通用强度与色板控件关闭，避免选择看似生效却不改变候选。

## 相同的内容与时间契约

阶段起点统一为 `[0, 2.1, 4.5, 8.4, 11.4]`，和 `stages` 一一对应。三套的物件在同一故事阶段执行不同的呈现动作，因此同一时刻可以对比，但不能称为逐像素的同一姿态。

全部采样由绝对秒数驱动。负时间、非有限值回到 0；大于 14 秒保持末态。无需先播放之前的帧，支持任意 seek。全部位移与尺度衔接采用五次缓动，尺度推进使用对数插值。

`sample*(time)` 返回：

- `time / variant / stageIndex / phase / annotation`：时间、候选与语义阶段。
- `objectId:'ring-01' / facts / objectParts`：固定对象与组件身份。
- `pose:{center,scale,rotation,sectionOffset,light,lightSweep,outline,materialReveal,macroAmount}`：可接入其他渲染器的表现参数。
- `readHold`：11.4–14 秒的结论停留；`geometryStable`：11.1 秒以后几何与相机停止。
- `title / explanation`：所有候选共同使用“看清一个圆环”和“轮廓 · 材料 · 结构”。
- `illustrative:true / physicalSimulation:false`：明确是视觉示意。

`FACTS`：外径 2.4、内径 1.28、厚度 0.32，8 枚固定件、60°分离扇区，单位统一为**设计单位**。这些是原创示意几何参数，不是某个真实产品的测量尺寸。任意风格都不改变这些数字。

## 模型与材料

共享模型是 120 段环向细分、带内外倒角的环体。扇区离开时露出真实截面封口，固定件与所属环体一起移动，不靠隐藏整个物件制造拆解。投影使用正交三维旋转，面按观察深度排序，并剔除背面。模型足够简单，避免把密集工程细节变成噪点。

材料使用面法线、宽幅软箱式渐变与少量连续边缘反光。黑场版局部推进突出材料；纸白版压低反差并拉开剖块；暖色版先放大真实存在的同一曲面，随后回收。阴影是柔和的接地视觉提示，**不是光线追踪或真实照明求解**。暖色圆弧是图形回声，**不是力线或计算出的物理场**。

同一字体、同一主标题，阅读区独立于相机，但三种版式骨架不同：纸白左右分栏；黑场将标题横向放在顶部，说明留在左下；暖色以中轴连接上方标题、中央物件与下方收束句。尺寸标签在只剩材料曲面的阶段淡出，完整物件回收后再出现。并未使用原片中难以阅读的密集微字。最终完整物件与全部关键内容保持静止。

参考原片中的太阳缩小和打火机微距之间有切镜，因此研究所说的接力是轮廓与视觉方向的押韵，不是证明源片所有镜头处在同一个物理空间。本候选故意选用同一个可核对的环件，实现自己的连续版本。

## 验证与适用范围

```powershell
node research/motion_atelier/scripts/test_aesthetic_direction.mjs
node research/motion_atelier/scripts/test_aesthetic_studio.mjs
```

检查对象和参数不变、截面尺寸、组件整体平移、末态完整归位、阶段边界连续、任意定位、稳定阅读窗口、实际 Canvas 调用的数值和重绘确定性。QA 写入 `qa/aesthetic-direction.json`。

工作台测试加载实际事件处理器和真实采样函数，核对同刻切换、三图并排、显示帧暂停、逐帧和阶段定位、灰度 PNG、JSON 状态、异步下载身份，以及阅读文档/后台/浏览器缓存恢复的行为。结果写入 `qa/aesthetic-studio.json`；绘制在该测试中仅记录调用，实际像素与下载需浏览器验收。

数值测试不证明画面好看，也不替代浏览器对材质、裁切、文字大小与播放节奏的检查。此模块用于短片头、章节转场和材料说明的候选比较；若表达真实工程受力，应将实际求解和表现层分开。
