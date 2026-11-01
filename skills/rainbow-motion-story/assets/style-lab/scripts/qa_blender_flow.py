"""Audit only the Blender flow study's existing assets; never render or rebake.

Default: inspect the library containing this script and write its
qa/blender-flow-assets.json. --installed-root inspects that copied library and
writes the report there. The intentionally unbundled reference video is then
reported as skipped, while all 50 source images must still pass their hashes.
Exit codes: 0 passed, 1 failed, 2 pending (for example presentation.video=null).
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SHA256 = re.compile(r"^[0-9a-f]{64}$", re.I)


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


class HTMLLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs
                          if key in {"href", "src", "poster"} and value)


class Audit:
    def __init__(self, root: Path, installed: bool):
        self.root = root
        self.installed = installed
        self.checks = []

    def add(self, name, status, **details):
        self.checks.append({"name": name, "status": status, **details})

    def verify(self, name, condition, **details):
        self.add(name, "passed" if condition else "failed", **details)

    def label(self, path):
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def load(self, relative):
        path = self.root / relative
        try:
            value = json.loads(path.read_text(encoding="utf-8-sig"))
            self.add(f"json:{relative}", "passed", sha256=digest(path))
            return value
        except (OSError, UnicodeError, ValueError) as error:
            self.add(f"json:{relative}", "failed", error=str(error))
            return None

    def local(self, value, base, within=None):
        if not isinstance(value, str) or not value:
            raise ValueError("Expected a non-empty local path")
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            raise ValueError("Expected a bundled local path, not an external URL")
        path_part = unquote(parsed.path)
        if not path_part:
            raise ValueError("Expected a file path")
        if Path(path_part).is_absolute() or path_part.startswith(('/', '\\')):
            raise ValueError("Expected a relative path inside the library")
        path = (base / path_part).resolve()
        boundary = (within or self.root).resolve()
        if not path.is_relative_to(boundary):
            raise ValueError("Path leaves the expected bundled directory")
        return path

    def file(self, name, value, base, expected_hash=None, within=None):
        try:
            path = self.local(value, base, within)
            if not path.is_file() or path.stat().st_size == 0:
                raise ValueError("Missing or empty asset: " + self.label(path))
            actual = digest(path)
            if expected_hash is not None:
                if not SHA256.fullmatch(str(expected_hash)):
                    raise ValueError("Missing or malformed expected SHA256")
                if actual != expected_hash.lower():
                    self.add(name, "failed", path=self.label(path),
                             expected_sha256=expected_hash, actual_sha256=actual)
                    return None
            self.add(name, "passed", path=self.label(path),
                     bytes=path.stat().st_size, sha256=actual)
            return path
        except (OSError, ValueError) as error:
            self.add(name, "failed", reference=value, error=str(error))
            return None


def source_evidence(audit):
    source = audit.load("evidence/blender-flow/source.json")
    manifest = audit.load("evidence/blender-flow/manifest.json")
    if not isinstance(source, dict) or not isinstance(manifest, dict):
        audit.add("source:schema", "failed", error="Source and manifest must be JSON objects")
        return
    frames = manifest.get("frames", [])
    valid_rows = isinstance(frames, list) and all(isinstance(row, dict) for row in frames)
    audit.verify("source:sample_count", valid_rows and len(frames) == 50 and
                 source.get("sampleCount") == 50,
                 expected=50, actual=len(frames) if isinstance(frames, list) else None)
    if not valid_rows:
        return
    audit.verify("source:frame_identity", manifest.get("sourceFrameCount") == source.get("videoFrames") == 200
                 and [row.get("sourceFrame") for row in frames] == list(range(0, 200, 4)),
                 expected_source_frames=200, expected_sampling_step=4)
    review_count = sum(row.get("reviewed") is True for row in frames)
    audit.verify("source:review_count_consistency", review_count == manifest.get("reviewedFrames")
                 == source.get("reviewedFrames"), counted=review_count,
                 note="Checks stored review records; does not perform visual review.")
    audit.verify("source:recorded_video_hash", bool(SHA256.fullmatch(str(source.get("sha256", "")))))
    try:
        source_path = audit.local(manifest.get("source"), audit.root)
        if audit.installed and not source_path.exists():
            audit.add("source:original_video", "skipped", path=audit.label(source_path),
                      reason="The installed library intentionally excludes work/ and the original reference video. Its bytes were not rechecked here.")
        else:
            checked = audit.file("source:original_video", manifest.get("source"), audit.root,
                                 expected_hash=source.get("sha256") or "")
            if checked:
                audit.verify("source:original_video_bytes", checked.stat().st_size == source.get("bytes"),
                             expected=source.get("bytes"), actual=checked.stat().st_size)
    except ValueError as error:
        audit.add("source:original_video", "failed", error=str(error))
    for index, row in enumerate(frames, 1):
        audit.file(f"source:image:{index:02d}", row.get("path"), audit.root,
                   expected_hash=row.get("sha256") or "")
        try:
            pts = Fraction(row["ptsUnits"]) * Fraction(row["timeBase"])
            good = pts == Fraction(row["ptsRational"]) == Fraction(row["sourceFrame"], 24)
            good = good and abs(float(pts) - float(row["ptsSeconds"])) < 1e-9
        except (KeyError, ValueError, TypeError, ZeroDivisionError):
            good = False
        audit.verify(f"source:pts:{index:02d}", good)
    sheets = manifest.get("sheets", [])
    audit.verify("source:contact_sheet_count", isinstance(sheets, list) and len(sheets) == 5)
    for index, sheet in enumerate(sheets if isinstance(sheets, list) else [], 1):
        audit.file(f"source:contact_sheet:{index}", sheet, audit.root)


def official_evidence(audit):
    rows = audit.load("evidence/blender-technical/sources.json")
    if not isinstance(rows, list):
        audit.add("official:schema", "failed", error="Expected a list of official sources")
        return
    audit.verify("official:count", len(rows) == 24, expected=24, actual=len(rows))
    audit.verify("official:unique_ids", len({row.get("id") for row in rows if isinstance(row, dict)}) == len(rows))
    base = audit.root / "evidence/blender-technical"
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            audit.add(f"official:{index}:schema", "failed")
            continue
        name = row.get("id", str(index))
        urls = [urlsplit(str(row.get(key, ""))) for key in ("requested_url", "final_url")]
        audit.verify(f"official:{name}:provenance", row.get("status") == 200 and
                     all(url.scheme == "https" and url.hostname in {"docs.blender.org", "developer.blender.org"} for url in urls),
                     retrieved_at_utc=row.get("retrieved_at_utc"),
                     final_url=row.get("final_url"), recorded_http_status=row.get("status"))
        audit.file(f"official:{name}:html", row.get("html"), base,
                   expected_hash=row.get("sha256") or "", within=base)
        audit.file(f"official:{name}:text", row.get("text"), base, within=base)


def referenced_links(audit):
    required = ["lab/blender-flow.html", "studies/blender-flow.md",
                "guides/blender-model-motion.md", "examples/blender-flow/API.md"]
    checked_targets = set()
    external = 0
    for relative in required:
        path = audit.file("document:" + relative, relative, audit.root)
        if path is None:
            continue
        text = path.read_text(encoding="utf-8-sig")
        if path.suffix == ".html":
            parser = HTMLLinks()
            parser.feed(text)
            links = parser.links
        else:
            text = re.sub(r"(?ms)^\s*```.*?^\s*```\s*$", "", text)
            links = [a or b for a, b in re.findall(r"!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)", text)]
        for link in links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                external += 1
                continue
            if not url.path:
                continue
            key = (relative, link)
            if key in checked_targets:
                continue
            checked_targets.add(key)
            audit.file(f"link:{relative}:{link}", link, path.parent)
    audit.add("links:scope", "passed", local_targets_checked=len(checked_targets),
              external_links_not_requested=external,
              note="Checks referenced local file targets only; no external HTTP or DOM anchor verification and no old-module tests.")


def presentation_assets(audit):
    manifest = audit.load("examples/blender-flow/presentation.json")
    if not isinstance(manifest, dict):
        audit.add("presentation:schema", "failed", error="Expected a presentation object")
        return None, None
    base = audit.root / "examples/blender-flow"
    frames = manifest.get("frames", [])
    valid = isinstance(frames, list) and bool(frames) and all(isinstance(row, dict) for row in frames)
    audit.verify("presentation:frames", valid, count=len(frames) if isinstance(frames, list) else None)
    if valid:
        default = manifest.get("defaultFrame", 0)
        audit.verify("presentation:default_frame", isinstance(default, int) and 0 <= default < len(frames), index=default)
        for index, frame in enumerate(frames):
            audit.file(f"presentation:frame:{index}", frame.get("src"), base, within=base)
    scene = manifest.get("scene", {})
    audit.file("presentation:scene", scene.get("src") if isinstance(scene, dict) else None, base, within=base)
    video = manifest.get("video")
    if video is None:
        audit.add("presentation:video", "pending", reason="presentation.video is null or absent; no final video has been declared.")
        return None, None
    if not isinstance(video, dict):
        audit.add("presentation:video", "failed", error="Expected a video object or null")
        return None, None
    path = audit.file("presentation:video", video.get("src"), base, within=base)
    if video.get("poster"):
        audit.file("presentation:video_poster", video["poster"], base, within=base)
    return path, video


def find_media_tool(name):
    found = shutil.which(name)
    fallback = Path("C:/ffmpeg/bin") / (name + ".exe")
    return found or (str(fallback) if fallback.is_file() else None)


def verify_video(audit, path, expected):
    if path is None:
        return
    audit.verify("video:mp4_extension", path.suffix.lower() == ".mp4")
    ffprobe, ffmpeg = find_media_tool("ffprobe"), find_media_tool("ffmpeg")
    if not ffprobe or not ffmpeg:
        audit.add("video:tools", "pending", ffprobe=ffprobe, ffmpeg=ffmpeg,
                  reason="Both FFprobe and FFmpeg are required; no decode was claimed.")
        return
    audit.add("video:tools", "passed", ffprobe=ffprobe, ffmpeg=ffmpeg)
    command = [ffprobe, "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", str(path)]
    try:
        probe = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        if probe.returncode != 0:
            raise ValueError(probe.stderr.strip() or f"FFprobe returned {probe.returncode}")
        metadata = json.loads(probe.stdout)
        video = next((stream for stream in metadata.get("streams", []) if stream.get("codec_type") == "video"), None)
        if video is None:
            raise ValueError("No video stream")
        frame_count = int(video.get("nb_read_frames", "0"))
        fps = float(Fraction(video.get("avg_frame_rate", "0/1")))
        duration = float(video.get("duration") or metadata.get("format", {}).get("duration", 0))
        audit.verify("video:probe", frame_count > 0 and fps > 0 and duration > 0 and
                     video.get("width", 0) > 0 and video.get("height", 0) > 0,
                     frame_count=frame_count, fps=fps, duration_seconds=duration,
                     width=video.get("width"), height=video.get("height"),
                     codec=video.get("codec_name"), pixel_format=video.get("pix_fmt"),
                     audio_stream_count=sum(stream.get("codec_type") == "audio" for stream in metadata.get("streams", [])),
                     metadata=metadata)
        if expected.get("fps") is not None:
            audit.verify("video:declared_fps", abs(fps - float(Fraction(str(expected["fps"])))) < .001,
                         expected=expected["fps"], actual=fps)
        if expected.get("durationSeconds") is not None:
            audit.verify("video:declared_duration", abs(duration - float(expected["durationSeconds"])) <= max(.05, 1 / fps),
                         expected=expected["durationSeconds"], actual=duration)
        if expected.get("frameCount") is not None:
            audit.verify("video:declared_frame_count", frame_count == expected["frameCount"],
                         expected=expected["frameCount"], actual=frame_count)
    except (OSError, ValueError, TypeError, ZeroDivisionError, subprocess.TimeoutExpired) as error:
        audit.add("video:probe", "failed", error=str(error))
    # Decode every video frame and any present audio stream. No seek, duration
    # limit, image export, Blender launch, or re-encoding occurs here.
    command = [ffmpeg, "-hide_banner", "-v", "error", "-xerror", "-err_detect", "explode", "-i", str(path),
               "-map", "0:v:0", "-map", "0:a?", "-f", "null", "-"]
    try:
        decoded = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        audit.verify("video:full_decode", decoded.returncode == 0 and not decoded.stderr.strip(),
                     return_code=decoded.returncode, stderr=decoded.stderr[-12000:],
                     command=command, note="Complete technical decode only; no subjective playback or audio listening.")
    except (OSError, subprocess.TimeoutExpired) as error:
        audit.add("video:full_decode", "failed", error=str(error))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installed-root", type=Path, help="Inspect a copied library; work/ reference video is intentionally optional there")
    options = parser.parse_args()
    root = options.installed_root.resolve() if options.installed_root else ROOT
    if not root.is_dir():
        parser.error("The target library directory does not exist: " + str(root))
    audit = Audit(root, installed=options.installed_root is not None)
    source_evidence(audit)
    official_evidence(audit)
    referenced_links(audit)
    video_path, video_record = presentation_assets(audit)
    verify_video(audit, video_path, video_record)
    counts = Counter(check["status"] for check in audit.checks)
    status = "failed" if counts["failed"] else "pending" if counts["pending"] else "passed"
    report = {
        "schemaVersion": 1,
        "checkedAtUtc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "installedRoot": options.installed_root is not None,
        "status": status,
        "counts": dict(counts),
        "scope": "Blender flow study only: source records and 50 image hashes; 24 official snapshots; presentation assets; first-level local links from page/study/guide/API; final MP4 probe and complete decode.",
        "limits": "No Blender rendering or rebaking, no original-source continuous viewing or audio listening, no subjective image/video QA, no old-module tests. File/hash/decode success does not establish visual quality or physical accuracy.",
        "checks": audit.checks,
    }
    output = root / "qa/blender-flow-assets.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "counts": dict(counts), "report": str(output)}, ensure_ascii=False))
    return {"passed": 0, "failed": 1, "pending": 2}[status]


if __name__ == "__main__":
    raise SystemExit(main())
