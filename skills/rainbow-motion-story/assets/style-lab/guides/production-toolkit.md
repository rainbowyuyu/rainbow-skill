# 旧工程成熟方案：按问题复用

更新：2026-10-24。用于新片选路线、局部修复和技能检索。这里汇总可追溯的实现与检查方法；工程参数、历史验收和本次验收分别保存。不要因为文件名版本较高就直接采用，也不把旧报告当成新片已通过。

## 先选水体与环境路线

| 当前需要 | 首选实现与资料 | 复用要点 |
|---|---|---|
| 大海、海面穿越、原生水位查询 | [WaterPro 本机审计](../studies/waterpro-local-audit.md)，Falcon V03 `NativeOcean.ts` | 本机原生 WaterPro 3.1.1；明确米制、真实 backend、固定 tick、原生后处理和有历史状态的子系统 |
| 城市江面、岸线、建筑倒影、开挖剖面 | [水体经验 §2](../studies/production-water-lessons.md)，上海 V28 `NativeRiverV21.ts` / `PlanarRiverReflectionV25.ts` | 预乘颜色与覆盖率同核过滤，回退同一天空，再交给原生一次 Fresnel；岸线和剖面共享世界坐标覆盖 |
| 航拍时水面闪点、摩尔纹 | [水体经验 §3](../studies/production-water-lessons.md)，`RiverNormalFilterV27.ts` | 在 Fresnel 前过滤法线；compute 后刷新 mip，检查设备能力与实际层数。不可用整图模糊替代 |
| 波浪教学、剖面、实体浮标 | [水体经验 §4](../studies/production-water-lessons.md)，NS V10 `OceanWorld.ts` / `shaders.ts` | CPU、GPU 和轨迹共用保存的 48 模态波谱；读取已积分的位置/四元数与受力，不另造相位 |
| 倾倒、碰撞、体积液体与离线路径追踪 | [Blender 制作](blender-model-motion.md)、[真实脚本 API](../examples/blender-flow/API.md) | 已有 Mantaflow/FLIP + Cycles 小样；明确外部缓存路径、重开与重烘焙步骤。海面波谱不承担这一任务 |
| 天空、远云、自然光、进入云层 | 全局 `rainbow-atmospheric-scene` 的 `references/rendering-methods.md` 与 `spacex-v03-case.md` | 远景云已有案例；穿云或实体嵌云须按实体射线距离裁切并重新检查，不能继承背景云验收 |

本机工程根目录：`D:/projects/manim_extend_rainbow/video_project/`。真实路径与读取时哈希见 WaterPro 来源清单（外部或本机资源，未随公开包收录）。它是审计时快照；集成时主动修改的技能入口在独立安装检查中记录，旧哈希不代表文件永远不变。

### 四个不能混用的概念

- 原生 WaterPro 是商业库路线。技能保存接入方法与原工程路径，不附 vendor 或商业派生 shader；共享依赖就地引用。
- NS V10 是自编解析波与单向水→浮标近似。浮标有离线积分轨迹；水面没有接收浮标反作用，也不是完整自由表面 CFD。
- 平面反射、SSR 与路径追踪分别命名。上海 V28 的原生 SSR 关闭；镜像捕获仍不是逐波面多次光线反弹。
- 世界模型或反演结果需链接实际数据与字段。渲染漂亮、固定 seed、FFT 都不自动证明完成预测、反演或物理标定。

## 直接可用的小工具

[water-contracts.mjs](../examples/production-toolkit/water-contracts.mjs) 是原创无依赖数学工具，提供绝对帧时间、同波谱高度/法线/水位导数、预乘反射合成与单界面 Fresnel。用法与输入单位见 [API](../examples/production-toolkit/API.md)。它不包含 WaterPro 源码，不负责渲染、刚体积分或供应商内部状态。

已有历史波谱可显式作为测试输入，不复制进技能。正常执行得到 9 组数学与输入检查；指定波谱后增加第 10 组接口检查。报告区分数值范围与未执行的 GPU/画面范围。

## 水以外，优先复用这五条生产路径

详读 [成熟方案与证据索引](../studies/mature-production-recipes.md)，按当前问题取其中一节：

| 问题 | 采用的方法 | 现成入口 |
|---|---|---|
| 镜头、实体、公式、声音各自跑时间 | 绝对帧采样；成片、解释/物理、摄影机、源曲四种时钟显式映射 | `lab/adapter.js::drawFrame`，`lab/modules/camera-time.js::actionClock` |
| 换镜头跳位、第一人称不像安装在实体上 | 位姿和投影一起交接；眼点绑定真实安装点 | `lab/camera-driver.js`，技能 `assets/camera-handoff.mjs` |
| 文字很忙却看不懂、公式与实体无关 | 保持对象/符号身份；先变化，再结果，再稳定阅读 | `type-life.js`、Motionface 候选与逐句音画约定 |
| 音效突兀、音乐抢话、旁白被拉慢 | 先自然句源测时；音效由接触/掠过/提交事件触发；留白独立编排 | [声音 API](../examples/sound-design/API.md)，全局 TTS 与 cinematic 音频流程 |
| 中断后重渲染、缓存错接、依赖膨胀 | 输入指纹、逐帧原子落盘、缺帧恢复、编码核验；共享依赖按完整兼容性分组 | 历史 `scripts/v06/render.mjs` 作为改造案例，`scripts/shared-runtime.cjs` 用于已有依赖 |

历史渲染脚本带项目端口、资产清单和目录，先配置成当前工程再复用。不要在共享 `node_modules` 链接上直接安装或清理包。

## 每次采用的最小记录

1. **选用**：观众要看懂什么，使用哪条路线，明确实际 backend/版本/单位和数据路径。
2. **基线**：保存当前镜头的修改前画面；失败版本只作诊断案例。
3. **状态**：物理采样不接受相机足迹；显示抗混叠不改变浮标运动。灯光、捕获、反射、阴影使用同一帧状态。
4. **复查**：数值 → 运行时 → 代表帧 → 相邻帧与接缝 → 最终编码/声音，各自记录实际覆盖范围。
5. **留档**：源码/数据输入哈希、最终输出哈希、仍存在的限制。修改输入后重查受影响证据。

本轮整理只做源文件、旧报告、链接与数学接口检查；没有重渲染或重新验收旧片。以后做具体视频时，再执行对应的 GPU、连续画面和声音检查。
