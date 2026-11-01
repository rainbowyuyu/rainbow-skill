"""Plan/apply reviewed, same-volume publication moves. Never copies or deletes media."""
import argparse, ctypes, hashlib, json, os, re, subprocess, time
from pathlib import Path
from ctypes import wintypes as wt
from PIL import Image

RATIOS = {'16x9', '4x3', '3x4', '9x16'}
SKIP = {'node_modules', '.git', '.venv', '.venv312', '.vendor', '__pycache__'}

def safe(path, root):
    p = Path(os.path.abspath(path))
    p.relative_to(root)
    if any(q.is_symlink() or q.is_junction() for q in [p, *p.parents]):
        raise ValueError(f'Linked path: {p}')
    return p

def sha(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def stamp(p):
    s = p.stat()
    return [s.st_size, s.st_mtime_ns, s.st_ctime_ns]

def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.partial')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)

def project_state(p, ignore_publish=False):
    latest = 0
    for b, ds, fs in os.walk(p, followlinks=False, onerror=lambda e: (_ for _ in ()).throw(e)):
        ds[:] = [d for d in ds if d not in SKIP and not (ignore_publish and Path(b)==p and d=='publish') and not (Path(b)/d).is_junction() and not (Path(b)/d).is_symlink()]
        for f in fs:
            q = Path(b)/f
            if q.is_symlink(): continue
            s = q.stat(); latest = max(latest, s.st_mtime, s.st_ctime)
    return latest

def process_cwd(pid):
    # Read-only Windows x64 PEB query, needed for relative `node ./server.mjs` commands.
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    nt = ctypes.WinDLL('ntdll')
    k.OpenProcess.restype = wt.HANDLE
    k.OpenProcess.argtypes = [wt.DWORD, wt.BOOL, wt.DWORD]
    k.ReadProcessMemory.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
    k.CloseHandle.argtypes = [wt.HANDLE]
    h = k.OpenProcess(0x410, False, pid)
    if not h: return None
    try:
        a = (ctypes.c_ulonglong*6)(); n = wt.ULONG()
        if nt.NtQueryInformationProcess(ctypes.c_void_p(h), 0, ctypes.byref(a), ctypes.sizeof(a), ctypes.byref(n)) != 0: return None
        def read(addr, size):
            b = ctypes.create_string_buffer(size); got = ctypes.c_size_t()
            if not k.ReadProcessMemory(h, addr, b, size, ctypes.byref(got)): raise OSError('Unreadable process cwd')
            return b.raw
        pp = int.from_bytes(read(a[1]+0x20, 8), 'little')
        u = read(pp+0x38, 16)
        return read(int.from_bytes(u[8:16], 'little'), int.from_bytes(u[:2], 'little')).decode('utf-16-le')
    except OSError: return None
    finally: k.CloseHandle(h)

def processes():
    cmd = "Get-CimInstance Win32_Process | Where-Object {$_.Name -match '^(node|python(?:\\d+(?:\\.\\d+)*)?w?|ffmpeg|blender|chrome-headless-shell)\\.exe$'} | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"
    x = subprocess.run(['powershell', '-NoProfile', '-Command', cmd], capture_output=True, text=True, check=True)
    rows = json.loads(x.stdout or '[]'); rows = rows if isinstance(rows, list) else [rows]
    return [{**p, 'cwd': process_cwd(p['ProcessId'])} for p in rows if p['ProcessId'] != os.getpid()]

def guard(root, names, procs, ignore_publish=False):
    cutoff = time.time()-3*86400
    for name in names:
        p = safe(root/name, root)
        if p.parent != root or not p.is_dir() or name.startswith(('_', '.')): raise ValueError('Invalid project')
        if name == 'rainbow_arc_2026_v16' or (p/'.rainbow-clean-keep').exists(): raise ValueError(f'Protected: {name}')
        family = re.sub(r'_v\d+$', '', name, flags=re.I)
        versions = sorted([int(m[1]) for q in root.iterdir() if (m := re.fullmatch(re.escape(family)+r'_v(\d+)', q.name, re.I))], reverse=True)
        m = re.search(r'_v(\d+)$', name, re.I)
        if versions and (not m or int(m[1]) in versions[:2]): raise ValueError(f'Current family or obsolete base: {name}')
        if project_state(p, ignore_publish) >= cutoff: raise ValueError(f'Active within 3 days: {name}')
        for proc in procs:
            cmd = (proc.get('CommandLine') or '').lower()
            cwd = proc['cwd']
            if not cmd and not cwd: raise ValueError(f'Unresolved process {proc["ProcessId"]}')
            if name.lower() in cmd or (cwd and Path(cwd).is_relative_to(p)):
                raise ValueError(f'Running project: {name} / {proc["ProcessId"]}')
            if not cwd and ('./' in cmd or '.\\' in cmd): raise ValueError(f'Unresolved relative process {proc["ProcessId"]}')

def inspect_file(p, role, ffprobe):
    info = {'sha256': sha(p), 'stamp': stamp(p)}
    if role.startswith('cover:'):
        ratio = role.split(':')[1]
        if ratio not in RATIOS: raise ValueError('Unknown cover ratio')
        with Image.open(p) as im:
            w,h = im.size; im.verify()
        a,b = map(int, ratio.split('x'))
        if w*b != h*a or min(w,h) < 720: raise ValueError(f'Incorrect cover shape: {p}')
        info['dimensions'] = [w,h]
    elif role == 'video':
        x = subprocess.run([ffprobe,'-v','error','-show_entries','stream=codec_type,width,height:format=duration','-of','json',str(p)], capture_output=True, text=True, check=True)
        d = json.loads(x.stdout)
        if float(d['format']['duration']) <= 0 or not any(s['codec_type']=='video' for s in d['streams']): raise ValueError(f'Invalid video: {p}')
        info['probe'] = d
    elif role == 'copy':
        if not p.read_text('utf-8-sig').strip(): raise ValueError('Empty release copy')
    return info

def validate_package(pkg, root):
    dest = safe(root/pkg['destination'], root)
    if 'publish' not in dest.relative_to(root).parts: raise ValueError('Destination must be under publish')
    names = set(pkg['projects'])
    if dest.relative_to(root).parts[0] not in names: raise ValueError('Destination project not protected by guard')
    if not pkg.get('evidence'): raise ValueError('Latest-version evidence required')
    topics = set(pkg['topics']); roles = {t:set() for t in topics}
    for f in pkg['files']:
        s = safe(root/f['source'], root); d = safe(dest/f['destination'], root)
        if s.relative_to(root).parts[0] not in names or not d.is_relative_to(dest): raise ValueError('File escapes package scope')
        if s == d: raise ValueError('Source equals destination')
        for t in f['topics']: roles[t].add(f['role'])
    for t,r in roles.items():
        if not {'video','copy',*(f'cover:{r}' for r in RATIOS)}.issubset(r): raise ValueError(f'Incomplete package: {t}')
    return dest

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=r'D:\projects\manim_extend_rainbow\video_project')
    ap.add_argument('--spec'); ap.add_argument('--reviewed'); ap.add_argument('--apply', action='store_true')
    ap.add_argument('--report', required=True); ap.add_argument('--ffprobe', default=r'C:\ffmpeg\bin\ffprobe.exe')
    a = ap.parse_args(); root = Path(os.path.abspath(a.root)); safe(root, root)
    if a.apply and not a.reviewed: raise ValueError('Apply requires reviewed plan')
    data = json.loads(Path(a.reviewed or a.spec).read_text('utf-8-sig'))
    report = Path(a.report)
    if report.exists(): raise ValueError('Use a new report filename')
    lock = root.parent/'work'/'rainbow-version-storage.lock'; lock.parent.mkdir(exist_ok=True)
    import msvcrt
    with lock.open('a+b') as lf:
        lf.seek(0); msvcrt.locking(lf.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            result = {'schema':1, 'root':str(root), 'time':time.time(), 'mode':'apply' if a.apply else 'scan', 'packages':[], 'skipped':[], 'failures':[], 'deferred':data.get('deferred',[])}
            procs = processes(); seen = set(); destinations = set()
            # Validate ALL packages and ages before creating receipts in shared projects.
            for pkg in data['packages']:
                dest = validate_package(pkg, root)
                receipt = dest/'publish-manifest.json'
                if receipt.exists():
                    old = json.loads(receipt.read_text('utf-8'))
                    if old.get('status') != 'organized': raise ValueError('Prior incomplete move needs recovery')
                    if old['id'] != pkg['id']: raise ValueError('Existing different release; review history move separately')
                    expected={(f['source'],f['destination']) for f in pkg['files']}
                    actual={(f['source'],f['destination']) for f in old['files']}
                    if expected != actual: raise ValueError('Release selection changed under existing id')
                    for f in old['files']:
                        if sha(safe(dest/f['destination'],root)) != f['sha256']: raise ValueError('Published file changed')
                        if safe(root/f['source'],root).exists(): raise ValueError('Original output was recreated; review whether a newer release exists')
                    result['skipped'].append({'id':pkg['id'],'reason':'already organized and hashes verified'});continue
                if (dest/'README.md').exists(): raise ValueError('Existing unmanaged publish README; review before merging')
                guard(root, pkg['projects'], procs)
                out = {**pkg, 'files':[]}
                for f in pkg['files']:
                    s = safe(root/f['source'],root); d = safe(dest/f['destination'],root)
                    if str(s).lower() in seen or str(d).lower() in destinations: raise ValueError('Duplicate move')
                    seen.add(str(s).lower()); destinations.add(str(d).lower())
                    if d.exists(): raise ValueError(f'No overwrite: {d}')
                    info = inspect_file(s,f['role'],a.ffprobe)
                    if a.apply and (info['sha256'] != f['sha256'] or info['stamp'] != f['stamp']): raise ValueError(f'Source changed: {s}')
                    out['files'].append({**f, **info})
                result['packages'].append(out)
            save(report,result)
            if not a.apply:
                print(json.dumps({'packages':len(result['packages']),'files':sum(len(p['files']) for p in result['packages']),'report':str(report)}));return
            for pkg in result['packages']:
                dest=safe(root/pkg['destination'],root); moved=[]
                try:
                    guard(root,pkg['projects'],processes(),ignore_publish=True)
                    for f in pkg['files']:
                        s=safe(root/f['source'],root);d=safe(dest/f['destination'],root)
                        if stamp(s)!=f['stamp'] or sha(s)!=f['sha256']: raise ValueError(f'Changed since preflight: {s}')
                        d.parent.mkdir(parents=True,exist_ok=True)
                        f['state']='moving';save(report,result)
                        # os.rename on Windows refuses an existing destination; same-volume move only.
                        if s.drive.lower()!=d.drive.lower():raise ValueError('Cross-volume move refused')
                        os.rename(s,d);moved.append((s,d));f['state']='moved';save(report,result)
                        if s.exists() or sha(d)!=f['sha256']:raise ValueError('Post-move validation failed')
                    pkg['status']='organized'
                    save(dest/'publish-manifest.json',pkg)
                    lines=['# 发布文件夹','', '已实际移动文件；未代为发布到任何平台。既有人工验收状态不因规整而改变。', '', '重新渲染前：旧脚本可能引用原路径，请按 publish-manifest.json 更新具体输入/输出路径，或先将相关文件移回原位；不要复制出第二套。', '', '## 文件']
                    lines += [f"- [{f['destination']}]({f['destination']}) — {f['role']}" for f in pkg['files']]
                    lines += ['', '## 版本依据', pkg['evidence']]
                    (dest/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
                except Exception as e:
                    pkg['status']='failed';pkg['error']=str(e)
                    for s,d in reversed(moved):
                        try:
                            safe(s,root);safe(d,root)
                            if s.exists():raise ValueError('Rollback destination occupied')
                            os.rename(d,s)
                        except Exception as rollback:pkg.setdefault('rollback_errors',[]).append(str(rollback))
                    result['failures'].append({'id':pkg['id'],'error':str(e)})
                    if (dest/'publish-manifest.json').exists(): save(dest/'publish-manifest.json',pkg)
                    save(report,result);raise
                save(report,result)
            print(json.dumps({'organized':len(result['packages']),'skipped':len(result['skipped']),'files':sum(len(p['files']) for p in result['packages']),'bytes_moved':sum(f['stamp'][0] for p in result['packages'] for f in p['files']),'bytes_freed':0,'report':str(report)}))
        finally:
            lf.seek(0);msvcrt.locking(lf.fileno(),msvcrt.LK_UNLCK,1)

if __name__ == '__main__': main()
