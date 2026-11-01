/** Original perspective/time studies. Deterministic analytic illustration, not a physical solver. */
import { candidate, clamp, smooth, mix, TAU, hash, begin, end, text, line, circle, path, projector, normalize, cross, dot, vsub } from './common.js';

const DURATION = 12;
const time = t => clamp(Number.isFinite(t) ? t : 0, 0, DURATION);
const progress = (t, a, b) => smooth((t - a) / (b - a));
const smoothIntegral = x => { const q = clamp(x); return q ** 6 - 3 * q ** 5 + 2.5 * q ** 4; };
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map(v => v * s);
const rotate = (p, a) => {
    let [x, y, z] = p;
    [y, z] = [y * Math.cos(a[0]) - z * Math.sin(a[0]), y * Math.sin(a[0]) + z * Math.cos(a[0])];
    [x, z] = [x * Math.cos(a[1]) + z * Math.sin(a[1]), -x * Math.sin(a[1]) + z * Math.cos(a[1])];
    [x, y] = [x * Math.cos(a[2]) - y * Math.sin(a[2]), x * Math.sin(a[2]) + y * Math.cos(a[2])];
    return [x, y, z];
};
function shade(hex, light) {
    const n = parseInt(hex.slice(1, 7), 16);
    return `rgb(${[16, 8, 0].map(k => Math.round(clamp(((n >> k) & 255) * light, 0, 255))).join(',')})`;
}

// Faces from every solid share one depth queue. Titles and metrics are composited outside it.
function renderer(ctx, camera) {
    const project = projector(camera), forward = normalize(vsub(camera.target, camera.position));
    const faces = [], near = .18;
    const depth = p => dot(vsub(p, camera.position), forward);
    function clipped(points) {
        const out = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length], da = depth(a), db = depth(b);
            if (da >= near) out.push(a);
            if ((da >= near) !== (db >= near)) out.push(a.map((v, j) => mix(v, b[j], (near - da) / (db - da))));
        }
        return out;
    }
    function face(points, color, opts = {}) {
        const verts = clipped(points); if (verts.length < 3) return;
        const normal = normalize(cross(vsub(points[1], points[0]), vsub(points[2], points[0])));
        const illumination = opts.emissive ? 1 : .34 + .63 * Math.abs(dot(normal, normalize([-.4, .8, .55])));
        faces.push({ points: verts, color: shade(color, illumination), stroke: opts.stroke, alpha: opts.alpha ?? 1, depth: verts.reduce((s, p) => s + depth(p), 0) / verts.length });
    }
    function box(center, size, color, rotation = [0, 0, 0], opts = {}) {
        const v = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => add(center, rotate([x * size[0] / 2, y * size[1] / 2, z * size[2] / 2], rotation)))));
        [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]].forEach(f => face(f.map(i => v[i]), color, opts));
    }
    function torus(center, radius, tube, rotation, color, seg = 52, crossSeg = 8) {
        const point = (i, j) => { const a = i / seg * TAU, b = j / crossSeg * TAU; return add(center, rotate([(radius + tube * Math.cos(b)) * Math.cos(a), (radius + tube * Math.cos(b)) * Math.sin(a), tube * Math.sin(b)], rotation)); };
        for (let i = 0; i < seg; i++) for (let j = 0; j < crossSeg; j++) face([point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)], color);
    }
    function line3(a, b, color, width = 1, alpha = 1) {
        let da = depth(a), db = depth(b); if (da < near && db < near) return;
        if (da < near) a = a.map((v, i) => mix(v, b[i], (near - da) / (db - da)));
        if (db < near) b = b.map((v, i) => mix(v, a[i], (near - db) / (depth(a) - db)));
        const pa = project(a), pb = project(b); ctx.save(); ctx.globalAlpha *= alpha; line(ctx, [pa.x, pa.y], [pb.x, pb.y], color, width); ctx.restore();
    }
    function flush() {
        faces.sort((a, b) => b.depth - a.depth).forEach(f => {
            const p = f.points.map(project); ctx.save(); ctx.globalAlpha *= f.alpha;
            path(ctx, p.map(v => [v.x, v.y]), f.stroke || f.color, .55, true, f.color); ctx.restore();
        });
    }
    return { face, box, torus, line3, project, flush };
}

/** Integral of the action rate. It is exactly flat from 2.8 to 8.9 seconds. */
export function actionClock(t) {
    t = time(t);
    if (t <= 1.65) return { worldTime: t, temporalRate: 1, frozen: false };
    if (t < 2.8) { const q = (t - 1.65) / 1.15; return { worldTime: 1.65 + 1.15 * (q - smoothIntegral(q)), temporalRate: clamp(1 - smooth(q)), frozen: false }; }
    const stopped = 2.225;
    if (t <= 8.9) return { worldTime: stopped, temporalRate: 0, frozen: true };
    if (t < 10.25) { const q = (t - 8.9) / 1.35; return { worldTime: stopped + 1.35 * smoothIntegral(q), temporalRate: clamp(smooth(q)), frozen: false }; }
    return { worldTime: stopped + .675 + t - 10.25, temporalRate: 1, frozen: false };
}

function fragments(worldTime) {
    const flight = Math.max(0, worldTime - .38);
    return Array.from({ length: 36 }, (_, i) => {
        const angle = i * TAU / 36 + hash(i + 3) * .22, speed = .68 + hash(i + 29) * .72;
        const radius = 1.25 + speed * flight;
        return { id: i, position: [Math.cos(angle) * radius, 2.12 + (.65 + hash(i + 51) * .74) * flight - .20 * flight ** 2, Math.sin(angle) * radius], rotation: [worldTime * (.2 + hash(i + 70)), angle + worldTime * .41, worldTime * (.7 + hash(i + 91))], size: .055 + hash(i + 111) * .095, opacity: smooth(worldTime / .32) };
    });
}

export const bulletTime = candidate({
    id: 'camera-bullet-time', module: 'camera', title: '停住时间，飞过这一瞬间', duration: DURATION, loop: false,
    codeFile: './modules/camera-time.js', referenceIds: ['camera'], stageTimes: [0, 1.65, 2.8, 8.9], previewTime: 5.5,
    description: '动作有独立时钟：先运动、连续减速至完全冻结，相机绕同一组悬停几何飞行 180–234°，最后动作恢复。',
    usage: '适合揭示高速机构、撞击或粒子过程。先建立运动，再冻结观察；冻结段不改变几何。',
    stages: ['运动建立', '动作渐停', '环绕这一瞬', '恢复动作'],
    recipe: ['动作时钟是速度包络的解析积分，2.8–8.9 秒严格保持同一世界状态。', '镜头在冻结期间独立绕行；碎片的世界坐标不跟相机转。', '粒子为确定性弹道示意，非碰撞求解；退出使用有加速度连续性的速度恢复。', 'loop:false；12 秒结束后停在终态，交接镜头使用最后相机位姿。']
}, (t, o) => {
    t = time(t); const clock = actionClock(t), q = progress(t, 2.8, 8.9), sweep = Math.PI * (1 + .3 * o.intensity), angle = -.58 + q * sweep;
    const radius = 11.4 - 1.15 * progress(t, 1.2, 2.8) + 1.3 * progress(t, 9.3, 12);
    const target = [0, 2.25, 0], position = [radius * Math.sin(angle), 4.15 + 1.45 * Math.sin(Math.PI * q), radius * Math.cos(angle)];
    return { time: t, ...clock, cameraTime: t, orbitProgress: q, orbitAngle: angle, sweepDegrees: sweep * 180 / Math.PI,
        camera: { position, target, fov: 45, roll: .055 * Math.sin(TAU * q), near: .18, focusDistance: Math.hypot(...vsub(position, target)) },
        hero: { position: [0, 2.12, 0], rotation: [.28 + .15 * Math.sin(clock.worldTime), .48 * clock.worldTime, .83 * clock.worldTime] }, fragments: fragments(clock.worldTime) };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '这一瞬间不动，镜头可以飞过去', subtitle: '子弹时间 · 动作时钟与相机时钟分开', palette: p });
    ctx.save(); ctx.beginPath(); ctx.rect(45, 155, 1510, 558); ctx.clip();
    const r = renderer(ctx, s.camera);
    // Studio floor is fixed in world space. It provides a stable parallax reference.
    for (let i = -8; i <= 8; i++) { r.line3([-8, -.05, i], [8, -.05, i], p.line, 1, .30); r.line3([i, -.05, -8], [i, -.05, 8], p.line, 1, .30); }
    for (let k = 0; k < 2; k++) {
        const radius = 3.3 + k * .11, pts = Array.from({ length: 97 }, (_, i) => r.project([radius * Math.cos(i / 96 * TAU), 0, radius * Math.sin(i / 96 * TAU)]));
        path(ctx, pts.map(v => [v.x, v.y]), p.gold + (k ? '24' : '65'), k ? 1 : 1.7);
    }
    // Four separate low pedestals have physical thickness and fixed orientation.
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; r.box([3.8 * Math.cos(a), .19, 3.8 * Math.sin(a)], [.62, .38, .62], p.muted); r.box([3.8 * Math.cos(a), .40, 3.8 * Math.sin(a)], [.52, .035, .52], p.gold, [0, 0, 0], { emissive: true }); }
    const c = s.hero.position, a = s.hero.rotation;
    r.torus(c, 1.02, .14, a, p.muted);
    r.torus(c, .75, .065, add(a, [.78, .3, 0]), p.gold, 40, 7);
    // Hub with eight radial vanes. Geometry and its detail share the action clock.
    r.box(c, [.54, .54, .54], p.cyan, add(a, [.3, .5, .2]));
    for (let i = 0; i < 8; i++) {
        const angle = i * TAU / 8;
        const center = add(c, rotate([.67 * Math.cos(angle), .67 * Math.sin(angle), 0], a));
        const local = [[-.25, -.085, -.06], [.25, -.11, -.06], [.25, .11, .06], [-.25, .085, .06]];
        r.face(local.map(v => add(center, rotate(rotate(v, [0, .27, angle]), a))), i % 2 ? p.gold : p.cyan, { stroke: p.ink + '66' });
    }
    s.fragments.forEach(f => r.box(f.position, [f.size, f.size * 1.6, f.size * .6], f.id % 3 ? p.gold : p.cyan, f.rotation, { alpha: f.opacity }));
    r.flush(); ctx.restore();
    // Freeze readout is outside the geometry; it is not a decorative fake clock.
    const label = s.frozen ? '动作冻结 · 相机继续' : s.time < 2.8 ? '进入这一瞬间' : '动作接着往前';
    text(ctx, label, 76, 748, 26, s.frozen ? p.gold : p.ink, 700);
    text(ctx, `动作 ${s.worldTime.toFixed(3)} s`, 650, 748, 22, p.cyan, 600);
    text(ctx, `速度 ${s.temporalRate.toFixed(2)}×`, 950, 748, 22, p.muted);
    text(ctx, `环绕 ${(s.orbitProgress * s.sweepDegrees).toFixed(0)}°`, 1270, 748, 22, p.gold, 600);
    const y = 807; line(ctx, [76, y], [1524, y], p.line, 3);
    line(ctx, [76, y], [76 + 1448 * s.time / 12, y], p.gold, 3);
    [2.8, 8.9].forEach(x => { circle(ctx, 76 + x / 12 * 1448, y, 5, p.bg, p.gold, 2); });
    text(ctx, '运动', 76, 845, 19, p.muted); text(ctx, '冻结 6.1 s · 同一组世界坐标', 800, 845, 19, p.muted, 500, 'center'); text(ctx, '恢复', 1524, 845, 19, p.muted, 500, 'right');
    end(ctx);
});

const TARGET = [0, 2.45, 0], K = 3.85, TARGET_HEIGHT = 2.6;
export const hitchcockZoom = candidate({
    id: 'camera-hitchcock-zoom', module: 'camera', title: '希区柯克变焦：空间迎面压过来', duration: DURATION, loop: false,
    codeFile: './modules/camera-time.js', referenceIds: ['camera'], stageTimes: [0, 1.2, 5.2, 9.3], previewTime: 8.4,
    description: '相机从近处退远、焦距同步增加；中央正对镜头的目标面投影不变，近柱与远拱廊的比例显著变化。',
    usage: '适合顿悟、失重感或空间关系揭示；使用有前后层次的环境，避免只在空背景中缩放主体。',
    stages: ['建立近景', '后退长焦', '空间压缩', '停住对照'],
    recipe: ['目标平面正对镜头，固定 d × tan(fov/2) = 3.85 m。', '主体的固定轮廓与前后两组建筑共同提供尺度参照。', '透视真实来自相机距离和视场角，禁止单独缩放背景或主体冒充变焦。', '12 秒单次镜头，终态保持；HUD 给出目标投影与背景相对尺度。']
}, (t, o) => {
    t = time(t); const q = progress(t, 1.2, 9.3), nearD = 6, farD = 16 + o.intensity * 11, d = mix(nearD, farD, q), fov = 2 * Math.atan(K / d) * 180 / Math.PI;
    const bgZ = -18, foreZ = 2.6;
    return { time: t, worldTime: 0, temporalRate: 0, zoomProgress: q, camera: { position: [0, TARGET[1], d], target: [...TARGET], fov, roll: 0, near: .18, focusDistance: d },
        distance: d, target: { center: [...TARGET], height: TARGET_HEIGHT, width: 1.64 }, projectionConstant: d * Math.tan(fov * Math.PI / 360), targetHeightPixels: 450 * TARGET_HEIGHT / K,
        backgroundRelativeScale: (d / (d - bgZ)) / (nearD / (nearD - bgZ)), foregroundRelativeScale: (d / (d - foreZ)) / (nearD / (nearD - foreZ)) };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '盯住中央轮廓，整座空间向你靠近', subtitle: '希区柯克变焦 · 后退长焦，主体大小保持不变', palette: p });
    ctx.save(); ctx.beginPath(); ctx.rect(45, 155, 1510, 558); ctx.clip();
    const r = renderer(ctx, s.camera);
    // Architectural perspective is fixed world geometry, never a scaled backdrop.
    r.face([[-12, -.12, 4], [12, -.12, 4], [12, -.12, -36], [-12, -.12, -36]], p.bg);
    const zLayers = [-30, -24, -18, -13, -8.5, -4.5, -1.7];
    for (const z of zLayers) {
        const span = 4.25, top = 6.25;
        for (const sign of [-1, 1]) {
            r.box([sign * span, 2.75, z], [.32, 5.5, .6], p.muted);
            r.box([sign * span, .16, z], [.72, .32, .90], p.muted);
            r.box([sign * span, 5.45, z], [.55, .22, .78], p.gold);
            r.box([sign * (span - .19), 2.7, z + .315], [.045, 4.8, .028], p.gold, [0, 0, 0], { emissive: true });
            const beamA = [sign * span, 5.5, z], beamB = [sign * 2.65, top, z];
            r.face([[beamA[0], beamA[1], z + .15], [beamB[0], beamB[1], z + .15], [beamB[0], beamB[1] + .2, z + .15], [beamA[0], beamA[1] + .2, z + .15]], p.gold);
        }
        r.box([0, top + .12, z], [5.4, .25, .55], p.muted);
    }
    for (const sign of [-1, 1]) {
        r.box([sign * 2.85, 2.75, 2.6], [.42, 5.5, .55], p.gold);
        r.box([sign * 2.85, .18, 2.6], [.82, .36, .85], p.muted);
        r.box([sign * 2.6, 2.75, 2.9], [.035, 4.8, .03], p.cyan, [0, 0, 0], { emissive: true });
    }
    // Floor inlays are actual narrow quads in depth, not screen-space overlay.
    for (let x = -10; x <= 10; x += 1) r.face([[x - .007, -.105, 4], [x + .007, -.105, 4], [x + .007, -.105, -36], [x - .007, -.105, -36]], p.line, { emissive: true });
    for (let z = 2; z >= -34; z -= 2) r.face([[-12, -.104, z - .009], [12, -.104, z - .009], [12, -.104, z + .009], [-12, -.104, z + .009]], p.line, { emissive: true });
    // One planar eight-sided target. Its exact outline is the invariant, not its shadow.
    const outline = [[-.82, -.95], [-.52, -1.3], [.52, -1.3], [.82, -.95], [.82, .95], [.52, 1.3], [-.52, 1.3], [-.82, .95]];
    const border = outline.map(([x, y]) => [x, y + TARGET[1], 0]);
    r.face(border, p.gold, { emissive: true });
    r.face(outline.map(([x, y]) => [x * .92, y * .95 + TARGET[1], .002]), p.bg, { emissive: true });
    const inner = outline.map(([x, y]) => [x * .70, y * .78 + TARGET[1], .004]);
    r.face(inner, p.cyan, { emissive: true, alpha: .86 });
    // Faceted light insert on the same plane provides an easily tracked fixed center.
    r.face([[-.46, 2.45, .006], [0, 3.13, .006], [.46, 2.45, .006], [0, 1.77, .006]], p.ink, { emissive: true });
    r.face([[0, 3.13, .008], [.46, 2.45, .008], [0, 1.77, .008]], p.gold, { emissive: true });
    r.flush();
    // Fixed brackets deliberately compare the target plane; they do not drive its scale.
    const top = r.project([0, TARGET[1] + TARGET_HEIGHT / 2, 0]), bottom = r.project([0, TARGET[1] - TARGET_HEIGHT / 2, 0]);
    for (const x of [660, 940]) { line(ctx, [x, top.y], [x + (x < 800 ? 18 : -18), top.y], p.gold, 1.6); line(ctx, [x, bottom.y], [x + (x < 800 ? 18 : -18), bottom.y], p.gold, 1.6); }
    ctx.restore();
    text(ctx, `距离 ${s.distance.toFixed(1)} m`, 76, 751, 24, p.ink, 700);
    text(ctx, `视场 ${s.camera.fov.toFixed(1)}°`, 390, 751, 24, p.gold, 600);
    text(ctx, '主体 100.0%', 760, 751, 24, p.cyan, 700);
    text(ctx, `远景 ${(s.backgroundRelativeScale * 100).toFixed(0)}%`, 1190, 751, 24, p.gold, 600);
    text(ctx, '距离 × tan(视场 / 2) = 3.85 m', 76, 809, 20, p.muted);
    text(ctx, s.zoomProgress < .01 ? '先记住近柱和远拱的比例' : s.zoomProgress < 1 ? '中央不变，前后层次正在压缩' : '同一建筑 · 同一目标 · 不同透视', 1524, 809, 21, p.muted, 500, 'right');
    end(ctx);
});

export const candidates = [bulletTime, hitchcockZoom];
