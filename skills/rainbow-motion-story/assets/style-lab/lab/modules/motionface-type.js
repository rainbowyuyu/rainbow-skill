/**
 * Original Canvas 2D studies informed by the publicly visible Motionface hero.
 * Only card choreography is source-observed; the other methods are original
 * extensions. No source artwork, proprietary code, audio or physics solver.
 * All geometry is sampled from absolute time in a 1600 × 900 composition.
 */
import { candidate, clamp, mix, smooth } from './common.js';

export const MOTIONFACE_DURATION = 14;
export const motionfacePalettes = {
    paper: { name: '奶油纸墨', bg: '#F3EFE5', paper: '#FCF9F1', ink: '#292A27', muted: '#66675E', line: '#C6C3B6', accent: '#BD4B31', secondary: '#435F52', shade: '#DCD7C9' },
    lime: { name: '黑白酸柠', bg: '#111411', paper: '#1D231B', ink: '#F6F3E9', muted: '#B2BBA8', line: '#46513F', accent: '#D9F276', secondary: '#ACD4D0', shade: '#303B29' },
    coral: { name: '深靛珊瑚', bg: '#241F38', paper: '#332B49', ink: '#FFF1E4', muted: '#C0B6CC', line: '#60516E', accent: '#FF9C86', secondary: '#CAC1F1', shade: '#483957' }
};
export const motionfaceDefaults = {
    'mf-card-convergence': { headline: '把观测，连成一个关系。', kicker: '从看见，到看懂', result: '同一段运动，三个量对上了。' },
    'mf-mask-typeset': { headline: '让变化，先开口。', kicker: '一句话，分两口气', result: '让结论，留得住。' },
    'mf-focus-handoff': { headline: '先看它在哪，再看还差多少。', kicker: '注意力，只交给一个问题', result: '下一步，从差距开始。' },
    'mf-trace-assembly': { headline: '先搭起结构，再说清作用。', kicker: '线条，也有叙述次序', result: '看懂结构，再追问力怎样传递。' }
};

const finite = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const clock = t => clamp(finite(t, 0), 0, MOTIONFACE_DURATION);
const at = (t, a, b) => smooth((t - a) / Math.max(.001, b - a));
const clean = (v, fallback) => typeof v === 'string' && v.trim() ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, 180) : fallback;
const ids = Object.keys(motionfaceDefaults);
const legacyPalette = { titanium: 'lime', ember: 'coral', porcelain: 'paper' };

export function normalizeMotionfaceOptions(options = {}, id = ids[0]) {
    const defaults = motionfaceDefaults[id] || motionfaceDefaults[ids[0]];
    const selected = options.mfPalette || options.palette || 'paper';
    const palette = motionfacePalettes[selected] ? selected : legacyPalette[selected] || 'paper';
    return { intensity: clamp(finite(options.intensity, .65)), palette, theme: motionfacePalettes[palette],
        tempo: clamp(finite(options.tempo, 1), .75, 1.35), reducedMotion: options.reducedMotion === true,
        headline: clean(options.headline, defaults.headline), kicker: clean(options.kicker, defaults.kicker), result: clean(options.result, defaults.result) };
}

function stateBase(t, options, id, definitions) {
    const o = normalizeMotionfaceOptions(options, id), time = clock(t), phaseTime = time * o.tempo;
    const timings = definitions.map((s, i) => ({ id: s[0], label: s[1], start: s[2] / o.tempo,
        end: i < definitions.length - 1 ? definitions[i + 1][2] / o.tempo : MOTIONFACE_DURATION, reading: i === definitions.length - 1 }));
    const phaseIndex = Math.max(0, timings.findLastIndex(p => time >= p.start));
    return { id, time, phaseTime, phase: timings[phaseIndex].label, phaseIndex, timings,
        readHold: phaseIndex === timings.length - 1, readingHold: phaseIndex === timings.length - 1,
        copy: { headline: o.headline, kicker: o.kicker, result: o.result }, options: o };
}

const FONT = '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
function face(ctx, size, weight = 600) { ctx.font = `${weight} ${size}px ${FONT}`; }
function alpha(ctx, a, fn) { if (a <= .0001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); }
function stroke(ctx, points, color, width = 2) {
    if (points.length < 2) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    points.forEach((v, i) => i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, r, fill, border = null, width = 2) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, Math.max(.01, r), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = width; ctx.stroke(); } ctx.restore();
}
function rect(ctx, x, y, w, h, r, fill, border = null, width = 1.5) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = width; ctx.stroke(); } ctx.restore();
}
function txt(ctx, value, x, y, size, color, width = 1400, align = 'left', weight = 650) {
    ctx.save(); face(ctx, size, weight);
    const measured = ctx.measureText(String(value)).width;
    if (measured > width) face(ctx, Math.max(12, size * width / measured), weight);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y); ctx.restore();
}
function wrap(ctx, value, width, size) {
    face(ctx, size, 650); const lines = []; let line = '';
    for (const c of Array.from(value)) { if (c === '\n' || (line && ctx.measureText(line + c).width > width)) { lines.push(line); line = c === '\n' ? '' : c; } else line += c; }
    if (line) lines.push(line); return lines.length ? lines : [''];
}
function textBlock(ctx, value, x, y, width, maxSize, color, { maxLines = 2, leading = 1.32, align = 'left', weight = 650 } = {}) {
    let size = maxSize, lines = wrap(ctx, value, width, size);
    while (lines.length > maxLines && size > 20) { size -= 2; lines = wrap(ctx, value, width, size); }
    lines.forEach((line, i) => txt(ctx, line, x, y + i * size * leading, size, color, width, align, weight));
    return { size, lines, height: lines.length * size * leading };
}
function begin(ctx, w, h, s) {
    const p = s.options.theme; ctx.save(); ctx.setTransform(finite(w, 1600) / 1600, 0, 0, finite(h, 900) / 900, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 1600, 900);
    stroke(ctx, [[80, 82], [116, 82]], p.accent, 4); txt(ctx, s.copy.kicker, 133, 82, 21, p.muted, 1270, 'left', 500);
    stroke(ctx, [[80, 807], [1520, 807]], p.line, 1);
    txt(ctx, s.phase, 80, 844, 19, p.muted, 850, 'left', 500);
    txt(ctx, s.readHold ? '停下来，读完整' : '一次动作，只交代一件事', 1520, 844, 19, p.muted, 500, 'right', 500);
    return p;
}
function heading(ctx, s, p) { textBlock(ctx, s.copy.headline, 80, 174, 1440, 57, p.ink, { maxLines: 2 }); }
function finish(ctx) { ctx.restore(); }

/** Draw a polyline by its cumulative length, avoiding per-segment speed jumps. */
export function partialPolyline(points, progress) {
    const p = clamp(finite(progress, 0)); if (!points.length) return [];
    const lengths = points.slice(1).map((b, i) => Math.hypot(b[0] - points[i][0], b[1] - points[i][1]));
    let left = lengths.reduce((a, b) => a + b, 0) * p; const result = [points[0].slice()];
    for (let i = 0; i < lengths.length; i++) {
        const a = points[i], b = points[i + 1], length = lengths[i];
        if (left >= length) { result.push(b.slice()); left -= length; }
        else { const q = length < 1e-9 ? 0 : left / length; result.push([mix(a[0], b[0], q), mix(a[1], b[1], q)]); break; }
    } return result;
}

const convergenceStages = [['observe', '先看见三个观测', 0], ['turn', '实体翻为同名符号', 1.5], ['connect', '线索收束，关系浮现', 4.9], ['settle', '落定到同一个关系', 7.2], ['read', '读懂 F = ma', 9.1]];
export function sampleCardConvergence(t, options = {}) {
    const s = stateBase(t, options, ids[0], convergenceStages), u = s.phaseTime, o = s.options;
    const spread = at(u, .1, 1.5), gather = at(u, 4.9, 7.2), form = at(u, 7.2, 8.9), fadeFrame = at(u, 6.5, 8.7);
    const definitions = [
        { id: 'force', symbol: 'F', label: '合力', value: 6, unit: 'N', initialX: 460, finalX: 550 },
        { id: 'mass', symbol: 'm', label: '质量', value: 2, unit: 'kg', initialX: 800, finalX: 910 },
        { id: 'acceleration', symbol: 'a', label: '加速度', value: 3, unit: 'm/s²', initialX: 1140, finalX: 1130 }
    ];
    s.cards = definitions.map((d, i) => {
        const flip = at(u, 1.5 + i * .65, 2.65 + i * .65), tilt = (i - 1) * (.05 + o.intensity * .12) * (1 - spread);
        return { ...d, flip, rotation: o.reducedMotion ? 0 : tilt,
            x: o.reducedMotion ? d.initialX : mix(mix(800 + (i - 1) * 215, d.initialX, spread), d.finalX, form),
            y: o.reducedMotion ? 465 : mix(mix(455 + Math.abs(i - 1) * 22, 455, spread), 430, gather) + 58 * form,
            scale: o.reducedMotion ? 1 : mix(1, .76, gather), glyphScale: o.reducedMotion ? 1.25 : mix(1, 1.65, form),
            scaleX: o.reducedMotion ? 1 : Math.max(.018, Math.abs(Math.cos(Math.PI * flip))),
            frontAlpha: o.reducedMotion ? 1 - flip : flip < .5 ? 1 : 0,
            backAlpha: o.reducedMotion ? flip : flip >= .5 ? 1 : 0,
            frameAlpha: 1 - fadeFrame, symbolAlpha: at(u, 1.5 + i * .65, 2.4 + i * .65) };
    });
    s.connectorProgress = at(u, 5.4, 6.9); s.connectorAlpha = at(u, 5.1, 5.8) * (1 - at(u, 7.35, 8.35));
    s.equalAlpha = at(u, 7.65, 8.6); s.equalX = o.reducedMotion ? 630 : 725; s.equalY = o.reducedMotion ? 465 : 488;
    s.resultAlpha = at(u, 8.3, 9.1); s.relation = { force: 6, mass: 2, acceleration: 3, residual: 6 - 2 * 3, units: 'N = kg·m/s²' };
    return s;
}

function observationIcon(ctx, card, p) {
    if (card.id === 'force') {
        rect(ctx, -76, -45, 108, 90, 12, p.shade, p.ink, 2);
        stroke(ctx, [[-8, 0], [99, 0]], p.accent, 6); stroke(ctx, [[76, -17], [99, 0], [76, 17]], p.accent, 5);
    } else if (card.id === 'mass') {
        rect(ctx, -69, -60, 138, 120, 16, p.shade, p.ink, 2); rect(ctx, -30, -76, 60, 18, 6, null, p.ink, 2);
        txt(ctx, '2', 0, 0, 54, p.ink, 105, 'center');
    } else {
        stroke(ctx, [[-95, 44], [105, 44]], p.line, 2);
        [-78, -20, 72].forEach((x, i) => dot(ctx, x, 0, 9 + i * 5, i === 2 ? p.accent : p.shade, p.ink, 1.5));
        stroke(ctx, [[-72, -42], [98, -42]], p.accent, 3); stroke(ctx, [[83, -53], [98, -42], [83, -31]], p.accent, 3);
    }
}
export function drawCardConvergence(ctx, t, w, h, options = {}, supplied) {
    const s = supplied || sampleCardConvergence(t, options), p = begin(ctx, w, h, s); heading(ctx, s, p);
    alpha(ctx, s.connectorAlpha, () => {
        s.cards.forEach(c => stroke(ctx, partialPolyline([[c.x, c.y + 85], [c.x, 602], [800, 602]], s.connectorProgress), p.accent, 2));
        dot(ctx, 800, 602, 5 * s.connectorProgress, p.accent);
    });
    s.cards.forEach(c => {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rotation); ctx.scale(c.scale * c.scaleX, c.scale);
        alpha(ctx, c.frameAlpha, () => { rect(ctx, -143, -160, 286, 310, 19, p.paper, p.line); });
        alpha(ctx, c.frontAlpha, () => { observationIcon(ctx, c, p); txt(ctx, c.label, 0, -113, 24, p.muted, 240, 'center', 500); txt(ctx, `${c.value} ${c.unit}`, 0, 108, 31, p.ink, 240, 'center'); });
        alpha(ctx, c.backAlpha, () => {
            txt(ctx, c.symbol, 0, 0, 86 * c.glyphScale, p.accent, 240, 'center', 650);
            txt(ctx, `${c.value} ${c.unit}`, 0, 99, 27, p.ink, 260, 'center');
            alpha(ctx, c.frameAlpha, () => txt(ctx, c.label, 0, -113, 24, p.muted, 240, 'center', 500));
        }); ctx.restore();
    });
    alpha(ctx, s.equalAlpha, () => txt(ctx, '=', s.equalX, s.equalY, 83, p.ink, 140, 'center', 500));
    alpha(ctx, s.resultAlpha, () => textBlock(ctx, s.copy.result, 800, 704, 1350, 38, p.ink, { maxLines: 2, align: 'center' }));
    finish(ctx);
}

const maskStages = [['space', '留一点空白', 0], ['reveal', '按词组，错落揭示', 1], ['settle', '词组落在稳定基线上', 4.25], ['handoff', '主句交给结果', 6.35], ['read', '留下完整阅读窗口', 8.4]];
function semanticGroups(value) {
    const groups = value.split(/[，。！？；、\n]+/).map(s => s.trim()).filter(Boolean);
    if (groups.length >= 2) return [groups[0], groups.slice(1).join('，')];
    const chars = Array.from(value.replace(/[。！？]$/, '')); const cut = Math.max(1, Math.ceil(chars.length / 2));
    return [chars.slice(0, cut).join(''), chars.slice(cut).join('')].filter(Boolean);
}
export function sampleMaskTypeset(t, options = {}) {
    const s = stateBase(t, options, ids[1], maskStages), u = s.phaseTime, o = s.options;
    s.words = semanticGroups(o.headline).map((value, i) => {
        const reveal = at(u, 1 + i * .7, 2.8 + i * .8);
        return { id: `phrase-${i}`, text: value, reveal, y: 335 + i * 143, shift: o.reducedMotion ? 0 : (1 - reveal) * (38 + 22 * o.intensity), opacity: o.reducedMotion ? reveal : 1 };
    });
    s.symbol = { open: o.reducedMotion ? 1 : at(u, 1.1, 4.15), opacity: o.reducedMotion ? at(u, 1.1, 2.1) : 1, turn: o.reducedMotion ? 0 : mix(-.28, 0, at(u, 1.1, 4.15)), size: 166 + o.intensity * 18 };
    s.ruleProgress = at(u, 4.25, 5.55); s.resultAlpha = at(u, 6.35, 8.35); s.resultShift = o.reducedMotion ? 0 : 26 * (1 - s.resultAlpha);
    return s;
}

// Layout belongs to the sentence, not to each phrase independently. Measuring
// both groups at one size prevents a short first group becoming a giant title
// above a tiny single-line remainder. Cached only per drawing context/copy;
// animation progress never changes wrapping, baselines or the shared size.
const maskLayouts = new WeakMap();
function measuredMaskLines(ctx, value, width) {
    const lines = []; let current = '';
    for (const c of Array.from(value)) {
        if (current && ctx.measureText(current + c).width > width) { lines.push(current); current = c; }
        else current += c;
    }
    if (current) lines.push(current); return lines.length ? lines : [''];
}
function balancedMaskLines(ctx, value, width, count) {
    if (count <= 1) return [value];
    const characters = Array.from(value), lines = []; let from = 0;
    for (let remaining = count; remaining > 1; remaining--) {
        const target = ctx.measureText(characters.slice(from).join('')).width / remaining;
        let best = from + 1, bestCost = Infinity;
        for (let to = from + 1; to <= characters.length - (remaining - 1); to++) {
            const segment = characters.slice(from, to).join(''), measured = ctx.measureText(segment).width;
            if (measured > width) break;
            const suffix = characters.slice(to).join('');
            if (measuredMaskLines(ctx, suffix, width).length > remaining - 1) continue;
            // Avoid starting the next line with closing punctuation; otherwise
            // prefer comparable line lengths over a one-character final line.
            const orphan = /^[，。！？；：、,.!?;:）】》]/u.test(suffix) ? width * width : 0;
            const cost = (measured - target) ** 2 + orphan;
            if (cost < bestCost) { bestCost = cost; best = to; }
        }
        lines.push(characters.slice(from, best).join('')); from = best;
    }
    lines.push(characters.slice(from).join('')); return lines;
}
function resolveMaskLayout(ctx, words) {
    const key = words.map(v => v.text).join('\u001f');
    let cache = maskLayouts.get(ctx);
    if (!cache) { cache = new Map(); maskLayouts.set(ctx, cache); }
    if (cache.has(key)) return cache.get(key);
    const bounds = { x: 80, y: 200, width: 865, height: 350 }, groupGap = 24;
    let size = 116, lineGroups = [], lineHeight = 0, height = 0;
    ctx.save();
    for (; size >= 18; size--) {
        face(ctx, size, 750); lineHeight = size * 1.2;
        lineGroups = words.map(v => measuredMaskLines(ctx, v.text, bounds.width));
        height = lineGroups.reduce((n, lines) => n + lines.length * lineHeight, 0) + Math.max(0, words.length - 1) * groupGap;
        if (height <= bounds.height) break;
    }
    // The public input limit is 180 characters; the 18px fallback still fits
    // that bound. UI copy is capped at 48 and normally occupies 2–4 large lines.
    size = Math.max(18, size); face(ctx, size, 750); lineHeight = size * 1.2;
    lineGroups = words.map(v => { const count = measuredMaskLines(ctx, v.text, bounds.width).length; return balancedMaskLines(ctx, v.text, bounds.width, count); });
    height = lineGroups.reduce((n, lines) => n + lines.length * lineHeight, 0) + Math.max(0, words.length - 1) * groupGap;
    let top = bounds.y + (bounds.height - height) / 2;
    const groups = lineGroups.map((lines, i) => {
        const group = { id: words[i].id, top, height: lines.length * lineHeight, lines,
            baselines: lines.map((_, j) => top + (j + .5) * lineHeight) };
        top += group.height + groupGap; return group;
    });
    ctx.restore();
    const layout = { size, lineHeight, groupGap, bounds, height, groups };
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, layout); return layout;
}
/** Inspect a measured layout without exposing the cached geometry to mutation. */
export function layoutMaskTypeset(ctx, words) {
    const layout = resolveMaskLayout(ctx, words);
    return { ...layout, bounds: { ...layout.bounds }, groups: layout.groups.map(g => ({ ...g, lines: g.lines.slice(), baselines: g.baselines.slice() })) };
}
export function drawMaskTypeset(ctx, t, w, h, options = {}, supplied) {
    const s = supplied || sampleMaskTypeset(t, options), p = begin(ctx, w, h, s);
    const layout = resolveMaskLayout(ctx, s.words);
    s.words.forEach((v, i) => {
        const group = layout.groups[i];
        ctx.save(); ctx.beginPath(); ctx.rect(layout.bounds.x - 2, group.top, layout.bounds.width + 4, group.height * v.reveal); ctx.clip();
        alpha(ctx, v.opacity, () => group.lines.forEach((line, n) => txt(ctx, line, layout.bounds.x, group.baselines[n] + v.shift, layout.size, i ? p.accent : p.ink, layout.bounds.width, 'left', 750))); ctx.restore();
    });
    // A single opening aperture echoes the verb without competing with it.
    ctx.save(); ctx.globalAlpha *= s.symbol.opacity; ctx.translate(1250, 402); ctx.rotate(s.symbol.turn);
    const r = s.symbol.size, separation = 16 + 45 * s.symbol.open;
    ctx.save(); ctx.beginPath(); ctx.rect(-r * 1.5, -r * 1.5, r * 3, r * 1.5); ctx.clip(); dot(ctx, 0, -separation, r, p.accent); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-r * 1.5, 0, r * 3, r * 1.5); ctx.clip(); dot(ctx, 0, separation, r, p.ink); ctx.restore();
    dot(ctx, 0, 0, 64, p.bg); stroke(ctx, [[-47, 0], [47, 0]], p.secondary, 2); ctx.restore();
    stroke(ctx, [[80, 587], [80 + 900 * s.ruleProgress, 587]], p.line, 2);
    alpha(ctx, s.resultAlpha, () => textBlock(ctx, s.copy.result, 80, 690 + s.resultShift, 1420, 50, p.ink, { maxLines: 2 }));
    finish(ctx);
}

const focusStages = [['entity', '先建立目标与实体', 0], ['measure', '跟着同一位置测量', 1.4], ['handoff', '注意力转交给差距', 4.3], ['result', '把差距说清楚', 6.55], ['read', '读数和实体同时停住', 8.2]];
export function sampleFocusHandoff(t, options = {}) {
    const s = stateBase(t, options, ids[2], focusStages), u = s.phaseTime, o = s.options;
    const travel = at(u, 1.4, 4.3), handoff = at(u, 4.3, 6.55), target = 100, current = mix(42, 72, travel), error = target - current;
    const entityX = 180 + current * 10, targetX = 180 + target * 10;
    s.measurement = { target, current, error, unit: 'cm', entityX, targetX, gapMidX: (entityX + targetX) / 2 };
    s.focus = { x: mix(entityX - 116, 700, handoff), y: mix(324, 570, handoff), width: mix(232, 720, handoff), height: mix(234, 158, handoff), alpha: at(u, .5, 1.3), emphasis: .75 + .25 * o.intensity };
    if (o.reducedMotion) s.focus = { ...s.focus, x: handoff < .5 ? entityX - 116 : 700, y: handoff < .5 ? 324 : 570, width: handoff < .5 ? 232 : 720, height: handoff < .5 ? 234 : 158, alpha: at(u, .5, 1.3) * Math.abs(2 * handoff - 1) };
    s.gapAlpha = at(u, 4.5, 5.6); s.resultAlpha = at(u, 6.0, 7.25); s.copyAlpha = at(u, 7.2, 8.2); s.handoff = handoff;
    return s;
}
function cornerFrame(ctx, x, y, w, h, p, weight) {
    const n = 23; const corners = [[[x, y + n], [x, y], [x + n, y]], [[x + w - n, y], [x + w, y], [x + w, y + n]], [[x, y + h - n], [x, y + h], [x + n, y + h]], [[x + w - n, y + h], [x + w, y + h], [x + w, y + h - n]]];
    corners.forEach(points => stroke(ctx, points, p.accent, weight));
}
export function drawFocusHandoff(ctx, t, w, h, options = {}, supplied) {
    const s = supplied || sampleFocusHandoff(t, options), p = begin(ctx, w, h, s), m = s.measurement; heading(ctx, s, p);
    stroke(ctx, [[180, 486], [1380, 486]], p.line, 2);
    for (let i = 0; i <= 12; i++) { const x = 180 + i * 100; stroke(ctx, [[x, 478], [x, 494]], p.line, 1.5); if (!(i % 2)) txt(ctx, `${i * 10}`, x, 523, 18, p.muted, 60, 'center', 500); }
    dot(ctx, m.targetX, 421, 43, null, p.secondary, 2); dot(ctx, m.targetX, 421, 31, null, p.line, 1.5);
    stroke(ctx, [[m.targetX, 466], [m.targetX, 487]], p.secondary, 2);
    txt(ctx, '目标 100 cm', m.targetX, 340, 24, p.ink, 240, 'center');
    rect(ctx, m.entityX - 42, 382, 84, 79, 14, p.ink); dot(ctx, m.entityX, 421, 14, p.accent); stroke(ctx, [[m.entityX, 464], [m.entityX, 486]], p.ink, 2);
    txt(ctx, `当前 ${m.current.toFixed(0)} cm`, m.entityX, 340, 24, p.ink, 240, 'center');
    alpha(ctx, s.gapAlpha, () => {
        stroke(ctx, [[m.entityX, 568], [m.targetX, 568]], p.accent, 3); [m.entityX, m.targetX].forEach(x => stroke(ctx, [[x, 559], [x, 577]], p.accent, 2));
    });
    alpha(ctx, s.resultAlpha, () => {
        txt(ctx, '还差', 743, 651, 39, p.ink, 140, 'left', 600);
        txt(ctx, m.error.toFixed(0), 1007, 646, 100, p.accent, 265, 'center', 700);
        txt(ctx, '厘米', 1200, 651, 39, p.ink, 160, 'left', 600);
    });
    alpha(ctx, s.focus.alpha, () => cornerFrame(ctx, s.focus.x, s.focus.y, s.focus.width, s.focus.height, p, 2.2 * s.focus.emphasis));
    alpha(ctx, s.copyAlpha, () => textBlock(ctx, s.copy.result, 80, 703, 560, 36, p.ink, { maxLines: 2 }));
    finish(ctx);
}

const traceStages = [['ground', '先定支撑的位置', 0], ['deck', '把跨度连起来', 2.3], ['members', '杆件按语义组装', 3.9], ['labels', '结构稳定后再标注', 6.2], ['read', '留下可读的完整结构', 8.65]];
const bridgeStrokes = [
    { id: 'ground', group: 'support', start: .35, end: 1.45, points: [[250, 677], [1350, 677]] },
    { id: 'pier-left', group: 'support', start: .85, end: 2.3, points: [[380, 677], [380, 539], [420, 539], [420, 677]] },
    { id: 'pier-right', group: 'support', start: 1.1, end: 2.3, points: [[1180, 677], [1180, 539], [1220, 539], [1220, 677]] },
    { id: 'deck', group: 'deck', start: 2.3, end: 3.85, points: [[330, 533], [1270, 533], [1270, 546], [330, 546], [330, 533]] },
    { id: 'top-chord', group: 'member', start: 3.9, end: 5.2, points: [[400, 533], [600, 368], [1000, 368], [1200, 533]] },
    { id: 'diagonal-left', group: 'member', start: 4.35, end: 5.7, points: [[600, 368], [800, 533]] },
    { id: 'diagonal-right', group: 'member', start: 4.7, end: 6.05, points: [[800, 533], [1000, 368]] },
    { id: 'vertical-left', group: 'member', start: 5.1, end: 6.2, points: [[600, 368], [600, 533]] },
    { id: 'vertical-right', group: 'member', start: 5.4, end: 6.2, points: [[1000, 368], [1000, 533]] }
];
export function sampleTraceAssembly(t, options = {}) {
    const s = stateBase(t, options, ids[3], traceStages), u = s.phaseTime, o = s.options;
    // Return owned geometry: consumers may annotate a sampled frame without
    // changing the canonical structure or contaminating a later seek.
    s.strokes = bridgeStrokes.map(d => ({ ...d, points: d.points.map(p => p.slice()), progress: at(u, d.start, d.end), opacity: o.reducedMotion ? at(u, d.start, d.end) : 1 }));
    s.nodes = [[400, 533], [600, 368], [600, 533], [800, 533], [1000, 368], [1000, 533], [1200, 533]].map((position, i) => ({ id: `joint-${i}`, position, alpha: at(u, 5.8 + i * .055, 6.5 + i * .055) }));
    s.labels = [
        { id: 'members', text: '杆件', position: [800, 292], anchor: [800, 368], alpha: at(u, 6.2, 6.9) },
        { id: 'nodes', text: '节点', position: [1100, 385], anchor: [1000, 368], alpha: at(u, 6.7, 7.4) },
        { id: 'supports', text: '支座', position: [1314, 614], anchor: [1220, 614], alpha: at(u, 7.2, 7.9) }
    ];
    s.fillAlpha = at(u, 6.3, 7.7) * (.045 + .055 * o.intensity); s.resultAlpha = at(u, 7.8, 8.65);
    return s;
}
export function drawTraceAssembly(ctx, t, w, h, options = {}, supplied) {
    const s = supplied || sampleTraceAssembly(t, options), p = begin(ctx, w, h, s); heading(ctx, s, p);
    alpha(ctx, s.fillAlpha, () => { ctx.fillStyle = p.accent; ctx.beginPath(); ctx.moveTo(400, 533); ctx.lineTo(600, 368); ctx.lineTo(1000, 368); ctx.lineTo(1200, 533); ctx.closePath(); ctx.fill(); });
    s.strokes.forEach(v => { if (v.progress > .00001) alpha(ctx, v.opacity, () => stroke(ctx, partialPolyline(v.points, s.options.reducedMotion ? 1 : v.progress), v.group === 'member' ? p.ink : p.secondary, v.group === 'member' ? 4.1 : 2.4)); });
    s.nodes.forEach(n => alpha(ctx, n.alpha, () => dot(ctx, ...n.position, 6.5, p.bg, p.accent, 2.4)));
    s.labels.forEach(l => alpha(ctx, l.alpha, () => {
        const [x, y] = l.position, [ax, ay] = l.anchor;
        stroke(ctx, [[ax, ay], [x < ax ? x + 44 : x > ax ? x - 44 : x, y + (y < ay ? 28 : 0)]], p.line, 1.5);
        txt(ctx, l.text, x, y, 25, p.ink, 145, 'center', 600);
    }));
    alpha(ctx, s.resultAlpha, () => textBlock(ctx, s.copy.result, 800, 740, 1400, 33, p.ink, { maxLines: 1, align: 'center' }));
    finish(ctx);
}

const parameters = { intensity: { min: 0, max: 1, default: .65 }, palette: { values: ['paper', 'lime', 'coral'], default: 'paper' }, tempo: { min: .75, max: 1.35, default: 1 }, reducedMotion: { default: false }, headline: { type: 'string', maxLength: 180 }, kicker: { type: 'string', maxLength: 180 }, result: { type: 'string', maxLength: 180 } };
function make(meta, definitions, sample, draw) {
    return candidate({ duration: MOTIONFACE_DURATION, loop: false, codeFile: './modules/motionface-type.js', referenceIds: ['motionface'], parameters,
        stages: definitions.map(s => s[1]), stageTimes: definitions.map(s => s[2]), audio: '无声原创动效；未复现来源音轨。', ...meta }, sample, draw);
}
export const cardConvergence = make({ id: ids[0], module: 'visualization', title: '观测翻面，收束成关系', previewTime: 9.8,
    description: '参考公开首页可观察的扇出→翻面→收束方法；三个教学观测保持身份，组成 F = ma。原创图形与中文。',
    usage: '适合从少量实体观测归纳一个已给定关系；不是自动发现定律，也不是三维或物理仿真。',
    recipe: ['先看实体再看符号；每次只让一张观察卡翻面。', '翻面用二维宽度投影，过半时切面，不倒写文字。', '合力、质量和加速度来自同一组 F = ma 数值；最后至少保留阅读窗口。', '普通翻面和低动态淡化各有模式；颜色只决定风格，不改数据。'] }, convergenceStages, sampleCardConvergence, drawCardConvergence);
export const maskTypeset = make({ id: ids[1], module: 'look', title: '词组遮罩，留出一句话的呼吸', previewTime: 8.8,
    description: '原创延展：按语义词组遮罩揭示、错落落位，随后交给结果；没有逐字持续弹跳。',
    usage: '适合章节主句、转折和结论，不适合把长段字幕逐字飞入。',
    recipe: ['按标点拆为两个语义组，两组共用字号，先换行再整体适配标题区域。', '遮罩揭示和基线落定同步，结果窗内停止形状和文字运动。', '大形状只复述“打开”的动作，先保证文字主次。', '低动态模式取消位移与旋转，保留信息次序和阅读停留。'] }, maskStages, sampleMaskTypeset, drawMaskTypeset);
export const focusHandoff = make({ id: ids[2], module: 'visualization', title: '聚焦窗口，把位置交给差距', previewTime: 8.7,
    description: '原创延展：单一焦点由实体位置移向差距，读数与几何共用同一状态。',
    usage: '适合目标/当前/误差等一维测量解释；定位序列是教学插值，不代表控制器仿真。',
    recipe: ['当前位置、标记位置、差值和结果使用同一个 current 值。', '从目标100cm与当前72cm得到差距28cm，不画虚假的读数。', '单一框架交接注意力，未聚焦的参照仍然可辨。', '在结果出现前完成位移；阅读窗口不抖动、不持续吸气。'] }, focusStages, sampleFocusHandoff, drawFocusHandoff);
export const traceAssembly = make({ id: ids[3], module: 'visualization', title: '语义描线，让结构长出来', previewTime: 9.0,
    description: '原创延展：支撑、桥面、杆件按语义描线组装，稳定后才出现邻近短标签。',
    usage: '适合拆解结构、示意图和因果图的逐步建立；本例为二维桁架示意，不输出工程受力结论。',
    recipe: ['先确定支撑位置，再连跨度，最后建立杆件；不乱序画装饰线。', '每条折线按累计弧长揭示，避免过节点时速度突变。', '短标签靠近结构实体，后出现且不相互交叉。', '最终保持完整结构与短结论；减少动态时按语义组淡入。'] }, traceStages, sampleTraceAssembly, drawTraceAssembly);
export const candidates = [cardConvergence, maskTypeset, focusHandoff, traceAssembly];
