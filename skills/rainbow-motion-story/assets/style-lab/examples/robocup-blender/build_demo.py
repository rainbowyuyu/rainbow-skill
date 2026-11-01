"""Original sensor rover, computed scan/cost geometry, and a continuous camera.

Blender 5.1: --background --factory-startup --python build_demo.py --
  --stage build|render --out <directory> --frames 1,103,197,247
No external assets, no downloads, no persistent preference changes.
"""
import argparse
import datetime
import heapq
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector, Quaternion
from bpy_extras import anim_utils

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / 'work/robocup-blender-demo'
QA = ROOT / 'qa/robocup-blender-demo.json'
FPS, LAST = 24, 288


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x*x*x*(10+x*(-15+6*x))


def window(t, a, b, c, d):
    return smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)))


def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)


def mat(name, color, rough=.3, metal=0, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*srgb(color),1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*srgb(color),1)
        p.inputs['Emission Strength'].default_value=emission
    return m


def box(name, pos, size, material, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        m=o.modifiers.new('Machined edge radius','BEVEL');m.width=bevel;m.segments=3
        m=o.modifiers.new('Plane preserving normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o


def cylinder(name,pos,radius,depth,material,axis='Z',vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=pos)
    o=bpy.context.object;o.name=name
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    b=o.modifiers.new('Rounded machined rim','BEVEL');b.width=min(.012,radius*.08);b.segments=3
    o.modifiers.new('Weighted rim normals','WEIGHTED_NORMAL')
    return o


def polyline(name, points, material, width=.008, closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1
    c.bevel_depth=width;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(material)
    return o


def parent_to(o,p):
    # Fresh transform evaluation is required before copying matrix_world.
    bpy.context.view_layer.update()
    world=o.matrix_world.copy();o.parent=p;o.matrix_world=world


def empty(name, pos=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos
    return o


def aim(o,target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()


def area(name,pos,power,size,color,target=(0,0,.4),size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='RECTANGLE' if size_y else 'DISK';d.size=size
    if size_y:d.size_y=size_y
    d.color=srgb(color);o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;aim(o,target)
    return o


def linear_keys(block):
    ad=block.animation_data
    if ad and ad.action:
        bag=anim_utils.action_get_channelbag_for_slot(ad.action,ad.action_slot)
        if bag:
            for curve in bag.fcurves:
                for k in curve.keyframe_points:k.interpolation='LINEAR'


def set_render(scene, opts):
    scene.render.engine=opts.engine;scene.render.resolution_x=opts.width;scene.render.resolution_y=opts.height
    scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
    scene.render.fps=FPS;scene.render.film_transparent=False
    scene.render.use_file_extension=True
    if opts.engine=='CYCLES':
        scene.cycles.samples=opts.samples;scene.cycles.use_denoising=True
        prefs=bpy.context.preferences.addons['cycles'].preferences
        try:
            prefs.compute_device_type='OPTIX';devices=prefs.get_devices_for_type('OPTIX')
            for d in devices:d.use=d.type=='OPTIX'
            scene.cycles.device='GPU' if any(d.type=='OPTIX' for d in devices) else 'CPU'
        except Exception:scene.cycles.device='CPU'
        scene.cycles.max_bounces=7;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=4
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3


def make_points(name, points, material, radius=.014):
    verts=[];faces=[]
    unit=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    tris=[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]
    for p in points:
        off=len(verts);verts.extend([(p[0]+a*radius,p[1]+b*radius,p[2]+c*radius) for a,b,c in unit])
        faces.extend([tuple(off+i for i in t) for t in tris])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
    o.shape_key_add(name='Full measured return radius');collapse=o.shape_key_add(name='Zero radius at each measured hit')
    for n,p in enumerate(points):
        for v in collapse.data[n*6:n*6+6]:v.co=p
    return o,collapse


def create_cost_and_path(obstacles, cost_mats, line_mat):
    # Signed distance to obstacle footprints, not a learned prediction or SLAM.
    step=.20; nx,ny=33,36; x0,y0=-3.2,-2.0
    def dist(x,y):
        ds=[]
        for ox,oy,sx,sy in obstacles:
            qx,qy=abs(x-ox)-sx*.5,abs(y-oy)-sy*.5
            ds.append(math.hypot(max(qx,0),max(qy,0))+min(max(qx,qy),0))
        return min(ds)
    points=[];faces=[];mids=[];heights=[];dists=[]
    for j in range(ny):
        for i in range(nx):
            x,y=x0+i*step,y0+j*step;d=dist(x,y);dists.append(d)
            # Omit occupied footprints and the robot's footprint so every mark has depth.
            if d<.10 or (abs(x)<.86 and abs(y)<.97):continue
            cost=math.exp(-max(d,0)/.65);z=.021
            k=len(points);h=.27*cost
            points.extend([(x-step*.42,y-step*.42,z),(x+step*.42,y-step*.42,z),(x+step*.42,y+step*.42,z),(x-step*.42,y+step*.42,z)])
            heights.extend([h]*4);faces.append((k,k+1,k+2,k+3));mids.append(min(6,int(cost*7)))
    mesh=bpy.data.meshes.new('Footprint distance field');mesh.from_pydata(points,[],faces);mesh.update()
    field=bpy.data.objects.new('Computed obstacle-clearance field',mesh);bpy.context.collection.objects.link(field)
    for m in cost_mats:mesh.materials.append(m)
    for p,idx in zip(mesh.polygons,mids):p.material_index=idx
    field.shape_key_add(name='Flat cost map');sk=field.shape_key_add(name='Distance cost relief')
    for v,h in zip(sk.data,heights):v.co.z+=h
    tile_collapse=field.shape_key_add(name='Collapse tiles around world centres')
    for face in mesh.polygons:
        center=sum((mesh.vertices[i].co for i in face.vertices),Vector())/4
        for i in face.vertices:
            tile_collapse.data[i].co.x=center.x
            tile_collapse.data[i].co.y=center.y
    # 8-connected A* with robot radius inflation. Edge costs are positive.
    start=(16,10);goal=(31,32)
    def valid(n):
        i,j=n;return 0<=i<nx and 0<=j<ny and dist(x0+i*step,y0+j*step)>1.15
    if not valid(start) or not valid(goal):raise RuntimeError('A* start or goal invalid')
    queue=[(0,start)];g={start:0};prev={}
    while queue:
        _,n=heapq.heappop(queue)
        if n==goal:break
        for di,dj in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]:
            q=(n[0]+di,n[1]+dj)
            if not valid(q):continue
            if di and dj and (not valid((n[0]+di,n[1])) or not valid((n[0],n[1]+dj))):continue
            d=dist(x0+q[0]*step,y0+q[1]*step)
            cost=g[n]+math.hypot(di,dj)*(1+2*math.exp(-d/.65))
            if cost<g.get(q,1e99):g[q]=cost;prev[q]=n;heapq.heappush(queue,(cost+math.dist(q,goal),q))
    if goal not in g:raise RuntimeError('A* route did not reach goal')
    nodes=[goal]
    while nodes[-1]!=start:nodes.append(prev[nodes[-1]])
    nodes.reverse();route=[(x0+i*step,y0+j*step,.055) for i,j in nodes]
    path=polyline('A-star route · collision inflated',route,line_mat,.018)
    path.shape_key_add(name='Ground-plane route');route_lift=path.shape_key_add(name='Follow the same distance relief')
    for point,(x,y,z) in zip(route_lift.data,route):point.co.z+=.27*math.exp(-max(dist(x,y),0)/.65)
    return field,sk,tile_collapse,path,route_lift,{'grid_shape':[nx,ny],'cell_size_m':step,'robot_clearance_m':1.15,'start':start,'goal':goal,'route_world_m':route,'path_surface_gap_m':.034,'source':'Known-layout computation, not a point-cloud reconstruction. Exact 2D signed distance to axis-aligned obstacle rectangles; A-star eight-neighbour shortest path with positive clearance cost and 1.15m conservative circular footprint; not SLAM/diffusion/robot dynamics.'}


def build(opts):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    s=bpy.context.scene;s.name='Rover · sense, map, reveal';s.frame_start=1;s.frame_end=LAST
    s.unit_settings.system='METRIC';s.unit_settings.scale_length=1
    metal=mat('Anodised pale aluminium','B8CCD7',.24,1)
    dark=mat('Graphite coated body','18232C',.3,.65)
    black=mat('Soft tyre rubber','101820',.52)
    circuit=mat('Deep teal PCB','124B4A',.3,.15)
    copper=mat('Copper busbar','BD7544',.24,.92)
    cyan=mat('Signal cyan','45CFE0',.25,.2,2.4)
    orange=mat('Safety amber','FFAD5E',.28,.15,1.2)
    floor_mat=mat('Slate stage','15222B',.44,.3)
    obs_mat=mat('Satin ceramic obstacles','485E6D',.26,.4)
    box('Continuous ground',(0,1,-.12),(200,200,.24),floor_mat,0)
    chassis=box('Lower structural tray',(0,0,.42),(1.16,1.56,.18),metal,.045)
    # Four independent wheels with real axle positions, hubs, tyre shoulders and tread.
    for x in (-.70,.70):
        for y in (-.51,.51):
            side=1 if x>0 else -1
            cylinder('Axle',(.54*side,y,.30),.065,.35,metal,'X')
            cylinder('Tyre', (x,y,.29),.285,.22,black,'X',64)
            cylinder('Aluminium wheel hub',(x+side*.118,y,.29),.192,.022,metal,'X')
            cylinder('Hub cap',(x+side*.137,y,.29),.061,.026,dark,'X')
            for a in range(20):
                theta=a*math.tau/20
                tread=box('Tyre block',(x,y+math.sin(theta)*.277,.29+math.cos(theta)*.277),(.22,.047,.025),black,.007)
                tread.rotation_euler[0]=-theta
            for a in range(5):
                theta=a*math.tau/5
                cylinder('Hub bolt',(x+side*.141,y+math.sin(theta)*.13,.29+math.cos(theta)*.13),.013,.016,dark,'X',12)
    for x in (-.48,.48):
        box('Chassis side rail',(x,0,.59),(.10,1.40,.20),dark,.025)
        for y in (-.58,.58):cylinder('Standoff',(x,y,.68),.035,.31,metal)
    box('Controller PCB',(0,-.30,.56),(.69,.60,.045),circuit,.012)
    box('Compute module',(0,-.30,.61),(.31,.32,.052),dark,.013)
    for x in [i*.039-.135 for i in range(8)]:box('Machined heat-sink fin',(x,-.30,.674),(.016,.28,.065),metal,.003)
    for x in (-.24,.24):
        for y in (-.47,-.34,-.21,-.08):box('PCB connector',(x,y,.608),(.07,.06,.045),orange,.007)
    battery=empty('Battery cartridge · installation axis +Y')
    body=box('Battery cartridge',(0,.34,.605),(.71,.49,.12),dark,.025);parent_to(body,battery)
    for x in (-.27,0,.27):
        o=box('Battery ceramic cell',(x,.34,.68),(.20,.39,.036),metal,.012);parent_to(o,battery)
    for x in (-.35,.35):polyline('Power loom',[(x,.45,.54),(x,.1,.55),(x,-.2,.59)],copper,.018)
    lid=empty('Top assembly · installation axis +Z')
    o=box('Removable upper shell',(0,0,.815),(1.07,1.41,.10),dark,.042);parent_to(o,lid)
    for x in (-.48,.48):
        o=box('Top aluminium edge',(x,0,.876),(.035,1.25,.014),metal,.006);parent_to(o,lid)
    for y in (-.57,.57):
        for x in (-.41,.41):
            o=cylinder('Captive lid bolt',(x,y,.878),.026,.024,metal,vertices=12);parent_to(o,lid)
    for x in (-.17,.17):
        o=cylinder('Forward optical sensor',(x,-.714,.813),.05,.029,cyan,'Y');parent_to(o,lid)
    for z,r,d,m in [( .925,.18,.11,metal),(1.005,.16,.05,dark),(1.05,.168,.038,cyan),(1.10,.155,.062,dark),(1.14,.13,.022,metal)]:
        o=cylinder('Lidar tower',(0,.15,z),r,d,m);parent_to(o,lid)
    # Distinct original layout; barriers are part of the same scene and ray target set.
    footprints=[(-1.5,1.55,.75,1.0),(1.05,1.55,.80,.75),(.05,3.1,.95,.55)]
    obs=[]
    for idx,(x,y,sx,sy) in enumerate(footprints):
        h=[.95,1.25,.8][idx]
        o=box('Obstacle '+str(idx),(x,y,h*.5),(sx,sy,h),obs_mat,.065);obs.append(o)
        box('Obstacle cap marker '+str(idx),(x,y,h+.012),(sx*.72,sy*.72,.018),orange,.01)
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    origin=Vector((0,.15,1.05));hits=[]
    for elevation in (-.28,-.15,0,.12):
        for a in range(180):
            theta=a*math.tau/180;direction=Vector((math.cos(theta),math.sin(theta),elevation)).normalized()
            nearest=None
            for o in obs:
                eo=o.evaluated_get(deps);inv=eo.matrix_world.inverted()
                ok,p,n,index=eo.ray_cast(inv@origin,inv.to_3x3()@direction,distance=7)
                if ok:
                    w=eo.matrix_world@p;d=(w-origin).length
                    if nearest is None or d<nearest[0]:nearest=(d,w)
            if nearest:hits.append(tuple(nearest[1]))
    cloud,cloud_collapse=make_points('Actual obstacle ray hits',hits,cyan,.015)
    scan=empty('Sensor visualization · world-coordinate geometry')
    parent_to(cloud,scan)
    # Six spatially separated measured returns, not a synthetic full-room point cloud.
    rays=[]
    for n,idx in enumerate([int((len(hits)-1)*v) for v in (.05,.2,.35,.55,.7,.92)]):
        ray=polyline('Measured beam '+str(n),[tuple(origin),hits[idx]],cyan,.004);parent_to(ray,scan)
        rays.append(ray)
    cost_mats=[mat('Cost '+str(i),h,.5,.1,.35) for i,h in enumerate(['153D52','195668','287F89','499E9A','B9A56C','E7A56C','FA9A54'])]
    field,relief,tile_collapse,path,route_lift,planning=create_cost_and_path(footprints,cost_mats,orange)
    # Construction axes: faint fine geometry with a single physically consistent ground.
    for x in range(-3,4):polyline('Floor division X',[(x,-2,.004),(x,4.3,.004)],metal,.0015)
    for y in range(-2,5):polyline('Floor division Y',[(-3,y,.004),(3,y,.004)],metal,.0015)
    area('Cool key',(-3,-4,6),1100,4.5,'C8E7FF')
    area('Amber edge',(3.8,2.6,4.8),1250,3.5,'FFD0A0')
    area('Long front reflection',(1,-4,2.5),450,1.0,'FFFFFF',size_y=4)
    area('Cyan rear rim',(-2.8,4,2.8),800,3,'7BD5E3')
    s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.045,.06,.085,1)
    s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
    cd=bpy.data.cameras.new('Continuous cinema camera');cam=bpy.data.objects.new('Continuous cinema camera',cd);bpy.context.collection.objects.link(cam);s.camera=cam
    cam.rotation_mode='QUATERNION';cd.lens=43;cd.clip_start=.04;cd.clip_end=250
    focus=empty('Focus · physical target');cd.dof.use_dof=True;cd.dof.focus_object=focus;cd.dof.aperture_fstop=7.1
    # Smooth orbit coordinates; five-to-seven degree camera bank is deliberate.
    controls=[(0,-58,5.0,1.65,(0,.25,.60),44,0),
              (2.6,-39,5.4,2.15,(0,.55,.62),46,-5),
              (5.6,35,6.0,5.7,(0,1.0,.35),44,6),
              (7.7,64,4.1,3.5,(0,.12,.72),48,3),
              (9.8,38,2.85,2.25,(0,-.16,.69),52,-4),
              (11.96,25,3.5,2.25,(0,.02,.85),50,0)]
    camera_samples=[]
    for f in range(1,LAST+1):
        t=(f-1)/FPS
        k=next((i for i in range(len(controls)-1) if controls[i][0]<=t<=controls[i+1][0]),len(controls)-2)
        a,b=controls[k],controls[k+1];u=smooth((t-a[0])/(b[0]-a[0]))
        lerp=lambda x,y:x+(y-x)*u
        angle=math.radians(lerp(a[1],b[1]));radius=lerp(a[2],b[2]);z=lerp(a[3],b[3]);target=Vector([lerp(a[4][j],b[4][j]) for j in range(3)])
        pos=Vector((radius*math.sin(angle),-radius*math.cos(angle),z));cam.location=pos
        bank=math.radians(lerp(a[6],b[6]));q=(target-pos).to_track_quat('-Z','Y')@Quaternion((0,0,1),bank)
        cam.rotation_quaternion=q;cam.keyframe_insert(data_path='location',frame=f);cam.keyframe_insert(data_path='rotation_quaternion',frame=f)
        cd.lens=lerp(a[5],b[5]);cd.keyframe_insert(data_path='lens',frame=f)
        focus.location=target;focus.keyframe_insert(data_path='location',frame=f)
        opening=window(t,7.0,8.4,10.7,11.9)
        lid.location.z=opening*.77;lid.keyframe_insert(data_path='location',frame=f)
        battery.location.y=opening*.25;battery.keyframe_insert(data_path='location',frame=f)
        visible=window(t,.7,1.7,5.9,6.6)
        cloud_collapse.value=1-visible;cloud_collapse.keyframe_insert(data_path='value',frame=f)
        for ray in rays:
            ray.data.bevel_depth=.004*visible;ray.data.keyframe_insert(data_path='bevel_depth',frame=f)
        fv=window(t,2.4,3.5,6.8,7.7)
        # Each tile reveals about its own centre; floor clearance remains fixed.
        field.hide_render=fv<.0001;field.keyframe_insert(data_path='hide_render',frame=f)
        tile_collapse.value=1-fv;tile_collapse.keyframe_insert(data_path='value',frame=f)
        relief.value=window(t,4.2,4.9,5.7,6.4)*fv;relief.keyframe_insert(data_path='value',frame=f)
        route_lift.value=relief.value;route_lift.keyframe_insert(data_path='value',frame=f)
        path.data.bevel_factor_end=smooth((t-3.5)/1.5)*(1-smooth((t-6.3)/.9));path.data.keyframe_insert(data_path='bevel_factor_end',frame=f)
        path.hide_render=t<3.5 or t>7.2;path.keyframe_insert(data_path='hide_render',frame=f)
        camera_samples.append({'frame':f,'t':t,'position':list(pos),'target':list(target),'quaternion_wxyz':list(q),'lens_mm':cd.lens,'bank_degrees':math.degrees(bank),'lid_lift_m':lid.location.z})
    for block in [cam,cd,focus,lid,battery,scan,field,path,path.data,path.data.shape_keys,field.data.shape_keys,cloud.data.shape_keys]+[r.data for r in rays]:linear_keys(block)
    set_render(s,opts);s.frame_set(1)
    s['provenance']='Original educational rover study, inspired by observed communication devices; no source assets or settings copied.'
    s['computed_geometry']='720 rays on visible obstacle meshes; exact footprint-distance field and A-star grid route.'
    s['physical_limit']='Kinematic camera and exploded display. No rigid-body motion, real LiDAR noise, SLAM, learned world model, or control-loop validation.'
    out=Path(opts.out).resolve();out.mkdir(parents=True,exist_ok=True)
    blend=out/'rover_camera_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    params={'version':1,'duration_seconds':12,'fps':FPS,'frame_range':[1,LAST],'coordinate_system':'metres, right-handed Z up','camera':camera_samples,'measured_ray_hits':len(hits),'planning':planning,'palette':'slate / anodised aluminium / cyan / amber','geometry_note':s['physical_limit']}
    (out/'scene-parameters.json').write_text(json.dumps(params,indent=2,ensure_ascii=False),encoding='utf-8')
    QA.parent.mkdir(parents=True,exist_ok=True)
    QA.write_text(json.dumps({'status':'built','blender':bpy.app.version_string,'blend':str(blend),'parameters':str(out/'scene-parameters.json'),'source_script':str(Path(__file__).resolve()),'render_runs':[],'visual_review':False,'continuous_preview_review':False},indent=2),encoding='utf-8')
    print('BUILT',blend,'ray hits',len(hits))


def render(opts):
    out=Path(opts.out).resolve();bpy.ops.wm.open_mainfile(filepath=str(out/'rover_camera_study.blend'))
    s=bpy.context.scene;set_render(s,opts)
    frames=[int(n) for n in opts.frames.split(',')] if opts.frames else list(range(opts.start,opts.end+1,opts.step))
    folder=out/('cycles' if opts.engine=='CYCLES' else 'preview-frames');folder.mkdir(parents=True,exist_ok=True)
    begin=time.monotonic();files=[]
    for f in frames:
        s.frame_set(f);s.render.filepath=str(folder/f'frame_{f:04d}.png');bpy.ops.render.render(write_still=True);files.append(s.render.filepath)
    record=json.loads(QA.read_text(encoding='utf-8')) if QA.exists() else {}
    record.setdefault('render_runs',[]).append({'engine':opts.engine,'samples':opts.samples if opts.engine=='CYCLES' else None,'size':[opts.width,opts.height],'frames':frames,'files':files,'elapsed_seconds':time.monotonic()-begin,'saved_scene_reopened':True})
    record['updated_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();QA.write_text(json.dumps(record,indent=2),encoding='utf-8')
    print('RENDERED',len(files),'frames',time.monotonic()-begin)


def main():
    p=argparse.ArgumentParser();p.add_argument('--stage',choices=['build','render'],default='build');p.add_argument('--out',default=str(DEFAULT_OUT))
    p.add_argument('--engine',choices=['CYCLES','BLENDER_EEVEE'],default='CYCLES');p.add_argument('--samples',type=int,default=32)
    p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540);p.add_argument('--frames',default='')
    p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=LAST);p.add_argument('--step',type=int,default=1)
    opts=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if opts.stage=='build':build(opts)
    else:render(opts)


if __name__=='__main__':main()
