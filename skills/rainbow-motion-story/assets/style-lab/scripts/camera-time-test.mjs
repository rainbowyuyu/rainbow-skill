import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bulletTime, hitchcockZoom, actionClock } from '../lab/modules/camera-time.js';
import { projector, dot, normalize, vsub } from '../lab/modules/common.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, passed: true }); };
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (Array.isArray(v)) v.forEach(finite); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
check('Both candidates clamp and reproduce identical absolute-time state', () => {
  for (const c of [bulletTime, hitchcockZoom]) {
    assert.equal(c.loop, false); assert.equal(c.duration, 12);
    assert.deepEqual(c.sample(-2), c.sample(0)); assert.deepEqual(c.sample(17), c.sample(12));
    for (const t of [11.2, 2.8, 0, 6.9, 1.1, 11.2]) assert.deepEqual(c.sample(t), c.sample(t));
  }
});
check('Every visible world object is exactly frozen while the camera sweeps', () => {
  for (const intensity of [0, .65, 1]) {
    const a = bulletTime.sample(2.8, { intensity });
    for (let t = 2.8; t <= 8.9; t += 1 / 60) {
      const s = bulletTime.sample(t, { intensity });
      assert.equal(s.worldTime, a.worldTime); assert.equal(s.temporalRate, 0); assert.equal(s.frozen, true);
      assert.deepEqual(s.hero, a.hero); assert.deepEqual(s.fragments, a.fragments);
    }
    const b = bulletTime.sample(8.9, { intensity });
    assert.ok(b.orbitAngle - a.orbitAngle >= Math.PI - 1e-10);
    near((b.orbitAngle - a.orbitAngle) * 180 / Math.PI, 180 + 54 * intensity);
  }
});
check('Analytic action-clock derivative matches its rate and enters/exits freeze continuously', () => {
  let prev = -1;
  for (let t = .002; t < 11.998; t += .007) {
    const s = actionClock(t); assert.ok(s.worldTime >= prev); prev = s.worldTime;
    near((actionClock(t + 1e-5).worldTime - actionClock(t - 1e-5).worldTime) / 2e-5, s.temporalRate, 2e-7);
    assert.ok(s.temporalRate >= 0 && s.temporalRate <= 1);
  }
  for (const t of [1.65, 2.8, 8.9, 10.25]) {
    near(actionClock(t - 1e-6).worldTime, actionClock(t + 1e-6).worldTime, 2.1e-6);
    near(actionClock(t - 1e-6).temporalRate, actionClock(t + 1e-6).temporalRate, 1e-10);
  }
  assert.ok(actionClock(11).worldTime > actionClock(8.9).worldTime);
});
check('Camera poses and sample states stay finite; subjects and debris remain ahead of near plane', () => {
  for (const c of [bulletTime, hitchcockZoom]) for (const intensity of [0, .5, 1]) for (let f = 0; f <= 720; f++) {
    const s = c.sample(f / 60, { intensity }); finite(s);
    assert.ok(s.camera.fov > 10 && s.camera.fov < 75);
    assert.ok(Math.hypot(...vsub(s.camera.position, s.camera.target)) > 1);
    if (s.fragments) {
      const forward = normalize(vsub(s.camera.target, s.camera.position));
      for (const p of s.fragments) assert.ok(dot(vsub(p.position, s.camera.position), forward) - p.size * 2 > s.camera.near);
      const q = projector(s.camera)(s.hero.position);
      assert.ok(q.x > 200 && q.x < 1400 && q.y > 250 && q.y < 650);
    }
  }
});
check('Hitchcock target has exact constant projection, with strong real perspective depth change', () => {
  for (const intensity of [0, .5, 1]) for (let f = 0; f <= 720; f++) {
    const s = hitchcockZoom.sample(f / 60, { intensity }), p = projector(s.camera);
    const a = p([0, 2.45 - 1.3, 0]), b = p([0, 2.45 + 1.3, 0]);
    near(a.y - b.y, s.targetHeightPixels); near(a.x, 800); near(b.x, 800); near(s.projectionConstant, 3.85);
  }
  const s = hitchcockZoom.sample(12);
  assert.ok(s.backgroundRelativeScale > 2); assert.ok(s.foregroundRelativeScale < .7);
});
check('Camera position, target, fov and roll velocities have no jump at stage joins', () => {
  for (const c of [bulletTime, hitchcockZoom]) for (const t of [1.2, 1.65, 2.8, 5.2, 8.9, 9.3, 10.25]) {
    const e = 1e-4, left = c.sample(t - e).camera, mid = c.sample(t).camera, right = c.sample(t + e).camera;
    const flat = p => [...p.position, ...p.target, p.fov, p.roll];
    const a = flat(left), b = flat(mid), d = flat(right);
    for (let i = 0; i < a.length; i++) near((b[i] - a[i]) / e, (d[i] - b[i]) / e, .003);
  }
});
const report = { passed: checks.every(c => c.passed), checks, boundary: 'Analytic world-motion illustration; Canvas projected solid faces with near-plane clipping and shared depth sorting. No collision solver, ray tracing or subjective motion-quality assertion.' };
fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
fs.writeFileSync(path.join(root, 'qa/camera-time-invariants.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--frames')) {
  const req = createRequire(createRequire(import.meta.url)('./shared-runtime.cjs')(process.argv.find(v => v.startsWith('--dependencies='))?.slice(15)));
  const { openBrowser } = req('@remotion/renderer');
  const browser = await openBrowser('chrome', { browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe', logLevel: 'error' });
  const base = process.argv.find(v => v.startsWith('--url='))?.slice(6) || 'http://localhost:8000';
  try {
    const p = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
    await p.goto({ url: base + '/lab/index.html', timeout: 30000 });
    const render = await p.evaluate(async () => {
      await document.fonts.ready;
      const { candidates } = await import('./modules/camera-time.js');
      const frames = [], outputs = [];
      for (const candidate of candidates) {
        const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
        const ctx = cv.getContext('2d'); const sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 520; const sc = sheet.getContext('2d');
        const times = candidate.id.includes('bullet') ? [0, 1.65, 2.8, 4.5, 5.8, 7.2, 8.9, 10.25] : [0, 1.2, 3, 4.5, 6, 7.5, 9.3, 12];
        const durations = [];
        for (const [i, t] of times.entries()) {
          const start = performance.now(); candidate.draw(ctx, t, 1600, 900, { intensity: .75 }); durations.push(performance.now() - start);
          const pixels = cv.toDataURL(); candidate.draw(ctx, 12 - t, 1600, 900, { intensity: .75 }); candidate.draw(ctx, t, 1600, 900, { intensity: .75 });
          if (pixels !== cv.toDataURL()) throw Error('Reverse seek mismatch: ' + candidate.id);
          sc.drawImage(cv, (i % 4) * 400, Math.floor(i / 4) * 260, 400, 225);
          sc.fillStyle = '#101a22'; sc.fillRect((i % 4) * 400, Math.floor(i / 4) * 260 + 225, 400, 35);
          sc.fillStyle = '#edf0e9'; sc.font = '18px sans-serif'; sc.fillText(t.toFixed(2) + 's', (i % 4) * 400 + 16, Math.floor(i / 4) * 260 + 250);
        }
        candidate.draw(ctx, candidate.previewTime, 1600, 900, { intensity: .75 });
        outputs.push({ id: candidate.id, png: cv.toDataURL().split(',')[1], contact: sheet.toDataURL().split(',')[1], durations });
        for (const palette of ['titanium', 'ember', 'porcelain']) for (const intensity of [0, 1]) candidate.draw(ctx, candidate.previewTime, 1600, 900, { intensity, palette });
      }
      return outputs;
    });
    for (const f of render) { fs.writeFileSync(path.join(root, 'qa', f.id + '-preview.png'), Buffer.from(f.png, 'base64')); fs.writeFileSync(path.join(root, 'qa', f.id + '-contact.png'), Buffer.from(f.contact, 'base64')); }
    console.log(JSON.stringify(render.map(r => ({ id: r.id, drawMs: r.durations, reverseSeek: true, palettes: true })), null, 2));
  } finally { await browser.close({ silent: true }); }
}
