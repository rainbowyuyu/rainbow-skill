"""Check an optional v2 film plan's timing and prompt references.

No keyword scoring, rendering, media approval or modification of the package.
Prompt-only work does not need this JSON file or validator.
"""
import argparse
import json
import math
from pathlib import Path


def numeric(value):
    return type(value) in (int, float) and math.isfinite(value)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def validate(root):
    root = Path(root).resolve()
    errors, warnings = [], []
    report = {
        'passed': False,
        'format': 'film-plan-v2',
        'scope': ('Frame coverage, event ownership and nonempty local prompt files only; '
                  'not semantic completeness, rendering, visual continuity or audio approval.'),
        'errors': errors,
        'warnings': warnings,
    }
    try:
        data = json.loads((root / 'film-plan.json').read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as exc:
        errors.append(f'film-plan.json: {type(exc).__name__}: {exc}')
        return report
    if not isinstance(data, dict) or type(data.get('schema_version')) is not int or data['schema_version'] != 2:
        errors.append('film-plan.json must be an object with schema_version: 2')
        return report
    if not nonempty(data.get('title')):
        errors.append('title must be nonempty')
    duration, fps, frames = data.get('duration_seconds'), data.get('fps'), data.get('frame_count')
    if not numeric(duration) or duration <= 0 or not numeric(fps) or fps <= 0:
        errors.append('duration_seconds and fps must be finite and positive')
    if type(frames) is not int or frames <= 0:
        errors.append('frame_count must be a positive integer')
    if errors and (not numeric(duration) or not numeric(fps) or type(frames) is not int):
        return report
    if numeric(duration) and numeric(fps) and type(frames) is int:
        if abs(duration * fps - frames) > 1e-6:
            errors.append('frame_count differs from duration_seconds × fps; resolve the frame duration explicitly')
    report.update(duration_seconds=duration, fps=fps, frame_count=frames)
    if 'loop' in data and type(data['loop']) is not bool:
        errors.append('loop must be true or false when present')
    if data.get('loop') is True:
        warnings.append('Loop position, appearance and velocity at t=0 and t=T require manual/rendered checks; frame coverage does not prove a seamless loop.')

    def prompt_file(value, label):
        if not nonempty(value):
            errors.append(f'{label}: prompt file path is required')
            return
        try:
            path = Path(value)
            if not path.is_absolute():
                path = root / path
            path = path.resolve()
            if not path.is_relative_to(root):
                errors.append(f'{label}: prompt file must stay inside the package')
                return
            content = path.read_text(encoding='utf-8-sig')
            if not content.strip():
                errors.append(f'{label}: prompt file is empty')
        except (OSError, ValueError, RuntimeError) as exc:
            errors.append(f'{label}: cannot read prompt file ({type(exc).__name__})')

    prompt_file(data.get('global_prompt_file'), 'global_prompt_file')
    segments = data.get('segments')
    if not isinstance(segments, list) or not segments:
        errors.append('segments must be a nonempty array')
        return report
    segment_ranges, seen_segments, cursor = {}, set(), 0
    for index, segment in enumerate(segments):
        label = f'segments[{index}]'
        if not isinstance(segment, dict):
            errors.append(f'{label}: segment must be an object')
            continue
        ident = segment.get('id')
        if not nonempty(ident):
            errors.append(f'{label}: id is required')
        elif ident in seen_segments:
            errors.append(f'{label}: duplicate segment id {ident}')
        else:
            seen_segments.add(ident)
        start, end = segment.get('start_frame'), segment.get('end_frame')
        valid_range = (type(start) is int and type(end) is int and
                       type(frames) is int and 0 <= start < end <= frames)
        if not valid_range:
            errors.append(f'{label}: frame interval must satisfy 0 <= start_frame < end_frame <= frame_count')
        else:
            if start != cursor:
                errors.append(f'{label}: segment gap/overlap or wrong order; expected start_frame {cursor}, got {start}')
            cursor = end
            if nonempty(ident) and ident not in segment_ranges:
                segment_ranges[ident] = (start, end)
        prompt_file(segment.get('prompt_file'), label)
        for field in ('entry_state', 'exit_state'):
            if not nonempty(segment.get(field)):
                errors.append(f'{label}: {field} needs a nonempty state description')
        transition = segment.get('transition_out')
        if not isinstance(transition, dict) or not nonempty(transition.get('type')) or not nonempty(transition.get('description')):
            errors.append(f'{label}: transition_out needs nonempty type and description')
        elif transition['type'] == 'end' and index != len(segments) - 1:
            errors.append(f'{label}: end transition may only terminate the last segment')
    if cursor != frames:
        errors.append('segments do not cover the complete frame interval [0, frame_count)')
    events = data.get('events', [])
    if not isinstance(events, list):
        errors.append('events must be an array (may be empty)')
        events = []
    seen_events = set()
    for index, event in enumerate(events):
        label = f'events[{index}]'
        if not isinstance(event, dict):
            errors.append(f'{label}: event must be an object')
            continue
        ident = event.get('id')
        if not nonempty(ident) or ident in seen_events:
            errors.append(f'{label}: id must be nonempty and unique')
        else:
            seen_events.add(ident)
        frame, owner = event.get('frame'), event.get('segment_id')
        if type(frame) is not int or not 0 <= frame < frames:
            errors.append(f'{label}: frame must lie in [0, frame_count)')
            continue
        interval = segment_ranges.get(owner) if isinstance(owner, str) else None
        if interval is None:
            errors.append(f'{label}: unknown segment_id')
        elif not interval[0] <= frame < interval[1]:
            errors.append(f'{label}: frame does not belong to segment_id (left-closed, right-open)')
    report['segment_count'] = len(segments)
    report['event_count'] = len(events)
    report['passed'] = not errors
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    output = json.dumps(validate(args.directory), ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(output + '\n', encoding='utf-8')
    print(output)
    raise SystemExit(0 if json.loads(output)['passed'] else 1)
