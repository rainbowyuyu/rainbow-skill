"""Regression checks for the package gate (never a media quality test)."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from validate_director_package import validate, LAYERS, LAYER_WEIGHTS, FUSION_WEIGHTS

class PackageGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='director-gate-')
        self.root=Path(self.tmp.name)
        self.contract={'version':'fixture-v1','duration_seconds':2,'fps':25,'frames':50,
          'anchors':['subject'],'events':{'contact':1.25},'narration_free_windows':[[1,2]],
          'windows':[{'id':'W0','start':0,'end':2,'shot_id':'S0'}]}
        self.put('contract.json',self.contract)
        self.rows=[{'second':s,'window_id':'W0','shot_id':'S0','contract_version':'fixture-v1',
          'anchor_id':'subject','prompt':f'Concrete subject action {s}'} for s in range(2)]
        for layer in LAYERS:
            self.put(f'{layer}/seconds.json',self.rows)
            for name in ['director.md','examples.md','research-constraints.md','self-review.md','shotcraft-read-manifest.json']:
                (self.root/layer/name).write_text('Evidence fixture',encoding='utf-8')
        self.put('layer-audio/narration-cues.json',[{'id':'N0','planned_start':.1,'planned_end':.9}])
        for name in ['00-master-index.md','00-baseline-score.md','01-research.md','integrated-script.md']:
            (self.root/name).write_text('Fixture',encoding='utf-8')
        def score(name,weights,threshold):
            return {'name':name,'score':9.3,'threshold':threshold,'dimensions':{k:9.3 for k in weights},
              'status':'pass','hard_conflicts':0,'evidence':['00-baseline-score.md']}
        self.scores={'stage':'prompt-design','layers':[score(f'L{i}',LAYER_WEIGHTS,9) for i in range(1,5)],
          'fusion':score('fusion',FUSION_WEIGHTS,9.2)}
        self.put('review/scores.json',self.scores)

    def tearDown(self): self.tmp.cleanup()
    def put(self,name,value):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(json.dumps(value),encoding='utf-8')
    def failed(self,fragment):
        result=validate(self.root)
        self.assertFalse(result['passed'])
        self.assertTrue(any(fragment in error for error in result['errors']),result)
    def test_valid_25fps_short_non_science_package(self):
        self.assertTrue(validate(self.root)['passed'])
    def test_missing_second(self):
        self.put('layer-3d/seconds.json',self.rows[:1]);self.failed('cover exactly')
    def test_stale_contract(self):
        data=copy.deepcopy(self.rows);data[1]['contract_version']='old'
        self.put('layer-type/seconds.json',data);self.failed('stale contract')
    def test_wrong_shared_shot(self):
        data=copy.deepcopy(self.rows);data[1]['shot_id']='S99'
        self.put('layer-type/seconds.json',data);self.failed('mismatched shared')
    def test_narration_crosses_free_window(self):
        self.put('layer-audio/narration-cues.json',[{'id':'N0','planned_start':.9,'planned_end':1.2}])
        self.failed('overlaps narration-free')
    def test_false_pass_and_fabricated_average(self):
        self.scores['fusion']['dimensions']['clock_contact']=8.0
        self.put('review/scores.json',self.scores)
        self.failed('claimed pass below gate');self.failed('weighted score mismatch')
    def test_missing_anchor(self):
        data=copy.deepcopy(self.rows);data[0].pop('anchor_id')
        self.put('layer-3d/seconds.json',data);self.failed('invalid shared anchor')
    def test_clean_picture_cannot_contain_mechanism_text(self):
        data=copy.deepcopy(self.rows)
        data[0].update(state='clean-picture',on_screen_text=['Pressure'])
        self.put('layer-type/seconds.json',data);self.failed('clean-picture conflicts')
    def test_dynamic_binding_event_must_exist(self):
        data=copy.deepcopy(self.rows)
        data[0]['dynamic_bindings']=[{'start_event':'old-contact'}]
        self.put('layer-type/seconds.json',data);self.failed('unknown start_event')
    def test_sfx_optional_plan_does_not_claim_material_readiness(self):
        self.put('layer-audio/sfx-cues.json',{
            'schema_version':1,'contract_version':'fixture-v1','duration_seconds':2,'fps':25,
            'events':{'contact':{'time':1.25}},'assets':{},'cues':[
                {'id':'click','event_id':'contact','decision':'include','source_class':'diegetic',
                 'method':'freesound','asset_id':None,'asset_sync_seconds':None,'offset_ms':0,
                 'start_seconds':None,'exit_seconds':1.5,'gain_db':-12,'pan':0,
                 'tail_policy':'natural','reason':'Confirm one contact','review':{'listened':None}}]})
        result=validate(self.root)
        self.assertTrue(result['passed'],result)
        self.assertTrue(any('selected asset is pending' in x for x in result['warnings']))
    def test_sfx_stale_event_fails_full_package(self):
        self.put('layer-audio/sfx-cues.json',{
            'schema_version':1,'contract_version':'fixture-v1','duration_seconds':2,'fps':25,
            'events':{'contact':{'time':1.1}},'assets':{},'cues':[]})
        self.failed('stale against main contract')

if __name__=='__main__': unittest.main(verbosity=2)
