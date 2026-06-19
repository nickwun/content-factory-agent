#!/usr/bin/env python3
"""Quality checks for generated ContentFactory outputs.

This checker intentionally stays conservative: it records pipeline-facing checks
that are easy to audit locally, while leaving nuanced editorial judgment to the
human review step.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


KNOWLEDGE_CHECKS = [
    "no_medical_overclaim",
    "no_unsourced_advice",
    "no_fearmongering",
    "practical_advice_present",
    "fact_bank_grounded",
    "not_listicle_only",
]

CATEGORY_KEYWORDS = {
    "高温风险": ["高温", "热", "散热", "湿度", "闷"],
    "补水": ["补水", "水", "电解质", "出汗"],
    "配速调整": ["配速", "降速", "跑慢", "慢一点", "强度"],
    "心率管理": ["心率", "体感", "呼吸"],
    "时间选择": ["清晨", "傍晚", "中午", "下午", "室内", "时间"],
    "防晒": ["防晒", "紫外线", "帽子", "遮阳"],
    "中暑预防": ["中暑", "头晕", "恶心", "乏力", "抽筋", "停下来", "休息"],
    "恢复与降强度": ["恢复", "换干衣服", "拉伸", "降强度", "休息"],
}

PRACTICAL_TERMS = [
    "建议",
    "主动",
    "降速",
    "跑慢",
    "补水",
    "清晨",
    "傍晚",
    "室内",
    "防晒",
    "停下来",
    "休息",
    "换干衣服",
]

MEDICAL_OVERCLAIM_PATTERNS = [
    r"一定会",
    r"保证",
    r"绝对",
    r"根治",
    r"治愈",
    r"人人必须",
    r"会猝死",
    r"防止.*中暑",
    r"避免.*所有.*风险",
]

FEARMONGERING_PATTERNS = [
    r"千万别跑",
    r"太可怕",
    r"吓人",
    r"恐怖",
    r"要命",
    r"致命",
    r"毁掉",
    r"猝死",
]


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def visible_text(markdown: str) -> str:
    text = re.sub(r"```.*?```", "", markdown, flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", "", text)
    text = re.sub(r"^[#>\-\*\d\.\s]+", "", text, flags=re.M)
    return text


def count_article_chars(markdown: str) -> int:
    text = visible_text(markdown)
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def has_patterns(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text) for pattern in patterns)


def load_fact_bank(path_value: str | None) -> dict[str, Any]:
    if not path_value:
        return {}
    path = Path(path_value)
    if not path.exists():
        return {}
    if path.suffix == ".json":
        return read_json(path)
    return {"raw": path.read_text(encoding="utf-8")}


def fact_bank_has_sources(fact_bank: dict[str, Any]) -> bool:
    facts = fact_bank.get("facts")
    if isinstance(facts, list):
        return bool(facts) and all(item.get("sources") for item in facts if isinstance(item, dict))
    return bool(fact_bank.get("raw"))


def covered_categories(text: str) -> list[str]:
    covered: list[str] = []
    for category, terms in CATEGORY_KEYWORDS.items():
        if any(term in text for term in terms):
            covered.append(category)
    return covered


def bullet_ratio(markdown: str) -> float:
    lines = [line.strip() for line in markdown.splitlines() if line.strip()]
    if not lines:
        return 0.0
    bullet_lines = [line for line in lines if re.match(r"^(\-|\*|\d+[\.、])\s+", line)]
    return len(bullet_lines) / len(lines)


def evaluate_knowledge_checks(article: str, metadata: dict[str, Any]) -> tuple[dict[str, str], list[str], list[str]]:
    text = visible_text(article)
    fact_bank = load_fact_bank(metadata.get("factBankPath"))
    categories = covered_categories(text)
    checks = {
        "no_medical_overclaim": "fail" if has_patterns(text, MEDICAL_OVERCLAIM_PATTERNS) else "pass",
        "no_unsourced_advice": "pass" if fact_bank_has_sources(fact_bank) else "fail",
        "no_fearmongering": "fail" if has_patterns(text, FEARMONGERING_PATTERNS) else "pass",
        "practical_advice_present": "pass" if sum(term in text for term in PRACTICAL_TERMS) >= 5 else "fail",
        "fact_bank_grounded": "pass" if fact_bank_has_sources(fact_bank) and len(categories) >= 4 else "fail",
        "not_listicle_only": "pass"
        if all(f"## 0{i}、" in article for i in range(1, 4)) and bullet_ratio(article) < 0.3
        else "fail",
    }
    issues: list[str] = []
    warnings: list[str] = []
    if checks["no_medical_overclaim"] == "fail":
        issues.append("存在疑似医学过度表达。")
    if checks["no_unsourced_advice"] == "fail":
        issues.append("缺少可追溯 fact bank 来源，无法确认建议来源。")
    if checks["no_fearmongering"] == "fail":
        issues.append("存在疑似医疗恐吓或恐惧化表达。")
    if checks["practical_advice_present"] == "fail":
        issues.append("实操建议不足。")
    if checks["fact_bank_grounded"] == "fail":
        issues.append("文章与 fact bank 覆盖点不足或 fact bank 不可用。")
    if checks["not_listicle_only"] == "fail":
        issues.append("结构疑似清单化，或缺少 01/02/03 模块。")
    if not issues:
        warnings.append("knowledge 专属检查通过：未发现医学过度表达、无来源建议、恐吓化表达或清单百科化问题。")
    return checks, issues, warnings


def evaluate_output(output_dir: Path | str) -> dict[str, Any]:
    root = Path(output_dir)
    article_path = root / "article.md"
    metadata_path = root / "metadata.json"
    article = article_path.read_text(encoding="utf-8") if article_path.exists() else ""
    metadata = read_json(metadata_path)

    issues: list[str] = []
    warnings: list[str] = []
    article_chars = count_article_chars(article)

    if not article:
        issues.append("缺少 article.md 或正文为空。")

    min_chars = metadata.get("minChars")
    max_chars = metadata.get("maxChars")
    if isinstance(min_chars, int) and article_chars < min_chars:
        issues.append(f"正文长度低于要求：{article_chars} < {min_chars}。")
    if isinstance(max_chars, int) and article_chars > max_chars:
        issues.append(f"正文长度超过要求：{article_chars} > {max_chars}。")

    if not all(f"## 0{i}、" in article for i in range(1, 4)):
        issues.append("缺少 01/02/03 模块结构。")

    knowledge_checks: dict[str, str] = {}
    if metadata.get("sourceType") == "topic_knowledge":
        knowledge_checks, knowledge_issues, knowledge_warnings = evaluate_knowledge_checks(article, metadata)
        issues.extend(knowledge_issues)
        warnings.extend(knowledge_warnings)

    status = "ready_for_edit" if not issues else "needs_revision"
    score = max(0, 100 - len(issues) * 12 - max(0, len(warnings) - 1) * 3)
    return {
        "checkedAt": iso_now(),
        "status": status,
        "score": score,
        "articleChars": article_chars,
        "issues": issues,
        "warnings": warnings,
        "knowledgeChecks": knowledge_checks,
    }


def render_report(result: dict[str, Any]) -> str:
    lines = [
        "---",
        "type: quality_report",
        f"checked_at: {result['checkedAt']}",
        f"status: {result['status']}",
        f"score: {result['score']}",
        "---",
        "",
        "# Quality Report",
        "",
        f"- 总分：{result['score']}",
        f"- 状态：`{result['status']}`",
        f"- 正文字数：`{result['articleChars']}`",
        "- 建议下一步：进入网页工作台编辑。" if result["status"] == "ready_for_edit" else "- 建议下一步：人工修订后复检。",
        "",
        "## 主要问题",
        "",
    ]
    if result["issues"]:
        lines.extend(f"- {issue}" for issue in result["issues"])
    else:
        lines.append("- 无")
    lines.extend(["", "## 警告", ""])
    if result["warnings"]:
        lines.extend(f"- {warning}" for warning in result["warnings"])
    else:
        lines.append("- 无")
    if result.get("knowledgeChecks"):
        lines.extend(["", "## Knowledge 专属检查", ""])
        labels = {
            "no_medical_overclaim": "无医学过度表达",
            "no_unsourced_advice": "无无来源建议",
            "no_fearmongering": "无医疗恐吓",
            "practical_advice_present": "存在实操建议",
            "fact_bank_grounded": "基于 fact bank",
            "not_listicle_only": "不是清单百科",
        }
        for key in KNOWLEDGE_CHECKS:
            lines.append(f"- {labels[key]}（{key}）：`{result['knowledgeChecks'].get(key, 'not_checked')}`")
    return "\n".join(lines) + "\n"


def update_metadata(output_dir: Path, result: dict[str, Any]) -> None:
    metadata_path = output_dir / "metadata.json"
    metadata = read_json(metadata_path)
    metadata["updatedAt"] = result["checkedAt"]
    metadata["quality"] = {
        "status": result["status"],
        "score": result["score"],
        "checkedAt": result["checkedAt"],
        "articleChars": result["articleChars"],
        "issues": result["issues"],
        "warnings": result["warnings"],
    }
    if result.get("knowledgeChecks"):
        metadata["quality"]["knowledgeChecks"] = result["knowledgeChecks"]
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(output_dir: Path) -> dict[str, Any]:
    result = evaluate_output(output_dir)
    (output_dir / "quality-report.md").write_text(render_report(result), encoding="utf-8")
    update_metadata(output_dir, result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Run quality checks for a generated ContentFactory output.")
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    result = run(args.output_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "ready_for_edit" else 1


if __name__ == "__main__":
    raise SystemExit(main())
