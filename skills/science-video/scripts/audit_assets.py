"""Read-only SHA256 audit. Manifest: {assets:[{id,path,sha256,...}]}.
Relative paths resolve under root. External symlink/junction targets require --allow-root.
No source files are modified or deleted. Prints JSON and exits nonzero on mismatch.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--allow-root', type=Path, action='append', default=[])
    args = parser.parse_args()
    root = args.root.resolve(strict=True)
    allowed = [root] + [p.resolve(strict=True) for p in args.allow_root]
    manifest = json.loads(args.manifest.read_text(encoding='utf-8-sig'))
    assets = manifest.get('assets')
    if not isinstance(assets, list) or not assets:
        parser.error('Manifest requires a nonempty assets array')
    seen_ids, seen_paths, results = set(), set(), []
    for asset in assets:
        if not isinstance(asset, dict):
            results.append({'status': 'failed', 'error': 'Asset must be an object'})
            continue
        aid, name = asset.get('id'), asset.get('path')
        result = {'id': aid, 'path': name}
        try:
            if not isinstance(aid, str) or not isinstance(name, str) or not aid or not name or aid in seen_ids or name in seen_paths:
                raise ValueError('Missing/duplicate ID or path')
            seen_ids.add(aid)
            seen_paths.add(name)
            if Path(name).is_absolute() or Path(name).drive:
                raise ValueError('Manifest path must be relative to root')
            target = (root / name).resolve(strict=True)
            if not any(target.is_relative_to(base) for base in allowed):
                raise ValueError('Resolved path outside approved read roots')
            if not target.is_file():
                raise ValueError('Not a regular file')
            expected = asset.get('sha256', '')
            if not re.fullmatch(r'[0-9a-fA-F]{64}', expected):
                raise ValueError('Expected SHA256 missing or invalid')
            digest = hashlib.sha256()
            with target.open('rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(chunk)
            result.update(actualSha256=digest.hexdigest(), bytes=target.stat().st_size)
            if digest.hexdigest() != expected.lower():
                raise ValueError('SHA256 mismatch')
            result['status'] = 'passed'
        except (OSError, ValueError, TypeError) as error:
            result.update(status='failed', error=str(error))
        results.append(result)
    failed = sum(r['status'] != 'passed' for r in results)
    print(json.dumps({'checked': len(results), 'failed': failed, 'results': results}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
