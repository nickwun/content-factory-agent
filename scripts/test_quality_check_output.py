import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("quality_check_output.py")


def load_module():
    spec = importlib.util.spec_from_file_location("quality_check_output", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class QualityCheckOutputTests(unittest.TestCase):
    def test_knowledge_checks_pass_for_fact_bank_grounded_article(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fact_bank = root / "fact-bank.json"
            fact_bank.write_text(
                json.dumps(
                    {
                        "facts": [
                            {"category": "高温风险", "claim": "夏季高温会增加散热压力", "sources": [{"sourceId": "s1"}]},
                            {"category": "补水", "claim": "夏季跑步要关注跑前跑中跑后补水", "sources": [{"sourceId": "s2"}]},
                            {"category": "配速调整", "claim": "高温天气应主动降低配速", "sources": [{"sourceId": "s3"}]},
                            {"category": "时间选择", "claim": "应避开一天中最热时段", "sources": [{"sourceId": "s4"}]},
                            {"category": "防晒", "claim": "户外跑步需要防晒", "sources": [{"sourceId": "s5"}]},
                        ]
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            article = root / "article.md"
            article.write_text(
                "# 夏天跑步，别再硬撑了\n\n"
                "夏天跑步，判断先放前面：跑慢一点不是退步。\n\n"
                "## 01、跑慢不是退步\n\n"
                "判断：高温天气不要只盯配速。\n\n"
                "原因：身体散热压力变大，心率和体感都可能比平时更敏感。\n\n"
                "建议：主动降速，必要时改成轻松跑或室内训练。\n\n"
                "## 02、先管住三件事\n\n"
                "判断：时间、补水、防晒，比今天快不快更重要。\n\n"
                "原因：中午和下午更热，出汗也更容易让人状态下滑。\n\n"
                "建议：优先清晨或傍晚，跑前跑中跑后都记得补水，户外别忘了防晒。\n\n"
                "## 03、安全回来才是赢\n\n"
                "判断：头晕、恶心、异常乏力时，停下来比硬撑更像成熟跑者。\n\n"
                "原因：身体反馈比计划表更诚实。\n\n"
                "建议：降强度，找阴凉处休息，跑后换干衣服并慢慢恢复。\n",
                encoding="utf-8",
            )
            metadata = root / "metadata.json"
            metadata.write_text(
                json.dumps(
                    {
                        "sourceType": "topic_knowledge",
                        "factBankPath": str(fact_bank),
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            result = module.evaluate_output(root)

        self.assertEqual(result["status"], "ready_for_edit")
        self.assertEqual(result["knowledgeChecks"]["no_medical_overclaim"], "pass")
        self.assertEqual(result["knowledgeChecks"]["no_unsourced_advice"], "pass")
        self.assertEqual(result["knowledgeChecks"]["no_fearmongering"], "pass")
        self.assertEqual(result["knowledgeChecks"]["practical_advice_present"], "pass")
        self.assertEqual(result["knowledgeChecks"]["fact_bank_grounded"], "pass")
        self.assertEqual(result["knowledgeChecks"]["not_listicle_only"], "pass")

    def test_knowledge_checks_flag_risky_ungrounded_listicle(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "article.md").write_text(
                "# 夏天跑步千万别乱跑\n\n"
                "夏天跑步一定会出事，千万别跑，会猝死，太可怕。\n\n"
                "- 第一条\n- 第二条\n- 第三条\n- 第四条\n- 第五条\n",
                encoding="utf-8",
            )
            (root / "metadata.json").write_text(
                json.dumps({"sourceType": "topic_knowledge"}, ensure_ascii=False),
                encoding="utf-8",
            )

            result = module.evaluate_output(root)

        self.assertEqual(result["status"], "needs_revision")
        self.assertEqual(result["knowledgeChecks"]["no_medical_overclaim"], "fail")
        self.assertEqual(result["knowledgeChecks"]["no_unsourced_advice"], "fail")
        self.assertEqual(result["knowledgeChecks"]["no_fearmongering"], "fail")
        self.assertEqual(result["knowledgeChecks"]["not_listicle_only"], "fail")


if __name__ == "__main__":
    unittest.main()
