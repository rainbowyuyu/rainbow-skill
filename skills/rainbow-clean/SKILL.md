---
name: rainbow-clean
description: "Safely clean Windows C:/D: caches, remove verified duplicate render files and independent dependencies, archive inactive versions, and move final videos, release copy and four-ratio covers into publish folders. Preserves recent projects, source and unique media."
---

# rainbow-clean

Use this skill for a measured cleanup of Windows temporary files. Deletion is permanent. The script validates paths, skips reparse points including ancestor junctions, and counts failures with up to 200 detailed error entries. It reports C: and D: free space separately.

## Safety defaults

- The default invocation is a dry run. It reports candidates but does not delete anything.
- `-Apply` is required for deletion.
- Locked files are skipped and recorded.
- General temporary files must be older than 24 hours by both creation and modification time. This reduces risk but does not prove a file is unused.
- D: cache cleanup is limited to `D:\QQMusicCache`, requiring both creation and modification times to be older than 30 days by default. `-DriveOlderThanDays` changes this threshold. Preserve `D:\temp`: it contains Visual Studio installer state and is not a disposable cache tree.
- Manim project cleanup is opt-in through `scripts\clean-manim-project.ps1`. It scans `D:\projects\manim_extend_rainbow\video_project`. Aged intermediates qualify only in explicit `work/**/qa`, `qa-*`, `scene-qa`, `media-qa-smoke` or `research/qa-*` directories. Other work files need separate investigation, never blanket deletion.
- Deliveries qualify only with one filename version token, identical title after replacing that token, identical parent directory and matching probed video dimensions. Retain the latest two versions and apply the same age threshold to older ones. Directory versions alone, different titles, aspect labels and uncertain replacements do not authorize deletion.
- Preserve all `rainbow_arc_2026_v16`, canonical public/assets/originals/generated/Qwen directories, source code, audio/images/models and unique history. Deep cleanup may remove verified byte-identical copies inside identified generated bundles, as described below; never infer that any directory called public is disposable. Traversal skips reparse points. Default age threshold is 3 days by both creation and modification time.
- Before applying, review the exact scan report and search source/config references to candidates, preserving anything still used. Remove such entries from a separate reviewed manifest. Pass it with `-ReviewedManifest`; apply only considers unchanged files still eligible under the current rules, revalidates replacements, and never adds newly discovered files. Review and execution are not atomic: skip files in active renders.
- User preference (2026-10-14): leave entire video projects untouched if any source, media or work file was created/modified in the last **3 days**. Also retain each explicitly versioned family’s newest two folders, running projects, `rainbow_arc_2026_v16`, and projects with a `.rainbow-clean-keep` file. The video script now refreshes whole-project protection on every scan/apply.
- Only known `.codex\.tmp\git-*` staging trees with no recently created or modified descendants qualify (3 days by default). Preserve custom `.codex\tmp` projects and sandbox runtime binaries.
- Cache cleanup never targets `.codex\sessions`, `.codex\visualizations`, `.codex\skills`, `.codex\tools`, `.codex\secrets`, unrelated project directories, Cursor user data, or Claude/TTS configuration. Authorized video_project cleanup uses the separate reviewed workflows below.

## Usage

When the user requests cleanup, authorization covers the listed disposable caches: scan, review the concrete target list, then apply without asking again. If the user requests only a scan, do not apply. Never kill applications, bypass locks, take ownership, empty the Recycle Bin, or expand into user data to gain more space. Existing configuration, secrets, sessions, archived sessions, visualizations, attachments, plugins and application runtimes are not cache targets. A cache can regenerate, so do not repeatedly clean to chase a zero-byte result.

From PowerShell:

```powershell
# Scan and report (safe default)
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\rainbow-clean.ps1"

# Perform the cleanup
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\rainbow-clean.ps1" -Apply

# Keep Codex temporary files for a longer period
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\rainbow-clean.ps1" -Apply -CodexOlderThanDays 14

# Keep D: music cache files for a longer period
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\rainbow-clean.ps1" -Apply -DriveOlderThanDays 90

# Scan Manim historical/intermediate MP4s (safe dry-run)
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\clean-manim-project.ps1"

# Apply the Manim cleanup after reviewing the JSON report
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\clean-manim-project.ps1" -Apply -ReviewedManifest '<reviewed-scan.json>'

# Use a longer retention window for intermediates
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\clean-manim-project.ps1" -DryRun -IntermediateOlderThanDays 14
```

The script writes a timestamped JSON report in the current directory unless `-ReportPath` is supplied. Review the report when diagnosing locked files or unexpectedly low reclaimed space.

## Unified version storage (authorized recurring scope)

For an explicit request to retain only the latest usable version, read [references/latest-only.md](references/latest-only.md). This manual mode can supersede the history retention defaults when the user authorizes it; it is not automatic permission to delete unique historical content on recurring runs. Canonical projects established on 2026-10-15 are `video_project/rainbow_arc_2026` (main V20 plus independent warm-creek trial) and `video_project/ai_evolution_ch05_reasoning_agents` (V06). Their `_v16` and `_v06` compatibility junctions point to these same physical directories and are not additional versions. Protect these canonical current projects wherever an older rule protects their aliases.

Use `scripts/organize-version-storage.ps1` to scan `video_project` and review the JSON actions. It uses `plan-version-storage.py` (Python 3.12+ on Windows), skips reparse points, and inventories incoming junction references. Run source/config reference searches before applying dependency removals; a lockfile alone does not prove a dependency is unused. Preserve targets used by other projects, external tools or live tasks. Inspect process command lines and current task context; if a running process cannot be assigned confidently, preserve its possible projects.

- Default inactive window: 3 days, never less. Creation and modification timestamps both count; dependencies must also be inactive.
- Only explicit top-level `<family>_v<number>` folders older than the protected latest two qualify for automatic archiving. Unversioned project names and nested src/public/media version folders are not inferred obsolete.
- Central location: `D:\projects\manim_extend_rainbow\video_project\_history\<family>\<original-folder-name>`. Same-volume moves preserve all source, media, lockfiles and other history. Original paths become absolute junctions to keep existing references reachable. These junctions are not duplicate copies and must not be deleted recursively.
- Preserve projects with relative links or physical node_modules during archive moves. Independent dependencies may be cleaned first; archive eligibility is reassessed on the next run. Shared dependency donors stay in place even if old.
- Delete only physical, independent `node_modules` with valid package.json/package-lock.json and no local/workspace dependency requirements. Never merge different lockfiles into one shared installation. Shared directories/junctions and their targets are preserved. Inside an eligible node_modules, delete regular files only and retain junctions, including shared browser links. Keep all manifests; recovery is `npm ci` from that package directory.
- Review `actions`, remove ambiguous or externally referenced actions in a separate reviewed manifest, then apply. Apply refreshes inventory, compares fingerprints, checks running processes and locks out concurrent organizer runs. No force flags, ACL changes, process termination or Recycle Bin cleanup.
- A move is archival storage, not a promise every old script runs from the deeper path. Before developing an archived version again, restore its original directory: verify the original entry is the expected junction to its mapped archive, remove only that junction without recursion, and move the archive back to the original path. Do not overwrite an occupied path. Mapping JSON files beside archived folders record exact original and destination paths.
- Ordinary version organization and MP4 cleanup skip `_history` and its compatibility junctions. The deep-clean workflow explicitly authorized on 2026-10-14 may inspect physically mapped archived versions under `_history` under the same age, duplicate-proof and preservation rules; never blanket-delete an archive. Update the history index after moves.

```powershell
# Scan; reports belong in the project work directory, with a unique timestamp each run.
& "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\organize-version-storage.ps1" -InactiveDays 3 -ReportPath '<project>\work\version-storage-scan-<timestamp>.json'

# Apply only the reviewed actions.
& "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\organize-version-storage.ps1" -Apply -InactiveDays 3 -ReviewedManifest '<reviewed-scan.json>' -ReportPath '<project>\work\version-storage-apply-<timestamp>.json'
```

After changes, verify archived file inventories and junction targets against mappings, check protected paths still exist, and report deleted logical bytes separately from archive size (moving folders does not free disk space). Regression fixtures are available in `scripts/test-version-storage.ps1` and `scripts/test-clean-manim.ps1` when changing cleanup logic.

## Deep render cleanup and standard project catalog

The user authorized deeper cleanup of old intermediate MP4s, generated directories and independent Node dependencies, while retaining the **3-day whole-project protection**. Use `scripts/clean-deep-video.ps1`; default is scan, and apply requires `-ReviewedManifest`. It delegates read-only classification and hashing to `plan-deep-video-clean.py`.

- Generated bundles qualify only below tmp/work/output/outputs/research, with both a Remotion index.html and webpack bundle.js signature. Only recognized compiled bundle JS/maps, index.html and favicon are generated-file candidates. Never remove source backups or unknown files by directory name alone.
- Bundle public assets qualify only when the same relative file exists in that project's canonical public directory and both size and SHA-256 match. The original is retained and rechecked at execution. Different or unique historic assets stay. This rule can reclaim repeated images/audio/models without deleting their unique originals.
- `chunk-<from>-<to>.mp4` qualifies only when a render-manifest.json explicitly records its matching hash and a retained complete final video's hash and probed frame count validate. Preserve chunks mentioned by pending/incomplete/failed/draft render manifests. Do not remove a final or unique historical MP4 just because of a version number. Other historical delivery deletion uses the stricter existing video manifest workflow.
- Sources/finals retained as evidence cannot also be deletion targets. Preserve files reachable through incoming project junctions. Inspect source/config references and active tasks for any external consumer not discoverable from the filesystem links. Recently active projects, latest two version folders, current rainbow v16 and keep markers are excluded.
- Mapped physical archives may be inspected; never follow their original compatibility junctions. Node dependency cleanup remains restricted to the organizer's independent reinstallable dependencies; shared hosts and link targets remain protected.
- Apply reruns classification and content hashing, intersects the fresh results with the reviewed list, checks file timestamps/sizes and keeper hashes, skips running projects, journals results, and removes only empty directories in reviewed generated bundles. Use the same exclusive organizer lock. Do not force-remove files or follow reparse points.
- Save timestamped scan/apply/verification JSON under project work. Verify retained originals/finals, pending chunks and protected projects after deletion; distinguish logical deleted bytes from actual free-space change. Deleted render caches/chunks need a full rebuild before incremental patch/reassembly workflows can use them again; retain receipts and source.

```powershell
& "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\clean-deep-video.ps1" -ReportPath '<project>\work\deep-video-scan-<timestamp>.json'
& "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\clean-deep-video.ps1" -Apply -ReviewedManifest '<reviewed-scan.json>' -ReportPath '<project>\work\deep-video-apply-<timestamp>.json'
& "$env:USERPROFILE\.codex\skills\rainbow-clean\scripts\update-video-catalog.ps1" -ReportPath '<project>\work\video-catalog-<timestamp>.json'
```

The user selected one folder per topic with consistent `cover`, `output`, `source`, `assets`, `work`, `history` categories. Maintain this unified entry at `video_project/_catalog/<topic>/` using `update-video-catalog.ps1` and `build-video-catalog.py`. It points to existing physical directories, including archived versions, without duplicating assets or moving recent projects. `source/project` is the original full project entry. Empty categories are reserved for future content, not missing-file errors. Do not rewrite active render configurations merely to rename directories. Future new projects should use these category names directly; legacy projects keep working paths and progressively adopt the catalog. Skip `_catalog` during every cleanup traversal and never recursively clean through its junctions. Conflicting pre-existing paths are preserved and reported, not overwritten.

Recurring order: cache cleanup → reviewed publish organization → reviewed version/dependency organizer → reviewed deep render cleanup → reviewed historical MP4 cleanup → catalog/index update → verification report. No changes means no routine notification. Deep-clean regression fixtures are in `scripts/test-deep-video-clean.py`.

## Publish packages (authorized recurring scope)

For projects inactive more than **3 days**, physically **move** the latest confirmed final video, existing release copy and four cover ratios (16:9, 4:3, 3:4, 9:16) into `publish/{video,copy,cover}`. Preserve recent/running projects and existing keep rules. Multi-topic projects get separate topic packages; missing components or pending final versions are reported, never silently substituted. Preserve `publish` trees from all cleanup deletion. Add a publish entry to the standard catalog alongside cover/output/source/assets/work/history.

Read [references/publish.md](references/publish.md) for selection, shared-copy handling, reviewed JSON schema, actual-move script, path migration, repeat-run behavior and validation. Use `scripts/organize-publish.py`; a catalog junction alone does not satisfy the requested physical organization. Do not count moved bytes as reclaimed space.
