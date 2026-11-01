# 风格选择与技法试作 API

目录数据：`../../lab/lemo-catalog.json`。每项包含 id、kind、family、source、analysis、verification。电影档案提示分开存储，读取 promptDoc 即可。kind=archive 的编号不代表一份现成独立引擎。

代码：`../../lab/modules/lemo-trials.js`。纯 ES module，无安装依赖。

- `trials`：14 个原创技法候选与明确边界。
- `sample(t,{id})`：标准化时钟、阶段与动作进度。t 截到 [0,12]。
- `draw(ctx,t,width,height,{id})`：实际画面绘制。每帧重新计算，内层采用 1280×720 设计坐标。
- `inertiaState(t)`：车和球连续的位移与速度。车在 2–3 秒制动；球在 2–6 秒按较小减速度停住。
- `foldCard(u,v,angle)`：纸卡局部坐标绕固定铰链刚性旋转，输出 [x,y,z]。
- `creationBrief(entry,topic)`：把选中目录项转换为可交给当前制作智能体的结构化要求。

演示页面 `../../lab/lemo-atlas.html` 支持 URL hash 定位风格、搜索、分类、选用清单、对比前四项、JSON 简报、PNG 静帧和延迟读取源文档。选用顺序中第一项为主风格；导出包含全部已选项。

检查页面 `../../lab/lemo-review.html?group=0` 到 `group=3` 展示三时刻联系表并执行真实 Canvas 随机定位像素检查。这里没有通过截图替换运行代码。

这些为无声、局部技法练习；没有把全量电影风格实现为同一个换色器。正式视频要根据题材另写旁白、声音事件、相机和材料管线。
