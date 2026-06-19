import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("search_topic_materials.py")


def load_module():
    spec = importlib.util.spec_from_file_location("search_topic_materials", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class SearchTopicMaterialsTest(unittest.TestCase):
    def test_load_request_normalizes_defaults_and_queries_for_summer_running(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "request.json"
            path.write_text(
                json.dumps(
                    {
                        "topic": "夏季跑步",
                        "intent": "knowledge_share",
                        "subIntent": "seasonal_advice",
                        "style": "dry_good",
                        "languagePriority": "zh_first",
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            request = module.load_topic_request(path)
            queries = module.generate_queries(request)

        self.assertEqual(request["topic"], "夏季跑步")
        self.assertEqual(request["intent"], "knowledge_share")
        self.assertEqual(request["languagePriority"], "zh_first")
        self.assertIn("夏季跑步 注意事项", queries["zh"])
        self.assertIn("高温天 跑步 需要注意什么", queries["zh"])
        self.assertIn("summer running tips", queries["en"])

    def test_make_candidate_uses_topic_fields_and_stable_source_id(self):
        module = load_module()
        result = module.SearchResult(
            title="夏季跑步注意事项：高温天气怎么跑",
            url="https://example.com/summer-running?utm_source=search&ref=home",
            snippet="夏天跑步要注意补水、心率和防晒。",
        )

        candidate = module.make_candidate(
            result,
            query="夏季跑步 注意事项",
            request={"topic": "夏季跑步", "intent": "knowledge_share", "subIntent": "seasonal_advice"},
            discovered_at="2026-05-26T00:00:00Z",
        )
        duplicate = module.make_candidate(
            result,
            query="夏天跑步 怎么跑",
            request={"topic": "夏季跑步", "intent": "knowledge_share", "subIntent": "seasonal_advice"},
            discovered_at="2026-05-26T00:00:00Z",
        )

        self.assertEqual(candidate["sourceId"], duplicate["sourceId"])
        self.assertEqual(candidate["url"], "https://example.com/summer-running?ref=home")
        self.assertEqual(candidate["language"], "zh")
        self.assertEqual(candidate["intent"], "knowledge_share")
        self.assertEqual(candidate["subIntent"], "seasonal_advice")
        self.assertEqual(candidate["status"], "candidate")

    def test_summary_uses_70_percent_zh_threshold_and_noise_counts(self):
        module = load_module()
        candidates = [
            {"language": "zh", "title": "夏季跑步注意事项", "snippet": "高温跑步补水。", "url": "https://example.com/a"},
            {"language": "zh", "title": "夏天跑步怎么防晒", "snippet": "防晒和晨跑夜跑。", "url": "https://example.com/b"},
            {"language": "en", "title": "Summer running tips", "snippet": "hydration tips", "url": "https://example.com/c"},
            {"language": "unknown", "title": "马拉松报名开启", "snippet": "赛事报名", "url": "https://example.com/d"},
        ]

        summary = module.build_run_summary(
            candidates,
            searched_queries=["夏季跑步 注意事项", "summer running tips"],
        )

        self.assertEqual(summary["total"], 4)
        self.assertEqual(summary["zh_count"], 2)
        self.assertEqual(summary["en_count"], 1)
        self.assertEqual(summary["zh_ratio"], 0.5)
        self.assertEqual(summary["status"], "needs_query_tuning")
        self.assertEqual(summary["obvious_race_news_count"], 1)

    def test_write_outputs_creates_json_with_summary_and_markdown_links(self):
        module = load_module()
        candidates = [
            {
                "sourceId": "web-source-topic",
                "title": "夏季跑步注意事项",
                "url": "https://example.com/summer",
                "sourceName": "example.com",
                "snippet": "夏天跑步要注意高温和补水。",
                "query": "夏季跑步 注意事项",
                "language": "zh",
                "intent": "knowledge_share",
                "subIntent": "seasonal_advice",
                "discoveredAt": "2026-05-26T00:00:00Z",
                "status": "candidate",
            }
        ]
        summary = module.build_run_summary(candidates, ["夏季跑步 注意事项"])
        request = {"topic": "夏季跑步", "intent": "knowledge_share", "subIntent": "seasonal_advice"}

        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            json_path = module.write_candidate_json(candidates, out_dir, "2026-05-26", "summer-running", summary, request)
            md_path = module.write_candidate_markdown(candidates, out_dir, "2026-05-26", "summer-running", summary, request)

            payload = json.loads(json_path.read_text(encoding="utf-8"))
            text = md_path.read_text(encoding="utf-8")

        self.assertEqual(json_path.name, "2026-05-26-summer-running-candidates.json")
        self.assertEqual(payload["summary"]["total"], 1)
        self.assertEqual(payload["candidates"], candidates)
        self.assertIn("[夏季跑步注意事项](https://example.com/summer)", text)
        self.assertIn("中文候选：1", text)


if __name__ == "__main__":
    unittest.main()
