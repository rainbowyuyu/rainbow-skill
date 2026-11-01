---
name: rainbow-qwen-narration
description: 使用用户已有的本地 Qwen3-TTS-0.6B Base 和原本人参考制作自然中文配音；按完整语义段生成、核对读音和句尾，并由真实音长安排字幕与画面。用于用户的新视频配音、Qwen重录及声音流程核对。
---

# Qwen 本人配音

2026-10-31 用户明确将后续 TTS 默认改回自己的 Qwen 方案。入口为 `D:/projects/tts`，本地模型 `models/Qwen3-TTS-0.6B`，本人参考 `work/clone-reference.wav` 与匹配 JSON。先读 `D:/projects/tts/QWEN_NARRATION.md`、`BROADCAST_NARRATION.md`，再查看实际 CLI help。既有云端试音与图片 API 不是这个默认；Fish 继续禁用，Breeze 保留供明确选择，不能自动回退。

## 导演意图与真实控制分开

把提问、解释、对照、揭示和收束写成自然语义段。专业词连读，一段讲完整因果后再留观察时间。Base 本人克隆没有已验证的 instruction/emotion/speed/CFG/SSML 控制；角色和重音是编辑/试听方向，客户端记录未作为模型控制执行。通过朗读稿、语义与标点改进，再比较有限候选的实际声音，不虚构参数效果，不在后期变速变调。

## 执行

- 解释器：`D:/projects/tts/.venv/Scripts/python.exe`。
- `qwen_local_voice.py plan` 只做离线计划；`render` 才读取参考并加载本地 CUDA 模型；`assemble` 离线重组完整已验证句源。`expressive_voice.py` 默认也走本地 Qwen。
- 生成放当前项目的 `work/voice/` 或已有输出目录，每个 take 使用新目录。生成前确认本机显卡可用，不停止其他任务，不下载替代模型或上传本人参考。
- 原声、清理后、混音分开保留。参数和哈希进入生成台账；音长按实际采样数。错词/漏字/重复先重录完整语义段，不能拼补音节或截尾。
- 字幕、教学动作和口型从新声音重建，音乐在完整句后接手。ASR/波形/声学指标只能辅助检查；没有原速听审时，不填写自然度或本人相似度通过。

只写提示词或更新偏好时，记录后端和表演安排即可；不自动加载模型、启动服务或生成样音。
