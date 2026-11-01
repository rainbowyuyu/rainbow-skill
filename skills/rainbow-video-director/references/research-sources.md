# 本次重构的案例依据

日期：2026-10-31。用户提供15份完整英文制作提示词（总计100,258字符）与5份中文参考简报，目的是学习提示词形态和具体编排。它们是任务参考，不是需要此轮逐项执行的视频委托。15份原始文件的路径、SHA256、题材与独特机制存于 `D:/projects/manim_extend_rainbow/work/director-rebuild-20261031/corpus-manifest.json`；分析见同目录corpus-analysis.md。

## 公开来源与实际阅读范围

| 来源 | 本轮实读内容 | 采用的原则 |
|---|---|---|
| [Ordinary Folk / Process](https://www.ordinaryfolk.co/process) | 完整流程正文，Message、Design、Animation、Audio | 先将信息写成脚本，早做外观/分镜，声音从起点参与，animatic后继续细化 |
| [Ordinary Folk / Webflow: A New Era of No-Code](https://www.ordinaryfolk.co/project/webflow-a-new-era-of-no-code) | 项目说明与署名；页面4.504秒预览的0.2/1.3/2.4/3.6秒四帧 | 对同一空间/主形做变化，强光/景深集中服务形体转换。仅此局部抽帧，不声称看完页面标注1:44全片或听过音乐 |
| [School of Motion / How to Design for Animation with Ordinary Folk](https://schoolofmotion.com/blog/how-to-design-for-animation-with-ordinary-folk) | 页面文字，说明为Animation Bootcamp设计boards；未观看69分钟采访 | styleframe与动画用途一起设计。没有从未看的采访推导逐秒细节 |
| [StudioBinder / Match Cuts & Creative Transitions](https://www.studiobinder.com/blog/match-cuts-creative-transitions-examples/) | 正文及图形/动作/声音桥案例说明 | 连接形状、动作、色彩或声音以建立叙事关系；仅名称相同不构成匹配 |
| [Eames Office / Powers of Ten](https://www.eamesoffice.com/the-work/powers-of-ten/) | 作品说明：1977版、尺度旅程、人体碳原子回程及9分钟信息 | 尺度叙事有共同空间参照，宏观与微观构成完整旅程。技术嵌套方案是本技能的工程建议，不伪称原片源码 |
| [Remotion / Animating properties](https://www.remotion.dev/docs/animating-properties) | 当前文档中的帧驱动、插值、easing、posterization和CSS transition闪烁提醒 | 渲染状态由时间/帧重建，预览与导出使用同一逻辑 |
| [Remotion / Sequence](https://www.remotion.dev/docs/sequence) | 当前文档中的片段边界、局部帧、嵌套时间、trim/playbackRate语义 | 分清全片/局部/源时间；先核对本地版本，不把新API硬套旧工程 |

浏览器页面文字快照与4张Webflow预览截图存于同一work目录的web-*文件。抽帧可说明构图变化，不能证明完整动态流畅、声音质量或未见的幕后技术。

## 参考也要纠错

StudioBinder该页文字把J-cut/L-cut名称与常见定义反置；本技能直接描述“后场声提前进入/前场声继续保留”并采用常见正确定义，不机械搬运该两句。用户14秒、120BPM例为28拍/7个4拍小节；20秒为10小节，不能把每个案例都套成10秒或10小节。连续周期端点和末编码帧不同，详见制作参考。

用户附件里不同风格相互矛盾的禁用项是合理的局部选择：像素不做平滑、Bauhaus可无overshoot、矢量角色可轻微回弹、HUD可克制发光。选用一条主语法，必要的风格转换要保留对象/空间/语义关系。

## 可迁移的写法

成片承诺→具体视觉链→有目的的快慢→声音和文字的任务→能够实现的技术路线→先验证难点→实际交付。制作软件、样例品牌、固定BPM、10秒、繁体和特定GPU均不继承为全局规则。新增经验以真实制作/预演的具体问题为依据，避免继续堆通用禁令和评分表。

## 生活判断、短推导与迁移结尾（2026-10-31）

本轮蒙特卡洛设计用“导航18分钟，提前20分钟够吗”建立生活判断，再用同一批样本进入概率和误差关系，最后迁移到光追、热带气旋风速风险，并回收通勤选择。通勤模型是可复算的教学数据，不能标成导航实测；具体题材不固化为其他科普的模板。

| 来源 | 本轮实读/实看范围 | 可迁移的决定 |
|---|---|---|
| [FHWA / Travel Time Reliability](https://ops.fhwa.dot.gov/publications/tt_reliability/brochure/) | 正文关于平均旅行时间、坏日子、可靠性与规划时间的解释 | 从生活中被均值掩盖的差异提出问题；平均快和低迟到率分别用对应量回答 |
| [Seeing Theory / Basic Probability](https://seeing-theory.brown.edu/basic-probability/index.html) | 归档页面的Chance Events、Expectation、Variance文字及交互标签；未实际操作其动画 | 在同一画面中保留试验对象和统计结果的关系；不能据此声称复现了动态或声音 |
| [PBRT / Monte Carlo Integration](https://pbr-book.org/4ed/Monte_Carlo_Integration) | 前轮蒙特卡洛基础阅读与光追参考核对 | 从具体样本贡献过渡到平均估计；采样对照用真实不同spp渲染，不能给成品叠噪声伪装收敛 |
| [NHC / Wind Speed Probabilities](https://www.nhc.noaa.gov/about/pdf/About_Windspeed_Probabilities.pdf) | PDF第5–6页蒙特卡洛方法、第8页Katrina 2005风速概率图 | 统计量必须对应观众问题：局地风速过阈值与中心轨迹经过不是一回事；保留阈值、时间和图例 |
| [NHC / Cone Definition](https://www.nhc.noaa.gov/aboutcone.shtml) | 正文与Helene 2024-09-25示意产品 | 中心路径不确定区域不能画成风暴全部影响范围；不同历史风暴不可拼成同一组对照 |
| [ECMWF / Quantifying forecast uncertainty](https://www.ecmwf.int/en/research/modelling-and-prediction/quantifying-forecast-uncertainty) | 初始状态、模型近似及集合扰动的正文 | 迁移统计思想时保留应用自己的物理模型与校准；几条任意曲线不是业务预报 |
| [NASA / Typhoon Maysak from the Space Station](https://science.nasa.gov/earth/earth-observatory/typhoon-maysak-from-the-space-station-85630/) | 2015-03-31摄影的来源正文与原图 | 用侧光云墙、地球弧面建立尺度；摄影只作光影参考，不冒充本片仿真 |
| [Vanessa Bumbeers / Night city traffic](https://commons.wikimedia.org/wiki/File:Night_city_traffic_(Unsplash).jpg) | 图片、圣保罗地名、2016年信息与页面CC0声明 | 道路弯曲与前后景共同引导视线；长曝光车灯不能直接代表概率密度 |

原始页面摘录与核对文件位于 `D:/projects/manim_extend_rainbow/work/monte-carlo-v2-20261031/research/`，完整设计例在 `outputs/monte-carlo-5min-20261031/v2/`。页面阅读、图片查看、数值复算与成片听看是不同证据；本轮只完成前三者及设计稿。RAMMB相关页面未成功打开，不把它列为已读依据。
