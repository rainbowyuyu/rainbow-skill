import { candidates } from './modules/index.js';
import { createSoundPreview } from './sound-preview.js';
const $ = id => document.getElementById(id);
const MODULES = [['storytelling', '编排与悬念', '◈', 'STORY / CAUSE / REVEAL'], ['rhythm', '音乐与呼吸', '≋', 'PHRASE / PAUSE / RELEASE'], ['camera', '运镜与景深', '◎', 'ORBIT / PASS / FOCUS'], ['mechanics', '机构与拆解', '⊙', 'ASSEMBLE / EXPLAIN / RETURN'], ['visualization', '公式与可视化', '∑', 'OBJECT / SYMBOL / RELATION'], ['look', '材质与视觉', '◐', 'MATERIAL / COLOR / LIGHT']];
const LABELS = Object.fromEntries(MODULES.map(m => [m[0], m[1]]));
const key = 'rainbow-motion-atelier-v2';
let saved = [];
try {
    saved = JSON.parse(localStorage.getItem(key) || '[]').filter(x => candidates.some(c => c.id === x.id));
}
catch { }
let current = candidates.find(c => c.id === 'visualization-route-bridge') || candidates[0], other = candidates[1], module = current.module, t = 3, playing = false, compare = false, sourceCode = '', last = 0, soundOn = false, drawnPhase = '', references = [];
const sound = createSoundPreview();
const contexts = [$('stageA').getContext('2d'), $('stageB').getContext('2d')];
const options = () => ({ intensity: Number($('intensity').value), palette: $('palette').value });
function syncCandidateControls(c) {
    const reasons = {
        palette: '本方案使用固定材料与配色。此处保留通用偏好，切换到支持配色的方案后恢复调整。',
        intensity: '本方案使用固定动作幅度，以保持几何关系。切换到支持幅度调整的方案后恢复。'
    };
    for (const name of ['palette', 'intensity']) {
        const control = $(name), disabled = c.controls?.[name] === false;
        control.disabled = disabled;
        control.setAttribute('aria-disabled', String(disabled));
        control.title = disabled ? reasons[name] : '';
        // Disabled form controls do not consistently expose hover tooltips; the label does.
        const field = control.closest('label');
        if (field) field.title = control.title;
    }
    // Keep the existing values and storage contract intact; only their availability changes.
    $('intensityLabel').textContent = $('intensity').disabled ? '固定' : Math.round(Number($('intensity').value) * 100) + '%';
}
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600); }
function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])); }
function persist() { localStorage.setItem(key, JSON.stringify(saved)); $('selectionCount').textContent = saved.length; const exists = saved.some(s => s.id === current.id); $('saveButton').textContent = exists ? '✓ 已选用 · 再点移除' : '＋ 加入选用清单'; $('saveButton').classList.toggle('saved', exists); }
function download(data, filename, type = 'application/json') { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
        toast('已复制');
    }
    catch {
        download(text, '制作指令.txt', 'text/plain');
        toast('浏览器未开放剪贴板，已下载文本');
    }
}
function recipeEntries(recipe) {
    if (Array.isArray(recipe))
        return recipe.map((v, i) => [String(i + 1).padStart(2, '0'), typeof v === 'string' ? v : JSON.stringify(v)]);
    if (recipe && typeof recipe === 'object')
        return Object.entries(recipe).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
    return [['动作设计', recipe || current.description]];
}
function sourcePath(c) { return c.codeFile || `./modules/${c.module}.js`; }
function selectedRecord(c) { return { id: c.id, module: c.module, title: c.title, description: c.description, options: options(), duration: c.duration, referenceIds: c.referenceIds, code: sourcePath(c), recipe: c.recipe }; }
function instruction(items) { return ['按以下选用清单制作镜头。先按当前主题改写对象与因果，再根据旁白和实际音乐安排时长；计算数据与表现缓动分开。', '完整代码在 rainbow-motion-story/assets/style-lab/lab/modules/，不要将示意运动写成实测或仿真结果。', ...items.map(s => `\n${LABELS[s.module]} / ${s.title}\n候选：${s.id}\n参数：${JSON.stringify(s.options)}\n代码：${s.code}\n设计：${JSON.stringify(s.recipe)}\n参考：${s.referenceIds.join('、')}`)].join('\n'); }
function tabs() {
    const root = $('moduleTabs');
    root.replaceChildren();
    for (const [id, title, icon] of MODULES) {
        const b = document.createElement('button');
        b.role = 'tab';
        b.dataset.module = id;
        b.setAttribute('aria-selected', String(module === id));
        b.innerHTML = `<span><span class="module-icon">${icon}</span>${title}</span><span class="module-count">${candidates.filter(c => c.module === id).length}</span>`;
        b.onclick = () => select(candidates.find(c => c.module === id));
        root.append(b);
    }
}
function cardGrid() { const root = $('candidateGrid'); root.replaceChildren(); candidates.filter(c => c.module === module).forEach((c, i) => { const b = document.createElement('button'); b.className = 'candidate' + (c.id === current.id ? ' active' : ''); b.dataset.id = c.id; b.setAttribute('aria-pressed', String(c.id === current.id)); b.innerHTML = `<canvas width="480" height="270" aria-hidden="true"></canvas><span class="candidate-number">${String(i + 1).padStart(2, '0')}</span>${saved.some(s => s.id === c.id) ? '<span class="candidate-saved">✓</span>' : ''}<div class="candidate-copy"><strong>${escapeHTML(c.title)}</strong><p>${escapeHTML(c.description)}</p></div>`; c.draw(b.querySelector('canvas').getContext('2d'), c.previewTime ?? c.duration * .38, 480, 270, options()); b.onclick = () => select(c); root.append(b); }); }
function select(c) {
    if (!c)
        return;
    current = c;
    module = c.module;
    syncCandidateControls(c);
    t = c.previewTime ?? c.duration * .55;
    drawnPhase = '';
    sound.stop();
    tabs();
    cardGrid();
    const m = MODULES.find(m => m[0] === module);
    $('moduleLabel').textContent = m[3];
    $('candidateTitle').textContent = c.title;
    $('inspectorTitle').textContent = c.title;
    $('candidateHeading').textContent = `${m[1]} · ${candidates.filter(x => x.module === module).length} 种方案`;
    $('description').textContent = c.description;
    $('usage').textContent = c.usage || c.description;
    renderStageChapters(c);
    $('timeline').max = c.duration;
    $('recipe').innerHTML = recipeEntries(c.recipe).map(([k, v]) => `<p class="recipe-item"><span class="recipe-key">${escapeHTML(k)}</span>${escapeHTML(v)}</p>`).join('');
    $('referenceChips').replaceChildren();
    for (const id of c.referenceIds) {
        const b = document.createElement('button');
        b.className = 'reference-chip';
        b.textContent = references.find(r => r.id === id)?.shortTitle || references.find(r => r.id === id)?.title || id;
        b.onclick = () => openReferences(id);
        $('referenceChips').append(b);
    }
    if (other.id === c.id)
        other = candidates.find(x => x.module === module && x.id !== c.id) || candidates[0];
    $('compareSelect').value = other.id;
    persist();
    updateTags();
    draw();
    if (soundOn && playing)
        scheduleSound();
    location.replace('#' + c.id);
}
function draw() {
    current.draw(contexts[0], t, 1600, 900, options());
    if (compare)
        other.draw(contexts[1], t / current.duration * other.duration, 1600, 900, options());
    $('timeline').value = t;
    $('timecode').textContent = `${t.toFixed(2)} / ${current.duration.toFixed(2)}`;
    const state = current.sample(t, options());
    const stageIndex = current.stageTimes?.findLastIndex(time => t >= time);
    const phase = (typeof state.phase === 'string' ? state.phase : state.stage) || current.stages?.[stageIndex] || '入场 → 动作 → 落定 → 交接';
    if (String(phase) !== drawnPhase) {
        $('phaseText').textContent = String(phase);
        drawnPhase = String(phase);
    }
    $('sampleState').textContent = JSON.stringify(state, null, 2);
}
function updateTags() { $('tagA').textContent = (compare ? 'A / ' : '') + current.title; $('tagB').textContent = 'B / ' + other.title; }
function setPlaying(on) {
    if (on && current.loop === false && t >= current.duration) {
        t = 0;
        draw();
    }
    playing = on;
    last = 0;
    $('playButton').textContent = on ? 'Ⅱ' : '▶';
    $('playButton').setAttribute('aria-label', on ? '暂停' : '播放');
    if (on && soundOn)
        scheduleSound();
    else
        sound.stop();
}
function scheduleSound() { sound.play({ from: t, duration: current.duration, speed: Number($('speed').value), recipe: current.id, module: current.module }); }
function tick(now) {
    if (playing) {
        if (last) {
            const next = t + Math.min((now - last) / 1000, .2) * Number($('speed').value);
            if (next >= current.duration) {
                if (current.loop === false) {
                    t = current.duration;
                    setPlaying(false);
                }
                else {
                    t = next % current.duration;
                    if (soundOn)
                        scheduleSound();
                }
            }
            else
                t = next;
        }
        draw();
    }
    last = now;
    requestAnimationFrame(tick);
}
function openReferences(id) {
    setPlaying(false);
    renderReferences();
    $('referenceDialog').showModal();
    if (id)
        document.getElementById('ref-' + id)?.scrollIntoView({ block: 'start' });
}
function renderReferences() {
    const root = $('referenceList');
    root.replaceChildren();
    if (!references.length) {
        root.innerHTML = '<p>参考记录尚未载入，请刷新页面。</p>';
        return;
    }
    for (const r of references) {
        const section = document.createElement('section');
        section.className = 'ref-study';
        section.id = 'ref-' + r.id;
        const website = r.kind === 'website' || r.referenceType === 'website';
        const hasTime = w => Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end >= w.start;
        const timeLabel = w => hasTime(w) ? `${w.start.toFixed(1)}–${w.end.toFixed(1)}s` : '';
        const windows = (r.playbackWindows || []).filter(hasTime).map(timeLabel).join('、');
        section.innerHTML = `<h3>${escapeHTML(r.title)}</h3><div class="ref-meta">${escapeHTML(r.author || '')} · ${escapeHTML(r.coverageLabel || (website ? '公开页面观察，范围详见研究记录' : '已有播放记录 '+(windows || '详见记录')))}</div><ul>${(r.observations || []).map(o => `<li>${hasTime(o) ? `<span class="time">${timeLabel(o)}</span> ` : ''}${escapeHTML(o.observed)}<br>→ ${escapeHTML(o.transfer)}</li>`).join('')}</ul><p>${escapeHTML(typeof r.audioStatus === 'string' ? r.audioStatus : JSON.stringify(r.audioStatus) || '')}</p><div class="ref-windows"></div><div class="ref-links"><a href="${escapeHTML(r.url)}" target="_blank" rel="noopener">${website ? '公开网站' : '原始作品'} ↗</a><button class="read-study">完整拆解与代码映射 ↗</button></div>`;
        section.querySelector('.read-study').onclick = () => showStudy(r.analysisPath || `../studies/${r.id}.md`, r.title);
        for (const w of r.windows || r.observations || []) {
            if (!website && hasTime(w)) {
                const b = document.createElement('button');
                b.textContent = `▶ ${timeLabel(w)} · ${w.label || '研究动作'}`;
                b.onclick = () => openSource(r, w);
                section.querySelector('.ref-windows').append(b);
            }
            if (w.sheet) {
                const d = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = website ? (w.label || '公开页面观察联系表') : hasTime(w) ? `密集邻帧 / ${timeLabel(w)}` : (w.label || '研究联系表');
                const im = document.createElement('img');
                im.className = 'ref-sheet';
                im.loading = 'lazy';
                im.alt = website ? (w.label || '公开页面观察联系表；静态采样不代表完整播放') : hasTime(w) ? '带解码时间的研究联系表' : '研究联系表';
                im.src = w.sheet;
                d.append(summary, im);
                section.append(d);
            }
        }
        for (const id of r.recommendedCandidateIds || []) {
            const c = candidates.find(x => x.id === id);
            if (!c)
                continue;
            const b = document.createElement('button');
            b.className = 'reference-chip';
            b.textContent = '代码实验 · ' + c.title;
            b.onclick = () => { $('referenceDialog').close(); select(c); };
            section.querySelector('.ref-links').append(b);
        }
        root.append(section);
    }
}
function renderStageChapters(c) {
    const root = $('stageChapters');
    root.replaceChildren();
    for (const [i, label] of (c.stageTimes ? c.stages : ['建立', '推进', '看清', '交接']).entries()) {
        const b = document.createElement('button');
        b.textContent = label;
        b.onclick = () => { setPlaying(false); t = c.stageTimes?.[i] ?? c.duration * [.06, .32, .65, .9][i]; draw(); };
        root.append(b);
    }
}
let sourceWindow = null;
async function openSource(r, w) {
    setPlaying(false);
    const v = $('sourceVideo'), a = $('sourceAudio');
    sourceWindow = { ...w, id: r.id };
    $('sourceTitle').textContent = r.title;
    $('sourceNote').textContent = `复看 ${w.start.toFixed(2)}–${w.end.toFixed(2)} 秒。只研究原作的方法，原创代码在主面板。`;
    $('sourceStatus').textContent = '正在读取已有本地研究副本…';
    a.pause();
    v.src = `/reference-media/${r.id}/video`;
    a.src = `/reference-media/${r.id}/audio`;
    v.muted = true;
    $('sourceDialog').showModal();
    try {
        await new Promise((resolve, reject) => { v.onloadedmetadata = resolve; v.onerror = () => reject(Error('本地副本不可用，可从原始作品链接观看')); });
        v.currentTime = w.start;
        await v.play();
        $('sourceStatus').textContent = '正在播放指定区间；音视频由本地独立轨道同步。';
    }
    catch (e) {
        $('sourceStatus').textContent = e.message;
    }
}
const sourceVideo = $('sourceVideo'), sourceAudio = $('sourceAudio');
function syncSourceAudio() {
    sourceVideo.muted = true;
    if (!$('sourceSound').checked) {
        sourceAudio.pause();
        return;
    }
    sourceAudio.playbackRate = sourceVideo.playbackRate;
    if (Math.abs(sourceAudio.currentTime - sourceVideo.currentTime) > .08)
        sourceAudio.currentTime = sourceVideo.currentTime;
    if (!sourceVideo.paused)
        sourceAudio.play().catch(() => { $('sourceStatus').textContent = '该副本没有可用独立音轨；视频仍可复看。'; });
}
sourceVideo.addEventListener('play', syncSourceAudio);
sourceVideo.addEventListener('seeked', syncSourceAudio);
sourceVideo.addEventListener('ratechange', syncSourceAudio);
sourceVideo.addEventListener('pause', () => sourceAudio.pause());
sourceVideo.addEventListener('timeupdate', () => {
    $('sourceTime').textContent = sourceVideo.currentTime.toFixed(2) + 's';
    if (sourceWindow && sourceVideo.currentTime >= sourceWindow.end && !sourceVideo.paused) {
        sourceVideo.pause();
    }
    else if (!sourceVideo.paused)
        syncSourceAudio();
});
$('sourceSound').onchange = syncSourceAudio;
$('sourceReplay').onclick = () => {
    if (!sourceWindow)
        return;
    sourceVideo.currentTime = sourceWindow.start;
    sourceVideo.play().catch(() => { });
};
$('sourceDialog').addEventListener('close', () => { sourceVideo.pause(); sourceAudio.pause(); });
function markdown(text, base) {
    let code = false, table = false;
    const output = [];
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        if (line.startsWith('```')) {
            if (table) {
                output.push('</tbody></table>');
                table = false;
            }
            code = !code;
            output.push(code ? '<pre>' : '</pre>');
            continue;
        }
        if (code) {
            output.push(escapeHTML(line) + '\n');
            continue;
        }
        const inline = x => escapeHTML(x).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, a, url) => {
            let target;
            try {
                target = new URL(url, base);
            }
            catch {
                return a;
            }
            return /^(https?:)$/.test(target.protocol) ? `<a href="${escapeHTML(target.href)}" target="_blank" rel="noopener">${a}</a>` : a;
        }).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        if (line.trim().startsWith('|')) {
            if (!table) {
                output.push('<table><tbody>');
                table = true;
            }
            if (/^\s*\|[ :|\-]+\|\s*$/.test(line))
                continue;
            output.push('<tr>' + line.split('|').slice(1, -1).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
            continue;
        }
        if (table) {
            output.push('</tbody></table>');
            table = false;
        }
        const h = /^(#{1,3}) (.*)$/.exec(line);
        if (h)
            output.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
        else if (line.trim())
            output.push('<p>' + inline(line) + '</p>');
    }
    if (table)
        output.push('</tbody></table>');
    if (code)
        output.push('</pre>');
    return output.join('');
}
async function showStudy(url, title) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            throw Error('记录未就绪');
        $('studyTitle').textContent = title;
        $('studyContent').innerHTML = markdown(await response.text(), new URL(url, location.href));
        $('studyDialog').showModal();
    }
    catch (e) {
        toast(e.message);
    }
}
$('moduleGuide').onclick = () => showStudy('../guides/' + current.module + '.md', LABELS[current.module]);
$('scriptGuide').onclick = () => showStudy('../guides/script.md', '文案与剪辑：把一件事讲明白');
$('typeGuide').onclick = () => showStudy('../guides/type-color.md', '文字、可视化与配色');
$('cameraResearch').onclick = () => showStudy('../studies/camera-moves.md', '穿梭机、变焦与时间运镜');
$('guideButton').onclick = () => showStudy('../使用说明.md', '模块指南与接入方法');
$('prevFrame').onclick = () => { setPlaying(false); t = Math.max(0, t - 1 / 30); draw(); };
$('nextFrame').onclick = () => { setPlaying(false); t = Math.min(current.duration, t + 1 / 30); draw(); };
$('playButton').onclick = () => setPlaying(!playing);
$('restartButton').onclick = () => {
    t = 0;
    draw();
    if (playing && soundOn)
        scheduleSound();
};
$('timeline').oninput = () => { t = Number($('timeline').value); draw(); sound.stop(); };
$('timeline').onchange = () => {
    if (playing && soundOn)
        scheduleSound();
};
$('speed').onchange = () => {
    if (playing && soundOn)
        scheduleSound();
};
$('palette').onchange = () => { draw(); cardGrid(); updateSavedOptions(); };
$('intensity').oninput = () => { $('intensityLabel').textContent = Math.round(Number($('intensity').value) * 100) + '%'; draw(); updateSavedOptions(); };
$('intensity').onchange = cardGrid;
function updateSavedOptions() {
    const s = saved.find(x => x.id === current.id);
    if (s) {
        s.options = options();
        persist();
    }
}
$('compareButton').onclick = () => { compare = !compare; $('stages').classList.toggle('comparing', compare); $('compareField').hidden = !compare; $('compareButton').setAttribute('aria-pressed', String(compare)); $('compareButton').textContent = compare ? '退出比较' : '并排比较'; updateTags(); draw(); };
for (const c of candidates) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = LABELS[c.module] + ' / ' + c.title;
    $('compareSelect').append(o);
}
$('compareSelect').onchange = () => { other = candidates.find(c => c.id === $('compareSelect').value); updateTags(); draw(); };
$('saveButton').onclick = () => {
    if (saved.some(s => s.id === current.id))
        saved = saved.filter(s => s.id !== current.id);
    else
        saved.push(selectedRecord(current));
    persist();
    cardGrid();
};
$('referencesButton').onclick = () => openReferences();
$('recipeButton').onclick = () => copy(instruction([selectedRecord(current)]));
$('codeButton').onclick = async () => {
    try {
        const url = sourcePath(current), r = await fetch(url);
        if (!r.ok)
            throw Error('HTTP ' + r.status);
        sourceCode = await r.text();
        $('codeContent').textContent = sourceCode;
        $('codeTitle').textContent = LABELS[current.module] + ' · ' + url.split('/').pop();
        $('downloadCode').href = url;
        $('codeDialog').showModal();
    }
    catch (e) {
        toast('代码未载入：' + e.message);
    }
};
$('copyCodeButton').onclick = () => copy(sourceCode);
$('frameButton').onclick = () => { const a = document.createElement('a'); a.download = current.id + '-' + t.toFixed(2) + 's.png'; a.href = $('stageA').toDataURL('image/png'); a.click(); };
function renderSelection() {
    $('selectedList').replaceChildren();
    if (!saved.length) {
        $('selectedList').innerHTML = '<p class="empty-selection">还没有选用方案。关闭后选择喜欢的动作，点击「加入选用清单」。</p>';
        return;
    }
    for (const s of saved) {
        const el = document.createElement('div');
        el.className = 'selection-item';
        el.innerHTML = `<div><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(LABELS[s.module])} · ${escapeHTML(s.options.palette)} · 幅度 ${Math.round(s.options.intensity * 100)}%</p></div>`;
        const b = document.createElement('button');
        b.className = 'quiet';
        b.textContent = '移除';
        b.onclick = () => { saved = saved.filter(x => x.id !== s.id); persist(); cardGrid(); renderSelection(); };
        el.append(b);
        $('selectedList').append(el);
    }
}
$('exportButton').onclick = () => { renderSelection(); $('selectionDialog').showModal(); };
$('downloadSelection').onclick = () => {
    if (!saved.length) {
        toast('先选择至少一种方案');
        return;
    }
    download(JSON.stringify({ schemaVersion: 1, skill: 'rainbow-motion-story', items: saved }, null, 2), 'rainbow-镜头选用清单.json');
};
$('copySelection').onclick = () => {
    if (!saved.length) {
        toast('先选择至少一种方案');
        return;
    }
    copy(instruction(saved));
};
$('soundButton').onclick = async () => {
    if (!soundOn) {
        try {
            await sound.enable();
            soundOn = true;
        }
        catch (e) {
            toast('声音未启用：' + e.message);
            return;
        }
    }
    else {
        soundOn = false;
        sound.stop();
    }
    $('soundButton').textContent = soundOn ? '● 关闭原创节奏音效' : '○ 试听原创节奏音效';
    $('soundButton').setAttribute('aria-pressed', String(soundOn));
    if (soundOn) {
        toast('播放原创合成动作提示音，不含参考音乐');
        if (playing)
            scheduleSound();
        else
            setPlaying(true);
    }
};
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            d.close();
    }
}));
document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(document.activeElement.tagName))
        return;
    if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(!playing);
    }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        t = Math.min(current.duration, Math.max(0, t + (e.code === 'ArrowRight' ? 1 : -1) / 30));
        draw();
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        setPlaying(false);
});
window.styleLab = { candidates, select: id => select(candidates.find(c => c.id === id)), seek: seconds => { setPlaying(false); t = Math.max(0, Math.min(seconds, current.duration)); draw(); }, getState: () => ({ id: current.id, module, t, playing, compare, other: other.id, saved, options: options() }), setPlaying };
try {
    const r = await fetch('./references.json');
    if (r.ok) {
        const data = await r.json();
        references = Array.isArray(data) ? data : data.references;
        $('referencesButton').textContent = `${references.length} 条参考研究`;
    }
}
catch { }
$('inventory').textContent = `${MODULES.length} 个模块 / ${candidates.length} 个可运行候选`;
select(candidates.find(c => c.id === location.hash.slice(1)) || current);
window.addEventListener('hashchange', () => {
    const next = candidates.find(c => c.id === location.hash.slice(1));
    if (next && next.id !== current.id) {
        setPlaying(false);
        select(next);
    }
});
requestAnimationFrame(tick);
