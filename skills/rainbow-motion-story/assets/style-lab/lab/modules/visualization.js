import { C, TAU, phase, clamp, mix, smooth, window, hash, bezier, begin, end, text, line, path, circle, pill, roundRect, glow, timeline, gear, projector, candidate } from './common.js';
const entity = candidate({
    id: 'visualization-entity-formula', module: 'visualization', title: '实体的量，进入公式',
    description: '先看振子运动，再测位移和速度；两种测量分别接到势能、动能项，最后组成总能量关系。所有数值取自同一解析状态。',
    referenceIds: ['car-ignition', 'mofs'], usage: '适合力学、能量、速率与量纲解释。',
    recipe: ['先看实体，再量位移；位移符号进入势能项。', '随后量速度，再引入动能项；每次只突出新项。', '两项建立后才出现等号、加号和总能量条，数值始终同源。'],
    stages: ['实体与位移', '势能项', '速度与动能项', '完整能量对照']
}, (t, o) => {
    const time = phase(t) * 10;
    const omega = TAU / 5;
    const k = omega * omega;
    const x = Math.cos(omega * time);
    const v = -omega * Math.sin(omega * time);
    const kinetic = 0.5 * v * v;
    const potential = 0.5 * k * x * x;
    const velocityPixels = v * 95, velocityStart = 800 + x * 200;
    // The signed head follows the same velocity as the shaft. Its vertices
    // converge at a turning point before reversing, instead of flipping a
    // fixed-size arrowhead while the measured speed is zero.
    const signedHead = 15 * Math.tanh(velocityPixels / 30);
    const velocityArrow = {
        start: [velocityStart, 315], end: [velocityStart + velocityPixels, 315],
        head: [
            [velocityStart + velocityPixels - signedHead * Math.cos(.4), 315 + signedHead * Math.sin(.4)],
            [velocityStart + velocityPixels, 315],
            [velocityStart + velocityPixels - signedHead * Math.cos(.4), 315 - signedHead * Math.sin(.4)]
        ],
        headAlpha: Math.tanh(Math.abs(velocityPixels) / 15)
    };
    const exit = 1 - smooth((time - 9.2) / 0.8);
    const xFlightProgress = clamp((time - 1.9) / 1.35);
    const vFlightProgress = clamp((time - 4.35) / 1.3);
    const flightAlpha = progress => progress > 0 && progress < 0.93
        ? smooth(progress / 0.14) * (1 - smooth((progress - 0.65) / 0.28)) : 0;
    return {
        time, x, v, k, mass: 1, kinetic, potential, total: kinetic + potential, velocityArrow,
        xMeasureAlpha: smooth((time - 0.8) / 0.6) * exit,
        vMeasureAlpha: smooth((time - 3.65) / 0.6) * exit,
        potentialAlpha: smooth((time - 2.95) / 0.55) * exit,
        kineticAlpha: smooth((time - 5.25) / 0.55) * exit,
        joinAlpha: smooth((time - 6.15) / 0.55) * exit,
        barAlpha: smooth((time - 6.85) / 0.6) * exit,
        potentialEmphasis: window(time, 2.95, 3.8, 0.3, 0.5),
        kineticEmphasis: window(time, 5.25, 6.1, 0.3, 0.5),
        xFlight: {
            alpha: flightAlpha(xFlightProgress) * exit,
            position: bezier([800 + 200 * Math.cos(omega * 1.9), 525], [1050, 650], xFlightProgress, -110)
        },
        vFlight: {
            alpha: flightAlpha(vFlightProgress) * exit,
            position: bezier([800, 250], [620, 650], vFlightProgress, 120)
        }
    };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, {
        title: '让公式从物体里长出来',
        subtitle: '先观察，再测量，最后建立能量关系 · 理想无阻尼振子', palette: p
    });
    const px = 800 + s.x * 200;
    line(ctx, [450, 470], [1140, 470], p.line, 7);
    line(ctx, [450, 320], [450, 480], p.muted, 13);
    const spring = Array.from({ length: 27 }, (_, i) => [
        450 + (px - 500) * i / 26,
        410 + (i === 0 || i === 26 ? 0 : (i % 2 ? -20 : 20))
    ]);
    path(ctx, spring, p.gold, 4);
    roundRect(ctx, px - 45, 365, 90, 105, 12, '#395969', p.cyan);
    circle(ctx, px, 415, 16, p.cyan);
    const layer = (alpha, draw) => {
        if (alpha <= 0)
            return;
        ctx.save();
        ctx.globalAlpha = alpha;
        draw();
        ctx.restore();
    };
    layer(s.xMeasureAlpha, () => {
        line(ctx, [800, 486], [800, 555], p.muted, 1.5, [5, 7]);
        line(ctx, [800, 550], [px, 550], p.cyan, 2);
        text(ctx, `x = ${s.x.toFixed(2)} m`, px, 525, 25, p.cyan, 600, 'center');
    });
    layer(s.vMeasureAlpha, () => {
        line(ctx, s.velocityArrow.start, s.velocityArrow.end, p.coral, 4);
        ctx.save();
        ctx.globalAlpha *= s.velocityArrow.headAlpha;
        path(ctx, s.velocityArrow.head, p.coral, 4);
        ctx.restore();
        text(ctx, `v = ${(Math.abs(s.v) < .005 ? 0 : s.v).toFixed(2)} m/s`, 800, 250, 26, p.coral, 600, 'center');
    });
    layer(s.potentialAlpha, () => {
        text(ctx, '形变储存的能量', 1050, 600, 22, p.cyan, 500, 'center');
        text(ctx, '½ k x²', 1050, 650, 46 + 5 * s.potentialEmphasis, p.cyan, 700, 'center');
        text(ctx, `${s.potential.toFixed(3)} J`, 1050, 710, 27, p.cyan, 500, 'center');
    });
    layer(s.kineticAlpha, () => {
        text(ctx, '运动携带的能量', 620, 600, 22, p.coral, 500, 'center');
        text(ctx, '½ m v²', 620, 650, 46 + 5 * s.kineticEmphasis, p.coral, 700, 'center');
        text(ctx, `${s.kinetic.toFixed(3)} J`, 620, 710, 27, p.coral, 500, 'center');
    });
    layer(s.joinAlpha, () => {
        text(ctx, 'E =', 390, 650, 43, p.ink, 700);
        text(ctx, '+', 800, 650, 43, p.ink, 600, 'center');
    });
    for (const [flight, symbol, color] of [[s.xFlight, 'x', p.cyan], [s.vFlight, 'v', p.coral]]) {
        layer(flight.alpha, () => {
            circle(ctx, ...flight.position, 25, color);
            text(ctx, symbol, ...flight.position, 27, '#10212c', 700, 'center');
        });
    }
    layer(s.barAlpha, () => {
        const width = 840;
        roundRect(ctx, 380, 775, width, 16, 8, p.line);
        roundRect(ctx, 380, 775, width * s.kinetic / s.total, 16, 8, p.coral);
        roundRect(ctx, 380 + width * s.kinetic / s.total, 775, width * s.potential / s.total, 16, 8, p.cyan);
        text(ctx, `总能量保持 ${s.total.toFixed(3)} J`, 800, 830, 23, p.muted, 500, 'center');
    });
    end(ctx);
});
const particles = Array.from({ length: 420 }, (_, i) => { const a = i * 2.399963229728653, r = 1.8 * Math.sqrt((i + .5) / 420), z = (hash(i + 19) - .5) * 4.6; return { seed: i, from: [r * Math.cos(a) * 1.6, r * Math.sin(a) * 1.3, z], to: [(i / 419 - .5) * 5, Math.sin(i / 419 * TAU * 1.5) * .8, Math.cos(i / 419 * TAU * 1.5) * .6], color: i % 7 === 0 ? 'gold' : 'cyan' }; });
const cloud = candidate({ id: 'visualization-cloud-aggregation', module: 'visualization', title: '散点聚成一条答案', description: '固定种子的点云从分散态逐步收敛为一条连续曲线，点的身份与色彩保持，不用随机重抽制造闪烁。', referenceIds: ['ai-draw', 'aesthetic'], usage: '适合优化、概率分布、观测到推理的表示转换。', recipe: ['散点保存位置，不在每帧重新抽样。', '每一点有确定目标与路径，最后停住曲线。', '这是表示变换；接入生成模型时替换为真实中间态。'], stages: ['分散态', '建立方向', '逐步聚合', '答案停留'] }, (t, o) => { const s = phase(t) * 10, q = window(s, .8, 9.2, 3, 1.4); return { time: s, convergence: q, points: particles.map(p => ({ ...p, position: p.from.map((v, i) => mix(v, p.to[i], q)) })), camera: { position: [.6 * Math.sin(s * TAU / 10), 2.7, 8.5], target: [0, 0, 0], fov: 45, roll: 0 } }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '不是切换画面，是同一批点改变表示', subtitle: '固定点身份 → 连续轨迹 → 可读结果', palette: p });
    const proj = projector(s.camera);
    s.points.map(q => ({ ...q, screen: proj(q.position) })).sort((a, b) => b.screen.z - a.screen.z).forEach(q => { const c = q.color === 'gold' ? p.gold : p.cyan, r = clamp(q.screen.scale * .028, 1.5, 5); circle(ctx, q.screen.x, q.screen.y, r, c + Math.round(110 + 120 * s.convergence).toString(16).padStart(2, '0')); });
    if (s.convergence > .75) {
        ctx.save();
        ctx.globalAlpha = (s.convergence - .75) * 4;
        path(ctx, s.points.map(q => { const v = proj(q.position); return [v.x, v.y]; }), p.gold, 2);
        ctx.restore();
    }
    pill(ctx, s.convergence < .5 ? '保留分布，先观察变化' : '收敛之后，把结果留住', 800, 210, { color: p.gold });
    text(ctx, '表示变换示意，不冒充实际模型推理记录', 800, 785, 23, p.muted, 500, 'center');
    end(ctx);
});
function halfWidth(x) { return 80 + 75 * Math.cos(Math.PI * x / 1000) ** 2; }
const mass = Array.from({ length: 1001 }, (_, i) => 2 * (117.5 * i + 75 * 1000 / (4 * Math.PI) * Math.sin(2 * Math.PI * i / 1000)));
const total = mass.at(-1);
function inverseMass(q) {
    let a = 0, b = 1000;
    const target = q * total;
    while (b - a > 1) {
        const c = (a + b) >> 1;
        if (mass[c] < target)
            a = c;
        else
            b = c;
    }
    return a + (target - mass[a]) / (mass[b] - mass[a]);
}
const continuity = candidate({ id: 'visualization-flow-continuity', module: 'visualization', title: '流动在收窄处加速', description: '粒子按等体积坐标运动，窄口速度更快；宽度、速度和读数来自同一个截面积函数。', referenceIds: ['transmission', 'mofs'], usage: '适合质量守恒、数据吞吐和流道截面解释。', recipe: ['先看流线进入与离开，再强调窄口。', '不要给每个粒子任意速度；按累计截面积反求位置。', '此处是二维准一维不可压缩运动学，不是完整NS求解。'], stages: ['宽段', '收缩', '窄口加速', '恢复宽段'] }, (t, o) => { const p = phase(t), Q = total / 10; return { time: p * 10, flux: Q, totalMassCoordinate: total, throatArea: halfWidth(500) * 2, wideArea: halfWidth(0) * 2, throatVelocity: Q / (halfWidth(500) * 2), wideVelocity: Q / (halfWidth(0) * 2), particles: Array.from({ length: 80 }, (_, i) => { const f = (p + i / 80) % 1, x = inverseMass(f), lane = (i % 5 - 2) / 2 * .73; return { x: 300 + x, y: 455 + lane * halfWidth(x), velocity: Q / (2 * halfWidth(x)), lane }; }) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '同样一股流，窄处为什么更快？', subtitle: '累计截面积决定位置；流量在各截面相同', palette: p });
    const upper = Array.from({ length: 101 }, (_, i) => [300 + i * 10, 455 - halfWidth(i * 10)]), lower = Array.from({ length: 101 }, (_, i) => [300 + i * 10, 455 + halfWidth(i * 10)]);
    path(ctx, [...upper, ...lower.slice().reverse()], p.cyan + '80', 3, true, '#2461762c');
    [-.73, -.365, 0, .365, .73].forEach(l => path(ctx, Array.from({ length: 101 }, (_, i) => [300 + i * 10, 455 + l * halfWidth(i * 10)]), p.cyan + '40', 1.5));
    s.particles.forEach(q => { const len = 10 + q.velocity * .06; line(ctx, [q.x - len, q.y], [q.x, q.y], q.lane === 0 ? p.gold : p.cyan, 4); circle(ctx, q.x, q.y, 3, q.lane === 0 ? p.gold : p.cyan); });
    line(ctx, [300, 270], [300, 640], p.gold, 2, [7, 9]);
    line(ctx, [800, 325], [800, 585], p.coral, 2, [7, 9]);
    pill(ctx, `宽段 ${s.wideVelocity.toFixed(1)} px/s`, 390, 235, { color: p.gold });
    pill(ctx, `窄段 ${s.throatVelocity.toFixed(1)} px/s`, 1040, 235, { color: p.coral });
    text(ctx, 'A₁ v₁ = A₂ v₂', 800, 720, 43, p.ink, 700, 'center');
    text(ctx, '二维流动的运动学示意 · 同一流量，没有凭空增减粒子', 800, 790, 23, p.muted, 500, 'center');
    end(ctx);
});
const states = candidate({ id: 'visualization-multistate-confluence', module: 'visualization', title: '多种状态，汇成同一答案', description: '三条曲线先在独立空间解释，再移动到共同坐标中比较；只让一个结论突出，避免永久多面板。', referenceIds: ['ai-draw', 'shuffle', 'mofs'], usage: '适合算法候选、实验曲线、统计比较。', recipe: ['先分开建立语义。', '合并时坐标轴也一起迁移，别只移动曲线。', '读结论时压低非选中候选，保持时间刻度一致。'], stages: ['三种状态', '同轴汇合', '比较', '选定'] }, (t, o) => { const s = phase(t) * 10, q = window(s, 1.5, 9, 2.2, 1.5); return { time: s, merge: q, selected: 1, curves: [.25, .8, 1.8].map((rate, i) => ({ index: i, rate, x: mix(230 + i * 470, 410, q), y: mix(410, 430, q), scale: mix(350, 780, q), opacity: i === 1 ? 1 : mix(1, .2, q), labelOpacity: i === 1 ? 1 : 1 - smooth(q / .35) })) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '先分别理解，再放进同一个坐标', subtitle: '坐标与状态一同迁移；比较始终使用相同尺度', palette: p });
    s.curves.forEach(c => { const color = [p.coral, p.gold, p.cyan][c.index]; ctx.save(); ctx.globalAlpha = c.opacity; line(ctx, [c.x, c.y + 160], [c.x + c.scale, c.y + 160], p.line, 2); line(ctx, [c.x, c.y - 130], [c.x, c.y + 160], p.line, 2); const pts = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return [c.x + c.scale * u, c.y + 100 - 170 * (1 - Math.exp(-u * c.rate * 4)) * Math.cos(u * (c.index === 0 ? 9 : 4))]; }); path(ctx, pts, color, 4); ctx.save(); ctx.globalAlpha *= c.labelOpacity; text(ctx, `候选 ${String.fromCharCode(65 + c.index)}`, c.x + c.scale / 2, c.y - 185, 27, color, 600, 'center'); ctx.restore(); ctx.restore(); });
    if (s.merge > .7) {
        ctx.save();
        ctx.globalAlpha = (s.merge - .7) / .3;
        pill(ctx, '保留一条结论，其他作为背景', 800, 740, { color: p.gold });
        ctx.restore();
    }
    end(ctx);
});
const routeBase = Array.from({ length: 101 }, (_, i) => { const u = i / 100; return { id: i, u, x: mix(-3.2, 3.2, u), y: 1.15 * Math.sin(u * Math.PI * 1.65) - .45 }; });
const routeDistance = [0];
for (let i = 1; i < routeBase.length; i++)
    routeDistance.push(routeDistance[i - 1] + Math.hypot(routeBase[i].x - routeBase[i - 1].x, routeBase[i].y - routeBase[i - 1].y));
function routeAt(distance) {
    const d = clamp(distance) * routeDistance.at(-1);
    let index = 1;
    while (index < routeDistance.length - 1 && routeDistance[index] < d)
        index++;
    const q = (d - routeDistance[index - 1]) / (routeDistance[index] - routeDistance[index - 1]), a = routeBase[index - 1], b = routeBase[index];
    return { x: mix(a.x, b.x, q), y: mix(a.y, b.y, q), segment: index - 1, tangent: [b.x - a.x, b.y - a.y] };
}
const routeBridge = candidate({ id: 'visualization-route-bridge', module: 'visualization', title: '同一条路线，从平面进入空间', description: '先选中二维图中的黄线，再连续旋转它所在的平面；同一组采样点落入三维道路，运动标记沿原路线前进。', referenceIds: ['car-ignition', 'camera'], usage: '适合预测轨迹、运动规划、数据到实体场景的接力。', recipe: ['候选线先共用二维坐标，选中后保留同一采样点ID。', '旋转坐标平面并连续改变视点，不重新画另一条路。', '路面沿这条曲线生长；运动标记按弧长走同一路线。'], stages: ['二维候选', '选中黄线', '平面旋入道路', '沿路线执行'] }, (t, o) => {
    // Rotate toward the camera-facing side of the road. With a positive turn
    // the plane normal crosses the viewing direction and collapses the whole
    // route to a line; this direction preserves its shape throughout the dive.
    const s = phase(t) * 10, q = smooth((s - 2.2) / 3), angle = -q * Math.PI / 2, transform = p => [p.x, p.y * Math.cos(angle), p.y * Math.sin(angle)], travel = smooth((s - 5.6) / 2.9), marker = routeAt(travel);
    const camera = { position: [6 * q, 5 * q, 8 + 2 * q], target: [0, 0, 0], fov: 44, roll: -.035 * Math.sin(q * Math.PI), focusDistance: 9 };
    return { time: s, rotation: angle, bridge: q, travel, visible: window(s, 0, 10, .35, .55), otherCandidates: 1 - smooth((s - 1.4) / 1.1), roadAlpha: smooth((q - .25) / .65), camera, points: routeBase.map(p => ({ ...p, position: transform(p) })), marker: { ...marker, position: transform(marker) }, plane: { xAxis: [[-3.7, 0, 0], [3.7, 0, 0]], yAxis: [transform({ x: -3.7, y: -1.65 }), transform({ x: -3.7, y: 1.65 })] } };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '一条黄线，真的进入同一个世界', subtitle: '二维轨迹 → 旋转坐标平面 → 三维道路 → 同一路径执行', palette: p });
    const proj = projector(s.camera), tr = v => [v.x, v.y * Math.cos(s.rotation), v.y * Math.sin(s.rotation)];
    ctx.save();
    ctx.globalAlpha = s.visible;
    ctx.beginPath();
    ctx.rect(70, 165, 1460, 575);
    ctx.clip();
    for (let z = -2; z <= 2; z += .4) {
        const a = proj(tr({ x: -3.7, y: z })), b = proj(tr({ x: 3.7, y: z }));
        line(ctx, [a.x, a.y], [b.x, b.y], p.muted + '22', 1);
    }
    for (let x = -3.6; x <= 3.7; x += .6) {
        const a = proj(tr({ x, y: -2 })), b = proj(tr({ x, y: 2 }));
        line(ctx, [a.x, a.y], [b.x, b.y], p.muted + '22', 1);
    }
    if (s.otherCandidates > 0) {
        ctx.save();
        ctx.globalAlpha *= s.otherCandidates * .45;
        [-1, 1].forEach((side, k) => { const pts = routeBase.map(v => proj(tr({ x: v.x, y: v.y + side * (.34 + .2 * Math.sin(v.u * Math.PI)) }))).map(v => [v.x, v.y]); path(ctx, pts, k ? p.cyan : p.coral, 3); });
        ctx.restore();
    }
    const sidePoints = side => routeBase.map((v, i) => { const before = routeBase[Math.max(0, i - 1)], after = routeBase[Math.min(100, i + 1)], dx = after.x - before.x, dy = after.y - before.y, len = Math.hypot(dx, dy); return proj(tr({ x: v.x - dy / len * .2 * side, y: v.y + dx / len * .2 * side })); });
    const left = sidePoints(-1), right = sidePoints(1);
    ctx.save();
    ctx.globalAlpha *= s.roadAlpha;
    path(ctx, [...left, ...right.slice().reverse()].map(v => [v.x, v.y]), p.muted + '55', 1.5, true, '#334954');
    path(ctx, left.map(v => [v.x, v.y]), p.ink + '70', 2);
    path(ctx, right.map(v => [v.x, v.y]), p.ink + '70', 2);
    ctx.restore();
    const selected = s.points.map(v => proj(v.position));
    path(ctx, selected.map(v => [v.x, v.y]), p.gold, 5);
    selected.filter((_, i) => i % 10 === 0).forEach(v => circle(ctx, v.x, v.y, 3.5, p.gold));
    if (s.time > 5.2) {
        const mark = proj(s.marker.position), ahead = proj(tr({ x: s.marker.x + s.marker.tangent[0], y: s.marker.y + s.marker.tangent[1] })), angle = Math.atan2(ahead.y - mark.y, ahead.x - mark.x);
        ctx.save();
        ctx.globalAlpha *= smooth((s.time - 5.2) / .5);
        ctx.translate(mark.x, mark.y);
        ctx.rotate(angle);
        roundRect(ctx, -19, -11, 38, 22, 7, p.cyan, p.ink);
        path(ctx, [[8, -5], [14, 0], [8, 5]], '#12313c', 2);
        ctx.restore();
    }
    ctx.restore();
    pill(ctx, s.time < 2.2 ? '先选出同一条路线' : s.time < 5.6 ? '坐标与路径一起旋转' : '沿原来的采样路径前进', 800, 195, { color: p.gold });
    text(ctx, '采样点身份保持不变 · 运动按弧长推进 · 几何表示变换示意', 800, 800, 23, p.muted, 500, 'center');
    end(ctx);
});
const latticeNodes = Array.from({ length: 64 }, (_, i) => { const x = Math.floor(i / 16), y = Math.floor(i / 4) % 4, z = i % 4; return { id: i, grid: [x, y, z], position: [(x - 1.5) * 1.25, (y - 1.5) * 1.25 + 1.25, (z - 1.5) * 1.25], level: Math.max(Math.abs(x - 1.5), Math.abs(y - 1.5), Math.abs(z - 1.5)), shell: [x, y, z].filter(v => Math.abs(v - 1.5) > .5).length }; });
const latticeEdges = latticeNodes.flatMap(n => [16, 4, 1].flatMap((step, axis) => n.grid[axis] < 3 ? [{ a: n.id, b: n.id + step }] : []));
const lattice = candidate({ id: 'visualization-lattice-growth', module: 'visualization', title: '一个晶胞，长成一片结构', description: '先认出一个立方晶胞，再沿共享节点扩展成多胞晶格；镜头最后回到同一个节点，连接关系始终保存。', referenceIds: ['mofs', 'aesthetic'], usage: '适合晶格、多孔材料、网络拓扑和从局部到整体的结构解释。', recipe: ['只建立一个晶胞，先让八个角与十二条边被认出。', '新增晶胞复用边和节点，避免重叠面与突然复制。', '按深度排序边和节点；最后回到已存在的节点，不另造一个替身。'], stages: ['单一晶胞', '共享节点扩张', '多胞晶格', '回到一个节点'] }, (t, o) => {
    const s = phase(t) * 10, grow = smooth((s - 1.5) / 3), isolate = smooth((s - 6.7) / 2), selected = 42, targetNode = latticeNodes[selected].position;
    const wide = [mix(4.1, 7, grow), mix(3.5, 5.6, grow), mix(5.8, 9.5, grow)], close = targetNode.map((v, i) => v + [1.9, 1.3, 3][i]);
    const camera = { position: wide.map((v, i) => mix(v, close[i], isolate)), target: [0, 1.25, 0].map((v, i) => mix(v, targetNode[i], isolate)), fov: 44 + 7 * grow * (1 - isolate), roll: .025 * Math.sin(grow * Math.PI) * (1 - isolate), focusDistance: 9 };
    const nodes = latticeNodes.map(n => ({ ...n, reveal: n.level <= .5 ? 1 : smooth((grow * 3.7 - (n.shell - .7)) / .85), opacity: n.id === selected ? 1 : 1 - isolate * .94 }));
    return { time: s, growth: grow, isolate, selected, visible: window(s, 0, 10, .35, .55), camera, nodes, edges: latticeEdges.map(e => ({ ...e, reveal: Math.min(nodes[e.a].reveal, nodes[e.b].reveal) })) };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '把一个单元看懂，再让世界长出来', subtitle: '共享节点 · 立方晶胞 → 多胞晶格 → 原来的一个节点', palette: p });
    const proj = projector(s.camera), points = s.nodes.map(n => ({ ...n, screen: proj(n.position) })), primitives = [];
    s.edges.forEach(e => {
        if (e.reveal <= 0)
            return;
        const a = points[e.a], b = points[e.b];
        primitives.push({ type: 'edge', a, b, z: (a.screen.z + b.screen.z) / 2, alpha: e.reveal * (1 - s.isolate * .94) });
    });
    points.forEach(n => {
        if (n.reveal > 0)
            primitives.push({ type: 'node', node: n, z: n.screen.z, alpha: n.reveal * n.opacity });
    });
    ctx.save();
    ctx.globalAlpha = s.visible;
    ctx.beginPath();
    ctx.rect(70, 165, 1460, 585);
    ctx.clip();
    primitives.sort((a, b) => b.z - a.z).forEach(v => {
        ctx.save();
        ctx.globalAlpha *= v.alpha;
        if (v.type === 'edge') {
            line(ctx, [v.a.screen.x, v.a.screen.y], [v.b.screen.x, v.b.screen.y], p.cyan, 2.5);
        }
        else {
            const n = v.node, color = n.id === s.selected ? p.gold : p.cyan, r = n.id === s.selected ? mix(8, 38, s.isolate) : clamp(n.screen.scale * .042, 3, 8);
            circle(ctx, n.screen.x, n.screen.y, r, '#213b47', color, 2);
            circle(ctx, n.screen.x - r * .25, n.screen.y - r * .3, r * .24, color);
        }
        ctx.restore();
    });
    ctx.restore();
    pill(ctx, s.time < 2 ? '先看八个角、十二条边' : s.time < 6.7 ? '每个新单元，共用已有连接' : '回到刚才的那个节点', 800, 195, { color: p.gold });
    text(ctx, '立方拓扑示意，不代表某一种真实晶体的键长或原子结构', 800, 800, 23, p.muted, 500, 'center');
    end(ctx);
});
export const candidates = [entity, cloud, continuity, states, routeBridge, lattice];
