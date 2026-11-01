"""Motion-vs-audio alignment + easing extraction for the 15 s motion-design piece."""
import json, numpy as np, cv2, librosa, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base = 'D:/Claude Project/video_project/research/douyin-motion-study/'
tag = 'v1_jun_emotion_motion'
vid = base + 'videos/' + tag + '.mp4'

# --- per-frame motion, centroid & bbox of the moving "ink" ---
cap = cv2.VideoCapture(vid)
fps = cap.get(cv2.CAP_PROP_FPS)
energies, centroids, bboxs, lum, i = [], [], [], [], 0
prev = None
while True:
    ok, f = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(cv2.resize(f, (320, 180)), cv2.COLOR_BGR2GRAY).astype(np.float32)
    lum.append(float(g.mean()))
    if prev is not None:
        d = np.abs(g - prev)
        energies.append(float(d.mean()))
        m = (g > 70).astype(np.uint8)  # non-black content
        ys, xs = np.nonzero(m)
        if len(xs) > 40:
            centroids.append((float(xs.mean()), float(ys.mean())))
            bboxs.append((int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())))
        else:
            centroids.append(None); bboxs.append(None)
    else:
        energies.append(0.0); centroids.append(None); bboxs.append(None)
    prev = g; i += 1
cap.release()
t = np.arange(len(energies)) / fps
E = np.array(energies)
# object speed from centroid delta (px/s, at 320x180 scale)
spd = np.zeros_like(E)
for k in range(1, len(centroids)):
    a, b = centroids[k - 1], centroids[k]
    if a and b:
        spd[k] = np.hypot(b[0] - a[0], b[1] - a[1]) * fps
    else:
        spd[k] = np.nan

# --- audio ---
y, sr = librosa.load(base + 'audio/' + tag + '.44k.wav', sr=22050)
hop = 256
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tt = librosa.frames_to_time(np.arange(len(env)), sr=sr, hop_length=hop)
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
onset_t = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='time', delta=0.05, wait=2)

# align audio envelope to video frame grid, find lag maximizing correlation
env_on_video = np.interp(t, tt, env)
Eo = E - E.mean(); Eo /= (np.linalg.norm(Eo) + 1e-9)
best = (-1, 0)
for lag in range(-8, 9):
    shifted = np.roll(env_on_video, lag)
    c = float(np.dot(Eo, (shifted - shifted.mean()) / (np.linalg.norm(shifted - shifted.mean()) + 1e-9)))
    if c > best[0]:
        best = (c, lag)
corr, lag = best

# peak detection on speed & energy to describe easing behaviour
def peaks(x, thr_ratio=0.35):
    x = np.nan_to_num(x)
    if x.max() <= 0:
        return []
    th = x.max() * thr_ratio
    out = []
    for k in range(1, len(x) - 1):
        if x[k] > th and x[k] >= x[k - 1] and x[k] >= x[k + 1]:
            if not out or k - out[-1] > int(0.25 * fps):
                out.append(k)
    return out
energy_peaks = [round(float(t[k]), 2) for k in peaks(E, 0.30)]
speed_peaks = [round(float(t[k]), 2) for k in peaks(spd, 0.30)]

# --- plots ---
fig, ax = plt.subplots(3, 1, figsize=(16, 11), sharex=True, gridspec_kw={'height_ratios': [2, 1.2, 1.2]})
ax[0].plot(t, E, lw=1.2, color='#2f6df6', label='frame difference (motion energy)')
ax[0].plot(t, np.nan_to_num(spd) / max(1e-6, np.nanmax(spd)) * np.nanmax(E) * 0.8, lw=1, color='#e2703a', alpha=.8, label='ink centroid speed px/s (scaled)')
ax[0].plot(t, lum, lw=.8, color='#999', alpha=.7, label='mean luma')
for c in [11.03, 11.53, 12.03, 12.53, 13.03]:
    ax[0].axvline(c, color='k', ls=':', lw=.8)
ax[0].legend(loc='upper left', fontsize=8); ax[0].set_ylabel('motion'); ax[0].set_title(f'{tag}  motion / speed / brightness  (dotted = colour-field cuts)')
ax[1].plot(tt, env, lw=.9, color='#1c8c5b', label='audio onset strength')
ax[1].plot(tt, rms / rms.max() * env.max(), lw=.8, color='#888', alpha=.7, label='rms (scaled)')
for o in onset_t:
    ax[1].axvline(o, color='#1c8c5b', alpha=.25, lw=.6)
ax[1].legend(fontsize=8); ax[1].set_ylabel('audio')
ax[2].plot(t, E, lw=1, color='#2f6df6', label='motion')
ax[2].plot(t, env_on_video / env.max() * E.max(), lw=1, color='#1c8c5b', alpha=.8, label='audio onset (on video grid)')
ax[2].set_ylabel('aligned'); ax[2].set_xlabel('seconds'); ax[2].legend(fontsize=8)
ax[2].set_xlim(0, len(E) / fps)
plt.tight_layout(); plt.savefig(base + 'analysis/v1/v1-motion-audio.png', dpi=110)

# spectrogram (0-8 s and 8-15 s separately for resolution)
for a, b in [(0, 4), (4, 8), (8, 11), (11, 15.1)]:
    y0, y1 = int(a * sr), int(b * sr)
    seg = y[y0:y1]
    fig, axs = plt.subplots(1, 1, figsize=(14, 3.4))
    S = librosa.amplitude_to_db(np.abs(librosa.stft(seg, n_fft=2048, hop_length=256)), ref=np.max)
    librosa.display.specshow(S, sr=sr, hop_length=256, x_axis='time', y_axis='log', ax=axs, cmap='magma')
    axs.set_title(f'{tag} spectrogram {a}-{b}s'); axs.set_xlim(0, b - a)
    plt.tight_layout(); plt.savefig(base + f'analysis/v1/v1-spec-{a:g}-{b:g}.png', dpi=100)
    plt.close(fig)

json.dump({'fps': fps, 'energy_peaks': energy_peaks, 'speed_peaks': speed_peaks,
           'audio_video_corr': round(corr, 3), 'best_lag_frames': lag,
           'audio_onsets': [round(float(o), 2) for o in onset_t]},
          open(base + 'analysis/v1/v1-sync.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({'corr': round(corr, 3), 'lag_frames': lag, 'energy_peaks': energy_peaks,
                  'speed_peaks': speed_peaks, 'onsets': len(onset_t)}, ensure_ascii=False))
