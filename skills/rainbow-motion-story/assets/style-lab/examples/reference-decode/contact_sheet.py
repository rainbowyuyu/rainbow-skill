"""Contact sheets with timestamp labels + motion/audio overlay charts."""
import sys, os, json
import numpy as np, cv2
from PIL import Image, ImageDraw

vid, outdir, tag, start, end, step = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
cols, rows, tw = 5, 6, 320
cap = cv2.VideoCapture(vid)
fps = cap.get(cv2.CAP_PROP_FPS)
times = np.arange(start, min(end, cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps), step)
os.makedirs(outdir, exist_ok=True)
batch, sheet_i = [], 0
def flush(batch, idx):
    th = int(tw * 9 / 16)
    sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), 'black')
    d = ImageDraw.Draw(sheet)
    for k, (t, img) in enumerate(batch):
        c, r = k % cols, k // cols
        im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).resize((tw, th))
        sheet.paste(im, (c * tw, r * (th + 18)))
        d.text((c * tw + 4, r * (th + 18) + th + 3), f'{t:6.2f}s', fill=(255, 220, 0))
    sheet.save(f'{outdir}/{tag}-sheet{idx:02d}.jpg', quality=88)
for t in times:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, fr = cap.read()
    if not ok:
        break
    batch.append((t, fr))
    if len(batch) == cols * rows:
        flush(batch, sheet_i); sheet_i += 1; batch = []
if batch:
    flush(batch, sheet_i)
print('sheets', sheet_i + (1 if batch else 0))
