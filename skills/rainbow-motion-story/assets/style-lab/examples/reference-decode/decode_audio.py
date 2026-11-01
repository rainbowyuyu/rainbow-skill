"""Audio and audiovisual-sync metrics: loudness, onsets, onset-class fingerprints, silence, spectral bed."""
import sys, json, os
import numpy as np, librosa, soundfile as sf

wav, outdir, tag = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
y, sr = librosa.load(wav, sr=22050, mono=True)
dur = len(y) / sr
hop = 512
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
rms_db = librosa.amplitude_to_db(rms, ref=np.max)
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop,
                                    backtrack=False, units='time', delta=0.05, wait=3)
# percussion-like (sharp broadband) vs tonal: spectral flatness at onset
S = np.abs(librosa.stft(y, hop_length=hop, n_fft=1024))
flat = librosa.feature.spectral_flatness(S=S)[0]
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
f_t = librosa.frames_to_time(np.arange(len(flat)), sr=sr, hop_length=hop)
events = []
for on in onsets:
    k = int(np.argmin(np.abs(f_t - on)))
    env_peak = float(onset_env[k])
    # rise over 120ms before the onset
    k0 = max(0, k - 5)
    rise = float(onset_env[k] - np.min(onset_env[k0:k + 1]))
    events.append({'t': round(float(on), 3), 'strength': round(env_peak, 2), 'rise': round(rise, 2),
                   'flatness': round(float(flat[k]), 3), 'centroid': round(float(cent[k]) if np.isfinite(cent[k]) else 0, 0),
                   'kind': 'noise' if flat[k] > 0.02 else 'tonal'})
# silence map
sil = rms_db < -38
silences, start = [], None
for k, s in enumerate(sil):
    if s and start is None:
        start = float(t_rms[k])
    elif not s and start is not None:
        if float(t_rms[k]) - start > 0.25:
            silences.append([round(start, 2), round(float(t_rms[k]), 2)])
        start = None
if start is not None:
    silences.append([round(start, 2), round(float(t_rms[-1]), 2)])
# harmonic (music-ish bed) vs percussive energy
yh, yp = librosa.effects.hpss(y)
h_ratio = float(np.mean(np.abs(yh)) / (np.mean(np.abs(yp)) + 1e-9))
tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0]
json.dump({'dur': round(dur, 2), 'onsets': events, 'silences': silences, 'silence_ratio': round(float(sil.mean()), 3),
           'harmonic_to_percussive': round(h_ratio, 2), 'tempo': round(float(tempo), 1),
           'rms_db_curve': [[round(float(a), 3), round(float(b), 1)] for a, b in zip(t_rms[::4], rms_db[::4])]},
          open(os.path.join(outdir, f'{tag}-audio.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(json.dumps({'tag': tag, 'dur': round(dur, 2), 'onsets': len(events), 'noise': sum(e['kind'] == 'noise' for e in events),
                  'silence_ratio': round(float(sil.mean()), 3), 'h/p': round(h_ratio, 2), 'tempo': round(float(tempo), 1)}))
