const $ = id => document.getElementById(id);
const film = $('film');
const manifestUrl = new URL('../examples/blender-flow/presentation.json', import.meta.url);
const lessons = {
  form: {
    kicker: '先让容器成立',
    title: '厚度、转角与落差，决定水经过哪里。',
    copy: '先看上槽的出水口，再沿落差找到下槽。槽底、槽壁和溢流唇都有实体厚度；倒角让边缘在光里可读，也让两层容器保持同一种造型语言。',
    look: '跟着轮廓走一遍：水从哪里进入，越过哪里，又落在哪里。'
  },
  surface: {
    kicker: '形状在每一刻改变',
    title: '越过槽口，水面变成下落的水流。',
    copy: '在短片和静帧之间切换，观察槽口附近的连续水面、空中拉长的液体，以及落入下槽后的扰动。形体给出边界，重力和碰撞共同影响自由表面的变化。',
    look: '放慢到 0.5×，对照相邻时刻；留意分离的水滴与下槽表面的起伏。'
  },
  light: {
    kicker: '让两种表面各自清楚',
    title: '瓷的宽高光，衬出水的细亮边。',
    copy: '青瓷承接柔和的大面积反射，透明水面在轮廓和弯折处显出亮边。先看高光的形状和位置，再看颜色；灯的面积、方向和材质粗糙度一起决定它们。',
    look: '比较槽壁与水流的同一侧：哪里是宽亮面，哪里只剩一道窄亮边。'
  },
  camera: {
    kicker: '先交代路径，再靠近',
    title: '一个视点，把上槽、水流与落点连起来。',
    copy: '三分之四视角同时露出两层容器和落差，便于看清水的路径。切换近景代表帧时，仍以同一件装置的槽口和水流为参照，判断细节属于哪个位置。',
    look: '先认出完整轮廓，再切换代表帧；注意容器有没有遮住水流的起点与落点。'
  }
};
let presentation = null;
let selectedFrame = 0;
let mode = 'still';

function assetUrl(path) {
  if (typeof path !== 'string' || !path) return null;
  const url = new URL(path, manifestUrl);
  // The manifest is a catalogue of bundled project assets, never external embeds.
  if (url.origin !== manifestUrl.origin || !url.pathname.startsWith(new URL('.', manifestUrl).pathname)) return null;
  return url.href;
}

function showError(message) {
  $('media-error').textContent = message;
  $('media-error').hidden = !message;
}

function syncTransport() {
  const duration = Number.isFinite(film.duration) ? film.duration : Number(presentation?.video?.durationSeconds) || 0;
  $('time').value = `${film.currentTime.toFixed(2)} / ${duration.toFixed(2)} s`;
  $('play').textContent = film.paused ? '播放' : '暂停';
  $('play').setAttribute('aria-label', film.paused ? '播放渲染短片' : '暂停渲染短片');
}

function setMode(next) {
  if (next === 'film' && !presentation?.video?.src) return;
  mode = next;
  if (mode === 'still') film.pause();
  $('film-view').hidden = mode !== 'film';
  $('still-view').hidden = mode !== 'still';
  $('transport').hidden = mode !== 'film';
  $('playback-hint').hidden = mode !== 'film';
  $('film-mode').setAttribute('aria-pressed', String(mode === 'film'));
  $('still-mode').setAttribute('aria-pressed', String(mode === 'still'));
  $('frames').querySelectorAll('button').forEach((button, index) => {
    button.setAttribute('aria-pressed', String(mode === 'still' && index === selectedFrame));
  });
  showError('');
  syncTransport();
}

async function togglePlayback() {
  if (!presentation?.video?.src) return;
  if (!film.paused) { film.pause(); return; }
  if (film.ended) film.currentTime = 0;
  try { await film.play(); showError(''); }
  catch { showError('短片暂时无法播放。可以先看代表静帧，或在接入文档中直接打开视频文件。'); }
}

function selectFrame(index) {
  const frame = presentation?.frames?.[index];
  const src = assetUrl(frame?.src);
  if (!src) return;
  selectedFrame = index;
  $('still').src = src;
  $('still').alt = frame.alt || frame.caption || frame.label;
  $('still-caption').textContent = frame.caption || frame.label;
  setMode('still');
}

function selectLesson(id, focus = false) {
  const lesson = lessons[id];
  if (!lesson) return;
  $('lesson-kicker').textContent = lesson.kicker;
  $('lesson-title').textContent = lesson.title;
  $('lesson-copy').textContent = lesson.copy;
  $('lesson-look').textContent = lesson.look;
  $('lesson-panel').setAttribute('aria-labelledby', `tab-${id}`);
  $('lesson-tabs').querySelectorAll('button').forEach(button => {
    const selected = button.dataset.lesson === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
}

function renderManifest(data) {
  const frames = Array.isArray(data.frames) ? data.frames.filter(frame => assetUrl(frame.src)) : [];
  const video = data.video && assetUrl(data.video.src) ? data.video : null;
  presentation = { ...data, frames, video };
  $('frames').replaceChildren();
  frames.forEach((frame, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'frame-choice';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${frame.label}，查看静帧`);
    const thumbnail = document.createElement('img');
    thumbnail.src = assetUrl(frame.src);
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.width = 160;
    thumbnail.height = 90;
    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = frame.label;
    const detail = document.createElement('small');
    detail.textContent = frame.detail || (Number.isInteger(frame.frame) ? `FRAME ${String(frame.frame).padStart(3, '0')}` : 'BLENDER RENDER');
    text.append(title, detail);
    button.append(thumbnail, text);
    button.addEventListener('click', () => selectFrame(index));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? frames.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + frames.length) % frames.length;
      selectFrame(target);
      $('frames').children[target].focus();
    });
    $('frames').append(button);
  });
  $('frame-count').textContent = `${frames.length} 张实际渲染`;
  if (frames.length) selectFrame(Math.min(Number(data.defaultFrame) || 0, frames.length - 1));
  if (assetUrl(data.scene?.src)) $('download-scene').href = assetUrl(data.scene.src);
  $('technical-data').replaceChildren();
  for (const item of data.technical?.items || []) {
    const label = document.createElement('dt');
    const value = document.createElement('dd');
    label.textContent = item.label;
    value.textContent = item.value;
    $('technical-data').append(label, value);
  }
  if (data.technical?.cacheNote) $('cache-note').textContent = data.technical.cacheNote;
  if (video) {
    film.src = assetUrl(video.src);
    const poster = assetUrl(video.poster) || assetUrl(frames[selectedFrame]?.src);
    if (poster) film.poster = poster;
    $('film-mode').disabled = false;
    $('media-meta').textContent = [video.durationSeconds ? `${Number(video.durationSeconds).toFixed(1)} s` : '', video.fps ? `${video.fps} fps` : '', video.audio === false ? '无声预览' : 'BLENDER RENDER'].filter(Boolean).join(' / ');
    setMode('film');
  }
}

$('film-mode').addEventListener('click', () => setMode('film'));
$('still-mode').addEventListener('click', () => setMode('still'));
$('play').addEventListener('click', togglePlayback);
$('replay').addEventListener('click', () => { film.pause(); film.currentTime = 0; syncTransport(); });
function stepFrame(direction) {
  if (!Number.isFinite(film.duration)) return;
  film.pause();
  const fps = Number(presentation?.video?.fps) || 24;
  const current = Math.round(film.currentTime * fps);
  const last = Math.max(0, Math.ceil(film.duration * fps) - 1);
  film.currentTime = Math.min(last, Math.max(0, current + direction)) / fps;
}
$('prev-frame').addEventListener('click', () => stepFrame(-1));
$('next-frame').addEventListener('click', () => stepFrame(1));
$('speed').addEventListener('change', () => { film.playbackRate = Number($('speed').value); });
for (const event of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended', 'seeked']) film.addEventListener(event, syncTransport);
film.addEventListener('error', () => showError('没有读取到渲染短片。请切换到静帧，或从接入文档检查视频文件。'));
$('still').addEventListener('error', () => showError('这张代表帧暂时无法读取，请选择另一张静帧。'));
$('lesson-tabs').querySelectorAll('button').forEach((button, index, buttons) => {
  button.addEventListener('click', () => selectLesson(button.dataset.lesson));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    selectLesson(buttons[target].dataset.lesson, true);
  });
});
window.addEventListener('document-reader:open', () => film.pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); });

try {
  const response = await fetch(manifestUrl, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  renderManifest(await response.json());
} catch {
  $('frame-count').textContent = '静帧预览';
  $('media-meta').textContent = 'BLENDER STILL';
  showError('媒体目录暂时无法读取。当前保留代表帧，可从接入文档查看场景与输出文件。');
}
