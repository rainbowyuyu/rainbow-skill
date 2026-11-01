/**
 * Original ideal normally-open mechanical switch. Millimetres and newtons;
 * +Y is up and pressing moves the stem along -Y. Not a branded switch/CAD/FEM.
 * The prescribed press trajectory, ideal spring/contact laws, and illustrative
 * leaf geometry are separate assumptions. There is no bounce, hysteresis,
 * snap action, friction, inertia, electrical load or dynamic spring solver.
 * An exploded view changes display positions only, never physical state.
 */
export const SWITCH_DURATION = 12;
export const SWITCH_STAGES = Object.freeze([
  Object.freeze({ id: 'idle', start: 0, end: 1 }),
  Object.freeze({ id: 'press', start: 1, end: 4 }),
  Object.freeze({ id: 'hold', start: 4, end: 6 }),
  Object.freeze({ id: 'release', start: 6, end: 9 }),
  Object.freeze({ id: 'released', start: 9, end: 12 }),
]);
export const SWITCH_PART_IDS = Object.freeze([
  'base', 'housing', 'stem', 'keycap', 'spring', 'moving-contact', 'fixed-contact',
]);
export const SWITCH_DEFAULTS = Object.freeze({
  travelMm: 4,
  actuationTravelMm: 2,
  springFreeLengthMm: 12,
  springInstalledLengthMm: 10,
  springSolidLengthMm: 4,
  springRadiusMm: 1.4, // free-state centreline radius
  springTurns: 8,
  springWireDiameterMm: 0.4,
  springStiffnessNPerMm: 0.08,
  contactRestGapMm: 0.6,
  contactStiffnessNPerMm: 1.2, // ideal local compliance AFTER first contact
});

const TAU = 2 * Math.PI;
const point = (x, y, z = 0) => ({ x, y, z });
const add = (a, b) => point(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a, amount) => point(a.x * amount, a.y * amount, a.z * amount);
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const smooth = u => u * u * u * (10 + u * (-15 + 6 * u));
const smoothDerivative = u => 30 * u * u * (1 - u) * (1 - u);

/** All values are teaching parameters, not measurements of a particular switch. */
export function resolveSwitchParameters(options = {}) {
  const p = {};
  for (const [key, fallback] of Object.entries(SWITCH_DEFAULTS)) p[key] = finite(options[key] ?? fallback, key);
  if (p.travelMm <= 0 || p.actuationTravelMm <= 0 || p.actuationTravelMm >= p.travelMm) {
    throw new RangeError('Require 0 < actuationTravelMm < travelMm');
  }
  if (p.springFreeLengthMm < p.springInstalledLengthMm || p.springSolidLengthMm <= 0 ||
      p.springInstalledLengthMm - p.travelMm <= p.springSolidLengthMm) {
    throw new RangeError('Spring must fit with preload >= 0 and remain above solid length throughout travel');
  }
  if (!Number.isInteger(p.springTurns) || p.springTurns < 2 || p.springTurns > 64 ||
      p.springRadiusMm <= 0 || p.springWireDiameterMm <= 0 || p.springWireDiameterMm >= p.springRadiusMm ||
      p.springSolidLengthMm < p.springTurns * p.springWireDiameterMm) {
    throw new RangeError('Require 2..64 turns, positive radius/wire size and solid length >= turns * wire diameter');
  }
  if (p.springStiffnessNPerMm <= 0 || p.contactRestGapMm <= 0 || p.contactStiffnessNPerMm < 0) {
    throw new RangeError('Require positive spring stiffness/contact gap and nonnegative contact stiffness');
  }
  return p;
}

/** Finite, non-looping demonstration, sampled by absolute time. */
export function sampleSwitchCycle(time) {
  const t = clamp(finite(time, 'time'), 0, SWITCH_DURATION);
  let press = 0, pressVelocityPerS = 0;
  const phase = SWITCH_STAGES.find(stage => t < stage.end) ?? SWITCH_STAGES.at(-1);
  if (t >= 1 && t < 4) {
    const u = (t - 1) / 3;
    press = smooth(u); pressVelocityPerS = smoothDerivative(u) / 3;
  } else if (t >= 4 && t < 6) press = 1;
  else if (t >= 6 && t < 9) {
    const u = (t - 6) / 3;
    press = 1 - smooth(u); pressVelocityPerS = -smoothDerivative(u) / 3;
  }
  return { time: t, press, pressVelocityPerS, phase: phase.id, prescribedMotion: true };
}

function physicalState(press, p) {
  const travelMm = press * p.travelMm;
  const springLengthMm = p.springInstalledLengthMm - travelMm;
  const compressionMm = p.springFreeLengthMm - springLengthMm;
  const springN = p.springStiffnessNPerMm * compressionMm;
  const contactGain = p.contactRestGapMm / p.actuationTravelMm;
  const gapMm = Math.max(0, p.contactRestGapMm - contactGain * travelMm);
  const overtravelMm = Math.max(0, travelMm - p.actuationTravelMm);
  const contactDeflectionMm = contactGain * overtravelMm;
  const contactN = p.contactStiffnessNPerMm * contactDeflectionMm;
  // Virtual work: F_stem dx = F_contact d(contactDeflection), gain = dδ/dx.
  const contactReflectedN = contactN * contactGain;
  return { press, travelMm, springLengthMm, compressionMm, springN, contactGain, gapMm,
    overtravelMm, contactDeflectionMm, contactN, contactReflectedN,
    closed: travelMm >= p.actuationTravelMm };
}

function bezierPoints(a, b, c, d, segments = 20) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const u = i / segments, v = 1 - u;
    return point(...['x', 'y', 'z'].map(k => v ** 3 * a[k] + 3 * v ** 2 * u * b[k] + 3 * v * u ** 2 * c[k] + u ** 3 * d[k]));
  });
}

function springGeometry(q, p, bottomY) {
  // Keep ideal helical wire centreline length constant as the spring shortens.
  // Closed/ground ends and wire stress are not modeled.
  const wireCenterlineLengthMm = Math.hypot(TAU * p.springTurns * p.springRadiusMm, p.springFreeLengthMm);
  const radiusMm = Math.sqrt(wireCenterlineLengthMm ** 2 - q.springLengthMm ** 2) / (TAU * p.springTurns);
  const segments = p.springTurns * 24;
  const points = Array.from({ length: segments + 1 }, (_, i) => {
    const u = i / segments, angle = TAU * p.springTurns * u;
    return point(radiusMm * Math.cos(angle), bottomY + q.springLengthMm * u, radiusMm * Math.sin(angle));
  });
  return {
    bottom: point(0, bottomY), top: point(0, bottomY + q.springLengthMm), points,
    freeLengthMm: p.springFreeLengthMm, installedLengthMm: p.springInstalledLengthMm,
    solidLengthMm: p.springSolidLengthMm, lengthMm: q.springLengthMm,
    compressionMm: q.compressionMm, preloadCompressionMm: p.springFreeLengthMm - p.springInstalledLengthMm,
    forceN: q.springN, stiffnessNPerMm: p.springStiffnessNPerMm,
    turns: p.springTurns, radiusMm, wireDiameterMm: p.springWireDiameterMm,
    wireCenterlineLengthMm, pitchMm: q.springLengthMm / p.springTurns,
  };
}

/**
 * options.press (0..1) overrides the prescribed cycle; manual velocity is null.
 * options.explode (0..1) affects ONLY parts[].displayOffset/position.
 * spring/contact geometry stays in operating space: apply its part displayOffset
 * once in the renderer. Changing assembly presentation never toggles the circuit.
 */
export function sampleSwitchMechanism(time, options = {}) {
  const cycle = sampleSwitchCycle(time);
  const parameters = resolveSwitchParameters(options.parameters);
  const manual = options.press !== undefined && options.press !== null;
  const press = manual ? clamp(finite(options.press, 'press'), 0, 1) : cycle.press;
  const explode = clamp(finite(options.explode ?? 0, 'explode'), 0, 1);
  const p = parameters, q = physicalState(press, p);
  const springBottomY = 1.2;
  const springRestTopY = springBottomY + p.springInstalledLengthMm;
  const stemHeight = 3.6, keycapHeight = 2.4;
  const stemRestCenter = point(0, springRestTopY + stemHeight / 2);
  const keycapRestCenter = point(0, springRestTopY + stemHeight + keycapHeight / 2);
  const stemCenter = add(stemRestCenter, point(0, -q.travelMm));
  const keycapCenter = add(keycapRestCenter, point(0, -q.travelMm));
  const spring = springGeometry(q, p, springBottomY);
  const padRadiusMm = 0.3;
  // Tips are the facing SURFACES, not the pad centres. Gap is surface separation.
  const fixedTip = point(3.1, 4.2), movingTip = point(3.1 + q.gapMm, 4.2);
  const fixedPadCenter = add(fixedTip, point(-padRadiusMm, 0));
  const movingPadCenter = add(movingTip, point(padRadiusMm, 0));
  const movingRestPadCenter = point(3.1 + p.contactRestGapMm + padRadiusMm, 4.2);
  const fixedRoot = point(2.8, 0.8), movingRoot = point(4.7, 0.8);
  const leaf = (root, tip) => bezierPoints(root, add(root, point(0, 1.3)), add(tip, point(0, -0.8)), tip);
  const driveY = 2.6;
  const driveAnchor = point(movingPadCenter.x + .5, driveY);
  const restDriveAnchor = point(movingRestPadCenter.x + .5, driveY);
  const movingLeafPoints = [
    ...bezierPoints(movingRoot, add(movingRoot, point(0, .7)), add(driveAnchor, point(0, -.4)), driveAnchor, 12),
    ...bezierPoints(driveAnchor, add(driveAnchor, point(0, .5)), add(movingPadCenter, point(0, -.5)), movingPadCenter, 12).slice(1),
  ];
  const followerWidth = .2;
  const complianceFreeLengthMm = Math.max(.9, q.contactGain * (p.travelMm - p.actuationTravelMm) + .3);
  const camRestContactX = restDriveAnchor.x + complianceFreeLengthMm + followerWidth;
  const camContactPoint = point(camRestContactX - q.contactGain * q.travelMm, driveY);
  const followerLeft = add(camContactPoint, point(-followerWidth, 0));
  const followerTop = add(camContactPoint, point(-q.contactGain * .16, .16));
  const followerBottom = add(camContactPoint, point(q.contactGain * .16, -.16));
  const rampAtRestY = y => point(camRestContactX - q.contactGain * (y - driveY), y - q.travelMm);
  const rampBottom = rampAtRestY(driveY - .5), rampTop = rampAtRestY(driveY + p.travelMm + .5);
  const stemAttachment = point(1.4, stemCenter.y);
  const actuator = {
    model: 'ideal-frictionless-cam-with-series-compliance', displacementGain: q.contactGain,
    camPartId: 'stem', followerPartId: 'moving-contact',
    camContactPoint, driveAnchor, followerCenter: add(camContactPoint, point(-followerWidth / 2, 0)),
    followerSize: point(followerWidth, .32, .8),
    // Match the shoe's slanted face to the cam; a vertical box face would overlap it.
    followerProfile: [followerBottom, followerTop, add(followerTop, point(-followerWidth, 0)), add(followerBottom, point(-followerWidth, 0))],
    camProfile: [rampBottom, rampTop, add(rampTop, point(.22, 0)), add(rampBottom, point(.22, 0))],
    camDepthMm: .8,
    supportPoints: [stemAttachment, point(rampTop.x + .11, stemCenter.y), add(rampTop, point(.11, 0))],
    compliance: {
      from: { ...driveAnchor }, to: followerLeft, freeLengthMm: complianceFreeLengthMm,
      lengthMm: followerLeft.x - driveAnchor.x, compressionMm: q.contactDeflectionMm,
      forceN: q.contactN, stiffnessNPerMm: p.contactStiffnessNPerMm,
    },
  };
  const contact = {
    model: 'ideal-unilateral-compliant-contact', actuationTravelMm: p.actuationTravelMm,
    actuationPress: p.actuationTravelMm / p.travelMm, closed: q.closed,
    gapMm: q.gapMm, restGapMm: p.contactRestGapMm, displacementGain: q.contactGain,
    overtravelMm: q.overtravelMm, elasticDeflectionMm: q.contactDeflectionMm,
    forceN: q.contactN, stiffnessNPerMm: p.contactStiffnessNPerMm,
    fixedTip, movingTip, fixedSurface: { ...fixedTip }, movingSurface: { ...movingTip },
    padRadiusMm, fixedPadCenter, movingPadCenter, fixedRoot, movingRoot,
    fixedLeafPoints: leaf(fixedRoot, fixedPadCenter), movingLeafPoints, driveAnchor,
    leafThicknessMm: 0.12,
    circuit: q.closed ? 'closed' : 'open', hasHysteresis: false, hasBounce: false,
  };
  const geometry = {
    units: 'mm', pressAxis: point(0, -1),
    base: { center: point(0, -0.6), size: point(12, 1.2, 10) },
    // Housing is an envelope for an original hollow renderer, not a solid block.
    housing: { center: point(0, 6.8), size: point(12, 13.6, 10), envelopeOnly: true },
    stem: { center: stemCenter, size: point(2.8, stemHeight, 2.8) },
    keycap: { center: keycapCenter, size: point(15, keycapHeight, 14) },
  };
  const parts = [
    ['base', '底座', geometry.base.center, geometry.base.center, point(0, 0)],
    ['housing', '外壳', geometry.housing.center, geometry.housing.center, point(-8, 3)],
    ['stem', '轴心', stemRestCenter, stemCenter, point(0, 8)],
    ['keycap', '键帽', keycapRestCenter, keycapCenter, point(0, 14)],
    ['spring', '回位弹簧', point(0, springBottomY + p.springInstalledLengthMm / 2), point(0, springBottomY + spring.lengthMm / 2), point(0, 3)],
    ['moving-contact', '动触片', movingRestPadCenter, movingPadCenter, point(7, 2)],
    ['fixed-contact', '定触片', fixedPadCenter, fixedPadCenter, point(7, 2)],
  ].map(([id, label, restPosition, operatingPosition, explodeVector]) => {
    const displayOffset = scale(explodeVector, explode);
    return { id, label, restPosition: { ...restPosition }, operatingPosition: { ...operatingPosition },
      displayOffset, position: add(operatingPosition, displayOffset) };
  });
  return {
    time: cycle.time, phase: manual ? 'manual' : cycle.phase,
    motionSource: manual ? 'manual-displacement' : 'prescribed-cycle', press, travelMm: q.travelMm,
    velocityMmPerS: manual ? null : cycle.pressVelocityPerS * p.travelMm,
    parameters, spring, contact, actuator, geometry, parts,
    force: { model: 'ideal-quasi-static-elastic', springN: q.springN,
      contactReflectedN: q.contactReflectedN, totalN: q.springN + q.contactReflectedN,
      includesFriction: false, includesInertia: false },
    elasticEnergyNmm: 0.5 * p.springStiffnessNPerMm * q.compressionMm ** 2 +
      0.5 * p.contactStiffnessNPerMm * q.contactDeflectionMm ** 2,
    presentation: { explode, physicalDisassembly: false },
    model: 'original-ideal-linear-spring-switch',
  };
}

/** Quasi-static resistance versus travel. No dynamic/tactile/hysteresis claim. */
export function sampleSwitchForceCurve(samples = 101, parameterOptions = {}) {
  if (!Number.isInteger(samples) || samples < 2 || samples > 10001) throw new RangeError('samples must be an integer from 2 to 10001');
  const p = resolveSwitchParameters(parameterOptions);
  return Array.from({ length: samples }, (_, i) => {
    const q = physicalState(i / (samples - 1), p);
    return { press: q.press, travelMm: q.travelMm, springN: q.springN,
      contactReflectedN: q.contactReflectedN, forceN: q.springN + q.contactReflectedN, closed: q.closed };
  });
}
