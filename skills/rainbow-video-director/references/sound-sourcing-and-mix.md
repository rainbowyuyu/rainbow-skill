# 音效选材、生成与落画面

声音从事件开始：观众需要听见谁在做什么、身处何处、什么时候发生变化。先写听觉任务，再选已有素材、Freesound、程序设计音或苏诺；不是把工具有的声音全用一遍。本参考用于声音制作，共用全片主时钟，保留用户的 BGM 与当前项目已确认的配音方案；新项目使用全局默认的本地 Qwen 本人配音，入口见 `D:/projects/tts/QWEN_NARRATION.md`。

## 按目的选路

| 需要解决的问题 | 优先路径 | 产物与边界 |
|---|---|---|
| 已有素材能准确表达动作 | 查中央库和本片已选音色 | 复用相同哈希/处理版，避免每镜重新生成 |
| 卡扣、脚步、纸张、开盖、金属碰触等具体动作 | `sound` 从 Freesound 选真实来源候选 | 公开脚本取 MP3 预览；原件依实际站点流程，不声称已取无损 |
| 需要精确可控的短确认、抽象脉冲或数据听觉化 | 已有本地程序合成或本片编写的小配方 | 保存真实代码/版本/seed/参数；标设计音，不冒充机械实录 |
| 连续水、风、机械运行的空间与材质 | 先查已有库，再按状态选连续录音/设计循环 | 描述录音环境，实测循环点；随距离/转速变化，不能每帧重播 |
| 原曲之间的蓄势、空气氛围、柔和揭示、音乐性尾音 | `rainbow-suno-sound-effects` | 保留实际 task ID，单次提交后查询；生成结果需选段，非专用精确拟音模型 |
| 旋律/鼓点本已表达落点，或观众正在理解术语 | 省略新音效 | `decision=omit`，保留理由；无旁白不等于无音乐，无音效也可有节奏 |

`sound` 的安装入口是 `C:/Users/USER/.codex/skills/sound/SKILL.md`。2026-10-30 公共仓库版本只有搜索、筛选、预览下载。它不包含所谓完整版的生成/混音服务，不因其推广或网络排错建议购买服务、改代理。Suno当前仍按官方包调用；精确瞬态不强行用长音乐生成来代替。

## 一段声音如何为故事服务

- **开场**：先让物体/现象的一个特征声立住，随后用尺度变化、一次强落点或瞬间留白吸引注意。强烈不等于所有轨道都大声，先对比不加冲击的版本。
- **拆解与教学**：重要结构移动有材质纹理，真正到位才有接触声；公式的高亮通常不用响，因果状态确认才考虑短音。让术语和自然人声处在前景。
- **对照**：保持听者位置和基准响度相近，用真实动作的持续时间/阻力/颗粒度区分对象；不能把不同音量偷换成不同物理量。
- **高潮**：先看原曲乐句与画面落点，必要时让旁白停下来。接触声对接触，音乐剪法对乐句；两者不合就删冗余击打或调整剪辑，不能移动已经确定的物理事件。
- **收束**：留下环境连续性或让一个尾音越过切镜，再把听觉焦点交回最后的完整一句。尾音不能盖住轻声字尾。

## 从动作到可检索候选

声源/材质、动作、力度、听者距离四项比“高级炸裂”更有用。先具体查询，结果太少时逐步去掉修饰。

| 画面 | 英文查询起点 | 应核对 | 常见误配 |
|---|---|---|---|
| 小卡扣打开 | `latch unhook`、`small latch click` | 单次解锁、短干声、无额外动作 | 用关门重击表示小扣松开 |
| 金属组件落座 | `metal mechanical click`、`metal part contact` | 体量、接触后余振、一次到位 | 长电影低频轰鸣盖过零件本体 |
| 轻卡片或纸张移位 | `paper slide`、`paper flick` | 摩擦颗粒、运动长度 | 所有UI都配喷气飞机whoosh |
| 物体近处掠过 | `short soft whoosh`、对应真实声源 | 素材峰值、声像移动、尾部噪声 | 相机绕静物一圈却给物体飞行声 |
| 旋翼飞行 | `quadcopter hover`、`drone pass by` | 悬停/加速/掠过状态、距离 | 不同镜头每次从电机启动声开始 |
| 细水接触与气泡 | `small splash`、`water drip`、`underwater bubbles` | 空气/水下听域、体积、接触时刻 | 一滴水配巨浪、相机未入水先水下滤音 |

先看来源与描述，下载量/评分人数只用于同样适配候选之间比较。网页描述可能被脚本截到90字符；关键候选核对作品页。为每个选择记 `query / fs_id / title / author / reported_duration / downloads / rating / candidate_reason / rejected_because / source_page / license_evidence / audition_state`。无需让每个cue都凑满三条。

## 下载、归档与处理

先搜索再用返回的 `fs:ID` 下载到当前工程的新暂存目录；不能猜ID，不能凭退出码0宣称批量全成功。下载后探测和完整解码。公开版的 `hq.mp3` 仍是预览，原文件名含 `.wav` 不代表拿到了 WAV。

通用归档工具将核验后的文件集中保存，命令参数以 `--help` 为准：

```powershell
$soundPython = 'D:/projects/tts/.venv/Scripts/python.exe'
& $soundPython -X utf8 'C:/Users/USER/.codex/skills/sound/scripts/archive_sound.py' `
  --source '<已取得的本地文件>' --source-metadata '<本片来源记录.json>' `
  --project '<项目slug>' --cue '<声音事件slug>' --take '<唯一候选ID>'
```

来源JSON必需 `provider / sourceId / sourcePage / licenseLabel / licenseUrl / downloadKind`；未知事实用null，不默认CC0。可加title/author/attribution/licenseEvidence/recipe。Freesound的sourceId为实际fs:ID，downloadKind为mp3-preview-hq；Suno为真实任务记录；本地配方保存代码、参数与seed，不伪造远端任务。

中央路径沿用 `D:/projects/tts/音效/<project>/<cue>/<take>/raw/`、`processed/`、`metadata.json`。归档保留原始编码/字节/SHA；不覆盖旧take。已有苏诺归档流程可以继续用 `Save-SunoSound.ps1`，不把同一文件再归档一次。工程保存资产清单、选中版本和事件引用。

处理在新 `processed` 文件做，记录源区间、采样率、增益、淡化、滤波、变速（若有）与顺序。48 kHz WAV是混音中间格式，不会恢复MP3缺失细节。同步点必须相对最终选择的处理版测量；不能仍引用raw的坐标。保留尾音，需缩尾时选衰减区并淡出，不能硬切瞬态或机械动作中途。

## 事件、层次与落点

动作起动、最接近听者、接触、锁定完成是不同事件，各自绑定 `event_id`。声音起点通常早于内部冲击峰，但实际冲击不能提前。只有设计上有理由才使用offset：例如远处实物声传播延迟，或清楚标记的预示音，不用offset遮盖错位。

`start_seconds = event_time + offset_ms / 1000 - asset_sync_seconds`

若算出负起点，不能直接钳到0；需要留出片头前置空间，或截取有意义的源段并重新测量同步点。事件变动从同一contract重新计算，不手改另一个时间表。

同一事件可以组合短瞬态body与细微摩擦texture，但每层有明确角色；一个薄卡片不需要低频撞击、枪声、风声同时堆叠。多个声音共享事件时写不同 `layer_role`，避免误触发同层两次。最突出者只有一个，其余作材质支撑。

循环声音按实体的运行状态保持一条连续声床，转速/负载/距离可驱动音量、频谱与音高包络。运动模糊与画面速度变化不自动等于物体发声变化；多普勒应关联声源与听者的相对径向速度，不能仅凭摄影机转角瞎拉音高。抽象速度音可另标designed。

## 与配音、音乐融合

先锁完整自然旁白，再在真实词组与句尾之外找空间。一次声音的优先调整顺序可按问题选择：减少不必要层→错开关键词瞬态→改尾音/频谱→调整增益与声像→必要时做包络让位。不是每次都堆侧链压缩。

旁白前略提前降低BGM与长氛围，按整句话保持、尾字结束后平稳恢复；攻击/释放长度按音乐与句子试听选择，避免逐字抽吸。音效若带明显旋律，核对与BGM的调性和节奏；用户原曲已经承担高潮时优先不给第二段旋律。

近场声可更干更清晰，远场需更小、更少高频及合理环境尾音；镜头切入室内/水下时从真实听域事件开始交叉过渡。声像遵循画面或明确主观听点，单声道折叠后仍需有核心信息。不凭某个统一dB或LUFS值保证所有对白清晰。

## 一段12秒的设计示例

这是设计例，不是生成或听审结果；[JSON声音谱](../assets/sfx-cues-example.json) 可复制并改成实际项目事件。例中的增益和声像仅用于演示字段，尚未绑定源电平或实体位置，不能直接当混音预设。仅写文字方案时可保留待定；制作谱中的数值须按真实素材重新设定并试听。

| 时段 | 视听任务 | 选择和退出 |
|---|---|---|
| 0–4.0s | 旁白交代部件关系，机械实体靠近 | 环境低留；不为每个零件/字幕加声 |
| 4.0–4.9s | 4.4秒单次接触并锁定 | 短干瞬态对真实接触；余振保留，不能用解锁录音冒充锁定而不核对 |
| 4.9–7.5s | 显示结构关系，旁白讲清因果 | 干音退场，音乐让位；读取公式时可以完全不加效果 |
| 7.5–8.7s | 实体在8秒掠过听者最近点 | 掠过峰对最近点，与装配接触是不同声源/事件 |
| 8.7–12.0s | 镜头完成揭示，原音乐在10.2秒接手 | 音乐已承担落点，省略额外hit；下一句完整起句前自然退让 |

## 结构核查与听审分开

局部声音任务也能运行，无需凑齐四层包：

```powershell
& $soundPython -X utf8 'C:/Users/USER/.codex/skills/rainbow-video-director/scripts/validate_sfx_cues.py' `
  '<sfx-cues.json>' --stage design --contract '<contract.json>'
# 选定真实资产后：--stage production
```

省略contract参数可检查局部独立设计例；实际影片应传入当前主契约。schema含 contract_version/duration_seconds/fps/events/assets/cues，事件time与主契约一致。每cue的 `decision / method / asset_id / asset_sync_seconds / offset_ms / start_seconds / gain_db / pan / tail_policy / exit_seconds / review` 分清计划和实测。设计阶段允许null素材并报告pending；production必须核文件、SHA、实际时长和同步点，但它依然不代表听感通过。

既有项目若已有camelCase声音谱，保留原表作为唯一源，只生成派生验证输入：`eventId + eventAnchor` 取对应帧并除以fps，`assetSyncSeconds→asset_sync_seconds`，`offsetMs→offset_ms`，`enabled→decision`。不能维护两套互相手改的时钟。

检查看得见的接触→单听选中声音→声音与动作→旁白+BGM全混→最终编码。记录实际听审片段、文件SHA和具体问题。声音谱 `review` 统一为 null=未核查、true=已核查通过、false=已核查但需修复；归档元数据里的 `...Checked` 布尔字段只记录是否执行检查，false不代表听感失败，导入声音谱时应映射为null。峰值只是找瞬态的候选位置，可能不是语义接触；零交叉、响度和无削波都不能替代判断。
