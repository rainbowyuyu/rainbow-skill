import contextlib, importlib.util, io, json, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('organize-publish.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'video_project';self.project=self.root/'fixture';self.project.mkdir(parents=True)
        files=[]
        for i,role in enumerate(['video','copy','cover:16x9','cover:4x3','cover:3x4','cover:9x16']):
            f=self.project/f'file-{i}.txt';f.write_text(f'original-{i}')
            files.append({'source':f'fixture/{f.name}','destination':f'files/{f.name}','role':role,'topics':['fixture']})
        p={'id':'fixture-v1','projects':['fixture'],'topics':['fixture'],'destination':'fixture/publish','evidence':'reviewed fixture','files':files}
        self.spec=self.root.parent/'spec.json';m.save(self.spec,{'packages':[p]});self.scan=self.root.parent/'scan.json'
    def run_main(self,apply=False,suffix=''):
        args=['publisher','--root',str(self.root),'--report',str(self.root.parent/('apply'+suffix+'.json') if apply else self.scan)]
        args+=['--apply','--reviewed',str(self.scan)] if apply else ['--spec',str(self.spec)]
        with patch.object(sys,'argv',args),patch.object(m,'processes',return_value=[]),patch.object(m,'guard'),patch.object(m,'inspect_file',side_effect=lambda p,*a:{'sha256':m.sha(p),'stamp':m.stamp(p)}),contextlib.redirect_stdout(io.StringIO()):m.main()
    def test_move_and_idempotency(self):
        self.run_main();self.run_main(True)
        self.assertFalse((self.project/'file-0.txt').exists())
        self.assertEqual((self.project/'publish/files/file-0.txt').read_text(),'original-0')
        self.run_main(True,'-again')
        r=json.loads((self.root.parent/'apply-again.json').read_text());self.assertEqual(len(r['skipped']),1)
    def test_changed_source_refused(self):
        self.run_main();(self.project/'file-0.txt').write_text('changed')
        with self.assertRaises(ValueError):self.run_main(True)
        self.assertFalse((self.project/'publish').exists())
    def test_collision_refused(self):
        self.run_main();dest=self.project/'publish/files/file-0.txt';dest.parent.mkdir(parents=True);dest.write_text('do not overwrite')
        with self.assertRaises(ValueError):self.run_main(True)
        self.assertEqual(dest.read_text(),'do not overwrite')
        self.assertTrue((self.project/'file-0.txt').exists())
    def test_failure_rolls_back(self):
        self.run_main();rename=m.os.rename;calls=[]
        def fail_second(s,d):
            calls.append((s,d))
            if len(calls)==2:raise PermissionError('fixture locked file')
            return rename(s,d)
        with patch.object(m.os,'rename',side_effect=fail_second):
            with self.assertRaises(PermissionError):self.run_main(True)
        for i in range(6):self.assertEqual((self.project/f'file-{i}.txt').read_text(),f'original-{i}')
    def test_recent_project_protected(self):
        with self.assertRaisesRegex(ValueError,'Active within 3 days'):m.guard(self.root,['fixture'],[])
    def test_escape_refused(self):
        with self.assertRaises(ValueError):m.safe(self.root/'../outside',self.root)

if __name__=='__main__':unittest.main()
