# 连续信号 · 音乐与视觉接力

这是 24 秒的原创 Canvas 透视示意和程序合成音乐。三个有稳定身份的信号从分离、焦点接力走向会合，再一起向远处延伸。轨迹不是信号传播计算，配乐没有使用参考视频的旋律、录音或采样。

源代码：[signal-relay.js](../../lab/modules/signal-relay.js)。[来源研究](../../studies/syy-rhythm.md)记录实际观察范围；原创时长、速率与音乐参数不可当作源视频的反推结果。

## 三种编排

| ID | 选择理由 | 变化 |
|---|---|---|
| `pulse` | 需要明确的小结果和大结果 | 短促动作后停留，确认声较多 |
| `legato` | 需要宽阔、连贯的空间旅行 | 动作较宽，减少一次确认声，用长尾连通 |
| `suspended` | 需要在结果前产生期待 | 会合前 3 秒停留，撤掉该段节拍，随后释放 |

三者共享轨迹、对象身份、颜色含义、故事节点和总时长。改变的是时间映射、留白与声音密度，不是简单换色。稳定留白中相机和主角均不动，音乐底保留空间。

## API

```js
import { duration, candidates, buildPlan, sample, draw, renderAudio }
  from '../../lab/modules/signal-relay.js';

const id = 'suspended';
const plan = buildPlan(id);
const state = sample(12, {id});
draw(canvas.getContext('2d'), 12, canvas.width, canvas.height, {id});
const audio = renderAudio(id, 48000);
// audio.left/right: 完整双声道混音 Float32Array
// audio.stems.music.left/right 与 audio.stems.sfx.left/right: 独立分轨
// 采用同一采样率及长度，可独立静音/增益后再混合。
```

`duration=24`，`candidates` 有 `id/title/description/duration`。

`buildPlan(id)` 返回 `events / readHolds / chapters / timeMap / music`。事件含 `id/kind/onset/peak/end/semantic/pan`；`peak` 为设计包络或语义锚点，不宣称是音频样本中的实测最大值。`music.bpm=100` 是原创配乐设定，绝不是原片 BPM。

`air` 和 `chime` 使用 `onset/end` 决定声音区间；`impact` 目前从 `onset` 起音、持续 1.4 秒，内置计划将其 `peak` 设为 `onset`、`end` 设为 `onset + 1.4`。修改计划时需同步修改合成器，不能只改变 `peak` 期待重音延后。API 不接收外部事件表。确认音的两层尾音均衰减到该事件的 `end`，不使用与事件长度无关的 1.2 秒截断；最终总混还叠加 0.75 秒片尾淡出。首尾独立事件有实际采样回归，检查末尾仍存在合成衰减、结束后严格为零。

`sample(t,{id})` 返回：

- `time`：成片秒数，钳制在 0–24。
- `storyTime`：原创运动进度，通过 C² 平滑分段时间映射得到。
- `stage/caption/reading/focusId`：同一语义进度的表现层。
- `signals[]`：稳定 `id/label/color`、世界位置、投影 `screen`、轨迹范围。
- `camera`：由运动时刻驱动的连续透视相机，世界停留时相机也停留。
- `events`：此时仍在声音包络范围内的事件；它是状态列表，不是“应每帧重新触发”的命令。

`renderAudio(id, sampleRate)` 返回 `{left,right,sampleRate,stems,metrics,plan}`。合成结果为 24 秒、固定种子的 32 位浮点数组；音色由正弦谐波和滤波噪声产生。播放使用 `AudioContext.currentTime` 作主时钟，并给全部 buffer 同一个开始时刻和 offset。暂停或跳转必须停止旧 source；勿在 `requestAnimationFrame` 里重复触发事件。

## 接入影片

先把关键语义事件映射到自己素材的音乐乐句，再重新确定时间表。不要把本例 100 BPM、24 秒或“必须三个主角”推广为固定模板。保留事件身份和路线时钟，替换色彩、几何、短标签或实际数据；科学数据不能按此审美曲线改写。

图形发光只作用于线与光点；标签和底部文字使用独立清晰绘制。会合前隐藏三个挤在一起的名字，改为一个靠近锚点的短说明，避免互相遮挡。轨迹、背景视差和相机共用世界状态；不靠随机噪点制造“活跃”。

## 输出与验证

运行 `node scripts/test_signal_relay.mjs` 检查逆序采样、静止窗口、交接位置、可见范围和数值音频。运行 `node scripts/export_signal_relay.mjs` 导出三份 48 kHz 双声道 WAV、事件 JSON 与 [manifest.json](manifest.json)，并做 FFmpeg 全量解码。

代码测试、信号峰值与解码不能替代主观听审或画面审美。当前未声称对原音轨或原创音色完成听审；工作台可分轨试听后再按实际需要调整。
