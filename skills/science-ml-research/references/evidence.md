# 来源、证据和适配边界

核查日期：2026-10-29。

论文：Ming Zhong, Stacy Li, Nicholas Carlini, Matthew Jagielski. *Automating ML for Science: Can Frontier Agents Climb Scientific Hills in the Wild?* [arXiv:2610.28763v1](https://arxiv.org/abs/2610.28763v1)，2026-10-20提交。

代码：[maszhongming/agent4sci](https://github.com/maszhongming/agent4sci)，本次固定提交 `74b0e8c4dc55610072bed4326b6bfac24dc77377`，Apache-2.0。本技能参考其研究流程并作本机适配；未安装或执行上游runner与hooks。上游许可保存在本目录的 UPSTREAM-LICENSE（外部或本机资源，未随公开包收录）。

## 已核对的论文内容

| 内容 | 位置 | 能支持的判断 |
| --- | --- | --- |
| 12项原始任务有5项出现评价操纵 | [§2.2](https://arxiv.org/html/2610.28763v1#S2.SS2) | 指标、划分及产物需要核查；不能把最终自报分数视为充分证据 |
| 复现标准化＋改进/评价/审计三阶段 | [§2.3](https://arxiv.org/html/2610.28763v1#S2.SS3)、PDF p.4 Fig.2 | 学习阶段与最终评价应分开；真实隔离需额外实现 |
| 新颖性误判、资源空转、探索收缩 | [§4.1](https://arxiv.org/html/2610.28763v1#S4.SS1) | 需要有来源的构思、运行反馈与策略复盘 |
| 研究、实验、复盘三类技能 | [§4.2](https://arxiv.org/html/2610.28763v1#S4.SS2)、PDF pp.35–37 Figs.12–14 | 技能可以指导研究行为；夸张persona不是新颖性证据 |
| 平均相对基线改进10.4%→20.1%、4.4%→8.1% | [§4.3](https://arxiv.org/html/2610.28763v1#S4.SS3)、PDF p.9 Table2 | 特定模型、基准和预算下完整技能包的结果；不保证本机收益 |
| 长时间运行也会过拟合验证集 | [Appendix D.3](https://arxiv.org/html/2610.28763v1#A4.SS3)、Table9 | 预算增加不保证进步；需考虑独立评价及推理成本 |
| 无人类对照、技能过拟合和轨迹方差 | [Appendix A](https://arxiv.org/html/2610.28763v1#A1)、C.3 | 不能由平均数推导稳定模型排名或全流程科研能力 |

Agent4Sci包含20个benchmark、25项任务、11个科学领域。论文主实验每run为8张H200和12小时；这些不是本技能默认资源。基线为作者标准化复现值，部分协议与来源论文不同，见Appendix B.4。主要技能对照没有逐项消融，不能把收益全部归给某一个步骤。

CarbonGlobe三日实验报告验证改善37%、测试相对基线退化25%；Table9将测试数字标为single model，正文又讨论集成规模，精确重建需再核对产物。本技能仅用该案例说明泛化与成本边界。

## 核对过的代码

以下路径相对上述固定提交：

- `agent4sci/skills/agents/skills/research/SKILL.md`：领域/ML与结构/训练的四路检索、分层实验、假设登记。
- `agent4sci/skills/agents/skills/experiment/SKILL.md`：烟测、资源检查、失败诊断与提交要求。
- `agent4sci/skills/agents/skills/checklist/SKILL.md`：研究方向、运行情况、策略与下一步动作。
- `agent4sci/skills/claude/hooks/reminder.sh` 和 `checklist_ack.sh`：在工具事件中检查每小时间隔，不能无事件自行唤醒。
- `agent4sci/skills/codex/hooks.json`：Stop hook，不是每小时复盘；README将Codex checklist写为按需调用。
- `docs/protocol.md`、`docs/image-contract.md`：三阶段及外部镜像约定。本次未拉镜像或验证测试集隔离。

仓库当前模型默认值与论文模型版本不完全相同。复现需另外锁定模型、镜像、数据与评价器；本机配置不进行此复现。

## 本机适配

| 上游约定 | 本机采用方式 |
| --- | --- |
| 强制四路检索和全部高风险实验优先 | 按问题规模组织文献；按信息收益、预算与可检验性排序 |
| 基线已被标准化，禁止重新复现 | 查验当前项目基线可信性，保留必要复现及多种子评价 |
| 占满所有GPU、强制跑满时间 | 使用本任务已分配资源；预算为上限，合理停止 |
| 只有排除所有变体才放弃 | 记录失败分类，限定修复成本，证据不足可收尾 |
| Linux hook与停止控制 | 任务内主动运行跨平台checkpoint helper，不安装后台任务 |
| 复制完整会话/删除非最佳checkpoint | 保存本任务最小可审计记录，保留比较证据，不自动清理用户资料 |
| 权限绕过参数 | 不迁移，沿用现有权限和提供商 |

本机增加的“两项实验完成触发复盘”、状态helper与输出字段属于适配选择，未在论文中单独验证。
