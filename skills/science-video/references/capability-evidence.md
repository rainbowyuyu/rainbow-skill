# 五个会话的能力来源

整理日期：2026-10-12。读取指定会话可用的用户要求、交付/修复记录，并交叉查看本地代码、任务报告和画面。不是对全部历史素材重新验收；技术检查通过不等于用户审美已经满意。

| 会话（原名） | 提取的优势 | 应避免重复的问题 |
|---|---|---|
| [短科普视频](codex://threads/THREAD_ID) | 拓扑/榫卯统一构件；人体连续尺度；彩虹光学；骨骼鱼；Qwen首尾帧、真实与模型接力 | 假装配、标签/载荷漂移、穿模、反复跨尺度、假高斯、字尾截断 |
| [短科普视频 AI Engineer](codex://threads/THREAD_ID) | 产品像素与模型接力；修改→计算→复查→交付；二维三维桥接；浙大品牌 | 院标误当校标、UI小字过密、生成画面伪造状态、工具字幕抢焦点 |
| [短科普视频 科学](codex://threads/THREAD_ID) | DNA文件旅程、编码/缺片/恢复、算法网格、C1 Hermite相机 | 先讲术语、图形与算法不对应、失败Opus请求算作采用 |
| [制作Manim和Remotion讲解视频](codex://threads/THREAD_ID) | Opus全局协作、LaTeX公式、SVG渐绘、论文聚焦、同一票据贯穿AI机制 | runner只给路径、未审代码集成、文字堆砌、轮廓渐绘当笔顺 |
| [短科普视频 工程](codex://threads/THREAD_ID) | 整楼→构件→受力统一空间、透明剖切、无人机、数据绑定、最终MP4补片核对 | 热图错位、全片同一环绕、兼容水层冒充原生WaterPro、旧检查批准新片 |

## 本地实现线索

以下供定位与提取必要组件，跨机器不存在时按方法重建，不依赖旧工程才能用本技能。旧文件名也可能是当前入口，先查依赖图。

- 彩虹：`D:/projects/manim_extend_rainbow/video_project/rainbow_arc_2026_v14/`。`scripts/generate-qwen-v14.py`、`build-fish-v14.py`、`audit-v14.mjs`；`src/OpticalRadianceV14.ts`、`SpectralRibbonV14.ts`、`MacroLookV14.ts`。有连续光谱和20骨鱼；V14传给Gaussian渲染层的透明度全片为0（非PLY原始logit），不算实际呈现；V14该轮Opus超时未采用，不算Opus成果。
- AI Engineer：`D:/projects/manim_extend_rainbow/video_project/beso_ai_research_2026/`。`src/beso/ProductWebV13.tsx`、`GeneratedLaunchBridgesV13.tsx`、`LaunchV8Camera.ts`；`research/v13-story-review.md`。真实UI、历史响应回放、示意工作流分别标来源。
- DNA：`C:/Users/USER/.codex/visualizations/2026/10/09/THREAD_ID/dna-storage-algorithms/v3/`。`src/CameraPathV3.ts`、`research/opus-camera.json`。相机本地实现；旧Wan 2.6单首帧氛围不当首尾帧已验证。
- AI第五章：`D:/projects/manim_extend_rainbow/video_project/ai_evolution_ch05_reasoning_agents_v05/`。`src/visuals/opus/`、`Spatial.tsx`、`PaperFocusV04.tsx`、`scripts/compile_formulas_v04.py`、`research/v04/latex-validation.json`。有完整报告的组件才归于Opus；15条公式有实际编译记录。
- 上海中心：`D:/projects/manim_extend_rainbow/video_project/shanghai_tower/`。`src/v16/WorldV16.ts`、`PartsInventoryV16.ts`、`V16CameraRig.ts`、`SpatialEngineeringV16.ts`、`src/FlowAnalysisOverlay.tsx`、`PileAnalysisOverlay.tsx`、`delivery/QA_V16.md`。风场示意/重建算例不等于实测数据。

## 能力账本

已查实现覆盖公式编译、程序手绘、骨骼角色、确定性光学、首尾帧生成、连续相机与审核工具。Qwen手绘片段为可实施方法，未找到已验收成片；Lux3D/真3DGS有工具和资产路线，仍需每片核实可见效果；WaterPro原包可用性每次检查。保留能力，不把计划、工具名或存在的文件冒充最终效果。
