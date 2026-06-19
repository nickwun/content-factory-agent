import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("fetch_topic_materials.py")


def load_module():
    spec = importlib.util.spec_from_file_location("fetch_topic_materials", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def candidate(**overrides):
    base = {
        "sourceId": "web-source-topic-test",
        "title": "夏季跑步注意事项：高温补水配速心率和中暑预防",
        "url": "https://example.com/summer-running",
        "sourceName": "跑步媒体",
        "language": "zh",
        "intent": "knowledge_share",
        "subIntent": "seasonal_advice",
        "topic": "夏季跑步",
        "style": "dry_good",
        "topicRelevance": 10,
        "practicalValue": 10,
        "evidenceQuality": 6,
        "wechatRewritePotential": 10,
        "chinaContextScore": 9,
        "freshnessScore": 8,
        "noiseScore": 0,
        "decision": "primary_material",
        "status": "candidate",
    }
    base.update(overrides)
    return base


class FetchTopicMaterialsTest(unittest.TestCase):
    def test_selects_five_per_role_with_coverage_spread(self):
        module = load_module()
        primary = [
            candidate(sourceId="p-heat", title="夏季跑步高温风险和中暑预防", query="高温 跑步 安全"),
            candidate(sourceId="p-water", title="夏季跑步补水指南", query="夏季跑步 补水"),
            candidate(sourceId="p-pace", title="高温天气跑步配速调整", query="高温天气 跑步 配速"),
            candidate(sourceId="p-time", title="夏天跑步晨跑还是夜跑", query="夏天晨跑 夜跑"),
            candidate(sourceId="p-sun", title="夏季跑步防晒注意事项", query="夏季跑步 防晒"),
            candidate(sourceId="p-extra", title="夏天跑步泛泛建议", query="夏天跑步 怎么跑"),
        ]
        reference = [
            candidate(sourceId="r-heart", decision="reference_support", title="夏天跑步心率管理", query="夏天跑步 心率"),
            candidate(sourceId="r-heat", decision="reference_support", title="夏季运动谨防中暑", query="夏季跑步 中暑"),
            candidate(sourceId="r-water", decision="reference_support", title="跑步补水和电解质", query="夏季跑步 补水"),
            candidate(sourceId="r-time", decision="reference_support", title="晨跑和夜跑如何选择", query="夏天晨跑 夜跑"),
            candidate(sourceId="r-sun", decision="reference_support", title="夏天跑步如何防晒", query="夏季跑步 防晒"),
            candidate(sourceId="r-extra", decision="reference_support", title="夏天运动", query="夏季跑步 注意事项"),
        ]

        attempts = module.select_attempt_candidates(primary, reference, per_role=5)

        self.assertEqual([item["sourceId"] for item in attempts["primary_material"]], ["p-heat", "p-water", "p-pace", "p-time", "p-sun"])
        self.assertEqual([item["sourceId"] for item in attempts["reference_support"]], ["r-heart", "r-heat", "r-water", "r-time", "r-sun"])
        all_tags = set()
        for item in attempts["primary_material"] + attempts["reference_support"]:
            all_tags.update(module.coverage_tags_for_candidate(item))
        self.assertIn("高温风险", all_tags)
        self.assertIn("补水", all_tags)
        self.assertIn("配速调整", all_tags)
        self.assertIn("心率管理", all_tags)
        self.assertIn("时间选择", all_tags)
        self.assertIn("防晒", all_tags)
        self.assertIn("中暑预防", all_tags)

    def test_extracts_article_and_detects_coverage_and_noise_flags(self):
        module = load_module()
        html = """
        <html><head><title>夏季跑步指南</title></head><body>
          <article>
            <p>夏季跑步要避开高温时段，晨跑和夜跑都要看体感。</p>
            <p>跑者需要补水，必要时补充电解质，并且把配速放慢。</p>
            <p>如果心率异常升高，或者出现中暑前兆，应降低强度。</p>
            <p>户外跑步还要做好防晒和跑后恢复。</p>
          </article>
          <aside>推荐阅读广告</aside>
        </body></html>
        """

        article = module.extract_article(html, "https://example.com/summer-running")
        tags = module.detect_coverage_tags(article.body)
        flags = module.detect_quality_flags(article.body + " 推荐阅读广告")

        self.assertEqual(article.title, "夏季跑步指南")
        self.assertIn("配速放慢", article.body)
        self.assertIn("高温风险", tags)
        self.assertIn("补水", tags)
        self.assertIn("配速调整", tags)
        self.assertIn("心率管理", tags)
        self.assertIn("时间选择", tags)
        self.assertIn("防晒", tags)
        self.assertIn("中暑预防", tags)
        self.assertIn("恢复与降强度", tags)
        self.assertTrue(flags.has_ad_pollution)

    def test_quality_gate_rejects_short_ads_race_and_fear(self):
        module = load_module()
        item = candidate()

        short = module.evaluate_quality(item, "夏季跑步要补水。")
        ad = module.evaluate_quality(item, "夏季跑步补水。" * 80 + " 跑鞋优惠购买，装备带货。")
        race = module.evaluate_quality(item, "夏季跑步补水。" * 80 + " 马拉松赛事报名开启，路线公布。")
        fear = module.evaluate_quality(item, "夏季跑步补水。" * 80 + " 千万别跑，猝死太可怕。")

        self.assertFalse(short.can_normalize)
        self.assertIn("正文长度不足", short.reason)
        self.assertFalse(ad.can_normalize)
        self.assertIn("广告/软广污染", ad.reason)
        self.assertFalse(race.can_normalize)
        self.assertIn("赛事报道倾向", race.reason)
        self.assertFalse(fear.can_normalize)
        self.assertIn("医疗恐吓倾向", fear.reason)

    def test_writes_material_package_files_and_registry(self):
        module = load_module()
        item = candidate(sourceId="web-source-normalized", title="夏季跑步指南")
        body = "夏季跑步要避开高温，注意补水、配速、心率、防晒和中暑预防。跑后降低强度做好恢复。" * 40
        evaluation = module.evaluate_quality(item, body)
        result = module.FetchResult(
            candidate=item,
            material_role="primary_material",
            fetch_status="normalized",
            extracted_title="夏季跑步指南",
            body=body,
            body_length=module.body_length(body),
            coverage_tags=module.detect_coverage_tags(body),
            quality_flags=module.detect_quality_flags(body),
            usable_for_fact_bank=evaluation.usable_for_fact_bank,
            needs_manual_review=evaluation.needs_manual_review,
            reason="",
            normalized_path=None,
            fetch_note_path=None,
            fetched_at="2026-05-26T00:00:00Z",
        )

        with tempfile.TemporaryDirectory() as tmp:
            package_dir = Path(tmp) / "topic-materials" / "2026-05-26-summer-running"
            registry = Path(tmp) / "web-source-registry.json"
            registry.write_text(json.dumps({"version": 1, "sources": [{"sourceId": "web-source-normalized"}]}), encoding="utf-8")

            module.write_result_files(result, package_dir)
            module.write_source_index([result], package_dir)
            module.write_coverage_matrix([result], package_dir)
            module.update_registry([result], registry)

            markdown = result.normalized_path.read_text(encoding="utf-8")
            note = result.fetch_note_path.read_text(encoding="utf-8")
            index = (package_dir / "source-index.md").read_text(encoding="utf-8")
            matrix = (package_dir / "coverage-matrix.md").read_text(encoding="utf-8")
            updated = json.loads(registry.read_text(encoding="utf-8"))

        source = updated["sources"][0]
        self.assertIn("sourceType: topic_material", markdown)
        self.assertIn("materialRole: primary_material", markdown)
        self.assertIn("coverageTags:", markdown)
        self.assertIn("是否适合进入 fact bank：true", note)
        self.assertIn("[夏季跑步指南]", index)
        self.assertIn("高温风险", matrix)
        self.assertEqual(source["fetchStatus"], "normalized")
        self.assertTrue(source["normalizedPath"].endswith(".md"))
        self.assertTrue(source["fetchNotePath"].endswith(".fetch-note.md"))
        self.assertTrue(source["usableForFactBank"])


if __name__ == "__main__":
    unittest.main()
