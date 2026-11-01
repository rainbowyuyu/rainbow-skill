/** Original text / diagram choreography. Fixed identities, no layout-state dependence. */
import { candidate, clamp, smooth, mix, bezier, begin, end, text, line, path, circle, roundRect, glow, TAU } from './common.js';
const duration = 12;
const time = t => clamp(Number.isFinite(t) ? t : 0, 0, duration);
const at = (t, a, b) => clamp(smooth((t - a) / (b - a)));
const bump = (t, a, b) => { const q = clamp((t - a) / (b - a)); return 16 * q * q * (1 - q) * (1 - q); };
const alpha = (ctx, value, fn) => { ctx.save(); ctx.globalAlpha *= clamp(value); fn(); ctx.restore(); };

export function contrastRatio(a, b) {
    const luminance = c => {
        const n = parseInt(c.slice(1, 7), 16), channels = [16, 8, 0].map(k => ((n >> k) & 255) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const readable = (color, p, minimum = 4.5) => Math.min(contrastRatio(color, p.bg), contrastRatio(color, p.bg2 || '#080f18')) >= minimum ? color : p.ink;
const blend = (a, b, q) => {
    const x = parseInt(a.slice(1, 7), 16), y = parseInt(b.slice(1, 7), 16);
    return '#' + [16, 8, 0].map(k => Math.round(mix((x >> k) & 255, (y >> k) & 255, clamp(q))).toString(16).padStart(2, '0')).join('');
};
function token(ctx, value, x, y, size, color, weight = 750, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); text(ctx, value, 0, 0, size, color, weight, 'center'); ctx.restore();
}
function sphere(ctx, x, y, r, color, p) {
    const fill = ctx.createRadialGradient(x - r * .36, y - r * .4, r * .03, x + r * .3, y + r * .36, r * 1.4);
    fill.addColorStop(0, '#f4f1e7'); fill.addColorStop(.18, color); fill.addColorStop(.62, p.bg); fill.addColorStop(1, color);
    circle(ctx, x, y, r, fill, color, 1.8);
    ctx.save(); ctx.globalAlpha *= .4; circle(ctx, x - r * .3, y - r * .36, r * .08, '#ffffff'); ctx.restore();
}
function footer(ctx, p, left, right = '') { line(ctx, [76, 781], [1524, 781], p.line, 1); text(ctx, left, 76, 824, 21, p.muted); if (right) text(ctx, right, 1524, 824, 21, p.muted, 500, 'right'); }

export const semanticEmphasis = candidate({
    id: 'type-semantic-emphasis', module: 'look', title: '词有轻重，阅读有停留', duration, loop: false,
    codeFile: './modules/type-life.js', referenceIds: ['mofs', 'aesthetic', 'shuffle'],
    description: '强调的是句子里的含义：变化发生时强调“变化”，物体停住后再把注意力交给“结果”。字位固定，重点只做一次短促起伏。',
    usage: '适合章节主句、定义和重点提示；用于少量关键词，不给整段字幕逐字弹跳。',
    stages: ['建立一句话', '变化与强调', '停住读结果', '交给下一句'], stageTimes: [0, 1.3, 3.5, 8.5], previewTime: 5.8,
    recipe: ['词语 ID 与阅读基线固定，语义变化不触发布局重排。', '重点放大不超过 8%，只在发生变化的短窗口使用。', '3.5–8.5 秒物体与文字均保持稳定，真正留出阅读停留。', '非循环；复用时以实际句窗决定强调时间，而不是每个字头都卡拍。']
}, (t, o) => {
    t = time(t); const move = at(t, 1.3, 3.3), second = at(t, 2.9, 3.5), handoff = at(t, 8.5, 10.6);
    return { time: t, move, readingHold: t >= 3.5 && t <= 8.5, handoff,
        tokens: [
            { id: 'first', text: '先', x: 190, y: 330, alpha: 1, scale: 1 }, { id: 'see', text: '看见', x: 340, y: 330, alpha: 1, scale: 1 },
            { id: 'change', text: '变化', x: 545, y: 330, alpha: 1, scale: 1 + (.035 + .035 * o.intensity) * bump(t, 1.3, 3.3), active: 1 - second },
            { id: 'then', text: '再', x: 190, y: 500, alpha: second, scale: 1 }, { id: 'understand', text: '看清', x: 340, y: 500, alpha: second, scale: 1 },
            { id: 'result', text: '结果', x: 545, y: 500, alpha: second, scale: 1 + (.025 + .025 * o.intensity) * bump(t, 2.9, 3.5), active: second * (1 - handoff) }
        ],
        object: { x: mix(950, 1190, move), y: 425, radius: mix(66, 112, move), angle: mix(-.65, .12, move) },
        rule: { x: 76, y: 622, width: mix(160, 555, second), alpha: 1 - handoff * .55 }, nextAlpha: handoff };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '一句话也有起伏，停住之后才读得进去', subtitle: '语义重音 / 固定基线 / 真正的阅读窗口', palette: p });
    s.tokens.forEach(v => alpha(ctx, v.alpha, () => token(ctx, v.text, v.x, v.y, 76, blend(p.ink, readable(p.gold, p, 3), v.active ?? 0), 750, v.scale)));
    alpha(ctx, s.rule.alpha, () => line(ctx, [s.rule.x + 75, s.rule.y], [s.rule.x + 75 + s.rule.width, s.rule.y], p.gold, 3));
    // Track and object give the words a visible cause, rather than unrelated kinetic type.
    line(ctx, [840, 585], [1410, 585], p.line, 2);
    [950, 1190].forEach(x => line(ctx, [x, 578], [x, 592], p.muted, 2));
    ctx.save(); ctx.globalAlpha = .15; ctx.scale(1, .16); circle(ctx, s.object.x, 585 / .16, s.object.radius * 1.15, p.cyan); ctx.restore();
    sphere(ctx, s.object.x, s.object.y, s.object.radius, p.cyan, p);
    ctx.save(); ctx.translate(s.object.x, s.object.y); ctx.rotate(s.object.angle);
    ctx.strokeStyle = p.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, s.object.radius * 1.13, s.object.radius * .26, -.32, 0, TAU); ctx.stroke(); ctx.restore();
    text(ctx, s.time < 3.5 ? '变化先发生' : s.time <= 8.5 ? '结果留下来' : '接住下一句话', 1140, 676, 25, p.ink, 600, 'center');
    alpha(ctx, s.nextAlpha, () => text(ctx, '然后，解释为什么。', 155, 686, 30, p.ink, 600));
    footer(ctx, p, '强调词不挤开邻字，读结果时停止所有大运动', s.readingHold ? '阅读停留' : '同一个对象，同一条句子');
    end(ctx);
});

const response = u => 1 - Math.exp(-3.8 * u);
const pointAt = u => [250 + 990 * u, 650 - 360 * response(u)];
export const anchoredLabel = candidate({
    id: 'type-anchored-label', module: 'visualization', title: '短标注跟着对象，重点分段交接', duration, loop: false,
    codeFile: './modules/type-life.js', referenceIds: ['transmission', 'car-ignition', 'mofs'],
    description: '读数标注贴着同一测量点移动，在靠近目标前先移到下方；结果阶段收起游标读数，交给紧邻的误差量。',
    usage: '适合测量、响应曲线、传感器和运动轨迹；一段只保留一个主动标注。',
    stages: ['找到测量点', '跟随读数', '让出目标区', '看清剩余误差'], stageTimes: [0, 1.1, 4, 8.2], previewTime: 6.6,
    recipe: ['标注和实体读同一位置，不使用追逐式弹簧造成落后。', '在目标区到来前完成上下换位，连接线始终短且只有一条。', '最后将焦点由瞬时读数移交给误差，旧标签先退场。', '曲线为一阶响应教学示例，数值来自同一个解析函数。']
}, (t, o) => {
    t = time(t); const travel = at(t, 1.15, 8.1), value = response(travel), point = pointAt(travel), side = at(t, 4, 6), residual = at(t, 8.2, 8.8);
    const labelY = point[1] - 82 * Math.cos(Math.PI * side), labelX = clamp(point[0] + (145 + o.intensity * 16) * Math.sin(Math.PI * side), 340, 1255), opacity = at(t, .7, 1.1) * (1 - residual);
    const dx = labelX - point[0], dy = labelY - point[1], length = Math.hypot(dx, dy), edge = Math.min(109 / Math.max(1e-9, Math.abs(dx)), 27 / Math.max(1e-9, Math.abs(dy)));
    return { time: t, travel, value, target: 1, error: 1 - value, point, residual, label: { id: 'measured-value', center: [labelX, labelY], width: 218, height: 54, opacity, side },
        leader: { a: [point[0] + dx / length * 12, point[1] + dy / length * 12], b: [labelX - dx * edge, labelY - dy * edge], opacity },
        errorLabel: { id: 'remaining-error', center: [1240, 430], opacity: residual }, hold: t >= 8.8,
        points: Array.from({ length: 121 }, (_, i) => pointAt(i / 120 * travel)) };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '读数贴近它属于的那个点', subtitle: '一个移动对象 / 一条短引线 / 分阶段说清一个量', palette: p });
    for (let value = 0; value <= 1; value += .25) { const y = 650 - 360 * value; line(ctx, [230, y], [1400, y], p.line, 1); text(ctx, value.toFixed(2), 198, y, 19, p.muted, 500, 'right'); }
    line(ctx, [230, 650], [1400, 650], p.muted, 1.5);
    const full = Array.from({ length: 121 }, (_, i) => pointAt(i / 120)); path(ctx, full, p.cyan + '26', 2.5);
    path(ctx, [...s.points, [s.point[0], 650], [250, 650]], p.cyan + '00', 0, true, p.cyan + '0d');
    path(ctx, s.points, p.cyan, 4.5);
    line(ctx, [250, 290], [1400, 290], p.gold, 1.6, [6, 9]);
    text(ctx, '目标 1.00', 1400, 254, 23, readable(p.gold, p), 600, 'right');
    glow(ctx, ...s.point, 34, p.cyan); circle(ctx, ...s.point, 9, p.bg, p.cyan, 3); circle(ctx, ...s.point, 3, p.ink);
    alpha(ctx, s.label.opacity, () => {
        line(ctx, s.leader.a, s.leader.b, p.cyan, 1.8);
        roundRect(ctx, s.label.center[0] - s.label.width / 2, s.label.center[1] - 27, s.label.width, 54, 13, p.bg, p.cyan + '88');
        text(ctx, `当前 ${s.value.toFixed(3)}`, ...s.label.center, 25, p.ink, 600, 'center');
    });
    alpha(ctx, s.errorLabel.opacity, () => {
        // Magnifying the residual is explicit: full error bracket is drawn at actual scale.
        line(ctx, [1280, 290], [1280, s.point[1]], p.coral, 3);
        line(ctx, [1271, 290], [1289, 290], p.coral, 2); line(ctx, [1271, s.point[1]], [1289, s.point[1]], p.coral, 2);
        line(ctx, [1280, s.point[1] + 15], [1280, 389], p.coral, 1.5);
        text(ctx, `还差 ${s.error.toFixed(3)}`, ...s.errorLabel.center, 27, readable(p.coral, p), 700, 'center');
    });
    text(ctx, '起点', 250, 691, 20, p.muted, 500, 'center'); text(ctx, '同一条测量轨迹', 1240, 691, 20, p.muted, 500, 'center');
    footer(ctx, p, '一阶响应示例：y = 1 − exp(−3.8u)', s.hold ? '停在结果，交代差多少' : '标签与测量点共用状态');
    end(ctx);
});

export const equationIdentity = candidate({
    id: 'type-equation-identity', module: 'visualization', title: '移项时，仍然认得每一个量', duration, loop: false,
    codeFile: './modules/type-life.js', referenceIds: ['ai-draw', 'mofs', 'transmission'],
    description: 'V、I、R 保持各自字形与颜色，从乘法式连续迁移到分式；随后改变电压，数值和同一电路同时更新。',
    usage: '适合少量代数变换与量之间的关系；动画不是代替证明，而是帮助追踪符号身份。',
    stages: ['建立原式', '符号连续迁移', '读新关系', '同源数值验证'], stageTimes: [0, 1.6, 5.2, 7.5], previewTime: 6.2,
    recipe: ['同一符号只有一个实例；沿独立弧线换位，避免交叉穿字。', '乘号退场后分数线进入；变化期间明确是关系重排，不把过渡帧当新等式。', '电压、电流、电阻的颜色与 ID 在公式和电路间相同。', '采用理想欧姆元件，V = IR 与 I = V/R 的数值完全一致。']
}, (t, o) => {
    t = time(t); const move = at(t, 1.6, 5.2), change = at(t, 7.5, 10), voltage = mix(12, 18 + o.intensity * 6, change), resistance = 6, current = voltage / resistance;
    return { time: t, rearrange: move, transforming: t > 1.6 && t < 5.2, voltage, resistance, current,
        tokens: [
            { id: 'V', position: bezier([520, 425], [925, 365], move, -180), role: 'gold' },
            { id: 'I', position: bezier([800, 425], [520, 425], move, -160), role: 'cyan' },
            { id: 'R', position: bezier([1060, 425], [925, 485], move, -28), role: 'coral' }
        ], equal: [650, 425], multiplyOpacity: 1 - at(t, 1.6, 2.3), fractionOpacity: at(t, 3.6, 5.2), fractionWidth: 192 * at(t, 3.2, 5.2),
        valuesVisible: at(t, 5.4, 6.3), currentParticles: Array.from({ length: 6 }, (_, i) => ({ id: i, x: 570 + i * 87, y: 625 })) };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '位置变了，还是刚才那三个量', subtitle: '同一符号连续迁移 · 理想欧姆元件 V = IR', palette: p });
    text(ctx, s.transforming ? '关系重排中' : s.time <= 1.6 ? '电压 = 电流 × 电阻' : '电流 = 电压 / 电阻', 800, 230, 26, p.ink, 600, 'center');
    s.tokens.forEach(v => token(ctx, v.id, ...v.position, 86, readable(p[v.role], p, 3), 700));
    token(ctx, '=', ...s.equal, 70, p.ink, 500);
    alpha(ctx, s.multiplyOpacity, () => token(ctx, '×', 930, 425, 59, p.ink, 500));
    alpha(ctx, s.fractionOpacity, () => line(ctx, [925 - s.fractionWidth / 2, 425], [925 + s.fractionWidth / 2, 425], p.ink, 3));
    // A circuit on its own baseline; labels share exact values and semantic color roles.
    path(ctx, [[395, 636], [395, 625], [1205, 625], [1205, 741], [395, 741], [395, 700]], p.line, 3);
    line(ctx, [368, 657], [422, 657], p.gold, 4); line(ctx, [380, 682], [410, 682], p.gold, 4);
    line(ctx, [395, 636], [395, 657], p.line, 3); line(ctx, [395, 682], [395, 700], p.line, 3);
    const res = Array.from({ length: 11 }, (_, i) => [1085 + i * 11, 625 + (i === 0 || i === 10 ? 0 : (i % 2 ? -12 : 12))]);
    line(ctx, [1080, 625], [1200, 625], p.bg, 6); path(ctx, res, p.coral, 3);
    s.currentParticles.forEach(v => { circle(ctx, v.x, v.y, 4, p.cyan); line(ctx, [v.x - 14, v.y], [v.x - 5, v.y], p.cyan, 2); });
    text(ctx, 'V', 315, 670, 31, readable(p.gold, p), 650, 'center'); text(ctx, 'I', 815, 590, 31, readable(p.cyan, p), 650, 'center'); text(ctx, 'R', 1140, 579, 31, readable(p.coral, p), 650, 'center');
    alpha(ctx, s.valuesVisible, () => {
        text(ctx, `${s.voltage.toFixed(1)} V`, 395, 805, 27, p.ink, 650, 'center'); text(ctx, `${s.current.toFixed(2)} A`, 800, 805, 27, p.ink, 650, 'center'); text(ctx, `${s.resistance.toFixed(1)} Ω`, 1205, 805, 27, p.ink, 650, 'center');
    });
    text(ctx, '电压', 395, 854, 19, p.muted, 500, 'center'); text(ctx, '电流', 800, 854, 19, p.muted, 500, 'center'); text(ctx, '电阻', 1205, 854, 19, p.muted, 500, 'center');
    end(ctx);
});

export const paletteAttention = candidate({
    id: 'type-palette-attention', module: 'look', title: '颜色负责含义，明暗负责注意力', duration, loop: false,
    codeFile: './modules/type-life.js', referenceIds: ['aesthetic', 'car-ignition', 'mofs'],
    description: '目标、当前状态和误差拥有固定色彩身份。演示只交接强调层级，不让含义跟着章节随意变色。',
    usage: '适合建立整片的配色语法；同时提供深色、暖色和浅色方案，小文字自动选择足够对比的字色。',
    stages: ['先找目标', '跟着状态', '看差多少', '三者合读'], stageTimes: [0, 2.6, 6.6, 9.2], previewTime: 7.6,
    recipe: ['三个颜色角色保持恒定，非选中元素仍保有可辨轮廓。', '注意力只交给一个量；重点切换用连续权重，不全屏闪色。', '小字对比不足时保留语义色点，以正文色保证阅读。', '误差始终等于同一坐标中的目标减去当前值。']
}, (t, o) => {
    t = time(t); const p = o.theme, a = at(t, 2.6, 3.4), b = at(t, 6.6, 7.4), c = at(t, 9.2, 10), travel = at(t, 3.2, 6.5), current = (.72 + o.intensity * .1) * travel;
    const weights = [1 - a, a * (1 - b), b * (1 - c)], all = c;
    const roles = ['target', 'current', 'error'].map((id, i) => { const color = [p.gold, p.cyan, p.coral][i]; return { id, color, textColor: readable(color, p), attention: weights[i] + all * .65, label: ['目标', '当前', '误差'][i] }; });
    return { time: t, current, target: 1, error: 1 - current, point: [500 + 700 * current, 432], targetPoint: [1200, 432], roles, all, travel, hold: t >= 10,
        bracket: { from: [500 + 700 * current, 570], to: [1200, 570] } };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '同一种颜色，始终说同一件事', subtitle: '颜色锁定含义，亮度和线重接力注意力', palette: p });
    s.roles.forEach((r, i) => {
        const y = 300 + 112 * i;
        circle(ctx, 115, y, 6 + r.attention * 3, r.color);
        text(ctx, r.label, 146, y, 38, r.textColor, 650);
        line(ctx, [146, y + 37], [146 + 136 * r.attention, y + 37], r.color, 2.5);
    });
    line(ctx, [440, 493], [1340, 493], p.line, 2);
    for (let i = 0; i <= 5; i++) { const x = 500 + i * 140; line(ctx, [x, 487], [x, 501], p.muted, 1.5); text(ctx, (i / 5).toFixed(1), x, 530, 18, p.muted, 500, 'center'); }
    const [targetRole, currentRole, errorRole] = s.roles;
    alpha(ctx, .45 + targetRole.attention * .55, () => {
        circle(ctx, ...s.targetPoint, 60, null, p.gold, 2 + targetRole.attention * 2);
        circle(ctx, ...s.targetPoint, 45, null, p.gold + '66', 1);
        path(ctx, [[1200, 402], [1226, 432], [1200, 462], [1174, 432]], p.gold, 2, true, p.gold + '19');
        line(ctx, [1200, 493], [1200, 680], p.gold, 1.2, [3, 8]);
    });
    alpha(ctx, .55 + currentRole.attention * .45, () => {
        sphere(ctx, ...s.point, 40, p.cyan, p);
        line(ctx, [s.point[0], 476], [s.point[0], 493], p.cyan, 2);
    });
    alpha(ctx, .35 + errorRole.attention * .65, () => {
        line(ctx, s.bracket.from, s.bracket.to, p.coral, 2 + errorRole.attention * 2);
        [s.bracket.from, s.bracket.to].forEach(([x, y]) => line(ctx, [x, y - 9], [x, y + 9], p.coral, 2));
        text(ctx, `误差 ${s.error.toFixed(3)}`, (s.bracket.from[0] + 1200) / 2, 620, 27, errorRole.textColor, 650, 'center');
    });
    text(ctx, `当前 ${s.current.toFixed(3)}`, s.point[0], 350, 25, currentRole.textColor, 600, 'center');
    text(ctx, '目标 1.000', 1200, 300, 25, targetRole.textColor, 600, 'center');
    footer(ctx, p, '目标 − 当前 = 误差', s.hold ? '三个角色合读，颜色不换含义' : '焦点交接，其他信息仍然可辨');
    end(ctx);
});

export const candidates = [semanticEmphasis, anchoredLabel, equationIdentity, paletteAttention];
