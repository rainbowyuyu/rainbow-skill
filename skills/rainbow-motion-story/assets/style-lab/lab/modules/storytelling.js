import { C, TAU, phase, clamp, mix, smooth, window, bezier, begin, end, text, line, path, circle, pill, roundRect, glow, arrow, timeline, tray, gear, candidate } from './common.js';
function signal(ctx, x, y, w, h, state, color = C.gold) { line(ctx, [x, y], [x + w, y], C.line, 2); const pts = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return [x + w * u, y - h * Math.exp(-2.9 * u) * Math.sin(17 * u) * state]; }); path(ctx, pts, color, 3); }
const rewind = candidate({ id: 'story-failure-rewind', module: 'storytelling', title: '先失败，再倒回原因', description: '同一滑块先振荡，镜头中的因果时间倒回；增加阻尼后重试，最后明确停在稳住的结果。', referenceIds: ['car-ignition', 'shuffle'], usage: '适合先展示失败，再沿同一因果时间线解释改进。', stages: ['看见失败', '倒回原因', '改条件重试', '结果停留'], duration: 12, recipe: ['0–2.6秒建立失败，保持滑块身份。', '2.6–4秒只倒回实验时间，屏幕时间仍向前。', '4–9秒添加反馈并重放，9–11秒停住结果。', '倒放是叙事手法，不冒充倒置的物理规律。'] }, (t, o) => {
    const s = phase(t, 12) * 12;
    let experiment, stage;
    if (s < 2.6) {
        experiment = s;
        stage = 'failure';
    }
    else if (s < 4) {
        experiment = 2.6 * (1 - smooth((s - 2.6) / 1.4));
        stage = 'rewind';
    }
    else if (s < 9) {
        experiment = (s - 4) * .52;
        stage = 'retry';
    }
    else {
        experiment = 2.6;
        stage = 'result';
    }
    const feedback = s >= 4, angle = (feedback ? .08 : .35) * Math.sin(experiment * 5.6) * Math.exp(-experiment * (feedback ? 1.5 : .35));
    const visible = window(s, 0, 12, .4, .7);
    return { time: s, experiment, stage, feedback, angle, visible, settled: s > 9 };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '同一次撞击，为什么不再来回晃？', subtitle: '先给结果，再追问哪个环节改变了它', palette: p });
    ctx.save();
    ctx.globalAlpha = s.visible;
    const x = 800 + s.angle * 450;
    glow(ctx, x, 410, 260, p.cyan);
    line(ctx, [440, 500], [1110, 500], p.line, 15);
    roundRect(ctx, x - 65, 380, 130, 120, 14, '#506d7c', p.gold);
    circle(ctx, x, 439, 26, p.gold);
    line(ctx, [800, 325], [800, 530], p.cyan, 2, [7, 9]);
    text(ctx, '平衡位置', 800, 565, 22, p.cyan, 600, 'center');
    const label = { failure: '第一遍：撞击 → 弹回 → 振荡', rewind: '回到刚才，看看发生了什么', retry: '第二遍：同样撞击，增加阻尼', result: '结果停留：滑块停稳' }[s.stage];
    pill(ctx, label, 800, 210, { color: s.feedback ? p.cyan : p.coral });
    signal(ctx, 1050, 580, 340, 100, s.feedback ? .25 : 1, s.feedback ? p.cyan : p.coral);
    text(ctx, '位移变化', 1220, 640, 23, p.muted, 500, 'center');
    if (s.feedback) {
        path(ctx, [[580, 540], [470, 540], [470, 320], [620, 320]], p.cyan, 3);
        arrow(ctx, [580, 320], [620, 320], p.cyan, 3);
        pill(ctx, '能量 → 耗散', 470, 280, { color: p.cyan });
    }
    if (s.stage === 'rewind') {
        text(ctx, '↶', 360, 450, 98, p.gold, 500, 'center');
        text(ctx, '同一段实验', 360, 530, 25, p.muted, 500, 'center');
    }
    ctx.restore();
    timeline(ctx, s.time / 12, { labels: ['看见失败', '追溯原因', '重试一次', '看清结果'] });
    end(ctx);
});
const reveal = candidate({ id: 'story-question-reveal', module: 'storytelling', title: '只揭开一个问题', description: '误差先藏在转子姿态里，测量弧将它显形，随后修正量从同一锚点生长。', referenceIds: ['mofs', 'car-ignition'], usage: '适合让抽象量从实体测量中出现。', stages: ['建立疑问', '量出角度', '建立关系', '看清变化'], recipe: ['先留下“看似到位但仍晃”的具体疑问。', '误差弧出现后只引入一个量 e。', '把修正箭头接回原转子，再给结果。'] }, (t, o) => { const s = phase(t) * 10, measure = window(s, 1.4, 8.8, 1, 1), act = window(s, 4.1, 9.1, 1.2, 1); return { time: s, angle: mix(12, 1.5, act) * Math.PI / 180, measure, act, anchor: [800, 470], error: mix(12, 1.5, act), visible: window(s, 0, 10, .5, .6) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '“到了”之后，还差什么？', subtitle: '把隐含的问题变成一个可量的角度', palette: p });
    ctx.save();
    ctx.globalAlpha = s.visible;
    gear(ctx, 800, 465, 170, 30, s.angle, p.gold);
    line(ctx, [800, 465], [800 + 260 * Math.cos(s.angle), 465 - 260 * Math.sin(s.angle)], p.coral, 5);
    line(ctx, [800, 465], [1135, 465], p.muted + '80', 2, [8, 10]);
    text(ctx, '参考方向', 1170, 465, 24, p.muted);
    ctx.save();
    ctx.globalAlpha = s.measure;
    const r = 260;
    ctx.beginPath();
    ctx.arc(800, 465, r, -s.angle, 0);
    ctx.lineWidth = 8;
    ctx.strokeStyle = p.gold;
    ctx.stroke();
    pill(ctx, `误差 e = ${s.error.toFixed(1)}°`, 1090, 465, { color: p.gold });
    ctx.restore();
    const to = bezier([1105, 455], [445, 410], s.act, 150);
    if (s.act > .01) {
        circle(ctx, ...to, 9, p.gold);
        ctx.save();
        ctx.globalAlpha = s.act;
        arrow(ctx, [445, 435], [600, 495], p.cyan, 6);
        pill(ctx, '角度先被量出来', 430, 350, { color: p.cyan });
        ctx.restore();
    }
    text(ctx, s.time < 4 ? '方向看起来接近，还差多少角度' : '从实体上量到的角度，才有意义', 800, 700, 32, p.ink, 600, 'center');
    ctx.restore();
    timeline(ctx, s.time / 10, { labels: ['姿态', '测量', '反馈', '回正'] });
    end(ctx);
});
const scale = candidate({ id: 'story-scale-relay', module: 'storytelling', title: '一个节点，接到整个网络', description: '从同一节点扩展到连接、骨架与网络，然后回收尺度，保留小任务的意义。', referenceIds: ['mofs', 'aesthetic', 'ai-draw'], usage: '适合从局部结构拓展到整体系统，再收回尺度。', stages: ['节点', '连接', '网络', '回到节点'], recipe: ['以节点圆心作为三个尺度共同锚点。', '局部细节先站稳，再拉远到系统。', '网络扩展以后回到原物体，避免只剩宏大装饰。'] }, (t, o) => { const s = phase(t) * 10, expand = window(s, 1.3, 9, 2, 2), net = window(s, 4, 8.5, 1.2, 1.2); return { time: s, expand, net, radius: mix(190, 70, expand), visible: window(s, 0, 10, .4, .5) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '把问题放大，最后回到这一个节点', subtitle: '同一个锚点串起节点、骨架与网络', palette: p });
    ctx.save();
    ctx.globalAlpha = s.visible;
    const cx = 800, cy = 450;
    glow(ctx, cx, cy, 310, p.gold);
    ctx.save();
    ctx.globalAlpha = 1 - s.net * .8;
    circle(ctx, cx, cy, s.radius, '#243b46', p.gold, 3);
    circle(ctx, cx - s.radius * .28, cy - s.radius * .3, s.radius * .2, '#b5d3ce90');
    circle(ctx, cx, cy, s.radius * .75, null, p.cyan + '66', 2);
    ctx.restore();
    const nodes = [[-310, -80, '节点', p.cyan], [310, -80, '连接', p.gold], [0, 230, '骨架', p.coral]];
    nodes.forEach(([dx, dy, name, color], i) => { const x = cx + dx * s.expand, y = cy + dy * s.expand; ctx.save(); ctx.globalAlpha = s.expand; line(ctx, [cx, cy], [x, y], color + '90', 3); circle(ctx, x, y, 52, '#1a2a36', color, 2); text(ctx, name, x, y, 25, color, 600, 'center'); ctx.restore(); });
    ctx.save();
    ctx.globalAlpha = s.net;
    for (let i = 0; i < 24; i++) {
        const a = i * TAU / 24, r = 335 + 30 * Math.sin(i * 3);
        const x = cx + r * Math.cos(a), y = cy + r * .62 * Math.sin(a);
        line(ctx, [cx, cy], [x, y], p.cyan + '35', 1);
        circle(ctx, x, y, 4 + (i % 3), i % 3 === 0 ? p.gold : p.cyan);
    }
    circle(ctx, cx, cy, 30, p.gold);
    circle(ctx, cx - 10, cy - 10, 7, '#ffffffb0');
    ctx.restore();
    text(ctx, s.expand < .4 ? '局部：一条连接怎样建立' : s.net < .5 ? '系统：局部和整体怎样接上' : '尺度放大以后，记住这个节点', 800, 180, 29, p.ink, 600, 'center');
    ctx.restore();
    timeline(ctx, s.time / 10, { labels: ['局部', '系统', '候选空间', '返回任务'] });
    end(ctx);
});
const counterfactual = candidate({ id: 'story-counterfactual', module: 'storytelling', title: '只改一个条件', description: '相同初始位移，相同时间轴，只改变阻尼比；由两次响应的差别提出因果问题。', referenceIds: ['mofs', 'car-ignition'], usage: '适合对照实验、变量解释、材料和算法比较。', recipe: ['把目标和初始条件锁定。', '两侧只改变一个参数，比例尺一致。', '差异出现后再给结论，不先堆名词。'], stages: ['同一初始条件', '同步释放', '结果分开', '结论停留'] }, (t, o) => { const s = phase(t) * 10, tau = clamp(s - 1, 0, 6), response = z => Math.exp(-z * 2 * tau) * (Math.cos(2 * Math.sqrt(1 - z * z) * tau) + z / Math.sqrt(1 - z * z) * Math.sin(2 * Math.sqrt(1 - z * z) * tau)); return { time: s, tau, low: response(.09), high: response(.55), visible: window(s, 0, 10, .4, .6) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '同样推一下，为什么结局不一样？', subtitle: '同一初始位移 · 只改变阻尼比 · 线性振子解析示例', palette: p });
    ctx.save();
    ctx.globalAlpha = s.visible;
    [[425, s.low, .09, p.coral], [1175, s.high, .55, p.cyan]].forEach(([cx, v, z, color]) => { line(ctx, [cx - 220, 500], [cx + 220, 500], p.line, 10); line(ctx, [cx, 300], [cx, 540], p.muted, 2, [7, 9]); roundRect(ctx, cx + v * 180 - 42, 410, 84, 88, 12, '#405e6b', color); circle(ctx, cx + v * 180, 451, 18, color); pill(ctx, `阻尼比 ζ = ${z.toFixed(2)}`, cx, 245, { color }); text(ctx, `位移  ${v.toFixed(2)}`, cx, 620, 30, color, 600, 'center'); });
    line(ctx, [800, 210], [800, 690], p.line, 2);
    text(ctx, s.time < 6 ? '同一个时间，同时释放' : '左边仍在来回，右边已经停稳', 800, 735, 28, p.ink, 600, 'center');
    ctx.restore();
    end(ctx);
});
export const candidates = [rewind, reveal, scale, counterfactual];
