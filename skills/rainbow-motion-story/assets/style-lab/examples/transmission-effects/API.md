# 传输场景：相对运动与确认接力

这是从[参考研究](../../studies/transmission.md)提炼的原创代码候选，未使用原片图像、音轨或源码。参考的快速横移、局部推近和确认交接是可观察的视觉方法；这里的多时间采样不是对原作者渲染算法的断言。

源码：[`lab/modules/transmission-effects.js`](../../lab/modules/transmission-effects.js)。依赖只有已有 `common.js`，生产项目可将绝对时间采样接口接到自己的渲染器。

```js
import {
  candidates, sampleTracking, drawTracking, sampleExposureTimes,
  sampleWindowRelay, drawWindowRelay, PACKET_EVENTS
} from '../../lab/modules/transmission-effects.js';

const options = {
  cameraMode: 'follow', // fixed | follow
  blurMode: 'temporal', // none | temporal | spatial
  fps: 30, shutterAngle: 180, samples: 16, palette: 'titanium'
};
drawTracking(ctx, 9.575, 1600, 900, options);
const state = sampleTracking(9.575, options);
drawWindowRelay(ctx, 9.55, 1600, 900, {palette: 'titanium'});
```

| 候选 | 时长 | 建议预览 | 结束保持 |
|---|---:|---:|---|
| `look-tracking-exposure` | 18 s | 9.575 s | 15.3–18 s |
| `visualization-window-relay` | 20 s | 9.55 s | 17.1–20 s |

两者均不循环，超出时长保持末态。设计画布 1600×900；支持三种现有色板。强度旋钮关闭，以免悄悄改变可核对的传输关系。`stageTimes` 与 `stages` 严格逐项对应。

## 相机也参与曝光

`sampleExposureTimes(time, {fps, shutterAngle, samples})` 返回 `[{time, weight}]`。快门时长为 `shutterAngle / 360 / fps`：30 fps、180° 对应 1/60 秒。对称曝光区间在片首/片尾裁到 0–18 秒，再在实际区间内做等权中点积分；权重和恒为 1。快门为 0° 时返回单一当前状态。帧率支持 30/60，样本数取整数 4–64，角度 0–360°。

`sampleTracking` 返回世界坐标、相机位置/速度、五个固定身份数据块、投影与屏幕相对速度。`sampleStates` 中每一项都重新求它自己的相机和物体，不把当前相机套到所有子样本。固定相机中主数据块横移，跟随相机中主数据块屏幕速度为 0，而静止背景反向运动。相机选择不会修改世界里的轨迹。

`drawTracking` 三种模式：

- `none`：只绘制当前时刻。
- `temporal`：每个子样本完整重绘不透明场景，然后做运行均值合成。画布缓存只复用内存，每次从空白重算，不保存旧显示帧。
- `spatial`：只绘制当前时刻，再施加与当前相对运动量级匹配的各向同性高斯滤镜，明确作为对照。模糊半径为 `max(|主体屏幕速度|, |背景屏幕速度|) × 快门时长 / √12`，预览上限为 24 个设计像素。它没有计算新位置，会同时软化本该被追住的主体；它不是固定半径滤镜。

时间、模式名、速度和快门参数在合成之后独立绘制。场景内的数据身份与地面刻度属于空间内容，会随相对运动接受曝光；固定 HUD 不参与模糊。

Canvas 2D 的默认显示空间合成并非线性光 HDR 积分，也不是物理镜头仿真。此实现用于学习时间采样、相机相对速度和阅读层的关系。交付渲染器可沿用 `sampleExposureTimes` 与逐样本状态，在自己的线性渲染管线累加。

阶段起点：`[0, 1.4, 3.4, 5.2, 7.2, 9.2, 11.2, 13.4, 15.2]`。快速位移与真实静止交替，最后减速归中；只有整个曝光范围都静止时才返回 `readHold:true`。

## 同一个窗口，确认后才移动

`PACKET_EVENTS` 是唯一机制事件表：6 包，每包 100 B，允许最多 3 包未确认。每包保存 `id/index/byteStart/byteEnd/sentAt/receivedAt/ackDepartAt/ackArrivedAt`。

| 包 | 发送 | 接收 | 确认返回 |
|---|---:|---:|---:|
| P1 | 4.7 s | 6.5 s | 8.8 s |
| P2 | 5.1 s | 6.9 s | 9.2 s |
| P3 | 5.5 s | 7.3 s | 9.6 s |
| P4 | 9.4 s | 11.2 s | 14.0 s |
| P5 | 9.8 s | 11.6 s | 14.4 s |
| P6 | 10.2 s | 12.0 s | 14.8 s |

上方通道里的移动包和中间序号记录是同一事件的两种视图，身份相同。接收计数在到达接收端时增加；发送端的已确认计数只在 ACK 返回时增加。不能将“接收端已经收到”当成“发送端已经确认”。

逻辑窗口从连续确认数推导。外框在每个 ACK 到达后才开始 0.55 秒平滑移动，`visualStart` 不能领先逻辑确认前沿；后续包等相应位置腾出后才发送。完整数据带上的 100 B 刻度与记录卡共用投影，推近不改变单位。最后拉回全景并保持全部结果。

本例不模拟丢包、拥塞、重传、累计确认或完整 TCP。事件时间是明确保存的教学设定，不能作为网络测量结果引用。

阶段起点：`[0,1.4,3.1,4.7,6.5,8.8,9.4,11.2,14,15.6]`。末段 15.6–17.1 秒拉回全景，17.1 秒后是稳定阅读窗口。

## 验证

```powershell
node research/motion_atelier/scripts/test_transmission_effects.mjs
```

测试用解析积分核对曝光收敛，验证每个样本的相机/物体时刻、屏幕相对速度、实际均值合成权重、确认因果关系、窗口前沿、刻度一致性和任意定位。Canvas 调用记录能检查状态与合成顺序，不能替代浏览器像素验收。结果存入 `qa/transmission-effects.json`。
