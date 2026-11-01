# 编排与悬念

需要先写清楚故事、重排讲解或去掉空泛表达时，读 [文案与剪辑逻辑](../../assets/style-lab/guides/script.md)；公开研究依据在 [叙事学习记录](../../assets/style-lab/studies/story-craft.md)。具体脚本用 [75秒分镜](../../assets/style-lab/examples/storyboard/cup-75s.json)作为可修改实例，不固定照搬情节。

按当前画面问题阅读 [编排与悬念的候选与选择方法](../../assets/style-lab/guides/storytelling.md)，查看每个候选的用途、阶段、参数和边界。

[模块代码](../../assets/style-lab/lab/modules/storytelling.js) 与 [统一接口说明](../../assets/style-lab/lab/modules/API.md)可直接接入按帧渲染。先在 [方法库](../../assets/style-lab/使用说明.md)对比动作，再把选用清单交给当前工程；不要只换配色充当多种方案。

需要让一个物体贯穿数个问题时，读 [洗牌叙事与解释节奏](../../assets/style-lab/guides/shuffle-story.md)与[全片研究](../../assets/style-lab/studies/shuffle-story.md)。先用可见操作建立规律，再压缩重复；关键反转完成后留结果观察位，结论随后进入。研究的41条记录来自可见字幕，不是已听审旁白。

在 [洗牌解释工作台](../../assets/style-lab/lab/shuffle-story.html)选择适合当前问题的候选；[shuffle-explanation.js](../../assets/style-lab/lab/modules/shuffle-explanation.js)用同一批对象接入公式或状态回扣。示例时长和牌数服务于当前解释，不固定为所有科普片的段落配方。

从 [MOFs 文案研究](../../assets/style-lab/studies/mofs-script.md)学习具体操作怎样降低术语门槛：方框→重复→缩小→化学映射→命名。诺奖信息在对象建立之后出现。读 [迁移指南](../../assets/style-lab/guides/mofs-writing.md)，把“句子提出的问题、对应动作、下一句的来由”一起写，避免只有修辞没有解释。

[MOFs 文案工作台](../../assets/style-lab/lab/mofs-writing.html)提供 `story-mofs-result`、`story-mofs-build`、`story-mofs-predict`。三者前12秒选择不同入口，其后共享同一讲解对象和几何条件，均为38秒原创分镜计划；可以逐句改写、保存本机草稿、导出原句和改句，交给配音与正式场景重新校时。读取 [接口](../../assets/style-lab/examples/mofs-explanation/API.md)后接入代码，保留观察窗口、来源和“通过孔口不等于吸附”的边界。
