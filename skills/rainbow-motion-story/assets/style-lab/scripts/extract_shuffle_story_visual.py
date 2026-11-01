"""Extend visual-only shuffle study; never modify prior shuffle-rhythm evidence.

Source and PTS extraction are reused from the audited extractor. This wrapper
uses its own visual-prefixed directories and manifest. Run --overview first,
inspect contact sheets, then supply --windows '[[start,end,stepFrames],...]'.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('shuffle_visual_core', ROOT / 'scripts/extract_shuffle_rhythm.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
core.EVIDENCE = ROOT / 'evidence/shuffle-story'
core.WORK = ROOT / 'work/shuffle-story/visual-extraction'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--overview', action='store_true')
    parser.add_argument('--windows', type=core.windows_from_argument)
    args = parser.parse_args()
    if not args.overview and not args.windows:
        parser.error('Select --overview or provide --windows')
    digest = core.sha256(core.SOURCE)
    if digest != core.EXPECTED_SHA256:
        raise ValueError('Original source hash changed')
    stream = core.probe(core.SOURCE)
    core.EVIDENCE.mkdir(parents=True, exist_ok=True)
    core.WORK.mkdir(parents=True, exist_ok=True)
    target = core.EVIDENCE / 'visual-manifest.json'
    manifest = json.loads(target.read_text('utf8')) if target.exists() else {
        'schema': 'motion-atelier.shuffle-story-visual/v1',
        'source': str(core.SOURCE).replace('\\', '/'), 'sourceSha256': digest,
        'sourceStream': stream, 'sourceFrameNumberBase': 0,
        'sourceNotCopied': True, 'subjectiveListening': False,
        'priorReadOnlyEvidence': 'evidence/shuffle-rhythm/visual-manifest.json',
        'reviewStatus': 'awaitingReview', 'groups': []
    }
    if manifest['sourceSha256'] != digest:
        raise ValueError('Manifest source differs')
    windows = ([[0, float(stream['duration']), 60]] if args.overview else []) + (args.windows or [])
    final = math.ceil(float(stream['duration']) * 30) - 1
    for start, end, step in windows:
        if end > float(stream['duration']):
            raise ValueError('Window outside source')
        safe = lambda v: f'{v:g}'.replace('.', 'p')
        name = f'visual-{safe(start)}-{safe(end)}-step{step}'
        group = core.extract(name, math.ceil(start * 30 - 1e-9), min(final, math.floor(end * 30 + 1e-9)), step, stream, digest)
        manifest['groups'] = [g for g in manifest['groups'] if g['id'] != group['id']] + [group]
        core.write_json(target, manifest)
    print(json.dumps({'manifest': str(target), 'groups': len(manifest['groups']), 'entries': sum(len(g['frames']) for g in manifest['groups'])}))


if __name__ == '__main__':
    main()
