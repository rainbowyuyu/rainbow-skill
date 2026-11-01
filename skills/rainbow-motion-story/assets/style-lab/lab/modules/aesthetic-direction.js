import { candidate, clamp, smooth, mix, text, line, TAU } from './common.js';

/** Original visual metaphors. The mesh is design geometry, not a physical simulation. */
export const DURATION = 14;
export const STAGE_TIMES = Object.freeze([0, 2.1, 4.5, 8.4, 11.4]);
export const STAGES = Object.freeze(['认识圆环', '轮廓聚焦', '材料与结构', '尺度收回', '停下来，看清']);
export const FACTS = Object.freeze({ objectId: 'ring-01', units: '设计单位', outerDiameter: 2.4, innerDiameter: 1.28, thickness: .32, fasteners: 8, sectorDegrees: 60 });
export const COMMON_TITLE = '看清一个圆环';
export const COMMON_EXPLANATION = '轮廓 · 材料 · 结构';
const finiteTime = t => clamp(Number.isFinite(t) ? t : 0, 0, DURATION);
const ease = (t, a, b) => smooth((t - a) / (b - a));
const stageAt = t => STAGE_TIMES.reduce((found, start, i) => t >= start ? i : found, 0);
const vadd = (a, b) => a.map((x, i) => x + b[i]);
const vsub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
const blend = (a, b, u) => a.map((x, i) => mix(x, b[i], u));
const rotate = (p, r) => {
  const [sx, sy, sz] = r.map(Math.sin), [cx, cy, cz] = r.map(Math.cos);
  const x1 = p[0], y1 = p[1] * cx - p[2] * sx, z1 = p[1] * sx + p[2] * cx;
  const x2 = x1 * cy + z1 * sy, y2 = y1, z2 = -x1 * sy + z1 * cy;
  return [x2 * cz - y2 * sz, x2 * sz + y2 * cz, z2];
};
const annularPoint = (radius, angle, z) => [radius * Math.cos(angle), radius * Math.sin(angle), z];
const sectionTranslation = amount => [amount * Math.cos(Math.PI / 6), amount * Math.sin(Math.PI / 6), amount * .12];

function poseAt(t, variant) {
  const focus = ease(t, 2.1, 4.1), expand = ease(t, 4.5, 7.5), returnToObject = ease(t, 8.4, 11.1);
  const structure = ease(t, 5.1, 7.1) * (1 - ease(t, 8.5, 10.7));
  const turn = ease(t, .5, 2.0), movement = expand * (1 - returnToObject);
  if (variant === 'editorial') return {
    center: [mix(1060, 1030, turn), mix(442, 444, turn)],
    scale: 273 + movement * 16,
    rotation: [-.66 + movement * .08, .31 - movement * .04, -.12 + turn * .08],
    sectionOffset: structure * .56,
    light: [.38, .66, .74], lightSweep: movement * .28,
    outline: focus * (1 - ease(t, 5.2, 6.0)), materialReveal: ease(t, 4.5, 6.5),
    macroAmount: movement
  };
  if (variant === 'industrial') return {
    center: [mix(990, 1100, movement), mix(510, 650, movement)],
    scale: Math.exp(mix(Math.log(304), Math.log(555), movement)),
    rotation: [-.67 + movement * .18, -.35 - movement * .07, -.54 + movement * .15],
    sectionOffset: structure * .28,
    light: [-.2 + movement * .9, .73, .67], lightSweep: movement,
    outline: focus * (1 - ease(t, 5.2, 6.0)), materialReveal: ease(t, 4.5, 6.5),
    macroAmount: movement
  };
  return {
    center: [800, mix(440, 1110, movement)],
    scale: Math.exp(mix(Math.log(212), Math.log(1180), movement)),
    rotation: [-.47 + movement * .21, .19 + movement * .16, .19 - movement * .21],
    sectionOffset: structure * .2,
    light: [-.52 + movement * .3, .64, .76], lightSweep: movement * .8,
    outline: focus * (1 - ease(t, 5.2, 6.0)), materialReveal: ease(t, 4.5, 6.5),
    macroAmount: movement
  };
}

function sample(t, variant) {
  const time = finiteTime(t), stageIndex = stageAt(time), pose = poseAt(time, variant);
  const readHold = time >= 11.4;
  return {
    time, variant, stageIndex, phase: STAGES[stageIndex], annotation: ['先认出同一个物件', '沿轮廓找到视觉焦点', '高光说明材料，剖面说明结构', '沿同一圆心回到完整物件', '轮廓、材料和结构，属于同一个圆环'][stageIndex],
    objectId: FACTS.objectId, facts: FACTS, pose, sectionOffset: pose.sectionOffset,
    readHold, geometryStable: time >= 11.1, illustrative: true, physicalSimulation: false,
    title: COMMON_TITLE, explanation: COMMON_EXPLANATION,
    titleFill: 1 - .76 * pose.outline,
    trajectoryAlpha: variant === 'orbital' ? ease(time, 4.1, 5.4) * (1 - ease(time, 9.3, 11.1)) : 0,
    captionAlpha: 1 - .6 * pose.macroAmount,
    detailLabelAlpha: 1 - ease(pose.macroAmount, .28, .66),
    objectParts: ['ring-01/body', 'ring-01/sector', ...Array.from({ length: 8 }, (_, i) => `ring-01/fastener-${i + 1}`)],
  };
}
export const sampleEditorial = t => sample(t, 'editorial');
export const sampleIndustrial = t => sample(t, 'industrial');
export const sampleOrbital = t => sample(t, 'orbital');

/** Shared bevelled annular mesh, including two real cut caps per separated part. */
export function buildRingMesh(sectionOffset = 0) {
  const faces = [], count = 120, split = count / 6, move = sectionTranslation(sectionOffset);
  const profile = [[1.145, .16], [.695, .16], [.64, .105], [.64, -.105], [.695, -.16], [1.145, -.16], [1.2, -.105], [1.2, .105]];
  const face = (points, part, kind) => {
    const offset = part === 'sector' ? move : [0, 0, 0];
    const vertices = points.map(p => vadd(p, offset));
    faces.push({ vertices, part, kind, normal: norm(cross(vsub(points[1], points[0]), vsub(points[2], points[0]))) });
  };
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count, b = (i + 1) * TAU / count, part = i < split ? 'sector' : 'body';
    for (let j = 0; j < profile.length; j++) {
      const p = profile[j], q = profile[(j + 1) % profile.length];
      face([annularPoint(p[0], a, p[1]), annularPoint(p[0], b, p[1]), annularPoint(q[0], b, q[1]), annularPoint(q[0], a, q[1])], part, j === 0 ? 'front' : j === 4 ? 'back' : [1, 3, 5, 7].includes(j) ? 'bevel' : 'wall');
    }
  }
  if (sectionOffset > .000001) {
    const capAt = (angle, part, reverse) => {
      const p = profile.map(([r, z]) => annularPoint(r, angle, z));
      // Concave annular cross section is a thin bevelled rectangle, fully planar.
      face(reverse ? p.reverse() : p, part, 'cut');
    };
    capAt(0, 'sector', false); capAt(Math.PI / 3, 'sector', true);
    capAt(0, 'body', true); capAt(Math.PI / 3, 'body', false);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) * TAU / 8, center = annularPoint(.93, a, 0), part = a < Math.PI / 3 ? 'sector' : 'body';
    const boltAt = (j, z, radius = .077) => [center[0] + radius * Math.cos(j * TAU / 6 + a), center[1] + radius * Math.sin(j * TAU / 6 + a), z];
    const cap = Array.from({ length: 6 }, (_, j) => boltAt(j, .201));
    face(cap, part, 'bolt');
    for (let j = 0; j < 6; j++) face([boltAt(j, .16), boltAt((j + 1) % 6, .16), boltAt((j + 1) % 6, .201), boltAt(j, .201)], part, 'bolt-wall');
    const socket = Array.from({ length: 6 }, (_, j) => boltAt(j, .202, .029));
    face(socket, part, 'socket');
  }
  return faces;
}

export function projectRingPoint(point, pose, part = 'body') {
  const position = part === 'sector' ? vadd(point, sectionTranslation(pose.sectionOffset)) : point;
  const p = rotate(position, pose.rotation);
  return [pose.center[0] + p[0] * pose.scale, pose.center[1] - p[1] * pose.scale, p[2]];
}
const THEMES = {
  editorial: { bg: '#f3f0e8', ink: '#242827', muted: '#646861', accent: '#b34a36', metal: [163, 171, 166], shadow: '#484537', edge: '#f4f5ed' },
  industrial: { bg: '#111317', ink: '#f4efe5', muted: '#a4a6a6', accent: '#e0b082', metal: [111, 125, 134], shadow: '#030407', edge: '#f6e8d0' },
  orbital: { bg: '#191713', ink: '#f4e9d7', muted: '#b9a997', accent: '#d6a66f', metal: [170, 122, 74], shadow: '#070603', edge: '#ffe8be' }
};
const rgba = (rgb, luminance, alpha = 1) => `rgba(${rgb.map(x => Math.round(clamp(x * luminance, 0, 255))).join(',')},${alpha})`;
const polygon = (ctx, points) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); };
function material(ctx, projected, state, theme) {
  const n = projected.normal, lambert = Math.max(0, dot(n, norm(state.pose.light))), specular = Math.max(0, dot(n, norm(vadd(norm(state.pose.light), [0, 0, 1])))) ** 28;
  if (projected.kind === 'socket') return state.variant === 'editorial' ? '#4a4f4c' : '#15191a';
  if (projected.kind === 'cut') return state.variant === 'editorial' ? '#caa594' : state.variant === 'industrial' ? '#67544b' : '#9f6638';
  const strength = .3 + lambert * .77 + specular * .68, bonus = projected.kind === 'bevel' ? .19 : 0;
  const base = rgba(theme.metal, strength + bonus);
  if (projected.kind !== 'front' && projected.kind !== 'bolt') return base;
  const center = state.pose.center, width = state.pose.scale * 2.8;
  const shift = mix(-.38, .32, state.pose.lightSweep);
  const g = ctx.createLinearGradient(center[0] - width * .7 + shift * width, center[1] - width * .22, center[0] + width * .7 + shift * width, center[1] + width * .22);
  g.addColorStop(0, rgba(theme.metal, strength * .58));
  g.addColorStop(.2, rgba(theme.metal, strength * .87));
  g.addColorStop(.38, rgba(theme.metal, strength * 1.17));
  g.addColorStop(.47, rgba(theme.metal, strength * 1.52));
  g.addColorStop(.57, rgba(theme.metal, strength * .85));
  g.addColorStop(.79, rgba(theme.metal, strength * .63));
  g.addColorStop(1, rgba(theme.metal, strength * 1.1));
  return g;
}
function ringOutline(ctx, s, radius, z, alpha, color, width = 1.3) {
  if (alpha <= .001) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
  for (const [start, stop, part] of [[0, 20, 'sector'], [20, 120, 'body']]) {
    ctx.beginPath();
    for (let i = start; i <= stop; i++) {
      const p = projectRingPoint(annularPoint(radius, i * TAU / 120, z), s.pose, part);
      i === start ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawRing(ctx, s, theme) {
  const projected = buildRingMesh(s.pose.sectionOffset).map(f => {
    const rotated = f.vertices.map(p => rotate(p, s.pose.rotation)), normal = rotate(f.normal, s.pose.rotation);
    return { ...f, normal, depth: rotated.reduce((sum, p) => sum + p[2], 0) / rotated.length, points: rotated.map(p => [s.pose.center[0] + p[0] * s.pose.scale, s.pose.center[1] - p[1] * s.pose.scale]) };
  }).filter(f => f.normal[2] > .00001).sort((a, b) => a.depth - b.depth);
  for (const f of projected) {
    const fill = material(ctx, f, s, theme);
    polygon(ctx, f.points); ctx.fillStyle = fill; ctx.fill();
    // A 0.48px join left dark AA cracks in a full-size PNG. Same-material 1.15px
    // overlap covers that fractional edge while expanding a silhouette by at most
    // 0.575 design px. Real bevel/outline passes below remain separate and sharp.
    ctx.lineJoin = 'round'; ctx.strokeStyle = fill; ctx.lineWidth = 1.15; ctx.stroke();
    if (f.kind === 'cut') {
      ctx.save(); ctx.clip(); ctx.strokeStyle = s.variant === 'editorial' ? '#8b5b4050' : '#ecb58038'; ctx.lineWidth = 1.5;
      const xs = f.points.map(p => p[0]), ys = f.points.map(p => p[1]), minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
      for (let x = minx - (maxy - miny); x < maxx; x += 14) { ctx.beginPath(); ctx.moveTo(x, maxy); ctx.lineTo(x + maxy - miny, miny); ctx.stroke(); }
      ctx.restore();
    }
  }
  ringOutline(ctx, s, 1.145, .161, .32, theme.edge, 1.2);
  ringOutline(ctx, s, .695, .161, .3, theme.edge, 1.1);
  ringOutline(ctx, s, 1.2, .106, s.pose.outline * .82, theme.accent, 2.8);
  ringOutline(ctx, s, .64, .106, s.pose.outline * .82, theme.accent, 2.8);
}

function background(ctx, s, theme) {
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, 1600, 900);
  if (s.variant === 'editorial') {
    const g = ctx.createLinearGradient(0, 0, 1600, 900); g.addColorStop(0, '#fffdf5'); g.addColorStop(1, '#dfded5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#ffffff35'; ctx.beginPath(); ctx.moveTo(650, 0); ctx.lineTo(1600, 0); ctx.lineTo(1600, 670); ctx.closePath(); ctx.fill();
    line(ctx, [96, 166], [440, 166], '#b8b6aa', 1);
    line(ctx, [96, 166], [148, 166], theme.accent, 4);
    return;
  }
  const glow = ctx.createRadialGradient(s.variant === 'industrial' ? 1110 : 1020, 370, 10, 1040, 440, 850);
  glow.addColorStop(0, s.variant === 'industrial' ? '#50535b55' : '#a1743d43'); glow.addColorStop(1, '#00000000');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1600, 900);
  if (s.variant === 'industrial') {
    const beam = ctx.createLinearGradient(800, 0, 1520, 900); beam.addColorStop(0, '#d8e3ed00'); beam.addColorStop(.45, '#b3bfcb0b'); beam.addColorStop(.55, '#cfd9e714'); beam.addColorStop(1, '#f4e7d400');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(740, 0); ctx.lineTo(1080, 0); ctx.lineTo(1600, 790); ctx.lineTo(1600, 900); ctx.lineTo(1320, 900); ctx.closePath(); ctx.fill();
  }
}
function objectShadow(ctx, s) {
  ctx.save();
  const width = s.pose.scale * 1.17, height = s.pose.scale * .22;
  ctx.translate(s.pose.center[0] + 24, Math.min(740, s.pose.center[1] + s.pose.scale * .78)); ctx.scale(1, height / width);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, width); shadow.addColorStop(0, s.variant === 'editorial' ? '#55574938' : '#00000075'); shadow.addColorStop(.5, '#00000018'); shadow.addColorStop(1, '#00000000');
  ctx.fillStyle = shadow; ctx.fillRect(-width, -width, width * 2, width * 2); ctx.restore();
}
function orbitalEcho(ctx, s, theme) {
  if (s.trajectoryAlpha <= .001) return;
  ctx.save(); ctx.globalAlpha = s.trajectoryAlpha * .24;
  // A few shape echoes, explicitly graphic trajectories; no fictitious physical field.
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.25; ctx.beginPath();
    const radius = s.pose.scale * (1.36 + i * .21);
    for (let j = 0; j <= 100; j++) {
      const a = -.1 + j / 100 * Math.PI * 1.21, p = rotate([Math.cos(a) * radius / s.pose.scale, Math.sin(a) * radius / s.pose.scale, 0], s.pose.rotation);
      const x = s.pose.center[0] + p[0] * s.pose.scale, y = s.pose.center[1] - p[1] * s.pose.scale;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function hud(ctx, s, theme) {
  // Fixed reading lane; title remains independent of the camera and material pass.
  const editorial = s.variant === 'editorial', x = 96;
  if (!editorial) {
    const topVeil = ctx.createLinearGradient(0, 0, 0, s.variant === 'industrial' ? 240 : 230);
    topVeil.addColorStop(0, theme.bg + 'ff'); topVeil.addColorStop(.6, theme.bg + 'eb'); topVeil.addColorStop(1, theme.bg + '00');
    ctx.fillStyle = topVeil; ctx.fillRect(0, 0, 1600, 240);
    const bottomVeil = ctx.createLinearGradient(0, 700, 0, 900);
    bottomVeil.addColorStop(0, theme.bg + '00'); bottomVeil.addColorStop(.5, theme.bg + 'e8'); bottomVeil.addColorStop(1, theme.bg + 'ff');
    ctx.fillStyle = bottomVeil; ctx.fillRect(0, 700, 1600, 200);
  }
  if (s.variant === 'industrial') {
    text(ctx, '黑场微距', 99, 56, 20, theme.muted, 500);
    titleAt(ctx, s, theme, 96, 125, 68, 'left');
    text(ctx, COMMON_EXPLANATION, 1490, 129, 28, theme.muted, 450, 'right');
    line(ctx, [98, 194], [1502, 194], '#99978f30', 1);
    line(ctx, [98, 194], [169, 194], theme.accent, 3);
    const corner = ctx.createLinearGradient(0, 0, 680, 0); corner.addColorStop(0, theme.bg + 'ee'); corner.addColorStop(.52, theme.bg + 'bb'); corner.addColorStop(1, theme.bg + '00');
    ctx.fillStyle = corner; ctx.fillRect(0, 565, 680, 230);
    ctx.save(); ctx.globalAlpha = .2 + .8 * s.detailLabelAlpha;
    text(ctx, '同一圆环 · 8 枚固定件', 98, 674, 27, theme.ink, 600);
    text(ctx, '外径 2.4 · 内径 1.28 · 厚度 0.32', 99, 719, 22, theme.muted, 450); ctx.restore();
    text(ctx, s.stageIndex === 4 ? '轮廓、材料、结构，终于清楚。' : s.stageIndex === 2 ? '推进，沿高光看见材料。' : s.stageIndex === 3 ? '拉回，同一个物件。' : '先找到那一道边缘。', 98, 831, 26, theme.ink, 550);
    text(ctx, '设计单位｜视觉隐喻，非物理仿真', 1500, 832, 18, theme.muted, 450, 'right');
    return;
  }
  if (s.variant === 'orbital') {
    text(ctx, '温暖尺度', 800, 48, 19, theme.muted, 500, 'center');
    titleAt(ctx, s, theme, 800, 112, 62, 'center');
    text(ctx, COMMON_EXPLANATION, 800, 174, 25, theme.muted, 450, 'center');
    const phrases = ['从一个小小的物件开始', '把视线交给同一道轮廓', '在一片曲面里，看见材料', '宏大，慢慢回到具体', '最后，仍是这一个圆环'];
    text(ctx, phrases[s.stageIndex], 800, 736, 33, theme.ink, 600, 'center');
    ctx.save(); ctx.globalAlpha = s.detailLabelAlpha;
    text(ctx, '8 枚固定件 · 外径 2.4 · 内径 1.28 · 厚度 0.32', 800, 790, 22, theme.muted, 450, 'center'); ctx.restore();
    text(ctx, '设计单位｜视觉隐喻，非物理仿真', 800, 841, 18, theme.muted, 450, 'center');
    return;
  }
  text(ctx, ['纸白剖面', '黑场微距', '温暖尺度'][['editorial', 'industrial', 'orbital'].indexOf(s.variant)], x, 113, 23, theme.muted, 500);
  titleAt(ctx, s, theme, x, 266, 66, 'left');
  text(ctx, COMMON_EXPLANATION, x + 2, 333, 29, theme.muted, 450);
  const descriptions = ['先认出它', '沿着边缘，看清轮廓', '让材料与结构开口', '回到这个小小的物件', '同一个圆环，不同的看法'];
  ctx.save(); ctx.globalAlpha = .85 + .15 * s.captionAlpha;
  text(ctx, descriptions[s.stageIndex], x, 545, 30, theme.ink, 550);
  line(ctx, [x, 586], [x + 76, 586], theme.accent, 3); ctx.restore();
  text(ctx, '同一圆环 · 8 枚固定件', x, 741, 24, theme.ink, 550);
  text(ctx, '外径 2.4 · 内径 1.28 · 厚度 0.32', x, 782, 22, theme.muted, 450);
  text(ctx, '设计单位｜视觉隐喻，非物理仿真', x, 832, 19, theme.muted, 450);
}
function titleAt(ctx, s, theme, x, y, size, align) {
  ctx.save(); ctx.font = `750 ${size}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = align;
  ctx.fillStyle = theme.ink; ctx.globalAlpha = s.titleFill; ctx.fillText(COMMON_TITLE, x, y);
  ctx.globalAlpha = s.pose.outline * .8; ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.2; ctx.strokeText(COMMON_TITLE, x, y); ctx.restore();
}
function draw(ctx, t, w, h, options, state, variant) {
  const s = state || sample(t, variant), theme = THEMES[variant];
  ctx.save(); ctx.setTransform(w / 1600, 0, 0, h / 900, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, 1600, 900);
  background(ctx, s, theme); objectShadow(ctx, s); orbitalEcho(ctx, s, theme); drawRing(ctx, s, theme); hud(ctx, s, theme); ctx.restore();
}
export const drawEditorial = (ctx, t, w, h, o = {}, s) => draw(ctx, t, w, h, o, s, 'editorial');
export const drawIndustrial = (ctx, t, w, h, o = {}, s) => draw(ctx, t, w, h, o, s, 'industrial');
export const drawOrbital = (ctx, t, w, h, o = {}, s) => draw(ctx, t, w, h, o, s, 'orbital');
const specs = [
  { id: 'look-editorial-cutaway', variant: 'editorial', title: '纸白剖面 · 清楚地拆开', description: '不对称纸白版式、朱砂小焦点与真实厚度的圆环剖面；物件始终完整可追踪。', previewTime: 7.7, sample: sampleEditorial, draw: drawEditorial, recipe: ['右侧保留完整物件，左侧固定阅读区。', '边缘先亮起，再将同一块六十度扇区平顺移开。', '组件复位，文字与物件共同停留。'] },
  { id: 'look-industrial-focus', variant: 'industrial', title: '黑场微距 · 用高光说话', description: '斜向金属结构、宽幅软箱高光与局部推进；结构解释结束后回到完整轮廓。', previewTime: 6.9, sample: sampleIndustrial, draw: drawIndustrial, recipe: ['大片黑灰留出呼吸，以斜向形体建立张力。', '推进同一金属环，高光沿表面移动，固定件随母体运动。', '收回镜头并停止几何运动，完成材料与结构的阅读。'] },
  { id: 'look-orbital-return', variant: 'orbital', title: '温暖尺度 · 宏大回到具体', description: '保留同一个圆心，将机械环放成巨大曲面，再沿对数尺度收回一件可识别的小物。', previewTime: 10.1, sample: sampleOrbital, draw: drawOrbital, recipe: ['完整物件先建立身份，再以轮廓作为入口。', '用对数尺度进入暖色曲面，少量轨迹呼应圆环。', '大曲面与轨迹收回同一个物件，留出完整阅读停顿。'] }
];
export const candidates = specs.map(({ sample: sampler, draw: renderer, ...meta }) => candidate({
  ...meta, module: 'look', duration: DURATION, loop: false, stageTimes: STAGE_TIMES, stages: STAGES,
  referenceIds: ['aesthetic'], codeFile: 'modules/aesthetic-direction.js',
  controls: { palette: false, intensity: false }, parameters: {},
  usage: '同一段材料/结构介绍的三种原创视觉方向；共享对象与事实，不把视觉隐喻当作物理计算。'
}, sampler, renderer));
