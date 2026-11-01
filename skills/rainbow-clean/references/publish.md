# Inactive video publication folders

User authorization (2026-10-14): physically **move**, never copy, the latest final video, its actual release copy and four cover ratios into `publish`. Only projects inactive for at least 3 days qualify. This organizes files; it does not publish to platforms or imply subjective video approval.

## Selection and layout

- Preserve the existing whole-project protection: creation and modification time, running processes, latest two version folders, keep markers and `rainbow_arc_2026_v16`. Inspect relative process commands using their working directories; the publisher has a read-only Windows x64 process-cwd helper. Never kill a process. An unversioned base with newer versioned siblings is not the latest release.
- Confirm the latest **same-topic** complete video using README, delivery records and render manifests. Version numbers in unrelated topics cannot supersede one another. Retain originals when records disagree, music/render status is pending, or final identity is uncertain.
- Use actual existing publication copy (titles, descriptions, tags and credits), not narration or script text. Do not generate replacement images or new copy as part of cleanup. Preserve required credit documents alongside the copy.
- Match 16:9, 4:3, 3:4 and 9:16 covers to the same topic. Validate real image dimensions, not filenames alone. Keep existing JPG and PNG exports when both are delivered; exclude thumbnails, review sheets and obsolete cover revisions.
- Layout: `<project>/publish/{video,copy,cover}`. A project containing several distinct videos uses `<project>/publish/<topic>/{video,copy,cover}`. If two videos share an indivisible release-copy document, use one shared physical publish package, separate their video/cover subfolders, and link both catalog topics to it. Do not duplicate the shared document.
- If any component is missing, record the exact missing component under project `work`; leave the incomplete set in place. Do not misrepresent an incomplete package as ready. Recent projects are not modified to add empty publish folders.
- A publisher move does not free space. Report moved bytes separately from any separately authorized, verified duplicate deletion. This workflow never deletes media or creates hardlinks/file symlinks.

## Reviewed move workflow

Use `scripts/organize-publish.py` with Python 3.12+, Pillow and ffprobe. It defaults to scan. The source selection is a reviewed JSON spec, not a heuristic that guesses final filenames. Discover new eligible projects at each scheduled run; do not blindly replay only the initial example list.

Spec shape:

```json
{
  "schema": 1,
  "packages": [{
    "id": "topic-v3",
    "projects": ["project-name"],
    "destination": "project-name/publish",
    "topics": ["topic"],
    "evidence": "README and final manifest identify V3; latest cover release is V4.",
    "files": [{
      "source": "project-name/output/final.mp4",
      "destination": "video/final.mp4",
      "role": "video",
      "topics": ["topic"]
    }]
  }],
  "deferred": [{"project": "other-project", "reason": "Missing release copy"}]
}
```

Each topic must have roles `video`, `copy`, and `cover:16x9`, `cover:4x3`, `cover:3x4`, `cover:9x16`. Additional credits/subtitles can use `supplement`. All source paths are relative to video_project; destinations inside each package are relative to its publish folder. Source projects must include every donor for shared assets.

```powershell
python "$env:USERPROFILE/.codex/skills/rainbow-clean/scripts/organize-publish.py" --spec '<work>/publish-spec-<timestamp>.json' --report '<work>/publish-scan-<timestamp>.json'
# Review the exact paths, video identity, incoming references and selection evidence first.
python "$env:USERPROFILE/.codex/skills/rainbow-clean/scripts/organize-publish.py" --apply --reviewed '<work>/publish-scan-<timestamp>.json' --report '<work>/publish-apply-<timestamp>.json'
```

The script validates all packages before mutation, rechecks timestamps, hashes, project activity and running processes, refuses junctions and existing destination files, uses the shared organizer lock, journals each move and attempts per-package rollback on failure. Same-volume Windows rename is required. It hashes destination files and verifies old entries disappeared. Each package receives `publish-manifest.json` with original/destination mapping and a README. Repeating the same selection verifies hashes and skips already organized packages. An interrupted journal or failed receipt needs recovery first, not automatic rerun.

Existing source scripts may output to historical paths. Inspect direct consumers before moving. Update human entry links and direct current read/QA inputs deliberately; preserve historical evidence, old render outputs and generation scripts unless explicitly adapting their workflow. Do not globally replace filenames across source. Record unmigrated rebuild paths clearly. A same-project video receipt can be consulted to locate a moved final by original path and hash. Before reusing an old producer, choose a new work/output version or deliberately restore its relevant input by the move mapping; do not overwrite the published file. Restoring requires verifying both paths, no occupied original path, and current published hashes; use a same-volume move.

For a new final version where publish already exists, first prepare a reviewed move of the **previous whole package** into `<project>/history/publish/<version>` with no overwrite; keep its provenance. Never delete or silently replace a published final. The current script refuses different selections at an occupied destination; the automation should review and perform that archive as a separate same-volume transaction, then publish the new complete set. Do not require user approval again for the already-authorized unambiguous organization, but defer uncertain version selection.

## Cleanup and catalog

- Explicitly exclude every `publish` subtree from deletion, including nested topics and future publish/history packages. Do not delete a moved final merely because its old path is absent. A cleanup rule requiring a final hash must resolve the published receipt or skip the candidate.
- Maintain `_catalog/<topic>/publish/files` (or `shared-release`) as a directory junction to the actual package. Catalog links are navigation; the files inside physical publish are genuine moved files.
- Before declaring success, check file count, video hashes, four real ratios per topic, source absence, receipt and catalog targets. Save scan/apply/verification JSON in project `work`.
- Tests for the mover: `python scripts/test-organize-publish.py` (moves, idempotency, changed source, collision, rollback, recent protection and boundary checks).
- Reference initial reviewed selection: `D:/projects/manim_extend_rainbow/work/publish-spec-20261014.json`. It covers eight videos across seven packages. The JSON also records incomplete/unconfirmed projects; future runs must refresh discovery and final-version evidence.
