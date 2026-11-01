import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SWITCH_DURATION, SWITCH_DEFAULTS, SWITCH_PART_IDS, resolveSwitchParameters,
  sampleSwitchCycle, sampleSwitchMechanism, sampleSwitchForceCurve } from '../lab/modules/switch-mechanism.js';

let checks = 0, samples = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const near = (a, b, tolerance = 1e-10, message = 'near') => check(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
const physics = s => ({ press: s.press, travelMm: s.travelMm, velocity: s.velocityMmPerS,
  spring: s.spring, contact: s.contact, actuator: s.actuator, force: s.force, energy: s.elasticEnergyNmm, geometry: s.geometry,
  parts: s.parts.map(p => ({ id: p.id, restPosition: p.restPosition, operatingPosition: p.operatingPosition })) });

equal(sampleSwitchMechanism(0).parts.map(p => p.id), SWITCH_PART_IDS, 'stable part identity');
const initial = sampleSwitchMechanism(0), bottom = sampleSwitchMechanism(5), final = sampleSwitchMechanism(SWITCH_DURATION);
near(initial.spring.lengthMm, 10); near(initial.spring.compressionMm, 2); near(initial.force.springN, .16);
near(bottom.spring.lengthMm, 6); near(bottom.spring.compressionMm, 6); near(bottom.force.springN, .48);
near(bottom.contact.overtravelMm, 2); near(bottom.contact.forceN, .72); near(bottom.force.contactReflectedN, .216); near(bottom.force.totalN, .696);
equal(physics(initial), physics(final), 'one full press and release restores all physical state');
check(!initial.contact.closed && bottom.contact.closed && !final.contact.closed, 'normally open, held closed, reopened');
equal(sampleSwitchCycle(-20), sampleSwitchCycle(0), 'negative time clamps');
equal(sampleSwitchCycle(90), sampleSwitchCycle(12), 'terminal hold');

let lastClosed = false, closeTransitions = 0, openTransitions = 0, previous = initial;
for (let frame = 0; frame <= 720; frame++) {
  const t = frame / 60, s = sampleSwitchMechanism(t); samples++;
  if (s.contact.closed !== lastClosed) { if (s.contact.closed) closeTransitions++; else openTransitions++; lastClosed = s.contact.closed; }
  check(s.press >= 0 && s.press <= 1, 'travel stays inside stops');
  near(s.spring.lengthMm + s.travelMm, SWITCH_DEFAULTS.springInstalledLengthMm, 1e-11, 'stem and spring same displacement');
  near(s.spring.top.y - s.spring.bottom.y, s.spring.lengthMm, 1e-11, 'actual endpoints equal reported spring length');
  near(s.geometry.stem.center.y - s.geometry.stem.size.y / 2, s.spring.top.y, 1e-11, 'stem seats on spring top');
  near(s.geometry.keycap.center.y - s.geometry.keycap.size.y / 2, s.geometry.stem.center.y + s.geometry.stem.size.y / 2, 1e-11, 'keycap stays on stem');
  near(s.spring.points[0].y, s.spring.bottom.y); near(s.spring.points.at(-1).y, s.spring.top.y);
  check(s.spring.lengthMm > s.spring.solidLengthMm && s.spring.pitchMm > s.spring.wireDiameterMm, 'no coil bind / overlapping adjacent turns');
  near(Math.hypot(2 * Math.PI * s.spring.turns * s.spring.radiusMm, s.spring.lengthMm), s.spring.wireCenterlineLengthMm, 1e-10, 'ideal helix does not shorten its wire');
  const c = s.contact;
  near(distance(c.fixedPadCenter, c.movingPadCenter) - 2 * c.padRadiusMm, c.gapMm, 1e-10, 'gap refers to metal pad surfaces');
  near(distance(c.fixedTip, c.movingTip), c.gapMm);
  equal(c.movingLeafPoints[0], c.movingRoot, 'leaf root stays fixed');
  equal(c.movingLeafPoints.at(-1), c.movingPadCenter, 'leaf ends at moving pad');
  const a = s.actuator, [rampBottom, rampTop] = a.camProfile;
  near(a.camContactPoint.x, rampBottom.x + (rampTop.x - rampBottom.x) *
    (a.camContactPoint.y - rampBottom.y) / (rampTop.y - rampBottom.y), 1e-10, 'follower face stays on the actual moving ramp');
  check(a.camContactPoint.y >= rampBottom.y && a.camContactPoint.y <= rampTop.y, 'follower remains within finite ramp');
  near(a.followerCenter.x + a.followerSize.x / 2, a.camContactPoint.x, 1e-11, 'follower touches cam without penetrating it');
  for (const tip of a.followerProfile.slice(0, 2)) near(tip.x,
    rampBottom.x + (rampTop.x - rampBottom.x) * (tip.y - rampBottom.y) / (rampTop.y - rampBottom.y), 1e-10,
    'sloped shoe contact face matches ramp at both corners');
  equal(a.compliance.from, c.driveAnchor, 'compliance attaches to contact leaf');
  equal(c.movingLeafPoints[12], c.driveAnchor, 'drive anchor lies on the actual leaf centreline');
  near(a.compliance.lengthMm + a.compliance.compressionMm, a.compliance.freeLengthMm, 1e-10, 'post-contact stroke compresses actual series-compliance gap');
  check(a.compliance.lengthMm > .29, 'series-compliance element never collapses or reverses');
  near(a.compliance.forceN, c.forceN, 0, 'contact force comes from visible compliant coupling');
  near(a.supportPoints[0].y, s.geometry.stem.center.y, 0, 'cam support moves with stem');
  check(c.gapMm >= 0 && c.overtravelMm >= 0 && c.forceN >= 0, 'unilateral contact without penetration');
  equal(c.closed, s.travelMm >= c.actuationTravelMm, 'electrical threshold comes from mechanical travel');
  if (c.closed) { near(c.gapMm, 0); near(c.movingPadCenter.x, 3.4); }
  else near(c.forceN, 0);
  if (t > 1 && t <= 4) check(s.press >= previous.press && s.velocityMmPerS >= 0, 'monotone press');
  if (t > 6 && t <= 9) check(s.press <= previous.press && s.velocityMmPerS <= 0, 'monotone release');
  previous = s;
}
equal(closeTransitions, 1, 'exactly one closure per press'); equal(openTransitions, 1, 'exactly one opening on release');
for (const t of [1, 4, 6, 9]) {
  near(sampleSwitchMechanism(t).velocityMmPerS, 0, 0, 'smooth segment boundaries');
  near(sampleSwitchMechanism(t - 1e-6).press, sampleSwitchMechanism(t + 1e-6).press, 1e-10, 'continuous prescribed displacement');
}

const threshold = SWITCH_DEFAULTS.actuationTravelMm / SWITCH_DEFAULTS.travelMm;
for (const press of [threshold - 1e-9, threshold, threshold + 1e-9]) {
  const s = sampleSwitchMechanism(0, { press });
  equal(s.contact.closed, press >= threshold, 'exact threshold convention');
  equal(s.velocityMmPerS, null, 'one manual pose does not imply velocity');
  check(s.contact.gapMm < 2e-9 && s.contact.overtravelMm < 5e-9, 'continuous gap and overtravel across closure');
}
const below = sampleSwitchMechanism(0, { press: threshold - 1e-8 }), above = sampleSwitchMechanism(0, { press: threshold + 1e-8 });
near(below.force.totalN, above.force.totalN, 1e-7, 'continuous elastic force at first contact');
for (const press of [0, .2, .499, .5, .8, 1]) {
  const assembled = sampleSwitchMechanism(2, { press });
  for (const explode of [0, .2, .5, 1]) {
    const exploded = sampleSwitchMechanism(2, { press, explode });
    equal(physics(assembled), physics(exploded), 'exploded presentation cannot alter circuit/spring/force');
    for (const p of exploded.parts) for (const axis of ['x', 'y', 'z']) near(p.position[axis], p.operatingPosition[axis] + p.displayOffset[axis], 0, 'reversible display transform');
  }
  equal(sampleSwitchMechanism(2, { press, explode: 0 }), assembled, 'assembly recovered exactly after arbitrary exploded samples');
}

const times = [0, 8.12, 1.32, 12, 2.5, 7.5, 4, 6, 3.92];
const hashes = times.map(t => digest(sampleSwitchMechanism(t, { explode: .7 })));
equal(times.toReversed().map(t => digest(sampleSwitchMechanism(t, { explode: .7 }))).toReversed(), hashes, 'absolute-frame state is independent of playback order');
const expectedDigest = digest(sampleSwitchMechanism(2));
const external = sampleSwitchMechanism(2); external.parts[0].position.y = 100; external.spring.points[3].y = 100;
equal(digest(sampleSwitchMechanism(2)), expectedDigest, 'outputs do not retain external mutations');
const clean = sampleSwitchMechanism(2); check(clean.parts[0].position.y !== 100 && clean.spring.points[3].y !== 100, 'fresh state and geometry allocated each sample');

const curve = sampleSwitchForceCurve(101);
for (let i = 0; i < curve.length; i++) {
  const q = curve[i], s = sampleSwitchMechanism(0, { press: q.press });
  near(q.forceN, s.force.totalN, 0, 'plotted force and scene use same law'); equal(q.closed, s.contact.closed);
  if (i) check(q.forceN > curve[i - 1].forceN, 'ideal resistance strictly increases');
}
for (const x of [.4, 1.5, 2.5, 3.7]) {
  const h = 1e-5, p = SWITCH_DEFAULTS.travelMm;
  const a = sampleSwitchMechanism(0, { press: (x - h) / p }), b = sampleSwitchMechanism(0, { press: (x + h) / p });
  near((b.elasticEnergyNmm - a.elasticEnergyNmm) / (2 * h), sampleSwitchMechanism(0, { press: x / p }).force.totalN, 1e-9, 'resistance equals elastic energy derivative including contact lever ratio');
}
const custom = sampleSwitchMechanism(5, { parameters: { travelMm: 3, actuationTravelMm: 1.2, contactRestGapMm: .5 } });
near(custom.travelMm, 3); near(custom.spring.lengthMm, 7); near(custom.contact.gapMm, 0); near(custom.contact.overtravelMm, 1.8);
for (const value of [NaN, Infinity, -Infinity]) {
  assert.throws(() => sampleSwitchMechanism(value)); assert.throws(() => sampleSwitchMechanism(0, { press: value }));
  assert.throws(() => sampleSwitchMechanism(0, { explode: value }));
}
for (const p of [{ travelMm: 0 }, { actuationTravelMm: 4 }, { springInstalledLengthMm: 7 },
  { springFreeLengthMm: 9 }, { springTurns: 1 }, { springTurns: 8.5 }, { springWireDiameterMm: 1 },
  { springSolidLengthMm: 1 }, { springStiffnessNPerMm: 0 }, { contactRestGapMm: 0 }, { contactStiffnessNPerMm: -.1 }]) assert.throws(() => resolveSwitchParameters(p));
assert.throws(() => sampleSwitchForceCurve(1));
console.log(JSON.stringify({ passed: true, checks, samples, closeTransitions, openTransitions,
  partIds: SWITCH_PART_IDS, units: { length: 'mm', force: 'N', energy: 'N mm' },
  verified: ['single press and return', 'surface-gap threshold and no pad penetration', 'contact continuity and compliant overtravel',
    'spring seating, compression and constant ideal wire length', 'actual cam/follower and series-compliance geometry',
    'force as elastic-energy derivative', 'display/physics independence',
    'assembly restoration', 'absolute-frame determinism', 'curve/scene consistency'],
  limitations: ['Original teaching dimensions', 'Prescribed motion, no dynamics or FEM', 'Illustrative leaf centreline, no stress solution',
    'No bounce, hysteresis, friction, tactile snap, or electrical load', 'No browser/raster validation'] }, null, 2));
