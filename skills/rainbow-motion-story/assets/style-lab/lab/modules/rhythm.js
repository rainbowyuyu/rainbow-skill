import { C, TAU, phase, clamp, mix, smooth, window, begin, end, text, line, path, circle, pill, roundRect, glow, arrow, timeline, tray, gear, candidate } from './common.js';
const phrase = candidate({ id: 'rhythm-phrase-envelope', module: 'rhythm', title: '乐句释放，讲解让位', description: '同一乐句把小幅准备、扩张与回收分开，模拟讲解段预让位，音乐展示段释放空间。演示本身不含原曲。', referenceIds: ['shuffle', 'aesthetic'], usage: '适合按音乐乐句编排短暂大动作与旁白回归。', stages: ['预让位', '乐句展开', '结果停留', '讲解回归'], recipe: ['先标出乐句边界，不让所有对象永久跳拍。', '高潮给完整动作弧；旁白回来前先收镜头、再压音乐。', '包络是可编辑示意，需替换成项目曲目实测乐句。'] }, (t, o) => { const s = phase(t) * 10, lift = window(s, 2, 7.3, 1.1, 1.4), duck = 1 - window(s, 1.4, 8.2, .8, .8); return { time: s, lift, duck, musicGainDb: mix(-21, -7, lift), speechActive: duck > .5, spread: mix(80, 340, lift) * (0.8 + o.intensity * .3), roll: .07 * Math.sin(s * .6) * lift }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '音乐抬起来，镜头才打开', subtitle: '预备 → 释放 → 留住结果 → 给讲解让位 · 包络示意', palette: p });
    ctx.save();
    ctx.translate(800, 420);
    ctx.rotate(s.roll);
    const n = 11;
    for (let i = 0; i < n; i++) {
        const q = (i - (n - 1) / 2) / 5, x = q * s.spread, y = 35 * Math.sin(q * 1.7 + s.time * .4) * s.lift;
        ctx.save();
        ctx.globalAlpha = i === 5 ? 1 : .25 + .45 * s.lift;
        roundRect(ctx, x - 28, y - 70, 56, 140, 9, i === 5 ? p.gold : p.cyan + '80');
        ctx.restore();
    }
    glow(ctx, 0, 0, 240, p.gold);
    ctx.restore();
    const y = 680;
    line(ctx, [120, y], [1480, y], C.line, 2);
    const pts = Array.from({ length: 181 }, (_, i) => { const tt = i / 18; return [120 + i / 180 * 1360, y - 100 * window(tt, 2, 7.3, 1.1, 1.4)]; });
    path(ctx, pts, p.gold, 4);
    const x = 120 + s.time / 10 * 1360;
    line(ctx, [x, 560], [x, 735], p.ink + '80', 2);
    circle(ctx, x, y - 100 * s.lift, 8, p.gold);
    pill(ctx, s.speechActive ? '讲解：小幅动作，音乐在后' : '音乐展示：腾出空间，完整看一次', 800, 210, { color: s.speechActive ? p.cyan : p.gold });
    text(ctx, `${s.musicGainDb.toFixed(1)} dB`, 1465, 730, 22, p.gold, 600, 'right');
    text(ctx, '示意增益，不是响度验收', 120, 730, 20, p.muted);
    timeline(ctx, s.time / 10, { labels: ['预让位', '大动作', '结果停留', '讲解回来'] });
    end(ctx);
});
const hold = candidate({ id: 'rhythm-explanation-hold', module: 'rhythm', title: '动作结束，真的停住', description: '一次快但平滑的位移之后，足够长地保持结果和数字；再用独立包络交给下一段。', referenceIds: ['shuffle', 'transmission', 'car-ignition'], usage: '适合复杂公式或关键结论，给读懂留出真正的停留。', stages: ['准备', '快速抵达', '真实停留', '平滑离场'], recipe: ['准备0.8秒，动作约1.2秒。', '复杂的解释使用真实停留，不加循环弹跳。', '入场和离场独立，段内不反复归零。'] }, (t, o) => { const s = phase(t) * 10, a = smooth((s - .8) / 1.4), leave = smooth((s - 7.9) / 1.5), hold = s >= 2.2 && s <= 7.9; return { time: s, progress: a * (1 - leave), hold, position: mix(360, 970, a) * (1 - leave) + 360 * leave, angle: mix(-.24, 0, a), explanation: window(s, 2, 8, 1, 1) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '快的不是全程，是一次决定', subtitle: '动作让人看见变化；停留让人理解原因', palette: p });
    path(ctx, [[360, 570], [970, 570]], p.line, 4);
    circle(ctx, 970, 570, 12, null, p.gold, 3);
    gear(ctx, s.position, 422, 92, 24, s.angle, p.gold);
    glow(ctx, s.position, 520, 180, p.cyan);
    ctx.save();
    ctx.globalAlpha = s.explanation;
    roundRect(ctx, 180, 260, 430, 200, 20, '#182a36', p.cyan + '55');
    text(ctx, '现在可以读懂', 220, 305, 29, p.ink, 700);
    text(ctx, '位移完成  100%', 220, 365, 32, p.gold, 600);
    text(ctx, '状态  已落定', 220, 415, 32, p.cyan, 600);
    ctx.restore();
    const cx = 800, cy = 694;
    line(ctx, [180, cy], [1420, cy], p.line, 3);
    for (let i = 0; i < 124; i++) {
        const tt = i / 124 * 10, move = (tt > .8 && tt < 2.2) || (tt > 7.9 && tt < 9.4);
        line(ctx, [180 + i * 10, cy], [180 + i * 10, cy - (move ? 62 : 12)], move ? p.gold : p.cyan, 4);
    }
    pill(ctx, s.hold ? '停住结果，留给理解' : '一次平滑的移交', 800, 190, { color: s.hold ? p.cyan : p.gold });
    timeline(ctx, s.time / 10, { labels: ['预备', '抵达', '读懂', '交接'] });
    end(ctx);
});
const relay = candidate({ id: 'rhythm-state-relay', module: 'rhythm', title: '快速换状态，最后选定', description: '六种候选状态共用位置、颜色与时间轴，快速轮换后只保留选定状态，避免把快切变成信息噪声。', referenceIds: ['shuffle', 'ai-draw', 'transmission'], usage: '适合短时比较多个候选，随后给出唯一可读结果。', stages: ['建立候选', '快速接力', '选定', '读清结果'], recipe: ['短时快速变化的是同一问题的候选。', '每个候选带可检验状态，不是无关蒙太奇。', '最后停在选择结果，给观众一次视觉落定。'] }, (t, o) => { const s = phase(t) * 10, rapid = clamp((s - 1.5) / 3.7), idx = s < 1.5 ? 0 : s < 5.2 ? Math.min(5, Math.floor(rapid * 18) % 6) : 4; const settle = smooth((s - 5.2) / 1.4), spread = mix(170, 55, settle); return { time: s, index: idx, settle, spread, states: [.32, -.22, .16, -.09, .012, .07], selected: 4, visible: window(s, 0, 10, .5, .6) }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '多试几个状态，只留下一个答案', subtitle: '短促接力之后，给选择一个清晰的落点', palette: p });
    ctx.save();
    ctx.globalAlpha = s.visible;
    for (let i = 0; i < 6; i++) {
        const active = i === s.index, x = mix(230 + i * 228, 800 + (i - 4) * s.spread, s.settle), alpha = active ? 1 : mix(.22, .04, s.settle);
        ctx.save();
        ctx.globalAlpha = alpha;
        roundRect(ctx, x - 95, 250, 190, 335, 18, '#243544', active ? p.gold : p.line);
        text(ctx, String.fromCharCode(65 + i), x, 294, 24, active ? p.gold : p.muted, 700, 'center');
        gear(ctx, x, 400, 47, 12, s.states[i], active ? p.gold : p.muted);
        text(ctx, `${(Math.abs(s.states[i]) * 180 / Math.PI).toFixed(1)}°`, x, 540, 30, active ? p.gold : p.muted, 600, 'center');
        ctx.restore();
    }
    if (s.settle > .1) {
        ctx.save();
        ctx.globalAlpha = s.settle;
        pill(ctx, '候选 E  ·  误差最小', 800, 650, { color: p.cyan });
        ctx.restore();
    }
    const x = 200 + s.time / 10 * 1200;
    for (let i = 0; i < 30; i++) {
        circle(ctx, 200 + i * 40, 725, i === Math.floor(s.time * 3) ? 6 : 2, i === Math.floor(s.time * 3) ? p.gold : p.muted);
    }
    text(ctx, s.time < 5.2 ? '状态接力' : '停住，确认，再执行', 800, 190, 29, p.ink, 600, 'center');
    ctx.restore();
    timeline(ctx, s.time / 10, { labels: ['建立对象', '快速比较', '选定', '执行'] });
    end(ctx);
});
const braid = candidate({ id: 'rhythm-braid-settle', module: 'rhythm', title: '交织、归拢，再摊开', description: '同一组带编号的卡片经历两次交织与一次摊开；每次变形保持身份，最后留出完整读序。', referenceIds: ['shuffle', 'aesthetic'], usage: '适合排列组合、离散状态、数据结构和节奏开场。', recipe: ['把对象分成两个有空间区别的组。', '先交错，再归拢，最后摊开；三次动作使用不同节奏。', '编号保持不变，结尾留足读序时间。'], stages: ['两组建立', '交织', '归拢', '摊开读序'] }, (t, o) => { const s = phase(t) * 10, a = smooth((s - 1) / 1.7), b = smooth((s - 3.4) / .8), c = smooth((s - 5.2) / 1.7), exit = 1 - smooth((s - 9) / 1); return { time: s, a, b, c, visible: exit * smooth(s / .4), cards: Array.from({ length: 12 }, (_, i) => { const group = i % 2, rank = Math.floor(i / 2); const start = [420 + group * 760, 300 + rank * 35], inter = [600 + i * 35, 425 + (group ? 20 : -20)], stack = [800 + group * 6, 425 + rank * 4], spread = [250 + i * 100, 425 + Math.sin(i / 11 * Math.PI) * 50]; return { index: i, x: mix(mix(mix(start[0], inter[0], a), stack[0], b), spread[0], c), y: mix(mix(mix(start[1], inter[1], a), stack[1], b), spread[1], c), angle: mix((group ? 1 : -1) * .3 * (1 - a), ((i - 5.5) * .025), c) }; }) }; }, (ctx, t, w, h, o, s) => { const p = o.theme; begin(ctx, w, h, { title: '快慢交替，动作才有重音', subtitle: '对象身份不变 · 交织 / 归拢 / 摊开', palette: p }); ctx.save(); ctx.globalAlpha = s.visible; s.cards.forEach(c => { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle); roundRect(ctx, -34, -65, 68, 130, 10, c.index % 2 ? '#243b49' : '#e2cda9', c.index % 2 ? p.cyan : p.gold); text(ctx, String(c.index + 1).padStart(2, '0'), 0, -22, 25, c.index % 2 ? p.cyan : '#51402c', 700, 'center'); line(ctx, [-18, 30], [18, 30], c.index % 2 ? p.cyan : '#90734b', 3); ctx.restore(); }); pill(ctx, s.time < 3 ? '交织：两组变一组' : s.time < 5.2 ? '归拢：短促而明确' : '摊开：把结果留给眼睛', 800, 210, { color: p.gold }); ctx.restore(); timeline(ctx, s.time / 10, { labels: ['建立', '交织', '归拢', '摊开'] }); end(ctx); });
export const candidates = [phrase, hold, relay, braid];
