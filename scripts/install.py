"""Copy selected public skills without overwriting local work. No network calls."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]

def tree_digest(directory: Path) -> dict[str, str]:
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob('*') if p.is_file() and '__pycache__' not in p.parts}

def resolve_selection(root: Path, requested: list[str], with_deps: bool) -> list[str]:
    catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
    entries = {s['id']: s for s in catalog['skills']}
    selected: set[str] = set()
    pending = list(requested)
    while pending:
        name = pending.pop()
        if name not in entries or entries[name]['status'] != 'bundled':
            raise ValueError(f'Not a bundled skill: {name}')
        if name in selected:
            continue
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
            raise ValueError(f'Unsafe skill id: {name}')
        selected.add(name)
        folder = root / 'skills' / name
        if not (folder / 'SKILL.md').is_file():
            raise ValueError(f'Missing SKILL.md: {name}')
        if with_deps:
            for file in folder.rglob('*.md'):
                for link in re.findall(r'\]\(([^\n)]+)\)', file.read_text(encoding='utf-8')):
                    if ':' in link or link.startswith('#'):
                        continue
                    target = (file.parent / link.split('#')[0]).resolve()
                    try:
                        dep = target.relative_to((root / 'skills').resolve()).parts[0]
                    except (ValueError, IndexError):
                        continue
                    if dep in entries and entries[dep]['status'] == 'bundled' and dep not in selected:
                        pending.append(dep)
    return sorted(selected)

def install(root: Path, target: Path, names: list[str], dry_run: bool = False) -> list[dict]:
    # Check every destination before the first write, including symlinks/junctions.
    actions = []
    for name in names:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', name):
            raise ValueError(f'Unsafe skill id: {name}')
        source = root / 'skills' / name
        if not (source / 'SKILL.md').is_file():
            raise ValueError(f'Missing SKILL.md: {name}')
        destination = target / name
        if destination.exists() or destination.is_symlink():
            if destination.is_dir() and tree_digest(source) == tree_digest(destination):
                action = 'unchanged'
            else:
                raise FileExistsError(f'Existing skill differs; nothing overwritten: {destination}')
        else:
            action = 'copy'
        actions.append({'skill': name, 'action': action, 'destination': str(destination)})
    if not dry_run:
        target.mkdir(parents=True, exist_ok=True)
        for item in actions:
            if item['action'] == 'copy':
                shutil.copytree(root / 'skills' / item['skill'], Path(item['destination']))
    return actions

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true', help='List bundled skills without installing')
    parser.add_argument('--skill', action='append', default=[], help='Bundled skill id; repeatable')
    parser.add_argument('--target', type=Path, help='Target skills directory')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--no-deps', action='store_true', help='Do not include linked bundled skills')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))
    if args.list:
        for skill in catalog['skills']:
            if skill['status'] == 'bundled':
                print(f'{skill["id"]}\t{skill["category"]}')
        return 0
    if not args.skill:
        parser.error('Choose --skill NAME or --list; no files were copied.')
    target = args.target or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
    try:
        names = resolve_selection(ROOT, args.skill, not args.no_deps)
        actions = install(ROOT, target.expanduser().absolute(), names, args.dry_run)
    except (ValueError, FileExistsError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps({'dry_run': args.dry_run, 'actions': actions}, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
