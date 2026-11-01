import assert from 'node:assert/strict';
import { candidates, sample, draw, projectPoint } from '../lab/modules/ui-choreography.js';

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function near(a, b, tolerance = 1e-8, message = `${a} ≈ ${b}`) { check(Math.abs(a - b) <= tolerance, message); }
function same(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
const fields = ['x', 'y', 'width', 'height'];
const boxValues = b => fields.map(field => b[field]);
const roundedContains = (mask, hero) => {
  // Rectangular containment is conservative for the square bounding box. At the
  // few close edges the actual rounded hero has the same or larger corner inset.
  const a = mask.box, b = hero.box, e = 1e-7;
  return b.x >= a.x - e && b.y >= a.y - e && b.x + b.width <= a.x + a.width + e && b.y + b.height <= a.y + a.height + e;
};
function allFinite(value, path = 'state') {
  if (typeof value === 'number') check(Number.isFinite(value), `${path} finite`);
  else if (Array.isArray(value)) value.forEach((v, i) => allFinite(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      allFinite(item, `${path}.${key}`);
      if (key.toLowerCase().endsWith('alpha')) check(item >= 0 && item <= 1, `${path}.${key} in [0,1]`);
    }
  }
}
function pose(state) {
  return { hero: state.hero, masks: state.masks, panels: state.panels, transform: state.transform };
}

same(candidates.map(c => c.id), ['ui-identity-relay', 'ui-click-to-timeline'], 'stable IDs');
for (const candidate of candidates) {
  check(candidate.duration >= 12 && candidate.duration <= 16, '12–16 second candidate');
  for (const key of ['id', 'title', 'description', 'duration']) check(Boolean(candidate[key]), `${key} metadata`);
  same(sample(-4, { id: candidate.id }), sample(0, { id: candidate.id }), 'before-start clamp');
  same(sample(999, { id: candidate.id }), sample(14, { id: candidate.id }), 'after-end clamp');
  for (const badTime of [NaN, Infinity, -Infinity, '3', null]) {
    assert.throws(() => sample(badTime, { id: candidate.id }), TypeError); checks++;
  }
  const times = [0, .3, 1.5, 2, 2.4, 2.7, 3, 3.9, 5.2, 5.6, 5.7, 6.1, 7.2, 8.4, 10, 11, 14];
  const expected = times.map(time => sample(time, { id: candidate.id }));
  // A deliberately scrambled sequence catches history-dependent integration.
  for (const i of [13, 3, 15, 0, 10, 5, 9, 6, 1, 14, 11, 4, 12, 2, 16, 8, 7]) {
    same(sample(times[i], { id: candidate.id }), expected[i], `${candidate.id} random seek @ ${times[i]}`);
  }
  const mutated = sample(4, { id: candidate.id });
  mutated.hero.box.x = -1000; mutated.events.push({ name: 'fake' });
  mutated.masks.hero.box.width = 1; mutated.transform.matrix[0] = 44;
  check(sample(4, { id: candidate.id }).hero.box.x > 0, 'returned state mutation is isolated');
  check(!sample(4, { id: candidate.id }).events.some(e => e.name === 'fake'), 'event list mutation isolated');
  for (let frame = 0; frame <= 14 * 60; frame++) {
    const time = frame / 60, state = sample(time, { id: candidate.id });
    allFinite(state);
    same(state.hero.id, 'sea-breeze-06', 'constant asset identity');
    same(state.representations.length, 1, 'exactly one representation');
    same(state.hero.representationCount, 1, 'no source/destination duplicate');
    same(state.representations[0].box, state.hero.box, 'display manifest matches geometry');
    check(state.hero.box.width > 0 && state.hero.box.height > 0, 'positive hero dimensions');
    check(roundedContains(state.masks.hero, state.hero), `mask contains hero at ${candidate.id} ${time}`);
    check(state.events.every(event => event.time <= time), 'no future event leakage');
    check(new Set(state.events.map(e => e.name)).size === state.events.length, 'no duplicate events');
    if (state.id === 'ui-click-to-timeline') {
      same(state.clipCommitted, time >= 5.6, 'commit follows completed placement');
      same(state.placeholderLabel, time < 3 ? '' : time < 5.6 ? '正在移入' : '已在时间线中', 'placeholder describes the actual transfer state');
      if (time >= 3 && time <= 5.6) near(state.explanationAlpha, 0, 0, 'flight corridor is clear of explanatory text');
      if (time < 5.6) check(state.placeholderLabel !== '已在时间线中', 'completion is never claimed before commit');
      const matrix = state.transform.matrix;
      check(matrix[0] * matrix[3] - matrix[1] * matrix[2] > .5, 'non-singular shared transform');
    }
  }
  const finalStart = candidate.id === 'ui-identity-relay' ? 10 : 11;
  same(pose(sample(finalStart, { id: candidate.id })), pose(sample(14, { id: candidate.id })), 'final reading pose is stable');
  check(sample(finalStart + .1, { id: candidate.id }).readWindow, 'final read window marked');
}
assert.throws(() => sample(0, { id: 'missing' }), /Unknown UI choreography candidate/); checks++;
same(sample(), sample(0, { id: 'ui-identity-relay' }), 'default candidate');

// Active geometry and mask paths have zero velocity at movement boundaries.
for (const [id, boundaries] of [
  ['ui-identity-relay', [2, 2.4, 5.2, 5.7, 7.2, 10]],
  ['ui-click-to-timeline', [2.7, 3, 5.6, 6.1, 8.4, 11]]
]) {
  for (const time of boundaries) {
    const epsilon = 1e-5;
    const before = sample(time - epsilon, { id }), at = sample(time, { id }), after = sample(time + epsilon, { id });
    for (const getter of [s => s.hero.box, s => s.masks.hero.box]) {
      const a = boxValues(getter(before)), b = boxValues(getter(at)), c = boxValues(getter(after));
      a.forEach((v, i) => {
        near(v, c[i], 1e-5, `${id} boundary box continuous @ ${time}`);
        near((b[i] - v) / epsilon, (c[i] - b[i]) / epsilon, .001, `${id} velocity continuous @ ${time}`);
      });
    }
    before.transform.matrix.forEach((v, i) => near(v, after.transform.matrix[i], 1e-5, `${id} transform continuous @ ${time}`));
  }
}

for (const time of [5.6, 6.1, 8.4, 9.5, 11, 14]) {
  const s = sample(time, { id: 'ui-click-to-timeline' });
  near(s.hero.box.x, s.playhead.x, 0, 'clip begins exactly at playhead');
  near(s.playhead.x, s.ruler.originX + s.playhead.seconds * s.ruler.pixelsPerSecond, 0, 'timecode agrees with the ruler');
  const clipLeft = projectPoint(s.transform.matrix, [s.hero.box.x, s.hero.box.y]);
  const playheadAtClipY = projectPoint(s.transform.matrix, [s.playhead.x, s.hero.box.y]);
  same(clipLeft, playheadAtClipY, 'playhead and clip share transform');
}
same(sample(11, { id: 'ui-click-to-timeline' }).transform.matrix, [1, 0, 0, 1, 0, 0], 'final exact identity matrix');
near(sample(0).hero.box.x, 347, 0, 'library starting position');
near(sample(14).hero.box.width, 590, 0, 'detail endpoint');

// A strict fake context verifies integration contracts only, not appearance.
function fakeContext() {
  let depth = 0, clips = 0, transforms = 0;
  const gradient = { addColorStop() {} };
  const ctx = {
    save() { depth++; }, restore() { check(depth > 0, 'balanced restore'); depth--; },
    clip() { clips++; }, transform() { transforms++; }, setTransform() {},
    beginPath() {}, roundRect() {}, fill() {}, stroke() {}, clearRect() {}, fillRect() {},
    fillText() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {},
    bezierCurveTo() {}, translate() {}, scale() {},
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    globalAlpha: 1,
    stats: () => ({ depth, clips, transforms })
  };
  return ctx;
}
for (const { id } of candidates) {
  for (const time of [0, 2.4, 4, 5.6, 9, 14]) {
    const ctx = fakeContext();
    same(draw(ctx, time, 1920, 1080, { id }), sample(time, { id }), 'draw returns sampled state');
    same(ctx.stats().depth, 0, 'draw restores Canvas state');
    check(ctx.stats().clips >= 2, 'active mask and asset crop are applied');
    same(ctx.stats().transforms, id === 'ui-click-to-timeline' ? 1 : 0, 'one shared panel transform');
  }
}
assert.throws(() => draw(fakeContext(), 0, 0, 900), RangeError); checks++;
console.log(`UI choreography: ${checks} assertions passed; 2 candidates, 1682 sampled frames. Visual QA remains a browser responsibility.`);
