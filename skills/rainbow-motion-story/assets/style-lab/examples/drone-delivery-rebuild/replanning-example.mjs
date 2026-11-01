/** Original teaching computation: finite 2D route search + point-mass PID.
 * No neural model, flight controller, live sensor, diffusion solver or hardware I/O.
 * Units: metres, seconds, m/s, m/s². z is a fixed illustrative altitude.
 */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const copy = x => structuredClone(x);
const length = points => points.slice(1).reduce((n, p, i) => n + distance(p, points[i]), 0);
export const defaultObservations = [
  {time: 0, id: 'initial-map', obstacles: [
    {id: 'north-building', min: [10, 15], max: [13, 21]},
    {id: 'south-building', min: [23, 1], max: [26, 7]},
  ]},
  {time: 4, id: 'new-work-zone', obstacles: [
    {id: 'work-zone', min: [14, 8], max: [18, 12]},
  ]},
];

// Exact segment/AABB slab test, including the declared clearance inflation.
export function segmentHits(a, b, obstacle, radius = 0) {
  let lo = 0, hi = 1;
  for (let d = 0; d < 2; d++) {
    const v = b[d] - a[d], min = obstacle.min[d] - radius, max = obstacle.max[d] + radius;
    if (Math.abs(v) < 1e-12) { if (a[d] < min || a[d] > max) return false; }
    else {
      let x = (min - a[d]) / v, y = (max - a[d]) / v;
      if (x > y) [x, y] = [y, x];
      lo = Math.max(lo, x); hi = Math.min(hi, y);
      if (lo > hi) return false;
    }
  }
  return true;
}
const clear = (a, b, obstacles, margin) => obstacles.every(o => !segmentHits(a, b, o, margin));
export function validateRoute(points, obstacles, margin = 1.5) {
  if (points.length < 2) return {valid: false, reason: 'no-route'};
  for (let i = 1; i < points.length; i++) {
    const hit = obstacles.find(o => segmentHits(points[i - 1], points[i], o, margin));
    if (hit) return {valid: false, reason: `clearance:${hit.id}`, segment: i - 1};
  }
  return {valid: true, reason: null};
}

function gridRoute(start, goal, obstacles, cfg) {
  const {width, height, clearance} = cfg;
  // Connect arbitrary start/end to nearby free lattice vertices; deterministic order.
  const links = point => {
    const nodes = [];
    for (let x = 0; x <= width; x++) for (let y = 0; y <= height; y++) {
      if (distance(point, [x, y]) <= 2.1 && clear(point, [x, y], obstacles, clearance)) nodes.push([x, y]);
    }
    return nodes.sort((a, b) => distance(point, a) - distance(point, b) || a[0] - b[0] || a[1] - b[1]);
  };
  const starts = links(start), ends = links(goal);
  if (!starts.length || !ends.length) return [];
  const key = p => `${p[0]},${p[1]}`;
  const endKeys = new Set(ends.map(key)), records = new Map(), open = [];
  for (const p of starts) {
    const r = {p, key: key(p), g: distance(start, p), f: distance(start, p) + distance(p, goal), previous: null};
    records.set(r.key, r); open.push(r);
  }
  const closed = new Set();
  while (open.length) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.key.localeCompare(b.key));
    const current = open.shift();
    if (closed.has(current.key) || records.get(current.key) !== current) continue;
    closed.add(current.key);
    if (endKeys.has(current.key)) {
      const points = [goal];
      for (let p = current; p; p = p.previous) points.unshift(p.p);
      points.unshift(start);
      // Visibility shortcuts remain clearance-checked, not an unconstrained spline.
      const reduced = [points[0]];
      for (let i = 0; i < points.length - 1;) {
        let j = points.length - 1;
        while (j > i + 1 && !clear(points[i], points[j], obstacles, clearance)) j--;
        reduced.push(points[j]); i = j;
      }
      return reduced;
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = [current.p[0] + dx, current.p[1] + dy];
      if (p[0] < 0 || p[0] > width || p[1] < 0 || p[1] > height || !clear(current.p, p, obstacles, clearance)) continue;
      const k = key(p), g = current.g + Math.hypot(dx, dy);
      if (closed.has(k) || (records.has(k) && records.get(k).g <= g)) continue;
      const r = {p, key: k, g, f: g + distance(p, goal), previous: current};
      records.set(k, r); open.push(r);
    }
  }
  return [];
}

function pointAt(points, s) {
  for (let i = 1; i < points.length; i++) {
    const d = distance(points[i - 1], points[i]);
    if (s <= d) return points[i - 1].map((v, axis) => v + (points[i][axis] - v) * (d ? s / d : 0));
    s -= d;
  }
  return [...points.at(-1)];
}
function nearestArc(points, position) {
  let total = 0, bestDistance = Infinity, bestArc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], d = distance(a, b);
    const u = d ? clamp(((position[0] - a[0]) * (b[0] - a[0]) + (position[1] - a[1]) * (b[1] - a[1])) / (d * d), 0, 1) : 0;
    const q = a.map((v, axis) => v + (b[axis] - v) * u), gap = distance(q, position);
    if (gap < bestDistance) { bestDistance = gap; bestArc = total + d * u; }
    total += d;
  }
  return bestArc;
}

function candidatesFor(position, goal, obstacles, cycle, cfg) {
  const via = y => {
    const waypoint = [(position[0] + goal[0]) / 2, y];
    const first = gridRoute(position, waypoint, obstacles, cfg), second = gridRoute(waypoint, goal, obstacles, cfg);
    return first.length && second.length ? [...first, ...second.slice(1)] : [];
  };
  const routes = [
    ['direct', [position, goal]],
    ['astar', gridRoute(position, goal, obstacles, cfg)],
    ['north', via(cfg.height - 3)],
    ['south', via(3)],
  ];
  return routes.map(([kind, points], i) => {
    const checked = validateRoute(points, obstacles, cfg.clearance);
    const costs = {distance: length(points), bends: Math.max(0, points.length - 2) * .35};
    return {id: `cycle-${cycle}:${kind}`, kind, points: copy(points), status: checked.valid ? 'eligible' : 'rejected',
      rejection: checked.reason, costs, totalCost: checked.valid ? costs.distance + costs.bends : null, order: i};
  });
}

export function createScenario(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Scenario options must be an object');
  const allowedOptions = new Set(['duration', 'dt', 'width', 'height', 'altitude', 'start', 'goal',
    'clearance', 'bodyRadius', 'lookAhead', 'replanEvery', 'maxAcceleration', 'kp', 'ki', 'kd',
    'integralLimit', 'drag', 'observations']);
  for (const name of Reflect.ownKeys(options)) {
    if (!allowedOptions.has(name)) throw new TypeError(`Unsupported scenario option: ${String(name)}`);
  }
  const cfg = {duration: 34, dt: .02, width: 36, height: 24, altitude: 18, start: [3, 10], goal: [32, 10],
    clearance: 1.5, bodyRadius: .35, lookAhead: 1.8, replanEvery: 6, maxAcceleration: 2.4,
    kp: 1.15, ki: .055, kd: 1.8, integralLimit: 2, drag: .12, ...options};
  if (!(cfg.dt > 0 && cfg.dt <= .05 && cfg.duration > 0 && cfg.maxAcceleration > 0)) throw new Error('Invalid integration configuration');
  const observations = copy(options.observations ?? defaultObservations).sort((a, b) => a.time - b.time);
  const known = new Map(), events = [], commits = [], timeline = [], flown = [];
  let position = [...cfg.start], velocity = [0, 0], integral = [0, 0], route = null, routeProgress = 0;
  let hold = [...position], cycle = -1, cycleStart = -Infinity, phase = 'idle', candidates = [], selectedId = null;
  let nextObservation = 0, observedAt = null, lastCommit = -Infinity, collisionEver = false;
  const beginCycle = time => {
    cycle++; cycleStart = time; phase = 'observe'; candidates = [];
    events.push({time, type: 'observe', cycle, obstacleIds: [...known.keys()]});
  };
  const steps = Math.ceil(cfg.duration / cfg.dt);
  for (let tick = 0; tick <= steps; tick++) {
    const time = tick * cfg.dt;
    let update = false;
    while (nextObservation < observations.length && observations[nextObservation].time <= time + 1e-9) {
      const observation = observations[nextObservation++];
      for (const obstacle of observation.obstacles) known.set(obstacle.id, obstacle);
      observedAt = observation.time; update = true;
      events.push({time, type: 'observation-update', observationId: observation.id, sensorTimestamp: observedAt});
    }
    const obstacles = [...known.values()];
    if (update && route) {
      const remainder = [position, pointAt(route, routeProgress), ...route.filter((_, i) => length(route.slice(0, i + 1)) > routeProgress)];
      if (!validateRoute(remainder, obstacles, cfg.clearance).valid) {
        route = null; selectedId = null; hold = [...position]; integral = [0, 0];
        events.push({time, type: 'brake', reason: 'committed-route-invalidated'});
      }
    }
    if (update || cycle < 0 || (phase === 'execute' && time - lastCommit >= cfg.replanEvery)) beginCycle(time);
    const age = time - cycleStart;
    if (phase === 'observe' && age >= .24 - 1e-9) {
      candidates = candidatesFor(position, cfg.goal, obstacles, cycle, cfg); phase = 'candidates';
      events.push({time, type: 'candidate-generation', cycle, ids: candidates.map(c => c.id)});
    }
    if (phase === 'candidates' && age >= .50 - 1e-9) {
      phase = 'evaluate'; events.push({time, type: 'cost-and-rejection', cycle});
    }
    if (phase === 'evaluate' && age >= .80 - 1e-9) {
      // Re-check the connector from the actual current pose before commitment.
      candidates = candidates.map(c => {
        const points = c.points.length ? [position, ...c.points.slice(1)] : [];
        const checked = validateRoute(points, obstacles, cfg.clearance);
        const costs = {distance: length(points), bends: Math.max(0, points.length - 2) * .35};
        return {...c, points: copy(points), status: checked.valid ? 'eligible' : 'rejected', rejection: checked.reason,
          costs, totalCost: checked.valid ? costs.distance + costs.bends : null};
      });
      const best = candidates.filter(c => c.status === 'eligible').sort((a, b) => a.totalCost - b.totalCost || a.order - b.order)[0];
      if (best) {
        route = copy(best.points); routeProgress = 0; selectedId = best.id; integral = [0, 0];
        candidates = candidates.map(c => ({...c, status: c.id === selectedId ? 'committed' : c.status}));
        commits.push({time, cycle, candidateId: selectedId, points: copy(route), observedAt});
        events.push({time, type: 'commit', cycle, candidateId: selectedId});
      } else { route = null; hold = [...position]; selectedId = null; events.push({time, type: 'no-feasible-route', cycle}); }
      phase = 'execute'; lastCommit = time;
    }
    let target = [...hold];
    if (route) { routeProgress = Math.max(routeProgress, nearestArc(route, position)); target = pointAt(route, routeProgress + cfg.lookAhead); }
    const error = target.map((v, i) => v - position[i]);
    const proposedIntegral = integral.map((v, i) => clamp(v + error[i] * cfg.dt, -cfg.integralLimit, cfg.integralLimit));
    const p = error.map(v => cfg.kp * v), d = velocity.map(v => -cfg.kd * v);
    const raw = p.map((v, i) => v + cfg.ki * proposedIntegral[i] + d[i]);
    const norm = Math.hypot(...raw), scale = Math.min(1, cfg.maxAcceleration / (norm || 1));
    const applied = raw.map(v => v * scale);
    // Conditional integration: no accumulation that would push further into saturation.
    integral = proposedIntegral.map((v, i) => scale < 1 && error[i] * (raw[i] - applied[i]) > 0 ? integral[i] : v);
    const iTerm = integral.map(v => cfg.ki * v);
    const correctedRaw = p.map((v, i) => v + iTerm[i] + d[i]);
    const correctedScale = Math.min(1, cfg.maxAcceleration / (Math.hypot(...correctedRaw) || 1));
    const control = correctedRaw.map(v => v * correctedScale);
    const acceleration = control.map((v, i) => v - cfg.drag * velocity[i]);
    const previous = [...position];
    // Current tick state first; advance only after recording, preserving history causality.
    const currentCollisions = obstacles.filter(o => segmentHits(position, position, o, cfg.bodyRadius)).map(o => o.id);
    collisionEver ||= currentCollisions.length > 0;
    const state = {time, pose: {position: [...position, cfg.altitude], velocity: [...velocity, 0], yaw: Math.atan2(velocity[1], velocity[0])},
      target: [...target, cfg.altitude], error: [...error, 0], controller: {p, i: iTerm, d, integral: [...integral], raw: correctedRaw,
        applied: control, acceleration, saturated: correctedScale < 1, derivativeOn: 'measurement'},
      planner: {cycle, phase, phaseAge: age, selectedId, candidates: copy(candidates), route: copy(route), routeProgress,
        knownObstacles: copy(obstacles), observedAt},
      status: {collision: currentCollisions, collisionEver, reached: distance(position, cfg.goal) < .35 && Math.hypot(...velocity) < .2,
        guarantee: 'finite-grid-route-and-sampled-trajectory-only', feasibility: route ? 'route-available' : 'holding-no-route'}};
    timeline.push(state);
    flown.push({time, position: [...position, cfg.altitude]});
    velocity = velocity.map((v, i) => v + acceleration[i] * cfg.dt);
    position = position.map((v, i) => v + velocity[i] * cfg.dt);
    // Swept segment check catches crossing a thin known obstacle between ticks.
    const sweptHits = obstacles.filter(o => segmentHits(previous, position, o, cfg.bodyRadius)).map(o => o.id);
    if (sweptHits.length && tick < steps) { collisionEver = true; events.push({time: time + cfg.dt, type: 'collision', obstacleIds: sweptHits}); }
  }
  const sample = t => {
    const time = clamp(Number.isFinite(t) ? t : 0, 0, cfg.duration);
    const index = Math.min(timeline.length - 1, Math.floor((time + 1e-10) / cfg.dt));
    const result = copy(timeline[index]);
    // All visible state belongs to one fixed tick. No interpolated fake controller values.
    result.requestedTime = time;
    result.history = copy(flown.slice(0, index + 1));
    result.committedHistory = copy(commits.filter(e => e.time <= result.time + 1e-9));
    result.events = copy(events.filter(e => e.time <= result.time + 1e-9));
    return result;
  };
  return Object.freeze({config: copy(cfg), duration: cfg.duration, sample,
    metadata: {kind: 'deterministic-teaching-planner', solver: 'finite 8-neighbor A* + visibility shortcuts',
      plant: 'horizontal point mass; fixed altitude; acceleration PID; linear drag', neuralInference: false,
      limitations: ['No rotor/aerodynamic/attitude model', 'No unknown-obstacle safety guarantee', 'No globally optimal continuous-space claim', 'No trained VLA or diffusion model']}});
}

export const demo = createScenario();
export const sample = t => demo.sample(t);
