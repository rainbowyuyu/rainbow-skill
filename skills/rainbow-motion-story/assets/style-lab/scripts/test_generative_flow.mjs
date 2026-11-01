import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { candidates, directedFlow, observationFan, flowPoint } from '../lab/modules/generative-flow.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [], metrics = {};
const test = (name, run) => { run(); checks.push({ name, passed: true }); };
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const norm = values => Math.hypot(...values);
const distance = (a, b) => norm(a.map((v, i) => v - b[i]));
const finite = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};

test('Both finite shots clamp endpoints and seek deterministically in all three palettes', () => {
    for (const candidate of candidates) {
        assert.equal(candidate.loop, false);
        for (const palette of ['titanium', 'ember', 'porcelain']) {
            const options = { palette, intensity: .75 };
            assert.deepEqual(candidate.sample(-1, options), candidate.sample(0, options));
            assert.deepEqual(candidate.sample(20, options), candidate.sample(12, options));
            const times = Array.from({ length: 361 }, (_, i) => i / 30);
            const states = times.map(t => candidate.sample(t, options));
            for (let i = 0; i < times.length; i++) {
                const index = i * 137 % times.length;
                const state = candidate.sample(times[index], options);
                finite(state); assert.deepEqual(state, states[index]);
            }
        }
    }
});

test('Point identities survive cloud, field and travel; distribution and direction have actual holds', () => {
    const baseline = directedFlow.sample(0), identity = baseline.points.map(p => [p.id, p.seed]);
    for (let f = 0; f <= 720; f++) {
        const state = directedFlow.sample(f / 60);
        assert.deepEqual(state.points.map(p => [p.id, p.seed]), identity);
        assert.equal(new Set(state.points.map(p => p.id)).size, state.points.length);
        for (const p of state.points) {
            assert.ok(p.position[0] > 180 && p.position[0] < 1420 && p.position[1] > 230 && p.position[1] < 670);
        }
        assert.ok(state.focus.label.position[0] - 118 > 76 && state.focus.label.position[0] + 118 < 1524);
        assert.ok(state.focus.label.position[1] - 24 > 225);
        if (state.travel > 0) near(state.fieldAlpha, 1);
    }
    assert.deepEqual(directedFlow.sample(.8).points, directedFlow.sample(1.3).points);
    assert.deepEqual(directedFlow.sample(5).points, directedFlow.sample(5.4).points);
    assert.deepEqual(directedFlow.sample(9.4).points, directedFlow.sample(12).points);
    metrics.particleCount = baseline.points.length;
    metrics.directionArrowCount = baseline.arrows.length;
});

test('Actual finite-difference particle motion aligns with the displayed local field', () => {
    let maxVelocityError = 0, minDirectionalCosine = 1;
    for (const t of [5.7, 6.4, 7.2, 8.1, 9.1]) {
        const dt = 1e-5, a = directedFlow.sample(t - dt), b = directedFlow.sample(t + dt), state = directedFlow.sample(t);
        for (let i = 0; i < state.points.length; i++) {
            const point = state.points[i];
            const velocity = a.points[i].position.map((x, j) => (b.points[i].position[j] - x) / (2 * dt));
            const error = distance(velocity, point.velocity);
            maxVelocityError = Math.max(maxVelocityError, error);
            assert.ok(error < 1e-5);
            const cosine = velocity.reduce((sum, v, j) => sum + v * point.direction[j], 0) / norm(velocity);
            minDirectionalCosine = Math.min(minDirectionalCosine, cosine);
            assert.ok(cosine > .99999999);
            assert.ok(distance(point.position, flowPoint(point.u, point.lane)) < 1e-8);
        }
    }
    for (const arrow of directedFlow.sample(7).arrows) {
        const a = flowPoint(arrow.u - 1e-5, arrow.lane), b = flowPoint(arrow.u + 1e-5, arrow.lane);
        const tangent = b.map((v, i) => v - a[i]);
        near(norm(arrow.direction), 1);
        assert.ok(tangent.reduce((sum, v, i) => sum + v * arrow.direction[i], 0) > 0);
    }
    Object.assign(metrics, { maxVelocityError, minDirectionalCosine });
});

test('Particle handoffs are position/velocity continuous and stop after execution', () => {
    let maxVelocityMismatch = 0;
    for (const t of [1.4, 4, 5.5, 9.4]) {
        const dt = 1e-4, a = directedFlow.sample(t - dt), s = directedFlow.sample(t), b = directedFlow.sample(t + dt);
        s.points.forEach((p, i) => p.position.forEach((v, j) => {
            const mismatch = Math.abs((v - a.points[i].position[j]) / dt - (b.points[i].position[j] - v) / dt);
            maxVelocityMismatch = Math.max(maxVelocityMismatch, mismatch);
            assert.ok(mismatch < .001);
        }));
    }
    directedFlow.sample(12).points.forEach(p => near(norm(p.velocity), 0));
    metrics.maxHandoffVelocityMismatch = maxVelocityMismatch;
});

test('Upper-layer wipe cannot touch the persistent curve, axis or observation', () => {
    const base = observationFan.sample(0).base;
    const minBaseY = Math.min(...base.curve.map(p => p[1]), ...base.axis.map(p => p[1]), base.observation.position[1]);
    let previousWipe = 0;
    for (let f = 0; f <= 720; f++) {
        const s = observationFan.sample(f / 60), b = s.upper.bounds;
        assert.deepEqual(s.base, base);
        assert.ok(b.y + b.height < minBaseY);
        assert.ok(s.upper.wipeX >= b.x && s.upper.wipeX <= b.x + b.width);
        assert.ok(s.upper.wipe >= previousWipe);
        previousWipe = s.upper.wipe;
        if (s.cards.some(c => c.alpha > 0)) near(s.upper.wipe, 1);
    }
    metrics.wipeClearancePixels = minBaseY - (observationFan.sample(4).upper.bounds.y + observationFan.sample(4).upper.bounds.height);
});

test('Original source cards enter in order and all branches lead to one stable observation', () => {
    let lastAlphas = [0, 0, 0];
    for (let f = 0; f <= 720; f++) {
        const state = observationFan.sample(f / 60), cards = state.cards;
        cards.forEach((card, i) => {
            assert.ok(card.alpha >= lastAlphas[i]);
            assert.equal(card.observationId, state.base.observation.id);
            assert.ok(card.center[0] - card.size[0] / 2 > 76 && card.center[0] + card.size[0] / 2 < 1524);
            if (i) {
                assert.ok(card.alpha <= cards[i - 1].alpha);
                assert.ok(cards[i - 1].center[0] + cards[i - 1].size[0] / 2 < card.center[0] - card.size[0] / 2);
            }
            if (card.connectorProgress === 1) near(distance(card.connector.at(-1), state.base.observation.position), 0);
            if (card.connectorProgress > 0) assert.ok(card.alpha > .75);
        });
        lastAlphas = cards.map(c => c.alpha);
    }
    const final = observationFan.sample(9.2);
    final.cards.forEach(card => { near(card.alpha, 1); near(card.connectorProgress, 1); });
    assert.deepEqual(final.cards, observationFan.sample(12).cards);
    assert.equal(new Set(final.cards.map(c => c.kind)).size, 3);
    metrics.sourceCardCount = final.cards.length;
});

const sourcePath = path.join(root, 'lab/modules/generative-flow.js');
const report = {
    passed: true, checks, metrics,
    source: 'lab/modules/generative-flow.js',
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    referenceReview: { source: 'studies/ai-draw.md', imagesActuallyViewed: ['evidence/ai-draw/detail-0.jpg', 'evidence/ai-draw/detail-2.jpg'],
        mode: 'Static contact-sheet review; no new normal-speed playback or subjective audio listening.' },
    scope: 'Deterministic state, geometry, identity, temporal handoffs and layer bounds. Rendered visual QA is separate.',
    visualReviewTimes: { 'visualization-directed-flow': [1, 3, 4.8, 5.4, 7.4, 9.8], 'visualization-observation-fan': [1.5, 4.2, 5.4, 6.4, 7.2, 8, 9.4] }
};
const output = path.join(root, 'qa/generative-flow.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
