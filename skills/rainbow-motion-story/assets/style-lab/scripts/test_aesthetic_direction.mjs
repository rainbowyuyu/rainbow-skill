import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { candidates, FACTS, STAGE_TIMES, STAGES, buildRingMesh, projectRingPoint } from '../lab/modules/aesthetic-direction.js';

let checks = 0, states = 0, draws = 0;
const check = (yes, message) => { assert.ok(yes, message); checks++; };
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const near = (a, b, tolerance, message) => check(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance, `${message}: ${a}, ${b}`);
const numbers = value => Array.isArray(value) ? value.flatMap(numbers) : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : typeof value === 'number' ? [value] : [];
const expectedFacts = { objectId: 'ring-01', units: '设计单位', outerDiameter: 2.4, innerDiameter: 1.28, thickness: .32, fasteners: 8, sectorDegrees: 60 };
equal(FACTS, expectedFacts, 'all dimensions, count and design units are explicit');
check(candidates.length === 3 && new Set(candidates.map(c => c.id)).size === 3, 'three distinct original candidates');
equal(candidates.map(c => c.variant), ['editorial', 'industrial', 'orbital'], 'three directions exposed to workbench');

for (const c of candidates) {
  check(c.duration === 14 && c.loop === false && c.module === 'look', 'finite 14-second look candidate');
  equal(c.stageTimes, STAGE_TIMES, 'shared semantic stage times'); equal(c.stages, STAGES, 'aligned stage labels');
  check(c.controls.palette === false && c.controls.intensity === false, 'no fake generic controls');
  equal(c.sample(-1), c.sample(0), 'negative time clamp'); equal(c.sample(NaN), c.sample(0), 'nonfinite time clamp'); equal(c.sample(Infinity), c.sample(0), 'infinity does not poison sample');
  equal(c.sample(20), c.sample(14), 'last frame holds');
  const times = [14, 0, 7.3, 2.8, 11.6, 4.6];
  equal(times.map(t => c.sample(t)), times.toReversed().map(t => c.sample(t)).toReversed(), 'absolute-time seek independent of call history');
  c.stageTimes.forEach((t, i) => check(c.sample(t).stageIndex === i, 'exact boundary selects corresponding stage'));
  const terminal = c.sample(14);
  for (let frame = 0; frame <= 14 * 60; frame++) {
    const s = c.sample(frame / 60); states++;
    check(numbers(s).every(Number.isFinite), 'sample numeric state is finite');
    equal(s.facts, expectedFacts, 'presentation never changes content facts');
    check(s.objectId === 'ring-01' && new Set(s.objectParts).size === 10, 'ring and eight fasteners preserve identities');
    check(s.physicalSimulation === false && s.illustrative === true, 'visual metaphor remains explicit');
    if (s.readHold) {
      check(s.geometryStable && s.pose.sectionOffset === 0, 'reading hold is complete and assembled');
      equal(s.pose, terminal.pose, 'all pose, light and outline parameters stable during reading');
      near(s.trajectoryAlpha, 0, 0, 'no lingering trajectories behind reading');
    }
  }
  // Continuity of camera and object positions, checked at every easing join.
  for (const t of [.5, 2, 2.1, 4.1, 4.5, 5.1, 5.2, 6, 6.5, 7.1, 7.5, 8.4, 8.5, 9.3, 10.7, 11.1, 11.4]) {
    const h = 1e-5, before = c.sample(t - h), at = c.sample(t), after = c.sample(t + h);
    const a = numbers(before.pose), b = numbers(at.pose), d = numbers(after.pose);
    for (let i = 0; i < b.length; i++) near((b[i] - a[i]) / h, (d[i] - b[i]) / h, .06, 'velocity has no boundary jump');
    const anchor = [.93 * Math.cos(Math.PI / 8), .93 * Math.sin(Math.PI / 8), .202];
    const pa = projectRingPoint(anchor, before.pose, 'sector'), pb = projectRingPoint(anchor, at.pose, 'sector'), pc = projectRingPoint(anchor, after.pose, 'sector');
    for (let i = 0; i < 2; i++) near((pb[i] - pa[i]) / h, (pc[i] - pb[i]) / h, .2, 'actual moving fastener anchor has continuous projected speed');
  }
  // Full result needs to fit in the object lane rather than behind the reading lane.
  for (const f of buildRingMesh(0)) for (const p of f.vertices) {
    const q = projectRingPoint(p, terminal.pose);
    const bounds = c.variant === 'editorial' ? [600, 1535, 90, 755] : c.variant === 'industrial' ? [590, 1535, 215, 810] : [460, 1140, 205, 705];
    check(q[0] > bounds[0] && q[0] < bounds[1] && q[1] > bounds[2] && q[1] < bounds[3], `complete final ${c.variant} object is inside its own composition lane`);
  }
}

// Geometry checks use actual mesh vertices, not sample-reported dimension values.
const base = buildRingMesh(0), moved = buildRingMesh(.56), ring = base.filter(f => ['front', 'back', 'bevel', 'wall'].includes(f.kind));
const vertices = ring.flatMap(f => f.vertices), radii = vertices.map(p => Math.hypot(p[0], p[1]));
near(Math.max(...radii) * 2, expectedFacts.outerDiameter, 1e-12, 'actual outer diameter');
near(Math.min(...radii) * 2, expectedFacts.innerDiameter, 1e-12, 'actual bore diameter');
near(Math.max(...vertices.map(p => p[2])) - Math.min(...vertices.map(p => p[2])), expectedFacts.thickness, 1e-12, 'actual thickness');
check(base.filter(f => f.kind === 'bolt').length === 8, 'mesh has exactly eight bolt heads');
check(moved.filter(f => f.kind === 'cut').length === 4, 'two cap faces on each separated part');
check(ring.filter(f => f.part === 'sector' && f.kind === 'front').length * 3 === 60, 'sector occupies exactly sixty degrees');
const withoutCaps = moved.filter(f => f.kind !== 'cut');
check(withoutCaps.length === base.length, 'separation never drops mesh faces');
for (let i = 0; i < base.length; i++) {
  const f = base[i], g = withoutCaps[i]; equal(f.normal, g.normal, 'separation keeps material normals');
  const expectedShift = f.part === 'sector' ? [.56 * Math.cos(Math.PI / 6), .56 * Math.sin(Math.PI / 6), .56 * .12] : [0, 0, 0];
  for (let j = 0; j < f.vertices.length; j++) for (let k = 0; k < 3; k++) near(g.vertices[j][k] - f.vertices[j][k], expectedShift[k], 1e-12, 'every attached vertex follows the same rigid translation');
}
const front = ring.filter(f => f.kind === 'front');
check(front.every(f => f.normal[2] > .99999), 'front-face winding consistently faces camera at identity pose');
check(base.every(f => Math.abs(Math.hypot(...f.normal) - 1) < 1e-12), 'all polygon normals are unit length');
// Style differences include actual camera trajectories and scale, not only paint.
const peakPoses = candidates.map(c => c.sample(7.7).pose);
check(peakPoses[0].scale < 310 && peakPoses[1].scale > 500 && peakPoses[2].scale > 1100, 'three distinctive scale and framing strategies');
check(peakPoses[0].sectionOffset > peakPoses[1].sectionOffset && peakPoses[1].sectionOffset > peakPoses[2].sectionOffset, 'structure reveal tailored to composition');
check(candidates[2].sample(0).pose.center[0] === 800 && peakPoses[2].center[0] === 800 && candidates[2].sample(14).pose.center[0] === 800, 'orbital composition always follows the central axis');

// Exercise actual draw paths with a strict recorder. This is not a raster/beauty test.
let trace = [], depth = 0;
function makeContext() {
  const state = { globalAlpha: 1, filter: 'none', globalCompositeOperation: 'source-over' }, stack = [];
  return new Proxy(state, {
    get(o, key) {
      if (key in o) return o[key];
      if (key === 'save') return () => { depth++; stack.push({ ...o }); trace.push(['save']); };
      if (key === 'restore') return () => { check(depth > 0, 'balanced Canvas restore'); depth--; Object.assign(o, stack.pop()); trace.push(['restore']); };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => {
        check(args.every(Number.isFinite), 'finite gradient endpoints'); trace.push([key, ...args]);
        return { gradient: true, addColorStop: (...args) => { check(args[0] >= 0 && args[0] <= 1, 'valid gradient stop'); trace.push(['stop', ...args]); } };
      };
      return (...args) => { check(args.filter(v => typeof v === 'number').every(Number.isFinite), 'finite Canvas geometry'); trace.push([key, ...args]); };
    },
    set(o, key, value) { if (typeof value === 'number') check(Number.isFinite(value), 'finite Canvas property'); o[key] = value; trace.push(['set', key, value?.gradient ? 'gradient' : value]); return true; }
  });
}
for (const c of candidates) {
  const ctx = makeContext();
  for (const t of [0, 2.8, 4.5, 7.7, 9.4, 11.4, 14]) {
    trace = []; c.draw(ctx, t, 1600, 900); const first = trace; draws++;
    check(depth === 0, 'draw leaves context stack balanced');
    check(trace.some(call => call[0] === 'fillText' && call[1] === '看清一个圆环'), 'main title drawn once in shared reading lane');
    const title = trace.find(call => call[0] === 'fillText' && call[1] === '看清一个圆环');
    const expected = c.variant === 'editorial' ? [96, 266] : c.variant === 'industrial' ? [96, 125] : [800, 112];
    equal(title.slice(2), expected, 'three different layout structures have explicit title locations');
    const lastGeometry = trace.findLastIndex(call => call[0] === 'lineTo');
    check(trace.findLastIndex(call => call[0] === 'fillText') > lastGeometry, 'final numeric reading line stays independent of object rendering');
    trace = []; c.draw(ctx, 5.65, 1600, 900); trace = []; c.draw(ctx, t, 1600, 900); equal(trace, first, 'draw independent of prior time and retained canvas content');
  }
  trace = []; c.draw(ctx, 11.4, 1600, 900); const hold = trace; trace = []; c.draw(ctx, 13.7, 1600, 900); equal(trace, hold, 'reading hold freezes actual draw commands');
}
const report = {
  passed: true, checks, states, draws,
  verified: ['Three distinct compositions at identical semantic times', 'Same facts, object IDs and design units', 'Actual mesh dimensions and eight fasteners', 'Shared rigid sector/bolt movement', 'Real caps on separated cross sections', 'Continuous projected camera/object velocity at easing joins', 'Final object fully inside reserved lane', 'Stable complete result during read hold', 'Nonloop clamp and arbitrary seek', 'Actual Canvas draw determinism and finite arguments'],
  notVerified: ['Browser raster appearance and subjective beauty', 'True ray tracing', 'Real engineering product dimensions', 'Physics simulation', 'Original source renderer or source code']
};
writeFileSync(fileURLToPath(new URL('../qa/aesthetic-direction.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
