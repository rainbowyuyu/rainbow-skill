/** Original Chinese kinetic type study. Source-observed method, original code.
 * Focus reference: glyph discs gather from a ring into readable lines (2.6–3.4s).
 * No source artwork, paid code, audio, physics or proprietary fonts are used.
 */
import { candidate, clamp, mix, smooth } from './common.js';
import { normalizeMotionfaceOptions } from './motionface-type.js';

const ID = 'mf-type-orbit-lock', DURATION = 14, FONT = '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
export const motionfaceKineticDefaults = { [ID]: { headline: '先看变化，再看关系。', kicker: '散开的线索，也能连成一句话', result: '字落稳了，意思才站得住。' } };
const definitions = [['orbit', '先认出这些字粒', 0], ['lock', '字粒归位，句子成形', 2.25], ['release', '边界退去，字句留下', 5.25], ['handoff', '把注意力交给结论', 7.05], ['read', '完整、稳定地读一句话', 9.15]];
const finite = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const at = (t, a, b) => smooth((t - a) / (b - a));
function optionsFor(options = {}) {
    const defaults = motionfaceKineticDefaults[ID];
    const copy = Object.fromEntries(['headline', 'kicker', 'result'].map(k => [k, typeof options[k] === 'string' && options[k].trim() ? options[k] : defaults[k]]));
    return normalizeMotionfaceOptions({ ...options, ...copy });
}
const unitsFor = text => {
    const units = [];
    for (const c of Array.from(text)) {
        if (/^[，。！？；：、,.!?;:\s）】》]$/u.test(c) && units.length) units[units.length - 1] += c;
        else units.push(c);
    }
    return units;
};
const weightOf = value => Array.from(value).reduce((sum, c) => sum + (/^[，。！？；：、,.!?;:\s）】》]$/u.test(c) ? .45 : c.codePointAt(0) < 128 ? .62 : 1), 0);

let segmenterConstructor = null, wordSegmenter = null;
function joinPunctuation(segments) {
    const units = [];
    for (const segment of segments) {
        if (/^[，。！？；：、,.!?;:\s）】》]+$/u.test(segment) && units.length) units[units.length - 1] += segment;
        else units.push(segment);
    }
    return units;
}
function joinDependentPhrases(units) {
    const phrases = [];
    for (let i = 0; i < units.length; i++) {
        // Keep a short modifier/possessive phrase together where a bare 的/地/得
        // would otherwise begin a line. This is a small reading rule atop ICU,
        // not a claim to perform full Chinese syntactic analysis.
        if (/^[的地得]$/u.test(units[i]) && phrases.length && i + 1 < units.length) phrases.push(phrases.pop() + units[i] + units[++i]);
        else phrases.push(units[i]);
    }
    return phrases;
}
function safeClauseUnits(value) {
    // Without a language segmenter, punctuation is a genuine boundary. Very
    // long unbroken clauses get a bounded codepoint fallback rather than
    // overflowing or silently dropping text; this is not a word-segmentation
    // claim and intentionally preserves short clauses as whole units.
    const clauses = value.match(/[^，。！？；：、,.!?;:]+[，。！？；：、,.!?;:]*|[，。！？；：、,.!?;:]+/gu) || [value];
    return clauses.flatMap(clause => {
        const chars = Array.from(clause); if (chars.length <= 32) return [clause];
        const units = []; for (let i = 0; i < chars.length; i += 28) units.push(chars.slice(i, i + 28).join(''));
        return joinPunctuation(units);
    });
}
function semanticRowUnits(value) {
    try {
        const Constructor = typeof Intl !== 'undefined' ? Intl.Segmenter : null;
        if (typeof Constructor === 'function') {
            if (Constructor !== segmenterConstructor) { segmenterConstructor = Constructor; wordSegmenter = new Constructor('zh', { granularity: 'word' }); }
            const units = joinDependentPhrases(joinPunctuation(Array.from(wordSegmenter.segment(value), part => part.segment)));
            // Preserve every original codepoint. A damaged/unsupported custom
            // implementation must not corrupt the sentence or crash playback.
            if (units.length && units.join('') === value) return units.flatMap(unit => weightOf(unit) > 48 ? safeClauseUnits(unit) : [unit]);
        }
    } catch { /* Safely fall back to clause boundaries below. */ }
    return safeClauseUnits(value);
}

function divide(units, parts, favorPunctuation = false) {
    const groups = []; let from = 0;
    for (let remaining = parts; remaining > 1; remaining--) {
        const remainingUnits = units.slice(from), target = remainingUnits.reduce((sum, v) => sum + weightOf(v), 0) / remaining;
        let best = from + 1, cost = Infinity, width = 0;
        for (let to = from + 1; to <= units.length - remaining + 1; to++) {
            width += weightOf(units[to - 1]);
            const punctuationBonus = favorPunctuation && /[，。！？；：、,.!?;:]$/u.test(units[to - 1]) ? target * .35 : 0;
            const nextCost = Math.abs(width - target) - punctuationBonus;
            if (nextCost < cost) { best = to; cost = nextCost; }
        }
        groups.push(units.slice(from, best)); from = best;
    }
    groups.push(units.slice(from)); return groups;
}

/** Keep every codepoint, including punctuation; combine only presentation units. */
export function partitionOrbitText(headline) {
    // Row boundaries use lexical words (e.g. 真实 / 清楚 remain intact).
    // Only after rows are chosen do we return to smaller visual glyph groups.
    const units = semanticRowUnits(headline), weight = weightOf(headline);
    const desired = weight <= 32 ? 2 : weight <= 64 ? 3 : weight <= 104 ? 4 : weight <= 144 ? 5 : 6;
    const rowCount = Math.min(units.length, desired), rows = divide(units, Math.max(1, rowCount), true);
    const maxPerRow = Math.max(1, Math.floor(12 / rows.length));
    const tokens = [], textRows = [];
    let charOffset = 0;
    rows.forEach((row, rowIndex) => {
        const glyphUnits = unitsFor(row.join(''));
        const groups = divide(glyphUnits, Math.min(maxPerRow, glyphUnits.length)), rowWeight = row.reduce((sum, v) => sum + weightOf(v), 0);
        let consumed = 0; const tokenIds = [];
        groups.forEach((group, col) => {
            const text = group.join(''), weight = weightOf(text), id = `glyph-group-${tokens.length}`;
            tokens.push({ id, text, row: rowIndex, col, charStart: charOffset, charEnd: charOffset + Array.from(text).length,
                approximateX: ((consumed + weight / 2) / Math.max(.01, rowWeight) - .5) * 1000,
                approximateY: (rowIndex - (rows.length - 1) / 2) * 112 });
            tokenIds.push(id); charOffset += Array.from(text).length; consumed += weight;
        });
        textRows.push({ id: `line-${rowIndex}`, text: row.join(''), tokenIds });
    });
    const angular = [...tokens].sort((a, b) => Math.atan2(a.approximateY, a.approximateX) - Math.atan2(b.approximateY, b.approximateX));
    const order = new Map(angular.map((v, i) => [v.id, i]));
    tokens.forEach(token => { token.orbitIndex = order.get(token.id); });
    return { tokens, textRows };
}

export function sampleTypeOrbitLock(t, options = {}) {
    const o = optionsFor(options), time = clamp(finite(t), 0, DURATION), phaseTime = time * o.tempo;
    const timings = definitions.map((v, i) => ({ id: v[0], label: v[1], start: v[2] / o.tempo, end: i + 1 < definitions.length ? definitions[i + 1][2] / o.tempo : DURATION, reading: i === definitions.length - 1 }));
    const phaseIndex = Math.max(0, timings.findLastIndex(v => time >= v.start)), partition = partitionOrbitText(o.headline);
    const orbitTurn = o.reducedMotion ? 0 : (-.18 + .18 * at(phaseTime, .5, 2.25)) * (.4 + .6 * o.intensity);
    const radius = 238 + 18 * o.intensity;
    const tokens = partition.tokens.map((token, i) => {
        const angle = -Math.PI + Math.PI / partition.tokens.length + token.orbitIndex * Math.PI * 2 / partition.tokens.length + orbitTurn;
        const lock = at(phaseTime, 2.25 + i * .075, 4.35 + i * .075);
        return { ...token, lock, alpha: at(phaseTime, .1 + i * .045, .85 + i * .045),
            shellAlpha: 1 - at(phaseTime, 5.25, 6.65),
            ringPosition: [800 + Math.cos(angle) * radius * 1.42, 420 + Math.sin(angle) * radius],
            rotation: o.reducedMotion ? 0 : Math.sin(angle) * (.065 + .055 * o.intensity) * (1 - lock),
            arc: o.reducedMotion ? 0 : Math.sin(Math.PI * lock) * (token.approximateY <= 0 ? -1 : 1) * (16 + 22 * o.intensity) };
    });
    return { id: ID, time, phaseTime, phase: timings[phaseIndex].label, phaseIndex, timings,
        readHold: phaseIndex === timings.length - 1, readingHold: phaseIndex === timings.length - 1,
        copy: { headline: o.headline, kicker: o.kicker, result: o.result }, options: o,
        textRows: partition.textRows, tokens, connectorAlpha: at(phaseTime, .1, 1) * (1 - at(phaseTime, 2.25, 3.8)),
        ruleProgress: at(phaseTime, 7.05, 8.15), resultAlpha: at(phaseTime, 8.15, 9.15),
        resultShift: o.reducedMotion ? 0 : 18 * (1 - at(phaseTime, 8.15, 9.15)) };
}

function font(ctx, size, weight = 700) { ctx.font = `${weight} ${size}px ${FONT}`; }
function text(ctx, value, x, y, size, color, align = 'center', weight = 700) { ctx.save(); font(ctx, size, weight); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y); ctx.restore(); }
function alpha(ctx, opacity, draw) { if (opacity <= .00001) return; ctx.save(); ctx.globalAlpha *= clamp(opacity); draw(); ctx.restore(); }
function line(ctx, a, b, color, width = 2) { ctx.save(); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }
function circle(ctx, x, y, r, fill, border = null) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.restore(); }
function wrap(ctx, value, width) { const lines = []; let current = ''; for (const c of Array.from(value)) { if (current && ctx.measureText(current + c).width > width) { lines.push(current); current = c; } else current += c; } if (current) lines.push(current); return lines; }

const layouts = new WeakMap();
function measuredLayout(ctx, state) {
    const key = state.copy.headline;
    let cache = layouts.get(ctx); if (!cache) { cache = new Map(); layouts.set(ctx, cache); }
    if (cache.has(key)) return cache.get(key);
    ctx.save(); const bounds = { x: 150, y: 218, width: 1300, height: 405 };
    let size = 110;
    for (; size > 18; size--) { font(ctx, size); if (state.textRows.every(row => ctx.measureText(row.text).width <= bounds.width) && state.textRows.length * size * 1.24 <= bounds.height) break; }
    const lineHeight = size * 1.24, top = bounds.y + (bounds.height - state.textRows.length * lineHeight) / 2;
    const targets = {}, rows = [];
    state.textRows.forEach((row, i) => {
        const width = ctx.measureText(row.text).width, x = 800 - width / 2, y = top + (i + .5) * lineHeight;
        let prefix = '';
        row.tokenIds.forEach(id => {
            const token = state.tokens.find(v => v.id === id), before = ctx.measureText(prefix).width, tokenWidth = ctx.measureText(token.text).width;
            targets[id] = { x: x + before + tokenWidth / 2, y, width: tokenWidth }; prefix += token.text;
        }); rows.push({ id: row.id, text: row.text, x, y, width });
    });
    const result = { size, lineHeight, bounds, rows, targets }; ctx.restore();
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, result); return result;
}
/** Returned layout is an owned snapshot, safe for external inspection. */
export function layoutTypeOrbitLock(ctx, state) {
    const layout = measuredLayout(ctx, state);
    return { ...layout, bounds: { ...layout.bounds }, rows: layout.rows.map(v => ({ ...v })), targets: Object.fromEntries(Object.entries(layout.targets).map(([k, v]) => [k, { ...v }])) };
}

function ringCopy(ctx, value, p) {
    let size = 42, lines = [];
    for (; size > 12; size--) { font(ctx, size); lines = wrap(ctx, value, 82); if (lines.length * size * 1.1 <= 76) break; }
    const height = lines.length * size * 1.1;
    lines.forEach((v, i) => text(ctx, v, 0, -height / 2 + (i + .5) * size * 1.1, size, p.ink));
}

export function drawTypeOrbitLock(ctx, t, w, h, options = {}, supplied) {
    const s = supplied || sampleTypeOrbitLock(t, options), p = s.options.theme;
    ctx.save(); ctx.setTransform(finite(w, 1600) / 1600, 0, 0, finite(h, 900) / 900, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 1600, 900);
    line(ctx, [80, 82], [116, 82], p.accent, 4);
    font(ctx, 21, 500); const kickerSize = Math.min(21, 21 * 1325 / Math.max(1, ctx.measureText(s.copy.kicker).width)); text(ctx, s.copy.kicker, 133, 82, kickerSize, p.muted, 'left', 500);
    const layout = measuredLayout(ctx, s);
    alpha(ctx, s.connectorAlpha * .42, () => {
        const ordered = [...s.tokens].sort((a, b) => a.orbitIndex - b.orbitIndex);
        ordered.forEach((v, i) => line(ctx, v.ringPosition, ordered[(i + 1) % ordered.length].ringPosition, p.line, 1));
    });
    s.tokens.forEach(token => {
        const target = layout.targets[token.id];
        const x = s.options.reducedMotion ? target.x : mix(token.ringPosition[0], target.x, token.lock);
        const y = s.options.reducedMotion ? target.y : mix(token.ringPosition[1], target.y, token.lock) + token.arc;
        alpha(ctx, token.alpha, () => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(token.rotation);
            if (!s.options.reducedMotion) alpha(ctx, token.shellAlpha * (1 - at(token.lock, .45, 1)), () => circle(ctx, 0, 0, 53, p.paper, p.line));
            const textChange = s.options.reducedMotion ? 1 : at(token.lock, .18, .92);
            if (textChange < 1) alpha(ctx, 1 - textChange, () => ringCopy(ctx, token.text, p));
            alpha(ctx, textChange, () => text(ctx, token.text, 0, 0, layout.size, token.row % 2 ? p.accent : p.ink));
            ctx.restore();
        });
    });
    const ruleY = Math.min(657, layout.rows.at(-1).y + layout.lineHeight * .7 + 24);
    line(ctx, [800 - 260 * s.ruleProgress, ruleY], [800 + 260 * s.ruleProgress, ruleY], p.accent, 2);
    alpha(ctx, s.resultAlpha, () => {
        let size = 39, lines = [];
        for (; size > 18; size--) { font(ctx, size); lines = wrap(ctx, s.copy.result, 1390); if (lines.length <= 2) break; }
        lines.forEach((v, i) => text(ctx, v, 800, 716 + s.resultShift + i * size * 1.2, size, p.ink));
    });
    line(ctx, [80, 807], [1520, 807], p.line, 1); text(ctx, s.phase, 80, 844, 19, p.muted, 'left', 500);
    text(ctx, s.readHold ? '意思留下来，动作停下来' : '同一组字，换一种读法', 1520, 844, 19, p.muted, 'right', 500);
    ctx.restore();
}

export const typeOrbitLock = candidate({
    id: ID, module: 'look', title: '字粒入轨，句子落定', duration: DURATION, loop: false,
    codeFile: './modules/motionface-kinetic.js', referenceIds: ['motionface'], previewTime: 9.6,
    description: '观察 Focus 的字母圆片成环与行排方法后，原创实现中文字粒归位；完整文案保留，落定时统一字号。',
    usage: '适合短问题、机制揭晓和少量观测的归纳；环阵阶段不是长文阅读窗口，知识结论留到落定后。',
    stages: definitions.map(v => v[1]), stageTimes: definitions.map(v => v[2]),
    parameters: { palette: { values: ['paper', 'lime', 'coral'], default: 'paper' }, intensity: { min: 0, max: 1, default: .65 }, reducedMotion: { default: false }, headline: { type: 'string', maxLength: 180 }, kicker: { type: 'string', maxLength: 180 }, result: { type: 'string', maxLength: 180 } },
    recipe: ['最多12个字粒组保留所有文字与标点，每组具有固定ID。', '先按最终阅读位置排序环阵，再沿确定路径归位；减少中心混团。', '排版用实际字体测量选共同字号，短句两行，长句适配多行且不删字。', '阅读阶段取消位置漂移、转向、重影与持续缩放；减少动态模式从最终位置依次淡入。'],
    audio: '无声原创示例。本次来源仅做抽帧画面审阅，没有声称音轨复现。'
}, sampleTypeOrbitLock, drawTypeOrbitLock);
export const candidates = [typeOrbitLock];
