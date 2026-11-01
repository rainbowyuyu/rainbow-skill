"""Reproducible stereo mixed-track measurements; not beat/SFX classification.

The decoded audio origin, rather than the first compressed packet, anchors
measurements. Encoder skip-sample metadata is recorded but never applied twice.
"""
from pathlib import Path
import argparse
import json
import subprocess

import numpy as np
from scipy.signal import stft, find_peaks, resample_poly, correlate
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from audio_analyze import sha256

ROOT = Path(__file__).resolve().parents[1]


def probe(path, *args):
    return json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', *args, '-of', 'json', str(path)], encoding='utf-8'))


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def spans(mask, step, origin, minimum):
    out, start = [], None
    for i, state in enumerate([*mask, False]):
        if state and start is None:
            start = i
        elif not state and start is not None:
            if (i-start)*step >= minimum-1e-8:
                out.append({'start': round(origin+start*step, 4),
                            'end': round(origin+i*step, 4), 'duration': round((i-start)*step, 4)})
            start = None
    return out


def periodicity(values, hop=.01):
    """Return competing autocorrelation peaks, never one declared BPM."""
    values = np.maximum(values-np.median(values), 0)
    if len(values) < 200 or np.sum(values**2) < 1e-14:
        return []
    ac = correlate(values, values, mode='full', method='fft')[len(values)-1:]
    ac /= max(ac[0], 1e-15)
    lo, hi = round(.25/hop), min(len(ac)-1, round(1.5/hop))
    indexes, _ = find_peaks(ac[lo:hi+1], distance=8)
    indexes = sorted(indexes+lo, key=lambda i: ac[i], reverse=True)[:5]
    return [{'lagSeconds': round(float(i*hop), 3),
             'equivalentCyclesPerMinute': round(60/(i*hop), 2),
             'normalizedAutocorrelation': round(float(ac[i]), 4)} for i in indexes]


def plot(path, times, rms_t, rms, flux, peaks, bands, density, lo, hi):
    fig, axes = plt.subplots(4, 1, figsize=(15, 9), sharex=True,
                             gridspec_kw={'height_ratios': [1, 1.2, .8, 1.3]})
    axes[0].plot(rms_t, rms, color='#278b9a', lw=1.1)
    axes[0].axhline(-45, color='#909090', ls='--', lw=.6)
    axes[0].set(ylabel='Stereo RMS\ndBFS', ylim=(-65, 0))
    axes[1].plot(times, flux, color='#31446a', lw=.8)
    axes[1].scatter(times[peaks], flux[peaks], s=13, color='#cd663b')
    axes[1].set(ylabel='Positive log\nspectral flux')
    axes[2].plot(times, density, color='#af5c74', lw=1.2)
    axes[2].set(ylabel='Candidates\nper 1 s window')
    for name, arr in bands.items():
        axes[3].plot(times, arr, label=name, lw=1)
    axes[3].legend(ncol=4, loc='upper right', fontsize=8)
    axes[3].set(ylabel='Band power\nrelative dB', xlabel='Seconds from first decoded video frame')
    axes[3].set_xlim(lo, hi)
    for ax in axes:
        ax.grid(alpha=.15)
    fig.suptitle('syy reference: mixed-track measurements, not isolated music / speech / SFX', fontsize=13)
    fig.tight_layout()
    fig.savefig(path, dpi=145)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path, default=ROOT/'work/syy-rhythm/reference-video.mp4')
    parser.add_argument('--audio', type=Path, help='Optional separate original audio track')
    parser.add_argument('--out', type=Path, default=ROOT/'evidence/syy-rhythm/signal')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    audio = args.audio or args.video
    vm = probe(args.video, '-show_streams', '-show_format')
    am = vm if audio == args.video else probe(audio, '-show_streams', '-show_format')
    ast = next(s for s in am['streams'] if s['codec_type'] == 'audio')
    rate = int(ast['sample_rate'])
    audio_frames = probe(audio, '-select_streams', 'a:0', '-show_frames',
                         '-show_entries', 'frame=pts,pts_time,best_effort_timestamp_time,nb_samples')['frames']
    video_frames = probe(args.video, '-select_streams', 'v:0', '-read_intervals', '0%+1',
                         '-show_frames', '-show_entries', 'frame=pts,pts_time,best_effort_timestamp_time')['frames']
    first_audio_pts = float(audio_frames[0]['best_effort_timestamp_time'])
    first_video_pts = float(video_frames[0]['best_effort_timestamp_time'])
    offset = first_audio_pts-first_video_pts
    packets = probe(audio, '-select_streams', 'a:0', '-read_intervals', '0%+0.5',
                    '-show_packets', '-show_entries', 'packet=pts,pts_time,duration_time,side_data_list')
    pcm = np.frombuffer(subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(audio), '-map', '0:a:0',
        '-ac', '2', '-ar', str(rate), '-f', 'f32le', 'pipe:1']), dtype='<f4').reshape(-1, 2)
    jumps = []
    for a, b in zip(audio_frames, audio_frames[1:]):
        expected = float(a['best_effort_timestamp_time'])+int(a['nb_samples'])/rate
        actual = float(b['best_effort_timestamp_time'])
        if abs(actual-expected) > max(2/rate, 1e-5):
            jumps.append({'expected': expected, 'actual': actual, 'difference': actual-expected})
    if jumps:
        save(args.out/'timestamp-discontinuities.json', jumps)
        raise ValueError('Audio discontinuities require piecewise PTS mapping; see timestamp-discontinuities.json')
    samples = sum(int(f['nb_samples']) for f in audio_frames)
    if samples != len(pcm):
        raise ValueError(f'Decoded sample mismatch: ffprobe={samples}, ffmpeg={len(pcm)}')
    energy = np.mean(pcm.astype(np.float64)**2, axis=1)
    duration = len(pcm)/rate
    rms_results = {}
    for ms in (10, 100, 500):
        n = round(rate*ms/1000)
        blocks = len(energy)//n
        rms = np.sqrt(energy[:blocks*n].reshape(blocks, n).mean(axis=1))
        rms_results[ms] = (offset+(np.arange(blocks)+.5)*n/rate,
                           20*np.log10(np.maximum(rms, 1e-10)))
    decimated = resample_poly(pcm, 16000//np.gcd(rate, 16000), rate//np.gcd(rate, 16000), axis=0)
    frequencies, st, z = stft(decimated.T, fs=16000, nperseg=1024, noverlap=864,
                              boundary=None, padded=False, axis=-1)
    power = np.mean(np.abs(z)**2, axis=0)
    mag = np.sqrt(power)
    flux = np.maximum(np.diff(np.log1p(50*mag), axis=1), 0).mean(axis=0)
    times = st[1:]+offset
    mad = np.median(np.abs(flux-np.median(flux)))
    peaks_by_threshold = {}
    for q in (75, 80, 90):
        pk, _ = find_peaks(flux, height=np.percentile(flux, q),
                           prominence=max(.8*mad, 1e-8), distance=15)
        peaks_by_threshold[q] = pk
    peaks = peaks_by_threshold[80]
    events = [{'id': f'mix-{i+1:03d}', 'time': round(float(times[k]), 4),
               'flux': round(float(flux[k]), 7)} for i, k in enumerate(peaks)]
    bands = {}
    for low, high in ((40, 250), (250, 1000), (1000, 4000), (4000, 7900)):
        ix = (frequencies >= low) & (frequencies < high)
        bands[f'{low}-{high} Hz'] = 10*np.log10(np.maximum(power[ix, 1:].sum(axis=0), 1e-15))
    density = np.array([np.sum((times[peaks] >= t-.5) & (times[peaks] < t+.5)) for t in times])
    relative_threshold = float(np.percentile(rms_results[100][1], 25))
    quiet = spans(rms_results[10][1] < -45, .01, offset, .25)
    relative = spans(rms_results[100][1] < relative_threshold, .1, offset, .3)
    summaries = []
    lo = 0.
    while lo < duration+offset:
        hi = min(lo+12, duration+offset)
        ix = (times >= lo) & (times < hi)
        rx = (rms_results[100][0] >= lo) & (rms_results[100][0] < hi)
        summaries.append({'start': lo, 'end': round(hi, 4),
                          'candidateCount': sum(lo <= e['time'] < hi for e in events),
                          'medianStereoRmsDbfs': round(float(np.median(rms_results[100][1][rx])), 2),
                          'periodicityCandidates': periodicity(flux[ix]),
                          'medianBandPowerRelativeDb': {k: round(float(np.median(v[ix])), 2) for k, v in bands.items()}})
        plot(args.out/f'window-{int(lo):03d}-{int(np.ceil(hi)):03d}.png', times,
             *rms_results[100], flux, peaks, bands, density, lo, hi)
        lo += 12
    save(args.out/'source-timing.json', {
        'video': str(args.video.resolve()), 'videoSha256': sha256(args.video),
        'audio': str(audio.resolve()), 'audioSha256': sha256(audio),
        'videoProbe': vm, 'audioProbe': am, 'firstAudioPackets': packets,
        'firstDecodedAudioFrames': audio_frames[:3], 'firstDecodedVideoFrames': video_frames[:3],
        'audioFirstDecodedPts': first_audio_pts, 'videoFirstDecodedPts': first_video_pts,
        'audioOriginOnVideoAxisSeconds': offset,
        'timestampMapping': 'video_axis_seconds = analysis_sample_index / native_rate + first_decoded_audio_PTS - first_decoded_video_PTS',
        'manualEncoderDelayCompensationSeconds': 0,
        'encoderDelayRule': 'Codec skip samples are handled by the decoder. No second manual compensation.',
        'nativeSampleRate': rate, 'decodedSamplesPerChannel': len(pcm),
        'ffprobeSamplesMatchDecode': samples == len(pcm), 'audioTimestampDiscontinuities': jumps,
        'decodedDurationSeconds': duration, 'subjectiveListening': False})
    save(args.out/'timeline.json', {
        'timeAxis': 'Seconds from first decoded video frame',
        'sourceVideoSha256': sha256(args.video), 'sourceAudioSha256': sha256(audio),
        'method': {'stereo': 'mean channel power, no phase-cancelling mono downmix',
                   'rmsWindowsMs': [10, 100, 500], 'spectralRate': 16000,
                   'spectralWindowSeconds': .064, 'spectralHopSeconds': .01,
                   'eventTime': 'Centre of the later STFT window, not an exact acoustic onset',
                   'flux': 'Mean positive delta of log1p(50 * sqrt(mean L/R STFT power))',
                   'candidateRule': 'global 80th percentile, prominence >=0.8*MAD, separation >=150ms',
                   'periodicity': 'Biased normalized autocorrelation of nonnegative flux above its median; 0.25-1.5s lags; competing peaks retained',
                   'limits': 'Mixed music, speech and effects. Candidates are not labelled beats/SFX. Periodicity is not a musical BPM estimate. No subjective listening performed.'},
        'candidates': events,
        'thresholdSensitivity': {str(q): {'count': len(pks), 'threshold': float(np.percentile(flux, q))} for q, pks in peaks_by_threshold.items()},
        'stereoRms100ms': [{'time': round(float(t), 4), 'dbfs': round(float(v), 3)} for t, v in zip(*rms_results[100])],
        'absoluteLowEnergyWindows': {'thresholdDbfs': -45, 'minimumDuration': .25, 'intervals': quiet},
        'relativeLowEnergyWindows': {'thresholdDbfs': relative_threshold, 'percentile': 25, 'minimumDuration': .3, 'intervals': relative},
        'periodicityCandidatesWholeTrack': periodicity(flux), 'windowSummaries': summaries})
    save(args.out/'metrics.json', {
        'duration': duration, 'peakAbsoluteSample': float(np.max(np.abs(pcm))),
        'wholeStereoRmsDbfs': float(10*np.log10(energy.mean())),
        'wholeMonoDownmixRmsDbfs': float(10*np.log10(np.mean(np.mean(pcm.astype(np.float64), axis=1)**2))),
        'candidateCount': len(events), 'absoluteLowEnergyWindowCount': len(quiet),
        'relativeLowEnergyThresholdDbfs': relative_threshold,
        'interpretation': 'Sample peak and RMS only; neither integrated LUFS nor true peak.'})
    plot(args.out/'overview.png', times, *rms_results[100], flux, peaks, bands, density, 0, duration+offset)
    fig, ax = plt.subplots(figsize=(15, 4.5))
    raster = 10*np.log10(np.maximum(power, 1e-15))
    im = ax.pcolormesh(st+offset, frequencies, raster, shading='auto', cmap='magma',
                       vmin=np.percentile(raster, 15), vmax=np.percentile(raster, 99.5), rasterized=True)
    ax.set_ylim(40, 7900)
    ax.set_yscale('log')
    ax.set(xlabel='Seconds from first decoded video frame', ylabel='Frequency (Hz)',
           title='Mixed-track stereo-power spectrogram: speech, music and effects are not separated')
    fig.colorbar(im, ax=ax, label='STFT power, relative dB')
    fig.tight_layout()
    fig.savefig(args.out/'spectrogram.png', dpi=145)
    plt.close(fig)
    print(json.dumps({'output': str(args.out.resolve()), 'duration': duration, 'candidates': len(events),
                      'audioOriginOnVideoAxisSeconds': offset, 'decodedSamplesMatch': samples == len(pcm)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
