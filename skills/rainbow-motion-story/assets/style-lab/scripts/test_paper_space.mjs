import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {paperSpace,samplePaperSpace,projectedPaperScene,surfacePoint,surfaceNormal,shadowProjection,
    PAPER_ID,PAPER_DURATION,GRID,TOPOLOGY,LIGHT_DIRECTION} from '../lab/modules/paper-space.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let checks=0,samples=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const near=(a,b,eps,message)=>check(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps,`${message}: ${a} vs ${b}`);
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const expectedIdentity=samplePaperSpace(0).vertices.map(v=>[v.id,v.index,v.parentId,...v.uv]);
const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minDepth:Infinity};
const metrics={minTriangleArea:Infinity,maxTriangleArea:0,maxCardPenetration:0,maxDerivativeLengthError:0,maxShadowProjectionError:0};

check(paperSpace.duration===13&&paperSpace.loop===false,'single 13 second candidate');
check(TOPOLOGY.length===GRID.rows*GRID.columns*2,'fixed triangulated grid');
check(new Set(TOPOLOGY.map(f=>f.id)).size===TOPOLOGY.length,'unique face IDs');
check(new Set(expectedIdentity.map(v=>v[0])).size===expectedIdentity.length,'unique vertex IDs');
check(TOPOLOGY.every(f=>f.vertices.length===3&&new Set(f.vertices).size===3&&f.vertices.every(i=>i>=0&&i<expectedIdentity.length)),'valid indices');

// Aggregate per-state invariants, instead of emitting an assertion for every mesh number.
for(let i=0;i<=78;i++){
    const t=i/6,s=samplePaperSpace(t),render=projectedPaperScene(s);samples++;
    equal(s.vertices.map(v=>[v.id,v.index,v.parentId,...v.uv]),expectedIdentity,'vertex identities and UVs persist');
    equal(s.topology,TOPOLOGY,'face topology persists');
    check(s.parent.id===PAPER_ID&&s.cards.every(c=>c.parentId===PAPER_ID),'one explicit assembly parent');
    check(s.vertices.every(v=>[...v.world,...v.local,...v.normal,...v.shadow].every(Number.isFinite)),'finite vertices, normals and shadows');
    check(s.vertices.every(v=>v.world[1]>=.1-1e-12),'paper does not penetrate its support');
    check(s.vertices.every(v=>Math.abs(norm(v.normal)-1)<1e-12),'unit material normals');
    check(s.vertices.filter(v=>v.uv[0]===.5).every(v=>Math.abs(v.local[0])<1e-12&&Math.abs(v.local[1])<1e-12),'central contact generatrix remains fixed');
    let minArea=Infinity,maxArea=0,maxShadowError=0;
    for(const f of TOPOLOGY){const [a,b,c]=f.vertices.map(index=>s.vertices[index].world);const area=norm(cross(sub(b,a),sub(c,a)))/2;minArea=Math.min(minArea,area);maxArea=Math.max(maxArea,area);}
    metrics.minTriangleArea=Math.min(metrics.minTriangleArea,minArea);metrics.maxTriangleArea=Math.max(metrics.maxTriangleArea,maxArea);
    check(minArea>.018&&maxArea<.022,'all mesh faces remain nondegenerate at every bend');
    for(const v of s.vertices){
        const delta=sub(v.world,v.shadow),collinearity=norm(cross(delta,LIGHT_DIRECTION));maxShadowError=Math.max(maxShadowError,collinearity);
    }
    metrics.maxShadowProjectionError=Math.max(metrics.maxShadowProjectionError,maxShadowError);
    check(maxShadowError<1e-12&&s.vertices.every(v=>Math.abs(v.shadow[1]-.014)<1e-12),'shadows follow actual vertices onto one receiver');
    check(render.triangles.every(tr=>tr.screen.every(p=>p&&p.every(Number.isFinite))&&Number.isFinite(tr.depth)),'all visible geometry projects finitely');
    for(const tr of render.triangles){bounds.minDepth=Math.min(bounds.minDepth,tr.depth);for(const p of tr.screen){bounds.minX=Math.min(bounds.minX,p[0]);bounds.maxX=Math.max(bounds.maxX,p[0]);bounds.minY=Math.min(bounds.minY,p[1]);bounds.maxY=Math.max(bounds.maxY,p[1]);}}
    check(render.triangles.every(tr=>tr.depth>.12),'geometry remains beyond near plane');
    check(render.triangles.every((tr,j,all)=>j===0||all[j-1].depth>=tr.depth),'single shared depth queue');
    check(s.cards.every(c=>c.corners.every(p=>p[1]>=.14499999)),'card lift cannot sink through paper');
    check(s.cards.every(c=>c.lift>=-1e-12&&c.lift<=.5400001),'bounded continuous lift');
    if(s.bend>0)check(s.cards.every(c=>c.progress===1&&c.travel===1&&c.lift===0),'all cards clear before main bend starts');
}
check(bounds.minX>65&&bounds.maxX<1535&&bounds.minY>165&&bounds.maxY<730,'whole stage stays inside content safe area');

// Intrinsic surface dimensions: cylinder bending is locally length-preserving.
for(const theta of [0,.00001,.5,1.8,3.0,4.5])for(const u of [.02,.25,.5,.75,.98]){
    const h=1e-5,du=sub(surfacePoint(u+h,.4,theta),surfacePoint(u-h,.4,theta)).map(x=>x/(2*h));
    const dv=sub(surfacePoint(u,.4+h,theta),surfacePoint(u,.4-h,theta)).map(x=>x/(2*h));
    metrics.maxDerivativeLengthError=Math.max(metrics.maxDerivativeLengthError,Math.abs(norm(du)-GRID.width),Math.abs(norm(dv)-GRID.depth));
    near(norm(du),GRID.width,3e-8,'cross-sheet arc-length derivative');near(norm(dv),GRID.depth,1e-8,'depth derivative');
    near(dot(du,dv),0,1e-10,'orthogonal UV tangents');
    near(dot(du,surfaceNormal(u,theta)),0,3e-9,'normal perpendicular to tangent');
}
// The open curl does not close or cross itself: each u remains an ordered arc coordinate.
for(const theta of [0,1.8,4.5]){
    const points=Array.from({length:65},(_,i)=>surfacePoint(i/64,.5,theta));
    let minApart=Infinity;for(let a=0;a<65;a++)for(let b=a+2;b<65;b++)minApart=Math.min(minApart,norm(sub(points[a],points[b])));
    check(minApart>.15,'nonadjacent samples do not self-intersect');
}

for(const [a,b] of [[6.2,7.15],[10.4,13]]){
    const first=samplePaperSpace(a);
    for(const t of [a,(a+b)/2,b]){
        const s=samplePaperSpace(t);equal(s.vertices,first.vertices,'read window holds geometry');equal(s.cards,first.cards,'read window holds cards');equal(s.camera,first.camera,'read window holds camera');
    }
}
const joins=[1.05,1.42,1.79,2.55,2.92,3.29,3.5,6.2,7.15,9.6];
const positions=s=>[...s.camera.position,...s.camera.target,...s.cards.flatMap(c=>c.world),...s.vertices.filter(v=>v.index%100===0).flatMap(v=>v.world)];
let maxVelocityJump=0;
for(const t of joins){const h=1e-4,a=positions(samplePaperSpace(t-h)),b=positions(samplePaperSpace(t)),c=positions(samplePaperSpace(t+h));
    const error=Math.max(...a.map((v,i)=>Math.abs((b[i]-v)/h-(c[i]-b[i])/h)));maxVelocityJump=Math.max(maxVelocityJump,error);check(error<.004,'stage velocity continuity');}

// No mutable playhead state: backward and arbitrary access yields exact same data.
const times=[0,.3,2.1,4.7,6.6,9.2,11.5,13];
const states=times.map(samplePaperSpace);
equal(times.toReversed().map(samplePaperSpace).toReversed(),states,'reverse access matches forward access');
equal(samplePaperSpace(-8),samplePaperSpace(0),'negative time holds start');equal(samplePaperSpace(30),samplePaperSpace(13),'late time holds end');equal(samplePaperSpace(NaN),samplePaperSpace(0),'invalid time deterministic');
check(samplePaperSpace(1.3).cards[0].progress>0&&samplePaperSpace(1.3).cards[1].progress===0,'first card moves alone');
check(samplePaperSpace(1.6).cards[1].progress>0&&samplePaperSpace(1.6).cards[2].progress===0,'second card precedes third');

const report={passed:true,candidate:paperSpace.id,checks,stateSamples:samples,vertexCount:expectedIdentity.length,faceCount:TOPOLOGY.length,bounds,metrics,maxVelocityJump,
    verified:['Persistent vertex/face IDs and UVs','Analytic arc-length-preserving bend','Nondegenerate surface','No cross-section self-intersection','Card clearance before bend','Shadows projected from actual vertices','Shared depth ordering','Near plane and safe area','Stable geometry/camera read windows','Absolute-time random seek','Continuous stage velocities'],
    notVerified:['Browser visual QA and texture readability','Real paper elasticity or cloth dynamics','Ray tracing','Original creator source code']};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/paper-space.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
