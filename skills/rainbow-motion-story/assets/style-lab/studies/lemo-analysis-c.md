# Lemo Opuscar 学习 C 组：信息演示、动画、游戏与材质

研究对象为 [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)，固定提交 `3961ddb3d24d8876e0e2754f7790d66908acee51`（2026-10-22）。本组覆盖现成风格目录索引 40–58，共 19 种；以及 OPUSCAR 98 的编号 67–98，共 32 条电影风格档案。结构化结果见 lemo-analysis-c.json（外部或本机资源，未随公开包收录）。

源码索引中的 `inspectedFiles` 均相对上游仓库根目录；每项 `inspectedFilesBase` 固定到本研究提交的 GitHub 目录。STYLE/DEMO 链接使用随包保留的 evidence 副本，源码链接使用公开固定提交，不依赖安装时的 work 缓存。

## 阅读与核验边界

19 种现成风格均读了 `STYLE.md` 中定义、材质、文字、运动、镜头、问题章节的核心段落，完整读取配色与声音章节；`DEMO.md` 阅读故事、镜头及相关问题段落。部分长章节为摘读，不能表述为两份文档逐字通读。每种风格另核对了一个关键源码文件的实际函数或段落。JSON 的 `inspectedFiles` 记录文件，`verification.readScope` 记录范围。

32 条电影风格档案均逐项读完中文 `prompt_zh`、`direction_zh` 与完整镜头表。它们是提示与导演档案，不等于 32 套可直接交付的完整工程，也不等于已核验电影原片。此组没有观看媒体、没有运行源工程，没有听审，因此 `frame` 与 `playback` 均为 `false`。根代理另行查看的来源联系表应独立记录，不能覆盖此组的原始证据状态。

整个来源缓存共 1,895 个文本/源码文件、20,484,493 字节，均对照固定提交的 Git blob SHA1 校验，并记录 SHA256；错误数为零。没有执行下载的代码、没有保留二进制视频、静帧或配音。下载与文件存在只支持来源可用，不证明风格效果已复现。

## 最值得分开的六种空间语法

| 方向 | 真正决定样貌的操作 | 原创教学迁移 |
|---|---|---|
| 等距信息图 | 固定 30° 投影，三个固定面色；相机只平移与对数缩放；切线先于切开动作 | 一滴水贯穿处理流程，数量由图标累加，最终全图能核对 |
| 全息 HUD | 数据线框、扫描平面、局部装配轴、目标框引导镜头；数值完成后停靠 | 先给出编码器结构，再由同一角状态计算读数 |
| HD-2D | 3D 像素布景、受光平面角色；角色低帧率，镜头/灯光/焦点连续 | 携带一个信号穿过网络，亮度同时驱动灯与状态 |
| 移轴 | 透视城市、窄清晰带、快速时钟；关键事件下潜并回到实时 | 大系统的吞吐在一个路口停下，观众看到瓶颈原因 |
| 低多边形岛屿 | 正交真 3D、平面法线、无贴图、视锥高度变焦；生长事件写音符 | 电网逐块生长，日落时负荷显现，缺失连接成为问题 |
| 玻璃产品 | 灯条环境、材质层、微距移焦与轴向展开；色散只在厚玻璃边缘 | 精密模块拆解后解释介质与极板，再回装看结果 |

不能将这六种方向归为同一个“高级 3D”。它们对透视、材质、角色帧率、文字位置和相机都有不同约束。移植其中一招时先确定观察任务，再检查另一套语法是否被破坏。

## 从实际代码读到的可迁移方法

- [iso-infographic/demo/engine.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/iso-infographic/demo/engine.js)：`P()` 与 `unP()` 配对；绘制队列按图层、深度与稳定序号排序；`tri()` 由单色生成暖亮面和冷暗面。近景过大物体与组合物需要特殊排序，单纯 painter sort 并不解决所有遮挡。
- [dark-keynote/demo/film.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/dark-keynote/demo/film.js)：冻结期间各对象读取同一截断时刻，相机独立推向光标；缩放在对数空间插值。冻结不能只停一层而让卡片内容仍滚动。
- [living-screencast/demo/main.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/living-screencast/demo/main.js)：`getBoundingClientRect()` 反算界面坐标，向导真正站在 DOM 元素上；相机速度驱动各向异性模糊，慢移动保持文字清楚。这个模糊是近似，不是曝光子帧积分。
- [hologram-hud/demo/engine/holo.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/hologram-hud/demo/engine/holo.js)：模型正规化时同时变换顶点、锚点、拆解向量、旋转轴；相机用目标、偏航、俯仰、距离和视场构建。若只缩几何，标注与拆解会脱离。
- [rubber-hose/demo/toon.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/rubber-hose/demo/toon.js) 与 [scifi-toon/demo/toon.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/scifi-toon/demo/toon.js)：先把轮廓投到屏幕再描边，特写线宽不随世界缩放变粗；线条抖动由 12fps 三态控制。
- [cel-anime-80s/demo/cel.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/cel-anime-80s/demo/cel.js)：形状与其偏移副本使用 even-odd 差集形成硬边亮/暗新月，底色、阴影、高光、彩色描边分层。需要发光的像素应另有遮挡正确的发光层。
- [midcentury-toon/demo/engine/toon.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/midcentury-toon/demo/engine/toon.js)：`reg()` 由确定性散列按 12fps 产生套色偏移；填色与线稿分开，文字的底色版也使用同样逻辑。
- [pixel-rpg/demo/px.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/pixel-rpg/demo/px.js)：索引缓冲与 LUT 分离；少量保护色不受调色表变化影响。低色深映射使用亮度阈值，不能按颜色排序随便降级。
- [hd-2d/demo/post_ts.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/hd-2d/demo/post_ts.js)、[tilt-shift/demo/post.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/tilt-shift/demo/post.js)：物理深度和屏幕清晰带进入同一有符号 CoC；前景与远景模糊方向分开，避免背景溢到清晰主体。
- [microgame/demo/timeline.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/microgame/demo/timeline.js)：固定或变化 BPM 生成同一拍点数组；分段时间、命令、成功结果一起记录，声画不各写一个时钟。
- [game-show/demo/main.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/game-show/demo/main.js)：实际常量为 150 BPM，文件开头旧注释仍写 140 BPM。学习参数应读执行值，不从注释抄数字。`render(t)` 根据当前段设置显隐与相机冲量。
- [silent-film/demo/shots.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/silent-film/demo/shots.js)：姿态和数值都按关键表插值，`palmsAt()` 使用同一骨架求握持坐标；接物在两掌之间，旋转由路程与半径关联。
- [backrooms/demo/main.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/backrooms/demo/main.js)：先以 1/240 秒步长累计路径长度，步态相位由距离驱动；屏息包络同步压制摇摆与呼吸。无阴影局部灯阵不是光追照明，需防穿墙光。
- [brick-toy/demo/bricks.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/brick-toy/demo/bricks.js)：真实单位、倒角凸粒、清漆与程序粗糙度贴图共用；大底板的反射应与积木区别处理。
- [paper-popup/demo/cutmesh.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/paper-popup/demo/cutmesh.js)：正反卡面共享轮廓 alpha，`MeshDepthMaterial` 使用相同 alphaTest，投影才是剪纸外形；容器内部要夹在前后卡片之间。
- [lowpoly-island/demo/sea.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/lowpoly-island/demo/sea.js)：CPU 与 shader 使用同一 `waveH`，浮标能跟同一表面高度，但这只是正弦波表现，不能叫作真实流体解。
- [glass-product/demo/studio.js](https://github.com/lemomo-ai/lemo-opuscar/blob/3961ddb3d24d8876e0e2754f7790d66908acee51/styles/glass-product/demo/studio.js)：移动灯条后更新 PMREM 环境；地板包含程序焦散和镜面近似，不能把“看起来物理”写成真实光追通过。

## 声音学习：绑定动作，保留媒介差异

这里只做了声音章节的文字阅读，没有听审或生成音频。下面是可选组织方法，不是通用混音指标；源文档的固定响度、duck 数值和 TTS 速度不能覆盖用户自己的自然语速与现有 TTS 工作流。

| 风格组 | 可复用的声画关系 | 需要检查 |
|---|---|---|
| 等距信息图 | 图标累积触发同一乐句；进入下一站前轻提前站点环境；层层推进时逐层拿掉乐器 | 高频环境不可粘在词尾；数字与声事件共用计数 |
| Dark keynote / HUD | 乱时音色分散、归位后同音色同调；冻结让音效与混响也停；参数值落定才确认 | Foley 也需给人声让位；不能把所有数值都配响 |
| Living screencast | 界面用清晰机械键声，像素向导用低位深提示，两层可接力 | 音效别压产品名起音；操作节奏保持真实 |
| Rubber hose / 默片 | 乐器替物体行动发声；静止时保留放映或房间质感；旋律回答动作 | 只是可选短类比，不能用夸张声音替代科学因果 |
| 80s cel / Sci-fi toon | 速度与引擎同源；揭示之后音乐撤开给反应；各世界用音色变化，但主线动机保留 | 变体要有理由，不能每一镜重新换歌 |
| Mid-century | 每一步一组和声，结尾按同顺序回顾；关键接触前短留白 | 步骤数字可读，塑料/纸/金属接触音与材质一致 |
| Pixel RPG / HD-2D | 降色深时同步减少声部；实际灯亮时发声；环境按地点交叉渐变 | 不套游戏音效；不强制放慢旁白或改变用户声线 |
| Microgame / Game show | 共用拍点表，每关核心命令只发一次；失败回放时计时器和声节奏一起变 | 不从别处复用受限配音；快段仍有结果阅读窗口 |
| Backrooms | 声音来自画内，灯曲线同时开关嗡声，距离与遮挡塑造空间 | 不能用惊吓音补逻辑；告示/对白仍要听清 |
| Brick / Paper | 每个卡扣、纸铰链、翻页对应材质声；失败或犹豫时剩房间声 | 避免把每块每帧都做声，音效随事件而非帧率 |
| Tilt-shift | 快时钟让音乐承担流动，回实时后听见实际路面和微小事件 | 变速必须来自统一时间映射，不能截断声尾 |
| Lowpoly / Glass | 生成事件写入音符表；玻璃灯扫与相同事件的晶体音相连；回装是主落点 | 光脉冲不是科学数据时标清楚，不以全屏闪替冲击 |

## 电影档案的迁移方式

编号 67–98 的学习目标是把“媒介 + 运镜 + 叙事关系”拆开，重新服务原创主题。JSON 中每条都有独立练习，避免只是把主角换进原电影场面。尤其可选择：

- 70：蓝图立起并显影，适合设计到实体；原动画只是演示，需另外建立真实尺寸与数据。
- 74：公式落在窗上，先操作和观测再连符号；很适合让公式不再脱离物体。
- 78、90、97：分别研究曝光轨迹、水下光传播、湿地反射。三者的光源、承载面和观察角不同，不能用同一发光贴图混充。
- 82、92：手册爆炸轴与建筑二等角剖切，适合可拆机械和楼层内部；切口厚度、锚点与前后关系要真实一致。
- 87、98：第一人称/跟随广角和极长焦压缩，分别检空间穿行与视觉距离错觉；机位不能只用名字标签替换。
- 93：低密度色粉暮色可作为有内容的观察停顿；不能为凑时长插一段无信息空景。
- 95：不同假设拥有不同世界，但一个共同锚点保持追踪；适合反事实比较而不是无目的炫技跳切。

## 授权与来源保留

代码和文档为 MIT，版权标示 `Copyright (c) 2026 LemoLab`。若复制源码，保留许可及来源。示例视频、静帧为 CC BY 4.0，使用时署名 LemoLab、链接仓库并说明改动；第三方素材另看各示例 `CREDITS`。

三个配音例外不复用：`game-show` 的 macOS `say` 喊声、`paper-lantern` 的 Microsoft Edge TTS 旁白、`news-package` 的 Doubao TTS 旁白。研究风格不等于获得原电影、人物、角色、商标或音乐的使用权；当前原创练习不需要这些素材，也没有调用它们。

下一步由总任务在原创工作台中实现不同媒介、检查连续播放和随机定位，再把已验证结果单独记入试做记录。此研究文件不把源码学习或静帧联系表写成动画复现验收。
