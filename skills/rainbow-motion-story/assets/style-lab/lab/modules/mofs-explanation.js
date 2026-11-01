import { candidate, clamp, mix, smooth, text, line, circle, TAU } from './common.js';

/** Original teaching geometry. Not a named MOF crystal or adsorption simulation. */
export const DURATION = 38;
export const SOURCES = Object.freeze({
  'nobel-chemistry-2025-press': { title: 'The Nobel Prize in Chemistry 2025 — Press release', url: 'https://www.nobelprize.org/prizes/chemistry/2025/press-release/', kind: 'official-science' },
  'nobel-chemistry-2025-popular': { title: 'The Nobel Prize in Chemistry 2025 — Popular information', url: 'https://www.nobelprize.org/prizes/chemistry/2025/popular-information/', kind: 'official-science' },
  'nobel-chemistry-2025-scientific': { title: 'The Nobel Prize in Chemistry 2025 — Scientific background', url: 'https://www.nobelprize.org/uploads/2025/10/advanced-chemistryprize2025-1.pdf', kind: 'official-science', readPages: [6, 7, 10, 13] },
  'mofs-original-geometry': { title: '本例的固定连接拓扑、球与孔口几何', path: 'lab/modules/mofs-explanation.js', kind: 'original-teaching-example' },
  'mofs-reference-study': { title: 'MOFs 参考作品的文案与动作观察', path: 'studies/mofs-script.md', kind: 'visual-method-only' }
});
export const GEOMETRY = Object.freeze({
  id: 'pore-frame-01', units: '设计单位', sides: 8, levels: [-1.15, 0, 1.15],
  bodyRadius: 1.35, mouthRadius: .66, nodeRadius: .115, linkerRadius: .06,
  smallGuestRadius: .22, largeGuestRadius: .63,
  crystalIdentity: null, physicalSimulation: false, adsorptionComputed: false
});
const F = 'mofs-original-geometry', P = 'nobel-chemistry-2025-popular', N = 'nobel-chemistry-2025-press', S = 'nobel-chemistry-2025-scientific';
const tcap = t => clamp(Number.isFinite(t) ? t : 0, 0, DURATION);
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : clamp(smooth(x));
const at = (t, a, b) => ease((t - a) / (b - a));
const vadd = (a, b) => a.map((v, i) => v + b[i]);
const vsub = (a, b) => a.map((v, i) => v - b[i]);
const blend = (a, b, u) => a.map((v, i) => mix(v, b[i], u));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };

export function makeTopology() {
  const nodes = GEOMETRY.levels.flatMap((y, level) => Array.from({ length: GEOMETRY.sides }, (_, index) => {
    const angle = Math.PI / 8 + index * TAU / 8, radius = level === 2 ? GEOMETRY.mouthRadius : GEOMETRY.bodyRadius;
    return { id: `node-${level}-${index}`, level, index, position: [radius * Math.cos(angle), y, radius * Math.sin(angle)] };
  }));
  const edges = [];
  for (let level = 0; level < 3; level++) for (let index = 0; index < 8; index++) edges.push({ id: `ring-${level}-${index}`, from: `node-${level}-${index}`, to: `node-${level}-${(index + 1) % 8}`, kind: 'ring' });
  for (let level = 0; level < 2; level++) for (let index = 0; index < 8; index++) edges.push({ id: `upright-${level}-${index}`, from: `node-${level}-${index}`, to: `node-${level + 1}-${index}`, kind: 'upright' });
  return { nodes, edges };
}
export const TOPOLOGY = makeTopology();
const nodeById = Object.fromEntries(TOPOLOGY.nodes.map(n => [n.id, n]));
/** Stable breadth-first reveal. Every growing edge starts at an established node. */
function buildOrder() {
  const root = 'node-1-0', seen = new Set([root]), queue = [root], tree = [], used = new Set();
  while (queue.length) {
    const current = queue.shift();
    for (const edge of TOPOLOGY.edges.filter(e => e.from === current || e.to === current)) {
      const next = edge.from === current ? edge.to : edge.from;
      if (seen.has(next)) continue;
      seen.add(next); queue.push(next); used.add(edge.id); tree.push({ ...edge, startNode: current, endNode: next, growsNode: true });
    }
  }
  return { root, edges: [...tree, ...TOPOLOGY.edges.filter(e => !used.has(e.id)).map(e => ({ ...e, startNode: e.from, endNode: e.to, growsNode: false }))] };
}
export const BUILD_ORDER = buildOrder();
export const BUILD_SCHEDULE = (() => {
  const ready = { [BUILD_ORDER.root]: 0 };
  return BUILD_ORDER.edges.map((edge, index) => {
    const start = Math.max(.6 + index * .215, ready[edge.startNode] || 0), end = start + .72;
    if (edge.growsNode) ready[edge.endNode] = end;
    return { ...edge, start, end };
  });
})();
/** Clearance of a centered sphere through the plane of this regular polygon. */
export function apertureClearance() {
  return Math.min(GEOMETRY.mouthRadius - GEOMETRY.nodeRadius, GEOMETRY.mouthRadius * Math.cos(Math.PI / 8) - GEOMETRY.linkerRadius);
}
/** Exact centerline collision height against node spheres and horizontal link cylinders. */
export function stopHeight(radius) {
  const nodeDistance = GEOMETRY.mouthRadius;
  const edgeDistance = GEOMETRY.mouthRadius * Math.cos(Math.PI / 8);
  const nodeContact = Math.sqrt(Math.max(0, (radius + GEOMETRY.nodeRadius) ** 2 - nodeDistance ** 2));
  const edgeContact = Math.sqrt(Math.max(0, (radius + GEOMETRY.linkerRadius) ** 2 - edgeDistance ** 2));
  return GEOMETRY.levels[2] + Math.max(nodeContact, edgeContact) + .025;
}
export const LOCKED_CONDITIONS = Object.freeze({ frameworkId: GEOMETRY.id, apertureRadius: apertureClearance(), guestShape: 'sphere', entryAxis: [0, -1, 0], modelUnits: GEOMETRY.units, variable: 'guest-radius', chemicalSelectivityComputed: false });

const cue = (variant, suffix, start, end, narration, screenText, question, visibleEvidence, sceneEvent, sourceIds, kind, extra = {}) => ({
  id: `${variant}-${suffix}`, start, end, narration, screenText, question, visibleEvidence, sceneEvent, sourceIds, kind, ...extra
});
function commonCues(variant) {
  return [
    cue(variant, 'components', 12, 15.8, '金属节点和有机配体连起来，搭出框架。', '点与连接，搭出框架', '这副骨架由什么连接？', '已建立的暖色节点先亮起，同一批连杆随后被强调，连接端点不改变。', 'identify-components', [P, N], 'source-explanation', { termsIntroduced: ['金属节点', '有机配体'] }),
    cue(variant, 'name', 15.8, 20.5, '框架里留出了孔隙。这样的材料，叫金属有机框架。', '框架内部，留出孔隙', '空出来的地方有什么用？', '镜头略转向孔口，孔隙轮廓显现，完整连接网络仍保留；名称在对象清楚后出现。', 'reveal-pore-and-name', [P, N, S], 'source-explanation', { termsIntroduced: ['孔隙', '金属有机框架', 'MOFs'] }),
    cue(variant, 'pass', 20.5, 24, '先让小球对准入口，往里走。', '先看能不能通过', '小球是否能穿过这个孔口？', '小球沿中央路径进入，孔口与球的半径读取固定几何；相机在两球验证期间不动，结果字尚不出现。', 'small-through-aperture', [F], 'teaching-example'),
    cue(variant, 'pass-result', 24, 24.5, '', '小球通过', '小球现在到了哪里？', '只有小球完整进入之后才显示通过标签，固定身份客体在孔内停下。', 'small-result-hold', [F], 'read-hold', { evidenceWindow: [24, 24.5], resultOf: 'small-through-aperture' }),
    cue(variant, 'block', 24.5, 27.4, '换大球，沿原路再试一次。', '换个尺寸，再试一次', '只换球的大小，结果是否改变？', '大球沿同一入射轴下降，停在由节点球面和连杆圆柱碰撞距离计算的位置；动作中不先宣布结果。', 'large-stops-at-aperture', [F], 'teaching-example'),
    cue(variant, 'block-result', 27.4, 28, '', '大球被挡在孔口', '大球停止的位置说明什么？', '大球到计算出的接触高度之后，阻挡结果字才出现；孔口和框架保持不变。', 'large-result-hold', [F], 'read-hold', { evidenceWindow: [27.4, 28], resultOf: 'large-stops-at-aperture' }),
    cue(variant, 'surface', 28, 35.2, '分子还可能停在内表面，这叫吸附。能否留住，要看孔内的化学环境。', '通过之后，还要看相互作用', '进得去，是否就一定留得住？', '同一小球从孔内中心移到内表面附近并保持身份；画面标明是停留位置示意，未根据孔径计算吸附。', 'illustrate-inner-surface', [P, S], 'source-explanation', { termsIntroduced: ['吸附'], evidenceWindow: [32.2, 35.2] }),
    cue(variant, 'hold', 35.2, 38, '', '入口和内表面，分开看', '能否进入与能否停留，分别看哪里？', '完整框架、孔口外大球和内表面旁小球静止，两个就近标签分别指认入口与内表面。', 'result-reading-hold', [P, F], 'read-hold')
  ];
}
export const CUES = Object.freeze({
  result: [
    cue('result', 'hook', 0, 4.8, '小球已经进去，大球停在外面。差在哪儿？', '为什么一个过，一个停？', '同一个入口，为什么结果不同？', '从已完成的几何示意结果开始，小球在孔内、大球在孔口外；两个对象的身份一直保留。', 'present-existing-result', [F], 'teaching-example', { evidenceWindow: [0, 4.8] }),
    cue('result', 'result-hold', 4.8, 6.5, '', '先看清这个结果', '两颗球分别停在哪里？', '小球在孔内，大球在入口外，姿态和镜头都保持。', 'entry-reading-hold', [F], 'read-hold'),
    cue('result', 'replay', 6.5, 10.7, '把过程倒回去，看看这个入口。', '回看入口', '入口是怎样搭出来的？', '明确标为回看；同一对客体沿原示意路径退回起点，框架没有换成另一份模型。', 'rewind-teaching-path', [F], 'replay'),
    cue('result', 'handoff', 10.7, 12, '', '从入口，看进骨架', '接下来要指认哪些部件？', '客体留在两侧，框架回到共同观察位；镜头停止后接结构说明。', 'shared-observation-pose', [F], 'read-hold'),
    ...commonCues('result')
  ],
  build: [
    cue('build', 'hook', 0, 4.3, '一个连接点，几根连杆。先连起来。', '空隙，是怎么搭出来的？', '少量连接怎样形成一个空间？', '从一个节点开始，连接沿真实拓扑顺序生长，端点出现后才成为下一条边的起点。', 'build-from-one-connection', [F], 'teaching-example'),
    cue('build', 'repeat', 4.3, 8.5, '把这些连接接下去，中间就留出了空隙。', '连接延伸，空隙留下', '重复连接后，哪里没有被填满？', '固定节点和边依次接成三层八边形笼架，中心始终留空；这是原创拓扑示意。', 'extend-connected-framework', [F], 'teaching-example'),
    cue('build', 'task', 8.5, 12, '这个空隙，能让什么东西进来？', '接下来，让两颗球试试', '同一孔口对两种尺寸会怎样？', '最后几条连接在 9.705 秒前接好；框架停住，小球与大球从两侧显现，结果尚未发生。', 'introduce-test-guests', [F], 'question'),
    ...commonCues('build')
  ],
  predict: [
    cue('predict', 'hook', 0, 4.6, '这两颗球，哪颗能穿过同一个入口？', '先判断，哪颗能过去？', '能依据什么做出预测？', '同一框架和两颗球先完整展示；孔口边缘与球的轮廓同场可见。', 'establish-prediction', [F], 'question'),
    cue('predict', 'basis', 4.6, 8.4, '先比孔口和球的大小，再让它们试一次。', '比较大小，再做验证', '预测是否有可见依据？', '孔口与球轮廓同步描亮，固定尺寸没有随强调动画改变；没有提前播放通过或阻挡。', 'show-geometric-basis', [F], 'prediction'),
    cue('predict', 'commit', 8.4, 10.5, '先记住你的判断。', '保留这个预测', '哪一颗可以通过？', '两个待测客体仍停在同一位置，描边退去；未显示结果标签。', 'hold-prediction', [F], 'prediction'),
    cue('predict', 'breath', 10.5, 12, '', '从入口，看进骨架', '验证之前，先看清对象。', '镜头到共同观察位，保留孔口和两种客体，进入相同的结构解释。', 'shared-observation-pose', [F], 'read-hold'),
    ...commonCues('predict')
  ]
});

const metadata = [
  { variant: 'result', id: 'story-mofs-result', title: '先看结果 · 为什么一个过，一个停？', description: '先展示可见结果，明确回看，再用同一个框架拆解原因；结尾区分通过与吸附。', previewTime: 4.8, recipe: ['先完成可见结果，保留两个客体。', '明确标注回看，用同一条路径回到问题。', '解释连接和孔隙，再验证尺寸，最后留出结论停顿。'] },
  { variant: 'build', id: 'story-mofs-build', title: '从一个连接 · 把空隙搭出来', description: '每条连接都有已建立的起点，从局部接成孔隙，再提出同一个尺寸验证问题。', previewTime: 7, recipe: ['先给观众一个可以指认的连接点。', '依拓扑生长，保留每个节点和连接身份。', '结构完成后再给名称和新问题，避免一开始满屏术语。'] },
  { variant: 'predict', id: 'story-mofs-predict', title: '先做预测 · 哪颗能穿过入口？', description: '先给同场可比的几何依据，保留判断，再按相同条件验证；不把能通过当成会吸附。', previewTime: 6.2, recipe: ['同时展示孔口与两种尺寸，给判断依据。', '预测窗口不泄露尚未发生的结果。', '固定孔口和入射轴验证，再讲内部表面的另一件事。'] }
];
export const stories = metadata.map(meta => ({
  ...meta, duration: DURATION, timingBasis: 'planned', cues: CUES[meta.variant], sourceIds: [P, N, S, F, 'mofs-reference-study'],
  sharedContentStart: 12, lockedConditions: LOCKED_CONDITIONS, physicalSimulation: false, adsorptionComputed: false,
  scienceBoundary: '节点可代表金属离子或团簇；本例不是实际晶体。球能否通过只按理想几何判断；吸附还受化学环境、温度、压力等条件影响，内表面停留没有进行吸附计算。',
  pronunciationNotes: [{ text: '金属有机框架', note: '自然连续读完整词组。屏幕写 MOFs，后续可口播“这类框架”。' }, { text: '吸附', note: '读 xī fù；保留与“通过孔口”的区别。' }]
}));
export const storyById = Object.fromEntries(stories.map(story => [story.id, story]));

function growthAt(t, variant) {
  if (variant !== 'build') return { nodes: Object.fromEntries(TOPOLOGY.nodes.map(n => [n.id, 1])), edges: Object.fromEntries(TOPOLOGY.edges.map(e => [e.id, 1])) };
  const nodes = Object.fromEntries(TOPOLOGY.nodes.map(n => [n.id, n.id === BUILD_ORDER.root ? 1 : 0])), edges = {};
  BUILD_SCHEDULE.forEach(edge => { const progress = at(t, edge.start, edge.end); edges[edge.id] = progress; if (edge.growsNode) nodes[edge.endNode] = progress >= 1 ? 1 : ease((progress - .66) / .34); });
  return { nodes, edges };
}
const SMALL_START = [-2.25, .95, .05], LARGE_START = [2.3, 1, -.05], SMALL_INSIDE = [0, -.2, 0];
const PASS_TARGET = [0, 2.05, 0], BLOCK_TARGET = [0, 2.3, 0];
function entryPath(start, middle, end, p) {
  // Lift clear of the rim before moving sideways. A diagonal approach clips rim nodes.
  const elevated = [start[0], middle[1], start[2]];
  if (p <= .24) return blend(start, elevated, smooth(p / .24));
  if (p <= .58) return blend(elevated, middle, smooth((p - .24) / .34));
  return blend(middle, end, smooth((p - .58) / .42));
}
function cameraAt(t, variant) {
  const common = { position: [4.5, 3.1, 7.8], target: [0, .35, 0], fov: 39 };
  if (t < 12) {
    const enter = at(t, 0, 1.6), returnView = at(t, 8.5, 11.5);
    const start = variant === 'build' ? [5.1, 2.3, 6.8] : variant === 'predict' ? [3.6, 4.2, 8.3] : blend([4.5, 3.1, 7.8], [3.9, 3.6, 7.3], at(t, .2, 3.5));
    const p = blend(start, common.position, returnView);
    return { position: p, target: blend(variant === 'build' ? [.6, .15, .35] : common.target, common.target, returnView), fov: mix(variant === 'build' ? 35 : 39, common.fov, returnView), entry: enter };
  }
  const pore = at(t, 16.1, 19.2), inside = at(t, 28.1, 33.4);
  return { position: blend(blend(common.position, [3.6, 4.1, 8.1], pore), [4.6, 2.9, 7.7], inside), target: [0, .35, 0], fov: 39, entry: 1 };
}
export function sampleMofs(rawTime, variant = 'result') {
  if (!(variant in CUES)) variant = 'result';
  const time = tcap(rawTime), cues = CUES[variant], cueIndex = Math.max(0, cues.findLastIndex(c => time >= c.start)), activeCue = cues[cueIndex];
  let smallProgress = at(time, 20.5, 24), largeProgress = at(time, 24.5, 27.4);
  let smallResultAlpha = at(time, 24, 24.3) * (1 - at(time, 28, 28.4)), largeResultAlpha = at(time, 27.4, 27.7) * (1 - at(time, 33.4, 35.2));
  if (variant === 'result' && time < 10.7) {
    const replayTime = time < 6.5 ? 4.8 : 4.8 * (1 - at(time, 6.5, 10.7));
    smallProgress = at(replayTime, .15, 2.4); largeProgress = at(replayTime, 2.55, 4.4);
    smallResultAlpha = at(replayTime, 2.4, 2.65); largeResultAlpha = at(replayTime, 4.4, 4.65);
  }
  const surfaceProgress = at(time, 28.4, 32.2);
  const surfacePoint = [GEOMETRY.bodyRadius * Math.cos(Math.PI / 8) - GEOMETRY.linkerRadius - GEOMETRY.smallGuestRadius, 0, 0];
  const smallPath = entryPath(SMALL_START, PASS_TARGET, SMALL_INSIDE, smallProgress);
  const smallPosition = blend(smallPath, surfacePoint, surfaceProgress);
  const largePosition = entryPath(LARGE_START, BLOCK_TARGET, [0, stopHeight(GEOMETRY.largeGuestRadius), 0], largeProgress);
  const guestAlpha = variant === 'build' ? at(time, 9.75, 11.5) : 1;
  const growth = growthAt(time, variant), camera = cameraAt(time, variant);
  const mouthAlpha = variant === 'predict' && time < 12 ? at(time, 3.8, 5.3) * (1 - at(time, 8.4, 10.3)) : at(time, 16.4, 18.5);
  const movingBetween = (a, b) => time > a && time < b;
  const cameraMoving = movingBetween(8.5, 11.5) || movingBetween(16.1, 19.2) || movingBetween(28.1, 33.4) || (variant === 'result' && movingBetween(.2, 3.5));
  const guestsMoving = movingBetween(20.5, 24) || movingBetween(24.5, 27.4) || movingBetween(28.4, 32.2) || (variant === 'result' && movingBetween(6.5, 10.7));
  const frameworkGrowing = variant === 'build' && movingBetween(.6, 9.705);
  const geometryStable = !cameraMoving && !guestsMoving && !frameworkGrowing;
  const labelsSettled = [smallResultAlpha, largeResultAlpha].every(v => v === 0 || v === 1);
  const readHold = activeCue.kind === 'read-hold' && geometryStable && labelsSettled;
  const nodes = TOPOLOGY.nodes.map(n => ({ ...n, alpha: growth.nodes[n.id], emphasis: at(time, 12, 12.8) * (1 - at(time, 13.7, 14.5)) }));
  const edges = BUILD_ORDER.edges.map(e => ({ ...e, fromPosition: nodeById[e.startNode].position, toPosition: blend(nodeById[e.startNode].position, nodeById[e.endNode].position, growth.edges[e.id]), progress: growth.edges[e.id], emphasis: at(time, 13.5, 14.3) * (1 - at(time, 15.2, 15.8)), surfacePatch: e.id === 'ring-1-7' ? at(time, 28.4, 31.6) : 0 }));
  const guests = [
    { id: 'guest-small', radius: GEOMETRY.smallGuestRadius, position: smallPosition, alpha: guestAlpha, passes: GEOMETRY.smallGuestRadius <= apertureClearance(), progress: smallProgress, state: surfaceProgress > 0 ? 'near-inner-surface' : smallProgress === 1 ? 'inside' : smallProgress > 0 ? 'approaching-or-entering' : 'waiting', adsorptionComputed: false },
    { id: 'guest-large', radius: GEOMETRY.largeGuestRadius, position: largePosition, alpha: guestAlpha, passes: GEOMETRY.largeGuestRadius <= apertureClearance(), progress: largeProgress, state: largeProgress === 1 ? 'blocked' : largeProgress > 0 ? 'approaching' : 'waiting', adsorptionComputed: false }
  ];
  return {
    time, variant, cueIndex, activeCue, cueProgress: clamp((time - activeCue.start) / (activeCue.end - activeCue.start)), stageIndex: cueIndex, phase: activeCue.sceneEvent, annotation: activeCue.screenText,
    camera, frameworks: [{ id: GEOMETRY.id, nodes, edges, clearance: apertureClearance(), mouthAlpha }], guests,
    sceneEvents: { id: activeCue.sceneEvent, smallHasPassed: smallProgress === 1, largeHasStopped: largeProgress === 1, internalSurfaceIllustration: surfaceProgress > 0, replay: variant === 'result' && time >= 6.5 && time < 10.7 },
    scene: { mouthAlpha, nameAlpha: at(time, 17.3, 19.3), surfaceProgress, finalLabelAlpha: at(time, 33.4, 35.2), guestAlpha, smallResultAlpha, largeResultAlpha },
    geometryStable, readHold,
    lockedConditions: LOCKED_CONDITIONS, physicalSimulation: false, adsorptionComputed: false, timingBasis: 'planned',
    termState: { objectEstablished: time >= (variant === 'build' ? 10 : 0), componentsNamed: time >= 12, mofNamed: time >= 17.3, adsorptionNamed: time >= 28 }
  };
}
export const sampleResult = t => sampleMofs(t, 'result');
export const sampleBuild = t => sampleMofs(t, 'build');
export const samplePredict = t => sampleMofs(t, 'predict');

export function makeProjector(camera, width = 1600, height = 900) {
  const forward = normalize(vsub(camera.target, camera.position)), right = normalize(cross(forward, [0, 1, 0])), up = cross(right, forward), focal = 345 / Math.tan(camera.fov * Math.PI / 360);
  return p => { const d = vsub(p, camera.position), depth = dot(d, forward), scale = focal / Math.max(.01, depth); return { x: 815 + dot(d, right) * scale, y: 480 - dot(d, up) * scale, depth, scale, visible: depth > .01 }; };
}
const PAINT = { bg: '#111b21', ink: '#f1eee3', muted: '#a9b6b8', node: '#d9aa75', link: '#8aafb8', guest: '#cce7dd', accent: '#f0c181' };
function sphere(ctx, p, radius, color, opacity = 1, glow = 0) {
  if (!p.visible || opacity <= .001) return;
  const r = radius * p.scale;
  ctx.save(); ctx.globalAlpha = opacity;
  if (glow > .001) { const halo = ctx.createRadialGradient(p.x, p.y, r * .5, p.x, p.y, r * 2.4); halo.addColorStop(0, `rgba(234,187,124,${glow * .22})`); halo.addColorStop(1, '#d9aa7500'); ctx.fillStyle = halo; ctx.fillRect(p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8); }
  const g = ctx.createRadialGradient(p.x - r * .32, p.y - r * .38, r * .08, p.x + r * .2, p.y + r * .25, r * 1.17);
  g.addColorStop(0, '#fff7e6'); g.addColorStop(.25, color); g.addColorStop(.74, color === PAINT.node ? '#936743' : '#6d9d9a'); g.addColorStop(1, '#263b42');
  circle(ctx, p.x, p.y, r, g, '#f7f0d71c', .8); ctx.restore();
}
function rod(ctx, a, b, radius, opacity, emphasis, patch) {
  if (opacity <= .001 || !a.visible || !b.visible) return;
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy); if (length < .02) return;
  const half = radius * (a.scale + b.scale) / 2, nx = -dy / length, ny = dx / length, center = [(a.x + b.x) / 2, (a.y + b.y) / 2];
  const g = ctx.createLinearGradient(center[0] - nx * half, center[1] - ny * half, center[0] + nx * half, center[1] + ny * half);
  g.addColorStop(0, '#314b58'); g.addColorStop(.3, emphasis > .1 ? '#deebe5' : '#b9ced0'); g.addColorStop(.5, '#8eacb3'); g.addColorStop(1, '#365562');
  ctx.save(); ctx.globalAlpha = opacity; ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.lineWidth = half * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  if (patch > .001) { ctx.globalAlpha *= patch; ctx.strokeStyle = '#f0c181'; ctx.lineWidth = Math.max(2, half * .7); ctx.beginPath(); ctx.moveTo(mix(a.x, b.x, .3), mix(a.y, b.y, .3)); ctx.lineTo(mix(a.x, b.x, .7), mix(a.y, b.y, .7)); ctx.stroke(); }
  ctx.restore();
}
function leader(ctx, project, position, wording, offset, opacity = 1) {
  if (opacity <= .001) return; const p = project(position);
  ctx.save(); ctx.globalAlpha = opacity; const end = [p.x + offset[0], p.y + offset[1]], align = offset[0] >= 0 ? 'left' : 'right';
  line(ctx, [p.x, p.y], end, '#d8e5df80', 1.25); circle(ctx, p.x, p.y, 3, PAINT.accent);
  text(ctx, wording, end[0] + (align === 'left' ? 8 : -8), end[1], 25, PAINT.ink, 550, align); ctx.restore();
}
function renderScene(ctx, state) {
  const project = makeProjector(state.camera), framework = state.frameworks[0], primitives = [];
  for (const edge of framework.edges) { const a = project(edge.fromPosition), b = project(edge.toPosition); primitives.push({ depth: (a.depth + b.depth) / 2, draw: () => rod(ctx, a, b, GEOMETRY.linkerRadius, Math.min(1, edge.progress * 5), edge.emphasis, edge.surfacePatch) }); }
  for (const node of framework.nodes) { const p = project(node.position); primitives.push({ depth: p.depth, draw: () => sphere(ctx, p, GEOMETRY.nodeRadius, PAINT.node, node.alpha, node.emphasis) }); }
  for (const guest of state.guests) { const p = project(guest.position); primitives.push({ depth: p.depth, draw: () => sphere(ctx, p, guest.radius, PAINT.guest, guest.alpha) }); }
  primitives.sort((a, b) => b.depth - a.depth).forEach(item => item.draw());
  if (state.scene.mouthAlpha > .001) {
    ctx.save(); ctx.globalAlpha = state.scene.mouthAlpha * .78; ctx.strokeStyle = PAINT.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 7]); ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU, p = project([apertureClearance() * Math.cos(a), 1.15, apertureClearance() * Math.sin(a)]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke(); ctx.restore();
  }
  const showComponents = at(state.time, 12, 12.6) * (1 - at(state.time, 15.2, 15.8));
  leader(ctx, project, nodeById['node-1-0'].position, '金属节点', [84, -38], showComponents);
  leader(ctx, project, blend(nodeById['node-1-0'].position, nodeById['node-1-1'].position, .5), '有机配体', [-98, -22], showComponents);
  const final = state.scene.finalLabelAlpha;
  leader(ctx, project, state.guests[0].position, '通过', [-165, 30], state.scene.smallResultAlpha);
  leader(ctx, project, state.guests[1].position, '被挡住', [126, -32], state.scene.largeResultAlpha);
  leader(ctx, project, [-.52, 1.15, 0], '孔口 · 能否进入', [-168, -54], final);
  leader(ctx, project, [GEOMETRY.bodyRadius * Math.cos(Math.PI / 8), 0, 0], '内表面 · 能否停留', [158, 52], final);
  if (state.sceneEvents.replay) text(ctx, '回看', 1450, 760, 26, PAINT.accent, 650, 'right');
  if (state.time >= 28 && state.time < 35.2) text(ctx, '内表面停留位置示意', 800, 752, 25, PAINT.accent, 550, 'center');
}
export function drawMofs(ctx, t, w, h, options = {}, state, variant = 'result') {
  const s = state || sampleMofs(t, variant);
  ctx.save(); ctx.setTransform(w / 1600, 0, 0, h / 900, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, 1600, 900);
  const bg = ctx.createLinearGradient(0, 0, 1600, 900); bg.addColorStop(0, '#16252c'); bg.addColorStop(1, '#0b1319'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1600, 900);
  const spotlight = ctx.createRadialGradient(830, 425, 20, 830, 425, 610); spotlight.addColorStop(0, '#54878d25'); spotlight.addColorStop(1, '#54878d00'); ctx.fillStyle = spotlight; ctx.fillRect(0, 0, 1600, 900);
  text(ctx, s.activeCue.screenText, 84, 91, 48, PAINT.ink, 700);
  const header = s.variant === 'result' ? '从结果回看' : s.variant === 'build' ? '从连接搭起' : '从预测开始';
  text(ctx, header, 1512, 89, 23, PAINT.muted, 500, 'right');
  line(ctx, [86, 143], [1512, 143], '#acc4c327', 1);
  renderScene(ctx, s);
  ctx.save(); ctx.globalAlpha = s.scene.nameAlpha; text(ctx, 'MOFs  金属有机框架', 86, 803, 28, PAINT.ink, 650); ctx.restore();
  text(ctx, '潜在孔隙与连接关系示意 · 非实际晶体 / 非吸附计算', 86, 850, 20, PAINT.muted, 450);
  ctx.restore();
}
export const candidates = stories.map(story => candidate({
  id: story.id, variant: story.variant, module: 'storytelling', title: story.title, description: story.description,
  duration: DURATION, loop: false, previewTime: story.previewTime, stages: story.cues.map(c => c.screenText), stageTimes: story.cues.map(c => c.start),
  referenceIds: ['mofs'], codeFile: 'modules/mofs-explanation.js', story, cues: story.cues, recipe: story.recipe,
  controls: { intensity: false, palette: false }, parameters: {},
  usage: '选择一种讲解入口，保留同一对象和真实因果；本例只有几何通过判据，内表面停留为概念位置示意，未计算吸附。'
}, t => sampleMofs(t, story.variant), (ctx, t, w, h, o, s) => drawMofs(ctx, t, w, h, o, s, story.variant)));
