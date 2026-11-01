// Headless export of repro-blend.html at explicit frame indices (review pass).
// Usage: node export_review_blend_frames.mjs --out=<dir> --prefix=rv [--frames=0,50,99] [--w=1920 --h=1080]
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'local-config.json'), 'utf8'));
const require = createRequire(config.sharedRuntime);

const arg = (k, d) => {
  const hit = process.argv.find(s => s.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const outDir = path.resolve(arg('out', path.join(root, 'lab/shots')));
const prefix = arg('prefix', 'rv-blend');
const page_ = arg('page', 'repro-blend.html');
const frames = arg('frames', '0,50,99,100,120,145,146,165,180,181,182,183,188,199')
  .split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
const W = parseInt(arg('w', '1920'), 10), H = parseInt(arg('h', '1080'), 10);
const FPS = 24;

fs.mkdirSync(outDir, {recursive: true});
const browser = await require('@remotion/renderer').openBrowser('chrome', {
  browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  logLevel: 'error'});
const report = {page: page_, size: [W, H], frames: []};
try {
  const p = await browser.newPage({
    context: () => null, logLevel: 'error', indent: false, pageIndex: 0,
    onBrowserLog: () => {}, onLog: () => {}});
  await p.setViewport({width: W, height: H, deviceScaleFactor: 1});
  await p.goto({url: 'file:///' + path.join(root, 'lab', page_).split(path.sep).join('/'), timeout: 30000});
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r(1))));
  for (const f of frames){
    const t = f / FPS;
    const out = await p.evaluate((tt) => {
      window.__repro.setTime(tt);
      return {url: window.__repro.canvas.toDataURL('image/png'),
              t: window.__repro.statsNow ? tt : tt};
    }, t);
    const buf = Buffer.from(out.url.split(',')[1], 'base64');
    const file = path.join(outDir, `${prefix}-f${String(f).padStart(3,'0')}.png`);
    fs.writeFileSync(file, buf);
    report.frames.push({f, t: +t.toFixed(4), out: file, bytes: buf.length});
    console.log('f' + f, t.toFixed(3) + 's', buf.length + 'B');
  }
} finally {
  await browser.close({silent: true});
}
fs.writeFileSync(path.join(outDir, prefix + '-export.json'), JSON.stringify(report, null, 1));
