# 本机案例索引

2026-09-23 成果，先检查存在性。正常使用本技能不依赖这些绝对路径。

目录：`D:/projects/manim_extend_rainbow/video_project/publication_2026-09-23`

- `covers/总览_横版16x9_1920x1080.png` 与竖版：猫爪与机械手连接能力端点。
- `covers/第一章_横版16x9_1920x1080.png` 与竖版：猫脸、像素与特征层。
- `covers/AI进化史_合集总封面_1x1_1080x1080.png`：六主题同处立体实验台和金色路径。
- 2026-09-24 新增 `covers/*4x3_1440x1080.png` 与 JPG：总览、第一章及合集；原比例封面保留。
- `compose_4x3_covers.py`、`layouts-4x3/*.json`、`layout-4x3.json`：独立裁切、排版及零新增生成费用记录；`4x3封面总览.jpg` 为三张对照。
- `compose_covers.py`、`compose_collection_cover.py`：特定底图的排版，可优先沿用做小改。
- `artwork/*-request.json`、`*-status.json`、`collection-cover.json`：参数与记录。
- `research/封面与平台研究.md`：当时的来源和证据边界。

第二章已交付结构基线（2026-10-02 核对）：

- 目录：`D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch02_creation/publication/taxue_ch02_2026-09-28/`。
- `layout_landscape.json`、`layout_9x16.json`、`layout_3x4.json` 对应 V6；`layout_4x3.json` 对应 V7。已与实际成图、布局报告、`qa.json` 和布局锁核对。四版均左对齐、左上品牌、无装饰短线；3:4 无独立副标题。
- 可移植快照在技能 [assets/ch02-approved-layouts.json](../assets/ch02-approved-layouts.json)，使用时不需要旧工程存在。字体和 Logo 保留 SHA-256 供验证；具体章节文案与旧主角保护框不作未来内容要求。

第三章《语言连接万物》早期封面案例（2026-10-01，仅查素材历史，不作为当前排版默认）：

- 工程目录：`D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch03_language/cover/`
- `artwork/ch03-attention-v8.png`：基于正片既有 `public/media/v2/03-attention.png` 的无字底图，左侧留出连续暗部，右侧加入克制的注意力汇聚线与节点。
- `output/ch03_language_connection_16x9_1920x1080.png`、`output/ch03_language_connection_4x3_1440x1080.png` 及对应 JPG、320/160 px 缩略图和 layout report：可作为技术教学章节的排版与验收范例。
- `README.md`、`source-record.json`、`layout-16x9-v8.json`、`layout-4x3-v8.json` 保存实际文字、裁切、来源、哈希与人工检查范围；这是本机案例，不是新任务的固定路径或默认标题。

原字体在 `D:/projects/manim_extend_rainbow/video_project/ai_evolution_trailer/public/fonts/`：`NotoSansSC.ttf`、`NotoSerifSC.ttf`，许可 `OFL.txt`、`OFL-serif.txt`。技能不重复打包大字体，向新项目复制字体时携带许可。模板可替换为任意已授权、覆盖所用中英文的字体。Logo 已随附，不依赖旧工程存在。
