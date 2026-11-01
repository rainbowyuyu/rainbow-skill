"""Extract auditable shuffle reference contact sheets without copying source media.

Examples:
  python scripts/extract_shuffle_rhythm.py --overview-only
  python scripts/extract_shuffle_rhythm.py --skip-overview --windows "[[42,47,6]]"
  python scripts/extract_shuffle_rhythm.py --skip-overview --windows "[90,104,3]"

The supplied source is verified CFR 30 fps with start PTS 0. Window endpoints
are inclusive. Sampling is by decoded source-frame index; both source and
selected showinfo logs retain actual timestamps. Rational PTS seconds are
computed from source integer PTS and its declared time base, not rounded fps.
"""
from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(next(item for item in json.loads((ROOT / 'lab/references.json').read_text(encoding='utf8'))['references'] if item['id'] == 'shuffle')['sourceVideo'])
EXPECTED_SHA256 = 'ebd452ef40bb4c1063f41ab0b3e011af75c20c75cf79f1ee5e864fe6eb44807e'
EVIDENCE = ROOT / 'evidence/shuffle-rhythm'
WORK = ROOT / 'work/shuffle-rhythm'
DEFAULT_WINDOWS = [[42, 47, 6], [68.5, 74, 3], [94, 99, 3]]
SHOWINFO = re.compile(r'\[showinfo@(source|selected)\s+@[^\]]+\]\s+n:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([^\s]+)')


def write_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def probe(source):
    data = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
        'stream=width,height,r_frame_rate,avg_frame_rate,time_base,start_pts,start_time,duration,nb_frames',
        '-of', 'json', str(source)], encoding='utf8'))
    stream = data['streams'][0]
    if stream['r_frame_rate'] != '30/1' or stream['avg_frame_rate'] != '30/1' or int(stream['start_pts']) != 0:
        raise ValueError('This extractor expects the verified 30 fps, zero-start shuffle reference; inspect another source before adapting frame selection.')
    return stream


def timestamp(value):
    milliseconds = round(float(value) * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, ms = divmod(remainder, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}.{ms:03}'


def render_pages(name, records):
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 15)
    heading_font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)
    pages = []
    for page_no, start in enumerate(range(0, len(records), 24), 1):
        group = records[start:start + 24]
        sheet = Image.new('RGB', (1280, 1320), (10, 18, 25))
        paint = ImageDraw.Draw(sheet)
        paint.text((14, 12), f'SHUFFLE | {name} | page {page_no:02} | {timestamp(group[0]["ptsSeconds"])} - {timestamp(group[-1]["ptsSeconds"])}', font=heading_font, fill=(230, 235, 235))
        for tile_no, record in enumerate(group):
            column, row = tile_no % 4, tile_no // 4
            x, y = column * 320, 44 + row * 208
            with Image.open(ROOT / record['rawFrame']) as source:
                image = source.convert('RGB')
                image.thumbnail((320, 180), Image.Resampling.LANCZOS)
                sheet.paste(image, (x + (320 - image.width) // 2, y + (180 - image.height) // 2))
            paint.rectangle((x, y + 180, x + 319, y + 207), fill=(21, 37, 48))
            label = f'PTS {record["ptsSeconds"]:10.6f}s  n={record["sourceFrameNumber"]:04}'
            paint.text((x + 7, y + 186), label, font=font, fill=(232, 224, 200))
        paint.text((14, 1297), 'Source decoded frames / original PTS; static evidence only; audio not listened.', font=font, fill=(156, 177, 188))
        target = EVIDENCE / f'{name}-page-{page_no:02}.jpg'
        sheet.save(target, quality=92, subsampling=0, optimize=True)
        page = {'file': str(target.relative_to(ROOT)).replace('\\', '/'), 'sha256': sha256(target), 'width': 1280, 'height': 1320, 'columns': 4, 'rows': 6, 'tileImageSize': [320, 180], 'frameCount': len(group), 'sourceFrameNumbers': [r['sourceFrameNumber'] for r in group], 'ptsRangeSeconds': [group[0]['ptsSeconds'], group[-1]['ptsSeconds']], 'reviewStatus': 'awaitingReview'}
        pages.append(page)
        for record in group:
            record['sheet'] = page['file']
    return pages


def extract(name, start_frame, end_frame, step, stream, source_hash):
    target = WORK / name
    saved = target / 'frames.json'
    if saved.exists():
        cached = json.loads(saved.read_text(encoding='utf8'))
        if cached.get('sourceSha256') == source_hash and cached.get('frameSelection') == [start_frame, end_frame, step] and all((ROOT / r['rawFrame']).is_file() for r in cached['frames']) and all((ROOT / p['file']).is_file() for p in cached['pages']):
            print(json.dumps({'reused': name, 'frames': len(cached['frames']), 'pages': len(cached['pages'])}), flush=True)
            return cached
        raise FileExistsError(f'Existing evidence is incomplete or differs: {saved}; preserve it and choose a new named window.')
    target.mkdir(parents=True, exist_ok=True)
    if any(target.glob('frame-*.jpg')):
        raise FileExistsError(f'Unmanifested frames already exist in {target}; do not overwrite evidence.')
    selection = f'between(n\\,{start_frame}\\,{end_frame})*not(mod(n-{start_frame}\\,{step}))'
    vf = f'showinfo@source,select={selection},showinfo@selected'
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'info', '-n', '-i', str(SOURCE), '-map', '0:v:0', '-vf', vf, '-fps_mode', 'passthrough', '-an', '-q:v', '3', str(target / 'frame-%05d.jpg')]
    run = subprocess.run(command, capture_output=True, encoding='utf8', errors='replace')
    log_file = target / 'ffmpeg-showinfo.log'
    log_file.write_text(run.stderr, encoding='utf8')
    write_json(target / 'command.json', {'argv': command, 'sourceNotCopied': True})
    if run.returncode:
        raise RuntimeError(f'ffmpeg exit {run.returncode}; see {log_file}')
    originals, selected = {}, []
    for match in SHOWINFO.finditer(run.stderr):
        kind, n, pts, printed = match.groups()
        row = {'n': int(n), 'pts': int(pts), 'ptsTimeDisplayed': printed}
        if kind == 'source':
            if row['pts'] in originals:
                raise ValueError('Duplicate source PTS; refusing an ambiguous timestamp/frame mapping.')
            originals[row['pts']] = row
        else:
            selected.append(row)
    frames = sorted(target.glob('frame-*.jpg'))
    expected = len(range(start_frame, end_frame + 1, step))
    if len(frames) != len(selected) or len(selected) != expected:
        raise ValueError(f'Frame count mismatch: jpeg={len(frames)}, showinfo={len(selected)}, expected={expected}')
    time_base = Fraction(stream['time_base'])
    records = []
    for frame, selection in zip(frames, selected):
        original = originals.get(selection['pts'])
        if original is None:
            raise ValueError('Selected frame PTS absent from pre-select showinfo records.')
        index = original['n']
        if not (start_frame <= index <= end_frame) or (index - start_frame) % step:
            raise ValueError(f'Unexpected source frame {index}')
        exact_time = original['pts'] * time_base
        with Image.open(frame) as image:
            size = list(image.size)
        records.append({'sourceFrameNumber': index, 'selectedFrameNumber': selection['n'], 'pts': original['pts'], 'timeBase': stream['time_base'], 'ptsSecondsRational': f'{exact_time.numerator}/{exact_time.denominator}', 'ptsSeconds': float(exact_time), 'showinfoPtsTime': original['ptsTimeDisplayed'], 'selectedShowinfoPtsTime': selection['ptsTimeDisplayed'], 'rawFrame': str(frame.relative_to(ROOT)).replace('\\', '/'), 'rawFrameSha256': sha256(frame), 'rawSize': size})
    pages = render_pages(name, records)
    result = {'id': name, 'sourceSha256': source_hash, 'frameSelection': [start_frame, end_frame, step], 'samplingMethod': 'decoded-source-frame selection; source showinfo before select matched by original integer PTS to selected showinfo', 'sourceFrameNumberBase': 0, 'sourceFrameStep': step, 'nominalSamplingIntervalSeconds': step / 30, 'decodedFrameCount': len(originals), 'log': str(log_file.relative_to(ROOT)).replace('\\', '/'), 'frames': records, 'pages': pages, 'reviewStatus': 'awaitingReview', 'subjectiveListening': False}
    write_json(saved, result)
    write_json(EVIDENCE / f'{name}.json', result)
    print(json.dumps({'completed': name, 'frames': len(records), 'pages': len(pages), 'firstPts': records[0]['ptsSeconds'], 'lastPts': records[-1]['ptsSeconds']}), flush=True)
    return result


def windows_from_argument(value):
    parsed = json.loads(value)
    if isinstance(parsed, list) and len(parsed) == 3 and all(isinstance(x, (int, float)) for x in parsed):
        parsed = [parsed]
    if not isinstance(parsed, list):
        raise ValueError('--windows must be [start,end,stepFrames] or a list of these triples')
    for row in parsed:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError('Every window must be [start,end,stepFrames]')
        start, end, step = row
        if not (isinstance(start, (int, float)) and isinstance(end, (int, float)) and 0 <= start <= end and isinstance(step, int) and step > 0):
            raise ValueError('Window needs 0 <= start <= end and a positive integer frame step')
    return parsed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--overview-only', action='store_true')
    parser.add_argument('--skip-overview', action='store_true')
    parser.add_argument('--windows', type=windows_from_argument)
    args = parser.parse_args()
    if args.overview_only and args.skip_overview:
        parser.error('--overview-only and --skip-overview are mutually exclusive')
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            raise FileNotFoundError(tool)
    source_hash = sha256(SOURCE)
    if source_hash != EXPECTED_SHA256:
        raise ValueError(f'Source SHA256 mismatch: {source_hash}')
    stream = probe(SOURCE)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    manifest_file = EVIDENCE / 'visual-manifest.json'
    manifest = json.loads(manifest_file.read_text('utf8')) if manifest_file.exists() else {'schema': 'motion-atelier.shuffle-rhythm-visual/v1', 'source': str(SOURCE).replace('\\', '/'), 'sourceSha256': source_hash, 'sourceStream': stream, 'sourceNotCopied': True, 'sourceFrameNumberBase': 0, 'reviewStatus': 'awaitingReview', 'subjectiveListening': False, 'groups': []}
    if manifest['sourceSha256'] != source_hash:
        raise ValueError('Existing manifest belongs to another source')
    def retain(group):
        manifest['groups'] = [g for g in manifest['groups'] if g['id'] != group['id']] + [group]
        write_json(manifest_file, manifest)
    final_frame = math.ceil(float(stream['duration']) * 30) - 1
    if not args.skip_overview:
        retain(extract('intro-0-12-1fps', 0, min(final_frame,360), 30, stream, source_hash))
    if not args.overview_only:
        for start, end, step in args.windows if args.windows is not None else DEFAULT_WINDOWS:
            if end > float(stream['duration']):
                raise ValueError('Window extends beyond source duration')
            first = math.ceil(start * 30 - 1e-9)
            last = min(final_frame, math.floor(end * 30 + 1e-9))
            safe = lambda v: f'{v:g}'.replace('.', 'p')
            name = f'dense-{safe(start)}-{safe(end)}-step{step}'
            retain(extract(name, first, last, step, stream, source_hash))
    print(json.dumps({'manifest': str(manifest_file), 'groups': len(manifest['groups']), 'reviewStatus': manifest['reviewStatus']}), flush=True)


if __name__ == '__main__':
    main()
