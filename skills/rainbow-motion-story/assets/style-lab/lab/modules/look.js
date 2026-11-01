import { C, TAU, phase, clamp, mix, smooth, window, begin, end, text, line, path, circle, pill, roundRect, glow, gear, projector, floor3, box3, disk3, candidate, blurredGroup } from './common.js';
function sphere(ctx, x, y, r, type, light, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();
    const base = ctx.createRadialGradient(x - r * .45 + light * r * .25, y - r * .5, r * .03, x + r * .2, y + r * .3, r * 1.6);
    if (type === 'ceramic') {
        base.addColorStop(0, '#f5efe3');
        base.addColorStop(.35, '#bcc5c5');
        base.addColorStop(1, '#334f5e');
    }
    else if (type === 'metal') {
        base.addColorStop(0, '#d8e1e3');
        base.addColorStop(.22, '#7995a2');
        base.addColorStop(.44, '#203641');
        base.addColorStop(.62, '#b2b9b3');
        base.addColorStop(.78, '#4e6976');
        base.addColorStop(1, '#102a35');
    }
    else {
        base.addColorStop(0, '#bceced55');
        base.addColorStop(.4, '#548b9e22');
        base.addColorStop(1, '#294c6688');
    }
    ctx.fillStyle = base;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (type === 'glass') {
        for (let i = -3; i <= 3; i++) {
            const q = i * 30;
            path(ctx, Array.from({ length: 25 }, (_, j) => { const z = (j / 24 - .5) * 2; return [x + q * (.7 + .35 * Math.cos(z * Math.PI / 2)), y + z * r]; }), color + '88', 3);
        }
        circle(ctx, x, y, r - 3, null, '#b6eced88', 4);
    }
    const hl = ctx.createRadialGradient(x - r * .43 + light * r * .25, y - r * .48, 0, x - r * .43 + light * r * .25, y - r * .48, r * (type === 'ceramic' ? .6 : .27));
    hl.addColorStop(0, type === 'glass' ? '#ffffffb0' : '#ffffffa0');
    hl.addColorStop(1, '#ffffff00');
    ctx.fillStyle = hl;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
    circle(ctx, x, y, r, null, '#c5d8df55', 1.5);
}
const material = candidate({ id: 'look-material-palette', module: 'look', title: '同一光位，区分三种材料', description: '用同一个球和连续光位观察陶瓷、金属、玻璃的不同响应；色板贯穿材质，而不是给每个对象任意换色。', referenceIds: ['aesthetic', 'rotary-cutaway'], usage: '适合建立色彩与材料规范、展示工程材质差异。', recipe: ['锁定几何和光位，让材质差异可比较。', '漫反射、窄高光、透射分别控制，不只换底色。', 'Canvas为材料外观研究；生产镜头应映射PBR材质。'], stages: ['同一几何', '光位移动', '材料分离', '统一色板'] }, (t, o) => ({ time: phase(t) * 10, light: Math.sin(phase(t) * TAU), roughness: [.62, .16, .07], materialTypes: ['ceramic', 'metal', 'glass'] }), (ctx, t, w, h, o, s) => { const p = o.theme; begin(ctx, w, h, { title: '高级感来自材料分工，不是统一发亮', subtitle: '同一几何、同一光位 · Canvas 外观研究，不是光线追踪', palette: p }); [380, 800, 1220].forEach((x, i) => { ctx.save(); ctx.scale(1, .2); glow(ctx, x, 620 / .2, 150, p.gold); ctx.restore(); sphere(ctx, x, 450, 145, s.materialTypes[i], s.light, [p.gold, p.cyan, p.coral][i]); text(ctx, ['陶瓷 · 宽而柔', '金属 · 窄高光', '玻璃 · 透射层次'][i], x, 665, 28, p.ink, 600, 'center'); text(ctx, `粗糙度参考 ${s.roughness[i].toFixed(2)}`, x, 716, 22, p.muted, 400, 'center'); }); [p.bg, p.ink, p.gold, p.cyan, p.coral].forEach((c, i) => roundRect(ctx, 647 + i * 62, 795, 46, 16, 8, c, p.muted + '55')); end(ctx); });
const depth = candidate({ id: 'look-depth-atmosphere', module: 'look', title: '用纵深组织空气与焦点', description: '近、中、远三层共用一个世界坐标；远物对比降低，焦点在层间移动，文字独立清晰。', referenceIds: ['camera', 'aesthetic'], usage: '适合大场景、空间尺度揭示和环境建立镜头。', recipe: ['深度排序先成立，再加薄雾。', '远处降低对比，不整屏盖白。', '焦点移动时保持主体可辨，标注不进入景深。'], stages: ['近景', '中景', '远景', '回到主体'] }, (t, o) => { const p = phase(t), f = 8 + 5 * (1 - Math.cos(p * TAU)) * .5; return { time: p * 10, focusDepth: f, camera: { position: [.8 * Math.sin(p * TAU), 3.3, 10], target: [0, 1.5, 0], fov: 45, roll: 0 }, layers: [{ z: -7, color: 'coral', radius: 1.2 }, { z: -2, color: 'cyan', radius: 1.1 }, { z: 2, color: 'gold', radius: .9 }] }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '把空气留在物体之间', subtitle: '景深只影响空间层；文字维持清楚', palette: p });
    const proj = projector(s.camera);
    floor3(ctx, proj);
    s.layers.forEach((q, i) => {
        const center = [(i - 1) * 2.7, 1.8, q.z];
        const screen = proj(center);
        const blur = clamp(Math.abs(screen.z - s.focusDepth) * .75, 0, 5);
        const fog = clamp((screen.z - 7) / 14, 0, .55);
        blurredGroup(ctx, `atmosphere-${i}`, blur, layer => {
            box3(layer, proj, [center[0], .45, q.z], [2, .8, 1.8], p[q.color]);
            disk3(layer, proj, center, q.radius, .25, s.time * .4, p[q.color]);
        }, 1 - fog);
        text(ctx, ['远景', '中景', '近景'][i], screen.x, Math.min(705, screen.y + screen.scale * (q.radius + .7)), 24, p[q.color], 600, 'center');
    });
    text(ctx, `焦点距离 ${s.focusDepth.toFixed(1)} m`, 800, 230, 29, p.ink, 600, 'center');
    text(ctx, '空间对比逐层退让，关键轮廓不消失', 800, 805, 23, p.muted, 500, 'center');
    end(ctx);
});
const buffers = new WeakMap();
function exposureBuffers(ctx) {
    if (!buffers.has(ctx)) {
        const make = () => {
            if (typeof OffscreenCanvas !== 'undefined')
                return new OffscreenCanvas(600, 400);
            const c = document.createElement('canvas');
            c.width = 600;
            c.height = 400;
            return c;
        };
        buffers.set(ctx, { sample: make(), sum: make() });
    }
    return buffers.get(ctx);
}
function sampleScene(ctx, time, theme) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.fillStyle = '#12212e'; ctx.fillRect(0, 0, 600, 400); circle(ctx, 300, 200, 128, null, '#4c657155', 2); const a = time * TAU * 4, x = 300 + 128 * Math.cos(a), y = 200 + 128 * Math.sin(a); ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); roundRect(ctx, -28, -48, 56, 96, 10, theme.cyan, theme.ink + '80'); line(ctx, [-15, -20], [15, -20], theme.gold, 5); ctx.restore(); circle(ctx, 300, 200, 8, theme.gold); }
const blur = candidate({ id: 'look-multisample-shutter', module: 'look', title: '真实时间采样的运动模糊', description: '对同一帧曝光区间中的16个实际时间状态做均值合成；不是保存旧帧的拖影，也不让文字跟着糊。', referenceIds: ['transmission', 'shuffle'], usage: '适合快速位移、转盘、相机穿越；读字和慢解释段应收敛。', recipe: ['曝光时间取自帧率和快门角。', '每个样本重新求场景状态，16样本均值合成。', '文字在曝光合成后绘制；色域中均值为预览近似。'], stages: ['当前状态', '曝光窗口', '子帧求值', '均值合成'] }, (t, o) => { const center = phase(t) * 10, shutter = 1 / 30 * (.25 + o.intensity * .75); return { time: center, fps: 30, samples: 16, shutterSeconds: shutter, angularVelocity: TAU * 4, sampleTimes: Array.from({ length: 16 }, (_, i) => center + ((i + .5) / 16 - .5) * shutter) }; }, (ctx, t, w, h, o, s) => { const p = o.theme; begin(ctx, w, h, { title: '只在运动期间模糊，文字保持锋利', subtitle: '相同运动、相同当前帧 · 对照单时刻与16次曝光采样', palette: p }); const b = exposureBuffers(ctx), sc = b.sample.getContext('2d', { willReadFrequently: true }), sum = b.sum.getContext('2d', { willReadFrequently: true }); sampleScene(sc, s.time, p); ctx.drawImage(b.sample, 110, 270, 600, 400); sum.setTransform(1, 0, 0, 1, 0, 0); sum.globalAlpha = 1; sum.globalCompositeOperation = 'source-over'; sum.filter = 'none'; sum.clearRect(0, 0, 600, 400); s.sampleTimes.forEach((time, i) => { sampleScene(sc, time, p); sum.globalAlpha = 1 / (i + 1); sum.drawImage(b.sample, 0, 0); }); sum.globalAlpha = 1; ctx.drawImage(b.sum, 890, 270, 600, 400); text(ctx, '单一时刻', 410, 220, 29, p.ink, 600, 'center'); text(ctx, '有限曝光', 1190, 220, 29, p.ink, 600, 'center'); text(ctx, '清晰边缘会逐帧跳动', 410, 725, 25, p.muted, 500, 'center'); text(ctx, `${(s.shutterSeconds * 1000).toFixed(1)} ms · 16 个新状态的均值`, 1190, 725, 25, p.cyan, 500, 'center'); text(ctx, '示例：4 圈/秒 · 30 fps · 不缓存前一显示帧', 800, 810, 23, p.muted, 500, 'center'); end(ctx); });
const layout = candidate({ id: 'look-editorial-layout', module: 'look', title: '负空间，让重点自己站出来', description: '物体从中景移到阅读区旁边，信息按标题、核心数值、近物标注依次出现；统一基线和字号层级。', referenceIds: ['aesthetic', 'mofs', 'car-ignition'], usage: '适合公式章节、结论页、关键事实与机制解释。', recipe: ['先给对象，信息随后出现。', '用同一字号层级和固定基线，不给每句换样式。', '标签靠近所属部位，连接线不跨越对象。'], stages: ['物体先行', '让出负空间', '重点出现', '局部标注'] }, (t, o) => { const s = phase(t) * 10, q = window(s, 1, 9.3, 2, 1.5); return { time: s, reveal: q, objectX: mix(800, 1110, q), radius: mix(205, 175, q), titleAlpha: smooth((s - 2) / 1) * (1 - smooth((s - 8.3) / 1)), labelsAlpha: window(s, 4, 8.8, 1, 1) }; }, (ctx, t, w, h, o, s) => { const p = o.theme; begin(ctx, w, h, { title: '主次清楚，比再加一层动效更有力量', subtitle: '对象 → 负空间 → 数值 → 局部标注', palette: p }); glow(ctx, s.objectX, 450, 300, p.gold); gear(ctx, s.objectX, 450, s.radius, 32, s.time * .22, p.gold); ctx.save(); ctx.globalAlpha = s.titleAlpha; text(ctx, '一个清楚的', 145, 335, 45, p.ink, 700); text(ctx, '中心问题', 145, 400, 60, p.ink, 800); text(ctx, '4 : 1', 145, 520, 99, p.gold, 800); text(ctx, '只保留当下需要的信息', 148, 620, 27, p.muted); line(ctx, [148, 665], [565, 665], p.line, 2); ctx.restore(); ctx.save(); ctx.globalAlpha = s.labelsAlpha; const a = [s.objectX + s.radius * .7, 450 - s.radius * .7], b = [s.objectX + s.radius * .78, 450 + s.radius * .63]; line(ctx, a, [1360, 260], p.cyan, 2); text(ctx, '当前部位', 1360, 220, 27, p.cyan, 600, 'center'); line(ctx, b, [1370, 650], p.coral, 2); text(ctx, '相关结果', 1370, 690, 27, p.coral, 600, 'center'); ctx.restore(); text(ctx, '统一字号层级 · 保持基线 · 不把整段旁白贴上屏幕', 800, 815, 22, p.muted, 500, 'center'); end(ctx); });
export const candidates = [material, depth, blur, layout];
