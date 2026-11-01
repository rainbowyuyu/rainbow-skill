/**
 * Original UI motion studies. Canvas 2D, absolute time, no audio or dependencies.
 * Source observation: MAX / Vaultex reference; original assets and composition.
 * All geometry is in a 1600 × 900 logical canvas. No simulation or real 3D claim.
 */
const W = 1600, H = 900, DURATION = 14;
const ASSET_ID = 'sea-breeze-06';
const C = Object.freeze({
  bg: '#080d18', panel: '#111c30', panelDeep: '#0d1525',
  line: '#2a3b56', ink: '#f0f5ff', muted: '#a4b2c9',
  cyan: '#74eee7', cobalt: '#446cff', violet: '#ad9aff'
});
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const q = clamp(x); return q ** 3 * (q * (q * 6 - 15) + 10); };
const mix = (a, b, u) => a + (b - a) * u;
const ease = (t, a, b) => smooth((t - a) / (b - a));
const box = (x, y, width, height) => ({ x, y, width, height });
const blendBox = (a, b, u) => box(...['x', 'y', 'width', 'height'].map(k => mix(a[k], b[k], u)));
const viewport = () => box(0, 0, W, H);
const identityMatrix = () => [1, 0, 0, 1, 0, 0];
const metadata = [
  {
    id: 'ui-identity-relay', title: '同一张卡片，走进工作区', duration: DURATION,
    description: '选中 → 跨容器交接 → 展开详情。保持资产身份、尺寸与裁切连续，停下来读清结果。',
    usage: '素材导入、项目切换、从概览进入详情；适合用同一物体连接两个信息层级。',
    referenceId: 'max-ui-motion',
    readWindows: Object.freeze([Object.freeze({ start: 5.9, end: 7.2 }), Object.freeze({ start: 10, end: 14 })]),
    boundary: '原创 Canvas 2D 编排；没有复制参考 UI、商标、素材、文案或音轨。'
  },
  {
    id: 'ui-click-to-timeline', title: '一次点击，有一个明确结果', duration: DURATION,
    description: '按钮按下 → 同一素材落在播放头 → 界面收正。所有子元素共用一个二维变换。',
    usage: '剪辑器、音轨编排、数据提交；展示输入、动作和结果之间的因果关系。',
    referenceId: 'max-ui-motion',
    readWindows: Object.freeze([Object.freeze({ start: 6.2, end: 8.4 }), Object.freeze({ start: 11, end: 14 })]),
    boundary: '倾斜是二维仿射展示，不是三维透视；默认静音。'
  }
];
export const candidates = Object.freeze(metadata.map(item => Object.freeze(item)));

/** Matrix format matches CanvasRenderingContext2D.transform(a,b,c,d,e,f). */
export function projectPoint(matrix, point) {
  const [a, b, c, d, e, f] = matrix;
  return [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f];
}

function presentationMatrix(angle, shear, scale) {
  const co = Math.cos(angle), si = Math.sin(angle);
  const a = scale * co, b = scale * si;
  const c = scale * (co * shear - si), d = scale * (si * shear + co);
  const cx = 800, cy = 460;
  return [a, b, c, d, cx - a * cx - c * cy, cy - b * cx - d * cy];
}

function eventList(t, events) {
  return events.filter(event => event.time <= t).map(event => ({ ...event }));
}

function relay(t) {
  const source = box(347, 345, 150, 100);
  const destination = box(840, 332, 282, 178);
  const detail = box(404, 312, 590, 282);
  const library = box(140, 234, 580, 482);
  const sourceMask = box(160, 310, 540, 378);
  const initialWorkspace = box(800, 234, 640, 482);
  const finalWorkspace = box(360, 214, 1080, 500);
  const flight = ease(t, 2.4, 5.2), focus = ease(t, 7.2, 10);
  const workspace = blendBox(initialWorkspace, finalWorkspace, focus);
  const workspaceMask = box(workspace.x + 20, workspace.y + 76, workspace.width - 40, workspace.height - 98);
  const heroBox = blendBox(blendBox(source, destination, flight), detail, focus);
  // A pre-opened overlay allows the card to cross a parent's edge without clipping.
  // At both ownership handoffs the box and mask are exactly the same on either side.
  let mask = sourceMask;
  if (t >= 2 && t < 2.4) mask = blendBox(sourceMask, viewport(), ease(t, 2, 2.4));
  else if (t >= 2.4 && t < 5.2) mask = viewport();
  else if (t >= 5.2 && t < 5.7) mask = blendBox(viewport(), workspaceMask, ease(t, 5.2, 5.7));
  else if (t >= 5.7) mask = workspaceMask;
  const parentId = t < 2 ? 'library' : t < 5.7 ? 'overlay' : 'workspace';
  const libraryAlpha = 1 - focus;
  const hero = {
    id: ASSET_ID, parentId, representationCount: 1, box: heroBox,
    alpha: 1, selected: ease(t, .8, 1.5), clipAmount: 0,
    detailAmount: focus, label: '海风 · 06'
  };
  return {
    id: 'ui-identity-relay', duration: DURATION, time: t, coordinateSpace: 'scene',
    phase: t < .8 ? '先认出对象' : t < 2.4 ? '选中一张卡片' : t < 5.2 ? '把对象带过去' : t < 7.2 ? '确认：已经到达' : t < 10 ? '沿着同一对象展开' : '留时间，读清结果',
    phaseIndex: t < 2.4 ? 0 : t < 5.7 ? 1 : t < 7.2 ? 2 : t < 10 ? 3 : 4,
    hero, representations: [{ id: ASSET_ID, role: 'hero', box: { ...heroBox } }],
    masks: { hero: { kind: 'roundedRect', box: mask, radius: 12, coordinateSpace: 'scene' } },
    panels: [
      { id: 'library', box: { ...library, x: library.x - focus * 80 }, alpha: libraryAlpha },
      { id: 'workspace', box: workspace, alpha: 1 }
    ],
    transform: { kind: 'identity', matrix: identityMatrix() },
    focus, flight, libraryAlpha, slotAlpha: 1 - flight,
    inspectorAlpha: ease(t, 8.3, 9.7), confirmationAlpha: ease(t, 5.25, 5.9),
    events: eventList(t, [
      { name: 'selection', time: 1.5, assetId: ASSET_ID },
      { name: 'depart', time: 2.4, assetId: ASSET_ID },
      { name: 'arrive', time: 5.2, assetId: ASSET_ID },
      { name: 'detail-ready', time: 10, assetId: ASSET_ID }
    ])
  };
}

function clickToTimeline(t) {
  const source = box(278, 330, 260, 154);
  const destination = box(824, 584, 272, 74);
  const sourceMask = box(252, 290, 310, 218);
  const targetMask = box(252, 550, 1096, 110);
  const flight = ease(t, 3, 5.6), settle = ease(t, 8.4, 11);
  const heroBox = blendBox(source, destination, flight);
  heroBox.y -= 48 * Math.sin(Math.PI * flight);
  let mask = sourceMask;
  if (t >= 2.7 && t < 3) mask = blendBox(sourceMask, viewport(), ease(t, 2.7, 3));
  else if (t >= 3 && t < 5.6) mask = viewport();
  else if (t >= 5.6 && t < 6.1) mask = blendBox(viewport(), targetMask, ease(t, 5.6, 6.1));
  else if (t >= 6.1) mask = targetMask;
  const matrix = settle === 1 ? identityMatrix() : presentationMatrix(-.035 * (1 - settle), .12 * (1 - settle), .94 + .06 * settle);
  const pointerU = ease(t, .5, 2.4);
  const cursorAlpha = 1 - ease(t, 3.2, 4.4);
  const hero = {
    id: ASSET_ID, parentId: t < 2.7 ? 'library-pane' : t < 6.1 ? 'overlay' : 'timeline',
    representationCount: 1, box: heroBox, alpha: 1, selected: 1,
    clipAmount: flight, detailAmount: 0, label: '海风 · 06'
  };
  return {
    id: 'ui-click-to-timeline', duration: DURATION, time: t, coordinateSpace: 'editor-local',
    phase: t < 2.4 ? '动作之前，先看见目标' : t < 3 ? '按下：给出清晰反馈' : t < 5.6 ? '让结果跟着动作发生' : t < 8.4 ? '片段从播放头开始' : t < 11 ? '收正界面，回到阅读' : '动作结束，结果留下',
    phaseIndex: t < 2.4 ? 0 : t < 3 ? 1 : t < 5.6 ? 2 : t < 11 ? 3 : 4,
    hero, representations: [{ id: ASSET_ID, role: 'hero', box: { ...heroBox } }],
    masks: { hero: { kind: 'roundedRect', box: mask, radius: 10, coordinateSpace: 'editor-local' } },
    panels: [{ id: 'editor', box: box(220, 220, 1160, 470), alpha: 1 }],
    transform: { kind: 'affine-2d', matrix, angle: -.035 * (1 - settle), shear: .12 * (1 - settle), scale: .94 + .06 * settle },
    flight, settle,
    cursor: { x: mix(1140, 1150, pointerU), y: mix(464, 368, pointerU), alpha: cursorAlpha },
    button: { box: box(1040, 340, 230, 56), pressed: ease(t, 2.4, 2.63) * (1 - ease(t, 2.75, 3)), label: t < 5.6 ? '放入时间线' : '已经放入' },
    playhead: { x: 824, top: 550, bottom: 660, seconds: 8, timecode: '00:08.00' },
    ruler: { originX: 280, pixelsPerSecond: 68 },
    placeholderAlpha: ease(t, 3, 4.2),
    placeholderLabel: t < 3 ? '' : t < 5.6 ? '正在移入' : '已在时间线中',
    explanationAlpha: 1 - ease(t, 2.4, 3) + ease(t, 5.6, 6.2),
    confirmationAlpha: ease(t, 5.6, 6.2),
    clipCommitted: t >= 5.6,
    events: eventList(t, [
      { name: 'click', time: 2.4, assetId: ASSET_ID },
      { name: 'depart', time: 3, assetId: ASSET_ID },
      { name: 'commit', time: 5.6, assetId: ASSET_ID },
      { name: 'read-ready', time: 11, assetId: ASSET_ID }
    ])
  };
}

/**
 * Pure frame state. Finite t is clamped to [0,14]; NaN/Infinity/non-numbers throw.
 * Returned objects are fresh and can be mutated by a consumer without state leakage.
 */
export function sample(t = 0, { id = candidates[0].id } = {}) {
  if (!candidates.some(candidate => candidate.id === id)) throw new RangeError(`Unknown UI choreography candidate: ${id}`);
  if (!Number.isFinite(t)) throw new TypeError('UI choreography time must be a finite number of seconds');
  const time = Math.max(0, Math.min(DURATION, t));
  const state = id === 'ui-identity-relay' ? relay(time) : clickToTimeline(time);
  state.readWindow = candidates.find(candidate => candidate.id === id).readWindows.some(window => time >= window.start && time <= window.end);
  return state;
}

function rounded(ctx, b, radius, fill, stroke = null) {
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.width, b.height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
}
function txt(ctx, value, x, y, size = 20, color = C.ink, weight = 500, align = 'left') {
  ctx.save(); ctx.font = `${weight} ${size}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(value, x, y); ctx.restore();
}
function segment(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function dot(ctx, x, y, radius, color) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}
function withClip(ctx, clip, callback) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(clip.box.x, clip.box.y, clip.box.width, clip.box.height, clip.radius); ctx.clip();
  callback(); ctx.restore();
}
function drawPanel(ctx, panel, title, subtitle = '') {
  const b = panel.box;
  ctx.save(); ctx.globalAlpha *= panel.alpha;
  ctx.shadowColor = '#00000050'; ctx.shadowBlur = 45; ctx.shadowOffsetY = 24;
  rounded(ctx, b, 20, C.panel, C.line); ctx.shadowColor = 'transparent';
  txt(ctx, title, b.x + 28, b.y + 33, 22, C.ink, 650);
  if (subtitle) txt(ctx, subtitle, b.x + b.width - 28, b.y + 33, 15, C.muted, 500, 'right');
  segment(ctx, b.x + 20, b.y + 67, b.x + b.width - 20, b.y + 67, C.line);
  ctx.restore();
}

// A repeated original wave glyph makes identity legible at thumbnail and clip sizes.
function drawAsset(ctx, hero) {
  const b = hero.box, compact = hero.clipAmount;
  ctx.save(); ctx.globalAlpha *= hero.alpha;
  ctx.shadowColor = '#1ce3d21a'; ctx.shadowBlur = 24 * hero.selected;
  rounded(ctx, b, mix(12, 9, compact), '#123443', hero.selected > 0 ? C.cyan : C.line);
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4, 10); ctx.clip();
  const gradient = ctx.createLinearGradient(b.x, b.y + b.height, b.x + b.width, b.y);
  gradient.addColorStop(0, '#17516c'); gradient.addColorStop(.6, '#1b7585'); gradient.addColorStop(1, '#0f2d46');
  ctx.fillStyle = gradient; ctx.fillRect(b.x, b.y, b.width, b.height);
  for (let i = 0; i < 4; i++) {
    const y = b.y + b.height * (.36 + i * .13);
    ctx.beginPath(); ctx.moveTo(b.x - b.width * .12, y);
    ctx.bezierCurveTo(b.x + b.width * .25, y - b.height * .6, b.x + b.width * .48, y + b.height * .45, b.x + b.width * 1.12, y - b.height * .13);
    ctx.strokeStyle = i === 0 ? '#b3fff0' : '#8af8e3' + ['b0', '70', '45', '25'][i];
    ctx.lineWidth = Math.max(1.2, b.height * .014); ctx.stroke();
  }
  const labelH = mix(30, 26, compact);
  const shade = ctx.createLinearGradient(0, b.y + b.height - labelH * 1.7, 0, b.y + b.height);
  shade.addColorStop(0, '#06142100'); shade.addColorStop(1, '#061421ee');
  ctx.fillStyle = shade; ctx.fillRect(b.x, b.y + b.height - labelH * 1.7, b.width, labelH * 1.7);
  const size = Math.min(23, Math.max(15, b.width * .07));
  txt(ctx, hero.label, b.x + 14, b.y + b.height - labelH * .55, size, C.ink, 650);
  if (b.width > 220) txt(ctx, '06', b.x + b.width - 16, b.y + 24, 15, C.cyan, 700, 'right');
  ctx.restore();
}

function drawLibrary(ctx, state) {
  const panel = state.panels[0], b = panel.box;
  drawPanel(ctx, panel, '素材库', '06 个片段');
  ctx.save(); ctx.globalAlpha *= state.libraryAlpha;
  // Other cards have their own identities; there is no second copy of the hero.
  const otherIds = [0, 2, 3, 4, 5];
  for (const n of otherIds) {
    const x = b.x + 34 + (n % 3) * 173, y = b.y + 111 + Math.floor(n / 3) * 161;
    rounded(ctx, box(x, y, 150, 100), 12, ['#1c2c48', '#18354a', '#243045'][n % 3], '#354765');
    segment(ctx, x + 18, y + 56, x + 55, y + 25, '#6c87b8', 2);
    segment(ctx, x + 55, y + 25, x + 95, y + 65, '#6c87b8', 2);
    segment(ctx, x + 95, y + 65, x + 132, y + 42, '#6c87b8', 2);
    txt(ctx, ['远山', '潮汐', '雨声', '夜灯', '晨光', '航线'][n], x + 3, y + 122, 17, C.muted);
  }
  ctx.globalAlpha *= state.slotAlpha;
  rounded(ctx, box(b.x + 207, b.y + 111, 150, 100), 12, '#17283d', '#48667a');
  ctx.restore();
}

function drawRelay(ctx, state) {
  drawLibrary(ctx, state);
  const panel = state.panels[1], b = panel.box;
  drawPanel(ctx, panel, state.focus > .6 ? '海风 · 06' : '工作区', state.focus > .6 ? '素材详情' : '今日剪辑');
  ctx.save(); ctx.globalAlpha *= 1 - state.focus;
  rounded(ctx, box(b.x + 40, b.y + 98, 282, 178), 12, '#0d1727', '#2a4259');
  txt(ctx, '把选中的素材带到这里', b.x + 40, b.y + 318, 21, C.muted);
  segment(ctx, b.x + 40, b.y + 368, b.x + b.width - 40, b.y + 368, C.line);
  txt(ctx, '片段', b.x + 365, b.y + 122, 17, C.muted);
  txt(ctx, '海风 · 06', b.x + 365, b.y + 157, 23, C.ink, 650);
  ctx.globalAlpha *= state.confirmationAlpha;
  dot(ctx, b.x + 373, b.y + 218, 4, C.cyan);
  txt(ctx, '已加入工作区', b.x + 388, b.y + 218, 17, C.cyan);
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= state.inspectorAlpha;
  txt(ctx, '同一个片段', 1040, 342, 27, C.ink, 650);
  txt(ctx, '从缩略图，到完整细节', 1040, 386, 20, C.muted);
  const labels = [['色调', '海蓝 / 青绿'], ['时长', '00:12'], ['归属', '今日剪辑']];
  labels.forEach(([key, value], i) => {
    const y = 454 + i * 48;
    txt(ctx, key, 1040, y, 17, C.muted); txt(ctx, value, 1350, y, 20, C.ink, 550, 'right');
    segment(ctx, 1040, y + 23, 1350, y + 23, '#25374e');
  });
  txt(ctx, '细节变多，身份不变', 406, 644, 22, C.cyan, 650);
  ctx.restore();
  withClip(ctx, state.masks.hero, () => drawAsset(ctx, state.hero));
}

function drawCursor(ctx, cursor, pressed) {
  ctx.save(); ctx.globalAlpha *= cursor.alpha; ctx.translate(cursor.x, cursor.y);
  const scale = 1 - pressed * .1; ctx.scale(scale, scale);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 31); ctx.lineTo(12, 22); ctx.lineTo(22, 34); ctx.lineTo(27, 30); ctx.lineTo(17, 18); ctx.lineTo(29, 16); ctx.closePath();
  ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = '#0d1830'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

function drawTimeline(ctx, state) {
  ctx.save(); ctx.transform(...state.transform.matrix);
  drawPanel(ctx, state.panels[0], '海风剪辑台', '素材 → 时间线');
  rounded(ctx, box(252, 290, 310, 218), 12, C.panelDeep, '#22364f');
  txt(ctx, '当前素材', 278, 311, 16, C.muted);
  ctx.save(); ctx.globalAlpha *= state.placeholderAlpha;
  rounded(ctx, box(278, 330, 260, 154), 12, '#112034', '#2d475a');
  txt(ctx, state.placeholderLabel, 408, 407, 18, C.muted, 500, 'center');
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= state.explanationAlpha;
  txt(ctx, '让一个动作', 620, 354, 31, C.ink, 650);
  txt(ctx, '带来一个明确结果', 620, 399, 25, C.muted, 500);
  txt(ctx, '选中素材 → 放入播放头', 620, 463, 18, C.cyan, 550);
  ctx.restore();
  const bb = state.button.box, press = state.button.pressed;
  rounded(ctx, box(bb.x + press * 3, bb.y + press * 2, bb.width - press * 6, bb.height - press * 4), 12, state.clipCommitted ? '#204b61' : C.cobalt, state.clipCommitted ? '#4b9b9e' : '#7493ff');
  txt(ctx, state.button.label, bb.x + bb.width / 2, bb.y + bb.height / 2, 21, C.ink, 650, 'center');
  txt(ctx, '00:08.00', 1155, 429, 18, C.muted, 550, 'center');
  segment(ctx, 252, 528, 1348, 528, C.line);
  rounded(ctx, box(252, 550, 1096, 110), 10, '#091321', '#24384f');
  for (let i = 0; i <= 15; i++) {
    const x = state.ruler.originX + i * state.ruler.pixelsPerSecond;
    segment(ctx, x, 551, x, i % 4 === 0 ? 568 : 559, '#3a506b');
    if (i % 4 === 0) txt(ctx, `00:${String(i).padStart(2, '0')}`, x + 4, 574, 11, '#8da1bc');
  }
  rounded(ctx, box(278, 598, 412, 44), 7, '#263d5d', '#3a5476');
  txt(ctx, '开场 · 01', 295, 620, 15, '#b8c8e1');
  for (let i = 0; i < 18; i++) segment(ctx, 402 + i * 14, 610, 402 + i * 14, 630, '#597497', 2);
  // Draw exactly one hero, inside the same transform as the ruler and playhead.
  withClip(ctx, state.masks.hero, () => drawAsset(ctx, state.hero));
  segment(ctx, state.playhead.x, 550, state.playhead.x, 660, C.cyan, 2);
  ctx.beginPath(); ctx.moveTo(816, 549); ctx.lineTo(832, 549); ctx.lineTo(824, 558); ctx.closePath(); ctx.fillStyle = C.cyan; ctx.fill();
  ctx.save(); ctx.globalAlpha *= state.confirmationAlpha;
  txt(ctx, '✓', 1302, 618, 25, C.cyan, 700, 'center');
  ctx.restore();
  drawCursor(ctx, state.cursor, press);
  ctx.restore();
}

/** Draw an exact frame; no timers, DOM, global state, audio, or external assets. */
export function draw(ctx, t, width, height, options = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError('UI choreography canvas dimensions must be positive finite numbers');
  const state = sample(t, options);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / W, height / H);
  ctx.translate((width - W * scale) / 2, (height - H * scale) / 2); ctx.scale(scale, scale);
  const halo = ctx.createRadialGradient(1000, 450, 40, 1000, 450, 780);
  halo.addColorStop(0, '#20356355'); halo.addColorStop(1, '#080d1800');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  txt(ctx, '界面，也有叙事', 112, 104, 42, C.ink, 700);
  txt(ctx, state.id === 'ui-identity-relay' ? '认出它，跟着它，再看清它。' : '看见意图，看见动作，看见结果。', 115, 154, 24, C.muted);
  txt(ctx, state.id === 'ui-identity-relay' ? '01 / IDENTITY' : '02 / CAUSE & EFFECT', 1488, 108, 17, C.cyan, 650, 'right');
  if (state.id === 'ui-identity-relay') drawRelay(ctx, state); else drawTimeline(ctx, state);
  txt(ctx, state.phase, 112, 790, 26, C.ink, 650);
  for (let i = 0; i < 5; i++) rounded(ctx, box(114 + i * 70, 832, i === state.phaseIndex ? 54 : 36, 4), 2, i === state.phaseIndex ? C.cyan : '#2c3c54');
  txt(ctx, '对象连续 · 动作有因果 · 结果有停顿', 1488, 802, 17, C.muted, 500, 'right');
  ctx.restore();
  return state;
}
