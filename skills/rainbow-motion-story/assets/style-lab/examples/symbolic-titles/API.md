# 象征片头：三个可复用的原创结构

打开 [工作台](../../lab/symbolic-titles.html)。三个候选都是 20 秒，可以保持同一秒数切换比较、逐帧检查、输入精确秒数、换片名，导出当前 PNG 和镜头约定 JSON。

它们借鉴的是轮廓线索、负空间和双世界的叙事方法，画面和程序图形是本项目原创。没有使用参考片的画面、配乐或人物资产。关于指定作品和《喜鹊谋杀案》正式片头的区别，见 [来源研究](../../studies/magpie-title.md)。

## 三种机制

| ID | 实际实现 | 适用问题 |
| --- | --- | --- |
| `outline-relay` | 最后一页的四边形顶点连续形变为灯塔主体；其他纸页退出；灯窗圆形遮罩扩大，露出下一片海 | 如何沿一个物件从小尺度走到大尺度 |
| `negative-space` | 有门框的入口打开，灯塔停留供识别；以灯窗为支点推进；窗口内已有下一场景，再扩大占满画面 | 如何藏住全貌，让观众先辨认再进入 |
| `dual-world` | 纸面和海面共享同一纸舟位置；移动边界切换对象所处世界 | 如何呈现同一个对象在模型与实体中的联系 |

轮廓近似只提供视觉联系，不能替代内容里的真实因果。三套候选共享片名落定后的阅读窗口：16.7–20 秒。纹理固定在物体或场景坐标里，不逐帧重新随机生成。

## 最小接入

无需安装依赖。使用支持 ES modules 的静态服务器，模块为 `lab/modules/symbolic-titles.js`。

```js
import {
  drawTitleSequence,
  sampleTitleSequence,
  buildTitleSelection,
  DURATION,
} from './lab/modules/symbolic-titles.js';

// t 是绝对秒数；也可直接使用 frame / fps，支持倒放和随机定位。
const state = drawTitleSequence(ctx, frame / 30, 1600, 900, {
  variant: 'negative-space',
  title: '未写完的航线',
  anchors: false,
});

const shot = buildTitleSelection(9.4, 'negative-space', {
  title: '未写完的航线',
});
```

`sampleTitleSequence(t, variant, options)` 是纯状态函数，返回形变进度、门的开度、窗口推进、遮罩半径、窗内新世界的独立二维变换 `incomingWorld`、纸舟位置、片名状态和音效事件建议。超出 0–20 秒的有限时间会钳制到边界，非有限时间按 0 秒处理。未知候选回退到 `outline-relay`。

`drawTitleSequence(ctx, t, width, height, options)` 绘制并返回同一状态，并新增 `renderedTitle`：实际片名位置、测量字号、测量宽度与透明度；未出现片名时为 `null`。设计画幅是 1600×900；保持 16:9 输出可避免拉伸。`title.maxFontSize` 是 72px 的设计上限；实际绘制会按当前字体测量结果缩小，最长支持 36 个字符串单位。中文片名可编辑，英文副标题目前固定为 `THE UNWRITTEN ROUTE`。

`buildTitleSelection(...)` 返回 `motion-atelier.symbolic-titles/v1` 镜头约定：候选、段落、时长、取舍、色板、共同线索、阅读窗口、当前状态和实现入口。它不是视频文件，也没有自动写入其他工程。

## 时序与接缝

- 负空间：0.4–4.8 秒开门，4.8–6.4 秒识别停顿，6.4–9 秒进入灯窗，9–9.8 秒第二次识别停顿，9.8–13.4 秒扩大窗口。
- 轮廓接力：纸页展开并排成台阶，6.1–9.8 秒最后一页形变为灯塔，9.8–13.2 秒灯窗向海面接力。
- 双世界：4–12.8 秒边界越过画面；纸舟在两侧的坐标和比例始终一致。
- 全部候选：14.7–16.7 秒片名进入，16.7–20 秒片名的位置、字号上限和透明度保持稳定。

片名出现时仍保留小纸舟作为上一段的视觉余韵；没有使用持续的文字抖动或故障闪烁。

负空间的窗口不是直接截取全幅海面的同一个坐标：窗内先把海、太阳与纸舟缩成可识别的构图，以青色填充圆形裁切的边缘。窗口扩大时，独立的 `incomingWorld` 变换连续恢复到最终全幅坐标，避免观众先看到一块纯色圆，再突然出现新世界。

## 声音与交互

模块提供 0.5、7.7、11.8、16.7 秒的音效事件建议：纸张起势、结构落定、空气穿越、片名收束。**当前页面没有音频合成或播放。** 正式配乐应按内容和听觉检查调整，不要把每一个视觉变化都配一个响声。

工作台支持播放、暂停、0.5/1/1.5 倍速、范围滑块、精确秒数输入和段落跳转。Canvas 获得焦点后，空格切换播放，左右键前后逐帧，Home/End 到两端。减少动态效果会停止自动播放，保留人工定位。

## 验证与边界

```powershell
node scripts/test_symbolic_titles.mjs
node --check lab/modules/symbolic-titles.js
node --check lab/symbolic-titles-studio.js
```

自动检查覆盖连续状态、识别停顿、有限绘图坐标、Canvas 状态配对、反向定位确定性、片名阅读窗口和导出完整性。检查结果写入 `qa/symbolic-titles-data.json`；浏览器视觉检查需另行记录。

这是 Canvas 2D 的图形预演。门和灯塔是平面绘制，推镜是二维画面变换；不是三维场景重建、物理仿真或光追。它也没有完整复现参考作品的所有镜头。可用于确定叙事机制和节奏，再把相同的绝对时间轨道接入 Three.js、Blender 或视频渲染流程。
