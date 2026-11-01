import {candidateById} from './modules/index.js';
import {applyCameraPose} from './adapter.js';

/** Independent shot and action clocks. Sampling is safe in reverse or random frame order. */
export function sampleCameraShot(id, frame, fps = 30, options = {}) {
    const candidate = candidateById[id];
    if (!candidate || candidate.module !== 'camera') throw new Error('Unknown camera candidate: ' + id);
    if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) throw new Error('Finite frame and positive fps required');
    const filmTime = frame / fps;
    const shotTime = candidate.loop === false
        ? Math.max(0, Math.min(candidate.duration, filmTime))
        : ((filmTime % candidate.duration) + candidate.duration) % candidate.duration;
    const state = candidate.sample(shotTime, options);
    return {id, filmTime, shotTime, worldTime: state.worldTime ?? state.time ?? shotTime, camera: state.camera, state};
}

/** Call updateWorld with worldTime, not filmTime: bullet-time requires separate clocks. */
export function applyCameraShot(camera, shot, updateWorld) {
    if (typeof updateWorld !== 'function') throw new Error('Provide an absolute-time updateWorld function');
    updateWorld(shot.worldTime, shot.state);
    const focusDistance = applyCameraPose(camera, shot.camera);
    return {focusDistance, worldTime: shot.worldTime};
}

/** Read back the shot end pose when constructing an explicit next-shot handoff. */
export function cameraEndpoints(id, fps = 30, options = {}) {
    const candidate = candidateById[id];
    if (!candidate || candidate.module !== 'camera') throw new Error('Unknown camera candidate: ' + id);
    return {
        start: candidate.sample(0, options).camera,
        end: candidate.sample(candidate.loop === false ? candidate.duration : candidate.duration - 1 / fps, options).camera,
        duration: candidate.duration,
        loops: candidate.loop !== false,
    };
}
