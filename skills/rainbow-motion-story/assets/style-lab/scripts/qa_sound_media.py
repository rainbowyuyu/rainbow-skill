"""Probe original sound examples and measure them with FFmpeg; not a listening test."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(argv):
    result = subprocess.run(argv, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)
    if result.returncode:
        raise RuntimeError(f'{Path(argv[0]).name} failed: {result.stderr[-1600:]}')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=ROOT / 'examples/sound-design')
    parser.add_argument('--report', type=Path, default=ROOT / 'qa/sound-media.json')
    args = parser.parse_args()
    ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise RuntimeError('FFmpeg and ffprobe are required; no measurement was performed.')
    files = sorted(args.directory.glob('*.wav'))
    if not files:
        raise RuntimeError(f'No WAV examples found in {args.directory}')
    measurements = []
    for path in files:
        probe = json.loads(run([ffprobe, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]).stdout)
        audio = [s for s in probe['streams'] if s['codec_type'] == 'audio']
        if len(audio) != 1:
            raise ValueError(f'Expected one audio stream in {path.name}')
        stream = audio[0]
        measured = run([ffmpeg, '-hide_banner', '-nostats', '-i', str(path), '-af', 'loudnorm=I=-23:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'])
        blocks = re.findall(r'\{\s*"input_i"[\s\S]*?\}', measured.stderr)
        if not blocks:
            raise RuntimeError(f'No loudness measurement emitted for {path.name}')
        level = json.loads(blocks[-1])
        # Input measurements only; the null output is discarded and no file is normalized.
        values = {k: float(level[k]) for k in ('input_i', 'input_tp', 'input_lra', 'input_thresh')}
        duration = float(stream.get('duration', probe['format']['duration']))
        check = {
            'pcm16': stream['codec_name'] == 'pcm_s16le',
            'stereo': stream['channels'] == 2,
            'sampleRate48000': int(stream['sample_rate']) == 48000,
            'nonemptyDuration': duration > 0,
            'truePeakHeadroom': values['input_tp'] <= -1,
            'integratedMeasurementOrTooShort': math.isfinite(values['input_i']) or duration < .4,
        }
        measurements.append({
            'file': path.name, 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'durationSeconds': duration,
            'sampleRate': int(stream['sample_rate']), 'channels': stream['channels'],
            'codec': stream['codec_name'], 'bitsPerSample': stream.get('bits_per_sample'),
            'integratedLUFS': values['input_i'] if math.isfinite(values['input_i']) else None,
            'integratedStatus': 'measured' if math.isfinite(values['input_i']) else 'not available: source shorter than the 400ms integration block',
            'truePeakDbTP': values['input_tp'],
            'loudnessRangeLU': values['input_lra'], 'thresholdLUFS': values['input_thresh'],
            'loudnessRangeApplicable': duration >= 60,
            'checks': check, 'passed': all(check.values()),
        })
    report = {
        'passed': all(x['passed'] for x in measurements),
        'method': 'ffprobe and FFmpeg loudnorm input measurement; output discarded, source WAVs unchanged',
        'ffmpegVersion': run([ffmpeg, '-version']).stdout.splitlines()[0],
        'measurementScope': 'Short synthetic examples, not a broadcast/streaming compliance assessment',
        'headroomCheckDbTP': -1,
        'headroomNote': 'Conservative check for these study files, not a universal delivery target',
        'listeningPerformed': False,
        'limits': 'No test of timbre preference, music compatibility, speech intelligibility, device latency, or human perception of synchrony. LRA is not evaluated for these sub-minute files. Sources shorter than 400ms have no integrated measurement; they are not treated as silent or as failed sound assets.',
        'files': measurements,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), 'utf-8')
    print(json.dumps({'passed': report['passed'], 'files': len(measurements), 'maxTruePeakDbTP': max(x['truePeakDbTP'] for x in measurements), 'report': str(args.report)}, ensure_ascii=False))
    if not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
