"""Validate the public package structure without running imported skill code."""
from pathlib import Path
import ast
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
TEXT={'.md','.txt','.json','.yaml','.yml','.py','.js','.mjs','.ts','.tsx','.jsx','.css','.html','.ps1','.sh','.cmd','.toml'}
DENIED={'.dpapi','.pem','.key','.mp3','.wav','.mp4','.blend','.7z','.zip','.pt','.pth','.safetensors'}
SECRET=re.compile(r'(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)')
def main():
    errors=[]; files=0
    catalog=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
    names=[s['id'] for s in catalog['skills']]
    if len(set(names))!=len(names):errors.append('Duplicate catalog ids')
    for s in catalog['skills']:
        if not (ROOT/s['path']).is_file():errors.append('Missing catalog target: '+s['id'])
        if s['status']=='bundled':
            text=(ROOT/s['path']).read_text(encoding='utf-8')
            if not text.startswith('---\n'):errors.append('Missing frontmatter: '+s['id'])
            if s.get('licenses'):
                for license in s['licenses']:
                    if not (ROOT/'skills'/s['id']/license['file']).is_file():errors.append('Missing license: '+s['id'])
    for p in ROOT.rglob('*'):
        if not p.is_file() or any(x in p.parts for x in ['.git','__pycache__']):continue
        files+=1;rel=p.relative_to(ROOT).as_posix()
        if p.suffix.lower() in DENIED or '.local.' in p.name:errors.append('Private/media artifact: '+rel)
        if p.stat().st_size>5_000_000:errors.append('Large artifact: '+rel)
        if p.suffix.lower() in TEXT:
            text=p.read_text(encoding='utf-8')
            if SECRET.search(text):errors.append('Credential-shaped content (value suppressed): '+rel)
            if re.search(r'10\.92\.\d+\.\d+',text):errors.append('Private server address: '+rel)
            if re.search(r'(?i)(?:C:[/\\]+Users[/\\]+zju|codex://threads/[0-9a-f]{8}-[0-9a-f-]{27})',text):errors.append('Machine identity or private thread: '+rel)
    for p in (ROOT/'scripts').glob('*.py'):
        try:ast.parse(p.read_text(encoding='utf-8'))
        except SyntaxError:errors.append('Invalid repository script syntax: '+p.name)
    result={'status':'passed' if not errors else 'failed','files':files,'bundled':sum(s['status']=='bundled' for s in catalog['skills']),'catalog_entries':len(names),'plugin_entries':len(catalog['plugins']),'errors':errors,'scope':'Structure and explicit patterns only; does not run or certify imported tools'}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return bool(errors)
if __name__=='__main__':raise SystemExit(main())
