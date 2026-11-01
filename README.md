<p align="center"><img src="docs/assets/rainbow-logo.png" width="96" alt="rainbow鱼"></p>
<h1 align="center">rainbow-skill</h1>
<p align="center"><strong>把想法讲清楚，把画面做出来。</strong></p>
<p align="center">故事 · 设计 · 运镜 · 声音 · 科学可视化 · 制作与验证</p>
<p align="center">
  <a href="skills/rainbow-video-director/SKILL.md">从导演技能开始</a> ·
  <a href="CATALOG.md">全部技能</a> ·
  <a href="docs/INSTALL.md">安装与使用</a> ·
  <a href="THIRD_PARTY.md">来源与许可</a>
</p>

这是 rainbow鱼 在科普、动画与工程创作中整理的技能库。它把长期积累的制作方法拆成可以按需读取的技能、参考手册和代码示例，也保留所使用的第三方工具的来源。

这里的导演稿要能直接交给制作环节：主体怎样变化，镜头何时停稳，公式为什么出现，音乐在哪里接手，每一段都要说清楚。写了提示词、跑通脚本、真正看过成片，是三个不同的完成状态。

## 从一条工作流开始

|你现在想做什么|推荐入口|能带走什么|
|---|---|---|
|把一个想法写成可制作的影片|[Rainbow 视频导演](skills/rainbow-video-director/SKILL.md)|总导演稿、完整分段提示词、音画时序与验收安排|
|学习运镜、节奏和可视化表达|[动效与叙事方法](skills/rainbow-motion-story/SKILL.md)|按问题查技法，阅读研究记录和可复用源模块|
|改善构图、文字与材料质感|[Huashu Design](skills/huashu-design/SKILL.md)|从题材推导形式的设计方法，保留原作者规则|
|做故事化科普|[Science Video](skills/science-video/SKILL.md)|让生活问题、机制与应用形成一条理解链|
|让本人配音自然地融入画面|[Qwen 配音](skills/rainbow-qwen-narration/SKILL.md)|完整语义合成、听审和实际音长校时的工作流|
|为动作配置合适声音|[Suno 音效编排](skills/rainbow-suno-sound-effects/SKILL.md)|声音事件、素材归档与围绕旁白的混音方法|
|做科研图表与演示|[科研图形](skills/scientific-figure-style/SKILL.md) · [演示制作](skills/advanced-presentation/SKILL.md)|可追溯数据、清楚层级与可编辑交付|
|准备封面和发布文案|[视频封面](skills/rainbow-video-cover/SKILL.md) · [发布文案](skills/rainbow-science-promo-copy/SKILL.md)|与正片内容一致的传播入口|

## 这版导演技能怎样工作

借鉴 **huashu-design 的组织方式**，把入口写成一条容易执行的路线：先明确职责与交付，再走主流程，遇到具体问题才读对应模块。

```mermaid
flowchart LR
    A[值得看完的问题] --> B[从内容推导形式]
    B --> C[按当次音乐安排呼吸]
    C --> D[完整分段与镜头接力]
    D --> E[高风险样段与整片验证]
    E --> F[回写经过验证的经验]
```

- **每段可执行。** 给出入口状态、动作、准确文字与口播、镜头路径、声音、实现和出口，不能只列形容词。
- **按这首音乐编排。** 读取当次音乐，分析速度候选和结构变化；镜头、文字、旁白与音效使用同一条时序。换曲就重新映射。
- **呼吸来自注意力。** 动作有准备、推进、落定和观察。公式可以静止，音乐可以单独接手一段已经讲清楚的结果。
- **从最难的一秒开始。** 先验证变形、交互和接缝，再扩展整片。检查通过的范围写明白。

原来的运镜、光影、水体、公式、文案和声音手册继续保留。本机工具配置独立于导演方法，换电脑不需要把整份技能推倒重写。

## 直接这样用

```text
使用 $rainbow-video-director，为“为什么平均更快的路线反而容易迟到”
写一支约五分钟科普视频的完整导演提示词。

从一次真实可想象的选择切入。中段用短推导解释概率，
再用光追和天气展示同一个方法的不同用途。
音乐使用我提供的文件：先分析实际结构，再安排镜头和讲解的呼吸。
这次只交导演稿，不生成整片。
```

```text
使用 $rainbow-video-director 修复这个片段。
保留已确定的风格，检查字幕阅读、镜头速度和音乐接缝。
交付改后片段，并说明实际观看与听审了哪些时间窗。
```

## 安装

需要 Python 3.10+。安装器只复制选中的公开技能及其仓库内文档依赖，不安装软件、不配置账号，也不覆盖已有技能。

```bash
git clone https://github.com/rainbowyuyu/rainbow-skill.git
cd rainbow-skill
python scripts/install.py --list
python scripts/install.py --skill rainbow-video-director --dry-run
python scripts/install.py --skill rainbow-video-director
```

默认目标为 `$CODEX_HOME/skills` 或 `~/.codex/skills`。Claude、Cursor 或项目内安装使用 `--target` 指定目录。已有同名不同内容会停止并列出冲突；不会为了安装删掉你的工作。详见 [安装指南](docs/INSTALL.md)。

## 全部技能怎样整理

本次快照：**2026-11-02**。

|层次|数量|内容|
|---|---:|---|
|公开源码包|31|个人工作流与有明确可分发许可证的第三方技能|
|本机技能总目录|180|259 个环境入口按真实路径和内容归并；包含上面的源码包|
|仅保留目录记录|149|系统随附或尚未核实完整分发许可的技能，保留来源线索|
|插件技能索引|121|按提供方、插件与版本记录，交由原插件安装更新|

同名但内容不同的技能保留环境后缀。计数表示本机整理范围，不代表所有技能都是本仓库原创，也不代表全部已在每个客户端运行验证。

[分类目录](CATALOG.md)面向阅读；[catalog.json](catalog.json)面向程序。原始视频、抽帧图库、模型权重、个人声音参考、授权文件与机器专用配置不在仓库中。历史实验室的独立源模块和学习手册有选择地保留，完整实验室并未伪装成无需素材即可运行的应用。

## 目录

```text
rainbow-skill/
├── skills/             公开技能正文、参考手册和代码
├── catalog/            未打包技能的来源记录
├── catalog.json        完整机器可读目录
├── docs/               安装、环境与维护说明
├── scripts/            安装与仓库检查
├── CATALOG.md          分类导航
└── THIRD_PARTY.md      来源、许可与公开版修改范围
```

## 使用前知道这些

方法与能力分开：浏览器、Blender、FFmpeg、模型和外部服务需要在你的环境里实际配置。示例路径是模板，不代表已安装。Qwen 本人声音是作者工作流的默认选择，仓库不附声音或模型；Base 的情绪与语速方向是编辑、听审目标，不虚构原生控制参数。

音效生成按实际任务和服务授权执行。WaterPro 等授权资源只能从自己的合法来源获取，本库只保留接入经验。任何脚本涉及发布、删除、付费或账户变更，都仍需要当前任务范围内的授权。

## 来源与致谢

导演技能的组织与审美适配参考了 [花叔的 huashu-design](https://github.com/alchaincyf/huashu-design)。技能库同时记录了 motion、Manim、Lemo Opuscar、声音选材及其他创作者的学习来源；具体归属见各目录和 [THIRD_PARTY.md](THIRD_PARTY.md)。

**本仓库没有用一份 MIT 许可覆盖全部内容。** 第三方代码、字体与素材保留各自条款；没有明确许可的条目不因出现在目录里而获得新的分发授权。公开版做过路径模板化和资源裁剪，相关说明位于各技能的 `PUBLIC-NOTES.md`。

<p align="center">rainbow鱼 · 从具体的问题出发。</p>
