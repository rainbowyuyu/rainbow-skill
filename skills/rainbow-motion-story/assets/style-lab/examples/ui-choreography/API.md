# UI 编排：同一对象与动作因果

这是两段原创、可随机定位的 Canvas 2D 编排样例，入口为 `lab/modules/ui-choreography.js`。两段均为 14 秒，默认静音，不依赖外部素材、网络、动画库或 `node_modules`。

学习来源：MAX 品牌动画制作的 [UI 流畅动效参考](https://v.douyin.com/urFTmKPCLkg/)。本模块借鉴从连续截图能确认的对象交接、界面倾斜与收正、点击到时间线的因果编排。没有复制 Vaultex 品牌、界面素材、图片、原文案或音轨，也不根据静态截图推断音效。完整学习记录与原片证据由主工作台管理。

## 候选与时间安排

| id | 关键动作 | 可读停顿 |
|---|---|---|
| `ui-identity-relay` | 0–2.4 秒辨认和选择；2.4–5.2 秒跨容器移动；7.2–10 秒从工作区展开详情 | 5.9–7.2 秒确认；10–14 秒读细节 |
| `ui-click-to-timeline` | 2.4 秒点击；3–5.6 秒素材落到播放头；8.4–11 秒倾斜界面收正 | 6.2–8.4 秒确认；11–14 秒读结果 |

这里没有每个元素都抢着入场：一个资产承担连续性，一次按钮动作给出一个结果，后续信息在结果稳定后出现。

## 使用

```js
import { candidates, draw, sample, projectPoint } from '../../lab/modules/ui-choreography.js';

const id = 'ui-click-to-timeline';
const state = sample(5.6, { id });
draw(canvas.getContext('2d'), 5.6, canvas.width, canvas.height, { id });

// 可以由视频帧号、滑块或滚动位置决定时间；不要累加动画物理状态。
const seconds = frame / fps;
draw(ctx, seconds, 1920, 1080, { id });
const topOfClipInScene = projectPoint(state.transform.matrix, [
  state.hero.box.x, state.hero.box.y
]);
```

`candidates` 是冻结的元数据数组，每项含 `id/title/description/duration/usage/referenceId/boundary/readWindows`。`sample()` 默认返回第一候选的第 0 秒。时间单位为秒；有限时间夹在 `[0,14]`，未知 id 抛出 `RangeError`，`NaN/Infinity/字符串` 时间抛出 `TypeError`。`draw()` 同样使用这一契约，宽高必须为正有限数。

绘制使用 1600×900 逻辑画布。其他长宽比等比留边，避免把卡片、字体拉伸。函数保存并恢复调用者的 Canvas 状态，在物理像素画布上清屏，返回该帧的采样状态。没有自动循环；需要循环时由调用者决定最后一帧到第一帧的切换方式。

## 可验证状态

| 字段 | 含义 |
|---|---|
| `time/duration/id` | 夹取后的绝对时间、时长、候选 ID |
| `phase/phaseIndex/readWindow` | 当前可读阶段、阶段索引、是否位于阅读停顿 |
| `hero.id` | 始终为 `sea-breeze-06` 的同一资产 |
| `hero.box` | `{x,y,width,height}`，当前资产的连续几何 |
| `hero.parentId` | 当前归属容器；跨容器飞行时为 `overlay` |
| `hero.representationCount` | 固定为 1；原位置保留的框只是空占位，不是另一份资产 |
| `representations` | 只有一个 hero 的显示清单；可供合成器做重复对象检查 |
| `masks.hero` | 真实使用的圆角矩形裁切，含 `box/radius/coordinateSpace` |
| `panels` | 面板的 ID、外框和透明度 |
| `transform.matrix` | Canvas 格式 `[a,b,c,d,e,f]`；`projectPoint` 使用同一矩阵 |
| `events` | 截至当前时间已发生的累计事件描述，不会触发回调 |

第一段另外返回 `flight/focus/libraryAlpha/slotAlpha/inspectorAlpha/confirmationAlpha`。第二段另外返回 `flight/settle/cursor/button/playhead/ruler/placeholderAlpha/placeholderLabel/explanationAlpha/confirmationAlpha/clipCommitted`。播放头秒数、时间标签和标尺位置使用同一映射。

源位置的占位文案按实际事件变化：3 秒起飞前为空；3–5.6 秒显示“正在移入”；5.6 秒提交后才显示“已在时间线中”。中部解释在 2.4–3 秒退场，飞行期间透明度为零，5.6–6.2 秒落位后恢复，避免卡片掠过时压住解释文字。

第一段的坐标空间为 `scene`；第二段为 `editor-local`。第二段的面板、资产、裁切、指针与播放头在同一个父级矩阵内绘制，不能只把资产或播放头单独变换。最终片段左边缘严格落在 `playhead.x = 824`，而不是在屏幕坐标中估算一个接近的位置。

倾斜采用二维旋转、剪切与缩放；它不是三维透视相机。收正后矩阵为严格单位矩阵，字体回到正面阅读。

## 交接和曲线

所有连续过渡使用五次 minimum-jerk 曲线 `q³(6q²−15q+10)`，两端速度、加速度均为零。第一段只连续改变同一个 hero 的位置和尺寸；第二段增加小幅上拱轨迹，随后压扁为时间线片段。四条海浪弧线作为共同视觉特征，压缩时仍能认出同一个素材。

裁切采用三步交接：先在原位置打开 overlay 裁切，移动对象，再在目标内收拢裁切。`parentId` 改变前后的几何与裁切一致，没有瞬移和半截消失。采样无需上一帧；拖到任意时刻、反向播放或离线逐帧输出都使用同一结果。

`events` 是状态，不是一次性事件总线。若调用者绑定音效，必须自己检测向前跨过事件时间；随机 seek 和反向播放不应自动重触发。本轮没有音效样例或听审结论。

## 迁移到视频的选择

- 展示素材归属变化：用 `ui-identity-relay`。保留对象的色彩、名字和一个形状特征，先让观众认出，再移动。
- 展示按钮/算法输出：用 `ui-click-to-timeline`。让结果在明确目标点出现，随后给阅读停顿。
- 想增加冲击力：先缩短辅助元素入场，再增加主对象运动距离；不要同时加大所有元素的弹性。
- 需要讲信息：保持文字的最终正面姿态，把倾斜留在导航阶段。这个模块不做故意抖动、常驻光晕、背景微动画或无因果飘浮。

## 检查

```powershell
node research/motion_atelier/scripts/test_ui_choreography.mjs
```

测试覆盖两个候选的身份唯一、端点、时间夹取、非有限输入、任意顺序寻址、返回值修改隔离、父级交接几何、裁切包含、边界速度连续、目标播放头对齐、共享变换和最终阅读停顿。Canvas 调用检查仅验证状态栈与裁切契约，不代替真实浏览器的视觉检查。
