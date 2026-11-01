# 实际应用：Falcon 9 V03

工程：`D:/projects/manim_extend_rainbow/video_project/spacex_falcon9_recovery`。本记录描述已实现的方法；以下图例为主流程提供的实际工程帧，不据此宣称整片已经验收。

## 实际渲染路线

- 正文保留 WaterPro 3.1.1 原生 WebGPU FFT/Gerstner 与 SSR，使用 CC0 Poly Haven 日落 HDR。
- 新背景云为项目独立代码：48 步视线积分、5 次朝太阳方向采样、7 片背景云群，固定世界空间和帧时间。
- 片尾复用已有 Blender Cycles / OPTIX 180 帧片段。V03 与 V02 片尾源视频 SHA256 相同，证据为 `research/v03/coda-reuse-provenance.json`。本轮没有重复执行 Cycles，不把正文描述为路径追踪。
- 气流、压力色和热层是教学示意；落地运动计算单独记录。不能将示意颜色称为 CFD 测量。

## 这次解决的根因

WaterPro 每次固定步更新会同步太阳位置。旧版本在原生更新后另行移动灯光并重复跑 render pass，让 SSR、depth、shadow 与 capture 使用不同矩阵。当前通过公开 `lighting.addSunSyncListener` 在原生 capture 前恢复恒定世界灯矩阵，保持天空、海面、云和主体统一方向。

甲板顶与脚掌接触锚点统一到 0 m；厚 torus 靶标改成平面漆面。机体姿态变化时取消烘焙贴图中旧外物投影的 AO 强度，降低高频 normal 强度。预测线动态扩缩重新分配 attribute 和 drawRange，防止线条截断或残留；支撑多边形来自真实脚掌锚点。

## 必须保留的限制

当前背景云用 BackSide 椭球包围范围求交、沿射线积分，开启 depthTest、关闭 depthWrite。相机、火箭和甲板在背景云体之前，近处实体可遮住背景云。没有表面着色的包围球仍需检查轮廓是否露出。

**当前没有实现**由 opaque depth texture 重建最近世界射线距离，再用 `min(tFar,tOpaque)` 截断积分。实体嵌入云内时可能丢失其前方的部分云；因此本案例不能作为通用穿云或嵌云遮挡已解决的证据。技能 `rendering-methods.md` 中的完整裁切是未来扩展此类镜头需要实现的方法。

HDR 环境与 SSR 也不等于离屏完整体积云反射。固定种子与绝对时间是实现策略，重复帧像素稳定仍需实际渲染验证。CPU 结构测试不能证明时间稳定、主观美感或整片无遮挡。

本次可核查记录：`research/v03/graphics-repair-notes.md`、`graphics-structural-qa.json`、`reference-analysis.md`；最终媒体检查以 `output/v03/qa-report.json` 和实际片段审查为准。


## 实际图例

云层迭代对比（外部或本机资源，未随公开包收录）

上图与下图来自同一 frame 0 的实际工程渲染，裁去旧版顶部UI。前一阶段云像模糊灰团；当前版本能分辨大云团、侵蚀空隙、迎光边与天空层次。这是多项参数/代码迭代的阶段对比，不能当作严格单变量实验。未用作者参考画面代替结果。

主体与标注可读性（外部或本机资源，未随公开包收录）

实际 frame 7240 用于查看主体、支撑区域、影子、Logo与文字的可读性。单帧不证明全片无闪烁。原始路径、裁切坐标、版本边界及原图/缩略图SHA256见 [project-image-ledger.json](project-image-ledger.json)。
