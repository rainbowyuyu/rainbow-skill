import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { candidates, semanticEmphasis, anchoredLabel, equationIdentity, paletteAttention, contrastRatio } from '../lab/modules/type-life.js';
import { palettes } from '../lab/modules/common.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const test = (name, fn) => { fn(); checks.push({ name, passed: true }); };
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const finite = v => { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); };
test('Finite, repeatable, clamped candidate states and declared stages', () => {
  for (const c of candidates) {
    assert.equal(c.loop, false); assert.equal(c.duration, 12); assert.equal(c.stageTimes.length, c.stages.length);
    assert.deepEqual(c.sample(-1), c.sample(0)); assert.deepEqual(c.sample(18), c.sample(12));
    for (const intensity of [0, .5, 1]) for (let f = 0; f <= 720; f++) finite(c.sample(f / 60, { intensity }));
    for (const t of [1, 9, 3.2, 11, 0, 3.2]) assert.deepEqual(c.sample(t), c.sample(t));
  }
});
test('Semantic reading hold keeps every word baseline, scale and object exactly still', () => {
  const start = semanticEmphasis.sample(3.5);
  for (let t = 3.5; t <= 8.5; t += .023) {
    const s = semanticEmphasis.sample(t); assert.equal(s.readingHold, true);
    assert.deepEqual(s.object, start.object); assert.deepEqual(s.tokens, start.tokens); assert.deepEqual(s.rule, start.rule);
  }
  for (let t = 0; t <= 12; t += .017) {
    const s = semanticEmphasis.sample(t);
    for (const token of s.tokens) { assert.ok(token.scale <= 1.08); assert.ok(token.alpha >= 0 && token.alpha <= 1); }
  }
});
test('Moving label stays in the reading region, avoids its measured point and uses a short continuous leader', () => {
  let previous;
  for (let f = 0; f <= 1440; f++) {
    const s = anchoredLabel.sample(f / 120), l = s.label, [x, y] = l.center;
    assert.ok(x - l.width / 2 >= 75 && x + l.width / 2 <= 1525 && y - l.height / 2 >= 165 && y + l.height / 2 <= 740);
    const dx = Math.max(0, Math.abs(s.point[0] - x) - l.width / 2), dy = Math.max(0, Math.abs(s.point[1] - y) - l.height / 2);
    assert.ok(Math.hypot(dx, dy) >= 12, `Label covers point at ${s.time}`);
    const leaderLength = Math.hypot(s.leader.a[0] - s.leader.b[0], s.leader.a[1] - s.leader.b[1]); assert.ok(leaderLength < 110);
    near(s.value + s.error, 1); near(s.point[1], 650 - 360 * s.value);
    if (previous) { assert.ok(Math.hypot(x - previous.label.center[0], y - previous.label.center[1]) < 8); assert.ok(Math.hypot(s.leader.b[0] - previous.leader.b[0], s.leader.b[1] - previous.leader.b[1]) < 8); }
    previous = s;
  }
  const a = anchoredLabel.sample(9), b = anchoredLabel.sample(11.9); assert.deepEqual(a.point, b.point); assert.deepEqual(a.label, b.label); assert.deepEqual(a.errorLabel, b.errorLabel);
});
test('Equation identities persist and their paths avoid one another and the fixed equal sign', () => {
  const ids = ['V', 'I', 'R']; let minDistance = Infinity;
  for (let f = 0; f <= 1440; f++) {
    const s = equationIdentity.sample(f / 120);
    assert.deepEqual(s.tokens.map(v => v.id), ids); near(s.voltage, s.current * s.resistance);
    const points = [...s.tokens.map(v => v.position), s.equal];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]); minDistance = Math.min(minDistance, d); assert.ok(d >= 78, `Formula collision at ${s.time}: ${d}`);
    }
  }
  const s = equationIdentity.sample(6); assert.deepEqual(s.tokens.find(v => v.id === 'I').position, [520, 425]); assert.deepEqual(s.tokens.find(v => v.id === 'V').position, [925, 365]); assert.deepEqual(s.tokens.find(v => v.id === 'R').position, [925, 485]);
});
test('Palette roles stay fixed, meaningful labels meet 4.5 contrast and error matches the same geometry', () => {
  for (const [palette, p] of Object.entries(palettes)) {
    const initial = paletteAttention.sample(0, { palette });
    for (let f = 0; f <= 720; f++) {
      const s = paletteAttention.sample(f / 60, { palette });
      assert.deepEqual(s.roles.map(r => [r.id, r.color]), initial.roles.map(r => [r.id, r.color]));
      for (const role of s.roles) { assert.ok(contrastRatio(role.textColor, p.bg) >= 4.5); assert.ok(contrastRatio(role.textColor, p.bg2 || '#080f18') >= 4.5); assert.ok(role.attention >= 0 && role.attention <= 1); }
      near(s.error, s.target - s.current); near(s.bracket.to[0] - s.bracket.from[0], s.error * 700);
    }
  }
});
const report = { passed: true, checks, scope: 'Analytic teaching examples, stable reading states, label clearance, algebra identity and palette contrast. No subjective readability or listening claim.' };
fs.writeFileSync(path.join(root, 'qa/type-life-invariants.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--frames')) {
  const req = createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(v => v.startsWith('--dependencies='))?.slice(15)));
  const browser = await req('@remotion/renderer').openBrowser('chrome', { browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe', logLevel: 'error' });
  const base = process.argv.find(v => v.startsWith('--url='))?.slice(6) || 'http://localhost:8000';
  try {
    const p = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
    await p.goto({ url: base + '/lab/index.html', timeout: 30000 });
    const outputs = await p.evaluate(async () => {
      await document.fonts.ready; const { candidates } = await import('./modules/type-life.js'); const result = [];
      for (const c of candidates) {
        const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const ctx = cv.getContext('2d');
        const sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 520; const sc = sheet.getContext('2d');
        for (const [i, t] of [0, 1.8, 3.3, 4.5, 5.8, 7, 8.8, 11].entries()) {
          c.draw(ctx, t, 1600, 900); const bytes = cv.toDataURL(); c.draw(ctx, 12 - t, 1600, 900); c.draw(ctx, t, 1600, 900); if (bytes !== cv.toDataURL()) throw Error('Pixel mismatch ' + c.id);
          sc.drawImage(cv, i % 4 * 400, Math.floor(i / 4) * 260, 400, 225); sc.fillStyle = '#101a22'; sc.fillRect(i % 4 * 400, Math.floor(i / 4) * 260 + 225, 400, 35); sc.fillStyle = '#eee9df'; sc.font = '18px sans-serif'; sc.fillText(t.toFixed(1) + 's', i % 4 * 400 + 12, Math.floor(i / 4) * 260 + 250);
        }
        c.draw(ctx, c.previewTime, 1600, 900); const preview = cv.toDataURL().split(',')[1];
        for (const palette of ['titanium', 'ember', 'porcelain']) for (const intensity of [0, 1]) c.draw(ctx, c.previewTime, 1600, 900, { palette, intensity });
        c.draw(ctx, c.previewTime, 1600, 900, { palette: 'porcelain' });
        result.push({ id: c.id, preview, light: cv.toDataURL().split(',')[1], contact: sheet.toDataURL().split(',')[1] });
      }
      return result;
    });
    for (const v of outputs) for (const kind of ['preview', 'light', 'contact']) fs.writeFileSync(path.join(root, 'qa', `${v.id}-${kind}.png`), Buffer.from(v[kind], 'base64'));
    console.log(JSON.stringify({ rendered: outputs.map(v => v.id), reverseSeekPixels: true, palettes: true }, null, 2));
  } finally { await browser.close({ silent: true }); }
}
