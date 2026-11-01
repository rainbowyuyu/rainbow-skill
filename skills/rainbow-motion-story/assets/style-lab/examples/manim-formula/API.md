# 原生 Manim：公式与图像保持同一身份

这是四段原创短场景，研究 3b1b 的公式匹配、共享状态、坐标变换与投影技法。实现使用本机已有 **Manim Community 0.19.1 / Cairo / Python 3.10.11**，不是将 ManimGL 源码直接运行，也未复制原视频。输出为 960×540、24fps、无声技术示例。

## 可直接运行

在原项目目录执行（使用共享 `.venv`，不新建依赖副本）：

```powershell
& 'D:/projects/manim_extend_rainbow/.venv/Scripts/python.exe' -X utf8 'D:/projects/manim_extend_rainbow/research/motion_atelier/examples/manim-formula/render.py' FormulaSemanticTransform DerivativeLinkedView MatrixBasisMap ComplexRotationProjection
```

需要已有 `latex`、`dvisvgm`、`ffmpeg`、`ffprobe` 在 PATH。本轮实际验证使用 MiKTeX 与 `C:/ffmpeg/bin`。Microsoft YaHei 用于中文，MathTex 用于公式。脚本不升级包、不修改全局配置。

| 类名 | 内容与默认参数 | 复用重点 |
|---|---|---|
| `FormulaSemanticTransform` | a=2，b=3，c=2；a(b+c)=ab+ac，面积总和10 | 相同符号一对多时显式 `TransformFromCopy`；唯一语义对象使用 `TransformMatchingTex` |
| `DerivativeLinkedView` | f(x)=x²，固定x=1；h=1.4→0.55→0.08 | `ValueTracker` 同时驱动割线、点、差商与读数；最后绿色切线为真正极限 |
| `MatrixBasisMap` | A=[[2,1],[1,1]]，v=(1,1)→(3,2) | 同一个线性映射驱动网格、基向量、单元格和点 |
| `ComplexRotationProjection` | θ从0→2π；单位复数旋转，右侧显示sinθ | 单一相位驱动矢量、水平投影、曲线生成和数值 |

`scenes.py` 是原生源码；`render.py` 写入 `assets/manim-formula/` 下同名 MP4 和 `-poster.jpg`，中间帧/TeX/日志在 `work/manim-formula/`。`qa/manim-formula-render.json` 记录逐片 ffprobe 与完整解码结果。`presentation.json` 由研究室页面维护，章节时间只控制播放器，不驱动数学计算。

## 从 3b1b 技法到 CE 的适配

参考固定源码 `3b1b/manim@fafa083a4fb274bba9cabde0b6e2f50ba6da0622/example_scenes.py` 中 `TexTransformExample`、`TexIndexing`、`UpdatersExample`、`OpeningManimExample`、`GraphExample`。源码来源与观察证据见本库的研究记录。原库使用 ManimGL；这里的 CE `MathTex`、`TransformMatchingTex`、`Create`、`plot` 需要独立适配，不能把 GL 方法名当成可直接运行的 CE API。

- **显式拆分公式**：用多个 MathTex 字符串创建可寻址的语义块，颜色绑定含义。a 出现两次时，从同一个 a 复制两次，不依赖字符串自动匹配猜测。
- **保留图形锚点**：主体和观察点不换身份，变化由参数推动。解释完后保留稳定阅读窗。
- **共享数学状态**：函数值、路径、点与读数调用同一函数或同一参数，避免“漂亮动画”和数字无关。
- **预建静态标签**：公式文字预建，用 updater 移动；不要每帧重新编译 TeX。DecimalNumber 处理动态读数。
- **观察任务决定速度**：一维角度匀速运动，解释步骤用 smooth，关键结果暂停；不对每个数字和公式都加弹簧。

## 数学边界

- 分配律图形是示例尺寸，a、b、c均为正数；若改负数，不能继续使用正面积图解而不解释。
- h=0.08时差商是2.08，不能标成导数2；绿色极限切线单独出现。
- 矩阵插值为 M(t)=(1−t)I+tA；det M(t)=1+t−t²。面积为1的说明只在最终A上显示，不能说全过程保面积。
- 复平面例子是正弦投影，不是执行傅里叶变换、不是傅里叶级数合成。

## 本轮检查

1. 全部 MP4 进行 ffprobe（分辨率、帧率、时长、帧数）和 ffmpeg 全片解码。
2. AST 检查 TeX 反斜杠，修正传输中转义丢失；逐一实际查看poster与六个阶段抽帧。
3. 核对一对多符号、曲线/数值一致、基向量列方向、正弦投影。
4. 修复函数标签与曲线重合、割线伸出y<0范围、数值条件缺失。
5. 未进行全片主观连续观看；没有配音和音效，不声称已听审。

本模块原创代码可按项目许可复用。参考库许可、作者与固定版本在研究资料中保留；引用第三方完整影片或场景另核对其许可。
