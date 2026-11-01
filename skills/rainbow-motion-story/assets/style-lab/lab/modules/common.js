/** Original, deterministic presentation helpers. Coordinates are 1600 × 900. */
export const TAU = Math.PI * 2;
export const C = { bg: '#101722', panel: '#192431', ink: '#f4efe5', muted: '#9caeba', line: '#344855', gold: '#e8b56b', cyan: '#75d9d7', coral: '#ed8774', purple: '#ac9ad5' };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const mix = (a, b, p) => a + (b - a) * p;
export const smooth = x => { const q = clamp(x); return q * q * q * (q * (q * 6 - 15) + 10); };
export const mod = (x, n) => ((x % n) + n) % n;
export const phase = (t, d = 10) => mod(t, d) / d;
export const window = (t, a, b, enter = .8, exit = .8) => smooth((t - a) / enter) * smooth((b - t) / exit);
export const lerp3 = (a, b, q) => a.map((v, i) => mix(v, b[i], q));
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function bezier(a, b, p, bend = 0) { const q = smooth(p), dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, c = [(a[0] + b[0]) / 2 - dy / m * bend, (a[1] + b[1]) / 2 + dx / m * bend]; return [(1 - q) ** 2 * a[0] + 2 * (1 - q) * q * c[0] + q * q * b[0], (1 - q) ** 2 * a[1] + 2 * (1 - q) * q * c[1] + q * q * b[1]]; }
export function begin(ctx, w, h, { title = '', subtitle = '', palette = C } = {}) {
    ctx.save();
    ctx.setTransform(w / 1600, 0, 0, h / 900, 0, 0);
    ctx.clearRect(0, 0, 1600, 900);
    const g = ctx.createLinearGradient(0, 0, 1600, 900);
    g.addColorStop(0, palette.bg);
    g.addColorStop(1, palette.bg2 || '#080f18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 900);
    const halo = ctx.createRadialGradient(940, 410, 40, 940, 410, 710);
    halo.addColorStop(0, palette.halo || '#29445565');
    halo.addColorStop(1, '#18263100');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 1600, 900);
    ctx.strokeStyle = '#88aabb0b';
    ctx.lineWidth = 1;
    for (let y = 620; y < 900; y += 40)
        line(ctx, [60, y], [1540, y], ctx.strokeStyle, 1);
    for (let x = -900; x < 2500; x += 110)
        line(ctx, [800, 520], [x, 900], '#88aabb0b', 1);
    if (title)
        text(ctx, title, 74, 78, 34, palette.ink, 700);
    if (subtitle)
        text(ctx, subtitle, 76, 119, 20, palette.muted, 400);
}
export const end = ctx => ctx.restore();
export function text(ctx, s, x, y, size = 24, color = C.ink, weight = 500, align = 'left') { ctx.save(); ctx.font = `${weight} ${size}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(s), x, y); ctx.restore(); }
export function line(ctx, a, b, color = C.line, width = 2, dash = []) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.restore(); }
export function path(ctx, points, color = C.gold, width = 3, closed = false, fill = null) {
    if (!points.length)
        return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    points.slice(1).forEach(p => ctx.lineTo(...p));
    if (closed)
        ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
}
export function circle(ctx, x, y, r, fill = C.gold, stroke = null, width = 2) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(.01, r), 0, TAU);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
    }
    ctx.restore();
}
export function pill(ctx, s, x, y, { color = C.gold, bg = '#162935', size = 22 } = {}) { ctx.save(); ctx.font = `600 ${size}px "Microsoft YaHei",sans-serif`; const width = ctx.measureText(s).width + 32; roundRect(ctx, x - width / 2, y - 23, width, 46, 23, bg, color + '55'); text(ctx, s, x, y, size, color, 600, 'center'); ctx.restore(); }
export function roundRect(ctx, x, y, w, h, r = 12, fill = C.panel, stroke = null) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}
export function glow(ctx, x, y, r, color = C.gold) { ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + '40'); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
export function arrow(ctx, a, b, color = C.gold, width = 3) { line(ctx, a, b, color, width); const th = Math.atan2(b[1] - a[1], b[0] - a[0]); path(ctx, [[b[0] - 15 * Math.cos(th - .4), b[1] - 15 * Math.sin(th - .4)], b, [b[0] - 15 * Math.cos(th + .4), b[1] - 15 * Math.sin(th + .4)]], color, width); }
export function ring(ctx, x, y, r, start, endA, color = C.gold, width = 5) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, r, start, endA); ctx.stroke(); ctx.restore(); }
export function metal(ctx, x, y, w, h, { color = '#728b99', radius = 10 } = {}) { ctx.save(); const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#c6d5db'); g.addColorStop(.18, color); g.addColorStop(.52, '#2d414c'); g.addColorStop(.78, color); g.addColorStop(1, '#dae2e5'); roundRect(ctx, x, y, w, h, radius, g, '#c3d7df55'); line(ctx, [x + radius, y + 3], [x + w - radius, y + 3], '#ffffff70', 1); ctx.restore(); }
export function label(ctx, s, x, y, anchor, color = C.gold) {
    if (anchor) {
        line(ctx, anchor, [x, y + 20], color + '80', 1.8);
        circle(ctx, ...anchor, 3, color);
    }
    text(ctx, s, x, y, 23, color, 600, 'center');
}
export function timeline(ctx, p, { labels = ['预备', '动作', '落定', '接力'], y = 810 } = {}) { line(ctx, [100, y], [1500, y], C.line, 3); line(ctx, [100, y], [100 + 1400 * clamp(p), y], C.gold, 4); labels.forEach((s, i) => { const x = 100 + 1400 * i / (labels.length - 1); circle(ctx, x, y, 5, C.bg, C.gold, 2); text(ctx, s, x, y + 35, 19, C.muted, 400, 'center'); }); }
export function cup(ctx, x, y, angle = 0, scale = 1, water = .0) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale); glow(ctx, 0, 20, 115, C.cyan); path(ctx, [[-49, -60], [-41, 61], [41, 61], [49, -60]], '#d7f1efbb', 3, false, '#82cfdf0a'); ctx.save(); ctx.beginPath(); ctx.moveTo(-43, -5 - water * 15); ctx.lineTo(43, -5 + water * 15); ctx.lineTo(40, 57); ctx.lineTo(-40, 57); ctx.closePath(); const g = ctx.createLinearGradient(0, -10, 0, 58); g.addColorStop(0, '#94e6e3b0'); g.addColorStop(1, '#285c7588'); ctx.fillStyle = g; ctx.fill(); ctx.restore(); line(ctx, [-43, -5 - water * 15], [43, -5 + water * 15], C.cyan, 3); line(ctx, [-36, -53], [-29, 43], '#ffffff55', 3); ctx.restore(); }
export function tray(ctx, x, y, angle = 0, scale = 1, water = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale); metal(ctx, -130, 70, 260, 17, { color: '#788b92', radius: 8 }); cup(ctx, 0, 7, 0, 1, water); circle(ctx, 0, 104, 18, '#192b37', C.gold, 3); ctx.restore(); }
export function gear(ctx, x, y, r, teeth, angle, color = C.gold, { internal = false, opacity = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.translate(x, y);
    ctx.rotate(angle);
    const pts = [];
    for (let i = 0; i < teeth; i++) {
        for (let k = 0; k < 4; k++) {
            const a = (i + (k + .15) / 4) * TAU / teeth;
            const rr = r + (internal ? -1 : 1) * (k === 1 || k === 2 ? 7 : 0);
            pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
        }
    }
    path(ctx, pts, color, 2, true, internal ? '#142330' : '#263c47');
    if (!internal) {
        circle(ctx, 0, 0, r * .57, '#13232d', color + '88', 2);
        for (let j = 0; j < 4; j++) {
            const a = j * Math.PI / 2;
            line(ctx, [r * .16 * Math.cos(a), r * .16 * Math.sin(a)], [r * .47 * Math.cos(a), r * .47 * Math.sin(a)], color + '90', 5);
        }
        circle(ctx, 0, 0, 6, color);
    }
    ctx.restore();
}
export const vsub = (a, b) => a.map((x, i) => x - b[i]);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
export function projector(camera) { const f = normalize(vsub(camera.target, camera.position)), r = normalize(cross(f, [0, 1, 0])), u = cross(r, f), roll = camera.roll || 0, fr = 1 / Math.tan(camera.fov * Math.PI / 360); return p => { const d = vsub(p, camera.position), z = dot(d, f), xx = dot(d, r), yy = dot(d, u), cx = xx * Math.cos(roll) - yy * Math.sin(roll), cy = xx * Math.sin(roll) + yy * Math.cos(roll), scale = 450 * fr / Math.max(.1, z); return { x: 800 + cx * scale, y: 480 - cy * scale, z, scale, visible: z > .1 }; }; }
export function cubePoints(c, s) { return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [c[0] + x * s[0] / 2, c[1] + y * s[1] / 2, c[2] + z * s[2] / 2]))); }
export function box3(ctx, project, c, s, color = C.cyan, { alpha = 1 } = {}) {
    const p = cubePoints(c, s).map(project), faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    ctx.save();
    ctx.globalAlpha *= alpha;
    faces.map((f, i) => ({ f, i, z: f.reduce((a, j) => a + p[j].z, 0) / 4 })).sort((a, b) => b.z - a.z).forEach(({ f, i }) => {
        if (f.some(j => !p[j].visible))
            return;
        path(ctx, f.map(j => [p[j].x, p[j].y]), color + '90', 1.3, true, ['#203542', '#526771', '#314a54', '#97a5a8', '#253742', '#5c737c'][i]);
    });
    ctx.restore();
}
export function floor3(ctx, project) {
    for (let v = -8; v <= 8; v++) {
        const a = project([-8, 0, v]), b = project([8, 0, v]), c = project([v, 0, -8]), d = project([v, 0, 8]);
        if (a.visible && b.visible)
            line(ctx, [a.x, a.y], [b.x, b.y], '#93b9c01c', 1);
        if (c.visible && d.visible)
            line(ctx, [c.x, c.y], [d.x, d.y], '#93b9c01c', 1);
    }
}
export function disk3(ctx, project, center, radius, depth, angle, color = C.gold) {
    const outline = z => Array.from({ length: 49 }, (_, i) => { const a = i / 48 * TAU; return project([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a), center[2] + z]); });
    const plus = project([center[0], center[1], center[2] + depth / 2]), minus = project([center[0], center[1], center[2] - depth / 2]), sign = plus.z < minus.z ? 1 : -1, nearZ = sign * depth / 2;
    const back = outline(-nearZ), front = outline(nearZ);
    path(ctx, back.map(p => [p.x, p.y]), color + '70', 1.5, true, '#273d49');
    const walls = Array.from({ length: 48 }, (_, i) => ({ i, z: (back[i].z + back[i + 1].z + front[i + 1].z + front[i].z) / 4 })).sort((a, b) => b.z - a.z);
    walls.forEach(({ i }) => {
        if (!back[i].visible || !front[i].visible)
            return;
        path(ctx, [back[i], back[i + 1], front[i + 1], front[i]].map(p => [p.x, p.y]), color + '25', .5, true, i < 24 ? '#374e5a' : '#172a35');
    });
    path(ctx, front.map(p => [p.x, p.y]), color, 2, true, '#263e49');
    for (let i = 0; i < 8; i++) {
        const a = angle + i * TAU / 8, pa = project([center[0] + radius * .35 * Math.cos(a), center[1] + radius * .35 * Math.sin(a), center[2] + nearZ + sign * .01]), pb = project([center[0] + radius * .82 * Math.cos(a), center[1] + radius * .82 * Math.sin(a), center[2] + nearZ + sign * .01]);
        line(ctx, [pa.x, pa.y], [pb.x, pb.y], color, Math.max(1, pa.scale * .055));
    }
    const cp = project([center[0], center[1], center[2] + nearZ + sign * .02]);
    circle(ctx, cp.x, cp.y, Math.max(2, cp.scale * .13), '#162d38', color, 2);
}
export function assembly3(ctx, project, { theta = .2 } = {}) {
    box3(ctx, project, [0, .18, 0], [4.4, .35, 1.8], C.muted);
    box3(ctx, project, [0, .92, -.3], [.35, 1.5, .65], C.cyan);
    const parts = [{ c: [-1, 1.9, 0], a: theta, color: C.gold }, { c: [1, 1.9, 0], a: -theta + Math.PI / 8, color: C.cyan }].sort((a, b) => project(b.c).z - project(a.c).z);
    parts.forEach(p => disk3(ctx, project, p.c, .96, .32, p.a, p.color));
}
export function cameraBadge(ctx, camera, extra = '') { text(ctx, `视角 ${camera.fov.toFixed(0)}°  ·  横滚 ${(camera.roll * 180 / Math.PI).toFixed(1)}°${extra ? '  ·  ' + extra : ''}`, 90, 753, 20, C.muted); }
// Cache allocations only. Each group is cleared and rendered from absolute time.
// Filtering a completed group once avoids a full blur pass for every line/face.
const groupedLayers = new WeakMap();
export function blurredGroup(ctx, key, blurPixels, drawGroup, opacity = 1) {
    let groups = groupedLayers.get(ctx);
    if (!groups) {
        groups = new Map();
        groupedLayers.set(ctx, groups);
    }
    let layer = groups.get(key);
    if (!layer) {
        const makeCanvas = () => {
            if (typeof OffscreenCanvas !== 'undefined')
                return new OffscreenCanvas(800, 450);
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 450;
            return canvas;
        };
        const source = makeCanvas(), filtered = makeCanvas();
        layer = {
            source, filtered,
            sourceContext: source.getContext('2d', { willReadFrequently: true }),
            filterContext: filtered.getContext('2d', { willReadFrequently: true })
        };
        groups.set(key, layer);
    }
    const source = layer.sourceContext;
    source.setTransform(1, 0, 0, 1, 0, 0);
    source.globalAlpha = 1;
    source.globalCompositeOperation = 'source-over';
    source.filter = 'none';
    source.clearRect(0, 0, 800, 450);
    source.save();
    source.scale(0.5, 0.5);
    drawGroup(source);
    source.restore();
    const filtered = layer.filterContext;
    filtered.setTransform(1, 0, 0, 1, 0, 0);
    filtered.globalAlpha = 1;
    filtered.globalCompositeOperation = 'source-over';
    filtered.filter = 'none';
    filtered.clearRect(0, 0, 800, 450);
    filtered.filter = blurPixels > 0.01 ? `blur(${(blurPixels * 0.5).toFixed(3)}px)` : 'none';
    filtered.drawImage(layer.source, 0, 0);
    filtered.filter = 'none';
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.filter = 'none';
    ctx.drawImage(layer.filtered, 0, 0, 1600, 900);
    ctx.restore();
}
export const palettes = {
    titanium: { ...C, bg: '#101722', gold: '#e8b56b', cyan: '#75d9d7', coral: '#ed8774' },
    ember: { ...C, bg: '#22151d', gold: '#f1bb76', cyan: '#d5ced1', coral: '#f27359' },
    porcelain: { ...C, bg: '#eeeae2', bg2: '#b6c9cd', halo: '#ffffff90', ink: '#1f3542', muted: '#4c626b', line: '#819ba2', gold: '#9b5c36', cyan: '#267681', coral: '#aa5144' }
};
export const optionsFor = options => ({ ...options, intensity: clamp(options?.intensity ?? .65), palette: options?.palette || 'titanium', theme: palettes[options?.palette] || palettes.titanium });
export function candidate(meta, sample, draw) {
    const sampled = (t, options = {}) => sample(t, optionsFor(options));
    return { usage: '适合以一个明确对象解释一次变化；将示意数据替换为项目数据。', parameters: { intensity: { min: 0, max: 1, default: .65 }, palette: { values: Object.keys(palettes), default: 'titanium' } }, stages: ['建立对象', '改变条件', '看清结果', '接力'], codeFile: `modules/${meta.module}.js`, ...meta, duration: meta.duration || 10, sample: sampled, draw: (ctx, t, w, h, options = {}) => draw(ctx, t, w, h, optionsFor(options), sampled(t, options)) };
}
