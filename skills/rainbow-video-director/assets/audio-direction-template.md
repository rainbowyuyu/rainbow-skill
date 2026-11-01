# {项目} · 配音与音效导演任务

交付范围：{提示词设计 / 样段 / 完整制作}。按用户已明确的范围执行，不重复确认。本模板是写作提纲；先交一段完整声音导演正文，技术字段只在需要交接/制作时补充。主题、目标受众、事实来源、用户声音和原音乐分别来自{输入}。

共用{contract版本/SHA}，本层不单独改变全片时间。读语言与声音参考中的适用部分，借鉴其因果/焦点接力，避免逐字抄参考音轨。

## 语言谱

逐条填写 `cue_id / display_text / spoken_text / narrative_role / direction / emphasis / context / planned_window / semantic_event / pronunciation_watch / exit_handoff`。关键处给相邻两句及视觉结果。段落时间说明哪句继续、哪句结束、何时观察，不凭字数捏造词级时间戳。

每句表演说明要能听出差别，包含起句、连读、落重音、收尾和接下一句的理由。字幕使用规范稿；读音辅助不外露。真正生成后补 `raw_sha / selected_take / measured_duration / word_alignment / listening_scope`。计划时这些字段留空。

后端能力记录：{当前用户选择、官方资料、真实入口、部署回执、本人音色与试音验证范围、未确定项}。效果意图与接口参数分开；不虚构参数、不继承其他供应商的能力。

## 音效谱

逐事件填写 `cue_id / source_class / source_object / listener_space / trigger_event / onset_intent / peak_or_contact / tail_and_exit / narration_protection / music_relation / omit_if / asset_path / asset_sha / asset_sync_seconds / listening_status`。素材未选择时对应字段填 null。

先描述材质、重量、距离和动作，再选音色。写清重复行为的次数与停止条件；机关未锁定不先响确认声。设计音和真实记录分开，数据听觉化保留量纲与映射。跟随实际动作同步，不能让字幕刷新次数决定声效密度。

按 [音效选材与融合](../references/sound-sourcing-and-mix.md) 为每cue补充 `decision(include|omit) / method / layer_role / candidates / selected_take / rejection_reason`。`method` 是非空描述字段，不是固定枚举：设计阶段可写 `existing-library-or-freesound` 等候选路由，选中资产后改为实际 `reuse`、`freesound`、`suno`、`local-synthesis` 或 `licensed-recording`；省略项写 `decision=omit, method=omit`。需要执行时保存检索词或真实生成配方、来源ID/作品页、许可事实、download_kind、处理顺序、实际时长和SHA；Freesound的公开版下载是MP3预览，不写成生成或原始WAV。只写提示词时素材和测量值保持null。

将 `asset_sync_seconds / offset_ms / start_seconds / exit_seconds / gain_db / pan / tail_policy` 写进唯一声音谱。起点按 `event_time + offset_ms/1000 - asset_sync_seconds` 计算；声源状态、接触和完成分别绑定事件。使用 [局部声音谱示例](sfx-cues-example.json) 和 `scripts/validate_sfx_cues.py --stage design|production` 做结构核查。既有cue表可映射字段，不能再手工维护第二套时间线。

## 融合导演

以片内时间列出有意义的动作/语句段与音乐源映射。为知识段、展示段、等待段、高潮和收束写不同听觉重心。提供至少一个完整的“前句尾→音乐接手→动作结果→音乐让位→后句头”例段；每项给进入/停留/退出及失败症状。全片应清楚、有推进、有静处，素材数量由叙事决定。

## 审查

先找旧稿最具体的问题cue，按实际问题修订；复杂任务再做独立试用，保留尚未核查的项。提示词阶段检查句子、项目实际时长覆盖、共享事件、音乐身份与状态诚实性；制作阶段再听原声和最终混音。交付以完整声音导演提示词为主，按需要附分谱、融合段落和来源；生成、试听和派发没有做就不写完成。
