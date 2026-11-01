# validate-requirements

Validates requirements documents using 15 checks across 2 dimensions: semantic accuracy (11 checks — source truth, inference detection, requirement purity, over-generalization, scope boundaries, testability, ambiguity, assumption dependencies, negative paths, actor capability, intra-document consistency) and structural integrity (4 checks — staleness, contradictions, cross-references, completeness). Supports incremental mode: when a prior validation report is provided, only re-runs checks whose inputs have changed, carries forward findings that remain valid, and detects resolved findings — cutting re-validation effort by 40-60%. Produces a unified report with clear Semantic vs Structural grouping. Use after generating requirements, before sharing with stakeholders, when suspecting inaccuracies, or as a periodic quality sweep.

未核实完整分发许可或独立来源，保留目录记录，未搬运正文及代码。

已发现的环境：agents, cursor。

没有可核实的独立上游地址；请从原安装渠道查找，不猜测下载地址。
