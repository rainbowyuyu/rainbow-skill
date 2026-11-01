"""Validate one SFX cue sheet without requiring a four-layer director package.

This is a read-only timing/media check, not listening or final-mix approval.
Design plans may pass with pending assets; only production validates local media.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import wave

SYNC_TOLERANCE = 0.001


def numeric(value):
    return type(value) in (int, float) and math.isfinite(value)


def text(value):
    return isinstance(value, str) and bool(value.strip())


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def probe_audio(path, ffprobe=None):
    """Read PCM WAV sample counts, otherwise probe the actual local media file."""
    try:
        with wave.open(str(path), 'rb') as audio:
            frames = audio.getnframes()
            rate = audio.getframerate()
            channels = audio.getnchannels()
            width = audio.getsampwidth()
            count = 0
            while chunk := audio.readframes(65536):
                count += len(chunk)
            if count != frames * channels * width or not frames or not rate:
                raise ValueError('Truncated or empty PCM WAV')
            return {'duration_seconds': frames / rate, 'sample_rate': rate,
                    'channels': channels, 'probe': 'wave-sample-count'}
    except (wave.Error, EOFError):
        pass
    executable = str(ffprobe) if ffprobe else shutil.which('ffprobe')
    if not executable:
        raise ValueError('Non-PCM media requires ffprobe on PATH or --ffprobe <executable>')
    process = subprocess.run(
        [executable, '-v', 'error', '-select_streams', 'a:0', '-show_entries',
         'stream=codec_type,duration,sample_rate,channels:format=duration',
         '-of', 'json', str(path)], capture_output=True, text=True,
        encoding='utf-8', errors='replace', timeout=30, check=False)
    if process.returncode:
        raise ValueError('ffprobe could not read this audio asset')
    info = json.loads(process.stdout)
    streams = info.get('streams', [])
    if not streams:
        raise ValueError('No audio stream')
    stream = streams[0]
    duration = stream.get('duration', info.get('format', {}).get('duration'))
    try:
        duration = float(duration)
        rate = int(stream.get('sample_rate', 0))
        channels = int(stream.get('channels', 0))
    except (TypeError, ValueError):
        raise ValueError('Audio probe returned invalid duration or format') from None
    if not numeric(duration) or duration <= 0 or rate <= 0 or channels <= 0:
        raise ValueError('Audio probe returned empty or invalid media')
    return {'duration_seconds': duration, 'sample_rate': rate,
            'channels': channels, 'probe': 'ffprobe'}


def validate(data, base_dir, contract=None, stage='design', ffprobe=None):
    errors, warnings, pending, measurements = [], [], [], {}
    base_dir = Path(base_dir)
    if stage not in ('design', 'production'):
        raise ValueError('stage must be design or production')

    def missing(message):
        pending.append(message)
        (errors if stage == 'production' else warnings).append(message)

    def result():
        valid = not errors
        return {
            'stage': stage, 'validation_passed': valid,
            'production_ready': stage == 'production' and valid and not pending,
            'status': ('invalid' if not valid else
                       'production-technically-verified' if stage == 'production'
                       else 'design-valid-pending-production-check'),
            'scope': 'Local media identity, duration and event timing only; not source authenticity, listening or final-mix approval.',
            'errors': errors, 'warnings': warnings,
            'pending': pending, 'measured_assets': measurements,
        }

    if not isinstance(data, dict):
        errors.append('Cue sheet must be an object')
        return result()
    if data.get('schema_version', 1) != 1:
        errors.append('Unsupported schema_version')
    duration, fps = data.get('duration_seconds'), data.get('fps')
    if not numeric(duration) or duration <= 0 or not numeric(fps) or fps <= 0:
        errors.append('duration_seconds and fps must be finite and positive')
        return result()
    version = data.get('contract_version')
    if not text(version) and type(version) is not int:
        errors.append('contract_version is required')
    events, assets, cues = data.get('events'), data.get('assets'), data.get('cues')
    if not isinstance(events, dict) or not isinstance(assets, dict) or not isinstance(cues, list):
        errors.append('events/assets must be maps and cues must be an array')
        return result()
    event_times = {}
    for event_id, event in events.items():
        when = event.get('time') if isinstance(event, dict) else event
        if not text(event_id) or not numeric(when) or not 0 <= when <= duration:
            errors.append(f'Invalid event time: {event_id}')
        else:
            event_times[event_id] = when
    if contract is not None:
        if not isinstance(contract, dict):
            errors.append('Contract must be an object')
        else:
            if version != contract.get('version', contract.get('contract_version')):
                errors.append('Cue sheet contract_version differs from main contract')
            for field in ('duration_seconds', 'fps'):
                if not numeric(contract.get(field)) or abs(data[field] - contract[field]) > 1e-9:
                    errors.append(f'Cue sheet {field} differs from main contract')
            main_events = contract.get('events', {})
            if not isinstance(main_events, dict):
                errors.append('Contract events must be a map')
                main_events = {}
            for event_id, when in event_times.items():
                main = main_events.get(event_id)
                main_time = main.get('time') if isinstance(main, dict) else main
                if not numeric(main_time) or abs(when - main_time) > SYNC_TOLERANCE:
                    errors.append(f'Event {event_id} missing or stale against main contract')
            # Narration-free windows protect speech; SFX and music may continue.

    seen_ids, event_layers, used_assets = set(), set(), set()
    for index, cue in enumerate(cues):
        if not isinstance(cue, dict):
            errors.append(f'Cue {index} must be an object')
            continue
        cue_id = cue.get('id')
        prefix = f'Cue {cue_id if text(cue_id) else index}'
        if not text(cue_id) or cue_id in seen_ids:
            errors.append(f'{prefix}: missing or duplicate id')
        if text(cue_id):
            seen_ids.add(cue_id)
        event_id = cue.get('event_id')
        when = event_times.get(event_id) if isinstance(event_id, str) else None
        if when is None:
            errors.append(f'{prefix}: unknown event_id')
        decision = cue.get('decision', 'include')
        if decision not in ('include', 'omit'):
            errors.append(f'{prefix}: decision must be include or omit')
        if not text(cue.get('reason')):
            errors.append(f'{prefix}: reason is required, including omitted cues')
        if decision == 'omit':
            if any(cue.get(key) is not None for key in ('asset_id', 'start_seconds', 'asset_sync_seconds')):
                errors.append(f'{prefix}: omitted cue must not schedule an asset')
            continue
        if cue.get('source_class') not in ('diegetic', 'designed', 'sonification'):
            errors.append(f'{prefix}: invalid source_class')
        if not text(cue.get('method')):
            errors.append(f'{prefix}: method is required')
        if not text(cue.get('tail_policy')):
            errors.append(f'{prefix}: tail_policy is required')
        layer = cue.get('layer_role', 'primary')
        if not text(layer):
            errors.append(f'{prefix}: layer_role must be nonempty')
        elif isinstance(event_id, str):
            identity = (event_id, layer)
            if identity in event_layers:
                errors.append(f'{prefix}: repeated event/layer {event_id}/{layer}; use one cue or explicitly different body/texture layers')
            event_layers.add(identity)
        for field in ('offset_ms', 'gain_db', 'pan'):
            if not numeric(cue.get(field)):
                errors.append(f'{prefix}: {field} must be finite')
        if numeric(cue.get('pan')) and not -1 <= cue['pan'] <= 1:
            errors.append(f'{prefix}: pan must be between -1 and 1')
        review = cue.get('review')
        if not isinstance(review, dict):
            errors.append(f'{prefix}: review must be an object with honest pending states')
        else:
            if any(type(v) is not bool and v is not None for v in review.values()):
                errors.append(f'{prefix}: review values must be true, false or null')
            if not review or any(v is not True for v in review.values()):
                warnings.append(f'{prefix}: listening/review remains incomplete; this check cannot approve sound quality')
        sync, start, exit_time = cue.get('asset_sync_seconds'), cue.get('start_seconds'), cue.get('exit_seconds')
        if sync is None:
            missing(f'{prefix}: measured asset_sync_seconds is pending')
        elif not numeric(sync) or sync < 0:
            errors.append(f'{prefix}: asset_sync_seconds must be finite and nonnegative')
        if start is None:
            missing(f'{prefix}: calculated start_seconds is pending')
        elif not numeric(start):
            errors.append(f'{prefix}: start_seconds must be finite')
        elif start < 0:
            errors.append(f'{prefix}: negative start; crop the source and re-register its sync point, do not silently clamp')
        elif start >= duration:
            errors.append(f'{prefix}: start_seconds must precede end of film')
        if exit_time is None:
            missing(f'{prefix}: exit_seconds is pending')
        elif not numeric(exit_time) or not 0 < exit_time <= duration:
            errors.append(f'{prefix}: exit_seconds must be within film')
        elif numeric(start) and exit_time <= start:
            errors.append(f'{prefix}: exit_seconds must follow start_seconds')
        if numeric(sync) and numeric(cue.get('offset_ms')) and when is not None:
            expected = when + cue['offset_ms'] / 1000 - sync
            if expected < 0:
                errors.append(f'{prefix}: computed negative start; crop source and re-register its sync point')
            if numeric(start) and abs(start - expected) > SYNC_TOLERANCE:
                errors.append(f'{prefix}: start_seconds differs from event + offset_ms/1000 - asset_sync_seconds (expected {expected:.6f})')
            audible_event = when + cue['offset_ms'] / 1000
            if numeric(exit_time) and exit_time < audible_event - SYNC_TOLERANCE:
                errors.append(f'{prefix}: exit occurs before the selected audible sync point')
        asset_id = cue.get('asset_id')
        if asset_id is None:
            missing(f'{prefix}: selected asset is pending')
            continue
        if not isinstance(asset_id, str) or asset_id not in assets or not isinstance(assets[asset_id], dict):
            errors.append(f'{prefix}: unknown or invalid asset_id')
            continue
        used_assets.add(asset_id)
        asset = assets[asset_id]
        asset_duration = asset.get('duration_seconds')
        if not numeric(asset_duration) or asset_duration <= 0:
            missing(f'Asset {asset_id}: measured duration_seconds is required')
        elif numeric(sync) and sync >= asset_duration:
            errors.append(f'{prefix}: sync point falls outside selected audio')
        if not isinstance(asset.get('source'), (dict, str)) or not asset['source']:
            missing(f'Asset {asset_id}: source provenance is required')
        if stage == 'production' and asset_id not in measurements:
            source_path, expected_sha = asset.get('path'), asset.get('sha256')
            if not text(source_path) or not isinstance(expected_sha, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', expected_sha):
                missing(f'Asset {asset_id}: local path and SHA256 are required')
                continue
            path = Path(source_path)
            if not path.is_absolute():
                path = base_dir / path
            try:
                if not path.is_file():
                    raise ValueError('File does not exist')
                actual_sha = sha256(path)
                if actual_sha.lower() != expected_sha.lower():
                    raise ValueError('SHA256 mismatch')
                media = probe_audio(path, ffprobe)
                measurements[asset_id] = {**media, 'path': str(path.resolve()), 'sha256': actual_sha}
                if numeric(asset_duration) and abs(media['duration_seconds'] - asset_duration) > max(.02, 1 / media['sample_rate']):
                    errors.append(f'Asset {asset_id}: declared duration differs from actual media ({media["duration_seconds"]:.6f}s)')
            except (OSError, ValueError, subprocess.SubprocessError) as exc:
                errors.append(f'Asset {asset_id}: {exc}')
        actual_duration = measurements.get(asset_id, {}).get('duration_seconds', asset_duration)
        if numeric(actual_duration):
            if numeric(sync) and sync >= actual_duration:
                errors.append(f'{prefix}: sync point falls outside measured audio')
            if numeric(start) and numeric(exit_time) and cue.get('tail_policy') in ('natural', 'natural-decay', 'full'):
                if exit_time < start + actual_duration - .02:
                    errors.append(f'{prefix}: natural tail would be cut; register a processed asset or choose an explicit fade/cut policy')
            if numeric(start) and numeric(exit_time) and exit_time > start + actual_duration + .02:
                if cue.get('tail_policy') not in ('loop', 'loop-crossfade'):
                    errors.append(f'{prefix}: exit exceeds asset end; use a registered longer asset or explicit loop/loop-crossfade policy')
    if stage == 'design':
        warnings.append('Design validation does not probe files or certify production readiness; rerun --stage production after selecting assets.')
    for asset_id in assets.keys() - used_assets:
        warnings.append(f'Asset {asset_id}: unused candidate; not counted as production evidence')
    return result()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cue_sheet', type=Path)
    parser.add_argument('--contract', type=Path)
    parser.add_argument('--stage', choices=('design', 'production'), default='design')
    parser.add_argument('--ffprobe', type=Path)
    parser.add_argument('--json-out', type=Path)
    args = parser.parse_args(argv)
    try:
        data = json.loads(args.cue_sheet.read_text(encoding='utf-8-sig'))
        contract = json.loads(args.contract.read_text(encoding='utf-8-sig')) if args.contract else None
        report = validate(data, args.cue_sheet.resolve().parent, contract, args.stage, args.ffprobe)
    except (OSError, ValueError) as exc:
        report = {'stage': args.stage, 'validation_passed': False, 'production_ready': False,
                  'status': 'invalid', 'errors': [str(exc)], 'warnings': []}
    output = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(output + '\n', encoding='utf-8')
    print(output)
    return 0 if report['validation_passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
