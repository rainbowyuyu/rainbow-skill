"""Frame-level style metrics per video: cuts, motion energy, brightness, palette, text area."""
import sys, json, os
import numpy as np, cv2

path, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
rows = []
prev_gray = None
prev_hist = None
i = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    t = i / fps
    small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [24, 8], [0, 180, 0, 256]).flatten()
    hist /= (hist.sum() + 1e-9)
    d_hist = float(np.sum(np.abs(hist - prev_hist)) / 2) if prev_hist is not None else 0.0
    d_pix = float(np.mean(np.abs(gray - prev_gray))) if prev_gray is not None else 0.0
    # per-cell motion (8x5 grid) so we can see where movement happens
    cells = ''
    if prev_gray is not None:
        diff = np.abs(gray - prev_gray)
        gh, gw = diff.shape
        grid = np.array([[diff[r * gh // 5:(r + 1) * gh // 5, c * gw // 8:(c + 1) * gw // 8].mean()
                          for c in range(8)] for r in range(5)])
        cells = ''.join(' .:-=+*#%@'[min(9, int(v / 3))] for v in grid.flatten())
        cellvals = [round(float(v), 2) for v in grid.flatten()]
    else:
        cellvals = []
    # saturation & value stats, edge density (text/complexity proxy)
    sat = float(hsv[..., 1].mean()); val = float(hsv[..., 2].mean())
    edges = cv2.Canny(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), 60, 140)
    edge_density = float((edges > 0).mean())
    # dominant colours (top 3 k-means on a subsample)
    pix = small.reshape(-1, 3)[::7].astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, lab, cen = cv2.kmeans(pix, 3, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    share = np.bincount(lab.flatten(), minlength=3) / len(lab)
    order = np.argsort(-share)
    pal = [{'hex': '#%02x%02x%02x' % tuple(int(v) for v in cen[k][::-1]), 'share': round(float(share[k]), 2)} for k in order]
    rows.append({'t': round(t, 3), 'hist_diff': round(d_hist, 3), 'pix_diff': round(d_pix, 2),
                 'sat': round(sat, 1), 'val': round(val, 1), 'edges': round(edge_density, 3),
                 'pal': pal, 'grid': cellvals, 'cells': cells})
    prev_gray = gray; prev_hist = hist
    i += 1
cap.release()

# cut detection: local maxima of hist_diff above threshold, min gap .4 s
hd = np.array([r['hist_diff'] for r in rows])
thr = max(0.35, float(np.percentile(hd, 92)))
cuts = []
for k in range(1, len(rows) - 1):
    if hd[k] > thr and hd[k] >= hd[k - 1] and hd[k] >= hd[k + 1]:
        if not cuts or rows[k]['t'] - cuts[-1] > 0.35:
            cuts.append(rows[k]['t'])
json.dump({'fps': fps, 'frames': n, 'size': [w, h], 'duration': n / fps,
           'cut_threshold': round(thr, 3), 'cuts': cuts, 'frames_data': rows},
          open(os.path.join(outdir, 'frames.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(json.dumps({'file': os.path.basename(path), 'dur': round(n / fps, 2), 'cuts': len(cuts),
                  'cut_rate_per_sec': round(len(cuts) / (n / fps), 2),
                  'mean_pix_diff': round(float(np.mean([r['pix_diff'] for r in rows[1:]])), 2)}, ensure_ascii=False))
