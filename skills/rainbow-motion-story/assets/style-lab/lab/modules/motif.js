import { candidate, phase, smooth, mix, begin, end, text, line, circle, glow, TAU } from './common.js';
// Independent, deterministic filament field. This is a visual metaphor, not solar/flame physics.
function filament(ctx, cx, cy, radius, seconds, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, radius), 0, TAU);
    ctx.clip();
    const gradient = ctx.createRadialGradient(cx - radius * .35, cy - radius * .3, 0, cx, cy, radius * 1.4);
    gradient.addColorStop(0, '#f8d9a0');
    gradient.addColorStop(.2, '#cf7b34');
    gradient.addColorStop(.62, '#59301f');
    gradient.addColorStop(1, '#130f19');
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    for (let j = 0; j < 38; j++) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
            const u = i / 120, a = u * TAU, r = radius * (.18 + j / 46 + .025 * Math.sin(a * 9 + j * 1.8 + seconds * .6) + .02 * Math.sin(a * 17 + seconds * .35 + j));
            const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a) * (.5 + .4 * Math.sin(j * .27) ** 2);
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.strokeStyle = j % 3 === 0 ? '#ffdf9b70' : '#ff9f442d';
        ctx.lineWidth = Math.max(.6, radius * .002);
        ctx.stroke();
    }
    ctx.restore();
    circle(ctx, cx, cy, radius, null, color + '55', 1);
}
const scale = candidate({
    id: 'look-scale-return', module: 'look', title: '从宏大尺度，回到一枚火花',
    description: '同一圆心与暖色纹理贯穿放大、拉远、缩成光点和小物件；用尺度回收结束高潮。',
    referenceIds: ['aesthetic'], usage: '适合短高潮、片头或章节收束；不用于声称真实尺度的科学比较。',
    recipe: ['固定屏幕圆心，采用对数尺度过渡。', '先释放宏观细节，随后缩回同一个光点。', '光点落到小物件顶部，最终停留供识别。'],
    stages: ['火花', '放大纹理', '尺度回收', '小物落定'],
    codeFile: 'modules/motif.js'
}, (t, o) => {
    const s = phase(t) * 10, expand = smooth((s - .7) / 2.1), contract = smooth((s - 4.4) / 2.1), reset = smooth((s - 9) / 1);
    const radius = Math.exp(mix(Math.log(70), Math.log(680), expand) * (1 - contract) + Math.log(5) * contract);
    return { time: s, radius: mix(radius, 70, reset), objectAlpha: smooth((s - 6) / .8) * (1 - reset), fireAlpha: smooth((s - 6.8) / .6) * (1 - reset), phase: s < 2 ? '火花进入' : s < 4.4 ? '宏观细节' : s < 6.8 ? '尺度回收' : '回到小物', illustrative: true };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '让宏大，最后落在一件小事上', subtitle: '锚点接力 / 对数尺度 / 原创视觉隐喻', palette: p });
    ctx.save();
    ctx.beginPath();
    ctx.rect(60, 170, 1480, 580);
    ctx.clip();
    glow(ctx, 800, 420, Math.max(70, s.radius * 1.7), p.gold);
    filament(ctx, 800, 420, s.radius, s.time, p.gold);
    ctx.save();
    ctx.globalAlpha = s.objectAlpha;
    const body = ctx.createLinearGradient(745, 0, 855, 0);
    body.addColorStop(0, '#36434b');
    body.addColorStop(.25, '#e2e5de');
    body.addColorStop(.55, '#839296');
    body.addColorStop(1, '#283844');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(745, 475, 110, 160, 12);
    ctx.fill();
    line(ctx, [755, 510], [845, 510], p.gold, 3);
    ctx.fillStyle = p.gold;
    ctx.globalAlpha = s.fireAlpha;
    ctx.beginPath();
    ctx.moveTo(800, 400);
    ctx.bezierCurveTo(755, 450, 785, 475, 800, 475);
    ctx.bezierCurveTo(830, 470, 817, 440, 800, 400);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    text(ctx, s.phase, 800, 795, 34, p.ink, 650, 'center');
    end(ctx);
});
const typography = candidate({
    id: 'look-type-material', module: 'look', title: '字形不换，材料和轮廓接力',
    description: '同一字形先是清晰实心，再变成轮廓、金属与发光材质，最后回到稳定文字；不改变阅读基线。',
    referenceIds: ['aesthetic', 'mofs'], usage: '适合少量片头关键词和章节命题；不适合整段字幕。',
    recipe: ['字体、字宽、基线固定，变的是表现层。', '轮廓先保留身份，再让高光和材质进入。', '最后回到纯净的可读状态，给出停留。'],
    stages: ['清晰字形', '轮廓接力', '材料进入', '回到阅读'], codeFile: 'modules/motif.js'
}, (t, o) => {
    const s = phase(t) * 10, outline = smooth((s - 1) / 1) * (1 - smooth((s - 3) / 1)), material = smooth((s - 3) / 1) * (1 - smooth((s - 7.5) / 1.4));
    return { time: s, outline, material, sweep: (s / 10) * 1900 - 200, phase: s < 2 ? '字形建立' : s < 4 ? '保留轮廓' : s < 8 ? '材料接管' : '稳定阅读', illustrative: true };
}, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '文字可以有材料，但不能失去可读性', subtitle: '固定字形与基线 / 不复制原片标题或品牌', palette: p });
    const wording = '看见能量';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 138px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 1 - s.outline;
    ctx.fillText(wording, 800, 485);
    ctx.globalAlpha = s.outline;
    ctx.strokeStyle = p.gold;
    ctx.lineWidth = 2.4;
    ctx.strokeText(wording, 800, 485);
    ctx.globalAlpha = s.material;
    const paint = ctx.createLinearGradient(s.sweep - 250, 300, s.sweep + 400, 600);
    paint.addColorStop(0, '#6c3925');
    paint.addColorStop(.25, '#d49354');
    paint.addColorStop(.48, '#ffebad');
    paint.addColorStop(.56, '#9c6232');
    paint.addColorStop(.8, '#e5b372');
    paint.addColorStop(1, '#472b24');
    ctx.fillStyle = paint;
    ctx.fillText(wording, 800, 485);
    ctx.restore();
    for (let i = 0; i < 48; i++) {
        const x = 420 + ((i * 137.51 + s.time * 17) % 760), y = 530 + ((i * 37 + s.time * 22) % 130);
        ctx.save();
        ctx.globalAlpha = s.material * .42 * (1 - (y - 530) / 130);
        line(ctx, [x, y], [x + 1, y + 6], p.gold, 1.4);
        ctx.restore();
    }
    text(ctx, '一个关键词，一条基线，一次清楚的变化', 800, 690, 30, p.ink, 500, 'center');
    text(ctx, s.phase, 800, 800, 24, p.muted, 500, 'center');
    end(ctx);
});
export const candidates = [scale, typography];
