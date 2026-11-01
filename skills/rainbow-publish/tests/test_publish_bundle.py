import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).parents[1] / "scripts" / "publish_bundle.py"
spec = importlib.util.spec_from_file_location("publish_bundle", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "video.mp4").write_bytes(b"a local video fixture")
        (self.root / "cover.jpg").write_bytes(b"a local cover fixture")
        self.probe = patch.object(mod, "probe_video", return_value={"status": "unavailable"})
        self.probe.start()

    def tearDown(self):
        self.probe.stop()
        self.tmp.cleanup()

    def config(self, **extra):
        data = {"title": "科学与工程", "description": "来源文案。", "tags": ["科普"]}
        data.update(extra)
        (self.root / "publish.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8-sig")

    def test_bom_and_platform_override_inheritance(self):
        self.config(platforms={"douyin": {"title": "短标题", "body": "抖音正文", "tags": []}})
        result = mod.prepare(self.root)
        self.assertEqual(result["status"], "ready_for_review")
        self.assertEqual(result["platforms"]["douyin"]["fields"]["description"], "抖音正文")
        self.assertEqual(result["platforms"]["douyin"]["fields"]["tags"], [])
        self.assertEqual(result["platforms"]["wechat"]["fields"]["title"], "科学与工程")
        self.assertFalse(result["published"])

    def test_ambiguous_video_is_not_picked_by_time(self):
        self.config()
        (self.root / "final-new.mp4").write_bytes(b"new")
        result = mod.prepare(self.root)
        self.assertEqual(result["status"], "needs_input")
        self.assertTrue(all(p["video"] is None for p in result["platforms"].values()))
        self.assertIn("ambiguous_video", {i["code"] for i in result["issues"]})

    def test_manifest_asset_cannot_escape(self):
        outside = self.root.parent / (self.root.name + "-outside.mp4")
        outside.write_bytes(b"outside")
        try:
            self.config(video=str(outside))
            result = mod.prepare(self.root)
            self.assertEqual(result["status"], "needs_input")
            self.assertTrue(all(p["video"] is None for p in result["platforms"].values()))
        finally:
            outside.unlink()

    def test_manifest_itself_cannot_escape(self):
        outside = self.root.parent / (self.root.name + "-outside.json")
        outside.write_text("{}")
        try:
            with self.assertRaises(mod.BundleError):
                mod.prepare(self.root, str(outside))
        finally:
            outside.unlink()

    def test_linked_directories_are_not_scanned(self):
        with tempfile.TemporaryDirectory() as outside:
            (Path(outside) / "outside.mp4").write_bytes(b"outside")
            try:
                os.symlink(outside, self.root / "linked", target_is_directory=True)
            except OSError:
                self.skipTest("Symlink creation is not available to this test process")
            self.config()
            result = mod.prepare(self.root)
            self.assertEqual(result["status"], "ready_for_review")
            self.assertIn("linked", result["skipped_links"])
            self.config(video="linked/outside.mp4")
            self.assertEqual(mod.prepare(self.root)["status"], "needs_input")

    def test_empty_asset_is_not_ready(self):
        self.config()
        (self.root / "video.mp4").write_bytes(b"")
        result = mod.prepare(self.root)
        self.assertIn("invalid_video", {i["code"] for i in result["issues"]})

    def test_source_publish_platform_json(self):
        source = self.root / "source" / "publish"
        source.mkdir(parents=True)
        for platform in mod.PLATFORMS:
            (source / (platform + ".json")).write_text(json.dumps({"title": platform, "body": "正文", "tags": ["知识"]}))
        result = mod.prepare(self.root)
        self.assertEqual(result["status"], "ready_for_review")
        self.assertEqual(result["platforms"]["bilibili"]["fields"]["description"], "正文")

    def test_plain_copy_is_returned_for_agent_extraction(self):
        (self.root / "发布文案.md").write_text("# 标题\n正文", encoding="utf-8")
        result = mod.prepare(self.root)
        self.assertEqual(result["status"], "needs_input")
        self.assertEqual(len(result["copy_sources"]), 1)
        self.assertEqual(result["copy_sources"][0]["text"], "# 标题\n正文")

    def test_skips_work_and_old_runs_and_preserves_sources(self):
        self.config()
        work = self.root / "work"
        work.mkdir()
        (work / "another.mp4").write_bytes(b"not selected")
        first = mod.prepare(self.root)
        second = mod.prepare(self.root)
        self.assertEqual(first["status"], "ready_for_review")
        self.assertEqual(second["status"], "ready_for_review")
        self.assertNotEqual(first["bundle_path"], second["bundle_path"])
        with self.assertRaises(mod.BundleError):
            mod.prepare(self.root, output=Path(first["bundle_path"]).parent)

    def test_legacy_manifest_not_treated_as_authorization(self):
        (self.root / "publish-manifest.json").write_text(json.dumps({"files": [{"role": "video", "destination": "video.mp4", "state": "organized"}]}))
        result = mod.prepare(self.root)
        self.assertEqual(result["candidates"]["legacy_manifests"], ["publish-manifest.json"])
        self.assertFalse(result["published"])
        with self.assertRaises(mod.BundleError):
            mod.prepare(self.root, manifest="publish-manifest.json")

    def test_verify_detects_asset_and_copy_changes(self):
        (self.root / "文案.md").write_text("说明正文", encoding="utf-8")
        self.config(copy="文案.md")
        result = mod.prepare(self.root)
        self.assertEqual(mod.verify(result["bundle_path"])["status"], "verified")
        (self.root / "文案.md").write_text("已修改正文", encoding="utf-8")
        verified = mod.verify(result["bundle_path"], "wechat")
        self.assertEqual(verified["status"], "needs_input")
        self.assertTrue(any("copy changed" in e for e in verified["errors"]))
        (self.root / "cover.jpg").write_bytes(b"new cover")
        self.assertTrue(any("cover changed" in e for e in mod.verify(result["bundle_path"])["errors"]))

    def test_claim_checks_bundle_sha_and_only_selected_platform(self):
        self.config(platforms={"douyin": {"video": "missing.mp4"}})
        result = mod.prepare(self.root)
        self.assertEqual(result["status"], "needs_input")
        evidence = {"text": "已核对账号与稿件", "url": "https://member.bilibili.com/"}
        sha = result["platforms"]["bilibili"]["video"]["sha256"]
        ledger = self.root / "ledger.json"
        with self.assertRaises(mod.BundleError):
            mod.claim(ledger, "bilibili", "uid:123", "a" * 64, evidence, result["bundle_path"])
        entry = mod.claim(ledger, "bilibili", "uid:123", sha, evidence, result["bundle_path"])
        self.assertEqual(entry["status"], "submitting")

    def test_different_folders_same_video_share_ledger_key(self):
        self.config(video="video.mp4", cover="cover.jpg")
        first = mod.prepare(self.root)
        other = self.root / "other"
        other.mkdir()
        for name in ("publish.json", "video.mp4", "cover.jpg"):
            (other / name).write_bytes((self.root / name).read_bytes())
        second = mod.prepare(other)
        sha = first["platforms"]["bilibili"]["video"]["sha256"]
        evidence = {"text": "已核对账号与稿件", "url": "https://member.bilibili.com/"}
        ledger = self.root / "local-ledger.json"
        mod.claim(ledger, "bilibili", "uid:123", sha, evidence, first["bundle_path"])
        with self.assertRaises(mod.BundleError):
            mod.claim(ledger, "bilibili", "uid:123", sha, evidence, second["bundle_path"])


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ledger = Path(self.tmp.name) / "ledger.json"
        self.sha = "b" * 64
        self.evidence = {"text": "账号 ID 123，上传和发布信息已核对", "url": "https://member.bilibili.com/platform/upload/video/frame"}

    def tearDown(self):
        self.tmp.cleanup()

    def claim(self, **kwargs):
        return mod.claim(self.ledger, "bilibili", kwargs.pop("account", "123"), self.sha,
                         self.evidence, **kwargs)

    def record(self, entry, state, evidence=None):
        return mod.record(self.ledger, "bilibili", "123", self.sha, state,
                          evidence or self.evidence, entry["attempt_token"])

    def test_same_video_different_folder_is_blocked(self):
        self.claim()
        with self.assertRaises(mod.BundleError):
            self.claim()
        self.assertEqual(len(mod.ledger_status(self.ledger)["entries"]), 1)

    def test_different_account_is_distinct(self):
        self.claim()
        self.claim(account="456")
        self.assertEqual(len(mod.ledger_status(self.ledger)["entries"]), 2)

    def test_unknown_requires_observed_absence_before_retry(self):
        entry = self.claim()
        self.record(entry, "submission_unknown")
        with self.assertRaises(mod.BundleError):
            self.claim()
        with self.assertRaises(mod.BundleError):
            self.record(entry, "confirmed_absent")
        self.record(entry, "confirmed_absent", {**self.evidence, "checked_no_existing_item": True})
        next_entry = self.claim()
        self.assertNotEqual(next_entry["attempt_token"], entry["attempt_token"])
        with self.assertRaises(mod.BundleError):
            self.record(entry, "published")

    def test_published_never_downgrades_or_resubmits(self):
        entry = self.claim()
        self.record(entry, "submitted")
        self.record(entry, "reviewing")
        self.record(entry, "published")
        for state in ("submission_unknown", "failed", "confirmed_absent", "reviewing"):
            with self.assertRaises(mod.BundleError):
                self.record(entry, state, {**self.evidence, "checked_no_existing_item": True})
        with self.assertRaises(mod.BundleError):
            self.claim()

    def test_evidence_and_account_are_required(self):
        with self.assertRaises(mod.BundleError):
            mod.claim(self.ledger, "bilibili", "123", self.sha, {"text": "clicked"})
        with self.assertRaises(mod.BundleError):
            self.claim(account="unknown")
        with self.assertRaises(mod.BundleError):
            mod.claim(self.ledger, "bilibili", "123", self.sha, {"text": "claimed", "url": "https://evil.example/video"})
        with self.assertRaises(mod.BundleError):
            mod.claim(self.ledger, "bilibili", "123", self.sha, {"text": "claimed", "url": "https://creator.douyin.com/"})

    def test_scheduled_cannot_be_submitted_again(self):
        entry = self.claim()
        self.record(entry, "submitted")
        self.record(entry, "scheduled")
        with self.assertRaises(mod.BundleError):
            self.claim()
        self.record(entry, "published")

    def test_collection_resume_does_not_republish(self):
        entry = self.claim()
        self.record(entry, "published")
        result = mod.collection_record(self.ledger, "bilibili", "123", self.sha, "pending",
                                       "每天5分钟知识", self.evidence, entry["attempt_token"])
        self.assertEqual(result["status"], "published")
        result = mod.collection_record(self.ledger, "bilibili", "123", self.sha, "verified",
                                       "每天5分钟知识", self.evidence, entry["attempt_token"])
        self.assertEqual(result["collection"]["status"], "verified")
        self.assertEqual(result["status"], "published")
        with self.assertRaises(mod.BundleError):
            self.claim()
        with self.assertRaises(mod.BundleError):
            mod.collection_record(self.ledger, "bilibili", "123", self.sha, "pending",
                                  "每天5分钟知识", self.evidence, entry["attempt_token"])
        with self.assertRaises(mod.BundleError):
            mod.collection_record(self.ledger, "bilibili", "123", self.sha, "pending",
                                  " 每天5分钟知识 ", self.evidence, entry["attempt_token"])

    def test_damaged_entries_do_not_allow_republishing(self):
        entry = self.claim()
        original = mod.read_json(self.ledger)
        for bad in (None, {}, {"status": "published"}):
            data = {**original, "entries": {entry["key"]: bad}}
            mod.atomic_json(self.ledger, data)
            with self.assertRaises(mod.BundleError):
                self.claim()

    def test_concurrent_claims_only_allow_one_attempt(self):
        evidence_path = Path(self.tmp.name) / "evidence.json"
        mod.atomic_json(evidence_path, self.evidence)
        command = [sys.executable, str(SOURCE), "claim", "--ledger", str(self.ledger),
                   "--platform", "bilibili", "--account-id", "123", "--sha256", self.sha,
                   "--evidence", str(evidence_path)]
        first = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        second = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        first.communicate(timeout=20)
        second.communicate(timeout=20)
        self.assertEqual(sorted([first.returncode, second.returncode]), [0, 1])
        self.assertEqual(len(mod.ledger_status(self.ledger)["entries"]), 1)


if __name__ == "__main__":
    unittest.main()
