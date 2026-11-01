import { C, TAU, phase, mix, smooth, window, begin, end, text, line, path, circle, pill, glow, projector, floor3, box3, assembly3, cameraBadge, candidate, clamp, blurredGroup } from './common.js';
const orbit = candidate({ id: 'camera-orbit-bank', module: 'camera', title: '多轴绕行，带克制横滚', description: '视点绕同一主体运行，升降和横滚有独立连续曲线，目标保持稳定，避免仅绕Y轴转台。', referenceIds: ['camera', 'car-ignition', 'aesthetic'], usage: '适合展示完整三维结构与宏大尺度，主体始终可追踪。', stages: ['建立方位', '升降绕行', '横滚接力', '回收尺度'], recipe: ['相机 position、target、fov、roll 都由绝对时间给出。', '高潮扩大半径与高度差；讲解时限制横滚。', '验收检查速度与加速度，而非只检查位置接上。'] }, (t, o) => { const p = phase(t), a = TAU * p, amp = .4 + o.intensity * .6; return { time: p * 10, camera: { position: [10.8 * Math.sin(a) * (.82 + o.intensity * .18), 4.6 + 1.1 * Math.sin(a * 2) * amp, 10.8 * Math.cos(a)], target: [0, 1.65, 0], fov: 46 + 2 * Math.sin(a), roll: .085 * Math.sin(a) * amp, focusDistance: 10.8 }, phase: p }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '围绕机构飞行，注意力始终有落点', subtitle: '横移 × 升降 × 克制横滚', palette: p });
    const project = projector(s.camera);
    floor3(ctx, project);
    const objects = [{ c: [-2.1, .3, -1.1], size: [.6, .6, .6] }, { c: [2.1, .3, -1.1], size: [.6, .6, .6] }].sort((a, b) => project(b.c).z - project(a.c).z);
    objects.forEach(v => box3(ctx, project, v.c, v.size, p.cyan));
    assembly3(ctx, project, { theta: .16 * Math.sin(s.phase * TAU) });
    const q = project([0, .05, 0]);
    circle(ctx, q.x, q.y, 7, p.gold);
    const hq = project([0, 3.8, 0]);
    pill(ctx, '同一个转子，同一条轴线', hq.x, Math.max(175, hq.y - 35), { color: p.gold });
    cameraBadge(ctx, s.camera);
    text(ctx, '空间轨迹闭合，循环边界速度连续', 90, 807, 21, p.muted);
    end(ctx);
});
const occlude = candidate({ id: 'camera-occlusion-pass', module: 'camera', title: '越过前景，接住下一个主体', description: '视点横向掠过近处结构，前景短暂遮挡后由空间纵深接力，主体不会凭空消失。', referenceIds: ['camera', 'transmission'], usage: '适合空间连续的章节交接和大场景推进。', stages: ['认出前景', '接近遮挡', '穿过', '主体重现'], recipe: ['遮挡物属于场景，应先可辨认。', '近物视差大，主体运动小；只在通过时短暂遮挡。', '离开前景后留出可读窗口，不叠第二次快切。'] }, (t, o) => { const p = phase(t), a = TAU * p, q = (1 - Math.cos(a)) * .5; return { time: p * 10, progress: q, camera: { position: [mix(-7.5, 7.5, q) * (.85 + o.intensity * .15), 3.2 + Math.sin(a) * .25, 9.2], target: [0, 1.6, 0], fov: 43, roll: .045 * Math.sin(a), focusDistance: 8.5 }, foreground: [0, 1.42, 4.8] }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '用空间接力，不靠一屏淡黑', subtitle: '先认出前景，再越过它，看清之后的机构', palette: p });
    const project = projector(s.camera);
    floor3(ctx, project);
    box3(ctx, project, [3, .75, -2.7], [1.5, 1.5, 1.5], p.gold);
    assembly3(ctx, project, { theta: .1 });
    const fore = project(s.foreground);
    ctx.save();
    ctx.beginPath();
    ctx.rect(60, 165, 1480, 555);
    ctx.clip();
    blurredGroup(ctx, 'occlusion-foreground', 1.8, layer => {
        box3(layer, project, s.foreground, [.23, 2.84, .38], p.cyan);
        box3(layer, project, [0, .12, 4.8], [.72, .24, .72], p.cyan);
    });
    ctx.restore();
    const target = project([-1.2, 2.5, 0]);
    if (Math.abs(fore.x - target.x) > 135)
        pill(ctx, '转子仍在原位', target.x, Math.max(190, target.y - 135), { color: p.gold });
    cameraBadge(ctx, s.camera, '前景视差');
    text(ctx, '遮挡结束后，眼睛仍能找到原来的转子', 90, 807, 21, p.muted);
    end(ctx);
});
const focus = candidate({ id: 'camera-dolly-focus', module: 'camera', title: '先移焦，再推进', description: '焦点由前景传感器移交到转子；相机推进发生在注意力转移之后，背景失焦仅来自深度差。', referenceIds: ['camera', 'rotary-cutaway'], usage: '适合从测量器或细节自然移交注意力到主体。', stages: ['近处聚焦', '焦点移交', '缓慢推进', '恢复'], recipe: ['先让观众认出近处测量器。', '焦点变化先于大幅相机位移。', '标签独立合成，不跟着景深模糊。'] }, (t, o) => { const p = phase(t), s = p * 10, q = window(s, .8, 9.3, 2, 2.2), move = window(s, 2.2, 8.6, 2, 2); const cam = { position: [1.2 - .8 * move, 3.1, 10.5 - 2.1 * move * (.6 + o.intensity * .4)], target: [-.3, 1.8, 0], fov: 41, roll: 0, focusDistance: mix(4.6, 9, q) }; return { time: s, focus: q, move, camera: cam, focusDistance: cam.focusDistance }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '不必一直转镜头，焦点也会说话', subtitle: '由测量器 → 转子 · 景深为深度差的示意', palette: p });
    const project = projector(s.camera);
    floor3(ctx, project);
    const subjectDepth = project([-.3, 2, 0]).z;
    const subjectBlur = clamp(Math.abs(subjectDepth - s.focusDistance) * 1.2, 0, 7);
    blurredGroup(ctx, 'focus-subject', subjectBlur, layer => {
        assembly3(layer, project, { theta: .05 });
    });
    const sensor = [-1.3, 1.6, 5], depth = project(sensor).z;
    const sensorBlur = clamp(Math.abs(depth - s.focusDistance) * 1.8, 0, 10);
    blurredGroup(ctx, 'focus-sensor', sensorBlur, layer => {
        box3(layer, project, sensor, [.8, .85, .45], p.gold);
        const q = project([-1.3, 1.6, 5.26]);
        circle(layer, q.x, q.y, q.scale * .24, '#14343f', p.cyan, 4);
        circle(layer, q.x, q.y, q.scale * .08, p.cyan);
    });
    pill(ctx, s.focus < .5 ? '先看测量器' : '再看转子反应', 800, 200, { color: s.focus < .5 ? p.gold : p.cyan });
    cameraBadge(ctx, s.camera, `焦点 ${s.focusDistance.toFixed(1)} m`);
    text(ctx, '深度差决定失焦；读字层保持清楚', 90, 807, 21, p.muted);
    end(ctx);
});
const dollyZoom = candidate({ id: 'camera-dolly-zoom', module: 'camera', title: '主体不变，空间在呼吸', description: '移动相机同时改变视场角，保持中心主体投影尺度不变，让背景纵深逐渐展开。', referenceIds: ['camera', 'aesthetic'], usage: '适合空间关系揭示、尺度反差和章节转折，不适合精确尺寸比较。', recipe: ['锁定中心主体和目标平面。', '用 tan(fov/2) × distance 保持常量。', '背景必须有近远层次，才看得见透视变化。'], stages: ['建立尺度', '推远变焦', '纵深展开', '原路回收'] }, (t, o) => { const p = phase(t), q = (1 - Math.cos(p * TAU)) * .5, z = 8 + 5 * q * (.4 + o.intensity * .6), fov = 2 * Math.atan(Math.tan(22 * Math.PI / 180) * 8 / z) * 180 / Math.PI; return { time: p * 10, distance: z, projectionScale: 1 / (z * Math.tan(fov * Math.PI / 360)), camera: { position: [0, 1.8, z], target: [0, 1.8, 0], fov, roll: 0, focusDistance: z } }; }, (ctx, t, w, h, o, s) => {
    const p = o.theme;
    begin(ctx, w, h, { title: '镜头退后，主体却没有变小', subtitle: '移动与变焦反向配合 · 背景深度承担变化', palette: p });
    const project = projector(s.camera);
    floor3(ctx, project);
    for (let z = -12; z <= -3; z += 3) {
        box3(ctx, project, [-4, 2, z], [.35, 4, .45], p.cyan);
        box3(ctx, project, [4, 2, z], [.35, 4, .45], p.cyan);
        box3(ctx, project, [0, 4, z], [8.4, .25, .45], p.cyan);
    }
    assembly3(ctx, project, { theta: .4 });
    cameraBadge(ctx, s.camera, `相机距离 ${s.distance.toFixed(1)} m`);
    text(ctx, '中心平面大小相同；前后物体比例改变', 90, 807, 21, p.muted);
    end(ctx);
});
export const candidates = [orbit, occlude, focus, dollyZoom];
