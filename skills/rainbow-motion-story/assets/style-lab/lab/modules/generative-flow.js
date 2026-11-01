/** Original demonstrations of representation and direction, not a diffusion solver. */
import { candidate, clamp, smooth, mix, hash, TAU, begin, end, text, line, path, circle, roundRect } from './common.js';

const duration = 12;
const clock = t => clamp(Number.isFinite(t) ? t : 0, 0, duration);
const between = (t, a, b) => clamp(smooth((t - a) / (b - a)));
const derivative = (t, a, b) => {
    const q = (t - a) / (b - a);
    return q <= 0 || q >= 1 ? 0 : 30 * q * q * (1 - q) * (1 - q) / (b - a);
};
const layer = (ctx, alpha, draw) => {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(alpha); draw(); ctx.restore();
};
const magnitude = v => Math.hypot(...v);
const normalize = v => { const n = magnitude(v) || 1; return v.map(x => x / n); };
const lerp2 = (a, b, q) => a.map((x, i) => mix(x, b[i], q));
function arrow(ctx, origin, direction, color, length = 26) {
    const unit = normalize(direction), tip = origin.map((x, i) => x + unit[i] * length * .5);
    const tail = origin.map((x, i) => x - unit[i] * length * .5);
    line(ctx, tail, tip, color, 1.7);
    path(ctx, [[tip[0] - unit[0] * 7 - unit[1] * 3.8, tip[1] - unit[1] * 7 + unit[0] * 3.8], tip,
        [tip[0] - unit[0] * 7 + unit[1] * 3.8, tip[1] - unit[1] * 7 - unit[0] * 3.8]], color, 1.7);
}
function footer(ctx, palette, left, right) {
    line(ctx, [76, 786], [1524, 786], palette.line, 1);
    text(ctx, left, 76, 826, 20, palette.muted);
    text(ctx, right, 1524, 826, 20, palette.muted, 500, 'right');
}

// Parallel streamline family. Its derivative, arrows and particle motion share
// the same analytic geometry; these prescribed paths do not claim inference.
export const flowPoint = (u, lane = 0) => [210 + 1180 * u, 450 - 92 * Math.sin((u - .18) * TAU * .85) + lane];
export const flowTangent = u => [1180, -92 * TAU * .85 * Math.cos((u - .18) * TAU * .85)];
const seeds = Array.from({ length: 216 }, (_, id) => {
    const angle = hash(id + 201) * TAU, radius = Math.sqrt(hash(id + 991)) * 143;
    return { id, seed: id + 201, source: [664 + Math.cos(angle) * radius, 447 + Math.sin(angle) * radius * .76],
        u: .17 + .43 * hash(id + 4041), lane: (hash(id + 811) - .5) * 88,
        radius: 1.5 + hash(id + 713) * 1.3, opacity: .36 + hash(id + 1901) * .58 };
});
const focusId = 2;
const flowLines = [-66, -44, -22, 0, 22, 44, 66].map((lane, id) => ({
    id, lane, points: Array.from({ length: 141 }, (_, i) => flowPoint(i / 140, lane))
}));
const field = [-44, 0, 44].flatMap((lane, row) => [.16, .32, .48, .64, .8].map((u, column) => ({
    id: row * 5 + column, u, lane, position: flowPoint(u, lane), direction: normalize(flowTangent(u))
})));

export const directedFlow = candidate({
    id: 'visualization-directed-flow', module: 'visualization', title: '先看分布，再沿方向走',
    codeFile: './modules/generative-flow.js', duration, loop: false, previewTime: 7.4,
    referenceIds: ['ai-draw'], evidence: 'illustrative',
    description: '金色点云先展开成曲线带，局部方向随后显现；同一批点沿刚才的方向前进，最后留住结果。',
    usage: '解释分布、方向场与轨迹之间的区别；接入实际生成模型时替换为保存的中间态和向量场。',
    stages: ['先看分布', '建立曲线与方向', '沿方向前进', '结果停留'], stageTimes: [0, 1.4, 5.5, 9.4],
    recipe: ['216个点保存固定seed和ID，先观察分布，再改变表示。', '流线、局部箭头与运动方向读取同一解析曲线；不把图像相似称为求解器还原。', '先让方向被看见，再让点开始运动；最后停住并保留一个局部方向作为解释锚点。']
}, (input, options) => {
    const t = clock(input), morph = between(t, 1.4, 4), travel = between(t, 5.5, 9.4), rate = derivative(t, 5.5, 9.4);
    const points = seeds.map(seed => {
        const u = seed.u + .29 * travel, target = flowPoint(u, seed.lane), tangent = flowTangent(u);
        return { ...seed, u, position: lerp2(seed.source, target, morph),
            velocity: tangent.map(value => value * .29 * rate), direction: normalize(tangent) };
    });
    const focus = points[focusId];
    return { time: t, phase: t < 1.4 ? '先看分布' : t < 5.5 ? '建立曲线与方向' : t < 9.4 ? '沿方向前进' : '结果停留',
        evidence: 'illustrative', morph, travel, reveal: between(t, 0, .75),
        streamlineAlpha: between(t, 2.5, 4.2), fieldAlpha: between(t, 4.05, 4.9),
        backgroundFieldAlpha: between(t, 4.05, 4.9) * (1 - .55 * between(t, 8.8, 9.4)),
        focusAlpha: between(t, 4.35, 5.1), points, streamlines: flowLines, arrows: field,
        focus: { id: focus.id, position: focus.position, direction: focus.direction,
            label: { position: [focus.position[0], focus.position[1] + 99], text: '局部方向 d(x)' } },
        hold: t >= 9.4, haloStrength: .10 + options.intensity * .08 };
}, (ctx, t, w, h, options, state) => {
    const p = options.theme;
    begin(ctx, w, h, { title: '点在哪里，和下一步往哪走，是两件事', subtitle: '分布 → 局部方向 → 连续轨迹', palette: p });
    text(ctx, state.phase, 112, 208, 30, p.ink, 650);
    text(ctx, state.hold ? '04 / 留住结果' : state.time < 1.4 ? '01 / 分布' : state.time < 5.5 ? '02 / 方向' : '03 / 轨迹', 1488, 208, 22, p.muted, 500, 'right');
    layer(ctx, state.reveal * state.haloStrength * (1 - .5 * state.morph), () => {
        const glow = ctx.createRadialGradient(664, 447, 5, 664, 447, 230);
        glow.addColorStop(0, p.gold); glow.addColorStop(1, p.gold + '00');
        ctx.fillStyle = glow; ctx.fillRect(400, 205, 530, 480);
    });
    layer(ctx, state.streamlineAlpha, () => {
        state.streamlines.forEach(streamline => layer(ctx, streamline.lane === 0 ? .65 : .16, () => path(ctx, streamline.points, p.gold, streamline.lane === 0 ? 2.2 : 1)));
    });
    layer(ctx, state.backgroundFieldAlpha * .8, () => state.arrows.forEach(a => arrow(ctx, a.position, a.direction, p.cyan, 28)));
    layer(ctx, state.reveal, () => state.points.forEach(point => layer(ctx, point.opacity, () => circle(ctx, ...point.position, point.radius, p.gold))));
    layer(ctx, state.focusAlpha, () => {
        const f = state.focus;
        circle(ctx, ...f.position, 10, p.bg, p.ink, 2);
        circle(ctx, ...f.position, 3.5, p.gold);
        arrow(ctx, f.position.map((v, i) => v + f.direction[i] * 32), f.direction, p.ink, 44);
        line(ctx, [f.position[0], f.position[1] + 14], [f.label.position[0], f.label.position[1] - 23], p.muted, 1);
        // Small opaque text support gives the local label a stable reading area
        // without replacing the background or adding a permanent large panel.
        roundRect(ctx, f.label.position[0] - 118, f.label.position[1] - 24, 236, 48, 10, p.bg);
        text(ctx, f.label.text, ...f.label.position, 25, p.ink, 650, 'center');
    });
    text(ctx, state.time < 4.05 ? '同一批点，慢慢显出形状' : state.time < 5.5 ? '先把方向看清楚' : state.time < 9.4 ? '点沿着已经看见的方向前进' : '分布留下位置，方向决定下一步', 800, 718, 30, p.ink, 600, 'center');
    footer(ctx, p, '固定点身份 · 流线与箭头同源', '解析方向场示意，非训练模型推理');
    end(ctx);
});

const cardX = [410, 800, 1190], cardTypes = ['ring', 'fold', 'ripple'];
const names = ['环形', '折面', '波纹'];
const relationshipPoint = u => [230 + u * 1140, 622 - 82 * Math.sin(Math.PI * u) + 19 * Math.sin(TAU * u)];
const relationship = {
    id: 'persistent-relationship',
    axis: [[200, 724], [1400, 724]],
    curve: Array.from({ length: 141 }, (_, i) => relationshipPoint(i / 140)),
    observation: { id: 'observation-0', position: [800, 688] }
};
const noise = Array.from({ length: 96 }, (_, id) => ({ id, x: hash(id + 7991), y: hash(id + 401), value: hash(id + 551) }));
const upperBounds = { x: 180, y: 250, width: 1240, height: 222 };
const wipeStart = 3.6, wipeEnd = 5.3;

function boardPalette(options) {
    const p = options.theme;
    if (options.palette === 'porcelain') return { ...p, bg: '#e8eee5', bg2: '#c9d6ca', halo: '#ffffff38', line: '#82988b' };
    if (options.palette === 'ember') return { ...p, bg: '#241e17', bg2: '#171711', halo: '#8b693521', line: '#4d4838' };
    return { ...p, bg: '#102a24', bg2: '#061b18', halo: '#46755c25', line: '#35564b', muted: '#adc2b2' };
}

function noiseTile(ctx, cx, cy, width, height, p, opacity = 1, fillBackground = true) {
    layer(ctx, opacity, () => {
        if (fillBackground) roundRect(ctx, cx - width / 2, cy - height / 2, width, height, 12, p.bg, p.muted, 1.2);
        noise.forEach(n => layer(ctx, .23 + n.value * .48, () => {
            const x = cx - width / 2 + 12 + n.x * (width - 24), y = cy - height / 2 + 12 + n.y * (height - 24);
            ctx.fillStyle = n.value > .6 ? p.gold : p.muted; ctx.fillRect(x, y, 3 + n.value * 4, 3 + n.value * 4);
        }));
    });
}
function geometryCard(ctx, type, cx, cy, p, options = {}) {
    const width = options.width ?? 224, height = options.height ?? 164;
    roundRect(ctx, cx - width / 2, cy - height / 2, width, height, 12, p.bg, p.muted, 1.2);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(width / 224, height / 164);
    if (type === 'ring') {
        for (let i = 0; i < 6; i++) {
            ctx.save(); ctx.translate(i * 1.8 - 4.5, i * 2 - 5); ctx.rotate(-.35);
            ctx.strokeStyle = i === 5 ? p.gold : p.line; ctx.lineWidth = i === 5 ? 3 : 1.5;
            ctx.beginPath(); ctx.ellipse(0, 0, 64, 38, 0, 0, TAU); ctx.stroke(); ctx.restore();
        }
        line(ctx, [-52, -30], [48, 30], p.cyan, 1.2);
    } else if (type === 'fold') {
        const vertices = [[-68, 28], [-22, -48], [17, 13], [68, -23], [48, 49]];
        path(ctx, [vertices[0], vertices[1], vertices[2]], p.gold, 2, true, p.gold + '1f');
        path(ctx, [vertices[1], vertices[3], vertices[2]], p.cyan, 2, true, p.cyan + '1b');
        path(ctx, [vertices[0], vertices[2], vertices[4]], p.gold, 2, true, p.gold + '12');
        path(ctx, [vertices[2], vertices[3], vertices[4]], p.cyan, 2, true, p.cyan + '2c');
        vertices.forEach(v => circle(ctx, ...v, 2.5, p.ink));
    } else {
        for (let i = 0; i < 5; i++) {
            const points = Array.from({ length: 70 }, (_, n) => {
                const u = n / 69; return [-79 + u * 158, (i - 2) * 13 + 18 * Math.sin(u * TAU * 1.1 + i * .32)];
            });
            layer(ctx, .5 + i * .1, () => path(ctx, points, i === 2 ? p.gold : p.cyan, i === 2 ? 3 : 1.5));
        }
    }
    ctx.restore();
}
const polylineReveal = (points, progress) => {
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + magnitude(points[i].map((v, k) => v - points[i - 1][k])));
    const target = clamp(progress) * distances.at(-1), result = [points[0]];
    for (let i = 1; i < points.length; i++) {
        if (target >= distances[i]) result.push(points[i]);
        else { result.push(lerp2(points[i - 1], points[i], (target - distances[i - 1]) / (distances[i] - distances[i - 1]))); break; }
    }
    return result;
};

export const observationFan = candidate({
    id: 'visualization-observation-fan', module: 'visualization', title: '擦掉演算，保留同一个问题',
    codeFile: './modules/generative-flow.js', duration, loop: false, previewTime: 9.4,
    referenceIds: ['ai-draw'], evidence: 'illustrative',
    description: '墨绿黑板只擦上一层演算；底部曲线和含噪观测保留，三张原创几何图卡分批接入同一个观测点。',
    usage: '解释一个观测对应多种可能来源，或从单样本推导过渡到候选集合。',
    stages: ['单个来源与观测', '只擦上一层', '来源分批进入', '一对多关系停留'], stageTimes: [0, 3.6, 5.8, 9.2],
    recipe: ['曲线、坐标与观测点在独立底层，擦除遮罩只接触上一层演算。', '三张原创图卡依次建立，再以不交叉的分支接到同一个观测点。', '全部来源到位后停止入场，留时间比较；示意关系不冒充实际扩散后验。']
}, input => {
    const t = clock(input), wipe = between(t, wipeStart, wipeEnd);
    const cards = cardX.map((x, id) => {
        const enter = 5.8 + id * .72, reveal = between(t, enter, enter + .65), connect = between(t, enter + .48, enter + 1.25);
        const u = (x - 230) / 1140, anchor = relationshipPoint(u), y = mix(371, 352, reveal);
        const vertices = [[x, y + 82], [x, anchor[1]], relationship.observation.position];
        return { id: `source-${id}`, kind: cardTypes[id], label: names[id], center: [x, y], size: [224, 164],
            alpha: reveal, connectorProgress: connect, sourceAnchor: anchor, observationId: 'observation-0',
            connector: polylineReveal(vertices, connect) };
    });
    return { time: t, evidence: 'illustrative', phase: t < 3.6 ? '一个来源，形成一个观测' : t < 5.8 ? '换解释，锚点不换' : t < 9.2 ? '不同来源，接到同一观测' : '一对多关系停留',
        upper: { alpha: between(t, .15, .9), bounds: upperBounds, wipe, wipeX: upperBounds.x + upperBounds.width * wipe,
            eraserVisible: t > wipeStart && t < wipeEnd, noiseId: 'observation-0' },
        base: relationship, noise, cards, hold: t >= 9.2,
        questionAlpha: between(t, 4.9, 5.6), lowerAlpha: between(t, 0, .65) };
}, (ctx, t, w, h, options, state) => {
    const p = boardPalette(options);
    begin(ctx, w, h, { title: '同一个观测，可能从哪里来？', subtitle: '先建立一个例子，再展开多个可能来源', palette: p });
    // Fixed grain never resamples between frames and remains subordinate to
    // the geometry. It is original board texture, not a captured reference.
    for (let i = 0; i < 90; i++) layer(ctx, .045, () => line(ctx, [90 + hash(i + 300) * 1390, 165 + hash(i + 800) * 590], [100 + hash(i + 300) * 1390, 167 + hash(i + 800) * 590], p.muted, .7));
    text(ctx, state.phase, 112, 208, 29, p.ink, 650);
    layer(ctx, state.lowerAlpha, () => {
        line(ctx, ...state.base.axis, p.line, 1.5);
        path(ctx, state.base.curve, p.gold, 2.5);
        text(ctx, '可能的来源', 230, 666, 21, p.muted, 500);
        const point = state.base.observation.position;
        circle(ctx, ...point, 13, p.bg, p.gold, 2);
        circle(ctx, ...point, 4, p.gold);
        text(ctx, '同一含噪观测 xₜ', 800, 754, 24, p.ink, 600, 'center');
    });
    // Draw-only clipping affects this prior layer. The relationship layer has
    // already been drawn outside the clip and is never cleared or repainted.
    layer(ctx, state.upper.alpha, () => {
        const bounds = state.upper.bounds, remaining = bounds.x + bounds.width - state.upper.wipeX;
        if (remaining <= 0) return;
        ctx.save(); ctx.beginPath(); ctx.rect(state.upper.wipeX, bounds.y, remaining, bounds.height); ctx.clip();
        geometryCard(ctx, 'ring', 410, 350, p, { width: 202, height: 144 });
        text(ctx, '+', 610, 350, 38, p.ink, 500, 'center');
        noiseTile(ctx, 800, 350, 170, 144, p);
        text(ctx, '→', 993, 350, 38, p.ink, 500, 'center');
        layer(ctx, .45, () => geometryCard(ctx, 'ring', 1190, 350, p, { width: 202, height: 144 }));
        noiseTile(ctx, 1190, 350, 202, 144, p, 1, false);
        text(ctx, '来源', 410, 455, 22, p.ink, 600, 'center');
        text(ctx, '扰动', 800, 455, 22, p.ink, 600, 'center');
        text(ctx, '含噪观测', 1190, 455, 22, p.ink, 600, 'center');
        ctx.restore();
    });
    if (state.upper.eraserVisible) {
        const x = state.upper.wipeX;
        ctx.save(); ctx.beginPath(); ctx.rect(155, 239, 1290, 248); ctx.clip();
        roundRect(ctx, x - 21, 251, 42, 217, 8, p.line, p.muted, 1);
        line(ctx, [x + 12, 260], [x + 12, 460], p.gold, 2);
        ctx.restore();
    }
    state.cards.forEach((card, i) => {
        layer(ctx, card.alpha, () => {
            geometryCard(ctx, card.kind, ...card.center, p);
            text(ctx, `${String.fromCharCode(65 + i)} · ${card.label}`, card.center[0], card.center[1] - 108, 23, p.ink, 600, 'center');
        });
        layer(ctx, card.connectorProgress * .78, () => {
            path(ctx, card.connector, p.gold, 1.8);
            circle(ctx, ...card.sourceAnchor, 5, p.bg, p.gold, 1.5);
        });
    });
    layer(ctx, state.lowerAlpha, () => {
        circle(ctx, ...state.base.observation.position, 13, p.bg, p.gold, 2);
        circle(ctx, ...state.base.observation.position, 4, p.gold);
    });
    footer(ctx, p, state.hold ? '来源可以不同，观察到的状态却可能相近' : '保留曲线与观测点，只更新当前解释', '一对多关系示意，非实际扩散后验');
    end(ctx);
});

export const candidates = [directedFlow, observationFan];
