---
name: rainbow-suno-sound-effects
description: 为视频剪辑按画面事件配置苏诺音乐性音效、氛围与转场声音，完成任务跟踪、同步混音和 TTS 音效库归档。用户要求视频配声、音效生成或苏诺配乐时使用；口播仍走已有 TTS 流程。
---

# 苏诺视频音效

用户已指定：后续实际视频制作需要音效时，主动选用合适的苏诺能力，把声音配置到相应画面。所有音效资产集中保存到 `D:/projects/tts/音效/`，不散落各工程；工程保留 cue 表和资产路径。安装或检查连接本身不生成付费样音。

## 入口与能力

- 官方技能：`C:/Users/USER/.codex/skills/suno-cn-music/SKILL.md`；调用前读取其当前版本及 `references/api.md`。保持官方包原样。
- 官方客户端：`node C:/Users/USER/.codex/skills/suno-cn-music/scripts/suno-client.mjs`。API、授权、上传、查询均由该 helper 执行，不自行发 HTTP/MCP 请求。
- 苏诺提供音乐、纯音乐与音频处理，当前契约没有专用 text-to-SFX 接口。适用于音乐性转场、蓄势、揭示、环境氛围与设计声音候选；不能承诺精确物理拟音、无旋律或子秒时长。准确碰撞、旋翼、按钮与逐帧瞬态按需结合已有程序音效或有许可的拟音。
- 保持用户指定 BGM 和个人解说音色。TTS 入口仍是 `D:/projects/tts`；不上传个人音色参考或整段口播来制作无关音效。
- 具体拟音候选可先读 `C:/Users/USER/.codex/skills/sound/SKILL.md`，从 Freesound 搜索/下载真实来源的MP3预览；它不是生成模型，不取代本技能的音乐性生成。跨来源选材、素材内同步点和混音按 `rainbow-video-director/references/sound-sourcing-and-mix.md`，所有来源继续归同一中央音效库，不伪造Suno任务号。

## 制作流程

1. 从当前分镜、动作状态和最终旁白标出接触、掠过、完成、揭示、蓄势与阅读窗口。读 [声画与归档约定](references/workflow.md)，按语义选择声音；不是每次移动都加 whoosh。
2. 查已有音效库与工程 cue 表，复用合适资产。仅缺少的声音进入生成。结合音色、频段、节奏和用户 BGM，简短说明将生成的声音与用途；用户本轮已要求制作时在授权范围内继续，不逐条重复询问。
3. 执行 `auth verify`；只有返回 `authorized` 才继续 `account`。需登录时打开 helper 原始授权链接并通知用户；不读取凭证文件，不替用户勾选长期信任。积分不足按官方恢复流程处理，不自动购买。
4. 按当前官方契约提交一次，保存任务编号并查询。纯音乐设 `instrumental=true`；不要给纯音乐传仅非纯音乐支持的 `duration`。默认不启用双倍积分的 `max_mode`。超时或状态未知先查询，不重放创建请求。
5. 成功后逐项核对结果，记录任务编号和非敏感作品页；签名结果链接仅临时用于下载定位。helper 没有 download 命令；使用官方网页对应作品的下载功能取得本地文件，或宿主已支持且符合官方契约的结果下载能力。无法取得文件时如实保留“待下载”，不可用链接冒充本地已归档文件。
6. 将下载文件用 [Save-SunoSound.ps1](scripts/Save-SunoSound.ps1) 归档到 `<project>/<cue>/<job>/raw/`，保留原始编码及 SHA256。剪裁、淡入淡出、重采样后的派生文件放同级 `processed/`；先看实际波形与试听定位声音锚点，不靠生成提示词假定时长。
7. 将素材写入已有生产 cue 表，对齐事件帧与素材内同步点，旁白/音乐/音效/氛围分轨。密集公式段减声，关键接触与结果落点优先；音乐已有重拍时避免堆叠。
8. 实际试听、检查对白遮蔽、单声道折叠和最终编码同步。未执行的检查保持 false；测量合格不能代替听审。交付音效库路径、工程 cue 表与未解决事项。

## 资源

- [声画与归档约定](references/workflow.md)：事件同步、提示词候选、目录与命令示例。
- [元数据模板](assets/metadata-template.json)：原始任务、实际媒体、许可状态与审查记录；空值表示未核验。
- `C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/guides/sound-design.md`：声音选择、留白、音乐让位与既有生产 cue 格式。
- `D:/projects/tts/SUNO_SOUND_EFFECTS.md`：TTS 项目的调用入口。

同一 Windows 用户的 Codex 桌面、CLI 与 IDE 通过全局技能目录共用此流程。自定义 CODEX_HOME、独立系统用户、WSL 或远程环境须另确认实际路径和授权；不复制凭证以假装完成跨机安装。
