import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("score_web_candidates.py")


def load_module():
    spec = importlib.util.spec_from_file_location("score_web_candidates", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def candidate(**overrides):
    base = {
        "sourceId": "web-source-test",
        "title": "惊心一幕!女子跑马，突然踢起正步，医生：大脑已无意识了 ...",
        "url": "https://www.163.com/dy/article/K3B1IT5P0513EF9U.html",
        "sourceName": "网易",
        "snippet": "一位女选手在马拉松途中突然偏离赛道，踢起正步，医生判断大脑已无意识。",
        "query": "跑步 离奇 事件",
        "category": "oddity",
        "language": "zh",
        "discoveredAt": "2026-05-22T00:00:00Z",
        "status": "candidate",
    }
    base.update(overrides)
    return base


class ScoreWebCandidatesTest(unittest.TestCase):
    def test_scores_concrete_running_story_as_selected(self):
        module = load_module()

        scored = module.score_candidate(candidate())

        self.assertEqual(scored["decision"], "selected")
        self.assertGreaterEqual(scored["storyScore"], 55)
        self.assertGreaterEqual(scored["runningRelevance"], 7)
        self.assertGreaterEqual(scored["oddityScore"], 5)
        self.assertEqual(scored["rejectReason"], "")

    def test_rejects_games_training_gear_events_and_weak_running(self):
        module = load_module()
        cases = [
            (
                candidate(
                    title="洛克王国S2奇遇精灵测评与获取指南",
                    url="https://www.msn.cn/zh-cn/news/other/game",
                    snippet="游戏攻略，奇遇精灵获取指南。",
                    query="夜跑 奇遇",
                ),
                "游戏",
            ),
            (
                candidate(
                    title="跑步常见伤病预防与恢复指南",
                    snippet="跑步教程，伤病预防，训练计划，如何正确跑步。",
                    query="跑步 途中 发生",
                ),
                "训练科普",
            ),
            (
                candidate(
                    title="跑鞋装备推荐，限时优惠",
                    snippet="跑鞋、装备、带货、优惠。",
                    query="跑步 故事",
                ),
                "装备广告",
            ),
            (
                candidate(
                    title="2026马拉松报名开启，路线公布",
                    snippet="官方通稿，赛事报名，成绩报道。",
                    query="马拉松 奇葩",
                ),
                "赛事通稿",
            ),
            (
                candidate(
                    title="跑下去，遇见更好的自己",
                    snippet="跑步是生活的修行，愿你坚持，遇见更好的自己。",
                    query="跑步 遇见",
                ),
                "纯鸡汤",
            ),
        ]

        for item, reason in cases:
            with self.subTest(reason=reason):
                scored = module.score_candidate(item)
                self.assertEqual(scored["decision"], "rejected")
                self.assertIn(reason, scored["rejectReason"])
                self.assertGreaterEqual(scored["noiseScore"], 6)

    def test_uncertain_for_promising_but_insufficient_detail(self):
        module = load_module()
        item = candidate(
            title="跑步改变了我的生活",
            snippet="作者分享跑步带来的变化，但搜索摘要缺少具体事件细节。",
            query="跑步 改变生活",
            category="human_story",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "uncertain")
        self.assertIn("需要人工复核", scored["reviewReason"])

    def test_rejects_health_warning_metadata_as_training_science(self):
        module = load_module()
        item = candidate(
            title='跑步不当反"伤身" 身体出现这些情况千万别大意_运动_心脏_男子',
            snippet=(
                "半程马拉松赛道7公里补给站附近，一名30多岁的男子突然晕厥倒地。"
                "赛事医疗急救跑者30秒内抵达现场展开施救，通过胸外按压与AED电击，"
                "患者逐渐恢复微弱呼吸。跑步别太猛，心脏真有可能会累崩。"
            ),
            query="跑步 意外 反转",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "rejected")
        self.assertIn("训练科普", scored["rejectReason"])

    def test_multi_story_collection_requires_manual_review(self):
        module = load_module()
        item = candidate(
            title="108个路跑故事|：每一个跑者都是一个王",
            snippet=(
                "《只要跑起来——108个马拉松跑者的故事》是国内第一本正式出版的"
                "草根跑者系列故事书，一百余位跑者讲述各自的跑步故事。"
            ),
            query="跑步 奇葩 故事",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "uncertain")
        self.assertIn("多故事", scored["reviewReason"])

    def test_selects_specific_ordinary_runner_transformation_story(self):
        module = load_module()
        item = candidate(
            title="从纯业余跑者成为国家级健将，种瓜小伙跑进220的逆袭之路......",
            snippet=(
                "32岁的他，没有背景、没有专门的训练场地，无人指导，成绩的背后"
                "充满艰辛和限制，今天我们来说一说大众跑者吴浩然的跑步故事。"
            ),
            query="普通人 跑步 故事",
            category="human_story",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "selected")
        self.assertGreaterEqual(scored["humanStoryScore"], 8)
        self.assertEqual(scored["rejectReason"], "")

    def test_selects_specific_recovery_and_midlife_running_stories(self):
        module = load_module()
        cases = [
            candidate(
                title="从烟酒不离到10公里破防：我用365天，赎回了被透支的人生",
                snippet=(
                    "跑步让我摆脱了过去的浮躁，以前遇到烦心事就想抽烟喝酒逃避，"
                    "现在跑上5公里，负面情绪就跟着汗水一起蒸发了。今天是我戒烟戒酒"
                    "满一年的日子，也是我第一次挑战10公里。"
                ),
                query="跑步 戒酒",
                category="human_story",
            ),
            candidate(
                title="一个中年妈妈开始跑步，意味着什么？不是健身那么简单，藏 ...",
                snippet=(
                    "有一位52岁的中年女性分享的经历引起很多共鸣——原本失眠、焦虑，"
                    "开始跑步后不仅体重减了20斤，心态也平和许多。"
                ),
                query="中年女人 跑步",
                category="human_story",
            ),
        ]

        for item in cases:
            with self.subTest(title=item["title"]):
                scored = module.score_candidate(item)
                self.assertEqual(scored["decision"], "selected")
                self.assertGreaterEqual(scored["runningRelevance"], 7)

    def test_generic_reason_list_requires_manual_review(self):
        module = load_module()
        item = candidate(
            title="当一个中年男人开始频繁跑步，说明了这4个原因",
            snippet=(
                "用一句话来形容一个喜欢跑步的中年男人圈子，那就是心中只有跑步，"
                "唯一的快乐就是跑步后大汗淋漓的状态。"
            ),
            query="中年男人 跑步",
            category="human_story",
        )

        scored = module.score_candidate(item)

        self.assertEqual(scored["decision"], "uncertain")
        self.assertIn("泛观点", scored["reviewReason"])

    def test_write_outputs_and_registry_update(self):
        module = load_module()
        selected = module.score_candidate(candidate(sourceId="web-source-selected"))
        rejected = module.score_candidate(
            candidate(
                sourceId="web-source-rejected",
                title="跑步常见伤病预防与恢复指南",
                snippet="跑步教程，伤病预防，训练计划。",
            )
        )
        uncertain = module.score_candidate(
            candidate(
                sourceId="web-source-uncertain",
                title="跑步改变了我的生活",
                snippet="作者分享跑步带来的变化，但搜索摘要缺少具体事件细节。",
                category="human_story",
            )
        )
        scored = [selected, rejected, uncertain]

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            paths = module.write_outputs(scored, root, "2026-05-22")
            registry_path = root / "web-source-registry.json"
            registry_path.write_text(
                json.dumps({"version": 1, "sources": [{"sourceId": "web-source-selected"}]}),
                encoding="utf-8",
            )
            module.update_registry(scored, registry_path)

            selected_data = json.loads(paths["selected"].read_text(encoding="utf-8"))
            rejected_data = json.loads(paths["rejected"].read_text(encoding="utf-8"))
            markdown = paths["markdown"].read_text(encoding="utf-8")
            registry = json.loads(registry_path.read_text(encoding="utf-8"))

        self.assertEqual(len(selected_data), 1)
        self.assertEqual(len(rejected_data), 1)
        self.assertIn("## selected", markdown)
        self.assertIn("## uncertain", markdown)
        self.assertIn("## rejected", markdown)
        self.assertIn("[惊心一幕!女子跑马，突然踢起正步，医生：大脑已无意识了 ...]", markdown)
        selected_registry = next(item for item in registry["sources"] if item["sourceId"] == "web-source-selected")
        self.assertEqual(selected_registry["decision"], "selected")
        self.assertIn("storyScore", selected_registry)


if __name__ == "__main__":
    unittest.main()
