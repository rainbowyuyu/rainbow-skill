import ctypes, hashlib, json, os, pathlib, shutil, subprocess, tempfile, time
base=pathlib.Path(__file__).parent
fixture=pathlib.Path(tempfile.mkdtemp(prefix='rainbow-deep-test-'));root=fixture/'video_project';(fixture/'work').mkdir()
def write(p,text):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8')
for project in ['stable','recent','pending']:
    p=root/project
    write(p/'public/keep.txt','same source')
    write(p/'tmp/bundle/index.html','remotion')
    write(p/'tmp/bundle/bundle.js','webpack compiled fixture')
    write(p/'tmp/bundle/public/keep.txt','same source')
    write(p/'tmp/bundle/public/unique.txt','unique historical material')
p=root/'stable';out=p/'output/v1';out.mkdir(parents=True)
final=out/'final.mp4'
subprocess.run([r'C:\ffmpeg\bin\ffmpeg.exe','-v','error','-f','lavfi','-i','color=c=black:s=16x16:d=0.12','-c:v','libx264',str(final)],check=True)
digest=hashlib.sha256(final.read_bytes()).hexdigest()
for project,status in [('stable','complete'),('pending','music-selection-pending')]:
    o=root/project/'output/v1';o.mkdir(parents=True,exist_ok=True)
    if project!='stable':shutil.copyfile(final,o/'final.mp4')
    shutil.copyfile(final,o/'chunk-0-2.mp4')
    write(o/'render-manifest.json',json.dumps({'status':status,'final':str(o/'final.mp4'),'sha256':digest,'frames':3,'chunks':[{'file':str(o/'chunk-0-2.mp4'),'sha256':digest}]}))
shell=shutil.which('pwsh') or shutil.which('powershell')
setup=fixture/'age.ps1'
setup.write_text("param($Root)\nGet-ChildItem -LiteralPath $Root -Recurse -File | ForEach-Object { [IO.File]::SetCreationTimeUtc($_.FullName,[datetime]::UtcNow.AddDays(-10));[IO.File]::SetLastWriteTimeUtc($_.FullName,[datetime]::UtcNow.AddDays(-10)) }\n[IO.File]::SetLastWriteTimeUtc((Join-Path $Root 'recent\\public\\keep.txt'),[datetime]::UtcNow)\n",encoding='utf-8')
subprocess.run([shell,'-NoProfile','-File',str(setup),str(root)],check=True,capture_output=True)
scan=fixture/'work/scan.json';apply=fixture/'work/apply.json'
common=[shell,'-NoProfile','-File',str(base/'clean-deep-video.ps1'),'-ProjectPath',str(fixture)]
subprocess.run(common+['-ReportPath',str(scan)],check=True,capture_output=True)
plan=json.loads(scan.read_text('utf-8-sig'));paths={x['path'] for x in plan['items']}
assert str(root/'stable/tmp/bundle/public/keep.txt') in paths
assert str(root/'stable/tmp/bundle/public/unique.txt') not in paths
assert not any(str(root/'recent') in x for x in paths)
assert str(root/'stable/output/v1/chunk-0-2.mp4') in paths
assert str(root/'pending/output/v1/chunk-0-2.mp4') not in paths
# A modified keeper protects its project; stable candidates still delete.
(root/'pending/public/keep.txt').write_text('keeper changed',encoding='utf-8')
subprocess.run(common+['-Apply','-ReviewedManifest',str(scan),'-ReportPath',str(apply)],check=True,capture_output=True)
r=json.loads(apply.read_text('utf-8-sig'))
assert not any(x['status']=='skipped-or-failed' for x in r['results']),r
assert not (root/'stable/output/v1/chunk-0-2.mp4').exists()
assert (root/'stable/output/v1/final.mp4').exists()
assert (root/'pending/output/v1/chunk-0-2.mp4').exists()
assert (root/'pending/tmp/bundle/public/keep.txt').exists()
assert (root/'stable/tmp/bundle/public/unique.txt').exists()
assert not (root/'stable/tmp/bundle/public/keep.txt').exists()
assert (root/'stable/public/keep.txt').exists()
assert not (root/'stable/tmp/bundle/bundle.js').exists()
assert (root/'recent/tmp/bundle/bundle.js').exists()
print('PASS: duplicate versus unique assets, recent project, completed versus pending chunks, changed keeper protection, scoped apply. Fixture:',fixture)
