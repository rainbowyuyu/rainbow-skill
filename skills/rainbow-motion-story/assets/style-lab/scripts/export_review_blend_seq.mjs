// Export every frame of a repro page at a downscaled size, for sequence metrics.
// Usage: node export_review_blend_seq.mjs --out=<dir> --page=repro-blend.html --w=960 --h=540 [--from=0 --to=199]
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
const outDir = path.resolve(arg('out', '.'));
const page_ = arg('page', 'repro-blend.html');
const W = parseInt(arg('w', '960'), 10), H = parseInt(arg('h', '540'), 10);
const from = parseInt(arg('from', '0'), 10), to = parseInt(arg('to', '199'), 10);
const FPS = 24;
fs.mkdirSync(outDir, {recursive: true});
const browser = await require('@remotion/renderer').openBrowser('chrome', {
  browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe', logLevel: 'error'});
try {
  const p = await browser.newPage({context: () => null, logLevel: 'error', indent: false,
    pageIndex: 0, onBrowserLog: () => {}, onLog: () => {}});
  await p.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
  await p.goto({url: 'file:///' + path.join(root, 'lab', page_).split(path.sep).join('/'), timeout: 30000});
  await p.evaluate(({w, h}) => {
    const src = window.__repro.canvas;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', {alpha: false});
    window.__seq = (t) => {
      window.__repro.setTime(t);
      g.setTransform(1,0,0,1,0,0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, w, h);
      return c.toDataURL('image/png');
    };
  }, {w: W, h: H});
  const t0 = Date.now();
  for (let f = from; f <= to; f++){
    const url = await p.evaluate((tt) => window.__seq(tt), f / FPS);
    fs.writeFileSync(path.join(outDir, `f${String(f).padStart(3,'0')}.png`),
      Buffer.from(url.split(',')[1], 'base64'));
    if ((f - from) % 25 === 0) console.log('...', f, Date.now() - t0, 'ms');
  }
  console.log('done', from, '-', to, Date.now() - t0, 'ms');
} finally { await browser.close({silent: true}); }
