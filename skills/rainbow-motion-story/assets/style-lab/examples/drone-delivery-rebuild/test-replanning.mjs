import assert from 'node:assert/strict';
import {createScenario, defaultObservations, validateRoute, segmentHits} from './replanning-example.mjs';

// Unsupported physical effects must never silently appear to have been simulated.
assert.throws(() => createScenario({wind: [1, 0]}), {name: 'TypeError', message: 'Unsupported scenario option: wind'});
const scenario = createScenario();
const final = scenario.sample(scenario.duration);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const futureChanged = createScenario({observations: [...defaultObservations, {time: 30, id: 'later', obstacles: [{id: 'later-building', min: [5, 20], max: [6, 21]}]}]});
const unseenChanged = createScenario({observations: [defaultObservations[0], {time: 4, id: 'different-future', obstacles: [{id: 'elsewhere', min: [25, 19], max: [27, 21]}]}]});
for (const t of [0, .8, 2, 3.98]) assert.deepEqual(scenario.sample(t), unseenChanged.sample(t), `future geometry leaked at ${t}`);
for (const t of [0, .24, .80, 2, 3.98, 4, 4.5, 8, 12, 25]) {
  assert.deepEqual(scenario.sample(t), futureChanged.sample(t), `future observation leaked at ${t}`);
}
const ordered = [0, .2, 4, 5, 8, 10, 15, 23, 34].map(t => scenario.sample(t));
for (const i of [8, 0, 5, 2, 7, 1, 6, 3, 4]) assert.deepEqual(scenario.sample(ordered[i].requestedTime), ordered[i]);
const early = scenario.sample(3), late = scenario.sample(20);
assert.deepEqual(late.history.slice(0, early.history.length), early.history, 'committed past rewritten');
assert(!early.planner.knownObstacles.some(o => o.id === 'work-zone'));
assert(scenario.sample(4).planner.knownObstacles.some(o => o.id === 'work-zone'));
const evaluated = scenario.sample(4.6);
assert.equal(evaluated.planner.candidates.find(c => c.kind === 'direct').status, 'rejected');
assert.match(evaluated.planner.candidates.find(c => c.kind === 'direct').rejection, /work-zone/);
const rerouted = scenario.sample(4.82);
assert(rerouted.planner.route);
assert(validateRoute(rerouted.planner.route, rerouted.planner.knownObstacles, scenario.config.clearance).valid);
assert(rerouted.planner.route.some(p => p[1] < 6.5 || p[1] > 13.5), 'route did not detour');
const phases = final.events.filter(e => e.cycle === 1).map(e => e.type);
assert.deepEqual(phases.slice(0, 4), ['observe', 'candidate-generation', 'cost-and-rejection', 'commit']);
assert.equal(new Set(evaluated.planner.candidates.map(c => c.id)).size, 4);
assert.deepEqual(evaluated.planner.candidates.map(c => c.id), rerouted.planner.candidates.map(c => c.id));
let maxStep = 0, maxSpeed = 0, maxControl = 0, saturationCount = 0;
let previous = scenario.sample(0);
for (let tick = 1; tick <= scenario.duration / scenario.config.dt; tick++) {
  const state = scenario.sample(tick * scenario.config.dt);
  const step = dist(state.pose.position, previous.pose.position);
  maxStep = Math.max(maxStep, step);
  maxSpeed = Math.max(maxSpeed, Math.hypot(...state.pose.velocity));
  maxControl = Math.max(maxControl, Math.hypot(...state.controller.applied));
  assert(step < .08, `discontinuous position at ${state.time}`);
  assert(dist(state.pose.velocity, previous.pose.velocity) < .08, `velocity jump at ${state.time}`);
  assert(Math.hypot(...state.controller.applied) <= scenario.config.maxAcceleration + 1e-10);
  assert(state.controller.integral.every(v => Math.abs(v) <= scenario.config.integralLimit + 1e-10));
  assert(state.controller.d.every((v, i) => Math.abs(v + scenario.config.kd * state.pose.velocity[i]) < 1e-10));
  if (state.controller.saturated) saturationCount++;
  assert(!state.status.collisionEver, `actual flown collision at ${state.time}`);
  for (const obstacle of state.planner.knownObstacles) assert(!segmentHits(previous.pose.position, state.pose.position, obstacle, scenario.config.bodyRadius));
  previous = state;
}
assert(final.status.reached, `goal not reached: ${JSON.stringify(final.pose)}`);
// Stress saturation separately; the default scenario need not hit actuator limits.
const stressed = createScenario({duration: 3, kp: 10, lookAhead: 8, maxAcceleration: .5});
const stress = stressed.sample(2);
assert(stress.controller.saturated);
assert(stress.controller.integral.every(v => Math.abs(v) < 1e-9), 'windup during same-direction saturation');
assert(Math.hypot(...stress.controller.applied) <= .5 + 1e-10);
// Bad initial state must report collision/no feasible route, never silently pass.
const invalid = createScenario({duration: 2, start: [11, 18]});
assert(invalid.sample(0).status.collisionEver);
assert.equal(invalid.sample(1).planner.route, null);
assert(invalid.sample(1).events.some(e => e.type === 'no-feasible-route'));
// Returned data must not mutate the cached timeline.
const mutated = scenario.sample(5); mutated.pose.position[0] = 999; mutated.history[0].position[0] = 999;
assert.notEqual(scenario.sample(5).pose.position[0], 999);
assert.notEqual(scenario.sample(5).history[0].position[0], 999);
console.log(JSON.stringify({passed: true, checks: ['unknown-options', 'causality', 'random-seek', 'immutable-past', 'obstacle-rejection', 'candidate-identities', 'phase-order', 'detour', 'swept-collision', 'bounded-control', 'anti-windup', 'derivative-on-measurement', 'endpoint', 'invalid-state-reporting', 'mutation-isolation'],
  duration: scenario.duration, ticks: Math.round(scenario.duration / scenario.config.dt), maxStep, maxSpeed, maxControl, saturationCount, finalPosition: final.pose.position, commits: final.committedHistory.length}, null, 2));
