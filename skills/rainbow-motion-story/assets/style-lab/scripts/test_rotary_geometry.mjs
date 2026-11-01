import assert from 'node:assert/strict';
import {
  ROTARY_DEFAULTS, ROTARY_TAGGED_PERIOD, rotaryParameters, housingPoint,
  sampleHousing, sampleRotaryState, sampleRotorBoundary, housingRadialClearance, pointInHousing,
} from '../lab/modules/rotary-geometry.js';

const TAU = 2 * Math.PI;
const near = (a, b, eps = 2e-11) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const nearPoint = (a, b, eps) => { near(a.x, b.x, eps); near(a.y, b.y, eps); };
const cross = (a, b) => a.x * b.y - a.y * b.x;

// Independent oracle: ray/segment intersection against an 8192-edge polygon.
// It does not use the implementation's polar inversion / containment function.
function polygonClearance(p, polygon) {
  const angle = Math.atan2(p.y, p.x);
  let lo = 0, hi = polygon.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (polygon[mid].angle <= angle) lo = mid; else hi = mid;
  }
  const a = polygon[lo], b = polygon[hi];
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const ray = { x: Math.cos(angle), y: Math.sin(angle) };
  return cross(a, edge) / cross(ray, edge) - Math.hypot(p.x, p.y);
}

function housingPolygon(options) {
  const vertices = sampleHousing(options, 8192)
    .map(p => ({ ...p, angle: Math.atan2(p.y, p.x) })).sort((a, b) => a.angle - b.angle);
  return [{ ...vertices.at(-1), angle: vertices.at(-1).angle - TAU }, ...vertices,
    { ...vertices[0], angle: vertices[0].angle + TAU }];
}

const originState = sampleRotaryState(0);
nearPoint(originState.center, { x: 0.22, y: 0 });
nearPoint(originState.apices[0], { x: 1.22, y: 0 });
const quarter = sampleRotaryState(Math.PI / 2);
nearPoint(quarter.center, { x: 0, y: 0.22 });
nearPoint(quarter.apices[0], { x: Math.sqrt(3) / 2, y: 0.72 });
near(quarter.rotorAngle, Math.PI / 6);
nearPoint(housingPoint(Math.PI / 2), { x: 0, y: 0.78 });
assert.ok(Math.hypot(...Object.values(quarter.apices[0])) > 1); // noncircular housing fixture

let phases = 0, apexChecks = 0, solidChecks = 0, maximumApexResidual = 0, minimumPolygonGap = Infinity;
const optionsList = [ROTARY_DEFAULTS, { eccentricity: 0, rotorRadius: 1 },
  { eccentricity: 0.15, rotorRadius: 1 }, { eccentricity: 0.25, rotorRadius: 1 },
  { eccentricity: 22, rotorRadius: 100 }];
for (const options of optionsList) {
  const { eccentricity: e, rotorRadius: R } = rotaryParameters(options);
  const polygon = housingPolygon(options);
  let doubleArea = 0;
  const boundary = sampleHousing(options, 8192);
  for (let k = 0; k < boundary.length; k++) doubleArea += cross(boundary[k], boundary[(k + 1) % boundary.length]);
  near(doubleArea / 2, Math.PI * (R * R + 3 * e * e), R * R * 1e-5);
  nearPoint(housingPoint(0, options), housingPoint(TAU, options));
  for (let i = 0; i <= 720; i++) {
    // From minus three to plus six shaft revolutions: multiple forward/reverse wraps.
    const theta = -ROTARY_TAGGED_PERIOD + 3 * ROTARY_TAGGED_PERIOD * i / 720;
    const s = sampleRotaryState(theta, options);
    phases++;
    near(Math.hypot(s.center.x, s.center.y), e, R * 1e-12);
    near(s.rotorAngle * 3, theta);
    for (let k = 0; k < 3; k++) {
      const p = s.apices[k];
      nearPoint(p, housingPoint(theta / 3 + k * TAU / 3, options), R * 1e-11);
      near(Math.hypot(p.x - s.center.x, p.y - s.center.y), R, R * 1e-11);
      const gap = housingRadialClearance(p, options);
      maximumApexResidual = Math.max(maximumApexResidual, Math.abs(gap) / R);
      near(gap, 0, R * 2e-11);
      assert.ok(pointInHousing(p, options));
      apexChecks++;
    }
    for (const p of sampleRotorBoundary(theta, options, 32)) {
      const gap = polygonClearance(p, polygon) / R;
      minimumPolygonGap = Math.min(minimumPolygonGap, gap);
      assert.ok(gap > -2e-6, `Triangle crosses housing: e/R=${e / R}, theta=${theta}, gap/R=${gap}`);
      solidChecks++;
    }
    // Barycentric lattice covers the filled triangle, not only its three tips.
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8 - a; b++) {
      const w = [a / 8, b / 8, 1 - (a + b) / 8];
      const p = { x: 0, y: 0 };
      for (let k = 0; k < 3; k++) { p.x += s.apices[k].x * w[k]; p.y += s.apices[k].y * w[k]; }
      const gap = polygonClearance(p, polygon) / R;
      minimumPolygonGap = Math.min(minimumPolygonGap, gap);
      assert.ok(gap > -2e-6, `Solid triangle crosses housing: ${gap}`);
      solidChecks++;
    }
    const full = sampleRotaryState(theta + ROTARY_TAGGED_PERIOD, options);
    const shaftTurn = sampleRotaryState(theta + TAU, options);
    for (let k = 0; k < 3; k++) {
      nearPoint(full.apices[k], s.apices[k], R * 2e-11);
      nearPoint(shaftTurn.apices[k], s.apices[(k + 1) % 3], R * 2e-11);
    }
  }
  for (const theta of [TAU, 2 * TAU, 3 * TAU, -TAU]) {
    const before = sampleRotaryState(theta - 1e-7, options), after = sampleRotaryState(theta + 1e-7, options);
    for (let k = 0; k < 3; k++) assert.ok(Math.hypot(before.apices[k].x - after.apices[k].x, before.apices[k].y - after.apices[k].y) < R * 2e-7);
  }
  assert.ok(!pointInHousing({ x: 1.01 * (R + e), y: 0 }, options));
  assert.ok(pointInHousing({ x: 0, y: 0 }, options));
}
for (const bad of [NaN, Infinity, -Infinity]) assert.throws(() => sampleRotaryState(bad));
for (const bad of [-0.1, 0.251, 0.32, 1 / 3, 0.5]) assert.throws(() => rotaryParameters({ eccentricity: bad, rotorRadius: 1 }));
// Regression witness for the rejected domain: at theta=pi/2 a straight flank
// midpoint is y=e+R/2 while the housing waist is y=R-e. e=.32 exceeds it by .14.
near((0.32 + 0.5) - (1 - 0.32), 0.14);
assert.throws(() => rotaryParameters({ rotorRadius: 0 }));
assert.throws(() => sampleHousing({}, 3));
assert.throws(() => sampleRotorBoundary(0, {}, 1.5));
assert.throws(() => pointInHousing({ x: NaN, y: 0 }));
assert.throws(() => pointInHousing({ x: 0, y: 0 }, {}, -1));
console.log(JSON.stringify({ status: 'passed', phases, apexChecks, solidChecks, parameterSets: optionsList,
  maximumApexResidualInRadiusUnits: maximumApexResidual, minimumPolygonGapInRadiusUnits: minimumPolygonGap,
  polygonOracleSegments: 8192, polygonToleranceInRadiusUnits: 2e-6,
  note: 'Finite sampling validates these parameter sets; this is not a production-engine or continuous collision proof.' }, null, 2));
