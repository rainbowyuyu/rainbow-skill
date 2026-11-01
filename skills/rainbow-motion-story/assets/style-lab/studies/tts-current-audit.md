# 现有 TTS 审计：从逐句合成到表演编排

核查日期：2026-10-24（Asia/Shanghai）。本记录来自本机文件与已安装包，只读核查；未合成新声音、未试听、未安装依赖、未改旧片。没有复制个人参考声音、朗读文本或凭据。

## 1. 当前实际入口

| 用途 | 已核对路径 / API | 当前状态 |
|---|---|---|
| Python 环境 | `D:/projects/tts/.venv/Scripts/python.exe` | `qwen-tts 0.1.1`、`torch 2.11.0+cu128`、`transformers 4.57.3` |
| 合成模型 | `D:/projects/tts/models/Qwen3-TTS-0.6B` | 本地 config：`tts_model_type=base`、`tts_model_size=0b6`、`tokenizer_type=qwen3_tts_tokenizer_12hz` |
| 当前加载方式 | `Qwen3TTSModel.from_pretrained(model_path, device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')` | 近期影片实际使用；本审计未加载模型权重 |
| 音色提示 | `create_voice_clone_prompt(ref_audio=..., ref_text=...)` | 个人参考 ICL 模式；不对外导出 |
| 合成 | `generate_voice_clone(text=..., language='Chinese', voice_clone_prompt=..., non_streaming_mode=True, **sampling)` | 返回 `(List[np.ndarray], sample_rate)`；本地 tokenizer 输出 24 kHz |
| 清理 / 母带 | `D:/projects/tts/broadcast_voice.py` 中 `master_voice(source, dest, report=None)` | 输出 48 kHz / PCM24 单声道；**不是语音生成器** |
| 原始处理规范 | `D:/projects/tts/RAINBOW_AUDIO_WORKFLOW.md`、`BROADCAST_NARRATION.md` | 保留原句，不变调、不为画面强行变速；实际音长决定时间线 |
| 历史通用清理 | `D:/projects/tts/clean_voice.py` | 保持现有调用者，不宜为新能力直接覆盖 |

已检查 `D:/AGENTS.md`、`D:/projects/AGENTS.md`、`D:/projects/tts/AGENTS.md`，本次未找到这些文件；遵守当前聊天给出的全局规则。

### 个人参考与本机能力

- 参考：`work/clone-reference.wav` + `work/clone-reference.json` 均存在；WAV 为 24 kHz 单声道、约 10.600 秒，JSON 包含 text/source/segments。这里只记录存在性及格式，不复制私人声音或参考文案。
- 当前仅安装一个 Qwen TTS 模型目录和 `whisper-small`；模型目录下完整 `.safetensors` 合计约 2.512 GB（含 tokenizer）。还存在未使用的 `model.safetensors.part`；本审计不清理。
- 本机 GPU：NVIDIA GeForce RTX 5060 Laptop GPU，驱动报告显存 8151 MiB；核查瞬间约 7484 MiB 可用。物理 RAM 约 31.7 GiB，总量与空闲量是快照，运行前需重查。
- 未实测 1.7B 模型在此设备的显存、合成时延或听感，不承诺它与其他渲染进程可同时驻留。

## 2. 模型真实控制边界

已核查安装源文件 `D:/projects/tts/.venv/Lib/site-packages/qwen_tts/inference/qwen3_tts_model.py`：

- `create_voice_clone_prompt`（约 356 行）：`x_vector_only_mode=False` 使用参考声音代码、参考文本和 speaker embedding 的 ICL；设为 true 则只使用 speaker embedding，并忽略参考代码和文本。后者不是已验证的风格增强开关。
- `generate_voice_clone`（约 470 行）没有正式的 `instruct`、`emotion`、`speed` 或 `rate` 参数。`**kwargs` 转交底层生成器，不能把任意自然语言指令当作该 Base 模型已支持的表演控制。不要为了“加感情”把“激动地说”等文字混进待朗读内容。
- `generate_custom_voice(text, language, speaker, instruct, ...)`（约 732 行）要求 custom_voice 模型。源码对 0b6 分支显式将 instruct 设为 None；1.7B CustomVoice 才适合作为指令控制候选，但它使用预设 speaker，不是现有个人克隆声音。
- `generate_voice_design(text, instruct, language, ...)`（约 637 行）要求 voice_design 模型。它按描述设计声音，不等于保持个人声纹。设计后克隆也只能继承那个设计声音，不能声称仍是用户的原声音色。
- Base 1.7B 可作为克隆质量候选，但不能仅因参数量变大便宣称获得 `instruct` 支持。
- `temperature/top_p/top_k/repetition_penalty` 是采样参数；调高 temperature 不等于“更激动”，更不能以随机性代替清晰的表演安排。
- 当前 Python API 的 `non_streaming_mode=False` 文档描述为模拟流式文本输入，不应把它包装成经过验证的低延迟实时服务。

版本信息由 `importlib.metadata` 核对；方法和能力边界按安装源文件核对。`qwen-readme.md` 是本地保存的上游文档，不能冒充今天线上最新版本证据。

## 3. 近期影片的实际做法与平淡原因

已读这些实际入口：

- `video_project/pid_embodied_control/scripts/v09/audio_synthesize.py`
- `video_project/pid_embodied_control/scripts/v11-webgl/audio_identity.py`
- `video_project/navier_stokes_water/scripts/v08/audio_synthesize.py`
- `video_project/shanghai_tower/scripts/voice.py`

共同点：同一 10.6 秒个人参考提示、逐 cue 生成、同一组采样参数、统一清理方式。PID 用 temperature=.34 / top_p=.84；NS 与上海中心用 .30 / .82；repetition_penalty=1.05、max_new_tokens=1536、non_streaming_mode=True。保存 raw、clean、实际音长、哈希、attempt、采样参数，并标记 `subjectiveListeningChecked=False`。

**能从代码确定的缺口：**

1. 没有每句“为什么这样说”的表演结构：疑问、解释、对比、发现、结论、收束都经相同生成路径。PID 稿已有 `breathAfterSeconds` 与 `visualEvent`，但它们没有变成支持表演控制的模型输入。
2. 当前 Base 模型的能力重心是参考克隆，没有正式指令控制。相同参考与几乎固定的低随机性采样难以给导演提供可控的语气层次。**这不是已试听得到的单一因果结论。**
3. 逐短句完全独立生成，跨句关系、重音发展和长弧线未被保存为表演信息。既有断句应保留语义完整性，不能拆成逐词碎片。
4. `master_voice` 的 active RMS 目标为 -21 dB，句间增益调整最多 ±4 dB，并有 1.65:1 温和压缩。它有益于一致响度，但不会创造表演，可能收窄原本的句间强弱差；新表演层应在不抹平句内动态的前提下保留有意的段落能量。
5. 当前稿件和缓存大多只含 text/spoken、采样设置、参考哈希与 attempt。改表演指令后如果缓存键仍然忽略表演，就会误命中旧的平淡 take。

**不能作为当前问题依据的旧流程：**`clone_promo_v8.py` 面向另一个历史产品片，有门限修剪和 rubberband 对齐固定时长；近期科普入口已明确保留自然时长。不能说今天所有声音仍在被这个旧脚本变速。

## 4. 向后兼容升级接口

建议新增独立入口与表演清单，保留 `broadcast_voice.py` 和现有影片脚本行为。每个 cue 至少保存：

```json
{
  "id": "explain-pressure-02",
  "displayText": "两边压强不一样，水就被推着走。",
  "spokenText": "两边压强不一样，水就被推着走。",
  "delivery": {
    "intent": "explain-cause",
    "energy": "medium",
    "pace": "measured",
    "emphasis": ["不一样", "推着走"],
    "pauseAfterSeconds": 0.3,
    "instruction": "像面对朋友解释一个刚看见的现象。前半句留出观察时间，后半句重读因果，不要播音腔。"
  }
}
```

这是**导演层通用 schema**，不是任何供应商已经支持的原生参数。适配器必须把能力声明写清楚：

- 现有个人 Base：支持同一声纹参考、文案/标点/语义段落、候选种子和停顿编排；不把 `instruction` 伪装成已生效，报告中明确提示不支持原生指令控制。
- 可指令化后端：仅传它实际支持的 emotion / instruction / rate；不识别的字段报错或明确降级，不静默丢弃。
- 固定音色策略与情感策略分别记录；不能为了情感换成预设音色而对用户隐瞒。
- 自然语速变化优先由合成器、完整语义句与句间留白实现；不要通过全片统一拉伸、移调或每词加逗号实现。
- 同一句提供两个有意图的 take，逐句复听选择。段落不连续激昂；观察、理解、反转和高潮留有区别，音乐高潮可以让出旁白。

### 缓存与可追踪性

缓存键应覆盖 backend/model ID、模型版本或权重指纹、参考音频/文本哈希、标准稿/口播稿、完整 delivery、实际采样参数、seed、合成器版本、清理配置和 pause 策略。新文件目录隔离；不覆盖已发布句源。

当前批处理用“本批第一句签名”决定随机种子；当 batch 组成或 OOM 后 batch_size 改变，同一句的实际结果也可能变化。新入口若强调逐句可重现，优先单句固定 seed；批处理则完整记录 batch 顺序、batch seed 和实际配置。所谓“同 seed 一定逐样本相同”也不应超出当前设备与库版本验证范围。

音色参考不放进技能仓库，技能仅保存本地路径与使用约定。候选、原始 WAV、处理报告、ASR 和实际拼接时间线进入当前影片的 work/output，而非散落在全局工具目录。

## 5. 保持既有正确的质量门槛

- 原始缺字、重复、术语错音优先重合成整句；补静音无法恢复缺失音节。
- 继续使用约 80 ms 前护 / 160 ms 尾护作为已有影片的起点，按真实源检查；测量滤镜延迟后补偿，不假设固定值。
- 文案、口播稿、字幕分开；“压强调”“调谐”等多音词要按具体语境，不对单字全局替换。
- 用实际生成音长重排镜头、音乐 ducking 与词锚点。不要保留旧字幕时码后强行压缩新解说。
- 人声和配乐分轨；检查原声、clean、混音与 AAC 四层。每次改变表演或内容都应失效相关音画同步 QA。
- 自动 ASR / 完整解码 / 真峰值 / 静音统计可辅助筛查，但不能证明语气自然、个人音色稳定或听感优秀。未经实际听审，继续保持 `subjectiveListeningChecked: false`。

## 6. 本次核查边界

完成：文档/近期入口/安装包源码/模型配置/设备与参考格式核查。

未完成也未宣称：模型新合成、跨方案听感对照、1.7B 显存测试、GPU 服务器状态、云 API/账号能力验证、个人音色上传、旧片全片复听。升级后的外部方案选择需以官方当前文档与实际小样确认。
