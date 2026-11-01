/** Actual UI handlers + real samplers; Canvas draw is recorded, not rasterized. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { candidates as originalCandidates } from '../lab/modules/aesthetic-direction.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const scriptPath = resolve(root, 'lab/aesthetic-direction-studio.js'), htmlPath = resolve(root, 'lab/aesthetic-direction.html');
const source = readFileSync(scriptPath, 'utf8'), html = readFileSync(htmlPath, 'utf8');
let checks = 0, clock = 0, frameId = 0, blobId = 0, canvasId = 0, drawCount = 0;
const frames = new Map(), timers = [], blobs = new Map(), downloads = [], pngCallbacks = [], windowEvents = new Map(), documentEvents = new Map(), elements = new Map(), nodes = [], drawn = new Map(), findings = [], exportsChecked = [], pngChecked = [];
const check = (ok, label) => { assert.ok(ok, label); checks++; };
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const near = (a, b, eps = 1e-9, label = 'value') => check(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
const clone = value => JSON.parse(JSON.stringify(value));

function element(tag = 'div', id) {
  const context = { id: id || (tag === 'canvas' ? `export-canvas-${++canvasId}` : undefined), filter: 'none', operations: [],
    fillRect(...args) { this.operations.push({ type: 'fillRect', args, filter: this.filter }); },
    fillText(...args) { this.operations.push({ type: 'fillText', args, filter: this.filter }); },
    drawImage(canvas, ...args) { this.operations.push({ type: 'drawImage', sourceId: canvas.id, args, filter: this.filter, state: drawn.has(canvas.id) ? clone(drawn.get(canvas.id)) : null }); }
  };
  const classes = new Set();
  const el = { tag, id, dataset: {}, style: {}, attributes: {}, children: [], hidden: false, value: '', textContent: '',
    setAttribute(key, value) { this.attributes[key] = String(value); },
    classList: { toggle(name, on) { if (on ?? !classes.has(name)) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
    getContext() { return context; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children.forEach(c => c.detached = true); this.children = [...children]; },
    click() { if (tag === 'a') downloads.push({ url: this.href, filename: this.download }); this.onclick?.(); },
    toBlob(callback, type) { pngCallbacks.push({ callback, type, width: this.width, height: this.height, operations: clone(context.operations) }); }
  };
  nodes.push(el); if (id) elements.set(id, el); return el;
}
for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
  const el = element(match[1], match[2]);
  for (const key of ['value', 'width', 'height']) { const found = new RegExp(`\\b${key}="([^"]*)"`).exec(match[0]); if (found) el[key] = key === 'value' ? found[1] : Number(found[1]); }
  el.hidden = /\bhidden\b/.test(match[0]);
}
for (const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
  const options = [...match[2].matchAll(/<option\b([^>]*)>/g)], selected = options.find(o => /\bselected\b/.test(o[1])) || options[0];
  elements.get(match[1]).value = /\bvalue="([^"]+)"/.exec(selected[1])[1];
}
for (const match of html.matchAll(/data-variant="([^"]+)"/g)) element('button').dataset.variant = match[1];
const workspace = element('div', 'workspace-test');
const document = { hidden: false, getElementById: id => elements.get(id) ?? null, createElement: tag => element(tag),
  querySelector: selector => { if (selector === '.workspace') return workspace; throw Error('Unexpected query selector: ' + selector); },
  querySelectorAll: selector => {
    if (selector === 'canvas') return nodes.filter(node => node.tag === 'canvas' && !!node.id);
    const key = /^\[data-(.+)\]$/.exec(selector)?.[1]; if (!key) throw Error('Unexpected selector: ' + selector);
    return nodes.filter(node => !node.detached && key in node.dataset);
  }, addEventListener: (name, fn) => documentEvents.set(name, fn)
};
const candidates = originalCandidates.map(c => ({ ...c, draw(ctx, time, width, height, options) {
  drawCount++; const record = { id: c.id, time, width, height, options: clone(options), state: c.sample(time, options) };
  drawn.set(ctx.id, record); return record.state;
} }));
const context = vm.createContext({ document, window: { addEventListener: (name, fn) => windowEvents.set(name, fn) }, performance: { now: () => clock },
  requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, Blob,
  URL: { createObjectURL: blob => { const key = `blob:aesthetic-contract-${++blobId}`; blobs.set(key, blob); return key; }, revokeObjectURL: key => blobs.delete(key) }, candidates });
new vm.Script(source.replace(/^import .*;\r?\n/gm, ''), { filename: scriptPath }).runInContext(context);
const $ = id => elements.get(id), state = () => JSON.parse($('diagnostics').textContent);
const tick = milliseconds => { clock += milliseconds; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(clock)); };
const seek = t => { $('seek').oninput({ target: { value: String(t) } }); return state(); };
const select = name => document.querySelectorAll('[data-variant]').find(b => b.dataset.variant === name).click();
const change = (id, value) => { $(id).value = String(value); $(id).onchange({ target: { value: String(value) } }); };
const key = value => { let prevented = false; $('scene').onkeydown({ code: value === ' ' ? 'Space' : value, key: value, preventDefault() { prevented = true; } }); check(prevented, 'canvas keyboard consumes transport key'); };
const currentCanvas = () => state().compare ? 'compare' + state().variant[0].toUpperCase() + state().variant.slice(1) : 'scene';
const auditJSON = async () => {
  const visible = drawn.get(currentCanvas()); $('export').click(); const file = downloads.at(-1), blob = blobs.get(file.url), payload = JSON.parse(await blob.text()), d = state();
  check(file.filename === visible.id + '-direction.json', 'JSON filename uses visible candidate identity');
  check(payload.candidateId === visible.id && payload.variant === d.variant, 'JSON selection agrees with screen');
  near(payload.time, visible.time, 0, 'JSON uses actual displayed time');
  equal(payload.state, clone(originalCandidates.find(c => c.id === visible.id).sample(visible.time)), 'JSON state recomputes from real sampler');
  check(payload.inspection === d.inspection && payload.comparison === d.compare, 'JSON includes grayscale and comparison choices');
  const original = originalCandidates.find(c => c.id === payload.candidateId);
  equal(payload.stages, original.stages.map((label, i) => ({ label, start: original.stageTimes[i] })), 'stage export uses actual module contract');
  check(payload.pathBase === 'motion_atelier-root' && payload.provenance === 'original-code-study', 'export declares path base and provenance');
  for (const path of [payload.code, ...payload.dependencies, payload.guide, payload.referenceStudy]) {
    check(!relative(root, resolve(root, path)).startsWith('..'), 'exported dependencies stay within the method library');
    if (!existsSync(resolve(root, path))) findings.push({ id: 'missing-export-dependency', path });
  }
  exportsChecked.push({ id: payload.candidateId, time: payload.time, comparison: payload.comparison, inspection: payload.inspection, bytes: blob.size }); return payload;
};

check(state().id === 'look-editorial-cutaway' && !state().playing, 'initial editorial preview is paused');
near(state().time, 6, 0, 'initial shared comparison moment'); check(frames.size === 1, 'single RAF scheduled');
check(state().speed === Number($('speed').value) && state().inspection === $('inspection').value, 'HTML defaults match runtime');

for (const t of [0, 2.1, 6.37, 11.4, 14]) {
  seek(t);
  for (const variant of ['industrial', 'orbital', 'editorial']) {
    select(variant); near(state().time, t, 0, 'switch preserves paused exact moment');
    near(drawn.get('scene').time, t, 0, 'selected renderer receives preserved moment');
    check(drawn.get('scene').state.objectId === 'ring-01', 'actual sampler keeps object identity across direction');
    check($('candidateLink').href.endsWith('#' + state().id), 'main library link follows selection');
    check(document.querySelectorAll('[data-stage]').length === 5, 'switch replaces five chapter controls');
    for (const button of document.querySelectorAll('[data-variant]')) check(button.attributes['aria-pressed'] === String(button.dataset.variant === variant), 'pressed direction accurately reflects selection');
  }
}

seek(6.37); $('compare').click();
check(state().compare && $('singleView').hidden && !$('compareView').hidden && workspace.classList.contains('comparing'), 'comparison shows all three scenes and layout');
for (const id of ['compareEditorial', 'compareIndustrial', 'compareOrbital']) { near(drawn.get(id).time, 6.37, 0, 'three panels share exact time'); check(drawn.get(id).width === 960 && drawn.get(id).height === 540, 'draw uses actual panel resolution'); }
equal(drawn.get('compareEditorial').state.facts, drawn.get('compareOrbital').state.facts, 'real samplers preserve factual comparison');
select('industrial'); near(state().time, 6.37, 0, 'comparison selection does not reset time');
await auditJSON();
change('inspection', 'grayscale'); check(document.querySelectorAll('canvas').every(c => c.style.filter === 'grayscale(1)'), 'gray inspection reaches every displayed canvas');
await auditJSON();
$('saveFrame').click(); const comparedPNG = pngCallbacks.shift();
check(comparedPNG.width === 2880 && comparedPNG.height === 590 && comparedPNG.type === 'image/png', 'comparison PNG preserves three full panels plus caption band');
const comparisonImages = comparedPNG.operations.filter(op => op.type === 'drawImage');
equal(comparisonImages.map(op => op.sourceId), ['compareEditorial', 'compareIndustrial', 'compareOrbital'], 'PNG contains the three intended panels');
check(comparisonImages.every(op => op.filter === 'grayscale(1)' && op.state.time === 6.37), 'gray PNG filters pixels, not only CSS, at correct moment');
equal(comparisonImages.map(op => op.args), [[0, 50], [960, 50], [1920, 50]], 'PNG panels use contiguous full-size placement');
select('orbital'); const beforeCallbackStatus = $('status').textContent; comparedPNG.callback(new Blob(['comparison-png'], { type: 'image/png' }));
check(downloads.at(-1).filename === 'aesthetic-comparison-frame.png', 'asynchronous comparison naming retains captured mode');
check($('status').textContent === beforeCallbackStatus, 'old PNG callback does not overwrite newly selected direction status');
pngChecked.push({ mode: 'comparison', inspection: 'grayscale', width: comparedPNG.width, height: comparedPNG.height });

$('compare').click(); check(!state().compare && !$('singleView').hidden && $('compareView').hidden && !workspace.classList.contains('comparing'), 'single view restores');
change('inspection', 'color'); check(document.querySelectorAll('canvas').every(c => c.style.filter === 'none'), 'return to color clears filters');
seek(9.123); $('saveFrame').click(); const singlePNG = pngCallbacks.shift();
check(singlePNG.width === 1600 && singlePNG.height === 900, 'single PNG retains design resolution');
const singleImage = singlePNG.operations.find(op => op.type === 'drawImage');
check(singleImage.sourceId === 'scene' && singleImage.filter === 'none' && singleImage.state.id === 'look-orbital-return', 'single PNG captures visible color direction');
near(singleImage.state.time, 9.123, 0, 'single PNG retains exact paused seek');
select('editorial'); singlePNG.callback(new Blob(['single-png'], { type: 'image/png' }));
check(downloads.at(-1).filename === 'look-orbital-return-frame.png', 'asynchronous single PNG retains original candidate');
check($('status').textContent === '', 'old candidate callback leaves new status untouched');
pngChecked.push({ mode: 'single', inspection: 'color', candidateId: singleImage.state.id, time: singleImage.state.time });
change('inspection', 'grayscale'); seek(4.75); $('saveFrame').click(); const graySinglePNG = pngCallbacks.shift();
const graySingleImage = graySinglePNG.operations.find(op => op.type === 'drawImage');
check(graySingleImage.filter === 'grayscale(1)' && graySingleImage.state.id === 'look-editorial-cutaway', 'single PNG also applies grayscale to rendered pixels');
near(graySingleImage.state.time, 4.75, 0, 'single grayscale PNG samples the visible moment');
graySinglePNG.callback(new Blob(['gray-single-png'], { type: 'image/png' }));
check(downloads.at(-1).filename === 'look-editorial-cutaway-frame.png', 'single grayscale PNG names current candidate');
pngChecked.push({ mode: 'single', inspection: 'grayscale', candidateId: graySingleImage.state.id, time: graySingleImage.state.time });
change('inspection', 'color');

// Bounds and individual frame changes are checked through handlers, not direct state mutation.
for (const t of [-5, NaN, 0, 3.14159, 99]) { seek(t); const expected = Number.isNaN(t) ? 0 : Math.max(0, Math.min(14, t)); near(state().time, expected, 0, 'seek bounds'); near(drawn.get('scene').time, expected, 0, 'seek uses real requested instant'); check(!state().playing, 'scrubbing pauses'); }
seek(5); $('next').click(); near(state().time, 5 + 1 / 30, 1e-12, 'next frame at 30 fps'); $('prev').click(); near(state().time, 5, 1e-12, 'previous reverses frame');
key('ArrowRight'); near(state().time, 5 + 1 / 30, 1e-12, 'keyboard next'); key('ArrowLeft'); near(state().time, 5, 1e-12, 'keyboard previous');
for (const [i, button] of document.querySelectorAll('[data-stage]').entries()) { button.click(); near(state().time, originalCandidates[0].stageTimes[i], 0, 'chapter seeks actual stage start'); check(state().stageIndex === i && !state().playing, 'chapter state and pause agree'); }

seek(5.013); key(' '); tick(17); check(state().playing, 'space begins playback'); near(state().drawTime, Math.floor(state().time * 30) / 30, 0, 'playback displays quantized frames');
await auditJSON(); const visibleBeforePause = drawn.get('scene').time; $('play').click(); near(state().time, visibleBeforePause, 0, 'pause freezes previous visible frame'); tick(900); near(state().time, visibleBeforePause, 0, 'paused time stays fixed');
change('speed', .5); seek(2); $('play').click(); tick(1000); near(state().time, 2.5, 1e-12, 'half speed uses elapsed time');
change('speed', 1.5); tick(1000); near(state().time, 4, 1e-12, 'speed can change without reset');
const beforeSwitch = drawn.get('scene').time; select('industrial'); near(state().time, beforeSwitch, 0, 'switch while playing freezes previous visible frame'); check(!state().playing, 'switch pauses');
seek(13.97); $('play').click(); tick(1000); check(state().time === 14 && state().drawTime === 14 && !state().playing && state().readHold, 'finite ending holds actual terminal frame');
$('play').click(); tick(100); near(state().time, .15, 1e-12, 'play after finite end restarts');
$('restart').click(); tick(200); near(state().time, .3, 1e-12, 'restart uses chosen playback rate');
$('compare').click(); tick(100); for (const id of ['compareEditorial', 'compareIndustrial', 'compareOrbital']) near(drawn.get(id).time, state().drawTime, 0, 'active comparison keeps three renderers on same frame');

// Independent reading/background transitions must not advance hidden footage.
windowEvents.get('document-reader:open')(); const readerTime = state().time; check(!state().playing, 'opening research reader pauses'); tick(1400); near(state().time, readerTime, 0, 'reading freezes visible time');
$('play').click(); tick(107); const beforeHidden = state().drawTime; document.hidden = true; documentEvents.get('visibilitychange')(); check(!state().playing, 'background visibility pauses'); near(state().time, beforeHidden, 0, 'background pause freezes shown frame'); tick(1800); near(state().time, beforeHidden, 0, 'hidden tab does not drift');
document.hidden = false; documentEvents.get('visibilitychange')(); tick(80); check(!state().playing, 'returning tab does not automatically play');
$('play').click(); tick(90); const beforePagehide = state().drawTime; windowEvents.get('pagehide')(); check(frames.size === 0, 'pagehide cancels RAF');
windowEvents.get('pageshow')({ persisted: true }); check(frames.size === 1, 'BFCache restore schedules one RAF'); tick(16); check(frames.size === 1 && !state().playing, 'restored page stays paused with one loop'); near(state().time, beforePagehide, 0, 'BFCache restores the last shown frame');
windowEvents.get('pageshow')({ persisted: true }); check(frames.size === 1, 'repeated restore does not duplicate frame loop'); tick(16);
change('inspection', 'grayscale'); await auditJSON();
check(timers.every(t => t.ms === 30000), 'download URLs retained long enough for asynchronous handling');
for (const timer of timers) timer.fn(); check(blobs.size === 0, 'temporary download URLs can all be released');

const report = { passed: findings.length === 0, checks, drawCount, exportsChecked, pngChecked, findings,
  sourceHashes: Object.fromEntries([scriptPath, htmlPath].map(path => [relative(root, path).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(path)).digest('hex')])),
  verified: ['Actual studio event handlers with real samplers', 'Same-time direction switch and three-panel comparison', 'Pause freezes previous displayed frame', 'Seek, keyboard, frames, speed, chapters and terminal frame', 'Canvas grayscale and PNG pixel-filter propagation', 'JSON matches displayed candidate/time/state and declared dependencies', 'Asynchronous PNG retains candidate and mode identity', 'Reader and hidden-tab pause', 'BFCache single RAF and visible-frame restoration'],
  notVerified: ['Browser raster appearance', 'Actual PNG pixel encoding', 'Real browser download behavior', 'GPU performance'] };
writeFileSync(resolve(root, 'qa/aesthetic-studio.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); if (findings.length) process.exitCode = 1;
