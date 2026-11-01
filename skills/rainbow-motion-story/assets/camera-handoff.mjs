/** Perspective handoff for an observer approaching a real sensor.
 * Supply the project's existing THREE module; no separate package installation.
 * Poses use world-space arrays, degrees for fov, radians for roll.
 * This interpolates a shot. It is not collision avoidance or a physical solver.
 */
export function blendViewPose(THREE, a, b, progress, minFocus = 0.1) {
  if (!Number.isFinite(progress) || !Number.isFinite(minFocus) || minFocus <= 0)
    throw new Error('Finite progress and positive minimum focus are required');
  for (const pose of [a, b]) {
    for (const key of ['position', 'target']) {
      if (!Array.isArray(pose[key]) || pose[key].length !== 3 || !pose[key].every(Number.isFinite))
        throw new Error('World-space position and target must contain three finite coordinates');
    }
    if (!Number.isFinite(pose.fov) || pose.fov <= 0 || pose.fov >= 180 || !Number.isFinite(pose.roll))
      throw new Error('Use a perspective fov in (0, 180) and a finite roll');
  }
  const t = Math.max(0, Math.min(1, progress));
  const vec = x => new THREE.Vector3(...x);
  const pa = vec(a.position), pb = vec(b.position), ta = vec(a.target), tb = vec(b.target);
  const da = pa.distanceTo(ta), db = pb.distanceTo(tb);
  if (Math.min(da, db) < minFocus) throw new Error('Endpoint focus distance is below minFocus');
  const up = new THREE.Vector3(0, 1, 0);
  const qa = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pa, ta, up));
  const qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pb, tb, up));
  const position = pa.lerp(pb, t);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(qa.slerp(qb, t));
  const focusDistance = da + (db - da) * t;
  const target = position.clone().addScaledVector(direction, focusDistance);
  const rollDelta = Math.atan2(Math.sin(b.roll - a.roll), Math.cos(b.roll - a.roll));
  return {position: position.toArray(), target: target.toArray(),
    fov: a.fov + (b.fov - a.fov) * t, roll: a.roll + rollDelta * t, focusDistance};
}

/** Keep a chosen focus plane's projected scale during an actual camera dolly. */
export function dollyFov(distance, framingConstant) {
  if (!Number.isFinite(distance) || !Number.isFinite(framingConstant) || distance <= 0 || framingConstant <= 0)
    throw new Error('Distance and framing constant must be positive and finite');
  return 2 * Math.atan(framingConstant / distance) * 180 / Math.PI;
}
