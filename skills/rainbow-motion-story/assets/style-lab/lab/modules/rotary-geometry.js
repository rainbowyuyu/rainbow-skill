/**
 * Ideal, dimensionless Wankel kinematics. Right-handed XY plane, +Z toward
 * the front. Positive shaft and rotor angles both turn counter-clockwise.
 * No port timing, seals, curved flanks, pressure or production-engine CAD.
 * Sources and derivation: ../../studies/rotary-kinematics.md.
 */
export const ROTARY_DEFAULTS = Object.freeze({ eccentricity: 0.22, rotorRadius: 1 });
export const ROTARY_TAGGED_PERIOD = 6 * Math.PI;
const TAU = 2 * Math.PI;

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

export function rotaryParameters(options = {}) {
  const eccentricity = finite(options.eccentricity ?? ROTARY_DEFAULTS.eccentricity, 'eccentricity');
  const rotorRadius = finite(options.rotorRadius ?? ROTARY_DEFAULTS.rotorRadius, 'rotorRadius');
  // e < R/3 would suffice for the housing alone. The straight rotor needs the
  // stronger limit e <= R/4; otherwise its flank crosses the housing waist.
  if (rotorRadius <= 0 || eccentricity < 0 || eccentricity > rotorRadius / 4) {
    throw new RangeError('Straight rotor requires rotorRadius > 0 and 0 <= eccentricity <= rotorRadius / 4');
  }
  return { eccentricity, rotorRadius };
}

function count(value, minimum, label) {
  if (!Number.isInteger(value) || value < minimum) throw new RangeError(`${label} must be an integer >= ${minimum}`);
  return value;
}

function polar(radius, angle) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function housingAt(phi, e, R) {
  return { x: R * Math.cos(phi) + e * Math.cos(3 * phi), y: R * Math.sin(phi) + e * Math.sin(3 * phi) };
}

/** One point on the ideal apex trace. phi is rotor/apex angle, NOT shaft angle. */
export function housingPoint(phi, options = {}) {
  finite(phi, 'phi');
  const { eccentricity: e, rotorRadius: R } = rotaryParameters(options);
  return housingAt(phi % TAU, e, R);
}

/** CCW boundary, no duplicate endpoint. Close the polygon in the renderer. */
export function sampleHousing(options = {}, segments = 720) {
  const { eccentricity: e, rotorRadius: R } = rotaryParameters(options);
  count(segments, 12, 'segments');
  return Array.from({ length: segments }, (_, i) => housingAt(TAU * i / segments, e, R));
}

/**
 * Preserve the unwrapped shaft angle. Reducing it modulo 2pi before dividing
 * by three loses apex identity and produces a visible jump each shaft turn.
 */
export function sampleRotaryState(shaftAngle, options = {}) {
  finite(shaftAngle, 'shaftAngle');
  const { eccentricity: e, rotorRadius: R } = rotaryParameters(options);
  const localShaftAngle = shaftAngle % ROTARY_TAGGED_PERIOD;
  const localRotorAngle = localShaftAngle / 3;
  const center = polar(e, localShaftAngle);
  const apices = Array.from({ length: 3 }, (_, k) => {
    const p = polar(R, localRotorAngle + k * TAU / 3);
    return { x: center.x + p.x, y: center.y + p.y };
  });
  return {
    shaftAngle, rotorAngle: shaftAngle / 3,
    shaftTurns: shaftAngle / TAU, rotorTurns: shaftAngle / (3 * TAU),
    center, apices,
  };
}

/** Conservative straight-sided triangle; not the flank profile of a Mazda 13B. */
export function sampleRotorBoundary(shaftAngle, options = {}, pointsPerEdge = 24) {
  count(pointsPerEdge, 1, 'pointsPerEdge');
  const { apices } = sampleRotaryState(shaftAngle, options);
  const points = [];
  for (let k = 0; k < 3; k++) {
    const a = apices[k], b = apices[(k + 1) % 3];
    for (let i = 0; i < pointsPerEdge; i++) {
      const u = i / pointsPerEdge;
      points.push({ x: a.x * (1 - u) + b.x * u, y: a.y * (1 - u) + b.y * u });
    }
  }
  return points;
}

/**
 * Exact-curve radial gap (positive inside), NOT shortest Euclidean clearance.
 * For e < R/3 the polar angle of H(phi) increases strictly; bisection therefore
 * selects the unique intersection with the ray through the query point.
 * This avoids misclassifying exact apexes against a polygonal approximation.
 */
export function housingRadialClearance(point, options = {}) {
  finite(point?.x, 'point.x'); finite(point?.y, 'point.y');
  const { eccentricity: e, rotorRadius: R } = rotaryParameters(options);
  const alpha = Math.atan2(point.y, point.x);
  const halfWidth = Math.asin(e / R);
  let lo = alpha - halfWidth, hi = alpha + halfWidth;
  for (let i = 0; i < 48; i++) {
    const phi = (lo + hi) / 2;
    const error = phi + Math.atan2(e * Math.sin(2 * phi), R + e * Math.cos(2 * phi)) - alpha;
    if (error < 0) lo = phi;
    else hi = phi;
  }
  const phi = (lo + hi) / 2;
  const radius = Math.hypot(R + e * Math.cos(2 * phi), e * Math.sin(2 * phi));
  return radius - Math.hypot(point.x, point.y);
}

export function pointInHousing(point, options = {}, tolerance) {
  const { rotorRadius } = rotaryParameters(options);
  const tol = tolerance ?? 1e-9 * rotorRadius;
  finite(tol, 'tolerance');
  if (tol < 0) throw new RangeError('tolerance must be nonnegative');
  return housingRadialClearance(point, options) >= -tol;
}
