import { candidateById } from './modules/index.js';
/** Deterministic frame adapter for canvas rendering in a video composition. */
export function drawFrame(canvas, { id, frame, fps = 30, width = 1920, height = 1080, options = {} }) {
    const candidate = candidateById[id];
    if (!candidate)
        throw new Error(`Unknown motion candidate: ${id}`);
    if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0)
        throw new Error('Finite frame and positive fps required');
    if (canvas.width !== width)
        canvas.width = width;
    if (canvas.height !== height)
        canvas.height = height;
    candidate.draw(canvas.getContext('2d'), frame / fps, width, height, options);
    return candidate.sample(frame / fps, options);
}
/** Adapt a sampled camera pose to a Three.js PerspectiveCamera without importing Three. */
export function applyCameraPose(camera, pose) {
    if (!pose?.position || !pose?.target || ![...pose.position, ...pose.target, pose.fov, pose.roll ?? 0].every(Number.isFinite))
        throw new Error('Camera pose requires position and target');
    if (Math.hypot(...pose.position.map((v, i) => v - pose.target[i])) < 1e-8 || pose.fov <= 0 || pose.fov >= 180)
        throw new Error('Camera needs a distinct target and a field of view between 0 and 180');
    camera.position.set(...pose.position);
    // Reset the basis before absolute roll: repeated/descending frames must not accumulate it.
    camera.up.set(0, 1, 0);
    camera.lookAt(...pose.target);
    if (pose.roll)
        camera.rotateZ(pose.rollConvention === 'camera-local' ? pose.roll : -pose.roll);
    // A sampled pose defines the effective FOV and principal point completely.
    // Clear projection modifiers left by another shot before applying that definition.
    camera.zoom = 1;
    camera.filmOffset = 0;
    camera.fov = pose.fov;
    const principal = pose.principalPoint ?? [.5, 480 / 900];
    if (principal.length !== 2 || !principal.every(v => Number.isFinite(v) && v >= 0 && v <= 1))
        throw new Error('Camera principalPoint must be normalized viewport coordinates');
    // Match the Canvas principal point without an external pixel compensation.
    // Preserve the renderer's aspect ratio; reset previous view offsets each sample.
    const fullHeight = 1000, fullWidth = fullHeight * camera.aspect;
    camera.setViewOffset(fullWidth, fullHeight, (.5-principal[0])*fullWidth, (.5-principal[1])*fullHeight, fullWidth, fullHeight);
    camera.updateProjectionMatrix();
    return pose.focusDistance ?? null;
}
/** Export only portable metadata: functions remain in the accompanying ES modules. */
export function makeSelection(ids, options = { intensity: .7, palette: 'titanium' }) {
    return { schemaVersion: 1, skill: 'rainbow-motion-story', items: ids.map(id => {
            const c = candidateById[id];
            if (!c)
                throw new Error(`Unknown candidate: ${id}`);
            return { id, module: c.module, title: c.title, duration: c.duration, options: { ...options }, code: c.codeFile, referenceIds: c.referenceIds, recipe: c.recipe };
        }) };
}
