/** Original, dependency-free numerical contracts for water integration.
 * These are small mathematical helpers, not WaterPro source, a renderer,
 * a fluid solver, or a replacement for a project's saved simulation.
 * Coordinates: meters, Y up; kx/kz rad/m; omega rad/s; phase radians.
 */
const finite = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const unit = (value, name) => {
  finite(value, name);
  if (value < 0 || value > 1) throw new RangeError(`${name} must be in [0, 1]`);
  return value;
};
const rgb = (value, name) => {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} needs three linear-light channels`);
  return value.map((v, i) => { finite(v, `${name}[${i}]`); if (v < 0) throw new RangeError(`${name} cannot be negative`); return v; });
};

export function timeAtFrame(frame, fps) {
  if (!Number.isSafeInteger(frame) || frame < 0) throw new RangeError('frame must be a nonnegative integer');
  finite(fps, 'fps'); if (fps <= 0) throw new RangeError('fps must be positive');
  return finite(frame / fps, 'frame time');
}

/** The normal and vertical surface derivative come from the SAME saved modes.
 * No camera inputs: visual anti-aliasing must not alter physics/buoy sampling.
 * Surface velocityY is d(height)/dt at a fixed x,z, not full fluid velocity.
 */
export function sampleWaveSurface(components, { x, z, time, seaLevel = 0 }) {
  if (!Array.isArray(components)) throw new TypeError('components must be an array');
  [x, z, time, seaLevel].forEach((v, i) => finite(v, ['x', 'z', 'time', 'seaLevel'][i]));
  let elevation = 0, slopeX = 0, slopeZ = 0, velocityY = 0;
  for (const [i, c] of components.entries()) {
    for (const k of ['amplitude', 'kx', 'kz', 'omega', 'phase']) finite(c?.[k], `components[${i}].${k}`);
    const q = finite(c.kx * x + c.kz * z - c.omega * time + c.phase, `components[${i}] phase result`);
    const sine = Math.sin(q), cosine = Math.cos(q);
    elevation += c.amplitude * cosine;
    slopeX -= c.amplitude * c.kx * sine;
    slopeZ -= c.amplitude * c.kz * sine;
    velocityY += c.amplitude * c.omega * sine;
  }
  [elevation, slopeX, slopeZ, velocityY].forEach((value, i) => finite(value, ['elevation', 'slopeX', 'slopeZ', 'velocityY'][i]));
  const length = finite(Math.hypot(slopeX, 1, slopeZ), 'normal length');
  return { height: finite(seaLevel + elevation, 'height'), elevation, slopeX, slopeZ, velocityY,
    normal: [-slopeX / length, 1 / length, -slopeZ / length] };
}

/** Filter premultiplied RGB and coverage using the EXACT same kernel.
 * Each tap: {premultiplied:[r,g,b], coverage:0..1, weight:nonnegative}.
 * Background must be sampled from the same sky/environment for this ray.
 * Returns incident reflected radiance. DO NOT apply a Fresnel factor here.
 * HDR values >1 are preserved; filtering and composition stay scene-linear.
 */
export function composeReflection(taps, background, edgeConfidence = 1) {
  if (!Array.isArray(taps) || taps.length === 0) throw new TypeError('taps must be a nonempty array');
  const sky = rgb(background, 'background'), confidence = unit(edgeConfidence, 'edgeConfidence');
  let total = 0, coverageSum = 0; const sum = [0, 0, 0];
  for (const [i, tap] of taps.entries()) {
    const color = rgb(tap.premultiplied, `taps[${i}].premultiplied`);
    const coverage = unit(tap.coverage, `taps[${i}].coverage`), weight = finite(tap.weight, `taps[${i}].weight`);
    if (weight < 0) throw new RangeError('reflection kernel weights cannot be negative');
    if (coverage === 0 && color.some(v => v !== 0)) throw new RangeError('zero coverage must have zero premultiplied radiance');
    total += weight; coverageSum += coverage * weight;
    for (let channel = 0; channel < 3; channel++) sum[channel] += color[channel] * weight;
  }
  finite(total, 'total reflection weight'); finite(coverageSum, 'weighted coverage');
  sum.forEach((value, i) => finite(value, `weighted radiance[${i}]`));
  if (total <= 0) throw new RangeError('reflection kernel needs positive total weight');
  const coverage = coverageSum / total * confidence;
  const premultiplied = sum.map(value => value / total * confidence);
  const radiance = premultiplied.map((value, i) => finite(value + (1 - coverage) * sky[i], `radiance[${i}]`));
  return { radiance, coverage, premultiplied };
}

export function fresnelSchlick(cosTheta, f0) {
  finite(cosTheta, 'cosTheta'); unit(f0, 'f0');
  const cosine = Math.max(0, Math.min(1, cosTheta));
  return f0 + (1 - f0) * (1 - cosine) ** 5;
}

/** One interface blend only. A renderer already doing Fresnel must NOT call
 * this a second time. belowSurface includes whatever transmission/absorption
 * the chosen renderer has computed; this function does not model that volume.
 */
export function blendWaterInterface(incidentReflection, belowSurface, fresnel) {
  const reflection = rgb(incidentReflection, 'incidentReflection');
  const below = rgb(belowSurface, 'belowSurface'), f = unit(fresnel, 'fresnel');
  return reflection.map((value, i) => finite(f * value + (1 - f) * below[i], `interface color[${i}]`));
}
