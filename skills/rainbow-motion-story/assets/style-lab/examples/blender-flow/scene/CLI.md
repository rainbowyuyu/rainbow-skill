# Blender flow CLI

This is a local Blender Python entry point, not an HTTP service. It constructs an original porcelain spillway, bakes Mantaflow liquid data and mesh, then renders the saved scene. Run commands from `D:/projects/manim_extend_rainbow/research/motion_atelier`.

```powershell
$blender = 'D:/blender/blender.exe'
$script = 'examples/blender-flow/build_waterfall.py'

# Build a new revision. Choose a fresh cache directory; preserve prior caches.
& $blender --background --factory-startup --python-exit-code 1 --python $script -- --stage build --resolution 64 --frames 96 --output-dir 'examples/blender-flow/scene' --cache-dir 'work/blender-flow/bake/v2'

# Reopen the generated blend and bake its saved cache destination: Data, then Mesh.
& $blender --background --factory-startup --python-exit-code 1 --python $script -- --stage bake --output-dir 'examples/blender-flow/scene'

# Reopen independently and render keyframes. No existing interactive scene is used.
& $blender --background --factory-startup --python-exit-code 1 --python $script -- --stage render --render-frames 1,24,60,96 --engine CYCLES --samples 32 --width 640 --height 360

# Render the saved scene's complete frame range.
& $blender --background --factory-startup --python-exit-code 1 --python $script -- --stage render --render-frames all --render-dir frames --engine CYCLES --samples 16 --width 640 --height 360

# Encode 96 rendered frames into a silent, four-second H.264 preview.
& 'C:/ffmpeg/bin/ffmpeg.exe' -framerate 24 -i 'examples/blender-flow/scene/frames/frame_%04d.png' -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart -an 'examples/blender-flow/scene/porcelain_spillway_preview.mp4'
```

`--output-dir` selects the directory containing the `.blend` and renders. `--scene-file` selects its filename. `--report-file` selects an independent QA JSON destination. A custom output directory defaults its report to `OUT/runtime.json` and, unless `--cache-dir` is supplied, its cache to `OUT/cache`; it does not write those artifacts back into the installed skill. Prefer an explicit project `work/` cache directory for substantial simulations. `--cache-dir` chooses a new cache when building; `bake` uses the cache saved in that scene. `--render-frames all` reads the saved scene range, and explicit comma-separated frames are checked against the saved cache range. Missing mesh frames fail with an error rather than rendering a fake liquid substitute. Use `--camera 'Camera · closeup' --render-dir closeup --render-frames 60` for the second camera.

The v2 `.blend` stores its cache path relative to its own directory. Move the project tree with the `examples/` and `work/` relationship intact to retain that link. If the cache is moved separately, render with `--relink-cache 'ABSOLUTE/PATH/TO/RESTORED/CACHE'`; this changes the cache reference only in that isolated process and does not save over the `.blend`. To make a permanent relink, update the domain cache path in a separately saved copy of the scene. Restore the complete cache, including `config/`, `data/`, and `mesh/`; a `.blend` alone does not contain the baked simulation.

For a changed model or simulation setting, use `build` with a fresh `--cache-dir` and, when preserving a prior editable scene, a distinct `--scene-file` or `--output-dir`. No stage deletes cache directories. Interrupted renders can resume with an explicit list of missing frame numbers. Interrupted data/mesh baking should be inspected in Blender before continuing; this script does not claim a partial cache is complete.

For the default bundled scene, the QA record is `qa/blender-flow-runtime.json` under this project root. It records Blender version, gravity, domain dimensions, voxel scale, collision and surface reconstruction settings, frame counts, relative cache path, bake timings, render runs, and independent reopen verification. The first diagnostic version remains in `scene/porcelain_spillway_v1.blend`, `scene/diagnostic_v1.mp4`, and the original `work/blender-flow/bake/` cache root. v2 uses the `v2/` child cache.

This is a low-resolution, art-directed FLIP liquid study. Thick overlapping collision solids represent the ceramic's wet boundaries; visible ceramic edges are bevelled. Droplets, contact lines, thin sheets, turbulence, surface tension, and quantitative flow rates are not validated. A visually improved result is not evidence of engineering or scientific accuracy. No global Blender preferences are saved, no paid APIs are used, and no existing interactive Blender scene is opened or modified.
