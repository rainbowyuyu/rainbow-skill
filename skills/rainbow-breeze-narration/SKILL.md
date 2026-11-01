---
name: rainbow-breeze-narration
description: 使用 H100 服务器上的 Breeze TTS 2 为视频生成本人音色的自然解说，按剧情指导情绪、语速和重音，并以真实音频重建字幕与动作时间线。仅用于明确选择 Breeze 的配音或服务检查；默认本地 Qwen 请用 rainbow-qwen-narration。
---

# Breeze 本人音色与逐句表演

2026-10-31 用户将后续 TTS 默认改为 [本地 Qwen 本人配音](../rainbow-qwen-narration/SKILL.md)。本技能保留先前 Breeze 方案，仅在用户明确选用 Breeze 时执行。实际使用前核对服务状态与部署证据；本技能的存在不等于服务正在运行。保留原 TTS 音频和历史方案，切换不自动重录旧片。Fish 仍停用，Breeze 不可用时明确报出问题，不静默换回 Qwen、云端试音或公共声音。

## 按需入口

- 管理器：[breeze_manage.py](D:/projects/tts/breeze_manage.py)，通过 `ssh fusion-gpu` 管理 `/srv/services/breeze-tts-2`。
- 合成客户端：[breeze_voice.py](D:/projects/tts/breeze_voice.py)，配置在 [client-config.json](D:/projects/tts/breeze/client-config.json)；先读实际 `--help`，不猜测参数。
- 实测记录：[部署回执](D:/projects/tts/breeze/work/deployment-status.json)。2026-10-30 已完成 eager 与 fast-all 本人参考合成；当前运行状态仍需现场查询，试听质量不由 HTTP/ASR 代替。
- 操作、导演谱、恢复与混音：[配音工作流](D:/projects/tts/BREEZE_NARRATION.md)。官方模式、API、音频格式与语气示例：[一手资料指南](D:/projects/tts/breeze/official-guide-draft.md)。源码/模型版本与原始来源见同目录 `sources.json`。
- 完整片段与音乐留白示例：[story-score.json](D:/projects/tts/breeze/examples/story-score.json)；同句语气对照：[three-directions.json](D:/projects/tts/breeze/examples/three-directions.json)。复制到当前影片再改稿，避免直接覆盖公共样例。
- 生成后清理与音轨核验：[BROADCAST_NARRATION.md](D:/projects/tts/BROADCAST_NARRATION.md)。此处只适用于明确选择的 Breeze 项目，完整语音和自然时间轴原则继续适用。

## 启动与身份

先运行 `python D:/projects/tts/breeze_manage.py status`。需要服务时用 `start --gpu 1`（默认 fast-all；`--eager` 仅用于明确诊断），确认选中显卡和服务状态。显卡忙时不停止其他任务，不随意抢占。用 `tunnel` 建立本机 `127.0.0.1:30020` SSH 转发，再用 `python D:/projects/tts/breeze_voice.py status` 核对实际 `/v1/model`。

使用已有可运行的 TTS Python 环境；管理器依赖 psutil，客户端依赖 numpy/requests。若 PATH 指向错误解释器，检查项目环境后使用绝对 Python 路径。退出使用 `close-tunnel`；`stop` 只用于确认没有本服务在途合成后释放 GPU，不能为了省事中断其他视频任务。

保留 `model_digest`、固定 model revision、源码 revision、参考 WAV/稿件 SHA256、seed 和实际参数。部署尚未核验时不填写虚构的 expected digest；有已验 digest 时不得静默接受不同权重。

## 用本人声音表演

默认 **Voice Direction**：同时使用 `D:/projects/tts/work/clone-reference.wav`、匹配 JSON 中的完整文本和 `instruction`，CFG 以官方建议 4 为起点。参考语音清楚且文字逐字对应，不用循环录音凑长度；本人参考只传到用户自己的 SSH 服务，不上传外部平台。

六类有剧情目的的表演：好奇提问、清楚解释、对照辨别、惊喜揭示、紧迫蓄势、温暖收束。客户端对应 `curious / explain / contrast / reveal / build / reflect`；`neutral` 用于基线比较。它们是客户端写入自然语言 instruction 的角色，**不是官方 emotion 枚举**。每句只保留必要指导：说给谁听、哪几个词要突出、语速如何变化、句末如何落下。中文讲解用中文指导，少用“炸裂、极致、非常有情感”等无法验收的词。

纯 **Voice Clone** 仅继承参考声音表现，不传 instruction，CFG 为 1。Voice Design 不提供本人身份；没有本轮明确要求时不拿它替代本人声音。官方未提供独立 speed/emotion/SSML 参数，不伪造字段或用后期拉伸冒充模型的自然语速控制。

中文声音事件可在朗读文本放 `[笑] / [叹气] / [咳嗽] / [清嗓子]`，英文是 `(laugh) / (sigh) / (cough) / (clears throat)`。只在内容需要时用；显示稿/字幕去除控制标记，表演 instruction 也不能被读进正文。多音字、数字和英文术语另存标准稿与实际朗读稿，改词时重合成完整语义句。

## 生成、编排与恢复

1. 把脚本拆成完整的语义句/段，为每句保存稳定 ID、显示文本、朗读文本、role、必要 instruction 与句后留白。先让故事自然，别为了铺满五分钟把旁白塞满；音乐接管段在 score 中显式留空。
2. `plan --score <工程稿件.json> --out <新计划目录>` 用于离线核对计划；`render --score <工程稿件.json> --out <新音频目录>` 生成逐句素材。单句使用 `synthesize --text-file <UTF8朗读稿> --role curious --out <新目录>`；需要具体表演时再传 `--instruction`。输出是目录，不是 WAV 文件名。
3. 当前官方服务单并发，按队列顺序提交。batch 让同组文本共用一个 instruction，不能假定每句可独立情绪；实际项目以逐句角色优先。模型上下文与生成有上限，过长段落拆句，不承诺整片一次无限长合成。
4. raw 原始 PCM/WAV、尝试记录与安全尾音全部保留。每段量真实样本数后拼接；句后停顿属于剪辑安排，不能裁切已发出的字、拉长音频或统一慢放。字幕、口型、实体动作和音乐锚点均由新音频时长重建。
5. 只用相同计划的 `--resume` 复用完整素材。409/失败先检查服务与记录；断线或未知结果保留 partial 和请求状态，禁止盲目重新 POST。核明后需重录时显式 `--resume --redo <句ID>` 生成新的保留版本，不能覆盖旧尝试。连接恢复不代表上次合成完成。
6. 仅重新排列或调整停顿时，可用 `assemble --manifest <已完成manifest> --out <新目录>` 离线重组；不能用重组掩盖已改变的朗读文本。原始素材保留在当前影片的 work/output 目录；它们不是苏诺音效，不移入 TTS 的“音效”库。

## 验收

技术核验包括：响应是实际 24 kHz mono s16le、PCM 偶数字节数、可解码、SHA256、无截断、实际长度、完整 raw 已进入最终旁白。内容核验检查漏字/重复、数字/术语和句尾；问题发生在原声时重合成，不用强降噪遮盖。

同响度对照本人身份、连贯性、语气与加入 BGM 后的清晰度。F0、能量、时长或 ASR 只能辅助定位，**不证明自然好听**；未实际听审时保持 `subjectiveListeningChecked`、`pronunciationListened`、`voiceIdentityChecked` 等未完成状态。交付可试听候选、实际文件路径、参数与未完成核验，不能将 HTTP 成功写成全片音质已验收。

用户已确认个人非商业科普用途；原始许可保留在模型档案，常规合成不反复要求确认或插入许可提示。
