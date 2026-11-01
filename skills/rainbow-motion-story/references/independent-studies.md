# 参考作品的独立方法研究

研究日期：2026-10-23。原始学习目录为 `D:/projects/manim_extend_rainbow/research/motion_atelier/`；技能内的 [预览与研究副本](../assets/style-lab/使用说明.md) 可独立运行原创候选。原视频不复制，使用本地既有媒体映射按需复看。

本轮复核8张全片概览和24组密集窗口，共711个精确PTS静态样本。此前1×静音播放记录另外保留。这不是逐帧看完八条全片，也没有主观听审。音轨研究使用限定窗口的RMS、频谱变化和视觉事件近邻。

| 原作 / 指定学习方向 | 具体迁移 | 研究记录 | 优先代码候选 |
|---|---|---|---|
| 浙大猫学长·汽车飞行 / 连贯动效 | 同一黄线从候选图进入道路，实体量接到公式 | [汽车](../assets/style-lab/studies/car-ignition.md) | visualization-route-bridge、visualization-entity-formula |
| 浙大猫学长·AI绘图 / 表示转换 | 纸面进入空间、分布接到方向、擦除时保留解释锚点 | [初次研究](../assets/style-lab/studies/ai-draw.md) · [深入研究](../assets/style-lab/studies/ai-draw-deep.md) | visualization-paper-space、visualization-directed-flow、visualization-observation-fan |
| 世界的暗线·洗牌 / 音效与节奏 | 交织、归拢、摊开各有落定，快变后读结果 | [洗牌深入研究](../assets/style-lab/studies/shuffle-rhythm.md) | rhythm-braid-settle、rhythm-state-relay；[三种配声](../assets/style-lab/lab/shuffle-rhythm.html) |
| 小事儿·数据传输 / 模糊与视觉 | 高速运输与稳定读数分开，保持发收关系 | [传输](../assets/style-lab/studies/transmission.md) | look-multisample-shutter、rhythm-explanation-hold |
| 叶子的AI视界·审美 / 跨材料风格 | 同心轮廓、材料文字、宏观回到小物 | [深入研究](../assets/style-lab/studies/aesthetic-deep.md) · [初步记录](../assets/style-lab/studies/aesthetic.md) | look-scale-return、look-type-material、look-editorial-cutaway、look-industrial-focus、look-orbital-return |
| 炫酷的Mr氧·MOFs / 文案吸引力 | 方框操作→尺度缩小→化学映射→命名，答案带出下一问 | [深入文案研究](../assets/style-lab/studies/mofs-script.md) · [初步观察](../assets/style-lab/studies/mofs.md) | story-mofs-result、story-mofs-build、story-mofs-predict；[改写工作台](../assets/style-lab/lab/mofs-writing.html) |
| 木韦Muwei·38种运镜 / 景深机位 | 区分机位、焦距与焦点；按观察任务交接清晰度 | [深入研究](../assets/style-lab/studies/camera-depth.md) · [光学核对](../assets/style-lab/studies/camera-depth-technical.md) | camera-focus-handoff、camera-focus-track、camera-parallax-reveal；[焦点与空间](../assets/style-lab/lab/camera-depth.html) |
| AI牧羊人Lab·转子 / 机构剖切 | 同一运动状态连接控制与反馈，开盖、拆解和观察分别控制 | [交互研究](../assets/style-lab/studies/rotary-interaction.md) · [运动学核对](../assets/style-lab/studies/rotary-kinematics.md) | mechanics-rotary-section、mechanics-rotary-explode；[机构工作台](../assets/style-lab/lab/rotary-interaction.html) |

以上为原创方法复现，不是原作者源码复刻。立方晶格示例借鉴局部到整体，不称真实MOF分子结构；轨迹桥接不是原片优化求解器；材料文字和程序火焰不称真实燃烧或路径追踪。

音效拆为原创air/tick/tap/resolve与四种动作事件表；提供乐句切换和人声让位的A/B样例，详见 [声音研究](../assets/style-lab/studies/audio-analysis.md)。近邻频谱峰不能直接命名声音来源，自动测量不能替代主观听审。

每种候选的用途、参数、阶段与来源ID由代码元数据一起保存。先看目标动作是否解决本片问题，再接数据与美术资源；不要把全部候选串成固定模板。


汽车飞行新增[连续性深挖](../assets/style-lab/studies/car-ignition-deep.md)：29张联系表、606个抽取条目（542个不同源帧），重点检查喷嘴回装、环境退场和黄线入街道；新增两个原创候选，并修复既有路径侧视退化和速度箭头归零问题。逐帧静图、稀疏播放截图与音轨听审分别记录，不合并称为完整实听审片。

AI绘图新增[深入研究](../assets/style-lab/studies/ai-draw-deep.md)：560个采样条目，去重为493个唯一源帧，组成27张联系表，已全部完成静态审阅；这不等于逐帧观看全片。另有35–46秒、112–126秒、165–179秒三个窗口的1×静音浏览器播放记录，记录证明播放运行，不能称为连续人类观看；原音未主观试听。各窗口的实际终点与证据见研究记录。

新增候选按 [观察任务选择风格](../assets/style-lab/guides/generative-style.md)：`visualization-paper-space` 用 [paper-space.js](../assets/style-lab/lab/modules/paper-space.js) 保留平面顶点与卡片身份；`visualization-directed-flow` 与 `visualization-observation-fan` 用 [generative-flow.js](../assets/style-lab/lab/modules/generative-flow.js) 分别展示先方向后运动、只擦上层而保留底部关系。接入说明分别为 [纸面接口](../assets/style-lab/examples/ai-draw/paper-space-api.md)、[方向与观测接口](../assets/style-lab/examples/ai-draw/generative-flow-api.md)。这些是原创表现样例，不是原片源码、真实扩散或布料求解；按主题单独选用，不把三种画风串成固定模板。

洗牌追加研究记录245条采样、210个唯一源帧与15张联系表，全部静态审阅；四个窗口有1×原声播放运行日志。0–138秒混合音轨完成双声道能量、瞬态候选与38项视觉边界对照，未主观听审或识别具体音色。新增[三配法工作台](../assets/style-lab/lab/shuffle-rhythm.html)与[接口](../assets/style-lab/examples/shuffle-rhythm/API.md)，原创18秒动作支持绝对时间定位，音效来自同一事件表。两段无音效读窗是原创设计，不冒称参考原片静音配方。

洗牌新增[全片讲稿与视觉结构研究](../assets/style-lab/studies/shuffle-story.md)：补查476条静态采样，去重为434个源帧，共23张联系表；41条可见字幕经底部字幕条核对。字幕记录不等于语音转写，也不证明旁白语气或无字幕处没有声音。六段1×静音浏览器运行的范围以 `evidence/shuffle-story/browser-playback.json` 为准，运行日志不称连续主观观看；原声未新增听审。

按 [洗牌叙事与解释节奏](../assets/style-lab/guides/shuffle-story.md)选择实体到乘积、状态回扣等原创候选，在 [解释工作台](../assets/style-lab/lab/shuffle-story.html)对照，代码见 [shuffle-explanation.js](../assets/style-lab/lab/modules/shuffle-explanation.js)。实现将实体落定与结论提交分开，滚动数值到终值后才显示等式；参考的颜色身份、阶段停留和表示交接按当前主题选用。32位容量、226位必要条件及完美外洗周期各有前提，不把画面上的数值直接推广到其他算法。

传输片新增 [效果复用指南](../assets/style-lab/guides/transmission-effects.md)与 [双视图工作台](../assets/style-lab/lab/transmission-effects.html)，原创 `look-tracking-exposure` 对比相机跟随下的时间曝光，`visualization-window-relay` 演示同一窗口和确认事件的接力。[技术核对](../assets/style-lab/studies/motion-blur-technical.md)实际访问4份Blender/Unity官方资料并核验12条短摘录，作为自己的实现依据；它不识别原片引擎。参考观察、浏览器运行与主观听审分别保留范围。

审美方向补充 [公开设计资料核对](../assets/style-lab/studies/aesthetic-design-principles.md)：读取 NN/G 与 IBM Carbon 的三份正文，核验七条短摘录；将层级、相似性及颜色角色用于原创方案选择，未据此识别原作者引擎或取得私人提示词。[指南](../assets/style-lab/guides/aesthetic-direction.md)与[三方案工作台](../assets/style-lab/lab/aesthetic-direction.html)比较同一圆环的纸白剖面、黑场微距和暖色尺度回收。代码和状态见 [接口](../assets/style-lab/examples/aesthetic-direction/API.md)，几何事实固定，构图和运动各有用途；此项设计资料任务没有新增原片播放或听审。

MOFs 新增 [全片文案拆解](../assets/style-lab/studies/mofs-script.md)：从467个半秒间隔样本组成41张证据页，逐页静态审阅覆盖392个唯一源帧；可见字幕、播放运行和声音听审分别记录。开头从方框操作进入化学结构，中段沿“连接弱会散、增强后难纠错”推进，结尾回到有来源的晶体观察。不是467帧逐张核对或完整语音转写；科学关系另读 [三份诺奖官方资料](../assets/style-lab/studies/mofs-writing-principles.md)。

[文案工作台](../assets/style-lab/lab/mofs-writing.html)提供结果回看、连接搭建、几何预测三套38秒原创分镜；逐句改写按候选保存在本机，导出保留原句、改句与来源。读 [迁移指南](../assets/style-lab/guides/mofs-writing.md)选择入口和中段组织，再用 [接口](../assets/style-lab/examples/mofs-explanation/API.md)接入模型与真实配音。孔口通过只做理想几何演示，内表面停留没有计算吸附，不称实际晶体或真实分子轨迹。

木韦运镜新增 [景深与机位研究](../assets/style-lab/studies/camera-depth.md)：全片按2秒间隔定位，重点复核失焦转清晰、前后景移焦、变焦和地形飞越，密集采样范围及已阅页数见记录。五段1×静音浏览器播放另存日志，不能把播放运行称为连续主观观看。原片的“光学拉焦”标签和画面实际的取景范围变化分别记录；334秒附近的场景切换已更正，不把两条案例合成一条连续飞越。

[焦点与空间工作台](../assets/style-lab/lab/camera-depth.html)提供三条14秒原创镜头，分别演示固定机位移焦、移动追焦、侧移揭示。支持光圈、焦距、手动焦平面、同帧全清晰对照，以及相机/焦点JSON和PNG导出。[接口](../assets/style-lab/examples/camera-depth/API.md)规定轴向对焦距离和米/毫米单位；使用时必须换成真实场景锚点。薄透镜弥散圈驱动的分层高斯用于预演，不称光追或真实散景。Blender、Three.js、Filament和PBRT的9份已读技术资料支持自己的光学实现，不反推原作者参数。

转子新增 [控制与反馈研究](../assets/style-lab/studies/rotary-interaction.md)：复核四张已有联系表，三组密集表共90个采样画面；三段新增1×静音播放的准确范围单列记录，未实听原声。画面支持开盖显露结构、滑杆与读数联动及透明模式的观察用途，不证明切面算法、准确转速、功率求解或源代码绑定。透明切换处还伴随视角与数值变化，不能据此推断透明开关改变功率。

[机构工作台](../assets/style-lab/lab/rotary-interaction.html)提供移开前盖、沿轴拆解两个18秒原创候选，状态和接入见 [接口](../assets/style-lab/examples/rotary-interaction/API.md)。展示操作与运动相位解耦，三顶点和读数保持同一身份；[NASA与数学资料核验](../assets/style-lab/studies/rotary-kinematics.md)支持自己的3:1运动学。当前直边转子限制 `e/R≤0.25`，不冒充13B曲面、密封或燃烧模型；几何验证、界面操作与视觉审阅分别验收。


新增第九条：[Inspire King·Anatomy 可拆解原理](../assets/style-lab/studies/anatomy-mechanics.md)。公开页面观察机械按键、布光与发动机的局部画面；读取固定提交的10份文本，重点核对百分表、Raptor拆解与交互实现，未执行上游代码。没有整片逐帧观看或主观听审。

[按键工作台](../assets/style-lab/lab/switch-anatomy.html)提供 mechanics-switch-section 和 mechanics-switch-explode。迁移重点是解释分组与承载归属分开、从同一模型求反馈、装配前置条件，以及反转和中间状态检查。[指南](../assets/style-lab/guides/anatomy-mechanics.md)附可复制任务书，[接口](../assets/style-lab/examples/switch-anatomy/API.md)说明原创机构与展示边界。

## Lemo Opuscar：媒介与风格选择

来源为LemoLab的 [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)，固定提交 `3961ddb3d24d8876e0e2754f7790d66908acee51`（2026-10-22）。59种现成风格与98份电影风格档案分开研究，阅读范围逐条记录；电影档案提供提示与镜头方向，不被计为98套独立实现。1,895份文本和源码缓存核对固定Git blob及SHA256，未执行上游代码。

[风格图谱](../assets/style-lab/lab/lemo-atlas.html)提供157项中文分析、分类筛选、比较、选用清单与题材JSON。157张来源缩略帧已观察，完整原片播放与主观听审仍为0；静帧判断不能替代时间连续性和配声核验。研究分册为 [A](../assets/style-lab/studies/lemo-analysis-a.md)、[B](../assets/style-lab/studies/lemo-analysis-b.md)、[C](../assets/style-lab/studies/lemo-analysis-c.md)，来源与许可见 清单（外部或本机资源，未随公开包收录）。

14项原创局部试作把媒介约束转成代码，包括色版乘色、像素路径、球车惯性、固定纸铰链、皮影铆点和精确计数。按[使用指南](../assets/style-lab/guides/lemo-opuscar.md)从观察任务选主风格，再借[接口](../assets/style-lab/examples/lemo-opuscar/API.md)接入自己的时间线。它们是无声的表现练习，不能标成157种影片已完整复刻；Canvas材质不等于光追，运动学示意不等于真实动力学。保留MIT、CC BY 4.0与LemoLab署名，第三方许可另核验；正式配音继续用用户自己的TTS。
