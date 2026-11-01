const $ = id => document.getElementById(id);
const film = $('film');
const manifestUrl = new URL('../examples/robocup-blender/presentation.json', import.meta.url);
const codeUrl = new URL('../examples/robocup-blender/build_demo.py', import.meta.url);
const recipes = {
  sensor: {
    reference: '参考观察 / 约 3–6.5 秒', tag: '目标交接',
    title: '先认出机器人，再让视线落到传感器。',
    copy: '整体轮廓给观众一个方向。推进时把观察目标缓慢移向传感器；射线从真实位置发出，信息就有了归属。',
    steps: ['用三分之四低机位交代机器人。', '相机接近，同时把目标交接到传感器。', '镜头稳定后，才呈现测量射线与结果。'],
    check: '传感器不要被壳体挡住；射线起点跟随部件，不飘在画面上。'
  },
  rise: {
    reference: '参考观察 / 约 6.5–11 秒', tag: '视野扩展',
    title: '从一束回波，升到整间房的轮廓。',
    copy: '相机升高、退远，扫描结果逐渐占满空间。机器人和场地边界保留在视野里，让观众看懂点云是在哪里采到的。',
    steps: ['从已经讲清的射线与传感器出发。', '沿弧线抬升并退远，连续调整目标。', '停在高斜俯视，读完整个扫描范围。'],
    check: '不要只缩焦而不改变相机位置；检查升高时的视差、遮挡和主体屏幕位置。'
  },
  layers: {
    reference: '参考观察 / 约 18–22.5 秒', tag: '空间拆层',
    title: '稍微倾斜，看见每一层为什么不同。',
    copy: '地图沿同一方向拉开。斜俯视同时看见平面内容与层间距离；合拢时仍然回到原来的边界，信息不会散成几张不相关的卡片。',
    steps: ['保留机器人、目标与统一地图边界。', '沿固定轴线分离语义层，留出阅读间距。', '逐层交接解释，最后合拢到同一张地图。'],
    check: '不要正俯视把所有层压在一起；标注贴近所属层，避免引线交叉。'
  },
  field: {
    reference: '参考观察 / 约 25.5–35 秒', tag: '数据落地',
    title: '让路线有起伏，让数值有尺度。',
    copy: '规划场用高度与颜色编码，路线贴着同一坐标空间延伸。镜头降低后，沿路线展开的速度幕也能读出差异；图形不是脱离现场的装饰。',
    steps: ['先交代障碍、起点、目标与场的范围。', '从高斜视降低到掠视，读出高度差。', '沿路径显出速度变化，再回到机器人执行。'],
    check: '明示高度和颜色表示什么。规划代价不等于真实地形，速度幕也不是实体墙。'
  },
  chassis: {
    reference: '参考观察 / 约 42–50.5 秒', tag: '结构揭示',
    title: '沿着指令，走进真正工作的零件。',
    copy: '先让机器人停下来，再靠近底盘。局部壳体让出视线，指令、控制器与轮组形成一条因果链；特写结束时仍知道它属于哪台机器。',
    steps: ['用整体运动的结果引出“它如何执行”。', '推进到控制器，选择性隐藏或淡化遮挡壳体。', '沿信号找到电机与轮组，给每个箭头明确归属。'],
    check: '镜头不要直接穿实体壳体；透明材质不能替代正确的深度、轮廓与零件层级。'
  }
};

let presentation = { frames: [], video: null };
let selectedFrame = 0;
let selectedRecipe = 'sensor';
let mode = 'still';
let codeText = '';
let toastTimer;

function assetUrl(path) {
  if (typeof path !== 'string' || !path) return null;
  const url = new URL(path, manifestUrl);
  const root = new URL('.', manifestUrl);
  return url.origin === root.origin && url.pathname.startsWith(root.pathname) ? url.href : null;
}

async function isAvailable(path) {
  const url = assetUrl(path);
  if (!url) return false;
  try { return (await fetch(url, { method: 'HEAD', credentials: 'same-origin' })).ok; }
  catch { return false; }
}

function showError(message) {
  $('media-error').textContent = message;
  $('media-error').hidden = !message;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}

function syncTransport() {
  const duration = Number.isFinite(film.duration) ? film.duration : Number(presentation.video?.durationSeconds) || 0;
  $('time').value = `${film.currentTime.toFixed(2)} / ${duration.toFixed(2)} s`;
  $('play').textContent = film.paused ? '播放' : '暂停';
  $('play').setAttribute('aria-label', film.paused ? '播放原创短片' : '暂停原创短片');
}

function setMode(next) {
  if (next === 'film' && !presentation.video) return;
  if (next === 'still' && !presentation.frames.length) return;
  mode = next;
  if (mode === 'still') film.pause();
  $('empty-media').hidden = true;
  $('film-view').hidden = mode !== 'film';
  $('still-view').hidden = mode !== 'still';
  $('transport').hidden = mode !== 'film';
  $('film-mode').setAttribute('aria-pressed', String(mode === 'film'));
  $('still-mode').setAttribute('aria-pressed', String(mode === 'still'));
  $('frames').querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-pressed', String(mode === 'still' && selectedFrame === index)));
  const current = mode === 'film' ? presentation.video : presentation.frames[selectedFrame];
  $('render-label').textContent = mode === 'film' ? `${current.engine || 'Blender'} · 动画预览` : `${current.engine || 'Blender'} · 代表静帧`;
  $('media-meta').textContent = mode === 'film'
    ? [current.durationSeconds ? `${Number(current.durationSeconds).toFixed(1)} s` : '', current.fps ? `${current.fps} fps` : '', current.audio === false ? '无声练习' : '手动播放'].filter(Boolean).join(' / ')
    : [current.detail || '', current.engine || 'Blender render'].filter(Boolean).join(' / ');
  showError('');
  syncTransport();
}

function selectFrame(index) {
  const frame = presentation.frames[index];
  if (!frame) return;
  selectedFrame = index;
  $('still').src = assetUrl(frame.src);
  $('still').alt = frame.alt || frame.caption || frame.label;
  $('still-caption').textContent = frame.caption || frame.label;
  setMode('still');
}

async function togglePlayback() {
  if (!presentation.video) return;
  if (!film.paused) { film.pause(); return; }
  if (film.ended) film.currentTime = 0;
  try { await film.play(); showError(''); }
  catch { showError('短片暂时无法播放。可以先看实际渲染静帧，或从复现说明打开视频。'); }
}

function stepFrame(direction) {
  if (!Number.isFinite(film.duration)) return;
  film.pause();
  const fps = Number(presentation.video?.fps) || 24;
  const current = Math.round(film.currentTime * fps);
  const last = Math.max(0, Math.ceil(film.duration * fps) - 1);
  film.currentTime = Math.max(0, Math.min(last, current + direction)) / fps;
}

function selectRecipe(id, focus = false) {
  const recipe = recipes[id];
  if (!recipe) return;
  selectedRecipe = id;
  for (const field of ['reference', 'tag', 'title', 'copy', 'check']) $(`recipe-${field}`).textContent = recipe[field];
  $('recipe-steps').replaceChildren(...recipe.steps.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
  $('recipe-panel').setAttribute('aria-labelledby', `tab-${id}`);
  $('recipe-tabs').querySelectorAll('button').forEach(button => {
    const selected = button.dataset.recipe === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
}

async function copyText(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); }
  catch { toast('浏览器未允许复制；可从研究文档或源文件选择并复制。'); }
}

async function loadPresentation(data) {
  const frameChecks = await Promise.all((Array.isArray(data.frames) ? data.frames : []).map(async frame => await isAvailable(frame.src) ? frame : null));
  const frames = frameChecks.filter(Boolean);
  const video = data.video && await isAvailable(data.video.src) ? data.video : null;
  presentation = { ...data, frames, video };
  $('frames').replaceChildren();
  frames.forEach((frame, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'frame-choice';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${frame.label}，${frame.engine || 'Blender'} 静帧`);
    const img = document.createElement('img');
    img.src = assetUrl(frame.src); img.alt = ''; img.width = 160; img.height = 90; img.loading = 'lazy';
    const text = document.createElement('span');
    const label = document.createElement('strong'); label.textContent = frame.label;
    const detail = document.createElement('small'); detail.textContent = frame.detail || frame.engine || 'BLENDER';
    text.append(label, detail); button.append(img, text);
    button.addEventListener('click', () => selectFrame(index));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? frames.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + frames.length) % frames.length;
      selectFrame(next); $('frames').children[next].focus();
    });
    $('frames').append(button);
  });
  $('frame-count').textContent = frames.length ? `${frames.length} 张实际渲染` : '代表帧尚未发布';
  $('still-mode').disabled = !frames.length;
  $('film-mode').disabled = !video;
  if (video) {
    film.src = assetUrl(video.src);
    film.muted = true;
    const poster = assetUrl(video.poster) || assetUrl(frames[0]?.src);
    if (poster) film.poster = poster;
  }
  if (frames.length) selectFrame(Math.min(Number(data.defaultFrame) || 0, frames.length - 1));
  else if (video) setMode('film');
  else {
    $('render-label').textContent = '等待实际渲染资产';
    $('empty-copy').textContent = data.statusNote || '暂无已发布媒体。先看镜头配方和复现方法；页面不会用参考片冒充原创效果。';
  }
  if (data.scene && await isAvailable(data.scene.src)) { $('scene-link').href = assetUrl(data.scene.src); $('scene-link').hidden = false; }
  $('technical-data').replaceChildren();
  for (const item of data.technical?.items || []) {
    const dt = document.createElement('dt'); dt.textContent = item.label;
    const dd = document.createElement('dd'); dd.textContent = item.value;
    $('technical-data').append(dt, dd);
  }
  if (data.technical?.note) $('technical-note').textContent = data.technical.note;
}

$('film-mode').addEventListener('click', () => setMode('film'));
$('still-mode').addEventListener('click', () => setMode('still'));
$('play').addEventListener('click', togglePlayback);
$('replay').addEventListener('click', () => { film.pause(); if (Number.isFinite(film.duration)) film.currentTime = 0; syncTransport(); });
$('prev-frame').addEventListener('click', () => stepFrame(-1));
$('next-frame').addEventListener('click', () => stepFrame(1));
$('speed').addEventListener('change', () => { film.playbackRate = Number($('speed').value); });
for (const event of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended', 'seeked']) film.addEventListener(event, syncTransport);
film.addEventListener('error', () => showError('没有读到动画预览。请切换到代表静帧，或查看复现说明中的实际输出。'));
$('still').addEventListener('error', () => showError('这张静帧暂时无法读取，请选择另一张。'));
$('recipe-tabs').querySelectorAll('button').forEach((button, index, buttons) => {
  button.addEventListener('click', () => selectRecipe(button.dataset.recipe));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    selectRecipe(buttons[next].dataset.recipe, true);
  });
});
$('copy-recipe').addEventListener('click', () => {
  const r = recipes[selectedRecipe];
  copyText(`${r.title}\n${r.copy}\n\n${r.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n检查：${r.check}\n\n用途：原创空间解释镜头；非参考作者的工程参数。\n资料：guides/robot-spatial-explainer.md\n代码：examples/robocup-blender/build_demo.py`, '已复制镜头配方');
});
$('code-open').addEventListener('click', async () => {
  film.pause(); $('code-dialog').showModal();
  if (codeText) return;
  try {
    const response = await fetch(codeUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    codeText = await response.text();
    $('code-content').textContent = codeText;
    $('copy-code').disabled = false;
  } catch { $('code-content').textContent = '代码暂时无法读取。请从“复现说明”检查当前安装路径。'; }
});
$('code-close').addEventListener('click', () => $('code-dialog').close());
$('copy-code').addEventListener('click', () => copyText(codeText, '已复制 Blender 生成代码'));
$('code-dialog').addEventListener('click', event => {
  const bounds = $('code-dialog').getBoundingClientRect();
  if (event.target === $('code-dialog') && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) $('code-dialog').close();
});
window.addEventListener('document-reader:open', () => film.pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); });
const compactLayout = window.matchMedia('(max-width: 760px)');
function syncTabOrientation() { $('recipe-tabs').setAttribute('aria-orientation', compactLayout.matches ? 'horizontal' : 'vertical'); }
syncTabOrientation();
compactLayout.addEventListener('change', syncTabOrientation);

try {
  const response = await fetch(manifestUrl, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await loadPresentation(await response.json());
} catch {
  $('frame-count').textContent = '媒体目录未载入';
  $('render-label').textContent = '媒体目录未载入';
  $('empty-copy').textContent = '请从本地方法库服务器打开页面。镜头配方仍可使用，媒体只在实际文件可读取时显示。';
}
