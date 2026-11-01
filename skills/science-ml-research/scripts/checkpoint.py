#!/usr/bin/env python3
"""Local, explicitly invoked research checkpoints. No scheduler or model calls."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import tempfile


SCHEMA_VERSION = 1
EVENT_THRESHOLD = 2
STATE_KEYS = {
    "schema_version", "created_at", "interval_minutes", "last_review_at",
    "next_review_at", "completed_total", "history",
}
HISTORY_KEYS = {"reviewed_at", "completed_total", "note_file", "note"}


class CheckpointError(Exception):
    """Expected input or state failure; no state update was committed."""


def _integer(value, name, minimum=0):
    if type(value) is not int or value < minimum:
        raise CheckpointError(f"{name} must be an integer >= {minimum}")
    return value


def _now(value=None):
    value = datetime.now(timezone.utc) if value is None else value
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise CheckpointError("now must be a timezone-aware datetime")
    return value.astimezone(timezone.utc).replace(microsecond=0)


def _stamp(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _time(value, name):
    if not isinstance(value, str) or not value.endswith("Z"):
        raise CheckpointError(f"{name} must be a UTC ISO 8601 timestamp ending in Z")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise CheckpointError(f"invalid timestamp: {name}") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0) or _stamp(parsed) != value:
        raise CheckpointError(f"{name} must use YYYY-MM-DDTHH:MM:SSZ")
    return parsed


def _deadline(at, interval):
    try:
        return at + timedelta(minutes=interval)
    except OverflowError as exc:
        raise CheckpointError("interval_minutes produces an out-of-range deadline") from exc


def validate_state(state):
    if not isinstance(state, dict) or set(state) != STATE_KEYS:
        raise CheckpointError("state has missing or unexpected fields")
    if type(state["schema_version"]) is not int or state["schema_version"] != SCHEMA_VERSION:
        raise CheckpointError("unsupported schema_version")
    interval = _integer(state["interval_minutes"], "interval_minutes", 1)
    _integer(state["completed_total"], "completed_total")
    created = _time(state["created_at"], "created_at")
    deadline = _time(state["next_review_at"], "next_review_at")
    history = state["history"]
    if not isinstance(history, list):
        raise CheckpointError("history must be a list")
    previous_time = created
    previous_count = 0
    for index, entry in enumerate(history):
        if not isinstance(entry, dict) or set(entry) != HISTORY_KEYS:
            raise CheckpointError(f"history[{index}] has missing or unexpected fields")
        at = _time(entry["reviewed_at"], f"history[{index}].reviewed_at")
        count = _integer(entry["completed_total"], f"history[{index}].completed_total")
        if at < previous_time or count < previous_count:
            raise CheckpointError("history times and completed totals must not go backwards")
        if not isinstance(entry["note"], str) or not entry["note"].strip():
            raise CheckpointError("history note must be nonempty text")
        if not isinstance(entry["note_file"], str) or not entry["note_file"].strip():
            raise CheckpointError("history note_file must be nonempty text")
        previous_time, previous_count = at, count
    if history:
        if state["last_review_at"] != history[-1]["reviewed_at"]:
            raise CheckpointError("last_review_at disagrees with history")
        if state["completed_total"] != history[-1]["completed_total"]:
            raise CheckpointError("completed_total disagrees with history")
    elif state["last_review_at"] is not None:
        raise CheckpointError("last_review_at must be null before the first review")
    if deadline != _deadline(previous_time, interval):
        raise CheckpointError("next_review_at disagrees with the last checkpoint and interval")
    return state


def _no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CheckpointError(f"duplicate JSON field: {key}")
        result[key] = value
    return result


def _load(path):
    try:
        raw = path.read_bytes()
    except FileNotFoundError as exc:
        raise CheckpointError(
            f"State does not exist: {path}. Run init --state <path> explicitly."
        ) from exc
    try:
        state = json.loads(raw.decode("utf-8"), object_pairs_hook=_no_duplicate_keys)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CheckpointError(f"Invalid UTF-8 JSON state; preserved unchanged: {path}") from exc
    return validate_state(state), raw


def _path(value):
    return Path(value).expanduser().absolute()


@contextmanager
def _writer_lock(path):
    if not path.parent.is_dir():
        raise CheckpointError(f"State parent directory does not exist: {path.parent}")
    lock = path.with_name(path.name + ".lock")
    try:
        fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise CheckpointError(
            f"Writer lock exists: {lock}. Verify no writer is active before removing a stale lock."
        ) from exc
    try:
        with os.fdopen(fd, "w", encoding="ascii") as stream:
            stream.write(str(os.getpid()) + "\n")
        yield
    finally:
        lock.unlink(missing_ok=True)


def _commit(path, state, expected=None):
    """Same-directory temp file; hard-link create or atomic replace after validation."""
    validate_state(state)
    payload = (json.dumps(state, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".checkpoint-", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        if expected is None:
            # A hard link atomically creates the destination and never overwrites it.
            # Unsupported filesystems fail explicitly; there is no unsafe fallback.
            try:
                os.link(temporary, path)
            except FileExistsError as exc:
                raise CheckpointError(f"State already exists; init will not overwrite: {path}") from exc
        else:
            if not path.exists() or path.read_bytes() != expected:
                raise CheckpointError("State changed during update; no overwrite performed")
            os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def init_checkpoint(state_path, interval_minutes=60, completed_total=0, *, now=None):
    path = _path(state_path)
    interval = _integer(interval_minutes, "interval_minutes", 1)
    count = _integer(completed_total, "completed_total")
    at = _now(now)
    state = {
        "schema_version": SCHEMA_VERSION,
        "created_at": _stamp(at),
        "interval_minutes": interval,
        "last_review_at": None,
        "next_review_at": _stamp(_deadline(at, interval)),
        "completed_total": count,
        "history": [],
    }
    with _writer_lock(path):
        if path.exists():
            raise CheckpointError(f"State already exists; init will not overwrite: {path}")
        _commit(path, state)
    return {"status": "initialized", "state": str(path), "next_review_at": state["next_review_at"], "completed_total": count}


def _progress(state, completed_total, at):
    count = _integer(completed_total, "completed_total")
    if count < state["completed_total"]:
        raise CheckpointError("completed_total cannot be lower than the saved checkpoint total")
    last = _time(state["last_review_at"] or state["created_at"], "last checkpoint time")
    if at < last:
        raise CheckpointError("Current time is earlier than the last checkpoint; check the system clock")
    return count, count - state["completed_total"]


def check_checkpoint(state_path, completed_total, *, now=None):
    path = _path(state_path)
    state, _ = _load(path)
    at = _now(now)
    count, events = _progress(state, completed_total, at)
    reasons = []
    if at >= _time(state["next_review_at"], "next_review_at"):
        reasons.append("interval_elapsed")
    if events >= EVENT_THRESHOLD:
        reasons.append("completed_events")
    return {
        "status": "checked", "state": str(path), "checked_at": _stamp(at),
        "due": bool(reasons), "reasons": reasons,
        "next_review_at": state["next_review_at"], "completed_total": count,
        "new_completed_events": events, "event_threshold": EVENT_THRESHOLD,
        "read_only": True,
    }


def record_checkpoint(state_path, note_file, completed_total, *, now=None):
    path, note_path = _path(state_path), _path(note_file)
    if note_path.resolve() == path.resolve():
        raise CheckpointError("note-file must be separate from the state file")
    try:
        note = note_path.read_text(encoding="utf-8-sig").strip()
    except (OSError, UnicodeDecodeError) as exc:
        raise CheckpointError(f"note-file must be an existing readable UTF-8 file: {note_path}") from exc
    if not note:
        raise CheckpointError("note-file must contain a nonempty review summary")
    at = _now(now)
    with _writer_lock(path):
        state, raw = _load(path)
        count, _ = _progress(state, completed_total, at)
        state["history"].append({
            "reviewed_at": _stamp(at), "completed_total": count,
            "note_file": str(note_path), "note": note,
        })
        state["last_review_at"] = _stamp(at)
        state["next_review_at"] = _stamp(_deadline(at, state["interval_minutes"]))
        state["completed_total"] = count
        _commit(path, state, expected=raw)
    return {
        "status": "recorded", "state": str(path), "reviewed_at": _stamp(at),
        "next_review_at": state["next_review_at"], "completed_total": count,
        "history_entries": len(state["history"]),
        "note_validation": "nonempty_utf8_only; reviewer must perform the actual review",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    initialize = sub.add_parser("init", help="Create a new state; never overwrite an existing file")
    initialize.add_argument("--state", required=True)
    initialize.add_argument("--interval-minutes", type=int, default=60)
    initialize.add_argument("--completed-total", type=int, default=0)
    check = sub.add_parser("check", help="Read-only due check; does not schedule or perform reviews")
    check.add_argument("--state", required=True)
    check.add_argument("--completed-total", type=int, required=True)
    record = sub.add_parser("record", help="Record a review already performed; requires a real summary file")
    record.add_argument("--state", required=True)
    record.add_argument("--note-file", required=True)
    record.add_argument("--completed-total", type=int, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            result = init_checkpoint(args.state, args.interval_minutes, args.completed_total)
        elif args.command == "check":
            result = check_checkpoint(args.state, args.completed_total)
        else:
            result = record_checkpoint(args.state, args.note_file, args.completed_total)
    except (CheckpointError, OSError, ValueError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=True), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
