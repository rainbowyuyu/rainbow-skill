# 资源入口与获取

先复用当前工程可审计资源，再找官方文档/原作者。下面入口于2026-10-12核实可访问；网页可访问不代表本机已安装、许可证相同或素材已通过验收。

## Three.js获取流程

1. 从 https://threejs.org/examples/ 按目标找实例：透明折射、骨骼、剖切、水面、景深、后处理；在 https://threejs.org/docs/ 核对API。
2. 通过实例“查看源码”进入 https://github.com/mrdoob/three.js ，读对应版本文件。固定`three`版本与锁文件，addons/loaders/后处理不混用不同版本。
3. 仅下载所需模型/贴图，保存原链接、作者、许可证、版本、hash。库MIT不代表示例内全部第三方资产都是MIT。
4. 做一个最小场景：核对单位、朝向、轴、包围盒、材质色彩空间、灯光、骨架/clip名称、贴图缺失，再移入影片。
5. 把实时实例改成`frame/fps`驱动，固定随机种子。检查乱序seek、首帧与跨平台色彩；不要把实时RAF原样接进离线渲染。
6. 预览采用小贴图；正式片按占屏面积升级分辨率，清理未引用资源。纪录原资产与派生文件关系，不覆盖原件。

## 官方/原作者资源

| 需求 | 入口 | 许可与检查 |
|---|---|---|
| HDRI、PBR、道具 | https://polyhaven.com/ · https://polyhaven.com/license | 官方资产CC0；保存asset ID与下载尺寸，测试高光和地平线。 |
| 木纹、石材、金属、地面 | https://ambientcg.com/ · https://docs.ambientcg.com/license/ | CC0；baseColor用sRGB，normal/roughness等数据贴图按线性处理。 |
| 可爱角色、骨骼与动作 | https://quaternius.com/ · https://kenney.nl/assets | 逐包查看LICENSE及是否真有rig/animation；“可下载模型”不等于可直接绑定动作。 |
| glTF材质/骨骼测试 | https://github.com/KhronosGroup/glTF-Sample-Assets | 每资产README/LICENSE分别核对；用于验证loader，不把整个仓库统一标MIT。 |
| 专业模型 | https://sketchfab.com/ · https://sketchfab.com/licenses | 查可下载条件、作者、具体许可和署名；不只凭缩略图确定模型。 |
| 真3D高斯渲染 | https://github.com/mkkellogg/GaussianSplats3D · https://github.com/sparkjsdev/spark | 两库当前MIT，高斯资产另有来源/许可。验证深度排序、协方差/各向异性、透明混合与视差。 |
| 人体连续解剖 | https://github.com/ashemag/human-atlas | app为MIT；BodyParts3D人体数据为**CC BY 4.0**，保留`public/ATTRIBUTION.md`。成年男性参考不代表全部人体变异。 |

人体库目前约2234个独立源网格/15系统，适合器官层级关系；微观细胞/蛋白另建模型并做尺度桥接。导入后检查敏感部位处理、姿态绑定、解剖相对位置和显隐层级。

## 本地水面及工程入口

本机已有路径，不表示每次任务均已验证可用；先读实际文件和依赖。

| 入口 | 可取用的能力 |
|---|---|
| `D:/projects/waterpro/README.zh-CN.md` | 商业WaterPro安装/官网演示记录；历史记录指出当时原商业库未安装，使用前重查实际状态。 |
| `D:/projects/OVOW/research/presentation_rendering/waterpro-adapter.js` | 本地受控水面适配；阅读其局限与授权，不称原生FFT/SSR/WebGPU。 |
| `D:/projects/manim_extend_rainbow/video_project/beso_ai_research_2026/src/beso/WaterProCompat.ts` | 确定性Gerstner展示，波面美术与保存的浮体数值响应分离。 |
| `D:/projects/manim_extend_rainbow/video_project/shanghai_tower/src/v16/` | 部件清单、拆装、剖切、相机与构件锚点；读接口后复用方法，不照搬时间点。 |
| `D:/projects/manim_extend_rainbow/video_project/beso_ai_research_2026/src/beso/ProductWebV13.tsx` | 真实网页像素与原生3D共处，film/plain/withoutBrand模式帮助净首尾帧。 |

WaterPro官方： https://threejswaterpro.com/ 、https://docs.threejswaterpro.com/guide/installation.html 、https://docs.threejswaterpro.com/license.html 。不要把安装`three`当安装WaterPro；本地商业代码不随可外发技能包复制。开源替代从Three.js Water/Water2或自写Gerstner开始。

## 论文、图纸、科学数据

Qwen/阿里云百炼：[文档总入口](https://help.aliyun.com/zh/model-studio/)、[图像生成](https://help.aliyun.com/zh/model-studio/text-to-image-v2-api-reference)、[视频生成](https://help.aliyun.com/zh/model-studio/video-generation)。从当前官方文档确认地区、模型、首尾帧协议与计费；子页路径若变化从总入口检索，不依据旧代码猜参数。

公式/渲染：[Manim](https://docs.manim.community/)、[dvisvgm](https://dvisvgm.de/Manpage/)、[Remotion](https://www.remotion.dev/docs/)、[Blender](https://docs.blender.org/manual/en/latest/)。论文发现：[Crossref](https://search.crossref.org/)、[PubMed](https://pubmed.ncbi.nlm.nih.gov/)、[arXiv](https://arxiv.org/)，返回原文核实而非停留在摘要。

- 优先原论文/作者或期刊页面、机构标准、官方图纸与实验数据；从Crossref/PubMed/arXiv等入口找对应原件。核对作者、年份、DOI、版次与撤稿/修订，不能仅凭搜索摘要下结论。
- 图纸记录尺寸、单位、坐标、装配约束、材料与允许简化；同一构件用于整体与局部说明。
- 论文展示使用真实页截图并保存PDF/URL/页码；把作者年份放页卡下方，生成工具不绘制论文正文。完整来源放交付说明。
- 公开图片不自动可自由使用；下载前核对许可、署名和编辑限制。付费库/第三方视频可以作为审美研究，未有使用权不直接拼入正片。

## 每份资产最少记录

`id · 原URL/本地路径 · 作者/供应商 · 许可 · 访问日期 · 原始hash · 派生hash · 用途 · 是否入片 · 局限`。生成任务另记模型、task ID、prompt和输入首尾帧hash；不保存密钥、带签名临时URL或私密音色。

将“找到→下载→测试→集成→最终可见→验收”分别记录。实际运行的新求解、保存结果回放和艺术示意有不同来源字段；水面/流线漂亮不等于物理数值已验证。

更多品牌原件见[品牌与封面](brand-covers.md)，本机工具入口见[工具与Opus](tools-opus.md)。
