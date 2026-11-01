"""Two-phase, dependency-protected cleanup after a complete video passes QA.

No recursive removal and no link traversal. All paths are project-relative.
Usage: version_cleanup.py plan|apply --root PROJECT --config POLICY --manifest JSON
"""
from __future__ import annotations
import argparse
import ctypes
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
from datetime import datetime, timezone


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.writing')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temp, path)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def linked(path):
    s = path.lstat()
    return stat.S_ISLNK(s.st_mode) or bool(getattr(s, 'st_file_attributes', 0) & 0x400)


def within(path, parent):
    return path == parent or parent in path.parents


def safe(root, value):
    rel = Path(value)
    if rel.is_absolute() or rel.drive or '..' in rel.parts or ':' in str(rel):
        raise ValueError(f'Not a safe relative path: {value}')
    p = root / rel
    if p == root or not within(p, root):
        raise ValueError(f'Outside project / project root: {value}')
    for part in [root, *reversed(p.relative_to(root).parents), rel]:
        # Check every existing parent without resolving a link into its target.
        current = part if part == root else root / part
        if os.path.lexists(current) and linked(current):
            raise ValueError(f'Link/reparse point refused: {current}')
    return p


def files(root, skipped, recursive=True):
    if not root.exists():
        return
    if linked(root):
        skipped.append({'path': str(root), 'reason': 'link/reparse point'})
        return
    if root.is_file():
        yield root
        return
    for base, dirs, names in os.walk(root, followlinks=False):
        b = Path(base)
        for name in list(dirs):
            if linked(b / name):
                skipped.append({'path': str(b / name), 'reason': 'link/reparse point'})
                dirs.remove(name)
        for name in names:
            p = b / name
            if linked(p):
                skipped.append({'path': str(p), 'reason': 'link/reparse point'})
            elif p.is_file():
                yield p
        if not recursive:
            break


def activity(config):
    patterns = config.get('active_process_patterns', [])
    if os.name != 'nt' or not patterns:
        return
    result = subprocess.run(['powershell', '-NoProfile', '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'],
        capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
    rows = json.loads(result.stdout or '[]')
    for row in rows if isinstance(rows, list) else [rows]:
        if row['ProcessId'] == os.getpid():
            continue
        cmd = row.get('CommandLine') or ''
        if any(re.search(pattern, cmd, re.I) for pattern in patterns):
            # Never echo full command lines; these may contain credentials.
            raise RuntimeError(f'Active production process detected: PID {row["ProcessId"]}')


def pid_alive(pid):
    if pid <= 0:
        return False
    if os.name != 'nt':
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
    # Windows does not implement os.kill(pid, 0). Query a limited handle and
    # close it immediately; this does not signal or alter the process.
    kernel = ctypes.windll.kernel32
    handle = kernel.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return False
    kernel.CloseHandle(handle)
    return True


def gate(root, config):
    final = safe(root, config['final_file'])
    qa_path = safe(root, config['qa_file'])
    qa = read(qa_path)
    checks = qa.get('checks', {})
    if qa.get('errors') != [] or checks.get('fullDecode') != 'passed':
        raise ValueError('Complete final QA is required; failed/partial output cannot trigger cleanup')
    actual = sha(final)
    if actual != checks.get('finalSHA256'):
        raise ValueError('Final file does not match the QA SHA256')
    protected = [safe(root, s) for s in config['protected_paths']]
    protected += [final, qa_path]
    required = [safe(root, s) for s in config['required_files']]
    for p in required:
        if not p.is_file():
            raise ValueError(f'Missing required input: {p}')
    return protected + required, actual


def allowed_target(root, value):
    p = safe(root, value)
    parts = p.relative_to(root).parts
    # Original inputs, source, checkpoints and research are never cleanup roots.
    if not (parts[0].lower() == 'output' and len(parts) >= 2
            or parts[0].lower().startswith('tmp')
            or tuple(s.lower() for s in parts[:2]) == ('public', 'frame-cache') and len(parts) >= 3):
        raise ValueError(f'Cleanup root is not a supported intermediate directory: {value}')
    return p


def snapshot(p):
    s = p.stat()
    return {'bytes': s.st_size, 'mtime_ns': s.st_mtime_ns}


def build_plan(root, config, config_path, manifest):
    protected, final_hash = gate(root, config)
    activity(config)
    candidates, skipped, seen = [], [], set()
    verification_hashes = {}
    for rule in config['rules']:
        target = allowed_target(root, rule['target'])
        kind = rule['kind']
        if kind not in ('duplicate_tree', 'regenerable'):
            raise ValueError(f'Unsupported rule: {kind}')
        if kind == 'regenerable' and not rule.get('rebuild'):
            raise ValueError('Regenerable inputs need an explicit rebuild command/explanation')
        source = safe(root, rule['source']) if kind == 'duplicate_tree' else None
        audit_path = safe(root, rule['verification']) if rule.get('verification') else None
        audit = read(audit_path) if audit_path else None
        if audit_path:
            verification_hashes[rule['verification']] = sha(audit_path)
        audit_rows = {x.get('path'): x for x in (audit or {}).get('files', [])
                      if x.get('status') == 'identical'}
        for p in files(target, skipped, recursive=rule.get('recursive', True)):
            rel = p.relative_to(root).as_posix()
            if rel in seen:
                continue
            if not any(fnmatch.fnmatch(p.name, pattern) for pattern in rule.get('include', ['*'])):
                continue
            if any(within(p, x) for x in protected) or p in (config_path, manifest):
                skipped.append({'path': rel, 'reason': 'protected dependency'})
                continue
            entry = {'path': rel, **snapshot(p), 'reason': rule['reason'], 'kind': kind}
            if source:
                original = safe(root, (source / p.relative_to(target)).relative_to(root).as_posix())
                verified = audit_rows.get(rel)
                if verified:
                    expected_source = verified.get('source')
                    expected_sha = verified.get('sha256')
                    if (expected_source != original.relative_to(root).as_posix()
                            or verified.get('bytes') != entry['bytes']
                            or not original.is_file()
                            or sha(original) != expected_sha
                            or sha(p) != expected_sha):
                        skipped.append({'path': rel, 'reason': 'verification record differs; retained'})
                        continue
                    entry['verification'] = str(rule['verification'])
                elif not original.is_file() or original.stat().st_size != entry['bytes'] or sha(p) != sha(original):
                    skipped.append({'path': rel, 'reason': 'missing/different original; retained'})
                    continue
                entry.update(original=original.relative_to(root).as_posix(), sha256=expected_sha if verified else sha(original))
            candidates.append(entry)
            seen.add(rel)
    # A surviving duplicate source can never itself be a deletion candidate.
    originals = {x['original'] for x in candidates if 'original' in x}
    for entry in candidates[:]:
        if entry['path'] in originals:
            candidates.remove(entry)
            skipped.append({'path': entry['path'], 'reason': 'surviving duplicate original'})
    plan = {'schema': 1, 'root': str(root), 'created_at': datetime.now(timezone.utc).isoformat(),
        'config_sha256': sha(config_path), 'final_sha256': final_hash,
        'verification_sha256': verification_hashes,
        'files': candidates, 'skipped': skipped, 'planned_bytes': sum(x['bytes'] for x in candidates),
        'free_before': shutil.disk_usage(root).free, 'status': 'planned'}
    save(manifest, plan)
    return {'status': plan['status'], 'files': len(candidates), 'bytes': plan['planned_bytes'], 'skipped': len(skipped)}


def apply_plan(root, config, config_path, manifest):
    plan = read(manifest)
    protected, final_hash = gate(root, config)
    if plan['status'] != 'planned' or plan['root'] != str(root) or plan['config_sha256'] != sha(config_path) or plan['final_sha256'] != final_hash:
        raise ValueError('Plan already applied, stale, or made for a different project/configuration')
    for rel, digest in plan.get('verification_sha256', {}).items():
        if sha(safe(root, rel)) != digest:
            raise ValueError(f'Verification record changed since planning: {rel}')
    activity(config)
    entries = plan['files']
    rules = [(allowed_target(root, r['target']), r) for r in config['rules']]
    for entry in entries:
        p = safe(root, entry['path'])
        matched = [r for target, r in rules if within(p, target) and r['kind'] == entry['kind']
                   and any(fnmatch.fnmatch(p.name, pat) for pat in r.get('include', ['*']))]
        if not matched or any(within(p, x) for x in protected) or p in (manifest, config_path):
            raise ValueError(f'Unapproved/protected entry: {p}')
        if snapshot(p) != {k: entry[k] for k in ('bytes', 'mtime_ns')}:
            raise ValueError(f'File changed since planning: {p}')
        if 'original' in entry:
            original = safe(root, entry['original'])
            expected = [safe(root, r['source']) / p.relative_to(allowed_target(root, r['target'])) for r in matched]
            if original not in expected or original.stat().st_size != entry['bytes']:
                raise ValueError(f'Duplicate no longer matches retained original: {p}')
            if sha(original) != entry['sha256'] or sha(p) != entry['sha256']:
                raise ValueError(f'Duplicate no longer matches retained original: {p}')
    # Keep a durable per-file journal if execution is interrupted.
    journal = manifest.with_suffix('.deleted.jsonl')
    removed = 0
    with journal.open('x', encoding='utf-8') as log:
        for entry in entries:
            p = safe(root, entry['path'])
            if snapshot(p) != {k: entry[k] for k in ('bytes', 'mtime_ns')}:
                raise ValueError(f'File changed during cleanup: {p}')
            p.unlink()
            removed += entry['bytes']
            log.write(json.dumps({'path': entry['path'], 'bytes': entry['bytes']}, ensure_ascii=False) + '\n')
            log.flush()
    try:
        _, after_hash = gate(root, config)
    except Exception as exc:
        plan.update(status='partial', deleted_bytes=removed, deleted_files=len(entries),
                    free_after=shutil.disk_usage(root).free,
                    error_after_delete=str(exc), finished_at=datetime.now(timezone.utc).isoformat())
        save(manifest, plan)
        raise
    plan.update(status='applied', deleted_bytes=removed, deleted_files=len(entries),
                free_after=shutil.disk_usage(root).free, final_sha256_after=after_hash,
                finished_at=datetime.now(timezone.utc).isoformat())
    save(manifest, plan)
    return {k: plan[k] for k in ('status', 'deleted_files', 'deleted_bytes', 'free_before', 'free_after', 'final_sha256_after')}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('mode', choices=['plan', 'apply'])
    ap.add_argument('--root', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--manifest', required=True)
    a = ap.parse_args()
    raw_root = Path(os.path.abspath(a.root))
    for p in [raw_root, *raw_root.parents]:
        if linked(p):
            raise ValueError(f'Project path crosses a link: {p}')
    root = raw_root.resolve(strict=True)
    if root.parent == root:
        raise ValueError('A filesystem drive is not a project')
    config_path, manifest = safe(root, a.config), safe(root, a.manifest)
    config = read(config_path)
    lock = root / '.version-cleanup.lock'
    # A cancelled planning process can leave its lock behind. Reclaim only when
    # the recorded PID is no longer alive; never override a live cleanup.
    if lock.exists():
        try:
            old_pid = int(lock.read_text(encoding='ascii').strip())
            if pid_alive(old_pid):
                raise RuntimeError(f'Cleanup lock is held by active PID {old_pid}')
            lock.unlink()
        except (ValueError, FileNotFoundError, ProcessLookupError, PermissionError):
            lock.unlink()
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        result = (build_plan if a.mode == 'plan' else apply_plan)(root, config, config_path, manifest)
        print(json.dumps(result, ensure_ascii=False))
    finally:
        lock.unlink()


if __name__ == '__main__':
    main()
