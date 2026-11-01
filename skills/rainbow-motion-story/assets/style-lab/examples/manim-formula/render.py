"""Render isolated native CE examples with the existing shared Python environment."""
from pathlib import Path
import argparse, json, shutil, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[2]
SCENES=["FormulaSemanticTransform","DerivativeLinkedView","MatrixBasisMap","ComplexRotationProjection"]
POSTER={"FormulaSemanticTransform":12.0,"DerivativeLinkedView":13.2,"MatrixBasisMap":13.3,"ComplexRotationProjection":9.5}

def run_scene(scene):
    work=ROOT/"work/manim-formula"/scene
    out=ROOT/"assets/manim-formula"
    work.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    command=[sys.executable,"-m","manim",str(Path(__file__).with_name("scenes.py")),scene,"--renderer","cairo","--media_dir",str(work),"--resolution","960,540","--fps","24","--progress_bar","none","--verbosity","WARNING"]
    started=time.monotonic()
    with (work/"render.log").open("w",encoding="utf-8") as log:
        subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True,cwd=ROOT)
    candidates=[p for p in work.rglob(scene+".mp4") if "partial_movie_files" not in p.parts]
    if len(candidates)!=1: raise RuntimeError(f"Expected one output, found {candidates}")
    video=out/(scene+".mp4")
    shutil.copy2(candidates[0],video)
    probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(video)],encoding="utf-8"))
    stream=next(s for s in probe["streams"] if s["codec_type"]=="video")
    decode=subprocess.run(["ffmpeg","-v","error","-i",str(video),"-f","null","-"],capture_output=True,text=True)
    poster=out/(scene+"-poster.jpg")
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(POSTER[scene]),"-i",str(video),"-frames:v","1","-q:v","2",str(poster)],check=True)
    result={"scene":scene,"engine":"Manim Community 0.19.1","renderer":"Cairo","renderSeconds":round(time.monotonic()-started,2),"duration":float(probe["format"]["duration"]),"width":stream["width"],"height":stream["height"],"fps":stream["avg_frame_rate"],"frameCount":int(stream["nb_frames"]),"decodePassed":decode.returncode==0 and not decode.stderr.strip(),"video":str(video.relative_to(ROOT)),"poster":str(poster.relative_to(ROOT)),"posterTime":POSTER[scene],"visualReview":"pending","audio":"silent technical study"}
    (work/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False),flush=True)
    return result

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("scenes",nargs="*",choices=SCENES);args=parser.parse_args()
    for scene in args.scenes or SCENES: run_scene(scene)
    records=[]
    for scene in SCENES:
        p=ROOT/"work/manim-formula"/scene/"result.json"
        if p.exists():records.append(json.loads(p.read_text(encoding="utf-8")))
    qa=ROOT/"qa/manim-formula-render.json";qa.parent.mkdir(parents=True,exist_ok=True)
    qa.write_text(json.dumps({"schemaVersion":1,"scenes":records,"sourceEngine":"3b1b ManimGL","implementationEngine":"Manim Community 0.19.1","engineIdentity":"original CE adaptation, not an unmodified ManimGL example","wholePlaybackReview":False},ensure_ascii=False,indent=2),encoding="utf-8")
