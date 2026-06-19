import importlib.util
import json
import sys
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("search_running_stories.py")


def load_module():
    spec = importlib.util.spec_from_file_location("search_running_stories", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class SearchRunningStoriesTest(unittest.TestCase):
    def test_parse_search_results_extracts_duckduckgo_redirects(self):
        module = load_module()
        html = """
        <html>
          <body>
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstory%3Futm_source%3Dddg">Runner &amp; strange story</a>
            <a class="result__snippet">A jogger found a very unusual reason to keep running.</a>
          </body>
        </html>
        """

        results = module.parse_search_results(html)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].title, "Runner & strange story")
        self.assertEqual(results[0].url, "https://example.com/story?utm_source=ddg")
        self.assertEqual(results[0].snippet, "A jogger found a very unusual reason to keep running.")

    def test_make_candidate_uses_required_fields_and_stable_source_id(self):
        module = load_module()
        result = module.SearchResult(
            title="The strange story of an amateur runner",
            url="https://www.example.com/running/story?utm_source=search&ref=home",
            snippet="A real runner story from a local running group.",
        )

        candidate = module.make_candidate(
            result,
            query="runner bizarre story",
            category="oddity",
            discovered_at="2026-05-22T00:00:00Z",
        )
        duplicate = module.make_candidate(
            result,
            query="marathon weird story",
            category="oddity",
            discovered_at="2026-05-22T00:00:00Z",
        )

        self.assertEqual(
            set(candidate),
            {
                "sourceId",
                "title",
                "url",
                "sourceName",
                "snippet",
                "query",
                "category",
                "language",
                "discoveredAt",
                "status",
            },
        )
        self.assertEqual(candidate["sourceId"], duplicate["sourceId"])
        self.assertTrue(candidate["sourceId"].startswith("web-source-"))
        self.assertEqual(candidate["url"], "https://www.example.com/running/story?ref=home")
        self.assertEqual(candidate["sourceName"], "example.com")
        self.assertEqual(candidate["language"], "en")
        self.assertEqual(candidate["status"], "candidate")

    def test_make_candidate_detects_chinese_language(self):
        module = load_module()
        result = module.SearchResult(
            title="夜跑奇遇：一个普通跑者的故事",
            url="https://www.example.com/running/chinese-story",
            snippet="这是一段发生在跑步路上的真实经历。",
        )

        candidate = module.make_candidate(
            result,
            query="夜跑 奇遇",
            category="oddity",
            discovered_at="2026-05-22T00:00:00Z",
        )

        self.assertEqual(candidate["language"], "zh")

    def test_write_outputs_creates_candidate_file_and_registry(self):
        module = load_module()
        candidate = {
            "sourceId": "web-source-abc123",
            "title": "A runner story",
            "url": "https://example.com/story",
            "sourceName": "example.com",
            "snippet": "A short search snippet.",
            "query": "ordinary runner story",
            "category": "human_story",
            "language": "en",
            "discoveredAt": "2026-05-22T00:00:00Z",
            "status": "candidate",
        }

        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            output_path = module.write_candidate_file([candidate], tmp_path, "2026-05-22")
            registry_path = module.update_registry(
                [candidate],
                tmp_path / "web-source-registry.json",
                "2026-05-22T00:00:00Z",
            )

            self.assertEqual(output_path.name, "2026-05-22-running-stories.json")
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), [candidate])

            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            self.assertEqual(registry["version"], 1)
            self.assertEqual(registry["sources"][0]["sourceId"], "web-source-abc123")
            self.assertEqual(registry["sources"][0]["status"], "candidate")
            self.assertEqual(registry["sources"][0]["language"], "en")
            self.assertIn("chinaContextScore", registry["sources"][0])
            self.assertIn("storyScore", registry["sources"][0])
            self.assertIn("rejectReason", registry["sources"][0])

    def test_write_candidate_markdown_creates_clickable_link_report(self):
        module = load_module()
        candidates = [
            {
                "sourceId": "web-source-abc123",
                "title": "跑步记趣||途中的那些糗事",
                "url": "https://www.sohu.com/a/904743489_683616",
                "sourceName": "搜狐",
                "snippet": "跑步的乐趣，往往藏在那些不经意的小故事里。",
                "query": "跑步 奇闻",
                "category": "oddity",
                "language": "zh",
                "discoveredAt": "2026-05-22T00:00:00Z",
                "status": "candidate",
            }
        ]
        summary = module.build_run_summary(candidates, ["跑步 奇闻"])

        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            report_path = module.write_candidate_markdown(candidates, Path(tmp), "2026-05-22", summary)
            text = report_path.read_text(encoding="utf-8")

        self.assertEqual(report_path.name, "2026-05-22-running-stories.md")
        self.assertIn("[跑步记趣||途中的那些糗事](https://www.sohu.com/a/904743489_683616)", text)
        self.assertIn("中文候选：1", text)
        self.assertIn("跑步的乐趣，往往藏在那些不经意的小故事里。", text)

    def test_summary_marks_query_tuning_when_chinese_ratio_is_low(self):
        module = load_module()
        candidates = [
            {"language": "zh"},
            {"language": "en"},
            {"language": "en"},
            {"language": "unknown"},
        ]

        summary = module.build_run_summary(candidates, ["跑步 奇葩 故事", "runner bizarre story"])

        self.assertEqual(summary["zh_count"], 1)
        self.assertEqual(summary["en_count"], 2)
        self.assertEqual(summary["unknown_count"], 1)
        self.assertEqual(summary["zh_ratio"], 0.25)
        self.assertEqual(summary["status"], "needs_query_tuning")

    def test_registry_migrates_existing_sources_to_milestone_20_fields(self):
        module = load_module()

        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "web-source-registry.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "sources": [
                            {
                                "sourceId": "web-source-old",
                                "title": "Old source",
                                "url": "https://example.com/old",
                                "sourceName": "example.com",
                                "status": "candidate",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            module.update_registry([], registry_path, "2026-05-22T00:00:00Z")

            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            source = registry["sources"][0]
            self.assertEqual(source["language"], "en")
            self.assertEqual(source["chinaContextScore"], 0)
            self.assertIsNone(source["storyScore"])
            self.assertEqual(source["rejectReason"], "")

    def test_chinese_queries_are_weighted_above_english_queries(self):
        module = load_module()

        self.assertIn("跑步 奇葩 故事", module.SEARCH_QUERIES["oddity"])
        self.assertIn("夜跑 奇遇", module.SEARCH_QUERIES["oddity"])
        self.assertIn("跑步 救了我", module.SEARCH_QUERIES["human_story"])
        self.assertIn("跑步 不发朋友圈", module.SEARCH_QUERIES["human_story"])
        self.assertGreater(
            sum(1 for query in module.SEARCH_QUERIES["human_story"] if module.contains_cjk(query)),
            sum(1 for query in module.SEARCH_QUERIES["human_story"] if not module.contains_cjk(query)),
        )

    def test_story_filter_rejects_non_sport_running_phrases(self):
        module = load_module()
        false_positive = module.SearchResult(
            title="Bizarre cycling confrontation over running red light",
            url="https://example.com/celebrity-running-red-light",
            snippet="A cyclist was accused of running a red light in London.",
        )
        runaway_false_positive = module.SearchResult(
            title="CSX 8888: The true story of the crazy eights incident",
            url="https://example.com/runaway-train-incident",
            snippet="A routine run turned into a race against time to avoid a head-on collision.",
        )
        real_running_story = module.SearchResult(
            title="A strange runner story from a rainy night",
            url="https://example.com/strange-runner-story",
            snippet="A jogger kept running after an unusual encounter on a trail.",
        )

        self.assertFalse(module.is_likely_story_candidate(false_positive, "oddity"))
        self.assertFalse(module.is_likely_story_candidate(runaway_false_positive, "oddity"))
        self.assertTrue(module.is_likely_story_candidate(real_running_story, "oddity"))

    def test_story_filter_rejects_platform_search_and_blocked_urls(self):
        module = load_module()
        platform_search = module.SearchResult(
            title="户外跑步奇闻 - 抖音",
            url="https://www.douyin.com/search/%E6%88%B7%E5%A4%96%E8%B7%91%E6%AD%A5%E5%A5%87%E9%97%BB",
            snippet="户外跑步奇闻 户外跑步奇遇。",
        )
        blocked_zhihu = module.SearchResult(
            title="你有哪些有趣的跑步经历？ - 知乎",
            url="https://www.zhihu.com/question/645304797",
            snippet="比赛对我来说是一次巨大的挑战。",
        )
        article_page = module.SearchResult(
            title="跑步记趣||途中的那些糗事",
            url="https://www.sohu.com/a/904743489_683616",
            snippet="跑步的乐趣，往往藏在那些不经意的小故事里。",
        )
        audio_page = module.SearchResult(
            title="跑者日历 - 热点 - 喜马拉雅",
            url="https://www.ximalaya.com/creation/35319400",
            snippet="跑者日历节目列表。",
        )
        video_page = module.SearchResult(
            title='马拉松奇闻!中国选手边跑边"拉肚子"-爱奇艺',
            url="https://www.iqiyi.com/v_19rroxc0ws.html",
            snippet="马拉松奇闻视频。",
        )

        self.assertFalse(module.is_usable_source_result(platform_search))
        self.assertFalse(module.is_usable_source_result(blocked_zhihu))
        self.assertFalse(module.is_usable_source_result(audio_page))
        self.assertFalse(module.is_usable_source_result(video_page))
        self.assertTrue(module.is_usable_source_result(article_page))

    def test_openability_probe_allows_success_and_rejects_forbidden_without_full_fetch(self):
        module = load_module()

        class FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _size):
                return b"ok"

            def geturl(self):
                return "https://example.com/story"

        calls = []

        def fake_open_success(request, *, timeout):
            calls.append((request.get_method(), timeout))
            return FakeResponse()

        self.assertTrue(module.probe_openable("https://example.com/story", opener=fake_open_success))
        self.assertEqual(calls[0][0], "HEAD")

        def fake_open_forbidden(_request, *, timeout):
            import io

            self.assertEqual(timeout, 8)
            raise module.urllib.error.HTTPError(
                "https://example.com/blocked",
                403,
                "Forbidden",
                hdrs=None,
                fp=io.BytesIO(b""),
            )

        self.assertFalse(module.probe_openable("https://example.com/blocked", opener=fake_open_forbidden))


if __name__ == "__main__":
    unittest.main()
