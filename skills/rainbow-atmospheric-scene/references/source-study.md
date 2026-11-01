# 来源与学习边界

本技能来自一次真实参考研究和工程修复，不包含第三方 shader 源码。

## 用户参考：从射线构建海景

- 视频：[粑粑柑（梭哈AI版），游戏中的3d场景是怎么呈现在屏幕上的](https://www.douyin.com/video/7696700243950619554)。研究时应用浏览器实际播放并抽查约 1:38、2:23–2:37 的关键画面；没有连续观看完整视频。
- 作者仓库：[holooooo/webgl-seascape-video](https://github.com/holooooo/webgl-seascape-video)。固定 commit：`915cb7c9a318e03bd2228bc232494b496ff2316c`，2026-10-16。检查了首集完整 45 条双语字幕、timeline、story 与相关 renderer / shader / noise 源码。
- 2026-10-17 检查 GitHub API `license:null`，仓库未发现 LICENSE。仓库公开不等同于可自由复制。项目仅保留少量研究文件并核对哈希；恢复包排除这些源码。本技能描述方法并链接出处。

首集按透视射线、分形地形、法线、材质阴影、大气、水体、反射、体积云、后期逐步构建同一片景观。值得复用的是在同一空间让观众看到因果，每次增加一层都有画面上的明确变化，而不是搬用其代码块排版。

### 从实际画面读到的构图

抽查画面为低机位水面、日落暖光、偏冷深色山体、远山雾化，太阳形成宽阔金色反射。高空云为大块有间隙的云团，边缘受逆光，阴影面仍有层次。后期分屏展示前后差异。用途是理解光色与层次，不能据此声称作者用了 Cycles、WebGPU 或路径追踪。

### 代码证据与适用边界

固定版本文件链接：

- [gl/scene.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/gl/scene.js)：108–112 中心差分法线；135–157 大气散射；179–230 三维云密度和积分；327–333 远处水面法线细节衰减；349–370 天空云/地形反射；375–419 吸收与水面高光；485–500 云合成。
- [gl/noise.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/gl/noise.js) 与 [gl/renderer.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/gl/renderer.js)：程序生成 Perlin-Worley / Worley 三维纹理并上传 GPU。“没有模型和贴图”更准确理解为没有外部模型、图像素材，不代表没有纹理内存或采样。
- [gl/post.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/gl/post.js)：ACES fit、Bloom、输出 gamma 与调色。原生 WebGL 输出路径不能直接照搬到 Three 的颜色管理路径。
- [story1.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/story1.js) 与 [timeline1.js](https://github.com/holooooo/webgl-seascape-video/blob/915cb7c9a318e03bd2228bc232494b496ff2316c/timeline1.js)：功能分层与太阳/镜头随时间变化；完整时间线 176.856 秒。

该海景云层只处理特定仰角，并在天空未命中地面分支合成，适合它的地面海景机位。飞行器进入云体、与实体相交时需要重新处理包围区间与表面深度。原水面是程序场景 raymarch 反射，不是 SSR，也不是通用路径追踪。公里级参数不能原样用于几十米主体。

## 权威文档

1. [Blender：Volume](https://docs.blender.org/manual/en/latest/render/materials/components/volume.html) 与 [Principled Volume](https://docs.blender.org/manual/en/latest/render/shader_nodes/shader/volume_principled.html)：体积密度、吸收/散射与缩放。
2. [PBRT v4：Phase Functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions)：相位函数和向量方向约定，判断前向散射时必须统一约定。
3. [Epic：Volumetric Cloud](https://dev.epicgames.com/documentation/en-us/unreal-engine/volumetric-cloud-component-in-unreal-engine)：视线/阴影/反射采样预算、保守密度、质量与性能取舍；UE 参数不可直接当 Three API。
4. [Epic：Screen Space Reflections](https://dev.epicgames.com/documentation/en-us/unreal-engine/screen-space-reflections-in-unreal-engine)：SSR 的屏内可见信息范围。
5. [GPU Gems：Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)：波长、振幅、速度及几何/法线细节分工。它不是现代 WaterPro 产品说明。
6. [Three.js：Color Management](https://threejs.org/manual/pages/color-management.html)：线性工作空间、颜色/数据纹理与输出转换。文档入口可能随版本迁移，应核对工程所用 Three 版本。

## 本地案例证据

首个落地工程：`D:/projects/manim_extend_rainbow/video_project/spacex_falcon9_recovery`。研究记录位于 `research/v03/reference-analysis.md`，源码来源和哈希在 `research/v03/reference-github/`，文档快照在 `research/v03/reference-docs/`。这些绝对路径是可选案例位置，不是未来任务依赖。只把项目自己生成、实际验收过的对比帧加入技能；不把参考截图或参考 shader 伪装成本技能原创资产。

当前落地实现与边界见 [spacex-v03-case.md](spacex-v03-case.md)。它是远背景云案例，不作为完整穿云深度裁切的成功案例。
