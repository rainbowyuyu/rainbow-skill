"""Original porcelain spillway, with a real Mantaflow liquid cache.

Run with D:/blender/blender.exe --background --factory-startup --python <this file>
  -- --stage build|bake|render --resolution 64 --frames 96
The script only writes its scene directory, project work cache, and QA record.
"""
import argparse
import datetime
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "examples/blender-flow/scene"
BAKE = ROOT / "work/blender-flow/bake/v2"
QA = ROOT / "qa/blender-flow-runtime.json"
BLEND = OUT / "porcelain_spillway.blend"


def write_record(reset=False, **updates):
    QA.parent.mkdir(parents=True, exist_ok=True)
    record = json.loads(QA.read_text(encoding="utf-8")) if QA.exists() and not reset else {}
    record.update(updates)
    record["updated_at_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    QA.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def material(name, color, roughness=.25, metallic=0, transmission=0, ior=1.46):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Transmission Weight"].default_value = transmission
    shader.inputs["IOR"].default_value = ior
    return mat


def box(name, location, dimensions, mat=None, bevel=0, collision=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft ceramic edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
    if collision:
        # Separate un-bevelled solids seal the wet volume at this coarse voxel size.
        # The visible ceramic keeps its rounded edges; no liquid is hidden or removed.
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        collider = bpy.context.object
        collider.name = "Collision solid · " + name
        collider.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        collider.hide_render = True
        collider.display_type = "WIRE"
        fluid = collider.modifiers.new("Mantaflow collision", "FLUID")
        fluid.fluid_type = "EFFECTOR"
        fluid.effector_settings.surface_distance = .5
    return obj


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, location, target, power, size, color=(1,1,1), shape="DISK", size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


def camera(name, location, target, lens):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    data.lens = lens
    return obj


def flow(name, location, dimensions, behavior, velocity=(0,0,0)):
    obj = box(name, location, dimensions)
    mod = obj.modifiers.new("Mantaflow liquid source", "FLUID")
    mod.fluid_type = "FLOW"
    settings = mod.flow_settings
    settings.flow_type = "LIQUID"
    settings.flow_behavior = behavior
    settings.surface_distance = .5
    if behavior == "INFLOW":
        settings.use_initial_velocity = True
        settings.velocity_coord = velocity
    obj.display_type = "WIRE"
    obj.hide_render = True
    return obj


def configure_render(scene, options):
    scene.render.engine = options.engine
    scene.render.resolution_x = options.width
    scene.render.resolution_y = options.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.fps = 24
    scene.render.film_transparent = False
    if options.engine == "CYCLES":
        scene.cycles.samples = options.samples
        scene.cycles.use_denoising = True
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        devices = prefs.get_devices_for_type("OPTIX")
        gpu = [device for device in devices if device.type == "OPTIX"]
        for device in devices:
            device.use = device.type == "OPTIX"
        scene.cycles.device = "GPU" if gpu else "CPU"
        scene.cycles.max_bounces = 10
        scene.cycles.transmission_bounces = 8
        scene.cycles.transparent_max_bounces = 8
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.1


def build(options):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.name = "Porcelain Spillway · Mantaflow study"
    scene.frame_start = 1
    scene.frame_end = options.frames
    scene.gravity = (0,0,-9.81)
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    porcelain = material("Celadon porcelain · glossy fired glaze", (.20,.47,.43), .17)
    shader = porcelain.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Coat Weight"].default_value = .35
    shader.inputs["Coat Roughness"].default_value = .12
    water = material("Water · physical IOR 1.333", (.87,.97,.98), .045, transmission=1, ior=1.333)
    pale = material("Warm ivory studio", (.66,.64,.59), .6)
    bronze = material("Champagne reflected accent", (.40,.23,.09), .24, metallic=.75)
    dark = material("Graphite support", (.035,.055,.055), .32, metallic=.25)

    # Two asymmetric ceramic troughs. Every wetted solid has an actual effector.
    box("Lower tray · floor", (0,-.68,.14), (3.9,3.1,.32), porcelain,.08,True)
    box("Lower tray · left wall", (-1.79,-.68,.51), (.32,3.1,.82), porcelain,.07,True)
    box("Lower tray · right wall", (1.79,-.68,.51), (.32,3.1,.82), porcelain,.07,True)
    box("Lower tray · back wall", (0,.71,.51), (3.9,.32,.82), porcelain,.07,True)
    box("Lower tray · front wall", (0,-2.07,.47), (3.9,.32,.74), porcelain,.07,True)
    box("Upper trough · floor", (-.18,.12,2.28), (2.95,1.5,.24), porcelain,.07,True)
    box("Upper trough · back", (-.18,.81,2.58), (2.95,.20,.72), porcelain,.07,True)
    box("Upper trough · left", (-1.56,.12,2.58), (.20,1.5,.72), porcelain,.07,True)
    box("Upper trough · right", (1.20,.12,2.58), (.20,1.5,.72), porcelain,.07,True)
    # Front wall leaves a wide, lowered central sill for the visible overflow.
    box("Upper trough · left cheek", (-1.16,-.55,2.58), (.60,.20,.72), porcelain,.06,True)
    box("Upper trough · right cheek", (.89,-.55,2.58), (.42,.20,.72), porcelain,.06,True)
    box("Spillway · lowered broad sill", (-.09,-.67,2.40), (1.78,.62,.18), porcelain,.035,True)
    box("Rear pedestal", (-.18,.55,1.24), (1.10,.40,2.05), dark,.08)
    box("Floating tray feet L", (-1.15,-.58,.035), (.48,1.60,.10), dark,.045)
    box("Floating tray feet R", (1.15,-.58,.035), (.48,1.60,.10), dark,.045)
    box("Studio floor", (0,0,-.10), (200,200,.12), pale,.0)
    box("Warm reflection marker", (2.3,.9,.40), (.12,.42,.82), bronze,.045)

    flow("Continuous inlet · upper rear", (-.09,.32,2.70), (1.60,.28,.22), "INFLOW", (0,-.60,-.30))

    domain = box("Liquid domain · baked free surface", (0,-.60,1.65), (4.25,3.65,3.30), water)
    mod = domain.modifiers.new("Mantaflow liquid domain", "FLUID")
    mod.fluid_type = "DOMAIN"
    settings = mod.domain_settings
    settings.domain_type = "LIQUID"
    settings.resolution_max = options.resolution
    settings.cache_type = "MODULAR"
    settings.cache_directory = bpy.path.relpath(str(BAKE),start=str(OUT))
    settings.cache_frame_start = 1
    settings.cache_frame_end = options.frames
    settings.cache_data_format = "UNI"
    settings.use_mesh = True
    settings.mesh_scale = 2
    settings.mesh_particle_radius = 1.4
    settings.timesteps_min = 1
    settings.timesteps_max = 8
    settings.cfl_condition = 2.0
    settings.particle_randomness = .05
    settings.flip_ratio = .90
    settings.use_fractions = True
    settings.fractions_distance = .5
    domain.display_type = "TEXTURED"
    for polygon in domain.data.polygons:
        polygon.use_smooth = True

    hero = camera("Camera · hero", (6.0,-9.8,5.7), (-.1,-.35,1.40), 48)
    camera("Camera · closeup", (3.1,-5.7,3.6), (-.18,-.64,1.65), 63)
    camera("Camera · side study", (6.8,-1.7,3.3), (-.12,-.40,1.42), 56)
    scene.camera = hero
    area("Key · large softbox", (-3.0,-4.0,7.0), (0,0,1.3), 1350,5.0,(.86,.95,1))
    area("Rim · water edge", (2.5,2.8,5.3), (0,-.5,1.6), 1700,3.0,(1,.86,.68))
    area("Front · long reflection", (1,-4.5,3.6), (0,-.5,1.2), 700,1.4,(1,1,1),"RECTANGLE",4.5)
    area("Left · cool fill", (-4,.2,2.5), (0,0,1.3), 400,3.0,(.65,.86,1))
    scene.world.color = (.16,.16,.16)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.23,.28,.32,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .4
    configure_render(scene, options)
    scene["simulation_note"] = "Art-directed Mantaflow FLIP liquid study; gravity and mesh collisions; not a calibrated engineering/CFD result."
    scene["source_design"] = "Original two-trough porcelain spillway; dimensions in metres."
    scene["render_fps"] = 24
    OUT.mkdir(parents=True, exist_ok=True)
    BAKE.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    write_record(reset=True,status="scene_built", blender=bpy.app.version_string, binary=bpy.app.binary_path,
        scene=str(BLEND), cache=str(BAKE), resolution=options.resolution, frames=options.frames,
        fps=24, domain_dimensions_m=list(domain.dimensions), approximate_cell_size_m=4.25/options.resolution,
        solver="Mantaflow liquid FLIP", cache_type="MODULAR", gravity_m_s2=[0,0,-9.81],
        use_collision_effectors=True, collision_proxy="Overlapping un-bevelled solids matching ceramic wet walls",
        collision_surface_distance_voxels=.5, flow_surface_distance_voxels=.5,
        mesh_particle_radius=1.4, lower_wall_thickness_m=.32, lower_wall_floor_overlap_m=.20,
        initial_water="None; both troughs start dry",revision="v2",render_runs=[],
        cache_reopen_verified=False,saved_scene_reopened_for_render=False,
        prior_diagnostic_scene=str(OUT/"porcelain_spillway_v1.blend"),
        prior_diagnostic_video=str(OUT/"diagnostic_v1.mp4"),
        use_mesh=True, ior=1.333, cameras=[obj.name for obj in bpy.data.objects if obj.type=="CAMERA"],
        caveat="Art-directed low-resolution simulation; no quantitative validation or scientific accuracy claim.")


def bake(options):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    domain = bpy.data.objects["Liquid domain · baked free surface"]
    bpy.context.view_layer.objects.active = domain
    domain.select_set(True)
    settings = domain.modifiers["Mantaflow liquid domain"].domain_settings
    start = time.monotonic()
    write_record(status="baking_data", bake_started_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    print("BAKE_STAGE=data", flush=True)
    bpy.ops.fluid.bake_data()
    data_seconds = time.monotonic()-start
    write_record(status="baking_mesh", data_bake_seconds=round(data_seconds,3))
    print("BAKE_STAGE=mesh", flush=True)
    start = time.monotonic()
    bpy.ops.fluid.bake_mesh()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    actual_cache = Path(bpy.path.abspath(settings.cache_directory))
    cache_files = [p for p in actual_cache.rglob("*") if p.is_file()]
    write_record(status="baked", mesh_bake_seconds=round(time.monotonic()-start,3),
                 has_cache_baked_data=bool(settings.has_cache_baked_data),
                 has_cache_baked_mesh=bool(settings.has_cache_baked_mesh),
                 cache_file_count=len(cache_files),cache_bytes=sum(p.stat().st_size for p in cache_files),
                 data_frame_count=len(list((actual_cache/"data").glob("vel_*.uni"))),
                 mesh_frame_count=len(list((actual_cache/"mesh").glob("fluid_mesh_*.bobj.gz"))),
                 cache_path_saved=settings.cache_directory)


def render(options):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene = bpy.context.scene
    configure_render(scene, options)
    scene.camera = bpy.data.objects[options.camera]
    domain = bpy.data.objects["Liquid domain · baked free surface"]
    settings = domain.modifiers["Mantaflow liquid domain"].domain_settings
    if options.relink_cache:
        settings.cache_directory = bpy.path.relpath(str(Path(options.relink_cache).resolve()),start=str(BLEND.parent))
    frames = list(range(scene.frame_start, scene.frame_end+1)) if options.render_frames == "all" else [int(x) for x in options.render_frames.split(",")]
    if any(frame < settings.cache_frame_start or frame > settings.cache_frame_end for frame in frames):
        raise ValueError("Requested frame lies outside the saved cache range")
    actual_cache = Path(bpy.path.abspath(settings.cache_directory))
    if not all((actual_cache/"mesh"/f"fluid_mesh_{frame:04d}.bobj.gz").exists() for frame in frames):
        raise FileNotFoundError("Liquid mesh cache missing; restore/relink cache or rebake before rendering")
    render_dir = OUT / options.render_dir
    render_dir.mkdir(parents=True, exist_ok=True)
    timings = {}
    write_record(status="rendering", engine=scene.render.engine, render_device=scene.cycles.device if scene.render.engine=="CYCLES" else "EEVEE",
                 samples=options.samples,render_size=[options.width,options.height],render_camera=scene.camera.name)
    for frame in frames:
        start = time.monotonic()
        scene.frame_set(frame)
        scene.render.filepath = str(render_dir/f"frame_{frame:04d}.png")
        bpy.ops.render.render(write_still=True)
        timings[str(frame)] = round(time.monotonic()-start,3)
        write_record(last_rendered_frame=frame,last_rendered_file=scene.render.filepath,
                     render_timings_seconds=timings)
        print(f"RENDERED_FRAME={frame} SECONDS={timings[str(frame)]}",flush=True)
    record = json.loads(QA.read_text(encoding="utf-8"))
    runs = record.get("render_runs", [])
    runs.append({"directory":str(render_dir),"engine":scene.render.engine,
                 "revision":record.get("revision"),"cache_path":str(actual_cache),
                 "device":scene.cycles.device if scene.render.engine=="CYCLES" else "EEVEE",
                 "samples":options.samples,"size":[options.width,options.height],
                 "camera":scene.camera.name,"frames":frames,
                 "total_seconds":round(sum(timings.values()),3),
                 "mean_frame_seconds":round(sum(timings.values())/len(timings),3)})
    write_record(status="rendered", render_runs=runs, saved_scene_reopened_for_render=True,
                 cache_reopen_verified=True, reopened_cache_path=str(actual_cache))


def resolve_runtime_paths(output_dir, cache_dir, scene_file, report_file):
    default_output = (ROOT / "examples/blender-flow/scene").resolve()
    output = Path(output_dir).resolve()
    custom_output = output != default_output
    cache = Path(cache_dir).resolve() if cache_dir else (output/"cache" if custom_output else ROOT/"work/blender-flow/bake/v2")
    report = Path(report_file).resolve() if report_file else (output/"runtime.json" if custom_output else ROOT/"qa/blender-flow-runtime.json")
    return output, cache, output/scene_file, report


def main():
    global OUT, BAKE, BLEND, QA
    argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("build","bake","render","all"),default="build")
    parser.add_argument("--resolution",type=int,default=64)
    parser.add_argument("--frames",type=int,default=96)
    parser.add_argument("--engine",choices=("CYCLES","BLENDER_EEVEE"),default="CYCLES")
    parser.add_argument("--samples",type=int,default=32)
    parser.add_argument("--width",type=int,default=640)
    parser.add_argument("--height",type=int,default=360)
    parser.add_argument("--render-frames",default="24,60,96")
    parser.add_argument("--render-dir",default="keyframes")
    parser.add_argument("--camera",default="Camera · hero")
    parser.add_argument("--output-dir",default=str(OUT),help="Scene and render output directory")
    parser.add_argument("--cache-dir",help="New Mantaflow cache directory used by build; choose a fresh directory for each simulation revision")
    parser.add_argument("--scene-file",default="porcelain_spillway.blend",help="Filename within output-dir")
    parser.add_argument("--report-file",help="QA JSON path; custom output defaults to output-dir/runtime.json")
    parser.add_argument("--relink-cache",help="Existing relocated cache for rendering; never rebakes or saves scene automatically")
    options = parser.parse_args(argv)
    OUT, BAKE, BLEND, QA = resolve_runtime_paths(options.output_dir, options.cache_dir, options.scene_file, options.report_file)
    if options.stage in ("build","all"):
        build(options)
    if options.stage in ("bake","all"):
        bake(options)
    if options.stage in ("render","all"):
        render(options)


if __name__ == "__main__":
    main()
