# 音乐与呼吸

按当前画面问题阅读 [音乐与呼吸的候选与选择方法](../../assets/style-lab/guides/rhythm.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/rhythm.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。

整片音乐重排与人声让位另见 [音乐主导剪辑](../music-led-edit.md)。信号测量和主观听审分别记录。

动作缺少轻重、停顿或明确落点时，读 [速率曲线与表达](../../assets/style-lab/guides/rate-curves.md)，使用 [同画面对照](../../assets/style-lab/lab/rate-curves.html)。它把属性值曲线、有符号速度和素材变速分开；`rate-curves.js`提供确定性曲线、物理弹簧、Bezier反解、倍率积分和弧长查表。相同曲线在不同时长/距离下表达不同，不把某个参数固化为所有影片的规范。

处理音效选择、接触同步、尾音过长或声音堆满时，读 [音效选择与时机](../../assets/style-lab/guides/sound-design.md)，使用 [音效时机工作台](../../assets/style-lab/lab/sound-design.html)对照五类问题。新代码按事件锚点排声音；原 `sound-preview.js` 继续用于候选的节奏草稿。研究来源与实际访问范围见 [声音研究](../../assets/style-lab/studies/sound-design.md)。

实际视频剪辑需要新音效素材时，按用户偏好读取 [苏诺音效接入](../../../rainbow-suno-sound-effects/SKILL.md) 与 [TTS 工程的归档流程](D:/projects/tts/SUNO_SOUND_EFFECTS.md)，依据画面事件自主选择适用素材。Suno.cn 当前提供音乐生成与音频处理，不把它写成已验证的独立 text-to-SFX 或精确拟音接口；需要精确短促接触声时，继续比较本库的确定性合成或有许可的声音。用户指定 BGM 和既有个人配音不自动替换。音效保存到 `D:/projects/tts/音效/<project-slug>/<cue-id>/<job-id>/`，与画面共用事件锚点，分轨检查并记录真实听审状态。

需要让动作有明确的情绪、并把音效配到加速/制动/接触时，使用 [运动情绪与声音](../../assets/style-lab/guides/emotion-motion.md) 与 [同动作换声工作台](../../assets/style-lab/lab/emotion-motion.html)。[Jun参考研究](../../assets/style-lab/studies/emotion-motion.md)区分实际画面观察、混合音轨测量与原创配置，复现时间组织而非复制原片。

连续微动作需要组织成段时，读[洗牌声画方法](../../assets/style-lab/guides/shuffle-rhythm.md)，使用[同画面三种配声](../../assets/style-lab/lab/shuffle-rhythm.html)。它把精选接触、密集轻触与连续摩擦分开比较，52张牌共用一条绝对时间线。原片画面停住不自动代表声音静音，混音瞬态数也不等于音效数；来源与实际范围见[洗牌深入研究](../../assets/style-lab/studies/shuffle-rhythm.md)。
