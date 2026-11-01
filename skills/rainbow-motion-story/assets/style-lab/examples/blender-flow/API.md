# Blender 流水样例：生成、烘焙与渲染

这是可运行的 Blender Python 脚本与可编辑场景。使用用户已有的 `D:/blender/blender.exe`，本次实查为 **Blender 5.1.2**。入口为 [build_waterfall.py](build_waterfall.py)，详细命令见 [CLI](scene/CLI.md)，画面在[流水研究室](../../lab/blender-flow.html)。

原创模型包含有厚度的双层青瓷水槽、低细节碰撞体、持续入口、液体 Domain、三台相机及区域光。v2 两槽从干燥状态开始，入口先填充上槽，再发生出流与下盆积水。液面使用 Mantaflow FLIP 的 Data/Mesh 缓存，材质使用清水透射和 IOR 1.333，渲染采用 Cycles。它学习源片的流路和反射安排，不声称复原作者未公开的工程设置。

## 在自己的工程中重建

下面所有输出进入当前工程的新目录。先选择不存在或明确属于本次重建的目录；改几何或仿真参数时用新的版本名，保留上一份缓存。

```powershell
$flowBlender = 'D:/blender/blender.exe'
$flowScript = 'C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/examples/blender-flow/build_waterfall.py'
$flowOutput = Join-Path (Get-Location) 'work/blender-flow-study-v01/scene'
$flowCache = Join-Path (Get-Location) 'work/blender-flow-study-v01/cache'

& $flowBlender --background --factory-startup --python-exit-code 1 --python $flowScript -- --stage build --output-dir $flowOutput --cache-dir $flowCache --resolution 64 --frames 96
& $flowBlender --background --factory-startup --python-exit-code 1 --python $flowScript -- --stage bake --output-dir $flowOutput
& $flowBlender --background --factory-startup --python-exit-code 1 --python $flowScript -- --stage render --output-dir $flowOutput --render-frames 24,60,96 --samples 32
```

三步顺序执行，任何一步失败先处理错误，不直接继续。`build` 保存模型；`bake` 重新打开模型，先 Data 后 Mesh；`render` 再次独立打开文件读取已保存缓存。后台进程不打开或替换用户正在编辑的 Blender 场景，也不保存全局首选项。

## 参数和真实含义

| 参数 | 作用 |
|---|---|
| `--stage build/bake/render/all` | 分步构建、烘焙、渲染；all 顺序执行三者 |
| `--output-dir` | `.blend` 与渲染图的目录 |
| `--cache-dir` | 构建时指定的新缓存目录；之后 bake 以场景保存的路径为准 |
| `--scene-file` | 输出目录中的场景文件名，默认 `porcelain_spillway.blend` |
| `--report-file` | 指定运行记录；使用自定义输出目录时，默认记录在该目录的 `runtime.json`，不写回全局技能 |
| `--resolution 64` | 计算域最长边的划分数；不是画面分辨率，也不是各向均为 64 格 |
| `--frames 96` | 构建时的缓存结束帧；24 fps 对应 4 秒，包含第 1–96 帧 |
| `--render-frames all` | 渲染保存场景的完整帧范围；也可逗号列出需补的帧 |
| `--render-dir frames` | 输出目录下的图片子目录 |
| `--camera 'Camera · hero'` | 另有 `Camera · closeup` 和 `Camera · side study` |
| `--engine CYCLES/BLENDER_EEVEE` | 本机实际可用的标识；本样例的画面验收使用 Cycles |
| `--width / --height / --samples` | 渲染画幅与采样；提高它们不会提高液体求解精度 |
| `--relink-cache` | 读取已迁移的缓存，仅修改当前独立进程中的引用，不自动重烘或覆盖场景 |

完整播放可渲染 `--render-frames all --render-dir frames`，再按 [CLI](scene/CLI.md) 用 FFmpeg 合成。渲染中断后可只补缺失帧。流体 Data/Mesh 烘焙中断不等于可任意跳帧续算，需核对缓存状态后恢复或使用新目录重烘。

## 打开现有样例与迁移缓存

本机源场景位于：

```text
D:/projects/manim_extend_rainbow/research/motion_atelier/examples/blender-flow/scene/porcelain_spillway.blend
```

已烘焙缓存位于同一研究工程的 `work/blender-flow/bake/v2`，`.blend` 使用相对路径。源工程内直接打开可读取该缓存。缓存包含 `config/`、`data/`、`mesh/`，不是嵌入 `.blend` 的纹理；只下载 `.blend` 不会带走液体动画。

**技能库安装副本不复制大体积流体缓存。** 它带模型、脚本、代表帧和短片。在安装副本中渲染已有样例时，显式传入本机源缓存的绝对路径；在其他机器上重建，或者完整迁移缓存后重新链接。不要将“有可下载场景”误作“单文件包含全部模拟”。

```powershell
$flowReuse = Join-Path (Get-Location) 'work/blender-flow-reuse-v01'
New-Item -ItemType Directory -Path $flowReuse
Copy-Item -LiteralPath 'C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/examples/blender-flow/scene/porcelain_spillway.blend' -Destination $flowReuse
& 'D:/blender/blender.exe' --background --factory-startup --python-exit-code 1 --python 'C:/Users/USER/.codex/skills/rainbow-motion-story/assets/style-lab/examples/blender-flow/build_waterfall.py' -- --stage render --output-dir $flowReuse --render-dir relink-check --render-frames 60 --relink-cache 'D:/projects/manim_extend_rainbow/research/motion_atelier/work/blender-flow/bake/v2'
```

## 当前质量与检查边界

v1 发现了出水口缺口和下盆外异常水膜。v2 改为更厚、相互连接的碰撞实体，调整碰撞表面距离、液面重建半径与入口；代表帧复看时，外壁和盆底一圈异常水膜已消失。此次联合修改不能单独归因于某一个参数，相关数值与烘焙结果见 runtime（外部或本机资源，未随公开包收录）。

这是 **64 格、约 6.64 cm 单元宽度的造型与流程试作**。薄水片、细小飞沫和接触线仍受网格限制；不作为工程流量、守恒、表面张力或精度验证。物理时间保持常规重力；播放速度控制只用于观察，不改写求解结果。短片无声，未配音乐或模拟真实流水声。

源帧/资料哈希、媒体解码、浏览器交互及实际视觉检查分别存入 `qa/blender-flow-*.json`。图片存在、独立重开成功与视觉质量是不同层次的证据；正式用于成片前，按实际画幅提高模拟和渲染质量并重新检查连续画面。
