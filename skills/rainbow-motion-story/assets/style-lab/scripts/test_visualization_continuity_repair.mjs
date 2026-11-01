import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { candidates } from '../lab/modules/visualization.js';
import { projector } from '../lab/modules/common.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = candidates.find(c => c.id === 'visualization-route-bridge');
const entity = candidates.find(c => c.id === 'visualization-entity-formula');
const checks = [], metrics = {};
const test = (name, check) => { check(); checks.push({ name, passed: true }); };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const finite = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const vector = s => [...s.camera.position, ...s.camera.target, s.camera.fov, s.camera.roll,
    ...s.points.flatMap(p => p.position), ...s.marker.position];

test('Absolute-time sampling is finite and independent of evaluation order', () => {
    for (const candidate of [route, entity]) {
        const times = Array.from({ length: 301 }, (_, i) => i / 30);
        const saved = times.map(t => candidate.sample(t));
        // A fixed permutation exercises descending and nonadjacent time steps.
        for (let i = 0; i < times.length; i++) {
            const index = i * 137 % times.length;
            const state = candidate.sample(times[index]);
            finite(state);
            assert.deepEqual(state, saved[index]);
        }
    }
});

test('The route keeps its sample identities and the moving marker stays on the same polyline', () => {
    const start = route.sample(0);
    for (let frame = 0; frame < 3000; frame++) {
        const state = route.sample(frame / 300);
        assert.deepEqual(state.points.map(p => p.id), start.points.map(p => p.id));
        state.points.forEach((p, i) => {
            near(p.x, start.points[i].x); near(p.y, start.points[i].y);
            near(Math.hypot(...p.position), Math.hypot(p.x, p.y));
        });
        const a = state.points[state.marker.segment].position;
        const b = state.points[state.marker.segment + 1].position;
        // This checks both line membership and that the marker lies inside the
        // segment, without duplicating routeAt's interpolation implementation.
        near(distance(a, state.marker.position) + distance(state.marker.position, b), distance(a, b));
    }
});

test('The route plane stays camera-facing and its bend remains wider than the drawn line', () => {
    let minIncidence = Infinity, minBendPixels = Infinity, minDepth = Infinity;
    let minBendTime = 0;
    for (let frame = 0; frame < 3000; frame++) {
        const state = route.sample(frame / 300), project = projector(state.camera);
        const normal = [0, -Math.sin(state.rotation), Math.cos(state.rotation)];
        const view = state.camera.position.map((v, i) => v - state.camera.target[i]);
        const incidence = normal.reduce((sum, n, i) => sum + n * view[i], 0) / Math.hypot(...view);
        const points = state.points.map(p => project(p.position));
        const a = points[0], b = points.at(-1), chord = Math.hypot(b.x - a.x, b.y - a.y);
        const bend = Math.max(...points.map(p => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / chord));
        minIncidence = Math.min(minIncidence, incidence);
        minDepth = Math.min(minDepth, ...points.map(p => p.z));
        if (bend < minBendPixels) { minBendPixels = bend; minBendTime = state.time; }
        assert.ok(incidence > 0, `The plane turns edge-on/backward at ${state.time}`);
        assert.ok(bend > 5, `The bend is hidden by the 5px route stroke at ${state.time}`);
        for (const p of points) {
            assert.ok(p.visible);
            assert.ok(p.x > 70 && p.x < 1530 && p.y > 165 && p.y < 740, `Route clipped at ${state.time}`);
        }
    }
    Object.assign(metrics, { minIncidence, minBendPixels, minBendTime, minDepth });
});

test('Camera, route and marker enter and leave each movement continuously', () => {
    const boundaries = [2.2, 4.137967115075151, 5.2, 5.6, 8.5];
    let maxVelocityMismatch = 0;
    for (const t of boundaries) {
        const step = 1e-4, a = vector(route.sample(t - step));
        const b = vector(route.sample(t)), c = vector(route.sample(t + step));
        b.forEach((v, i) => {
            const mismatch = Math.abs((v - a[i]) / step - (c[i] - v) / step);
            maxVelocityMismatch = Math.max(maxVelocityMismatch, mismatch);
            assert.ok(mismatch < .01, `Velocity discontinuity at ${t}, component ${i}`);
        });
    }
    const camera = route.sample(5.2).camera;
    for (const t of [5.4, 5.6, 6.8, 8.5, 9.4]) {
        const next = route.sample(t).camera;
        next.position.forEach((v, i) => near(v, camera.position[i]));
        next.target.forEach((v, i) => near(v, camera.target[i]));
        near(next.fov, camera.fov); near(next.roll, camera.roll);
    }
    near(route.sample(8.5).travel, route.sample(9.4).travel);
    metrics.maxVelocityMismatch = maxVelocityMismatch;
});

test('Velocity arrows use the measured velocity and shrink before changing direction', () => {
    let maxHeadToShaftRatio = 0;
    for (let frame = 0; frame < 3000; frame++) {
        const state = entity.sample(frame / 300), arrow = state.velocityArrow;
        const shaft = arrow.end[0] - arrow.start[0], length = Math.abs(shaft);
        near(shaft, state.v * 95);
        near(arrow.start[0], 800 + state.x * 200);
        near(arrow.start[1], arrow.end[1]);
        near(distance(arrow.head[1], arrow.end), 0);
        assert.ok(arrow.headAlpha >= 0 && arrow.headAlpha <= 1);
        for (const tip of [arrow.head[0], arrow.head[2]]) {
            const headLength = distance(tip, arrow.end);
            assert.ok(headLength <= length / 2 + 1e-9, 'Arrowhead extends beyond a short shaft');
            if (length > 1e-7) {
                assert.ok((arrow.end[0] - tip[0]) * shaft > 0, 'Head points against the measured velocity');
                maxHeadToShaftRatio = Math.max(maxHeadToShaftRatio, headLength / length);
            }
        }
    }
    const crossings = [];
    for (const t of [5, 7.5]) {
        const center = entity.sample(t).velocityArrow;
        near(center.headAlpha, 0);
        center.head.forEach(p => near(distance(p, center.end), 0));
        const spans = [1e-3, 1e-4, 1e-5].map(step => {
            const before = entity.sample(t - step), after = entity.sample(t + step);
            assert.ok(before.v * after.v < 0);
            return Math.max(...before.velocityArrow.head.map((p, i) => distance(p, after.velocityArrow.head[i])));
        });
        assert.ok(spans[1] < spans[0] * .11 && spans[2] < spans[1] * .11, 'Head flips instead of converging through zero');
        crossings.push({ t, headAlphaAtZero: center.headAlpha, headSpansAtShrinkingTimeSteps: spans });
    }
    Object.assign(metrics, { maxHeadToShaftRatio, crossings });
});

const source = path.join(root, 'lab/modules/visualization.js');
const report = {
    passed: true,
    scope: 'State and geometry checks only; no new rendered-frame review or subjective playback claimed.',
    source: 'lab/modules/visualization.js',
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    checks, metrics,
    visualReviewTimes: {
        route: [3.9, 4.1, 4.133333333333333, 4.166666666666667, 4.3, 5.2, 5.6, 8.5],
        entity: [4.9, 4.966666666666667, 5, 5.033333333333333, 5.1, 7.466666666666667, 7.5, 7.533333333333333]
    }
};
const output = path.join(root, 'qa/visualization-continuity-repair.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
