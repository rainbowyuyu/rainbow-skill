"""Reproducible mixed-track signal study; no source separation or listening.

Reuse the existing audio_analyze.py hash helper and its positive log-spectral
flux method. Preserve stereo power instead of downmixing, and use one global
threshold when comparing windows. Decode media only to memory.
"""
from pathlib import Path
import argparse
import json
import subprocess
import numpy as np
from scipy.signal import stft, find_peaks
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from audio_analyze import sha256

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parents[1]/'video_project/pid_embodied_control/work/v02/references/shuffle'
OUT = ROOT/'evidence/shuffle-rhythm'
WINDOWS = [(0., 12.), (42., 47.), (66., 75.), (94., 99.)]


def write(name, value):
    (OUT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def probe(source, *arguments):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', *arguments, '-of', 'json', str(source)], encoding='utf-8'))


def db(values):
    return 20*np.log10(np.maximum(values, 1e-10))


def intervals(mask, step, start=0., minimum=.25):
    spans, opened = [], None
    for index, enabled in enumerate([*mask, False]):
        if enabled and opened is None:
            opened = index
        elif not enabled and opened is not None:
            lo, hi = start + opened*step, start + index*step
            if hi-lo >= minimum-1e-9:
                spans.append({'start': round(lo, 4), 'end': round(hi, 4), 'duration': round(hi-lo, 4)})
            opened = None
    return spans


def clipped(spans, lo, hi, minimum=0.):
    result = []
    for span in spans:
        a, b = max(lo, span['start']), min(hi, span['end'])
        if b-a >= max(minimum, 1e-8):
            result.append({'start': round(a, 4), 'end': round(b, 4), 'duration': round(b-a, 4)})
    return result


def event_gaps(events, lo, hi, energy_times, energy_db):
    times = [lo] + [e['time'] for e in events if lo <= e['time'] < hi] + [hi]
    results = []
    for index, (a, b) in enumerate(zip(times, times[1:])):
        if b-a < .5:
            continue
        ix = (energy_times >= a) & (energy_times < b)
        results.append({'start': round(a, 4), 'end': round(b, 4), 'duration': round(b-a, 4),
                        'medianStereoRmsDbfs': round(float(np.median(energy_db[ix])), 3) if ix.any() else None,
                        'edgeCensored': index == 0 or index == len(times)-2,
                        'meaning': 'No detected mixed-track transient under this threshold; not silence or a visual hold.'})
    return sorted(results, key=lambda x: x['duration'], reverse=True)


def align_visual(path, events, rate):
    value = json.loads(path.read_text(encoding='utf-8'))
    records = value if isinstance(value, list) else value.get('events', [])
    if not isinstance(records, list):
        raise ValueError('Visual events must be a list or an object with an events list')
    output, excluded = [], []
    for item in records:
        if item.get('alignmentEligible') is False:
            excluded.append({'id': item.get('id'), 'kind': item.get('kind'), 'reason': 'Visual record excludes this from onset alignment; holds are not sound-onset candidates.'})
            continue
        lo = item.get('start', item.get('time'))
        if lo is None:
            lo = item.get('startFrame', item.get('frame'))
            if lo is not None:
                lo /= rate
        if lo is None:
            raise ValueError(f'No time in visual event: {item.get("id")}')
        hi = item.get('end', lo)
        if 'endFrame' in item and 'end' not in item:
            hi = item['endFrame']/rate
        center = (lo+hi)/2
        reference_time = item.get('time', center)
        nearest = min(events, key=lambda e: abs(e['time']-reference_time)) if events else None
        nearest_to_window = min(events, key=lambda e: (max(lo-e['time'], e['time']-hi, 0), abs(e['time']-reference_time))) if events else None
        output.append({**item, 'window': [lo, hi],
                       'referenceTimeSeconds': reference_time,
                       'referenceTimeMeaning': 'Visual event time if provided (first clearly visible state in current event table); otherwise bracket midpoint.',
                       'insideCandidates': [e for e in events if lo <= e['time'] <= hi],
                       'nearestCandidate': nearest,
                       'candidateMinusVisualReferenceSeconds': round(nearest['time']-reference_time, 4) if nearest else None,
                       'candidateMinusVisualCenterSeconds': round(nearest['time']-center, 4) if nearest else None,
                       'nearestReferenceCandidateDistanceToWindowSeconds': round(max(lo-nearest['time'], nearest['time']-hi, 0), 4) if nearest else None,
                       'nearestToWindowCandidate': nearest_to_window,
                       'minimumDistanceToVisualWindowSeconds': round(max(lo-nearest_to_window['time'], nearest_to_window['time']-hi, 0), 4) if nearest_to_window else None,
                       'interpretation': 'Temporal neighbor only. Mixed audio, 64ms spectral window, visual sample uncertainty retained; no authored synchronization claim.'})
    result = {'sourceVisualEvents': str(path), 'sourceVisualEventsSha256': sha256(path),
              'audioTimestampOffsetAppliedSeconds': 0, 'subjectiveListening': False,
              'spectralTimeResolutionSeconds': .01, 'spectralWindowSeconds': .064,
              'excludedVisualRecords': excluded,
              'events': output}
    write('visual-signal-alignment.json', result)
    return len(output)


def run(visual_events=None):
    OUT.mkdir(parents=True, exist_ok=True)
    video_path, audio_path = SOURCE_ROOT/'media-01.mp4', SOURCE_ROOT/'media-02.mp4'
    video_probe = probe(video_path, '-show_streams', '-show_format')
    audio_probe = probe(audio_path, '-show_streams', '-show_format')
    video = next(s for s in video_probe['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in audio_probe['streams'] if s['codec_type'] == 'audio')
    first_packet = probe(audio_path, '-read_intervals', '0%+0.5', '-show_packets', '-show_entries', 'packet=pts,pts_time,duration_time,side_data_list')['packets'][0]
    first_audio_frames = probe(audio_path, '-read_intervals', '0%+0.5', '-show_frames', '-show_entries', 'frame=pts,pts_time,best_effort_timestamp_time,nb_samples')['frames']
    first_video_frames = probe(video_path, '-read_intervals', '0%+0.2', '-show_frames', '-show_entries', 'frame=pts,pts_time,best_effort_timestamp_time')['frames']
    rate, channels = int(audio['sample_rate']), int(audio['channels'])
    assert channels == 2
    audio_hash, video_hash = sha256(audio_path), sha256(video_path)
    assert audio_hash == '0a5e2818c43350fe26b379ec2ed36f74a221bf4f9039ac1f7df1b13a12e6365d'
    assert video_hash == 'ebd452ef40bb4c1063f41ab0b3e011af75c20c75cf79f1ee5e864fe6eb44807e'
    audio_origin = float(first_audio_frames[0]['pts_time'])
    video_origin = float(first_video_frames[0]['pts_time'])
    assert audio_origin == video_origin == 0
    duration = float(video['duration'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(audio_path), '-map', '0:a:0', '-ac', '2', '-ar', str(rate), '-f', 'f32le', 'pipe:1'], capture_output=True, check=True).stdout
    decoded = np.frombuffer(raw, dtype='<f4').reshape(-1, 2)
    decoded_duration = len(decoded)/rate
    assert decoded_duration >= duration
    stereo = decoded[:round(duration*rate)].astype(np.float64)
    assert np.isfinite(stereo).all()
    energy = np.mean(stereo**2, axis=1)
    native_rms = np.sqrt(np.mean(energy))
    mono_ratio = np.sqrt(np.mean(stereo.mean(axis=1)**2))/native_rms
    counts, energy_series = {}, {}
    for ms in [10, 100, 500]:
        block = round(rate*ms/1000); count = len(stereo)//block
        values = np.sqrt(energy[:count*block].reshape(count, block).mean(axis=1))
        times = (np.arange(count)+.5)*block/rate
        energy_series[str(ms)] = {'times': times.round(6).tolist(), 'rmsDbfs': db(values).round(4).tolist()}
        counts[ms] = (times, db(values))
    energy_times, energy_db = counts[100]
    quiet = intervals(counts[10][1] < -45, .01, minimum=.25)
    low_threshold = float(np.quantile(energy_db, .25))
    lower_energy = intervals(energy_db < low_threshold, .1, minimum=.3)

    # Match the established 64ms/10ms analysis grid while avoiding L+R phase
    # cancellation. Average powers, then calculate log-magnitude changes.
    spectral_rate, fft_size, hop = 16000, 1024, 160
    raw16 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(audio_path), '-t', str(duration), '-map', '0:a:0', '-ac', '2', '-ar', str(spectral_rate), '-f', 'f32le', 'pipe:1'], capture_output=True, check=True).stdout
    stereo16 = np.frombuffer(raw16, dtype='<f4').reshape(-1, 2)
    power = None
    for channel in range(2):
        frequency, spec_times, spectrum = stft(stereo16[:, channel], fs=spectral_rate, nperseg=fft_size, noverlap=fft_size-hop, boundary=None, padded=False)
        current = np.abs(spectrum)**2
        power = current if power is None else power+current
    power *= .5
    magnitude = np.sqrt(power)
    flux = np.mean(np.maximum(0, np.diff(np.log1p(50*magnitude), axis=1)), axis=0)
    flux_times = spec_times[1:]
    threshold = float(np.quantile(flux, .80))
    prominence = max(float(np.median(np.abs(flux-np.median(flux))))*.8, 1e-8)
    peak_indices, _ = find_peaks(flux, height=threshold, prominence=prominence, distance=15)
    events = [{'id': f'T{i+1:03}', 'time': round(float(flux_times[p]), 4), 'strength': round(float(flux[p]), 7),
               'classification': 'unclassified-mixed-track-transient'} for i, p in enumerate(peak_indices)]
    event_times = np.asarray([e['time'] for e in events])
    density_times = np.arange(.5, duration-.5+.0001, .1)
    density = np.array([np.sum((event_times >= t-.5) & (event_times < t+.5)) for t in density_times])
    bands = {}
    for label, lo, hi in [('40-250 Hz', 40, 250), ('250-1000 Hz', 250, 1000), ('1000-4000 Hz', 1000, 4000), ('4000-7900 Hz', 4000, 7900)]:
        bands[label] = 10*np.log10(np.maximum(power[(frequency >= lo) & (frequency < hi)].sum(axis=0), 1e-14))
    centroid = (power*frequency[:, None]).sum(axis=0)/np.maximum(power.sum(axis=0), 1e-20)
    sensitivity = []
    for percentile in [.75, .8, .9]:
        ix, _ = find_peaks(flux, height=float(np.quantile(flux, percentile)), prominence=prominence, distance=15)
        times = flux_times[ix]
        sensitivity.append({'globalThresholdPercentile': percentile*100, 'candidateCount': len(ix),
                            'windowCounts': {f'{lo:g}-{hi:g}': int(np.sum((times >= lo) & (times < hi))) for lo, hi in WINDOWS}})
    legacy_path = ROOT/'evidence/audio/shuffle/analysis.json'
    legacy = json.loads(legacy_path.read_text(encoding='utf-8'))
    assert legacy['sha256'] == audio_hash
    source_info = {'audio': {'path': str(audio_path), 'sha256': audio_hash, 'probe': audio_probe},
                   'video': {'path': str(video_path), 'sha256': video_hash, 'probe': video_probe},
                   'timeline': {'firstAudioPacket': first_packet, 'firstDecodedAudioFrames': first_audio_frames,
                                'firstDecodedVideoFrames': first_video_frames, 'appliedAudioOffsetSeconds': 0,
                                'declaredAudioMinusVideoDurationSeconds': float(audio['duration'])-duration,
                                'decodedAudioBeforeVideoTrimSeconds': decoded_duration, 'analyzedWindow': [0, duration],
                                'explanation': 'The negative first packet carries Skip Samples. Decoder output begins at PTS 0, like video. Do not add 161ms as an A/V offset; this metadata does not prove authored perceptual synchronization.'},
                   'legacyAnalysis': {'path': str(legacy_path), 'sha256': sha256(legacy_path), 'window': legacy['window'],
                                      'summary': legacy['summary'], 'reusedMethod': 'scripts/audio_analyze.py positive log-magnitude spectral flux, 1024 FFT/160 hop at16kHz, 150ms minimum spacing; sha256 helper imported.',
                                      'difference': 'Legacy uses mono downmix and local percentile. Current stereo-power analysis uses a full-track threshold; candidate counts are not directly interchangeable.'},
                   'software': {'numpy': np.__version__, 'ffmpeg': subprocess.check_output(['ffmpeg', '-version'], encoding='utf-8').splitlines()[0]},
                   'sourceMediaCopied': False, 'subjectiveListening': False}
    write('source-info.json', source_info)
    method = {'nativeStereoEnergy': True, 'spectralSampleRate': spectral_rate, 'fftWindowSeconds': .064, 'hopSeconds': .01,
              'flux': 'Mean positive difference of log1p(50*sqrt(mean(L_power,R_power)))',
              'globalThresholdPercentile': 80, 'threshold': threshold, 'prominence': prominence, 'minimumCandidateSpacingSeconds': .15,
              'timestampMeaning': 'Centre of the second STFT window in the difference, not manually verified acoustic onset.',
              'densityWindowSeconds': 1, 'quietDefinition': '10ms stereo RMS below -45dBFS for at least250ms; not psychoacoustic silence.',
              'relativeLowEnergyDefinition': '100ms stereo RMS below full-track25th percentile for at least300ms.',
              'relativeLowEnergyThresholdDbfs': low_threshold, 'beatTrackingPerformed': False, 'sourceSeparationPerformed': False,
              'subjectiveListening': False}
    limits = ['混音瞬态可能来自人声、音乐或音效；不据此命名牌声或鼓点。', '频段名称只是频率范围，不能代替声源分离或人声清晰度。',
              '10ms步长不等于10ms准确度；频谱窗64ms，事件时间不是声学起点。', '无候选事件不等于无声；相对低能量也不一定是主动留白。',
              '声音密度与画面停留需分别核验；时间近邻不证明作者有意卡点。', '下载AAC副本的峰值或响度不能代表原始母带。']

    def window_result(lo, hi):
        ix = (energy_times >= lo) & (energy_times < hi)
        segment = stereo[round(lo*rate):round(hi*rate)]
        selected = [event for event in events if lo <= event['time'] < hi]
        gaps = event_gaps(events, lo, hi, energy_times, energy_db)
        fi = (flux_times >= lo) & (flux_times < hi)
        si = (spec_times >= lo) & (spec_times < hi)
        di = (density_times >= lo) & (density_times < hi)
        return {'window': [lo, hi], 'sourceSha256': audio_hash, 'method': method, 'limits': limits,
                'summary': {'stereoEnergyRmsDbfs': round(float(db(np.sqrt(np.mean(segment**2)))), 3),
                            'rms100msDbfsPercentiles': {str(p): round(float(np.quantile(energy_db[ix], p/100)), 3) for p in [10, 25, 50, 75, 90]},
                            'decodedSamplePeakDbfs': round(float(db(np.max(abs(segment)))), 3),
                            'candidateCount': len(selected), 'candidatesPerSecond': round(len(selected)/(hi-lo), 4),
                            'medianCandidateIntervalSeconds': round(float(np.median(np.diff([e['time'] for e in selected]))), 4) if len(selected)>1 else None,
                            'medianPowerSpectralCentroidHz': round(float(np.median(centroid[si])), 2),
                            'relativeLowEnergyIntervals': clipped(lower_energy, lo, hi), 'absoluteQuietIntervals': clipped(quiet, lo, hi),
                            'candidateFreeGapsAtLeastHalfSecond': gaps},
                'events': selected, 'series': {'rmsTimes': energy_times[ix].round(4).tolist(), 'stereoRmsDbfs': energy_db[ix].round(4).tolist(),
                                             'fluxTimes': flux_times[fi].round(4).tolist(), 'flux': flux[fi].round(7).tolist(),
                                             'bandTimes': spec_times[si].round(4).tolist(), 'bandPowerRelativeDb': {k: v[si].round(4).tolist() for k, v in bands.items()},
                                             'powerSpectralCentroidHz': centroid[si].round(3).tolist(),
                                             'densityCenters': density_times[di].round(4).tolist(), 'candidatesInOneSecond': density[di].tolist()}}

    def plot_window(lo, hi, filename):
        plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9})
        fig, axes = plt.subplots(4, 1, figsize=(15, 9.2), sharex=True, constrained_layout=True)
        ei = (energy_times >= lo) & (energy_times < hi)
        axes[0].plot(energy_times[ei], energy_db[ei], color='#1b827d', lw=1.1, label='Stereo100ms RMS')
        axes[0].axhline(low_threshold, color='#b79054', lw=.8, ls='--', label='Full-track25th percentile')
        for span in clipped(lower_energy, lo, hi): axes[0].axvspan(span['start'], span['end'], color='#dcb56b', alpha=.17)
        axes[0].set(ylabel='RMS / dBFS', ylim=(-65, 3), title=f'Shuffle mixed soundtrack | {lo:g}-{hi:g}s | signal study, no subjective listening')
        axes[0].legend(loc='lower left', fontsize=8, ncol=2)
        fi = (flux_times >= lo) & (flux_times < hi)
        selected = [e for e in events if lo <= e['time'] < hi]
        axes[1].plot(flux_times[fi], flux[fi], color='#80609f', lw=.7)
        axes[1].axhline(threshold, color='#555', lw=.8, ls='--')
        axes[1].scatter([e['time'] for e in selected], [e['strength'] for e in selected], s=12, color='#bb654d')
        axes[1].set(ylabel='Positive spectral flux')
        di = (density_times >= lo) & (density_times < hi)
        axes[2].step(density_times[di], density[di], where='mid', color='#b68541', lw=1.2)
        axes[2].set(ylabel='Candidates /1s', ylim=(-.2, max(density.max()+.5, 1)))
        # Limit display resolution only; analysis and event tables retain10ms.
        ids = np.flatnonzero((spec_times >= lo) & (spec_times < hi))[::max(1, int((hi-lo)/30))]
        freqs = (frequency >= 40) & (frequency <= 7900)
        image = axes[3].pcolormesh(spec_times[ids], frequency[freqs], 10*np.log10(np.maximum(power[np.ix_(freqs, ids)], 1e-12)), shading='auto', cmap='magma', vmin=-85, vmax=-25, rasterized=True)
        axes[3].set(yscale='log', ylabel='Frequency /Hz', xlabel='Source presentation time /seconds', ylim=(40, 7900))
        fig.colorbar(image, ax=axes[3], label='STFT power /relative dB', pad=.01)
        for ax in axes: ax.set_xlim(lo, hi); ax.grid(alpha=.12)
        fig.savefig(OUT/filename, dpi=150); plt.close(fig)

    full = window_result(0, duration)
    full.update({'energySeriesNative': energy_series, 'thresholdSensitivity': sensitivity,
                 'monoToStereoRmsRatio': round(float(mono_ratio), 6),
                 'spectrum': {'frequencies': frequency.tolist(), 'meanStereoPowerRelativeDb': (10*np.log10(np.maximum(power.mean(axis=1), 1e-14))).round(4).tolist()}})
    write('full-track.json', full)
    plot_window(0, duration, 'full-track.png')
    summaries = []
    for lo, hi in WINDOWS:
        result = window_result(lo, hi); label = f'window-{int(lo):03}-{int(hi):03}'
        write(label+'.json', result); plot_window(lo, hi, label+'.png')
        summaries.append({'window': [lo, hi], **result['summary']})
    write('window-summary.json', {'fullTrack': full['summary'], 'windows': summaries, 'thresholdSensitivity': sensitivity})
    if visual_events and Path(visual_events).exists(): align_visual(Path(visual_events), events, float(video['avg_frame_rate'].split('/')[0])/float(video['avg_frame_rate'].split('/')[1]))
    validation = {'finiteNativePcm': bool(np.isfinite(stereo).all()), 'finiteFlux': bool(np.isfinite(flux).all()),
                  'audioVideoDecodedOriginsMatch': audio_origin == video_origin,
                  'audioCoversCompleteVideo': decoded_duration >= duration,
                  'allEventsWithinVideo': all(0 <= e['time'] < duration for e in events),
                  'candidateSpacingAtLeast150ms': bool(np.all(np.diff(event_times) >= .15-1e-8)),
                  'sourceAudioUnmodified': sha256(audio_path) == audio_hash, 'sourceVideoUnmodified': sha256(video_path) == video_hash,
                  'windowCountsSumIndependentlyVerified': all(s['candidateCount'] == sum(s['window'][0] <= e['time'] < s['window'][1] for e in events) for s in summaries)}
    validation['passed'] = all(validation.values())
    validation.update({'subjectiveListening': False, 'sourceSeparation': False, 'scope': 'Numeric/source-integrity checks only.'})
    write('analysis-validation.json', validation)
    print(json.dumps({'output': str(OUT), 'fullSummary': full['summary'], 'windowSummaries': summaries,
                      'thresholdSensitivity': sensitivity, 'validation': validation}, ensure_ascii=True))
    return full


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--visual-events', type=Path, default=OUT/'visual-events.json')
    parser.add_argument('--alignment-only', action='store_true')
    args = parser.parse_args()
    if args.alignment_only:
        data = json.loads((OUT/'full-track.json').read_text(encoding='utf-8'))
        count = align_visual(args.visual_events, data['events'], 30.)
        print(json.dumps({'alignedEvents': count, 'output': str(OUT/'visual-signal-alignment.json')}))
    else:
        run(args.visual_events)
