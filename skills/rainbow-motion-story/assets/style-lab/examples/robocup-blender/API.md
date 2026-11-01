# 原创 Rover：扫描、场域与装配运镜

这是从参考视频的表达方式提炼出的原创 Blender 小样。模型、灯光、镜头路径和几何计算均由本目录脚本生成，未使用原片的机器人资产、字幕、音轨或工程。参考作者的具体渲染器、插件、焦距和工程设置没有公开核实。

## 运行

本机验证版本 Blender 5.1.2。全部单位为米，右手坐标，Z 向上。脚本在 `--factory-startup` 的隔离后台进程运行，不改变用户打开的 Blender 场景或保存全局偏好。

```powershell
$script = 'D:/projects/manim_extend_rainbow/research/motion_atelier/examples/robocup-blender/build_demo.py'
$out = 'D:/projects/manim_extend_rainbow/research/motion_atelier/work/robocup-blender-demo'
& 'D:/blender/blender.exe' --background --factory-startup --python $script -- --stage build --out $out
& 'D:/blender/blender.exe' --background --factory-startup --python $script -- --stage render --out $out --engine CYCLES --samples 48 --width 960 --height 540 --frames 1,103,197,247
& 'D:/blender/blender.exe' --background --factory-startup --python $script -- --stage render --out $out --engine BLENDER_EEVEE --width 640 --height 360 --start 1 --end 288 --step 1
& 'C:/ffmpeg/bin/ffmpeg.exe' -framerate 24 -start_number 1 -i "$out/preview-frames/frame_%04d.png" -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart "$out/rover-camera-preview.mp4"
```

`build` 写入可重新打开的 `rover_camera_study.blend` 和逐帧 `scene-parameters.json`。`render` 总是重新打开保存的 `.blend`，按明确帧号求值，不需要从首帧播放，不依赖上一次帧状态。默认 12 秒、24 fps、288 帧；第 1 帧对应 0 秒，第 288 帧对应 11.9583 秒。编码 288 帧后时长恰为 12 秒。

`--frames` 接受逗号分隔的任意帧号。也可用 `--start/--end/--step`。`--engine CYCLES` 为真实 Cycles 路径追踪，图像放入 `cycles/`；`BLENDER_EEVEE` 为 Eevee 预览，放入 `preview-frames/`，不能把该短片称为全片 Cycles 光追。所有设置只作用于当前后台进程。

## 三个可复用实现

1. **连续机位与稳定观察窗。** 同一场景从低位三分之四视角升高、环绕约 122°，再贴近控制板。位置使用极坐标平滑插值，姿态用 `to_track_quat` 与约 -5° 至 +6° 受控横滚组合；逐帧烘焙线性 F-Curve，使任意帧可确定重放。每个阶段使用五次平滑曲线抵达观察窗，镜头旋转不是只改变 Y 轴。景深焦点由同一世界坐标的 Focus Empty 驱动，光圈 f/7.1。它是美术编排的相机路径，并非真实无人机动力学。
2. **计算数据直接形成几何。** 从传感器世界坐标向三个真实障碍物的求值后网格发出 720 条射线，记录最近命中点；本场景得到 112 个命中。点出现时只改变各点自身半径，命中坐标始终保持在障碍表面。六条挑选的可视射线连接传感器与真实命中点。独立的 2D 距离场来自三个障碍物矩形占地的解析带符号距离，按距离生成颜色与高度。路径用八邻域 A*，对角线禁止穿越被占邻格，代价含安全距离。当前 0.20 m 网格、1.15 m 保守圆形机器人包络；从机身中心 `(0,0)` 规划至 `(3,4.4)`。这些计算不是赛事 SLAM、神经场、扩散模型或硬件测量。
3. **沿安装轴拆开并复位。** 顶壳、其上的雷达与紧固件属于一个装配体，沿 +Z 提升最多 0.77 m；电池盒沿 +Y 平移最多 0.25 m。框架、主板、散热片、供电线和轮轴留在正确世界位置。拆解是说明性运动，不是接触/碰撞动力学。没有依赖透明叠加顺序来穿透观察。

## 小样镜头时间

| 时间 | 内容 | 可见变化 |
|---|---|---|
| 0–2.6 s | 低位辨认底盘和传感器 | 稳定轮廓，扫描点逐渐出现；固定灯光反射随视角变化 |
| 2.6–5.6 s | 大角度升高至斜俯视 | 距离场与路径显现，颜色和地形高度对应同一距离函数 |
| 5.6–7.7 s | 俯视退出并靠近机身 | 地图回落/退场，顶盖开始沿安装轴抬升 |
| 7.7–9.8 s | 进入控制板近景 | 主板、散热片、电池与线缆清楚可见；上壳可离开画幅 |
| 9.8–12 s | 留出观察窗并回装 | 展示位移平滑收回，相机略后撤 |

场景选择深石板底色、阳极氧化铝、青色信号与少量琥珀强调。倒角、轮胎纹块、轮毂螺钉、支柱和散热片为真实几何。大面积光源和条光负责给金属表面提供可读反射，不把发光贴图冒充物理投光。

## 限制与验收

- `.blend` 不依赖外部贴图或模型；导出参数记录相机位置、目标、四元数、焦距、横滚及每帧拆解高度。
- 点云只采样本场景的障碍物，不是完整环境扫描，也没有扫描时间、噪声、遮挡自体剔除算法或重定位模块。扫描起点静止；扫描展示结束后才拆起带有传感器的上盖，不是一个已支持移动传感器实时重测的接口。它没有把不可见障碍背面硬补成完整点云。
- 路径的高度 shape key 与距离场的 relief 值同步，沿同一解析距离函数升降，中心线比对应高度场高 0.034 m；线管半径 0.018 m。水平规划在已知地图上完成，绝不把独立的障碍物光线采样说成由点云完成了建图。
- 场域起落、路径绘制和装配是解释动画。它们需要视觉检查；射线命中和 A* 成功不能自动证明教学表达清楚。
- 默认不添加音频、旁白或全屏 HUD，便于上层技能在确切时间安排解释。静帧的检查不能替代连续视频的视觉检查。
- 根目录 `qa/robocup-blender-demo.json` 保存实际输出与引擎记录；是否逐帧或原速完整播放须根据实际操作分别记录，不把程序正常退出写成艺术验收完成。
