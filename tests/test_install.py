import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('installer',Path(__file__).resolve().parents[1]/'scripts/install.py')
installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)

class InstallSafety(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'repo';self.target=Path(self.temp.name)/'target'
        for name in ['alpha','beta']:
            p=self.root/'skills'/name;p.mkdir(parents=True)
            (p/'SKILL.md').write_text('---\nname: '+name+'\n---\n'+('[beta](../beta/SKILL.md)' if name=='alpha' else 'beta'),encoding='utf-8')
        (self.root/'catalog.json').write_text(json.dumps({'skills':[{'id':n,'status':'bundled'} for n in ['alpha','beta']]+[{'id':'external','status':'catalog-only'}]}),encoding='utf-8')
    def test_dependency_and_dry_run(self):
        names=installer.resolve_selection(self.root,['alpha'],True)
        self.assertEqual(names,['alpha','beta'])
        installer.install(self.root,self.target,names,True)
        self.assertFalse(self.target.exists())
    def test_repeat_is_noop(self):
        installer.install(self.root,self.target,['alpha'])
        result=installer.install(self.root,self.target,['alpha'])
        self.assertEqual(result[0]['action'],'unchanged')
    def test_conflict_prevents_all_writes(self):
        p=self.target/'beta';p.mkdir(parents=True);(p/'SKILL.md').write_text('my work')
        with self.assertRaises(FileExistsError):installer.install(self.root,self.target,['alpha','beta'])
        self.assertFalse((self.target/'alpha').exists())
        self.assertEqual((p/'SKILL.md').read_text(),'my work')
    def test_unknown_external_and_traversal_rejected(self):
        for name in ['missing','external','../../outside']:
            with self.assertRaises(ValueError):installer.resolve_selection(self.root,[name],True)
    def test_direct_install_path_traversal_rejected(self):
        with self.assertRaises(ValueError):installer.install(self.root,self.target,['../outside'])

if __name__=='__main__':unittest.main()
