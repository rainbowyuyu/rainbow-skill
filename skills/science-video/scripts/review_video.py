"""Extract exact decoded frame indices and review sheets; never certify aesthetics.
Requires FFmpeg, FFprobe and Pillow. Writes only into a new/empty output folder.
"""
import argparse
import hashlib
import json
import math
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True,
                          encoding='utf-8', errors='replace').stdout


def values(raw, cast):
    return [cast(s.strip()) for s in raw.split(',') if s.strip()]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--cuts', default='', help='Cut frame indices, comma-separated')
    parser.add_argument('--times', default='', help='Seconds; approximated to nominal frame index')
    parser.add_argument('--radius', type=int, default=12)
    parser.add_argument('--samples', type=int, default=12)
    parser.add_argument('--width', type=int, default=960)
    parser.add_argument('--portrait', action='store_true', help='Also make center 9:16 crop sheets')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--ffprobe', default='ffprobe')
    args = parser.parse_args()
    video = args.video.resolve(strict=True)
    if args.samples < 0 or args.radius < 1 or args.width < 320:
        parser.error('samples >= 0, radius >= 1 and width >= 320 required')
    out = args.out.resolve()
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        parser.error('--out must be a new or empty directory; no existing files are overwritten')
    probe = json.loads(run([args.ffprobe, '-v', 'error', '-show_streams',
                            '-show_format', '-of', 'json', str(video)]))
    stream = next((s for s in probe['streams'] if s['codec_type'] == 'video'), None)
    if not stream:
        parser.error('No video stream')
    fps = Fraction(stream['avg_frame_rate'])
    duration = float(stream.get('duration') or probe['format']['duration'])
    if fps <= 0 or not math.isfinite(duration) or duration <= 0:
        parser.error('Valid positive frame rate and duration required')
    count = int(stream['nb_frames']) if str(stream.get('nb_frames', '')).isdigit() else max(1, round(duration * float(fps)))
    cuts = values(args.cuts, int)
    times = values(args.times, float)
    if any(c < 0 or c >= count for c in cuts):
        parser.error('Cut outside reported frame range')
    if any(not math.isfinite(t) or t < 0 or t >= duration for t in times):
        parser.error('Time outside video duration')
    frames = {round(i * (count - 1) / max(1, args.samples - 1)) for i in range(args.samples)}
    frames.update(min(count - 1, round(t * float(fps))) for t in times)
    for cut in cuts:
        frames.update(max(0, min(count - 1, cut + offset))
                      for offset in (-args.radius, -1, 0, 1, args.radius))
    frames = sorted(frames)
    if not frames:
        parser.error('No samples requested')
    if len(frames) > 500:
        parser.error('More than 500 frames: split the review into batches')
    out.mkdir(parents=True, exist_ok=True)
    frame_dir = out / 'frames'
    frame_dir.mkdir()
    select = '+'.join(f'eq(n\\,{f})' for f in frames)
    run([args.ffmpeg, '-v', 'error', '-i', str(video), '-map', '0:v:0',
         '-vf', f'select={select},scale={args.width}:-2,setsar=1', '-fps_mode', 'vfr',
         '-frames:v', str(len(frames)), '-q:v', '2', str(frame_dir / 'sample-%04d.jpg')])
    images = sorted(frame_dir.glob('sample-*.jpg'))
    if len(images) != len(frames):
        raise RuntimeError('Actual decoded samples differ from requested count; inspect VFR/frame metadata')
    records = []
    for index, path in zip(frames, images):
        records.append({'frame': index, 'nominalSeconds': index / float(fps),
                        'path': path.relative_to(out).as_posix(), 'sha256': sha256(path)})
    sheets = []
    for portrait in ([False, True] if args.portrait else [False]):
        for offset in range(0, len(records), 12):
            group = records[offset:offset + 12]
            tile = (180, 320) if portrait else (400, 225)
            cols = 4 if portrait else 3
            rows = math.ceil(len(group) / cols)
            sheet = Image.new('RGB', (cols * tile[0], rows * (tile[1] + 28)), '#20252d')
            draw = ImageDraw.Draw(sheet)
            for slot, rec in enumerate(group):
                with Image.open(out / rec['path']) as im:
                    if portrait:
                        w, h = im.size
                        cw = min(w, round(h * 9 / 16))
                        im = im.crop(((w - cw) // 2, 0, (w + cw) // 2, h))
                    image = ImageOps.contain(im.convert('RGB'), tile, Image.Resampling.LANCZOS)
                    x = slot % cols * tile[0]
                    y = slot // cols * (tile[1] + 28)
                    sheet.paste(image, (x + (tile[0] - image.width) // 2, y))
                    draw.text((x + 8, y + tile[1] + 7),
                              f"f{rec['frame']:06d} / ~{rec['nominalSeconds']:.3f}s", fill='white')
            name = f"{'portrait' if portrait else 'contact'}-{offset // 12 + 1:02d}.jpg"
            sheet.save(out / name, quality=91)
            sheets.append(name)
    report = {'source': str(video), 'sourceSha256': sha256(video), 'probe': probe,
              'frameSelection': 'Exact decoded indices; displayed seconds use average fps (approximate for VFR)',
              'samples': records, 'sheets': sheets, 'checks': {
                  'sampleExtraction': 'passed', 'visualReview': 'not_performed',
                  'fullDecode': 'not_performed', 'normalSpeedPlayback': 'not_performed',
                  'subjectiveListening': 'not_performed'}}
    (out / 'review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(out), 'samples': len(records), 'sheets': sheets}, ensure_ascii=False))


if __name__ == '__main__':
    main()
