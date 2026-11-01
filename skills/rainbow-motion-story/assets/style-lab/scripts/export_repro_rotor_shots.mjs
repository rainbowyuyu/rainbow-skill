// Headless export of repro-rotor.html frames at given times.
// Usage: node export_repro_rotor_shots.mjs --out=<dir> [--prefix=repro-rotor] [--times=1.3,1.433]
// Uses the shared runtime's @remotion/renderer (no package installs).
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'local-config.json'), 'utf8'));
const require = createRequire(config.sharedRuntime);

const arg = (k, d) => {
  const hit = process.argv.find(s => s.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const outDir = path.resolve(arg('out', path.join(root, 'lab/shots')));
const prefix = arg('prefix', 'repro-rotor');
const page_ = arg('page', 'repro-rotor.html');
const audio = arg('audio', '0');
const times = arg('times', '1.300,1.433,6.850,10.500')
  .split(',').map(s => parseFloat(s)).filter(n => !isNaN(n));
const names = arg('names', '01-closed,02-cut-mid,03-pulse-settled,04-transparent-freeze').split(',');
const W = parseInt(arg('w', '1920'), 10), H = parseInt(arg('h', '1080'), 10);

fs.mkdirSync(outDir, {recursive: true});
const browser = await require('@remotion/renderer').openBrowser('chrome', {
  browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  logLevel: 'error'});
const report = {page: page_, size: [W, H], results: []};
try {
  const p = await browser.newPage({
    context: () => null, logLevel: 'error', indent: false, pageIndex: 0,
    onBrowserLog: () => {}, onLog: () => {}});
  await p.setViewport({width: W, height: H, deviceScaleFactor: 1});
  const fileUrl = 'file:///' + path.join(root, 'lab', page_).replace(/\\/g, '/')
    + '?audio=' + audio;
  const errors = [];
  await p.goto({url: fileUrl, timeout: 30000});
  const api = await p.evaluate(() => ({
    hasApi: !!window.__repro, total: window.__repro && window.__repro.total}));
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const name = names[i] || ('shot-' + i);
    const shot = await p.evaluate((tt) => {
      const url = window.__repro.shot(tt);
      return {url, state: window.__repro.state()};
    }, t);
    const buf = Buffer.from(shot.url.split(',')[1], 'base64');
    const file = path.join(outDir, prefix + '-' + name + '.png');
    fs.writeFileSync(file, buf);
    report.results.push({
      name, t, frame: shot.state.frame, phase: shot.state.phase, cut: shot.state.cut,
      rotorDeg: shot.state.rotorDeg, transparent: shot.state.transparent,
      bytes: buf.length, sha1: crypto.createHash('sha1').update(buf).digest('hex'),
      out: file});
    console.log(name, t + 's', shot.state.phase, 'cut=' + shot.state.cut,
      buf.length + 'B', path.basename(file));
  }
  report.api = api;
  report.errors = errors;
} finally {
  await browser.close({silent: true});
}
fs.writeFileSync(path.join(outDir, prefix + '-export.json'),
  JSON.stringify(report, null, 1));
