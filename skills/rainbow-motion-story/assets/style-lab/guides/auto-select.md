# 从一份 brief 生成分镜级技法选型

[选型器源码](../examples/auto-select/select.py) · [科普 180 秒 brief](../examples/auto-select/brief-science-180s.json) · [产品 30 秒 brief](../examples/auto-select/brief-product-30s.json)

这份指南解决的不是"这个视频该用什么风格"，而是"第 3 拍到第 8 拍，每一拍用什么技法、多长、配哪一层声音、依据是哪份研究"。选型器把 `assets/style-lab/guides/` 与 `references/` 里已经写清楚的技法，按需求特征映射到段类型，再按时间预算排出时间轴。

它是一张**有出处的规则表**，不是风格推荐引擎。输出的每一条都带 `techniqueId`、`moduleIds`、`refs` 和 `risk`，可以逐条回到研究文件核对。

## 什么时候用

| 情况 | 用它 | 不要用它 |
|---|---|---|
| 拿到一个主题，只知道时长和画幅，不知道从哪一段开始搭 | 先跑一次，拿到骨架再改 | 已经有成片结构，只想改一处缓动 |
| 长片（60 秒以上）需要段落配比与节奏检查 | 用 `segmentBudget` 看每段该分多少秒 | 把 `segmentBudget` 当硬规范 |
| 想确认某个技法到底支撑哪类段 | `--technique` 反查 | 用反查结果直接当验收 |
| 事实、公式、数值还没核实 | 先核实，再选型 | 让选型器补科学内容（它不会，也不该） |
| 需要的风格在规则表里没有 | 手工 `overrides` 指定，或补一条规则 | 硬套一个关键词相近但用途不同的技法 |

一句话：**它决定结构分配与技法候选，不决定内容真假，也不决定片子好不好看。**

## 运行

只依赖 Python 标准库。在 `assets/style-lab/examples/auto-select/` 下：

```bash
python -I select.py --brief brief-science-180s.json      # 输入 brief，输出 plan JSON
python -I select.py --brief - < brief.json               # 从 stdin 读
python -I select.py --technique mf-trace-assembly        # 反查技法
python -I select.py --technique explain-                   # 按段前缀列全部解释段规则
python -I select.py --list                                # 段类型、枚举值、全部规则 id
python -I select.py --schema                              # brief 字段说明
python -I select.py --self-test                           # 自检
```

`-I` 让解释器忽略当前目录的模块，避免工作目录里被放一个同名 `json.py` 之类的东西顶掉标准库。

`--self-test` 检查：五个段类型都有规则、规则 id 唯一、每条规则都能追溯到 `assets/` 或 `SKILL.md`、180 秒与 30 秒两种长度的时间轴首尾闭合、没有低于 1 秒的拍、反查能命中。当前 12 项全部通过。

## 输入格式

```json
{
  "title": "文档标题，可空",
  "topic": "一句话说清主题；用于关键词匹配",
  "duration": 180,
  "aspect": "16:9 | 9:16 | 1:1 | 4:5",
  "genre": "science | mechanism | product | world | data | tutorial | story",
  "tones": ["curious", "calm"],
  "need_sound": true,
  "must_explain": ["必须讲清的点", "逐项检查有没有技法接得住"],
  "audience": "观众已有知识，可空",
  "overrides": {"explain": ["explain-blender"], "hook": "hook-symbolic-objects"}
}
```

只有 `duration` 是必需的，其余缺项走默认：`science` / `16:9` / `["curious"]` / `need_sound: true`。

`must_explain` 不是装饰字段。每一项都会做双向子串匹配，匹配不到就写进 `unresolved`，明确告诉你"这一条没有技法接住，需要手工选段"。选型器不会为了填满时间轴，把一项没匹配的讲解内容硬塞进某个看起来相近的技法。

## 输出结构

```text
schema          版本号
brief           归一化后的输入（未知枚举会被改写并记入 unresolved）
segmentBudget   每段该分多少秒、占比多少
timeline        逐拍：起止、时长、技法 id、模块 id、参数、声音层、命中的需求特征、风险、出处
techniqueSet    去重后的技法清单
soundPlan       声音层的使用统计与一句话落点规则
unresolved      需要人处理的项
limits          选型器不负责的东西
```

### 段类型与默认配比

| 段 | 默认占比 | 承担什么 | 拍数上限 |
|---|---|---|---|
| 钩子 hook | 12% | 给一个能指认的对象、能回答的问题或一次具体失败 | 2 |
| 解释 explain | 52% | 建立条件、发生变化、看清结果 | 6 |
| 对照 contrast | 14% | A/B 比较、三种方向、动作语气差别 | 3 |
| 揭示 reveal | 14% | 局部放大、形状里放进另一个世界、结构生长 | 3 |
| 收束 close | 8% | 旧对象变形提出新问题、让观众做一次预测、落版 | 2 |

三个调节器会在默认配比上继续改：

1. **短片去掉对照**：时长 < 45 秒时，对照段没有空间，其份额 60% 并入解释、40% 并入揭示。需要 A/B 时用 `overrides` 手工加回。
2. **单段上界**：钩子 12 秒、收束 10 秒、对照 20 秒。超出的秒数并入解释段。钩子拖过 12 秒就变成正文了。
3. **解释段上界**：6 拍 × 30 秒。超过的秒数分给揭示段，避免出现一条 100 秒的长镜。

每次发生重排，`unresolved` 都会留一条记录，说明改了多少秒、为什么改。

### 打分规则

同一段内所有规则按下面这几项累加，得分高者优先。同分按 id 字典序，保证同一份 brief 每次都得到同一份计划。

| 特征 | 分值 |
|---|---|
| genre 命中该技法的主用途 | +5 |
| genre 命中该技法的次用途 | +4 |
| genre 不匹配 | −2 |
| 每个 tone 命中 | +2 |
| tone 全不命中 | −1 |
| aspect 在该技法适用画幅内 | +2 |
| 每个关键词命中 topic / title / must_explain / audience | +2 |
| 时长落在该技法常见尺度内 | +1 |
| 时长短于该技法常见下界 | −1 |

一条规则可以带多个技法（如 `explain-camera-focus` 同时含移焦、追焦、视差三个模块），选出后按拍序轮流使用不同模块，避免连续几拍都是同一个动作。

## 输出示例一：科普 180 秒横屏

输入（[brief-science-180s.json](../examples/auto-select/brief-science-180s.json)）：MOF 多孔结构，180 秒，16:9，science，curious + calm，要音效。

实际运行 `python -I select.py --brief brief-science-180s.json` 的结果：

段预算 `hook 12.0 / explain 112.8 / contrast 20.0 / reveal 25.2 / close 10.0` 秒。原始按 12/52/14/14/8 分是 21.6 / 93.6 / 25.2 / 25.2 / 14.4，三个上界把钩子、对照、收束各自截断，溢出共 19.2 秒并入解释段。

| 拍 | 段 | 起止(s) | 时长 | 技法 id | 技法 | 声音层 |
|---|---|---|---|---|---|---|
| 1 | 钩子 | 0.00–6.00 | 6.00 | `hook-object-first` | 物件先行：先给一个能指认、能追踪的对象 | contact |
| 2 | 钩子 | 6.00–12.00 | 6.00 | `hook-question-open` | 问题先行：先给出一个能回答的问题 | silence |
| 3 | 解释 | 12.00–30.80 | 18.80 | `explain-formula-link` | 参数驱动实体：一个量同时决定图形与读数 | sonification |
| 4 | 解释 | 30.80–49.60 | 18.80 | `explain-trace-assembly` | 按含义分组逐层生长：支架→路径→闭合→命名 | contact |
| 5 | 解释 | 49.60–68.40 | 18.80 | `explain-focus-handoff` | 注意力窗口沿连续路径交接 | air |
| 6 | 解释 | 68.40–87.20 | 18.80 | `explain-spatial-data` | 从实体到数据再回到动作 | sonification |
| 7 | 解释 | 87.20–106.00 | 18.80 | `explain-linework` | 线稿的体积、材料与过程 | contact |
| 8 | 解释 | 106.00–124.80 | 18.80 | `explain-shuffle-beat` | 多次重复动作的疏密与取样 | bed |
| 9 | 对照 | 124.80–131.47 | 6.67 | `contrast-rate-ab` | 同画面换曲线：只改时间分配 | silence |
| 10 | 对照 | 131.47–138.14 | 6.67 | `contrast-card-convergence` | 三卡汇聚成一个关系 | confirm |
| 11 | 对照 | 138.14–144.81 | 6.67 | `contrast-aesthetic-3way` | 三种视觉方向对照，不只换配色 | bed |
| 12 | 揭示 | 144.81–153.21 | 8.40 | `reveal-lattice-growth` | 结构生长：从一个单元长成整体 | sonification |
| 13 | 揭示 | 153.21–161.61 | 8.40 | `reveal-camera-move` | 镜头运动揭示空间关系 | air |
| 14 | 揭示 | 161.61–170.01 | 8.40 | `reveal-shape-into-world` | 形状里先放进另一个世界，再停顿、再扩大 | bed |
| 15 | 收束 | 170.01–175.01 | 5.00 | `close-question-return` | 旧轨迹变形成新问题 | bed |
| 16 | 收束 | 175.01–180.00 | 4.99 | `close-prediction` | 让观众用刚学的关系做一次预测 | silence |

命中的需求特征（`why` 字段）逐拍写好，例如第 3 拍：`genre=science；tone=curious/calm；aspect=16:9；关键词命中：比表面积、量级、来源`；第 1 拍命中关键词"装"（来自 topic 里的"装下"）。第 3 拍对应的出处是 [manim-formula-language.md](../guides/manim-formula-language.md)（每个符号记录 `quantityId / role / unit`）、[3b1b-manim-source.md](../studies/3b1b-manim-source.md)（研究范围是官方示例 12 个类与四组源码）和 [rate-curves.md](../guides/rate-curves.md)（时长减半时速度变 2 倍、加速度 4 倍）。

这一份的 `unresolved` 只有三条预算重排记录，没有未覆盖的讲解项：`must_explain` 里的"比表面积的来源与量级"命中 `explain-formula-link` 的关键词，"几何示意与真实材料吸附的区别"由 `reveal-lattice-growth` 的 risk 字段（不能把位置示意说成吸附仿真或实际晶体）承接。

### 读这份结果时要改什么

- 第 1–2 拍是**两个钩子**。180 秒的片子可以这样，但两拍的语气要分工：第 1 拍给对象，第 2 拍才提问。若旁白撑不住 12 秒，`overrides` 把 hook 改成单条 `hook-result-first`，剩下的秒数会并回解释段。
- 第 3 拍 18.8 秒讲公式偏长。`explain-formula-link` 的时长域是 5–14 秒，这里为了填满解释段被拉长；实际制作应拆成"符号身份 → 参数联动 → 读数核对"两拍，或把第 7 拍 `explain-linework` 换成 `explain-camera-focus` 换成更短的镜头。
- 第 9–11 拍三连对照共 20 秒，对科普片偏多。只保留 `contrast-rate-ab` 即可，另两拍的秒数并回解释。

这类判断无法写进规则表，必须人看输出后改。选型器给的是**可以直接改的骨架**，不是终稿。

## 输出示例二：产品 30 秒竖屏

输入（[brief-product-30s.json](../examples/auto-select/brief-product-30s.json)）：卡片式素材管理器，30 秒，9:16，product，brisk + warm，要音效。

实际运行结果：

```text
时长 30 秒 < 45 秒：已去掉对照段，其份额 60% 并入解释、40% 并入揭示。
```

段预算变成 `hook 3.6 / explain 18.12 / reveal 5.88 / close 2.4`。

| 拍 | 段 | 起止(s) | 时长 | 技法 id | 技法 | 声音层 |
|---|---|---|---|---|---|---|
| 1 | 钩子 | 0.00–3.60 | 3.60 | `hook-type-orbit` | 环形字粒收束到一句可读标题 | air |
| 2 | 解释 | 3.60–9.64 | 6.04 | `explain-ui-relay` | 界面对象接力：同一素材跨容器移动 | contact |
| 3 | 解释 | 9.64–15.68 | 6.04 | `explain-state-commit` | 状态提交与确认：反馈和结果分两个时刻 | confirm |
| 4 | 解释 | 15.68–21.72 | 6.04 | `explain-transmission` | 高速传输：跟随曝光与窗口接力 | air |
| 5 | 揭示 | 21.72–27.60 | 5.88 | `reveal-window-relay` | 窗口接力：局部放大后仍知道自己在哪 | air |
| 6 | 收束 | 27.60–30.00 | 2.40 | `close-title-hold` | 结论/片名稳定阅读收住 | bed |

`must_explain` 三项全部命中：`找到素材并选中` 与 `拖到时间线并提交` 由 `explain-ui-relay` 的"素材 / 选中 / 时间线 / 提交"接住，`结果确认` 由 `explain-state-commit` 接住。`unresolved` 只剩一条短片重排说明。

### 这份结果的三个问题

1. **竖屏 3.6 秒的钩子偏紧。** `hook-type-orbit` 的 `holdSeconds` 是 1.4，环阵收束本身要 1.2–1.8 秒，剩下不到 1 秒给标题阅读。实际制作要么把钩子延长到 5 秒（从解释段挪），要么换成 `hook-object-first` 直接把产品界面亮出来。
2. **第 4 拍 `explain-transmission` 没有关键词命中。** 它靠 genre 和 aspect 入选，属于"同段排序里的次优"。如果第 3 拍已经交代完提交，这一拍应该改成 `explain-ui-relay` 的第二个模块（`ui-identity-relay` 展开详情），或用 `overrides` 直接指定。
3. **收束只有 2.4 秒。** `close-title-hold` 的 `holdSeconds` 是 2.5，大于整拍时长。要么容差接受（落版只停 2.4 秒），要么把收束的 `MAX_SEGMENT_SECONDS` 从 10 调整到能容纳 3 秒。

这三个问题都不是 bug，是**规则表与具体项目之间的缝**。指南的作用就是把这些缝标出来，让人一眼看到哪里要动手。

## 反查：从一个技法名找它能支撑什么

```bash
python -I select.py --technique explain-ui-relay
```

```json
{
  "query": "explain-ui-relay",
  "found": true,
  "count": 1,
  "matches": [
    {
      "id": "explain-ui-relay",
      "technique": "界面对象接力：同一素材跨容器移动",
      "segment": "explain",
      "segmentName": "解释",
      "moduleIds": ["ui-identity-relay", "ui-click-to-timeline"],
      "typicalParams": {"holdSeconds": 1.8, "assetIdRequired": true, "liftToOverlay": true},
      "durationRange": [4.0, 10.0],
      "typicalBeat": 7.0,
      "sound": {"layer": "contact", "detail": "到达与提交分开；commit 才响确认"},
      "risk": "跨容器直接跳坐标，原容器会留下第二张主卡片",
      "refs": [
        {"path": "assets/style-lab/guides/ui-continuity.md", "claim": "先保存对象的屏幕矩形，提升到共同浮层，再交给目标容器"},
        {"path": "assets/style-lab/studies/max-ui-motion.md", "claim": "把找素材—导入—进入时间线连成一组明确动作"},
        {"path": "assets/style-lab/guides/ui-continuity.md", "claim": "大面板负责动，小文字负责读"}
      ]
    }
  ]
}
```

查询支持三种写法：

- 完整规则 id：`explain-ui-relay`
- 模块 id 或子串：`ui-identity-relay`、`mf-card`、`visualization-`
- 段类型前缀：`explain-`、`reveal-`、`contrast-`（列出该段全部规则）

反查结果里的 `durationRange` 是这个技法**不吃力**的单镜区间；把它当参考，不要当法规。`typicalParams` 是起点值，必须按对象尺度和旁白重调。

## 手工覆盖

`overrides` 的键是段类型，值是规则 id 或 id 列表。覆盖的规则排在最前，后面的拍才按打分继续选。

```json
{
  "duration": 60,
  "genre": "science",
  "overrides": {
    "hook": "hook-symbolic-objects",
    "explain": ["explain-formula-link", "explain-blender"]
  }
}
```

实测结果：钩子固定为 `hook-symbolic-objects`（`why` 写"手工覆盖"），解释段第一拍是 `explain-formula-link`，之后继续按打分选（`explain-trace-assembly`、`explain-focus-handoff`……）。60 秒片里解释段分到 31.2 秒、拆成 4 拍各 7.8 秒，两个指定规则用完后，剩余两拍回到排序。

覆盖的三种失败情况都会被记进 `unresolved` 而不是静默丢弃：

- 指定的 id 不存在 → "指定了不存在的规则，已忽略"
- 指定的规则属于别的段 → "属于 X 段，已忽略"
- 指定的规则数量少于拆出的拍数 → 多出的拍回到打分排序

需要临时加一个 A/B 对照段时，现在的做法是在 `overrides.contrast` 里指定规则；由于短片预算里没有对照段，这时还需要把 `duration` 提到 45 秒以上，或改 `SHORT_BRIEF_SECONDS`。这是当前实现的边界，写在这里而不是假装支持。

## 不能自动决定什么

这是整份指南最重要的一节。选型器只做一件事：**把需求特征映射到技法与时长**。下面这些它不做，也不该做。

### 1. 事实与科学数值

`explain-formula-link` 的 `params` 里有 `quantityIdRequired`，但它不会算出这个量是多少。MOF 的比表面积量级、转子发动机的转速与间隙、停车距离 `d = v²/(2a)`——这些必须来自用户提供的数据或可核验来源。

输出的 `limits` 字段每次都带这一条：**"选型器只安排技法与时长，不生成事实、公式结果、数值或科学结论。"**

规则表里的 `risk` 也在反复强调同一件事：

- `reveal-lattice-growth`：不能把位置示意说成吸附仿真或实际晶体
- `explain-spatial-data`：位置若代表真实数值，不能为了配乐改排名或相交点
- `contrast-rate-ab`：同时改颜色和曲线，就无法判断差别来自哪里
- `explain-blender`：世界运动与相机运动要分别求值，不能一起变速

### 2. 参考作品是否被真正看过

规则表的 `refs` 指向研究文件，但研究文件本身记录了观察边界。[lemo-opuscar.md](../guides/lemo-opuscar.md) 写明"157 张来源缩略帧已观察，原片完整播放与主观听审仍为 0"。选型器引用它，不代表这次任务已经看过原片。`soundPlan` 里的落点规则来自 [sound-design.md](../guides/sound-design.md) 的试做范围，不是人类感知阈值，也不构成听审结论。

### 3. 片子好不好看、讲没讲清

`--self-test` 能验证时间轴闭合、没有低于 1 秒的拍、每条规则可追溯。它验证不了：

- 18.8 秒讲公式，观众是否跟得住
- 三连对照是不是太多
- 旁白在这个语速下，第 5 拍的窗口接力来不来得及

这些只能在渲染后实际看、静音看、单独听。选型器输出的是**待验证的骨架**，`unresolved` 是它承认自己不知道的地方。

### 4. 关键词匹配的语义

`check_coverage` 用的是子串匹配。"比表面积"能命中 `explain-formula-link`，但"比表面积为什么大"这种问法不会命中任何规则——因为关键词表里没有"为什么"以外的问句模式。这不是缺陷，是设计：**匹配不到就报出来，而不是猜**。遇到这类情况，正确的做法是补一条规则，或在 `overrides` 里指定。

### 5. 版式与画幅的具体构图

`aspect` 只影响三处：规则是否适用该画幅、竖屏短段是否拆拍、关键词打分。它不决定安全区、字号、字幕位置。9:16 的 3.6 秒钩子偏紧这个问题，规则只能通过 `maxCharsPerLine` 给一个提示，具体怎么排要看实际画面。

## 维护规则表

新增一条规则时，四项是硬要求：

1. **`refs` 至少两条**，每条是 `(研究文件路径, 该文件支持的具体结论)`。结论要能被那句话核对，不能写成"参考了某风格"。
2. **`duration` 写真实不开心的区间**。写宽了会在长片上被拉长成一条没有落点的长镜，写窄了会让短段拆不出一拍。
3. **`risk` 写这条技法最典型的失败方式**，来自研究文件里的"容易失效的地方"或"不能声称"的部分。
4. **`moduleIds` 指向真实存在的模块或样例**。`--self-test` 不检查模块文件是否存在，但引用一个不存在的 id 会让输出无法落地。

修改规则表后跑一次 `python -I select.py --self-test`，再跑两份示例 brief 对比时间轴变化。规则表不是越全越好；一条没有真实出处、凑关键词的规则会让整张表的可信度下降。

## 与其它文件的关系

| 文件 | 关系 |
|---|---|
| [SKILL.md](../../../SKILL.md) | 总入口。按问题选模块的表是人工版，选型器是同一张表的可执行版 |
| [guides/](../guides/) | 每条规则的 `refs` 指向这里的具体结论 |
| [studies/](../studies/) | 观察边界与"不能声称什么"的来源 |
| [references/technique-handbook-20261023.md](../../../references/technique-handbook-20261023.md) | 技法总览；当前没有 `references/technique-index.md`，需按手册与 guides 目录查 |
| examples/storyboard/cup-75s.json（外部或本机资源，未随公开包收录） | 分镜 JSON 的字段样例；选型器输出的 `timeline` 可直接对照它的 `beats` 结构改写 |
| [lab/](../lab/) | 规则里 `moduleIds` 对应的可运行模块与工作台 |

选型器输出不是最终分镜文件。要接入制作，按拍把 `timeline` 改写成 `storyboard` 的结构，补齐 `narration`、`visual`、`anchorIn` / `anchorOut`，并按 [script.md](../guides/script.md) 核对每拍"观众原先的判断 → 当前证据 → 新判断"。
