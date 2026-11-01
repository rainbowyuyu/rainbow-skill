# 中文科普旁白：有表现力的 TTS 选型与控制边界

核对日期：2026-10-24（Asia/Shanghai）。范围：官方仓库、模型卡、官方 API 文档；本次没有安装模型、生成音频或进行主观听评。以下推荐是基于能力与接口匹配的工程选择，不是实测音质排名。MiniMax 按用户的全局约定仅用于视频，不纳入 TTS。

## 推荐路径

1. **准备作为云端主线：Qwen-Audio 3.1 TTS Flash。** 同一复刻音色可接受逐段自然语言表演指令，最符合“保留频道声音，同时改变语气、情绪和节奏”的需求。需要验证北京业务空间与账户权限、真实合成效果后才能启用，不能把已有 API Key 当成已验证服务。[Q1][Q2][Q3]
2. **准备作为本地表现力备选：IndexTTS-2.5。** 音色参考与情感参考分开，支持情绪向量、情绪文本与模型内时长因子；适合离线制作与精细控制，但安装、显存和自定义许可需要单独评估。[I1][I2][I3]
3. **保留现有 Qwen3-TTS Base 作为熟悉音色的兼容路径。** 它能克隆声音，但没有与 1.7B CustomVoice 相同的 `instruct` 表演接口。不能用无效参数或整体降速伪装情绪升级。[L1][L2]
4. **CosyVoice3 作为另一条开源实验路径。** 克隆参考可和 `inference_instruct2` 一起使用，语速可通过自然语言指令改变；不要将其数值 `speed` 的梅尔谱插值误称为模型理解后的自然韵律。[C1][C2][C3]

## 四条路线对照

| 路线 | 固定音色与表演能否同时控制 | 语速的真实接口 | 本轮状态 |
| --- | --- | --- | --- |
| Qwen-Audio 云端 `qwen-audio-3.1-tts-flash` | 官方列明：系统、复刻、设计音色都能使用 `input.instruction` | 指令描述语速/情感；另有 `input.rate`，但内部算法未公开 | 接口与文档已核对；未调用 |
| Qwen3-TTS 本地 1.7B | `CustomVoice` 用固定预置 speaker + `instruct`；`Base` 克隆不提供同样的指令能力；`VoiceDesign` 用文字设计声音 | 1.7B CustomVoice/VoiceDesign 的自然语言指令；无通用 `speed` 或精确秒数承诺 | 官方源码已核对；不等于本地升级完成 |
| IndexTTS-2.5 本地 | `spk_audio_prompt` 固定音色，另外给 `emo_audio_prompt` / `emo_vector` / `emo_text` | `duration_factor` 改变声学生成阶段的目标长度，不是输出 WAV 再拉伸 | 官方代码已核对；未部署 |
| Fun-CosyVoice3 本地 | `inference_instruct2(text, instruct_text, prompt_wav)` | 自然语言指令可控；数值 `speed` 实为声码器前的梅尔谱插值且仅非流式 | 官方代码已核对；未部署 |

## Qwen 云端：实际接入合同

### 模型与区域

- 当前中文非实时指南推荐 `qwen-audio-3.1-tts-flash`；同族还列 `qwen-audio-3.1-tts-plus`、`qwen-audio-3.0-tts-plus`、`qwen-audio-3.0-tts-flash`。不要把它们当作旧 `qwen3-tts-flash` 的参数别名。[Q1]
- 北京合成地址：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`。必须使用对应地域的业务空间 ID 与凭据；此处没有填任何真实空间或密钥。[Q2]
- 地域文档说明：旧 `dashscope.aliyuncs.com` 用于存量兼容，自 **2026-09-30** 起不再增加新特性，因此不能假定它支持所有 3.1 能力。官方另提供无需空间子域的 `trial.cn-beijing.maas.aliyuncs.com` 用于功能验证，支持 HTTP/SSE；它不是生产默认，无 SLA，是否接受具体模型与音色操作还需要实际响应确认。不得悄悄把试用域名写成生产配置。[Q7]
- 旧 Qwen3 云端 API 的已核对请求只有 `text`、`voice`、`language_type` 等字段，不能把网上旧 `*-instruct-*` 示例或 `instructions` 复数形式直接拼进新合同。新 API 在 `input` 里使用单数 **`instruction`**。[Q2][Q5]

### 合成参数

```json
{
  "model": "qwen-audio-3.1-tts-flash",
  "input": {
    "text": "先别急着看公式。看这架无人机：风一推，它为什么还能稳住？",
    "voice": "MODEL_BOUND_VOICE_ID",
    "format": "wav",
    "sample_rate": 24000,
    "language_hints": ["zh"],
    "instruction": "自然、有好奇心地解释。首句略轻，问句上扬，在风一推后短暂停顿。保持原有音色，不用广告腔。",
    "rate": 1.0,
    "pitch": 1.0,
    "volume": 50,
    "seed": 0
  }
}
```

`rate` 和 `pitch` 的 API 范围均为 0.5–2.0；`volume` 为 0–100；`seed` 为 0–65535。`language_hints` 当前只处理数组第一项，中文只传 `zh`。`word_timestamp_enabled` 仅适用于流式输出；复刻音色支持，系统音色需查列表。输出 URL 有效期为 24 小时，应立即下载保存到当前工程。`rate` 是服务端参数，但内部是否重采样、声学调整或其他实现未公开；默认保留 1.0，优先靠表演指令而非全局变速。[Q2]

发音修复可用 `input.hot_fix.pronunciation` 的词语到拼音映射；展示文案和朗读文案必须分离，避免把拼音或表演指令渲染成字幕。不要预先承诺任意公式、连读或多音字都正确，仍要逐段核听。[Q2]

### 复刻与查询

同区域 `.../api/v1/services/audio/tts/customization`：

```json
{
  "model": "voice-enrollment",
  "input": {
    "action": "create_voice",
    "target_model": "qwen-audio-3.1-tts-flash",
    "prefix": "rainbow",
    "audio": "data:audio/wav;base64,REFERENCE_AUDIO"
  }
}
```

返回 `output.voice_id` 后保存。查询用 `input={"action":"query_voice","voice_id":"..."}`，同一个 `model="voice-enrollment"`。`output.status` 为 `DEPLOYING` 时等待，为 `OK` 才可使用，`UNDEPLOYED` 则失败；详情里的 `target_model` 必须和合成模型一致。不要重复创建音色来代替状态查询。`prefix` 只允许英数，最多 10 个字符；若添加 `enable_volume_normalization`，文档类型是字符串 `"true"` / `"false"`，不是 JSON 布尔值。[Q3][Q4]

只读音色列表可先用于确认现有资源：同一 customization 路径，`model="voice-enrollment"`，`input={"action":"list_voice","page_index":0,"page_size":10}`，可选 `prefix`。读取 `output.voice_list` 后再逐项查询绑定模型，不要根据 ID 外观自行猜测。[Q4]

参考录音推荐 10–20 秒，最多 60 秒且不超过 10 MB；WAV 16-bit、MP3、M4A，采样率至少 16 kHz。至少 5 秒连续清楚人声，无音乐和其他说话者；双声道只取首声道。创建出的音色绑定目标模型，更换 Flash/Plus 不能直接复用 ID。[Q3]

### 费用快照（不是承诺报价）

2026-10-24 官方北京价格表：`qwen-audio-3.1-tts-flash` 输入 **1.5 元/百万 Token**、输出 **12 元/百万 Token**；`qwen-audio-3.1-tts-plus` 为 **1.4 元/万计费字符**，汉字按两个字符计算。Qwen 音色创建免费，后续合成按目标模型计费。账户是否仍有免费额度未验证；没有可靠 Token/秒换算，本笔记不编造每分钟成本。[Q3][Q6]

## Qwen3-TTS 本地：必须区分三种能力

- `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`：`generate_custom_voice(text, language, speaker, instruct)`。官方 9 个预置音色包括 Vivian、Serena、Uncle_Fu、Dylan 等；可固定 speaker 逐段改变语气，但不是用户任意音色克隆。
- `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`：`generate_voice_design(text, language, instruct)` 以文字设计声音。逐段重复设计可能影响人物一致性；官方提供先生成参考、再交给 Base 克隆的路径，但转入 Base 后不能继续假定保有每段 instruct 能力。
- `Qwen/Qwen3-TTS-12Hz-1.7B-Base`（以及 0.6B Base）：`generate_voice_clone(text, language, ref_audio, ref_text, voice_clone_prompt, ...)`。同一参考能复用，`x_vector_only_mode=True` 可省转写但官方说明质量可能降低；它没有公开表演指令合同。
- 0.6B CustomVoice 即使函数签名接收 `instruct`，官方实现也会将它置空，不能把“未报错”当作指令生效。[L1][L2]

仓库与已核对 Base 模型卡为 Apache-2.0。官方推荐独立 Python 3.12 环境；FlashAttention 2 是可选优化，要求兼容 GPU 与 FP16/BF16，不应为这个升级任务盲目污染现有 TTS 环境。[L1][L3]

## IndexTTS-2.5：本地情感与时长

官方 README 的版本记录为 2026-08-10 发布 IndexTTS-2.5；模型 ID `IndexTeam/IndexTTS-2.5`，入口 `from indextts.infer_v2_5 import IndexTTS2`。固定 `spk_audio_prompt`，另用情感参考音频或八维向量；向量顺序是 happy、angry、sad、afraid、disgusted、melancholic、surprised、calm。情感文本会先转成向量，不是任意导演要求都会直接兑现。[I1]

`use_emo_text=True` 要在构造器显式启用 `use_qwen_emo=True`；情感强度示例推荐约 0.6 或更低、`use_random=False` 以保持自然和音色一致。`duration_factor` 范围 0.5–2.0，**大于 1 更慢，小于 1 更快**；官方代码在声学 length regulator 之前调整目标长度，没有事后改 WAV 播放速率。这仍不是保证某一句刚好等于精确秒数。旧 IndexTTS-2 的 README 明说论文中的精确时长控制尚未在当时发行中启用，不能混为一谈。[I1][I2]

部署用项目独立 uv 环境；Windows 的 DeepSpeed 是可选且可能难装。首次运行还可能下载小模型。仓库与 2.5 模型卡使用 **bilibili 自定义模型许可**，不是 Apache/MIT；包括大规模企业的额外授权门槛、保留声明、对模型及输出用于训练其他模型的限制。正式集成按原许可审核，不把它标成无限制开源。[I1][I3]

## CosyVoice3：轻量可控候选

模型 `FunAudioLLM/Fun-CosyVoice3-0.5B-2512`，官方示例通过 `AutoModel` 加载，`inference_instruct2` 同时接收文本、带 `<|endofprompt|>` 的指令以及参考音频。官方示例包含中文快语速、方言及情绪指令，适合后续做与 Qwen/Index 的同文案盲听比较。[C1][C2]

必须区分两种控制：自然语言指令影响生成表现；源码 `speed` 分支则 `F.interpolate` 已生成的梅尔谱后再声码器，属于声学时间缩放，只支持非流式。这种方式不能作为“自然语气变化”的主解法。仓库和所查模型卡是 Apache-2.0；官方基础环境 Python 3.10，带子模块、PyTorch/音频依赖；可选 `ttsfrd` 示例是特定 Linux wheel，不能直接拿到 Windows 安装。[C1][C2][C3][C4]

## 给制作技能的选用规则

- 频道人物保持同一 voice/reference；每个语义段允许一项主情绪与一项节奏意图。不要每句话切换声线或堆叠相冲突的形容词。
- 钩子可以较轻、好奇、短促；解释阶段回到清楚自然；关键因果留 150–350 ms 的短间隙；高潮画面给音乐与音效留空位。以上是本项目起点，需要用真实音频试听校正，并非模型参数保证。
- 不用整片 `atempo`、重采样或播放倍率来营造“质感”；先改朗读稿、标点、分句和指令，再重生成问题段。
- 固定少量代表句测试：好奇引子、平实解释、反问、关键数字/公式、温柔收尾；对比时保持文案、响度和音色条件一致。评价可懂度、表演自然度、音色漂移、停顿、错字，而非只看峰值或 ASR 分数。
- 记录 provider/model/voice/reference hash/文案/指令/seed/原始音频/修订原因；只有真实生成并通过复核的候选才能成为默认，文档可用不代表服务已通或声音好听。

## 一手来源

### Qwen 云端

- [Q1 非实时语音合成指南](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide)
- [Q2 Qwen-Audio-TTS HTTP API](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api)
- [Q3 声音复刻指南](https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide)
- [Q4 声音复刻 HTTP API](https://help.aliyun.com/zh/model-studio/voice-clone-design-http-api)
- [Q5 旧 Qwen3-TTS HTTP API](https://help.aliyun.com/zh/model-studio/qwen-tts-api)
- [Q6 模型计费](https://help.aliyun.com/zh/model-studio/model-pricing)
- [Q7 地域与接入域名](https://help.aliyun.com/zh/model-studio/regions)

### Qwen 本地（仓库版本 `022e286b98fbec7e1e916cb940cdf532cd9f488e`）

- [L1 官方 README](https://github.com/QwenLM/Qwen3-TTS/blob/022e286b98fbec7e1e916cb940cdf532cd9f488e/README.md)
- [L2 推理方法源码](https://github.com/QwenLM/Qwen3-TTS/blob/022e286b98fbec7e1e916cb940cdf532cd9f488e/qwen_tts/inference/qwen3_tts_model.py)
- [L3 Base 官方模型卡](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)

### IndexTTS（仓库版本 `d9e41aac89fd00b3d71497fddb287b7f24613712`）

- [I1 官方 README](https://github.com/index-tts/index-tts/blob/d9e41aac89fd00b3d71497fddb287b7f24613712/README.md)
- [I2 2.5 推理实现](https://github.com/index-tts/index-tts/blob/d9e41aac89fd00b3d71497fddb287b7f24613712/indextts/infer_v2_5.py)
- [I3 模型许可](https://github.com/index-tts/index-tts/blob/d9e41aac89fd00b3d71497fddb287b7f24613712/LICENSE)
- [I4 官方模型卡](https://huggingface.co/IndexTeam/IndexTTS-2.5)

### CosyVoice（仓库版本 `074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc`）

- [C1 官方 README](https://github.com/FunAudioLLM/CosyVoice/blob/074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc/README.md)
- [C2 官方调用示例](https://github.com/FunAudioLLM/CosyVoice/blob/074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc/example.py)
- [C3 数值 speed 实现](https://github.com/FunAudioLLM/CosyVoice/blob/074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc/cosyvoice/cli/model.py)
- [C4 官方模型卡](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512)

工具记录：本轮 `web.run` 没有返回可引用正文，随后通过只读 HTTPS 请求读取上述官方页面与仓库原文；没有根据空搜索结果作结论，也没有读取任何账户凭据。
