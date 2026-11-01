# 无人机送水：可执行的路线重规划与 PID 教学数据

`replanning-example.mjs` 是原创、零依赖、可在 Node/浏览器运行的教学计算。默认送水无人机在恒定 18 m 高度的二维水平场景运动：4 s 时收到施工区域观测，放弃穿过新障碍的直线方案，计算有限候选、比较成本、提交路线，然后由 PID 驱动点质量模型执行。它**不是**真实无人机控制器、神经网络推理、扩散采样或 AeroVLA 输出。

```js
import {createScenario} from './replanning-example.mjs';
const simulation = createScenario(); // 固定 .02 s 步长一次生成时间线
const s = simulation.sample(4.6);   // 绝对秒，可反复拖动、倒放
console.log(s.planner.phase, s.planner.candidates);
// Three.js 使用 (x,z,-y)，Canvas 使用 (x,y)，Blender 使用 (x,y,z)。
drone.position.set(s.pose.position[0], s.pose.position[2], -s.pose.position[1]);
```

默认长度 34 s。`sample(t)` 夹紧到有效时段，返回不晚于 t 的最近物理步；`requestedTime` 是请求时间，`time` 是实际物理步时间。不要把这层求值改成跟随帧率的逐帧积分。画面、公式、标注读取同一份 state。子弹时刻应固定 `worldTime`、继续改变 `cameraTime`，让实体与路径数据一起暂停。若成片需要插值，只插值同一物理步间的显示位姿，控制器数字仍显示真实步骤的数据。

`createScenario` 采用配置项白名单：仅接受 `duration、dt、width、height、altitude、start、goal、clearance、bodyRadius、lookAhead、replanEvery、maxAcceleration、kp、ki、kd、integralLimit、drag、observations`。未知参数会明确抛出 `TypeError`，不会静默忽略。例如 `createScenario({wind:[1,0]})` 会报 `Unsupported scenario option: wind`；本例没有实现风场。

交互示例在 `../../lab/drone-planning.html`。通过工作区服务访问 `http://localhost:8000/lab/drone-planning.html`，可播放、拖动时间线、逐 .02 s 物理步检查、定位观测/拒绝/提交/到达时刻；“隐藏说明”只隐藏外围面板，时间、地图和实体仍使用同一状态。界面为二维教学参考，不作为正式影片画质样本。

## 公开数据

| 字段 | 含义及用法 |
| --- | --- |
| `pose.position / velocity / yaw` | 实际积分得到的水平运动；不是沿规划线直接赋值。yaw 是速度方向提示，不是姿态动力学。 |
| `target / error` | 当前前视目标及位置误差，用同一目标连接水箱或载荷的视觉注释。 |
| `controller.p / i / d` | 各项加速度贡献；D 对测量速度求反馈，避免目标切换造成微分踢。 |
| `controller.applied / acceleration` | 执行器限幅后的控制加速度、再减线性阻力后的实际加速度。 |
| `controller.integral / saturated` | 有界积分及饱和状态；饱和方向的积分停止积累。 |
| `planner.observedAt / knownObstacles` | 本次最后收到的传感器时间戳与已知障碍；未来更新不会提前进入状态。 |
| `planner.cycle / phase` | 本轮身份与 observe → candidates → evaluate → execute 阶段。 |
| `planner.candidates` | 直线、A*、北侧、南侧四个有限候选；每轮 ID 不变。包含点列、成本、拒绝原因、提交状态。 |
| `planner.route / selectedId` | 已提交路线及来源。无可行路线时为空并进入保持目标状态。 |
| `history` | 截止该时刻实际飞过的位置，逐物理步记录；过去轨迹不可被新规划改写。 |
| `committedHistory / events` | 每次提交的路线快照、观测/候选/比较/提交/制动事件；仅返回过去事件。 |
| `status` | 到达、碰撞及可行性标记；危险或无路线必须如实呈现。 |

## 如何把计算演成有思考感的画面

1. `observation-update`：局部观察束扫到施工区，标“观测更新 4.00 s”。只显示可观测信息，不把未来障碍画成已知结果。
2. `candidate-generation`：四条有限候选由近到远生长；使用稳定 ID，不能每帧随机抖成不同路线。动画只是路线显示进度，不改候选几何。
3. `cost-and-rejection`：直线撞入安全间距，标出具体拒绝位置；其他路径显示“路程 + 转折代价”的真实数值。不要标“AI 已思考”或编造模型内心独白。
4. `commit`：被选路线加重，未选路线降低对比。完整路线是本轮候选，只有无人机走过的部分才进入历史轨迹。
5. `execute`：实体按积分运动，PID 三项与误差读同一状态。下次观测或 6 s 短周期触发下一轮。可以用近景电机/水箱衔接到宏观路径，但展示的转子动作不能冒充本例计算出的姿态动力学。

默认前 0.24 s 观察，0.24–0.50 s 生成候选，0.50–0.80 s 比较，0.80 s 提交。这里的停留是教学可视化时间安排，不是真实算法耗时；真实计算在 `createScenario` 中同步完成。首次更新在4 s，施工区绕行提交在4.8 s。候选只代表四种有限选择，不应宣称搜索了“所有未来”或全局最优。

## 计算与边界

8 邻域有限栅格 A* 使用确定性排序；相邻边和简化后的视线段都经过膨胀 AABB 相交检测。连接当前位姿后在提交时重新检查。PID 输出加速度，范数限幅为 2.4 m/s²，半隐式欧拉积分，线性阻力。规划间距 1.5 m，实体包络半径 .35 m；实际飞行段另做扫描碰撞检查。规划线合法不自动等于控制器跟踪安全。

这个例子没有旋翼、倾角、吊挂水箱晃动、三维楼顶越障、风场、传感器噪声或未知障碍安全证明。建筑按无限高度柱体处理，恒高路线不能演成真正的三维自由飞行规划。正式作品如声称 VLA 或扩散规划已运行，必须另外接入模型的实际输入、输出、版本和测量证据。这里的数值仅能标“教学仿真”。

## 验证

在本目录运行 `node test-replanning.mjs`。检查观测因果性、任意 seek、一致历史、路线拒绝、稳定候选身份、事件顺序、实际轨迹碰撞、位姿连续步长、执行器限幅、积分抗饱和、测量微分、终点到达及非法状态报告。测试输出是真实运行结果；它不代表实机安全认证或画面审美验收。

2026-10-23 实际运行通过15类检查（含未知 `wind` 参数必须抛错的回归检查）：34 s / 1700步，默认实际轨迹未检测到已知障碍碰撞；最大相邻位移0.02314 m，最大速度1.15683 m/s，控制峰值2.07198 m/s²，6次提交。最终位置(32.03068,10.00866,18)，满足 .35 m 距离且速度低于 .2 m/s 的到达条件。额外高增益、低限幅情景验证积分不在饱和方向累积；把起点放入建筑的情景能报告碰撞及无可行路线。
