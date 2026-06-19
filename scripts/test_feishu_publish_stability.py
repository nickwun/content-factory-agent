import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path


SKILL_SCRIPT_DIR = Path("/Users/hui/.codex/skills/content-factory-agent/scripts")


def load_skill_module(name: str):
    path = SKILL_SCRIPT_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def make_temp_root(name: str) -> Path:
    return Path(tempfile.mkdtemp(prefix=f"feishu-stability-{name}-"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_publish_output(root: Path, slug: str = "article", *, feishu: dict | None = None) -> Path:
    output_dir = root / slug
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "images").mkdir(exist_ok=True)
    (output_dir / "article.md").write_text("# Article\n\nBody\n", encoding="utf-8")
    (output_dir / "titles.md").write_text("# 标题候选\n", encoding="utf-8")
    (output_dir / "feishu-publish.md").write_text("# Feishu Article\n\nBody\n", encoding="utf-8")
    (output_dir / "images" / "cover.png").write_bytes(b"fake-png")
    write_json(
        output_dir / "metadata.json",
        {
            "title": "Feishu Stability Test",
            "quality": {"status": "ready_for_edit"},
            "titles": {"recommended": {"primary": "Feishu Stability Test"}},
            "publish": {"feishu": feishu or {"status": "prepared"}},
        },
    )
    return output_dir


def batch_args(root: Path, **overrides):
    values = {
        "root": root,
        "output_dir": None,
        "limit": 5,
        "run_id": "run-1",
        "lock_path": root / ".codex_locks" / "feishu_publish.lock",
        "dry_run": True,
        "allow_permission_skip": False,
        "owner_email": "",
        "owner_user_id": "",
        "owner_open_id": "",
        "owner_union_id": "",
        "builder": root / "unused-builder.py",
        "publisher": root / "unused-publisher.py",
        "cli": root / "unused-cli",
        "settings_db": root / "missing.sqlite",
        "single_timeout": 0.5,
    }
    values.update(overrides)
    return types.SimpleNamespace(**values)


def write_fake_feishu_cli(root: Path) -> Path:
    cli = root / "fake-feishu-cli.py"
    cli.write_text(
        """#!/usr/bin/env python3
import json
import os
import sys
import time

args = sys.argv[1:]
log = os.environ.get("FAKE_CLI_LOG")
if log:
    with open(log, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(args, ensure_ascii=False) + "\\n")

mode = os.environ.get("FAKE_CLI_MODE", "success")

if args[:2] == ["doc", "import"]:
    if mode == "timeout_import":
        started = os.environ.get("FAKE_STARTED")
        completed = os.environ.get("FAKE_COMPLETED")
        if started:
            open(started, "w", encoding="utf-8").write("started")
        time.sleep(10)
        if completed:
            open(completed, "w", encoding="utf-8").write("completed")
    elif mode == "large_stdout":
        print('{"document_id":"doccnBIG","image_success":1,"image_total":1}')
        print("BIGSTDOUT-" + ("X" * 10000))
    else:
        print(json.dumps({"document_id": "doccn123", "image_success": 1, "image_total": 1}))
        print("https://example.feishu.cn/docx/doccn123", file=sys.stderr)
    sys.exit(0)

if args[:2] == ["perm", "add"]:
    print(json.dumps({"ok": True}))
    sys.exit(0)

if args[:2] == ["doc", "blocks"]:
    if mode == "blocks_timeout":
        time.sleep(10)
    blocks = [
        {"block_id": "b1", "text": {"elements": []}},
        {"block_id": "b2", "image": {"width": 1200, "height": 900}, "bigField": "Y" * 10000},
    ]
    print(json.dumps({"data": {"items": blocks}}, ensure_ascii=False))
    sys.exit(0)

print("unexpected fake feishu-cli args: " + json.dumps(args), file=sys.stderr)
sys.exit(2)
""",
        encoding="utf-8",
    )
    cli.chmod(0o755)
    return cli


def write_fake_publisher(root: Path) -> Path:
    publisher = root / "fake-publisher.py"
    publisher.write_text(
        """#!/usr/bin/env python3
import os
import time

with open(os.environ["FAKE_PUBLISHER_LOG"], "a", encoding="utf-8") as fh:
    fh.write("called\\n")
time.sleep(10)
""",
        encoding="utf-8",
    )
    publisher.chmod(0o755)
    return publisher


def with_fake_feishu_env(**updates):
    old_env = os.environ.copy()
    os.environ.update(
        {
            "FEISHU_APP_ID": "fake-app-id",
            "FEISHU_APP_SECRET": "fake-app-secret",
            **{key: str(value) for key, value in updates.items()},
        }
    )
    return old_env


def restore_env(old_env: dict[str, str]) -> None:
    os.environ.clear()
    os.environ.update(old_env)


class FeishuPublishStabilityTests(unittest.TestCase):
    def test_logged_command_timeout_returns_structured_result_and_writes_logs(self):
        module = load_skill_module("publish_to_feishu_cli")

        root = make_temp_root("logged-timeout")
        result = module.run_logged_command(
            [
                "python3",
                "-c",
                "import time; print('before sleep'); time.sleep(2)",
            ],
            label="slow-command",
            timeout_seconds=0.05,
            logs_dir=root,
        )

        self.assertTrue(result.timed_out)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("timed out after 0.05s", result.error)
        self.assertTrue(Path(result.stdout_log_path).is_file())
        self.assertTrue(Path(result.stderr_log_path).is_file())

    def test_publish_lock_blocks_fresh_lock_and_preserves_file(self):
        module = load_skill_module("publish_feishu_batch")

        root = make_temp_root("fresh-lock")
        lock_path = root / ".codex_locks" / "feishu_publish.lock"
        lock_path.parent.mkdir(parents=True)
        lock_path.write_text(
            json.dumps(
                {
                    "pid": 123,
                    "started_at": module.utc_now(),
                    "task_name": "existing",
                    "current_article": "article-a",
                    "current_step": "publish",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        with self.assertRaises(module.FeishuBatchError) as ctx:
            module.acquire_publish_lock(lock_path, "new-task")

        self.assertIn("active Feishu publish lock", str(ctx.exception))
        self.assertTrue(lock_path.exists())

    def test_publish_lock_reports_stale_lock_without_deleting_it(self):
        module = load_skill_module("publish_feishu_batch")

        root = make_temp_root("stale-lock")
        lock_path = root / ".codex_locks" / "feishu_publish.lock"
        lock_path.parent.mkdir(parents=True)
        lock_path.write_text(
            json.dumps(
                {
                    "pid": 123,
                    "started_at": "2000-01-01T00:00:00Z",
                    "task_name": "old-task",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        with self.assertRaises(module.FeishuBatchError) as ctx:
            module.acquire_publish_lock(lock_path, "new-task")

        self.assertIn("stale Feishu publish lock", str(ctx.exception))
        self.assertTrue(lock_path.exists())

    def test_run_state_records_recoverable_article_status(self):
        module = load_skill_module("publish_feishu_batch")

        root = make_temp_root("run-state")
        state_path = root / "batch-runs" / "run-1" / "run_state.json"
        state = module.load_run_state(state_path, "run-1")
        module.update_article_state(
            state,
            state_path,
            "article-slug",
            current_stage="publish_cli",
            doc_token="doccn123",
            doc_imported=True,
            cover_uploaded=True,
        )

        payload = json.loads(state_path.read_text(encoding="utf-8"))
        article = payload["articles"]["article-slug"]
        self.assertEqual(article["current_stage"], "publish_cli")
        self.assertEqual(article["doc_token"], "doccn123")
        self.assertTrue(article["doc_imported"])
        self.assertTrue(article["cover_uploaded"])
        self.assertFalse(article["published"])

    def test_single_publish_preflight_blocks_required_remote_check(self):
        module = load_skill_module("publish_to_feishu_cli")

        root = make_temp_root("single-block")
        output_dir = write_publish_output(
            root,
            feishu={
                "status": "prepared",
                "requiresRemoteCheck": True,
            },
        )
        cli = root / "feishu-cli"
        cli.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        cli.chmod(0o755)

        with self.assertRaises(module.FeishuPublishError) as ctx:
            module.preflight(output_dir, cli, force=False)

        self.assertIn("requiresRemoteCheck", str(ctx.exception))

    def test_batch_publish_blocks_article_requiring_remote_check(self):
        module = load_skill_module("publish_feishu_batch")

        root = make_temp_root("batch-block")
        output_dir = write_publish_output(root)
        state_path = root / "batch-runs" / "run-1" / "run_state.json"
        state = module.load_run_state(state_path, "run-1")
        module.update_article_state(
            state,
            state_path,
            output_dir.name,
            current_stage="failed",
            requires_remote_check=True,
        )

        result = module.publish_one(
            output_dir,
            types.SimpleNamespace(dry_run=False),
            {},
            state=state,
            state_path=state_path,
            logs_dir=root / "batch-runs" / "run-1" / "logs",
            lock_path=root / ".codex_locks" / "feishu_publish.lock",
        )

        self.assertEqual(result["status"], "blocked_remote_check")
        self.assertEqual(result["buildStatus"], "not_run")
        payload = json.loads(state_path.read_text(encoding="utf-8"))
        article = payload["articles"][output_dir.name]
        self.assertEqual(article["current_stage"], "blocked_remote_check")
        self.assertTrue(article["requires_remote_check"])

    def test_fake_doc_import_timeout_writes_report_metadata_and_kills_process(self):
        module = load_skill_module("publish_to_feishu_cli")
        root = make_temp_root("doc-import-timeout")
        output_dir = write_publish_output(root)
        cli = write_fake_feishu_cli(root)
        old_timeout = module.IMPORT_TIMEOUT_SECONDS
        module.IMPORT_TIMEOUT_SECONDS = 0.5
        old_env = with_fake_feishu_env(
            FAKE_CLI_MODE="timeout_import",
            FAKE_CLI_LOG=root / "fake-cli-calls.log",
            FAKE_STARTED=root / "fake-cli-started.txt",
            FAKE_COMPLETED=root / "fake-cli-completed.txt",
        )
        try:
            with self.assertRaises(module.FeishuPublishError):
                module.publish_to_feishu(
                    output_dir,
                    cli=cli,
                    settings_db=root / "missing.sqlite",
                    force=False,
                    permission_args=types.SimpleNamespace(
                        owner_email="",
                        owner_user_id="",
                        owner_open_id="",
                        owner_union_id="",
                        check_blocks=False,
                        blocks_max_bytes=module.COMMAND_MAX_OUTPUT_BYTES,
                    ),
                )
        finally:
            restore_env(old_env)
            module.IMPORT_TIMEOUT_SECONDS = old_timeout

        metadata = json.loads((output_dir / "metadata.json").read_text(encoding="utf-8"))
        feishu = metadata["publish"]["feishu"]
        report = (output_dir / "publish-report.md").read_text(encoding="utf-8")
        self.assertEqual(feishu["status"], "failed")
        self.assertTrue(feishu["requiresRemoteCheck"])
        self.assertIn("timed out", feishu["error"])
        self.assertIn("timed out", report)
        self.assertTrue((root / "fake-cli-started.txt").is_file())
        self.assertFalse((root / "fake-cli-completed.txt").exists())

    def test_batch_timeout_sets_run_state_and_repeat_start_blocks_side_effects(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-timeout-repeat")
        output_dir = write_publish_output(root)
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        state_path = root / "batch-runs" / "run-1" / "run_state.json"
        state = module.load_run_state(state_path, "run-1")
        args = types.SimpleNamespace(
            dry_run=False,
            builder=root / "unused-builder.py",
            publisher=publisher,
            cli=root / "unused-cli",
            settings_db=root / "missing.sqlite",
            single_timeout=0.5,
            owner_email="",
            owner_user_id="",
            owner_open_id="",
            owner_union_id="",
        )
        try:
            first = module.publish_one(
                output_dir,
                args,
                os.environ.copy(),
                state=state,
                state_path=state_path,
                logs_dir=root / "batch-runs" / "run-1" / "logs",
                lock_path=root / ".codex_locks" / "feishu_publish.lock",
            )
            second = module.publish_one(
                output_dir,
                args,
                os.environ.copy(),
                state=state,
                state_path=state_path,
                logs_dir=root / "batch-runs" / "run-1" / "logs",
                lock_path=root / ".codex_locks" / "feishu_publish.lock",
            )
        finally:
            restore_env(old_env)

        payload = json.loads(state_path.read_text(encoding="utf-8"))
        article = payload["articles"][output_dir.name]
        self.assertEqual(first["status"], "failed")
        self.assertEqual(second["status"], "blocked_remote_check")
        self.assertTrue(article["requires_remote_check"])
        self.assertIn("remote state check required", article["last_error"])
        self.assertEqual(publisher_log.read_text(encoding="utf-8").count("called"), 1)

    def test_batch_dry_run_lock_paths_without_real_release_unlink(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-lock-dry-run")
        args = types.SimpleNamespace(
            root=root,
            limit=5,
            run_id="run-1",
            lock_path=root / ".codex_locks" / "feishu_publish.lock",
            dry_run=True,
            allow_permission_skip=False,
            owner_email="",
            owner_user_id="",
            owner_open_id="",
            owner_union_id="",
            builder=root / "unused-builder.py",
            publisher=root / "unused-publisher.py",
            cli=root / "unused-cli",
            settings_db=root / "missing.sqlite",
            single_timeout=0.5,
        )

        active_lock = args.lock_path
        active_lock.parent.mkdir(parents=True)
        write_json(
            active_lock,
            {
                "pid": 123,
                "started_at": module.utc_now(),
                "task_name": "active",
                "current_article": "article",
                "current_step": "publish",
            },
        )
        with self.assertRaises(module.FeishuBatchError) as active_ctx:
            module.publish_batch(args)
        self.assertIn("active Feishu publish lock", str(active_ctx.exception))
        self.assertTrue(active_lock.exists())

        stale_root = make_temp_root("batch-stale-lock-dry-run")
        stale_args = types.SimpleNamespace(**{**args.__dict__, "root": stale_root, "lock_path": stale_root / ".codex_locks" / "feishu_publish.lock"})
        stale_args.lock_path.parent.mkdir(parents=True)
        write_json(
            stale_args.lock_path,
            {
                "pid": 123,
                "started_at": "2000-01-01T00:00:00Z",
                "task_name": "stale",
            },
        )
        with self.assertRaises(module.FeishuBatchError) as stale_ctx:
            module.publish_batch(stale_args)
        self.assertIn("stale Feishu publish lock", str(stale_ctx.exception))
        self.assertTrue(stale_args.lock_path.exists())

        normal_root = make_temp_root("batch-normal-dry-run")
        normal_args = types.SimpleNamespace(**{**args.__dict__, "root": normal_root, "lock_path": normal_root / ".codex_locks" / "feishu_publish.lock"})
        released: list[str] = []
        original_release = module.release_publish_lock
        module.release_publish_lock = lambda path: released.append(str(path))
        try:
            result = module.publish_batch(normal_args)
        finally:
            module.release_publish_lock = original_release
        self.assertEqual(result["runId"], "run-1")
        self.assertEqual(released, [str(normal_args.lock_path.resolve())])

    def test_doc_blocks_default_disabled_and_explicit_check_writes_summary_snapshot(self):
        module = load_skill_module("publish_to_feishu_cli")
        root = make_temp_root("doc-blocks")
        cli = write_fake_feishu_cli(root)

        default_output = write_publish_output(root, slug="default")
        default_log = root / "default-cli-calls.log"
        old_env = with_fake_feishu_env(FAKE_CLI_MODE="success", FAKE_CLI_LOG=default_log)
        try:
            module.publish_to_feishu(
                default_output,
                cli=cli,
                settings_db=root / "missing.sqlite",
                force=False,
                permission_args=types.SimpleNamespace(
                    owner_email="",
                    owner_user_id="",
                    owner_open_id="",
                    owner_union_id="",
                    check_blocks=False,
                    blocks_max_bytes=module.COMMAND_MAX_OUTPUT_BYTES,
                ),
            )
        finally:
            restore_env(old_env)
        default_calls = default_log.read_text(encoding="utf-8")
        self.assertNotIn('"blocks"', default_calls)

        checked_output = write_publish_output(root, slug="checked")
        checked_log = root / "checked-cli-calls.log"
        observed_timeouts: dict[str, float] = {}
        original_runner = module.run_logged_command

        def recording_runner(*args, **kwargs):
            observed_timeouts[str(kwargs["label"])] = kwargs["timeout_seconds"]
            return original_runner(*args, **kwargs)

        module.run_logged_command = recording_runner
        old_env = with_fake_feishu_env(FAKE_CLI_MODE="success", FAKE_CLI_LOG=checked_log)
        try:
            result = module.publish_to_feishu(
                checked_output,
                cli=cli,
                settings_db=root / "missing.sqlite",
                force=False,
                permission_args=types.SimpleNamespace(
                    owner_email="",
                    owner_user_id="",
                    owner_open_id="",
                    owner_union_id="",
                    check_blocks=True,
                    blocks_max_bytes=module.COMMAND_MAX_OUTPUT_BYTES,
                ),
            )
        finally:
            restore_env(old_env)
            module.run_logged_command = original_runner

        self.assertEqual(observed_timeouts["feishu-doc-blocks"], 60)
        summary = result["blocksCheck"]
        self.assertEqual(
            sorted(summary.keys()),
            ["blocks_count", "cover_found", "doc_token", "elapsed", "image_blocks_count", "snapshot_path"],
        )
        snapshot = Path(summary["snapshot_path"])
        self.assertTrue(snapshot.is_file())
        self.assertIn("bigField", snapshot.read_text(encoding="utf-8"))
        report = (checked_output / "publish-report.md").read_text(encoding="utf-8")
        self.assertIn("blocks snapshot", report)
        self.assertNotIn("bigField", report)
        self.assertIn('"blocks"', checked_log.read_text(encoding="utf-8"))

    def test_doc_blocks_timeout_marks_blocks_check_requires_remote_check(self):
        module = load_skill_module("publish_to_feishu_cli")
        root = make_temp_root("doc-blocks-timeout")
        output_dir = write_publish_output(root)
        cli = write_fake_feishu_cli(root)
        old_timeout = module.DOC_BLOCKS_TIMEOUT_SECONDS
        module.DOC_BLOCKS_TIMEOUT_SECONDS = 0.5
        old_env = with_fake_feishu_env(FAKE_CLI_MODE="blocks_timeout", FAKE_CLI_LOG=root / "blocks-timeout.log")
        try:
            module.publish_to_feishu(
                output_dir,
                cli=cli,
                settings_db=root / "missing.sqlite",
                force=False,
                permission_args=types.SimpleNamespace(
                    owner_email="",
                    owner_user_id="",
                    owner_open_id="",
                    owner_union_id="",
                    check_blocks=True,
                    blocks_max_bytes=module.COMMAND_MAX_OUTPUT_BYTES,
                ),
            )
        finally:
            restore_env(old_env)
            module.DOC_BLOCKS_TIMEOUT_SECONDS = old_timeout

        metadata = json.loads((output_dir / "metadata.json").read_text(encoding="utf-8"))
        blocks_check = metadata["publish"]["feishu"]["blocksCheck"]
        self.assertEqual(blocks_check["status"], "failed")
        self.assertTrue(blocks_check["requiresRemoteCheck"])
        self.assertIn("timed out", blocks_check["error"])

    def test_large_stdout_goes_to_logs_and_report_is_truncated(self):
        module = load_skill_module("publish_to_feishu_cli")
        root = make_temp_root("large-stdout")
        result = module.run_logged_command(
            [
                "python3",
                "-c",
                "import sys; print('BIGOUT-' + 'A' * 9000); print('BIGERR-' + 'B' * 9000, file=sys.stderr)",
            ],
            label="large-output",
            timeout_seconds=5,
            logs_dir=root / "logs",
        )
        report = module.write_publish_report(
            root,
            command=["fake", "large-output"],
            status="failed",
            stdout=result.stdout,
            stderr=result.stderr,
            stdout_log_path=result.stdout_log_path,
            stderr_log_path=result.stderr_log_path,
            error="simulated failure",
        )

        self.assertIn("BIGOUT-", Path(result.stdout_log_path).read_text(encoding="utf-8"))
        self.assertIn("BIGERR-", Path(result.stderr_log_path).read_text(encoding="utf-8"))
        report_text = report.read_text(encoding="utf-8")
        self.assertIn("truncated", report_text)
        self.assertLess(len(report_text), 10_000)

    def test_batch_output_dir_skips_already_published_and_releases_lock(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-output-dir-published")
        output_dir = write_publish_output(
            root,
            slug="published-article",
            feishu={
                "status": "published",
                "documentId": "doccn-published",
                "documentUrl": "https://feishu.cn/docx/doccn-published",
                "backend": "feishu-cli",
            },
        )
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        try:
            result = module.publish_batch(
                batch_args(root, output_dir=output_dir, publisher=publisher, dry_run=True)
            )
        finally:
            restore_env(old_env)

        self.assertEqual(result["selectedCount"], 1)
        self.assertEqual(result["results"][0]["status"], "skipped")
        self.assertEqual(result["results"][0]["skippedReason"], "already_published")
        self.assertFalse(publisher_log.exists())
        self.assertFalse((root / ".codex_locks" / "feishu_publish.lock").exists())

        state_path = Path(result["statePath"])
        payload = json.loads(state_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["selected"], [str(output_dir.resolve())])
        article = payload["articles"][output_dir.name]
        self.assertEqual(article["current_stage"], "skipped")
        self.assertEqual(article["skipped_reason"], "already_published")

        summary_text = Path(result["summaryPath"]).read_text(encoding="utf-8")
        self.assertIn("already_published", summary_text)

    def test_batch_output_dir_dry_run_selects_only_requested_article(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-output-dir-dry-run")
        other = write_publish_output(root, slug="000-other-ready")
        target = write_publish_output(root, slug="zzz-target-ready")
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        try:
            result = module.publish_batch(
                batch_args(root, output_dir=target, publisher=publisher, dry_run=True)
            )
        finally:
            restore_env(old_env)

        self.assertEqual(result["selectedCount"], 1)
        self.assertEqual(result["results"][0]["outputDir"], str(target.resolve()))
        self.assertEqual(result["results"][0]["status"], "dry_run")
        self.assertNotEqual(result["results"][0]["outputDir"], str(other.resolve()))
        self.assertFalse(publisher_log.exists())

        payload = json.loads(Path(result["statePath"]).read_text(encoding="utf-8"))
        self.assertEqual(payload["selected"], [str(target.resolve())])
        self.assertNotIn(other.name, payload.get("articles", {}))
        self.assertEqual(payload["articles"][target.name]["current_stage"], "dry_run")

    def test_batch_output_dir_blocks_required_remote_check_without_publisher(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-output-dir-remote-check")
        output_dir = write_publish_output(
            root,
            slug="blocked-article",
            feishu={"status": "prepared", "requiresRemoteCheck": True},
        )
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        try:
            result = module.publish_batch(
                batch_args(root, output_dir=output_dir, publisher=publisher, dry_run=False)
            )
        finally:
            restore_env(old_env)

        self.assertEqual(result["selectedCount"], 1)
        self.assertEqual(result["results"][0]["status"], "blocked_remote_check")
        self.assertEqual(result["results"][0]["skippedReason"], "requires_remote_check")
        self.assertFalse(publisher_log.exists())

        payload = json.loads(Path(result["statePath"]).read_text(encoding="utf-8"))
        article = payload["articles"][output_dir.name]
        self.assertEqual(article["current_stage"], "blocked_remote_check")
        self.assertEqual(article["skipped_reason"], "requires_remote_check")
        self.assertTrue(article["requires_remote_check"])

    def test_batch_output_dir_outside_root_errors_before_lock_or_state(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-output-dir-root")
        outside_root = make_temp_root("batch-output-dir-outside")
        output_dir = write_publish_output(outside_root, slug="outside-article")

        with self.assertRaises(module.FeishuBatchError) as ctx:
            module.publish_batch(batch_args(root, output_dir=output_dir, dry_run=True))

        self.assertIn("must be inside --root", str(ctx.exception))
        self.assertFalse((root / ".codex_locks" / "feishu_publish.lock").exists())
        self.assertFalse((root / "batch-runs").exists())

    def test_batch_owner_missing_fails_before_lock_state_or_publisher(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-owner-missing")
        output_dir = write_publish_output(root)
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        for key in ["FEISHU_OWNER_USER_ID", "FEISHU_OWNER_EMAIL", "FEISHU_OWNER_OPEN_ID", "FEISHU_OWNER_UNION_ID"]:
            os.environ.pop(key, None)
        try:
            with self.assertRaises(module.FeishuBatchError) as ctx:
                module.publish_batch(
                    batch_args(root, output_dir=output_dir, publisher=publisher, dry_run=False)
                )
        finally:
            restore_env(old_env)

        message = str(ctx.exception)
        self.assertIn("FEISHU_OWNER_USER_ID", message)
        self.assertIn("FEISHU_OWNER_OPEN_ID", message)
        self.assertIn("FEISHU_OWNER_UNION_ID", message)
        self.assertIn("FEISHU_OWNER_EMAIL", message)
        self.assertIn("--allow-permission-skip", message)
        self.assertFalse((root / ".codex_locks" / "feishu_publish.lock").exists())
        self.assertFalse((root / "batch-runs" / "run-1" / "run_state.json").exists())
        self.assertFalse(publisher_log.exists())

    def test_batch_owner_missing_with_permission_skip_continues_to_publisher(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-owner-skip")
        output_dir = write_publish_output(root)
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        for key in ["FEISHU_OWNER_USER_ID", "FEISHU_OWNER_EMAIL", "FEISHU_OWNER_OPEN_ID", "FEISHU_OWNER_UNION_ID"]:
            os.environ.pop(key, None)
        try:
            result = module.publish_batch(
                batch_args(
                    root,
                    output_dir=output_dir,
                    publisher=publisher,
                    dry_run=False,
                    allow_permission_skip=True,
                )
            )
        finally:
            restore_env(old_env)

        self.assertEqual(result["selectedCount"], 1)
        self.assertEqual(result["results"][0]["status"], "failed")
        self.assertTrue(publisher_log.exists())
        self.assertFalse((root / ".codex_locks" / "feishu_publish.lock").exists())
        self.assertTrue(Path(result["statePath"]).exists())

    def test_batch_owner_missing_dry_run_continues_without_publisher(self):
        module = load_skill_module("publish_feishu_batch")
        root = make_temp_root("batch-owner-dry-run")
        output_dir = write_publish_output(root)
        publisher = write_fake_publisher(root)
        publisher_log = root / "publisher-calls.log"
        old_env = with_fake_feishu_env(FAKE_PUBLISHER_LOG=publisher_log)
        for key in ["FEISHU_OWNER_USER_ID", "FEISHU_OWNER_EMAIL", "FEISHU_OWNER_OPEN_ID", "FEISHU_OWNER_UNION_ID"]:
            os.environ.pop(key, None)
        try:
            result = module.publish_batch(
                batch_args(root, output_dir=output_dir, publisher=publisher, dry_run=True)
            )
        finally:
            restore_env(old_env)

        self.assertEqual(result["selectedCount"], 1)
        self.assertEqual(result["results"][0]["status"], "dry_run")
        self.assertFalse(publisher_log.exists())
        self.assertFalse((root / ".codex_locks" / "feishu_publish.lock").exists())
        self.assertTrue(Path(result["statePath"]).exists())


if __name__ == "__main__":
    unittest.main()
