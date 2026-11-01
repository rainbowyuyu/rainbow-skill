# 字粒入轨，句子落定

源码：`../../lab/modules/motionface-kinetic.js`。

来源方法：用户授权访问的 Motionface **Focus · Kinetic Typography | Remotion 复刻**中，2.6–3.4秒的字母圆片从环形收束到短句。研究以5fps、90帧接触表和6张原尺寸关键帧为证据，见 `../../studies/motionface-focus.md`。未读取付费源码、未复制源素材、未听审音轨；这是原创中文方法复现，不是原片移植。

## 使用

```js
import { candidates, motionfaceKineticDefaults, sampleTypeOrbitLock,
  drawTypeOrbitLock, layoutTypeOrbitLock, partitionOrbitText
} from '../../lab/modules/motionface-kinetic.js';

const clip = candidates[0];
const options = { palette: 'paper', intensity: .65,
  headline: '先看变化，再看关系。',
  kicker: '散开的线索，也能连成一句话',
  result: '字落稳了，意思才站得住。', reducedMotion: false };
clip.draw(ctx, 9.6, canvas.width, canvas.height, options);
const state = clip.sample(9.6, options);
const geometry = layoutTypeOrbitLock(ctx, state);
```

ID：`mf-type-orbit-lock`。14秒有限镜头，末帧不循环。默认8个字粒组，保留逗号和句号；完整内容按阅读顺序拼回仍等于输入文案。

## 编排与阅读

| 时间，tempo=1 | 动作 | 用途 |
| --- | --- | --- |
| 0–2.25s | 字粒进入环阵，有限的小幅转向 | 引起注意、先看“这些东西” |
| 2.25–5.25s | 环阵按最终阅读位置连续归位 | 看清同一信息如何被组织 |
| 5.25–7.05s | 边界退去，字句留在稳定基线 | 从物体感过渡到可读句子 |
| 7.05–9.15s | 短线完成接力，结论进入 | 为下一句保留空间 |
| 9.15–14s | 所有主体停止运动 | 完整解释关键内容 |

推荐审片：0.8、2.2、3.2、4.8、6.5、8.5、10.5秒。特别看归位中间帧，不能用模糊掩盖字粒穿插；本例未使用拖影，字体落定后不漂移。

## 参数与长文

沿用 `normalizeMotionfaceOptions()`：paper/lime/coral三配色、旧palette兼容、intensity、reducedMotion、headline/kicker/result；独立界面若已用时钟控制播放速度，则不要再传内部tempo。直接函数默认paper，通用candidate包装器缺省palette会映射到lime，建议明确传值。

完整文案最多180字符，不通过省略号删字。分行优先使用 `Intl.Segmenter('zh', {granularity:'word'})` 的词边界，使“真实”“清楚”等词保持完整；“的/地/得”及其前后短词还会合为一个依存短语，例如“真实的对象”“清楚的结论”，避免将一个孤立的“的”放到行首。这是有限的阅读规则，不是完整句法分析。在这些边界中优先考虑标点与较均衡的2–6行，再把每行拆成可运动的字粒组，**总计不超过12组**。因此短句仍有字粒环阵，长句不会为了均分字数从词的中间断行。落定排版按实际字宽选统一字号，所有标点保留；中文科普推荐8–24字，工作台48字以内主要为2–3行。

若运行环境缺少语言分词、分词器抛错或不能原样拼回输入，则安全退到标点分句；很长且无标点的片段再按有界码点块分组，保证不丢字、不超出画面，不把这个回退说成真正的中文分词。API边界的长句在环阵阶段不适合逐字阅读，真正阅读安排在最终多行排版阶段。

`partitionOrbitText()` 返回带固定ID与码点区间的tokens，以及textRows。`sample()` 返回与其他候选相同的 `phase/phaseIndex/timings/readHold`。所有时间均夹取在0–14秒，NaN回到0；绝对时间驱动，无帧间积分。

最终位置需要字体度量，故 `layoutTypeOrbitLock(ctx,state)` 单独返回实际字号、行位置与字粒目标位置；返回对象是独立复制，不会因调用者修改而污染缓存。它只依赖文案与字体测量，不依赖动画进度。`sample.tokens[].ringPosition` 是环阵位置；`lock` 是沿归位路径的时间进度。不要把它们当作真实力学轨迹。

低动态模式让字粒直接在最终阅读位置依次淡入，保留信息次序，取消环形迁移与旋转。三种配色只改变视觉表达，不改变文本与结构。

## 不照搬的部分

不使用来源蓝文件夹、键帽、英文词句、签名字样或商业字体。来源的快速片段并不直接适合长解说，原创版明确扩展阅读窗。没有连续播放或音频听审的结论；需要声音时，必须在实际项目中再做对话清晰度与动作点的听审。
