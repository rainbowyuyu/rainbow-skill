import os, sys, json, pathlib
os.environ['HF_HUB_OFFLINE'] = '1'
from faster_whisper import WhisperModel
model_dir, out_dir = sys.argv[1], pathlib.Path(sys.argv[2])
model = WhisperModel(model_dir, device='cpu', compute_type='int8', cpu_threads=8)
for wav in sys.argv[3:]:
    segs, info = model.transcribe(wav, language='zh', beam_size=5, vad_filter=True, word_timestamps=True,
                                  initial_prompt='以下是普通话的科普视频旁白，使用简体中文和标点。')
    rows = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segs]
    name = pathlib.Path(wav).stem.split('.')[0]
    (out_dir / f'{name}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), 'utf8')
    (out_dir / f'{name}.txt').write_text('\n'.join(f"[{r['start']:7.2f}-{r['end']:7.2f}] {r['text']}" for r in rows), 'utf8')
    print('DONE', name, len(rows), flush=True)
