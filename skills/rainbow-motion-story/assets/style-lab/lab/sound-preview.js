// Original, deterministic sounds. No reference samples or copied soundtrack.
// The visual timeline is the master clock; WebAudio is a preview scheduler.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export function seededNoise(length, seed = 171) {
    const a = new Float32Array(length);
    let s = seed >>> 0;
    for (let i = 0; i < length; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        a[i] = (s / 4294967296) * 2 - 1;
    }
    return a;
}
export function cuePlan(module, duration = 10, recipe = '') {
    const base = { storytelling: [[.12, 'air'], [.28, 'tap'], [.56, 'tick'], [.78, 'resolve']], rhythm: [[.1, 'air'], [.22, 'tap'], [.34, 'tick'], [.46, 'air'], [.6, 'tap'], [.69, 'tick'], [.76, 'tap'], [.84, 'resolve']], camera: [[.12, 'air'], [.48, 'air'], [.79, 'resolve']], mechanics: [[.12, 'tap'], [.26, 'tick'], [.4, 'tick'], [.58, 'resolve'], [.78, 'air']], visualization: [[.16, 'tick'], [.34, 'tick'], [.52, 'tap'], [.76, 'resolve']], look: [[.15, 'air'], [.5, 'tap'], [.78, 'resolve']] };
    const recipes = {
        'rhythm-phrase-envelope': [[.13, 'air'], [.25, 'tap'], [.39, 'air'], [.55, 'resolve'], [.73, 'air']],
        'rhythm-explanation-hold': [[.08, 'air'], [.22, 'tap'], [.79, 'air'], [.94, 'resolve']],
        'rhythm-state-relay': [[.15, 'air'], [.22, 'tick'], [.29, 'tick'], [.35, 'tick'], [.40, 'tick'], [.45, 'tick'], [.52, 'tap'], [.66, 'resolve']],
        'rhythm-braid-settle': [[.10, 'air'], [.19, 'tick'], [.24, 'tick'], [.27, 'tap'], [.34, 'air'], [.42, 'tap'], [.52, 'air'], [.69, 'resolve']]
    };
    return (recipes[recipe] || base[module] || base.camera).map(([p, kind], i) => ({ time: p * duration, kind, gain: kind === 'air' ? .055 : kind === 'tick' ? .032 : .065, duration: kind === 'air' ? .7 : kind === 'resolve' ? 1.1 : kind === 'tick' ? .11 : .24, seed: 171 + i * 31 }));
}
/** Small deterministic PCM unit, reusable in WebAudio or an offline renderer. */
export function synthesizeCue(kind, sampleRate = 48000, duration = .5, seed = 171) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
        throw Error('Unsupported sample rate');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 10)
        throw Error('Cue duration must be in (0,10] seconds');
    const n = Math.max(2, Math.round(sampleRate * duration)), a = new Float32Array(n), noise = seededNoise(n, seed);
    let low = 0, high = 0;
    for (let i = 0; i < n; i++) {
        const t = i / sampleRate, p = i / (n - 1), edge = smooth(t / .012) * smooth((duration - t) / .035);
        let value = 0;
        if (kind === 'air') {
            const hz = 450 + 2100 * Math.sin(Math.PI * p) ** 2, k = 1 - Math.exp(-2 * Math.PI * hz / sampleRate);
            low += k * (noise[i] - low);
            high += .018 * (low - high);
            value = (low - high) * Math.sin(Math.PI * p) ** 2 * .8;
        }
        else if (kind === 'resolve') {
            value = (Math.sin(2 * Math.PI * 220 * t) + .52 * Math.sin(2 * Math.PI * 330 * t) + .23 * Math.sin(2 * Math.PI * 440 * t)) * .28 * Math.exp(-2.2 * p) * smooth(p / .12);
        }
        else if (kind === 'tick') {
            value = (Math.sin(2 * Math.PI * 920 * t) + .3 * Math.sin(2 * Math.PI * 1470 * t)) * .42 * Math.exp(-11 * p);
        }
        else {
            const phase = 2 * Math.PI * 160 * duration * (1 - Math.exp(-3 * p)) / 3;
            value = (Math.sin(phase) + .2 * Math.sin(2.1 * phase)) * .5 * Math.exp(-6 * p);
        }
        a[i] = value * edge;
    }
    a[0] = a[n - 1] = 0;
    return a;
}
/** Gain for voice windows: preduck, hold through words, then slow release. */
export function speechDucking(time, windows = [], { floorDb = -13, pre = .45, release = .85 } = {}) {
    let amount = 0;
    for (const [start, end] of windows) {
        const enter = smooth((time - (start - pre)) / Math.max(pre, .001));
        const leave = 1 - smooth((time - end) / Math.max(release, .001));
        amount = Math.max(amount, enter * leave);
    }
    return 10 ** (floorDb * amount / 20);
}
export function createSoundPreview() {
    let ac, master, active = null;
    async function enable() {
        ac ??= new (window.AudioContext || window.webkitAudioContext)();
        if (!master) {
            master = ac.createGain();
            master.gain.value = .7;
            master.connect(ac.destination);
        }
        await ac.resume();
    }
    function stop() {
        if (!active || !ac)
            return;
        const old = active;
        active = null;
        const at = ac.currentTime;
        old.gain.gain.cancelAndHoldAtTime?.(at);
        old.gain.gain.setTargetAtTime(0, at, .006);
        for (const source of old.sources)
            try {
                source.stop(at + .035);
            }
            catch { }
        setTimeout(() => {
            for (const source of old.sources)
                try {
                    source.disconnect();
                }
                catch { }
            old.gain.disconnect();
        }, 65);
    }
    function play({ from = 0, duration = 10, speed = 1, module = 'camera', recipe = '', speechWindows = [] } = {}) {
        if (!ac)
            return;
        stop();
        if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(duration) || duration <= 0)
            return;
        const batch = { gain: ac.createGain(), sources: [] };
        active = batch;
        batch.gain.gain.setValueAtTime(0, ac.currentTime);
        batch.gain.gain.linearRampToValueAtTime(1, ac.currentTime + .018);
        batch.gain.connect(master);
        for (const cue of cuePlan(module, duration, recipe)) {
            if (cue.time < from || cue.time >= duration)
                continue;
            const d = Math.min(cue.duration / speed, (duration - cue.time) / speed), pcm = synthesizeCue(cue.kind, ac.sampleRate, d, cue.seed), b = ac.createBuffer(1, pcm.length, ac.sampleRate);
            b.copyToChannel(pcm, 0);
            const source = ac.createBufferSource(), gain = ac.createGain();
            source.buffer = b;
            source.connect(gain);
            gain.connect(batch.gain);
            const at = ac.currentTime + .04 + (cue.time - from) / speed;
            const curve = new Float32Array(96);
            for (let j = 0; j < 96; j++)
                curve[j] = cue.gain * speechDucking(cue.time + d * speed * j / 95, speechWindows);
            gain.gain.setValueCurveAtTime(curve, at, d);
            source.start(at);
            batch.sources.push(source);
            source.onended = () => {
                source.disconnect();
                gain.disconnect();
                batch.sources = batch.sources.filter(x => x !== source);
                if (!batch.sources.length && batch !== active)
                    batch.gain.disconnect();
            };
        }
    }
    return { enable, stop, play };
}
