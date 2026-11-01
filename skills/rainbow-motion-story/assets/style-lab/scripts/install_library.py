"""Copy the reusable library to an explicitly chosen skill asset folder; never deletes."""
from pathlib import Path
import argparse, hashlib, json, shutil
ROOT=Path(__file__).resolve().parents[1]
SCRIPTS={'audio_analyze.py','audio_examples.py','qa_audio.mjs','qa_audio_browser.mjs','qa_lab.mjs','qa_interactions.mjs','playback_qa.mjs','render_sample.mjs','shared-runtime.cjs','install_library.py','qa_camera_expansion.mjs','qa_camera_adapter.mjs','camera-time-test.mjs','type-life-test.mjs','inspect_story.mjs','story-test.mjs','qa_sound_design.mjs','render_sound_design.mjs','build_sound_index.mjs','qa_sound_design_browser.mjs','qa_sound_media.py','research_sound_sources.py','curate_sound_research.py'}
SCRIPTS.add('qa_sound_examples_browser.mjs')
SCRIPTS.add('test_rate_curves.mjs')
SCRIPTS.add('test_emotion_motion.mjs')
SCRIPTS.add('analyze_jun_reference.py')
SCRIPTS.update({'extract_car_continuity.py','test_car_continuity.mjs','test_visualization_continuity_repair.mjs'})
SCRIPTS.update({'extract_ai_draw.py','test_paper_space.mjs','test_generative_flow.mjs'})
SCRIPTS.update({'extract_shuffle_rhythm.py','analyze_shuffle_rhythm.py','test_shuffle_rhythm.mjs','export_shuffle_rhythm.mjs'})
SCRIPTS.update({'extract_shuffle_story_visual.py','extract_shuffle_subtitles.py','ocr_shuffle_subtitles.ps1','test_shuffle_explanation.mjs','test_shuffle_story_contract.mjs'})
SCRIPTS.add('test_document_reader.mjs')
SCRIPTS.update({'test_transmission_effects.mjs','test_transmission_studio.mjs','extract_transmission_visual.py'})
SCRIPTS.update({'test_aesthetic_direction.mjs','test_aesthetic_studio.mjs','extract_aesthetic_visual.py'})
SCRIPTS.update({'extract_mofs_subtitles.py','ocr_mofs_subtitles.ps1','test_mofs_explanation.mjs','test_mofs_writing_studio.mjs'})
SCRIPTS.update({'test_camera_depth.mjs','test_camera_depth_studio.mjs','extract_camera_depth.py'})
SCRIPTS.update({'test_rotary_geometry.mjs','test_rotary_interaction.mjs','test_rotary_session.mjs'})
SCRIPTS.update({'test_switch_mechanism.mjs','test_switch_anatomy.mjs','test_switch_session.mjs'})
SCRIPTS.update({'test_lemo_atlas.mjs','prepare_lemo_assets.py','build_lemo_atlas.py'})
SCRIPTS.update({'test_ui_choreography.mjs','test_engraved_mechanism.mjs'})
SCRIPTS.update({'analyze_syy_rhythm.py','test_signal_relay.mjs','export_signal_relay.mjs'})
SCRIPTS.update({'build_glass_package.mjs','test_glass_package.mjs'})
SCRIPTS.add('test_web_aesthetic.mjs')
SCRIPTS.update({'extract_magpie_title.py','test_symbolic_titles.mjs'})
SCRIPTS.update({'extract_blender_flow.py','probe_blender_runtime.py','qa_blender_flow.py'})
SCRIPTS.update({'test_motionface_type.mjs','test_motionface_kinetic.mjs','test_motionface_concepts.mjs'})
SCRIPTS.add('test_water_contracts.mjs')
ROOT_FILES={'serve.py','launch.py','local-config.json','使用说明.md','打开方法库.cmd','资产与验证.md'}
def include(rel):
    if len(rel.parts)==1:return rel.name in ROOT_FILES
    top=rel.parts[0]
    if '__pycache__' in rel.parts:return False
    if top=='examples' and rel.name in {'fpv-slalom.mp4','fpv-slalom.mp4.json'}:return False
    if rel.parts[:2]==('examples','blender-flow'):
        if rel.suffix in {'.blend1','.log'}:return False
        if rel.name.startswith('diagnostic_v1') or rel.name=='porcelain_spillway_v1.blend':return False
        if 'frames' in rel.parts or 'diagnostics' in rel.parts:return False
    if top in {'evidence','examples','guides','studies'}:return True
    if top=='scripts':return len(rel.parts)==2 and rel.name in SCRIPTS
    if top=='lab':
        if len(rel.parts)==2:return True
        return rel.parts[1]=='modules' and len(rel.parts)==3 and (rel.suffix=='.js' or rel.name in {'selftest.mjs','camera-flight-test.mjs','camera-time-test.mjs','API.md','package.json'})
    if top=='qa':return rel.suffix in {'.json','.md'} and len(rel.parts)<=3
    return False
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--target',type=Path,required=True);a=p.parse_args()
    target=a.target.resolve()
    if target==ROOT or ROOT in target.parents:raise ValueError('Choose a separate installed skill directory.')
    target.mkdir(parents=True,exist_ok=True);files=[]
    for src in sorted(ROOT.rglob('*')):
        if not src.is_file():continue
        rel=src.relative_to(ROOT)
        if not include(rel):continue
        dst=target/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        digest=hashlib.sha256(src.read_bytes()).hexdigest()
        if hashlib.sha256(dst.read_bytes()).hexdigest()!=digest:raise ValueError('Copy verification failed: '+str(rel))
        files.append({'path':rel.as_posix(),'bytes':src.stat().st_size,'sha256':digest})
    result={'schemaVersion':1,'source':str(ROOT),'target':str(target),'files':files,'copiedBytes':sum(f['bytes'] for f in files),'referenceVideosCopied':False,'nodeModulesCopied':False,'deletions':False}
    (target/'installation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
    print(json.dumps({'files':len(files),'bytes':result['copiedBytes'],'target':str(target)},ensure_ascii=False))
if __name__=='__main__':main()
