import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sessionUrl = new URL('../lab/modules/rotary-session.js', import.meta.url);
const uiUrl = new URL('../lab/rotary-interaction-studio.js', import.meta.url);
const [sessionSource, uiSource] = await Promise.all([readFile(sessionUrl, 'utf8'), readFile(uiUrl, 'utf8')]);
const {DEFAULT_MOTOR, motorAt, setMotorSpeed, resumeSpeedAt} = await import(
  'data:text/javascript;base64,' + Buffer.from(sessionSource).toString('base64')
);
const checks = [];
const close = (actual, expected, label) => assert.ok(
  Math.abs(actual - expected) < 1e-10,
  `${label}: expected ${expected}, received ${actual}`
);
const fresh = () => DEFAULT_MOTOR.map(event => ({...event}));
const verify = (events, time, expectedAngle, expectedRpm, label) => {
  const result = motorAt(events, time);
  close(result.angle, expectedAngle, label + ' angle');
  assert.equal(result.rpm, expectedRpm, label + ' rpm');
};
const test = (id, purpose, run) => {
  try { run(); checks.push({id, purpose, status: 'passed'}); }
  catch (error) { checks.push({id, purpose, status: 'failed', error: String(error.stack || error)}); }
};

// Expectations are hand-calculated in radians: 10 rpm = pi/3 rad/s;
// 20 rpm = 2pi/3 rad/s; 15 rpm = pi/2 rad/s.
const changed = setMotorSpeed(fresh(), 5, 20);
const frozen = setMotorSpeed(changed, 8, 0);
const resumed = setMotorSpeed(frozen, 12, 20);

test('change_speed_preserves_phase', 'At 5 seconds, changing 10 to 20 rpm preserves the current shaft angle and changes only subsequent angular growth.', () => {
  verify(fresh(), 5, 5 * Math.PI / 3, 10, 'before edit');
  verify(changed, 5, 5 * Math.PI / 3, 20, 'at edit');
  verify(changed, 4, 4 * Math.PI / 3, 10, 'history before edit');
  verify(changed, 8, 11 * Math.PI / 3, 20, 'after edit');
});

test('freeze_holds_angle', 'Freezing at 8 seconds holds the phase at 11pi/3 through all later sampled times until a new speed event.', () => {
  for (const time of [8, 8.25, 10, 12, 18, 30]) {
    verify(frozen, time, 11 * Math.PI / 3, 0, `frozen at ${time}s`);
  }
});

test('resume_keeps_accumulated_phase', 'Resuming at 12 seconds retains the frozen angle and adds six seconds of 20 rpm motion by 18 seconds.', () => {
  verify(resumed, 10, 11 * Math.PI / 3, 0, 'past frozen time');
  verify(resumed, 12, 11 * Math.PI / 3, 20, 'resume boundary');
  verify(resumed, 13.5, 14 * Math.PI / 3, 20, 'resumed motion');
  verify(resumed, 18, 23 * Math.PI / 3, 20, 'end');
});

test('replay_is_order_independent', 'Revisiting old times after later times produces the same physical phase, including frozen and resumed boundaries.', () => {
  const expected = new Map([
    [0, [0, 10]], [4, [4 * Math.PI / 3, 10]],
    [5, [5 * Math.PI / 3, 20]], [8, [11 * Math.PI / 3, 0]],
    [10, [11 * Math.PI / 3, 0]], [12, [11 * Math.PI / 3, 20]],
    [18, [23 * Math.PI / 3, 20]]
  ]);
  const saved = JSON.stringify(resumed);
  for (const time of [18, 4, 12, 0, 8, 5, 10, 18, 8, 0]) {
    verify(resumed, time, ...expected.get(time), `replay ${time}s`);
  }
  assert.equal(JSON.stringify(resumed), saved, 'Sampling must not mutate the plan');
});

test('earlier_edit_replaces_future_plan', 'Editing at 4 seconds replaces the later speed, freeze and resume plan while preserving the angle and history before 4 seconds.', () => {
  const savedOriginal = JSON.stringify(resumed);
  const revised = setMotorSpeed(resumed, 4, 15);
  verify(revised, 3, Math.PI, 10, 'unchanged past');
  verify(revised, 4, 4 * Math.PI / 3, 15, 'new edit');
  verify(revised, 5, 11 * Math.PI / 6, 15, 'old speed point');
  verify(revised, 8, 10 * Math.PI / 3, 15, 'old freeze point');
  verify(revised, 12, 16 * Math.PI / 3, 15, 'old resume point');
  verify(revised, 18, 25 * Math.PI / 3, 15, 'revised end');
  assert.equal(JSON.stringify(resumed), savedOriginal, 'Editing must leave prior exported/saved plans intact');
});

test('same_time_edit_replaces_existing_choice', 'Replacing the speed at an existing event time keeps that boundary phase and removes the abandoned future plan.', () => {
  const replacement = setMotorSpeed(resumed, 5, 15);
  verify(replacement, 5, 5 * Math.PI / 3, 15, 'replacement boundary');
  verify(replacement, 8, 19 * Math.PI / 6, 15, 'abandoned freeze');
  verify(replacement, 12, 31 * Math.PI / 6, 15, 'abandoned resume');
});

test('historical_resume_ignores_future_speed', 'After 10 rpm -> freeze at 5 seconds -> 20 rpm at 12 seconds, seeking to 8 seconds and resuming uses the historical 10 rpm, not the future 20 rpm.', () => {
  const earlyFreeze = setMotorSpeed(fresh(), 5, 0);
  const futureChange = setMotorSpeed(earlyFreeze, 12, 20);
  assert.equal(resumeSpeedAt(futureChange, 8), 10, 'Earlier frozen segment recovery speed');
  assert.equal(resumeSpeedAt(futureChange, 15), 20, 'Later segment recovery speed');
  const historicalResume = setMotorSpeed(futureChange, 8, resumeSpeedAt(futureChange, 8));
  verify(historicalResume, 8, 5 * Math.PI / 3, 10, 'historical resume boundary');
  verify(historicalResume, 12, 3 * Math.PI, 10, 'replaced future change');
  verify(historicalResume, 18, 5 * Math.PI, 10, 'historical resume end');
});

test('serialized_plan_replays_same_motion', 'A JSON round trip preserves the motor plan needed by export consumers, including a frozen interval and phase accumulated before it.', () => {
  const decoded = JSON.parse(JSON.stringify(resumed));
  verify(decoded, 5, 5 * Math.PI / 3, 20, 'decoded speed boundary');
  verify(decoded, 11, 11 * Math.PI / 3, 0, 'decoded freeze');
  verify(decoded, 18, 23 * Math.PI / 3, 20, 'decoded final state');
});

const hash = value => createHash('sha256').update(value).digest('hex');
const report = {
  id: 'rotary-session',
  generatedAt: new Date().toISOString(),
  command: 'node scripts/test_rotary_session.mjs',
  scope: 'Motor-session semantics with independent hand-calculated expectations; read-only studio source review. No browser execution or renderer validation.',
  runtime: process.version,
  sources: {
    session: {path: 'lab/modules/rotary-session.js', sha256: hash(sessionSource)},
    studio: {path: 'lab/rotary-interaction-studio.js', sha256: hash(uiSource)}
  },
  status: checks.every(check => check.status === 'passed') ? 'passed' : 'failed',
  passed: checks.filter(check => check.status === 'passed').length,
  failed: checks.filter(check => check.status === 'failed').length,
  checks,
  uiReadOnlyReview: {
    mode: 'manualStaticReview',
    reviewedStudioSha256: '81ec8173425f3161bb32bb4acda8d4b0fdc8c252eee1f3f3a40d8af49b8622fd',
    reviewStillMatchesLoadedSource: hash(uiSource) === '81ec8173425f3161bb32bb4acda8d4b0fdc8c252eee1f3f3a40d8af49b8622fd',
    activeFindings: [],
    resolvedFinding: {
      severity: 'P2',
      title: 'Historical frozen segment could resume at a future speed',
      originalReproduction: 'Set 20 rpm at 5 seconds, seek to 3 seconds while the historical speed is 10 rpm, freeze, then resume: a global lastNonzero value could incorrectly recover 20 rpm.',
      resolutionObserved: 'The current UI removes lastNonzero, pauses before reading the action time and calls resumeSpeedAt(events, time); the new historical-resume test checks that later events cannot contaminate recovery speed.',
      fixedBy: 'parent agent; this test task did not modify UI or session code'
    },
    observations: [
      'Candidate selection preserves the existing motor events and current time, and refreshes sample/draw through the new selected candidate; no session reset is present in the switch handler.',
      'Displayed phase and drawing options both obtain shaftAngle from motorAt(events, the same sampled time).',
      'Export samples selected.sample(t, opts(t)) and includes the same event plan, selected candidate ID, and manual/view options; 541 state points include the 18-second endpoint while renderFrameRange explicitly excludes that endpoint.',
      'PNG export pauses and repaints before capturing the canvas; no obvious stale-candidate or stale-time mismatch is visible in the reviewed handler.'
    ],
    limitations: [
      'Studio review is static, not an end-to-end UI test.',
      'Candidate sample/draw implementations were outside this task and were not independently checked.',
      'Rendering, pointer controls, downloaded Blob contents and visual phase continuity require the parent task browser validation.'
    ]
  }
};
const reportUrl = new URL('../qa/rotary-session.json', import.meta.url);
await mkdir(new URL('../qa/', import.meta.url), {recursive: true});
await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({status: report.status, passed: report.passed, failed: report.failed, uiReviewCurrent: report.uiReadOnlyReview.reviewStillMatchesLoadedSource, report: reportUrl.pathname}));
if (report.failed) process.exitCode = 1;
