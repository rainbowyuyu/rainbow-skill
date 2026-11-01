"""Validate optional film-plan v2, or a legacy layered package without migrating it.

Prompt-only work does not require either JSON format. This checks structure,
never semantic completeness, aesthetics, rendering or listening.
"""
import argparse
import json
import math
import importlib.util
from pathlib import Path

LAYERS = ['layer-arrangement', 'layer-3d', 'layer-type', 'layer-audio']
LAYER_WEIGHTS = dict(detail=.20, facts=.15, continuity=.15, expression=.15,
                     motion=.10, rhythm=.10, breathing=.10, integration=.05)
FUSION_WEIGHTS = dict(causality=.20, clock_contact=.20, focus_reading=.20,
                      state_motion=.15, audio_breathing=.15, style_emotion=.10)

def numeric(value):
    return type(value) in (int,float) and math.isfinite(value)

def validate_legacy(root):
    root = Path(root)
    errors, warnings = [], []
    def read(path):
        try:
            return json.loads((root/path).read_text(encoding='utf-8-sig'))
        except (OSError, ValueError) as exc:
            errors.append(f'{path}: {type(exc).__name__}: {exc}')
            return None
    c = read(Path('contract.json'))
    if not isinstance(c, dict):
        return {'passed':False,'errors':errors,'warnings':warnings}
    duration, fps = c.get('duration_seconds'), c.get('fps')
    if type(duration) is not int or duration <= 0 or not numeric(fps) or fps <= 0:
        errors.append('contract: duration_seconds must be positive integer and fps positive')
        return {'passed':False,'errors':errors,'warnings':warnings}
    if c.get('frames') != round(duration*fps):
        errors.append('contract: total frames differ from duration × fps')
    windows=c.get('windows',[])
    expected, cursor = {}, 0
    for w in windows:
        a,b = w.get('start'),w.get('end')
        if type(a) is not int or type(b) is not int or a != cursor or not a < b <= duration:
            errors.append(f'contract window invalid/gap/overlap: {w}')
            continue
        for s in range(a,b): expected[s]=(w.get('id'),w.get('shot_id'))
        cursor=b
    if cursor != duration: errors.append('contract windows do not cover total duration')
    for event,value in c.get('events',{}).items():
        time=value.get('time') if isinstance(value,dict) else value
        if not numeric(time) or not 0 <= time <= duration:
            errors.append(f'contract invalid event time: {event}')
    for layer in LAYERS:
        data=read(Path(layer)/'seconds.json')
        if not isinstance(data,list):
            errors.append(f'{layer}: seconds.json must be a list')
            continue
        seconds=[r.get('second') for r in data if isinstance(r,dict)]
        if seconds != list(range(duration)):
            errors.append(f'{layer}: seconds must cover exactly 0..{duration-1} in order')
        prompts=[]
        for row in data:
            if not isinstance(row,dict):
                errors.append(f'{layer}: row is not object'); continue
            sec=row.get('second')
            if (row.get('window_id'),row.get('shot_id')) != expected.get(sec):
                errors.append(f'{layer} second {sec}: mismatched shared window/shot')
            if row.get('contract_version') != c['version']:
                errors.append(f'{layer} second {sec}: stale contract version')
            if row.get('anchor_id') not in c.get('anchors',[]):
                errors.append(f'{layer} second {sec}: missing or invalid shared anchor')
            if row.get('state') == 'clean-picture' and row.get('on_screen_text'):
                errors.append(f'{layer} second {sec}: clean-picture conflicts with on_screen_text')
            for binding in row.get('dynamic_bindings', []):
                if not isinstance(binding, dict):
                    errors.append(f'{layer} second {sec}: dynamic binding must be an object')
                    continue
                for field in ['event', 'start_event', 'end_event']:
                    if field in binding and binding[field] not in c.get('events', {}):
                        errors.append(f'{layer} second {sec}: dynamic binding references unknown {field}')
            prompt=row.get('prompt')
            if not isinstance(prompt,str) or not prompt.strip():
                errors.append(f'{layer} second {sec}: empty prompt')
            else: prompts.append(prompt)
        if len(prompts)>1 and len(set(prompts)) < len(prompts)*.8:
            warnings.append(f'{layer}: many repeated prompts; review meaningful per-second direction')
        for filename in ['director.md','examples.md','research-constraints.md','self-review.md','shotcraft-read-manifest.json']:
            if not (root/layer/filename).is_file(): errors.append(f'{layer}: missing {filename}')
    cue_path=root/'layer-audio/narration-cues.json'
    if cue_path.is_file():
        cues=read(Path('layer-audio/narration-cues.json'))
        if isinstance(cues,dict): cues=cues.get('cues',[])
        if not isinstance(cues,list): errors.append('narration cues must be array or {cues:array}')
        else:
            end=-1
            for cue in cues:
                a=cue.get('start',cue.get('start_seconds',cue.get('planned_start')))
                b=cue.get('end',cue.get('end_seconds',cue.get('planned_end')))
                if not numeric(a) or not numeric(b) or not 0<=a<b<=duration:
                    errors.append(f'invalid narration cue: {cue.get("id")}'); continue
                if a < end-1e-6: errors.append(f'overlapping narration cue: {cue.get("id")}')
                end=max(end,b)
                for x,y in c.get('narration_free_windows',c.get('audio_silence_windows',[])):
                    if max(a,x)<min(b,y)-1e-6:
                        errors.append(f'narration cue {cue.get("id")} overlaps narration-free {x}..{y}')
    else: warnings.append('No narration cue plan; expected if narration-free video, otherwise supply plan')
    sfx_path=root/'layer-audio/sfx-cues.json'
    if sfx_path.is_file():
        sfx_data=read(Path('layer-audio/sfx-cues.json'))
        spec=importlib.util.spec_from_file_location('director_sfx_validation', Path(__file__).with_name('validate_sfx_cues.py'))
        sfx_module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sfx_module)
        sfx_report=sfx_module.validate(sfx_data,sfx_path.parent,contract=c,stage='design')
        errors.extend('SFX: '+message for message in sfx_report['errors'])
        warnings.extend('SFX: '+message for message in sfx_report['warnings'])
    for filename in ['00-master-index.md','00-baseline-score.md','01-research.md','integrated-script.md']:
        if not (root/filename).is_file(): errors.append(f'missing {filename}')
    score_path=root/'review/scores.json'
    if score_path.is_file():
        scores=read(Path('review/scores.json'))
        if isinstance(scores,dict):
            if scores.get('stage') != 'prompt-design': errors.append('score stage must distinguish prompt-design')
            if sorted(i.get('name','') for i in scores.get('layers',[])) != ['L1','L2','L3','L4']:
                errors.append('scores must contain L1..L4 exactly once')
            if not scores.get('fusion'): errors.append('missing fusion score')
            for item in scores.get('layers',[])+[scores.get('fusion',{})]:
                if not item: continue
                weights=FUSION_WEIGHTS if item is scores.get('fusion') else LAYER_WEIGHTS
                minimum=9.2 if weights is FUSION_WEIGHTS else 9.0
                value=item.get('score'); dims=item.get('dimensions',{}); threshold=item.get('threshold',minimum)
                valid_dims=isinstance(dims,dict) and set(dims)==set(weights) and all(numeric(v) and 0<=v<=10 for v in dims.values())
                if not numeric(value) or not 0<=value<=10:
                    errors.append('invalid score'); continue
                if not valid_dims:
                    errors.append(f'missing/invalid score dimensions: {item.get("name")}'); continue
                if abs(value-sum(dims[k]*weights[k] for k in weights))>.011:
                    errors.append(f'weighted score mismatch: {item.get("name")}')
                if not numeric(threshold) or threshold<minimum:
                    errors.append(f'threshold below default gate: {item.get("name")}'); threshold=minimum
                if type(item.get('hard_conflicts')) is not int or item['hard_conflicts']<0:
                    errors.append(f'missing/invalid hard_conflicts: {item.get("name")}')
                if item.get('status')=='pass' and (value<threshold or any(v<8.5 for v in dims.values()) or item.get('hard_conflicts',1)>0):
                    errors.append(f'claimed pass below gate: {item.get("name")}')
                if not item.get('evidence'): errors.append(f'score missing evidence: {item.get("name")}')
                for evidence in item.get('evidence',[]):
                    if not (root/evidence).is_file(): errors.append(f'missing score evidence file: {evidence}')
    else: errors.append('missing review/scores.json')
    return {'passed':not errors,'scope':'Structural timing/document checks only; not factual, visual or audio approval','duration_seconds':duration,'layer_count':len(LAYERS),'errors':errors,'warnings':warnings}


def validate(root):
    root = Path(root)
    if (root / 'film-plan.json').is_file():
        spec = importlib.util.spec_from_file_location('director_film_plan_v2', Path(__file__).with_name('validate_film_plan.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.validate(root)
    report = validate_legacy(root)
    report['format'] = 'legacy-layered'
    report.setdefault('warnings', []).append('Legacy layered-package checks selected; files and scores were not migrated. New prompt-only work does not require this legacy package.')
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('directory'); p.add_argument('--report')
    a=p.parse_args(); report=validate(a.directory)
    output=json.dumps(report,ensure_ascii=False,indent=2)
    if a.report: Path(a.report).write_text(output+'\n',encoding='utf-8')
    print(output)
    raise SystemExit(0 if report['passed'] else 1)
