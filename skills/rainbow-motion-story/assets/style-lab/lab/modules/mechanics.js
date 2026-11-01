import { C, TAU, phase, clamp, mix, smooth, window, begin, end, text, line, path, circle, pill, roundRect, glow, arrow, timeline, gear, metal, candidate } from './common.js';
function ringPart(ctx, x, y, r, color, depth = 22) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(.66, 1);
    circle(ctx, depth, 0, r, '#142530', color + '80', 2);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#b4c6ce');
    g.addColorStop(.3, '#395260');
    g.addColorStop(.75, '#718f9d');
    g.addColorStop(1, '#d7e4e6');
    circle(ctx, 0, 0, r, g, color, 2);
    circle(ctx, 0, 0, r * .56, '#10212c', color + '99', 2);
    for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        circle(ctx, Math.cos(a) * r * .77, Math.sin(a) * r * .77, 4, '#182b35', color, 1);
    }
    ctx.restore();
}
const exploded = candidate({
    id: 'mechanics-axial-exploded', module: 'mechanics', title: '顺着装配轴拆开',
    description: '外壳、轴承与端盖沿固定装配轴逐件展开，中心转子保留定位；每件到位后才标注，内件先归位、外件再闭合。',
    referenceIds: ['rotary-cutaway', 'car-ignition'],
    usage: '适合电机、轴承、镜头、阀门等轴向装配件。',
    recipe: ['整机、零件静止位置和实心轴共用一个固定装配轴。', '外件先让路，内件随后沿同轴拆开；每件使用独立延迟。', '到位后才标注；回装由内到外，中心转子作为定位锚点。'],
    stages: ['整机定位', '由外到内拆开', '接口停留', '由内到外回装']
}, (t, o) => {
    const time = phase(t) * 10;
    const origin = [800, 450];
    const axisAngle = -0.12;
    const axis = [Math.cos(axisAngle), Math.sin(axisAngle)];
    const restDistances = [-90, -45, 0, 45, 90];
    const travelDistances = [-340, -170, 0, 170, 340];
    const leaveTimes = [0.85, 1.65, 2.45, 2.0, 1.2];
    const returnTimes = [7.8, 7.15, 7.0, 7.4, 8.05];
    const travelSeconds = 1.15;
    const parts = restDistances.map((restDistance, id) => {
        const outward = smooth((time - leaveTimes[id]) / travelSeconds);
        const inward = smooth((time - returnTimes[id]) / travelSeconds);
        const progress = outward * (1 - inward);
        const travel = travelDistances[id] * progress;
        const restPose = origin.map((v, k) => v + axis[k] * restDistance);
        const position = restPose.map((v, k) => v + axis[k] * travel);
        const labelAlpha = id === 2
            ? window(time, 3.0, 7.0, 0.45, 0.45)
            : smooth((progress - 0.93) / 0.07);
        return {
            id, restPose, restDistance, travel, progress, labelAlpha,
            leaveTime: leaveTimes[id], returnTime: returnTimes[id],
            x: position[0], y: position[1], r: [116, 93, 104, 93, 116][id]
        };
    });
    return {
        time, origin, axis, axisAngle, parts,
        shaftStart: origin.map((v, k) => v - axis[k] * 520),
        shaftEnd: origin.map((v, k) => v + axis[k] * 520),
        expand: Math.max(...parts.map(v => v.progress)),
        visible: window(time, 0, 10, 0.3, 0.4)
    };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, {
        title: '先认出整体，再看每个接口',
        subtitle: '固定装配轴 · 外件先让路，内件随后展开 · 教学结构', palette: p
    });
    ctx.save();
    ctx.globalAlpha = s.visible;
    line(ctx, s.shaftStart, s.shaftEnd, p.cyan + '66', 2, [12, 12]);
    ctx.save();
    ctx.translate(...s.origin);
    ctx.rotate(s.axisAngle);
    metal(ctx, -500, -7, 1000, 14, { color: '#526b78', radius: 7 });
    ctx.restore();
    s.parts.forEach((part, id) => {
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(s.axisAngle);
        if (id === 2) {
            ctx.scale(0.66, 1);
            gear(ctx, 0, 0, part.r, 24, s.time * 0.4, p.gold);
        }
        else {
            ringPart(ctx, 0, 0, part.r, id === 0 || id === 4 ? p.muted : p.cyan);
        }
        ctx.restore();
        if (part.labelAlpha > 0) {
            ctx.save();
            ctx.globalAlpha *= part.labelAlpha;
            const labelY = id % 2 === 0 ? 650 : 245;
            const edgeY = part.y + (labelY > part.y ? part.r : -part.r);
            line(ctx, [part.x, edgeY], [part.x, labelY + (labelY > part.y ? -28 : 28)], p.muted, 1.5);
            text(ctx, ['端盖', '轴承', '定位转子', '轴承', '外壳'][id], part.x, labelY, 27, id === 2 ? p.gold : p.ink, 600, 'center');
            ctx.restore();
        }
    });
    ctx.restore();
    timeline(ctx, s.time / 10, { labels: ['认出整体', '逐件拆开', '接口停留', '原轴回装'] });
    end(ctx);
});
const cut = candidate({ id: 'mechanics-section-cut', module: 'mechanics', title: '剖开外壳，内部继续转', description: '用扇形剖切逐渐露出内部传动，截断处有实体厚度，保留外轮廓帮助定位。', referenceIds: ['rotary-cutaway', 'mofs'], usage: '适合腔体、转子、流道和内部结构解释。', recipe: ['先显示完整壳体，剖切前不让内部发光穿透。', '剖切角度连续变化，保留切边与壁厚。', '内部运动与壳体剖切独立，不因切开而重置相位。'], stages: ['外壳', '剖切展开', '内部运转', '闭合'] }, (t, o) => { const s = phase(t) * 10, q = window(s, .9, 9.2, 2, 1.8); return { time: s, cutAngle: q * 1.55 * Math.PI, rotorAngle: phase(t) * TAU * 2, open: q }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '外壳切开，运动的因果还在', subtitle: '保留壁厚与边界，避免透明物体混成一团', palette: p });
    const x = 800, y = 455, R = 235;
    glow(ctx, x, y, 340, p.gold);
    circle(ctx, x, y, R, '#14232e', p.muted, 3);
    gear(ctx, x - 70, y, 77, 18, s.rotorAngle, p.gold);
    gear(ctx, x + 87, y, 77, 18, -s.rotorAngle + Math.PI / 18, p.cyan);
    circle(ctx, x, y, 194, null, p.line, 12);
    const start = -Math.PI / 2, cutEnd = start + s.cutAngle;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, start + Math.max(.001, s.cutAngle), start + TAU);
    ctx.lineTo(x, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    g.addColorStop(0, '#b0c2cb');
    g.addColorStop(.45, '#3c5664');
    g.addColorStop(.8, '#708d9b');
    g.addColorStop(1, '#b8c9cd');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = p.muted;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    if (s.open > .01) {
        for (const a of [start, cutEnd]) {
            line(ctx, [x + 197 * Math.cos(a), y + 197 * Math.sin(a)], [x + R * Math.cos(a), y + R * Math.sin(a)], p.gold, 8);
        }
        pill(ctx, '切面保留实体壁厚', 1135, 210, { color: p.gold });
        line(ctx, [1120, 246], [x + R * Math.cos(cutEnd), y + R * Math.sin(cutEnd)], p.gold + '80', 1.5);
    }
    text(ctx, '壳体', 450, 440, 26, p.muted, 600, 'center');
    text(ctx, '传动腔', 1150, 490, 26, p.cyan, 600, 'center');
    timeline(ctx, s.time / 10, { labels: ['完整形体', '切开', '看见内部', '返回整体'] });
    end(ctx);
});
const planetary = candidate({ id: 'mechanics-linked-gears', module: 'mechanics', title: '齿轮联动，比例算出来', description: '固定内齿圈，太阳轮12齿、行星轮12齿、内齿圈36齿；行星架角速度严格为太阳轮的四分之一。', referenceIds: ['rotary-cutaway', 'car-ignition'], usage: '适合解释减速比和同一机构中的多种运动。', recipe: ['固定内齿圈，显示每个轮的齿数。', '由 Willis 关系计算行星架速度，不用独立装饰旋转。', '齿廓为几何示意，角速度关系才是验收对象。'], stages: ['辨认轮系', '观察自转', '观察公转', '比较转速'] }, (t, o) => { const sun = phase(t) * TAU * 4, carrier = sun / 4, planet = -sun / 2; return { time: phase(t) * 10, sunAngle: sun, carrierAngle: carrier, planetAngle: planet, ringAngle: 0, teeth: { sun: 12, planet: 12, ring: 36 }, ratio: 4, planets: Array.from({ length: 3 }, (_, i) => ({ angle: carrier + i * TAU / 3, x: 96 * Math.cos(carrier + i * TAU / 3), y: 96 * Math.sin(carrier + i * TAU / 3) })) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '不是各转各的，而是一条约束', subtitle: '固定内齿圈 · 12 / 12 / 36 齿 · 速度比精确、齿廓示意', palette: p });
    ctx.save();
    ctx.translate(620, 455);
    ctx.scale(1.75, 1.75);
    gear(ctx, 0, 0, 148, 36, 0, p.muted, { internal: true });
    s.planets.forEach(v => line(ctx, [0, 0], [v.x, v.y], p.coral + 'bb', 11));
    s.planets.forEach(v => gear(ctx, v.x, v.y, 44, 12, s.planetAngle, p.cyan));
    gear(ctx, 0, 0, 44, 12, s.sunAngle, p.gold);
    circle(ctx, 0, 0, 10, p.coral);
    ctx.restore();
    const tx = 1040;
    line(ctx, [tx, 310], [tx + 310, 310], p.line, 2);
    text(ctx, '太阳轮', tx, 265, 26, p.gold, 600);
    text(ctx, '4 圈', tx + 290, 265, 34, p.gold, 700, 'right');
    text(ctx, '行星架', tx, 385, 26, p.coral, 600);
    text(ctx, '1 圈', tx + 290, 385, 34, p.coral, 700, 'right');
    text(ctx, 'ω架 = ω太阳 / 4', tx, 505, 32, p.ink, 600);
    text(ctx, 'ω行星 = −ω太阳 / 2', tx, 561, 25, p.cyan, 500);
    text(ctx, '每个转角来自同一太阳轮角度', tx, 640, 22, p.muted);
    end(ctx);
});
const linkage = candidate({ id: 'mechanics-slider-crank', module: 'mechanics', title: '曲柄、连杆与滑块', description: '按闭式几何解算滑块位置；曲柄旋转，连杆保持定长，滑块沿导轨运动。', referenceIds: ['rotary-cutaway', 'car-ignition'], usage: '适合机械运动学、能量转换与相位解释。', recipe: ['给出固定轴和滑块导轨。', '用 x=r cosθ+√(l²−r² sin²θ) 求位置。', '同一角度驱动转盘、连杆、滑块和位移曲线。'], stages: ['固定轴', '连续转动', '直线位移', '相位对照'] }, (t, o) => { const a = phase(t) * TAU, r = 130, l = 330, pin = [r * Math.cos(a), r * Math.sin(a)], slider = r * Math.cos(a) + Math.sqrt(l * l - r * r * Math.sin(a) ** 2); return { time: phase(t) * 10, angle: a, crankRadius: r, rodLength: l, pin, slider, measuredLength: Math.hypot(slider - pin[0], pin[1]) }; }, (ctx, t, w, h, o, s) => { const p = o.theme; begin(ctx, w, h, { title: '圆周运动，怎样变成往复运动？', subtitle: '连杆长度始终不变 · 几何约束求解', palette: p }); const x = 440, y = 460; circle(ctx, x, y, 150, '#1b303b', p.line, 3); circle(ctx, x, y, 125, null, p.gold + '55', 2); line(ctx, [570, y + 72], [1320, y + 72], p.line, 14); line(ctx, [570, y - 72], [1320, y - 72], p.line, 14); const pin = [x + s.pin[0], y + s.pin[1]], slider = [x + s.slider, y]; line(ctx, [x, y], pin, p.gold, 20); line(ctx, pin, slider, p.cyan, 25); circle(ctx, ...pin, 22, '#17303c', p.gold, 4); roundRect(ctx, slider[0] - 50, y - 52, 100, 104, 13, '#4c6876', p.cyan); circle(ctx, ...slider, 17, '#18333e', p.cyan, 3); circle(ctx, x, y, 24, p.gold); text(ctx, '固定转轴', x, 680, 26, p.gold, 600, 'center'); text(ctx, `连杆 ${s.measuredLength.toFixed(0)} · 定长`, 920, 680, 26, p.cyan, 600, 'center'); text(ctx, 'x = r cosθ + √(l² − r² sin²θ)', 800, 235, 34, p.ink, 600, 'center'); end(ctx); });
export const candidates = [exploded, cut, planetary, linkage];
