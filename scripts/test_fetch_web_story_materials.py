import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("fetch_web_story_materials.py")


def load_module():
    spec = importlib.util.spec_from_file_location("fetch_web_story_materials", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def candidate(**overrides):
    base = {
        "sourceId": "web-source-test",
        "title": "普通人的跑步故事",
        "url": "https://www.163.com/dy/article/TEST.html",
        "sourceName": "网易",
        "language": "zh",
        "category": "human_story",
        "storyScore": 55,
        "chinaContextScore": 10,
        "status": "selected",
    }
    base.update(overrides)
    return base


class FetchWebStoryMaterialsTest(unittest.TestCase):
    def test_selects_five_attempts_by_milestone_roles(self):
        module = load_module()
        items = [
            candidate(sourceId="odd-1", category="oddity", title="女子跑马突然踢起正步", storyScore=65),
            candidate(sourceId="odd-collection", category="oddity", title="17个跑友故事", storyScore=64),
            candidate(sourceId="human-1", category="human_story", title="从烟酒不离到10公里破防", storyScore=61),
            candidate(sourceId="celebrity", category="human_story", title="冯唐：跑步，救了我三次命", storyScore=58),
            candidate(sourceId="human-2", category="human_story", title="中年男人跑步的无声告白", storyScore=57),
            candidate(sourceId="odd-2", category="oddity", title="马拉松奇葩现场：边拉肚子边跑", storyScore=56),
            candidate(sourceId="video", category="human_story", title="夫妻同跑视频", url="https://www.toutiao.com/video/1"),
        ]

        attempts = module.select_attempt_candidates(items)

        self.assertEqual([item["sourceId"] for item in attempts], ["odd-1", "odd-2", "human-1", "human-2", "celebrity"])

    def test_extracts_netease_post_body_without_recommendation_noise(self):
        module = load_module()
        html = """
        <html><head><title>测试标题_网易订阅</title></head><body>
          <div class="post_body">
            <p>第一段跑步故事，主人公在马拉松途中遇到离奇事件。</p>
            <p><strong>第二段继续讲具体人物和事件。</strong></p>
          </div>
          <div class="post_recommends_ulist"><p>推荐阅读广告</p></div>
        </body></html>
        """

        article = module.extract_article(html, "https://www.163.com/dy/article/TEST.html")

        self.assertEqual(article.title, "测试标题")
        self.assertIn("第一段跑步故事", article.body)
        self.assertNotIn("推荐阅读广告", article.body)

    def test_extracts_tencent_origin_content(self):
        module = load_module()
        payload = {
            "title": "冯唐：跑步，救了我三次命！",
            "originContent": {
                "text": "<div class=\"rich_media_content\"><p>冯唐曾说：跑步，救了我三次命。</p><p>第一次，是在他读小学时。</p></div>"
            },
        }
        html = f"<html><script>window.DATA = {json.dumps(payload, ensure_ascii=False)};</script></html>"

        article = module.extract_article(html, "https://news.qq.com/rain/a/TEST")

        self.assertEqual(article.title, "冯唐：跑步，救了我三次命！")
        self.assertIn("第一次，是在他读小学时。", article.body)

    def test_quality_gate_rejects_short_or_non_running_body(self):
        module = load_module()
        item = candidate()

        short = module.evaluate_quality(item, "只有很短的跑步摘要。")
        off_topic = module.evaluate_quality(item, "这里讲的是厨房装修和家居收纳。" * 80)

        self.assertFalse(short.can_normalize)
        self.assertIn("正文长度不足", short.reason)
        self.assertFalse(off_topic.can_normalize)
        self.assertIn("跑步核心元素不足", off_topic.reason)

    def test_write_normalized_markdown_note_and_registry(self):
        module = load_module()
        item = candidate(sourceId="web-source-normalized", title="跑步改变人生")
        body = "跑步让主人公重新找回生活。" * 80
        result = module.FetchResult(
            candidate=item,
            role="human_story",
            fetch_status="normalized",
            extracted_title="跑步改变人生",
            body=body,
            body_length=module.body_length(body),
            is_video_page=False,
            is_scraped_page=False,
            has_noise=False,
            needs_manual_review=False,
            can_rewrite=True,
            reason="",
            normalized_path=None,
            fetch_note_path=None,
            fetched_at="2026-05-22T00:00:00Z",
        )

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            registry = root / "web-source-registry.json"
            registry.write_text(json.dumps({"sources": [{"sourceId": "web-source-normalized"}]}), encoding="utf-8")
            module.write_result_files(result, root)
            module.update_registry([result], registry)
            markdown = result.normalized_path.read_text(encoding="utf-8")
            updated = json.loads(registry.read_text(encoding="utf-8"))

        source = updated["sources"][0]
        self.assertIn('title: "跑步改变人生"', markdown)
        self.assertEqual(source["status"], "normalized")
        self.assertEqual(source["fetchStatus"], "normalized")
        self.assertTrue(source["normalizedPath"].endswith(".md"))
        self.assertTrue(source["fetchNotePath"].endswith(".fetch-note.md"))


if __name__ == "__main__":
    unittest.main()
