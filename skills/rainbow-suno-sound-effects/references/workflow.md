# 声画与归档约定

## 按画面选择声音

| 画面用途 | 声音候选 | 对齐依据 | 留白与混音 |
| --- | --- | --- | --- |
| 镜头进入宏观场景 | 低频渐起、空气感、短音乐性抬升 | 真实进入/揭示时刻 | 不与解说第一句争抢 |
| 组件拆开、装配完成 | 移动纹理与一次轻接触 | 动作速度、真实接触帧 | 不为每颗螺丝堆冲击声 |
| 计算收敛、规划提交 | 克制的确认音/和声解决 | 状态 commit 帧 | 不把候选变化全当完成 |
| 子弹时刻、认知转折 | 音乐抽空、短空气尾音 | 解释时钟进入冻结 | 冻结声音状态和实体一致 |
| 高潮与大尺度运镜 | 与 BGM 调性/节拍相容的纹理 | 实测音乐窗口、镜头落点 | 音乐已有重击时优先减音效 |
| 水、风、机械持续运行 | 氛围或有依据的连续声音 | 实体状态、相对速度与距离 | 关键公式阅读时降低密度 |

这些是可选方法。苏诺输出是设计声音/音乐性素材，不代表实录或物理声学仿真；精确机械瞬态可改用现有程序音效或已许可素材。

## 提示词与生成

先描述声音角色，再描述音色与能量包络，避免只写“炸裂、高级”。例如用于海面揭示的候选：

> 无人声、稀疏的电影氛围器乐，柔和空气纹理从弱到强，低频缓慢展开，中频留出讲解空间，单次清晰但不过载的揭示重音，柔和自然衰减；不用密集鼓点与主旋律。

描述是创作目标，不保证输出严格匹配。对纯音乐使用 `instrumental=true`；按官方契约选择其余参数。先生成一个有用途的候选，再根据实际结果裁剪或修改，不默认批量消耗积分。保留提交的 prompt、实际模型 ID 和返回的任务 ID；不要在提示词里夹带本地私密信息。

## 事件与时间

复用既有模板：
`C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/examples/sound-design/production-cue-sheet.json`。

每个 cue 对应真实 `eventId` / `eventAnchor`，保存 `assetId`、`assetSyncSeconds`、`offsetMs`、`gainDb`、`pan`、`priority` 和 `reason`。

`soundStartSeconds = eventFrame / fps + offsetMs / 1000 - assetSyncSeconds`

不要把素材起点当作冲击峰值；在波形与实际声音中找到同步点。解说改稿、镜头变速或事件帧改变后，重排相关 cue 并复查 AAC 编码结果。生成的音乐片段不应直接拉伸去凑每次动作，尤其不可连同旁白一起减速。

## 中央音效库

```text
D:/projects/tts/音效/
  <project-slug>/<cue-id>/<job-id>/
    raw/<original-file>
    processed/<edited-file>.wav
    metadata.json
```

项目、cue 和 job 用可识别的唯一目录名。raw 保留下载的原始格式；processed 可按工程需要做 48 kHz WAV，但不要把重采样描述为提升了原始音质。工程引用绝对路径并保留资产清单；可携带交付包需要音效副本时，只复制用到的文件和许可说明，不搬走中央原件。

归档命令使用 PowerShell 7（pwsh），只读取本地文件，不访问网络、不调用生成、不覆盖已有任务：

```powershell
& 'C:/Users/USER/.codex/skills/rainbow-suno-sound-effects/scripts/Save-SunoSound.ps1' `
  -SourceFile '<已下载音频的绝对路径>' `
  -Project 'pid-drone' -Cue 'assembly-reveal' -Job '<本次唯一任务目录名>' `
  -TaskId '<实际苏诺任务编号>' -MetadataFile '<填写后的元数据 JSON>'
```

元数据模板在 `../assets/metadata-template.json`。保留原始任务编号和非敏感业务结果，不保存授权 URL、凭证、请求头或网站 Token。素材地址若含签名只作临时下载定位，不写永久清单；使用非敏感作品页或任务编号追溯。许可依据需从实际账号/作品条款核验；生成成功不等于商用许可已核实。

## 完成检查

- 文件实际存在、可解码，采样率/声道/时长由媒体探测取得，SHA256 正确。
- 自然尾音未误切、接缝无爆音、实际同步点与画面匹配。
- 按旁白、音乐、音效、氛围分轨；对白清楚、音乐高潮不堆叠重击。
- `review` 仅记录已执行的检查；短音效无法得到可靠 LUFS 时保留 null。
- 未完成授权、余额不足、任务未知、下载失败均保存明确状态，不能标成可用素材。
