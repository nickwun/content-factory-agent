import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("score_topic_candidates.py")


def load_module():
    spec = importlib.util.spec_from_file_location("score_topic_candidates", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def candidate(**overrides):
    base = {
        "sourceId": "web-source-topic-test",
        "title": "夏季跑步注意事项：高温天气怎么跑更安全",
        "url": "https://example.com/summer-running",
        "sourceName": "跑步媒体",
        "snippet": "夏天跑步需要调整配速，避开高温时段，注意补水、防晒、心率和中暑预防。",
        "query": "夏季跑步 注意事项",
        "language": "zh",
        "intent": "knowledge_share",
        "subIntent": "seasonal_advice",
        "topic": "夏季跑步",
        "style": "dry_good",
        "discoveredAt": "2026-05-26T00:00:00Z",
        "status": "candidate",
    }
    base.update(overrides)
    return base


class ScoreTopicCandidatesTest(unittest.TestCase):
    def test_scores_practical_chinese_summer_running_article_as_primary(self):
        module = load_module()

        scored = module.score_candidate(candidate())

        self.assertEqual(scored["decision"], "primary_material")
        self.assertGreaterEqual(scored["topicRelevance"], 7)
        self.assertGreaterEqual(scored["practicalValue"], 7)
        self.assertGreaterEqual(scored["wechatRewritePotential"], 7)
        self.assertEqual(scored["rejectReason"], "")

    def test_scores_authoritative_health_source_as_reference_support(self):
        module = load_module()
        item = candidate(
            sourceId="web-source-reference",
            title="请收好这份夏日运动指南 - 国家体育总局",
            url="https://www.sport.gov.cn/n20001280/n20001265/n20066978/c24323571/content.html",
            sourceName="国家体育总局",
            snippet="夏季运动应避开高温时段，及时补水，关注中暑风险和身体信号。",
            query="夏季跑步 注意事项",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "reference_support")
        self.assertGreaterEqual(scored["evidenceQuality"], 8)
        self.assertIn("事实支撑", scored["reviewReason"])

    def test_rejects_ads_race_news_medical_fear_and_low_relevance(self):
        module = load_module()
        cases = [
            (
                candidate(
                    title="夏季跑鞋装备推荐，限时优惠购买",
                    snippet="跑鞋测评、装备带货、折扣福利。",
                    url="https://shop.example.com/gear",
                ),
                "装备广告",
            ),
            (
                candidate(
                    title="夏季马拉松赛事报名开启，路线公布",
                    snippet="赛事报名、赛程安排、成绩查询。",
                ),
                "赛事报道",
            ),
            (
                candidate(
                    title="夏天跑步会猝死？千万别这样跑，太可怕",
                    snippet="用吓人案例制造恐慌，缺少客观建议。",
                ),
                "医疗恐吓",
            ),
            (
                candidate(
                    title="夏天喝水的十个常识",
                    snippet="家庭生活饮水建议，没有跑步场景。",
                    query="夏季跑步 补水",
                ),
                "弱相关",
            ),
        ]

        for item, reason in cases:
            with self.subTest(reason=reason):
                scored = module.score_candidate(item)
                self.assertEqual(scored["decision"], "rejected")
                self.assertIn(reason, scored["rejectReason"])
                self.assertGreaterEqual(scored["noiseScore"], 6)

    def test_uncertain_for_relevant_but_thin_or_video_like_candidate(self):
        module = load_module()
        item = candidate(
            title="夏天跑步到底晨跑还是夜跑好？",
            url="https://www.bilibili.com/video/BV123",
            sourceName="哔哩哔哩",
            snippet="视频讨论夏天晨跑和夜跑选择，但搜索摘要无法判断建议是否完整。",
            query="夏天跑步 晨跑 好还是夜跑好",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "uncertain")
        self.assertIn("人工复核", scored["reviewReason"])

    def test_write_outputs_and_registry_update(self):
        module = load_module()
        primary = module.score_candidate(candidate(sourceId="web-source-primary"))
        reference = module.score_candidate(
            candidate(
                sourceId="web-source-reference",
                title="请收好这份夏日运动指南 - 国家体育总局",
                url="https://www.sport.gov.cn/example",
                sourceName="国家体育总局",
                snippet="夏季运动应避开高温时段，及时补水，关注中暑风险。",
            )
        )
        uncertain = module.score_candidate(
            candidate(
                sourceId="web-source-uncertain",
                title="夏天跑步到底晨跑还是夜跑好？",
                url="https://www.bilibili.com/video/BV123",
                sourceName="哔哩哔哩",
                snippet="视频讨论夏天晨跑和夜跑选择。",
            )
        )
        rejected = module.score_candidate(
            candidate(
                sourceId="web-source-rejected",
                title="夏季跑鞋装备推荐，限时优惠购买",
                snippet="跑鞋测评、装备带货、折扣福利。",
            )
        )
        scored = [primary, reference, uncertain, rejected]

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "web-discovery"
            paths = module.write_outputs(scored, root, "2026-05-26", "summer-running")
            registry_path = root / "web-source-registry.json"
            registry_path.write_text(
                json.dumps({"version": 1, "sources": [{"sourceId": "web-source-primary"}]}),
                encoding="utf-8",
            )
            module.update_registry(scored, registry_path)

            primary_data = json.loads(paths["primary"].read_text(encoding="utf-8"))
            reference_data = json.loads(paths["reference"].read_text(encoding="utf-8"))
            rejected_data = json.loads(paths["rejected"].read_text(encoding="utf-8"))
            markdown = paths["markdown"].read_text(encoding="utf-8")
            registry = json.loads(registry_path.read_text(encoding="utf-8"))

        self.assertEqual(len(primary_data), 1)
        self.assertEqual(len(reference_data), 1)
        self.assertEqual(len(rejected_data), 1)
        self.assertIn("## primary_material", markdown)
        self.assertIn("## reference_support", markdown)
        self.assertIn("## uncertain", markdown)
        self.assertIn("## rejected", markdown)
        primary_registry = next(item for item in registry["sources"] if item["sourceId"] == "web-source-primary")
        self.assertEqual(primary_registry["decision"], "primary_material")
        self.assertIn("topicRelevance", primary_registry)

    def test_primary_limit_demotes_extra_primary_candidates_to_uncertain(self):
        module = load_module()
        scored = [
            module.score_candidate(candidate(sourceId=f"web-source-primary-{index}", title=f"夏季跑步注意事项 {index}"))
            for index in range(3)
        ]

        limited = module.apply_primary_limit(scored, primary_limit=2)

        self.assertEqual(sum(1 for item in limited if item["decision"] == "primary_material"), 2)
        demoted = [item for item in limited if item["decision"] == "uncertain"]
        self.assertEqual(len(demoted), 1)
        self.assertIn("主素材数量控制", demoted[0]["reviewReason"])


if __name__ == "__main__":
    unittest.main()
