# 事件驱动音效 API

入口为 `../../lab/sound-design.js`。所有声音是原创程序合成，无第三方采样。位置、声像、速度来自教学几何；空气声与转速映射不是声学测量、多普勒仿真或飞行动力学。

```js
import {scenes,getScenePlan,renderScene,visualState,encodeWav}
  from '../../lab/sound-design.js';

const options={sampleRate:48000,offsetMs:0,gainDb:0,intensity:1,
  includeSpeechPlaceholder:false};
const plan=getScenePlan('contact-sync','B',options);
const rendered=renderScene('contact-sync','B',options);
// rendered={left,right,sampleRate,duration,cues,plan,metrics}
const state=visualState('contact-sync',2.0);
const bytes=encodeWav(rendered); // stereo PCM16 Uint8Array
```

`scenes` 包含 `id,title,question,duration,variants,events,speechWindows,readWindows`。事件含 `id,kind,onset,peak,contact,end,priority`。窗口统一为 `{start,end,label}`。

`getScenePlan` 的 cue 包含声音、事件 ID、语义锚点、锚点时间、声音内部锚点偏移、开始、时长、优先级、增益、声像、种子和避让策略。`designSyncDelta` 是设计偏移，不冒充实测声峰。`measureCue(cue)` 分别提供10%幅度阈值起音、绝对峰值和8ms RMS峰的位置。接触声有约1.5ms的防点击攻击段，所以声音主瞬态略晚于包络的起点。

`offsetMs` 只移动与动作绑定的音效，环境声不动。`gainDb` 和 `intensity` 控制音效总量，参考占位信号保持相同。没有逐文件归一化、压缩器或限幅器；`encodeWav` 遇到非有限数值、错误采样率或超幅会报错，不能静默截顶。`metrics.samplePeakDbFS` 是样本峰值，不能称真峰值。

`visualState` 返回 `{time,events,currentEventId,stage,object:{x,y,angle},speechActive,readActive}`，A/B共用同一画面。浏览器把整段PCM放入AudioBuffer；用 `AudioContext.currentTime` 作为主时钟，时间为 `offset+(currentTime-start)*playbackRate`。暂停/换场景时短暂淡出旧节点，seek时重新从绝对偏移调度，不积累旧cue。变速预览会随AudioBuffer playbackRate改变音高；它只是检查工具，不是生产级保音高伸缩。

五组场景：接触同步、声音密度、接触尾音、速度映射、讲解与阅读避让。`narration-space` 的可选占位信号是调幅正弦与噪声，没有词语、音素或人的声音，不能拿它证明真实旁白的清晰度。实际影片仍需导入真实TTS并分轨听审。

运行 `node scripts/qa_sound_design.mjs` 进行确定性、端点防点击、同步、单声道、避让和WAV头检查；运行 `node scripts/render_sound_design.mjs` 生成对比WAV、源音色、计划与SHA256清单。数值检查不替代人耳听感检查。

用 `node scripts/build_sound_index.mjs` 从生成清单重建离线试听页；`python scripts/qa_sound_media.py` 调用本机 FFmpeg 检查实际格式和真峰值。它只测量输入，不改动声音。短于400ms的原声可能没有有效整体LUFS；报告用空值保留这个边界。
