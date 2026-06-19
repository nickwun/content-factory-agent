#!/usr/bin/env python3
"""
Milestone 29: score topic-driven web-discovery candidates.

This stage only scores search-result metadata. It does not fetch full text,
rewrite, generate images, publish, or enter the production pipeline.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/candidates/"
    "2026-05-26-summer-running-candidates.json"
)
DEFAULT_REGISTRY = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/web-source-registry.json"
)

SCORE_FIELDS = [
    "topicRelevance",
    "practicalValue",
    "evidenceQuality",
    "wechatRewritePotential",
    "chinaContextScore",
    "freshnessScore",
    "noiseScore",
    "decision",
    "rejectReason",
    "reviewReason",
]

RUNNING_TERMS = [
    "跑步",
    "跑者",
    "跑友",
    "慢跑",
    "晨跑",
    "夜跑",
    "长跑",
    "路跑",
    "马拉松",
    "running",
    "runner",
    "jogging",
]

SUMMER_TERMS = [
    "夏季",
    "夏天",
    "夏日",
    "夏令",
    "高温",
    "炎热",
    "炎夏",
    "三伏",
    "暑热",
    "酷暑",
    "hot weather",
    "summer",
    "heat",
]

PRACTICAL_TERMS = [
    "注意事项",
    "怎么跑",
    "安全",
    "补水",
    "饮水",
    "水分",
    "电解质",
    "心率",
    "中暑",
    "热射病",
    "防晒",
    "配速",
    "节奏",
    "晨跑",
    "夜跑",
    "时间",
    "时段",
    "出汗",
    "降温",
    "建议",
    "指南",
    "方法",
    "原则",
    "身体信号",
    "tips",
    "safety",
    "hydration",
    "heart rate",
    "pace",
    "sunscreen",
    "heat stroke",
]

MUST_COVER_TERMS = {
    "高温风险": ["高温", "炎热", "酷暑", "热", "heat"],
    "补水": ["补水", "饮水", "水分", "电解质", "hydration"],
    "配速调整": ["配速", "节奏", "速度", "放慢", "pace"],
    "时间选择": ["时间", "时段", "晨跑", "夜跑", "早晨", "傍晚"],
    "防晒": ["防晒", "晒伤", "紫外线", "sunscreen"],
    "中暑预防": ["中暑", "热射病", "暑热", "heat stroke"],
}

AD_TERMS = [
    "广告",
    "赞助",
    "带货",
    "购买",
    "优惠",
    "折扣",
    "福利",
    "门店",
    "新品",
    "上市",
    "装备推荐",
    "sale",
    "discount",
    "coupon",
    "gear review",
]

RACE_NEWS_TERMS = [
    "报名",
    "赛事报名",
    "赛事服务",
    "路线公布",
    "赛程",
    "中签",
    "鸣枪",
    "开跑",
    "成绩查询",
    "成绩报道",
    "马拉松赛",
    "半程马拉松赛",
    "race registration",
    "race results",
]

MEDICAL_FEAR_TERMS = [
    "猝死",
    "致命",
    "千万别",
    "太可怕",
    "吓人",
    "会要命",
    "跑步会死",
    "热射病死亡",
    "fatal",
    "deadly",
]

LOW_QUALITY_TERMS = [
    "标题党",
    "震惊",
    "99%的人不知道",
    "看完吓一跳",
    "轻松甩肉",
    "不苦熬",
    "暴瘦",
    "月瘦",
    "躺瘦",
    "秘诀",
    "秘籍",
    "神奇",
    "seo",
]

LOW_RELEVANCE_TERMS = [
    "running mate",
    "running for president",
    "running water",
    "running out",
    "running late",
    "跑步机",
    "没有跑步场景",
    "不是跑步",
]

VIDEO_OR_THIN_SOURCES = [
    "bilibili.com",
    "douyin.com",
    "xigua.com",
    "youtube.com",
    "youtu.be",
    "视频",
]

SEARCH_OR_AGGREGATE_PATTERNS = [
    re.compile(r"(^|/)search(/|$)", re.I),
    re.compile(r"(^|/)tag(/|$)", re.I),
    re.compile(r"(^|/)topic(/|$)", re.I),
]

AUTHORITY_SOURCES = [
    "国家体育总局",
    "人民网",
    "新华网",
    "央视网",
    "有来医生",
    "百度健康",
    "丁香医生",
    "春雨医生",
    "梅奥",
    "Cleveland Clinic",
    "Mayo Clinic",
    "Healthline",
    "Verywell Fit",
]

AUTHORITY_HOSTS = [
    "sport.gov.cn",
    "gov.cn",
    "people.com.cn",
    "xinhuanet.com",
    "cctv.com",
    "youlai.cn",
    "chunyuyisheng.com",
    "jiankang.baidu.com",
    "mayoclinic.org",
    "clevelandclinic.org",
    "healthline.com",
    "verywellfit.com",
]


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def candidate_text(candidate: dict[str, Any]) -> str:
    decoded_url = urllib.parse.unquote(str(candidate.get("url", "")))
    return clean_text(
        " ".join(
            [
                str(candidate.get("title", "")),
                str(candidate.get("snippet", "")),
                str(candidate.get("query", "")),
                str(candidate.get("sourceName", "")),
                decoded_url,
            ]
        )
    )


def candidate_visible_text(candidate: dict[str, Any]) -> str:
    return clean_text(
        " ".join(
            [
                str(candidate.get("title", "")),
                str(candidate.get("snippet", "")),
                str(candidate.get("sourceName", "")),
            ]
        )
    )


def count_matches(text: str, terms: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for term in terms if term.lower() in lowered)


def has_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def clamp(value: int, lower: int = 0, upper: int = 10) -> int:
    return max(lower, min(upper, value))


def source_host(candidate: dict[str, Any]) -> str:
    return urllib.parse.urlparse(str(candidate.get("url", ""))).netloc.lower()


def is_search_or_aggregate(candidate: dict[str, Any]) -> bool:
    text = candidate_text(candidate).lower()
    if "搜索结果" in text or "tag页" in text or "专题页" in text or "聚合页" in text:
        return True
    parsed = urllib.parse.urlparse(str(candidate.get("url", "")))
    path = urllib.parse.unquote(parsed.path or "")
    return any(pattern.search(path) for pattern in SEARCH_OR_AGGREGATE_PATTERNS)


def is_authority_source(candidate: dict[str, Any]) -> bool:
    text = candidate_text(candidate)
    host = source_host(candidate)
    return any(name.lower() in text.lower() for name in AUTHORITY_SOURCES) or any(hostname in host for hostname in AUTHORITY_HOSTS)


def is_video_or_thin(candidate: dict[str, Any]) -> bool:
    text = candidate_text(candidate)
    return has_any(text, VIDEO_OR_THIN_SOURCES)


def reject_reasons(candidate: dict[str, Any]) -> list[str]:
    text = candidate_text(candidate)
    visible_text = candidate_visible_text(candidate)
    reasons: list[str] = []
    running_matches = count_matches(text, RUNNING_TERMS)
    visible_running_matches = count_matches(visible_text, RUNNING_TERMS)
    summer_matches = count_matches(text, SUMMER_TERMS)
    practical_matches = count_matches(text, PRACTICAL_TERMS)

    if is_search_or_aggregate(candidate):
        reasons.append("搜索页/聚合页")
    if has_any(text, AD_TERMS):
        reasons.append("装备广告")
    if has_any(text, RACE_NEWS_TERMS):
        reasons.append("赛事报道")
    if has_any(text, MEDICAL_FEAR_TERMS):
        reasons.append("医疗恐吓")
    if has_any(text, LOW_QUALITY_TERMS):
        reasons.append("低质SEO/标题党")
    authority_summer_sport = is_authority_source(candidate) and "运动" in visible_text and summer_matches > 0
    if (
        running_matches == 0
        or (visible_running_matches == 0 and not authority_summer_sport)
        or (summer_matches == 0 and practical_matches <= 1)
        or has_any(text, LOW_RELEVANCE_TERMS)
    ):
        reasons.append("弱相关")
    return list(dict.fromkeys(reasons))


def score_topic_relevance(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    title = str(candidate.get("title", ""))
    score = 0
    if count_matches(text, RUNNING_TERMS):
        score += 3
    if count_matches(title, RUNNING_TERMS):
        score += 2
    if count_matches(text, SUMMER_TERMS):
        score += 3
    if count_matches(title, SUMMER_TERMS):
        score += 1
    if "夏季跑步" in text or "夏天跑步" in text or "高温" in text:
        score += 1
    return clamp(score)


def score_practical_value(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    score = min(count_matches(text, PRACTICAL_TERMS), 6)
    coverage = 0
    for terms in MUST_COVER_TERMS.values():
        if has_any(text, terms):
            coverage += 1
    score += coverage
    if any(word in text for word in ["注意事项", "建议", "指南", "科学", "正确", "怎么跑"]):
        score += 2
    return clamp(score)


def score_evidence_quality(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    score = 2
    if is_authority_source(candidate):
        score += 5
    if any(word in text for word in ["医生", "专家", "运动医学", "指南", "国家体育总局", "研究", "科学"]):
        score += 2
    if candidate.get("language") == "zh":
        score += 1
    if has_any(text, ["知乎", "专栏", "搜狐", "网易", "百度"]):
        score += 1
    if has_any(text, LOW_QUALITY_TERMS + AD_TERMS + MEDICAL_FEAR_TERMS):
        score -= 3
    return clamp(score)


def score_wechat_rewrite_potential(candidate: dict[str, Any], topic_relevance: int, practical_value: int, noise_score: int) -> int:
    text = candidate_text(candidate)
    score = round((topic_relevance + practical_value) / 2)
    if candidate.get("language") == "zh":
        score += 2
    if any(word in text for word in ["注意事项", "怎么跑", "建议", "指南", "不踩坑", "坚持跑步"]):
        score += 1
    if is_authority_source(candidate):
        score -= 2
    if is_video_or_thin(candidate):
        score -= 2
    score -= max(0, noise_score - 4)
    return clamp(score)


def score_china_context(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    host = source_host(candidate)
    if candidate.get("language") == "zh":
        score = 7
    elif candidate.get("language") == "en":
        score = 2
    else:
        score = 4
    if any(hostname in host for hostname in ["zhihu.com", "sohu.com", "163.com", "qq.com", "sina.com.cn", "baidu.com", "sport.gov.cn"]):
        score += 2
    if any(word in text for word in ["中年人", "晨跑", "夜跑", "三伏天", "公众号"]):
        score += 1
    return clamp(score)


def score_freshness(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    years = [int(match) for match in re.findall(r"\b(20[1-3][0-9])\b", text)]
    if not years:
        return 5
    newest = max(years)
    current_year = dt.date.today().year
    if newest >= current_year - 1:
        return 9
    if newest >= current_year - 3:
        return 7
    if newest >= current_year - 6:
        return 5
    return 3


def score_noise(candidate: dict[str, Any], reasons: list[str]) -> int:
    text = candidate_text(candidate)
    score = 0
    for reason in reasons:
        if reason in {"搜索页/聚合页", "装备广告", "赛事报道", "医疗恐吓", "弱相关"}:
            score += 7
        else:
            score += 5
    if is_video_or_thin(candidate):
        score += 2
    if has_any(text, LOW_QUALITY_TERMS):
        score += 3
    return clamp(score)


def decision_for(candidate: dict[str, Any], scores: dict[str, int], reasons: list[str]) -> tuple[str, str, str]:
    if reasons:
        return "rejected", "；".join(reasons), ""

    if is_video_or_thin(candidate):
        return "uncertain", "", "需要人工复核：视频页或摘要较薄，无法确认正文是否可提取"

    if is_authority_source(candidate) and scores["evidenceQuality"] >= 7:
        return "reference_support", "", "适合作为事实支撑，但不作为主改写底稿"

    if (
        scores["topicRelevance"] >= 7
        and scores["practicalValue"] >= 7
        and scores["wechatRewritePotential"] >= 7
        and scores["chinaContextScore"] >= 6
        and scores["noiseScore"] <= 3
        and candidate.get("language") == "zh"
    ):
        return "primary_material", "", "适合进入正文抓取验证，后续仍需检查全文质量"

    if scores["topicRelevance"] >= 5 and scores["practicalValue"] >= 4 and scores["noiseScore"] <= 4:
        return "uncertain", "", "需要人工复核：主题相关，但摘要中的实操完整度或来源可靠性不足"

    return "rejected", "泛泛而谈或实操价值不足", ""


def score_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    reasons = reject_reasons(candidate)
    topic_relevance = score_topic_relevance(candidate)
    practical_value = score_practical_value(candidate)
    evidence_quality = score_evidence_quality(candidate)
    china_context_score = score_china_context(candidate)
    freshness_score = score_freshness(candidate)
    noise_score = score_noise(candidate, reasons)
    scores = {
        "topicRelevance": topic_relevance,
        "practicalValue": practical_value,
        "evidenceQuality": evidence_quality,
        "wechatRewritePotential": score_wechat_rewrite_potential(
            candidate,
            topic_relevance,
            practical_value,
            noise_score,
        ),
        "chinaContextScore": china_context_score,
        "freshnessScore": freshness_score,
        "noiseScore": noise_score,
    }
    decision, reject_reason, review_reason = decision_for(candidate, scores, reasons)
    scored = dict(candidate)
    scored.update(scores)
    scored["decision"] = decision
    scored["rejectReason"] = reject_reason
    scored["reviewReason"] = review_reason
    return scored


def escape_markdown(value: Any) -> str:
    return clean_text(value).replace("|", "｜").replace("\n", " ")


def sort_scored(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decision_rank = {"primary_material": 0, "reference_support": 1, "uncertain": 2, "rejected": 3}
    return sorted(
        candidates,
        key=lambda item: (
            decision_rank.get(str(item.get("decision")), 9),
            -int(item.get("topicRelevance", 0)),
            -int(item.get("practicalValue", 0)),
            -int(item.get("wechatRewritePotential", 0)),
            int(item.get("noiseScore", 0)),
            str(item.get("language")) != "zh",
            str(item.get("title", "")),
        ),
    )


def source_sort_penalty(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    if is_authority_source(candidate):
        return 0
    if has_any(text, ["少数派", "网易", "搜狐", "知乎", "咕咚", "Codoon", "跑滴答", "春雨医生"]):
        return 1
    if has_any(text, ["百度", "今日头条", "新浪财经"]):
        return 2
    if has_any(text, ["什么值得买", "Garmin", "品牌"]):
        return 3
    return 2


def sort_primary_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        candidates,
        key=lambda item: (
            -int(item.get("topicRelevance", 0)),
            -int(item.get("practicalValue", 0)),
            -int(item.get("evidenceQuality", 0)),
            -int(item.get("wechatRewritePotential", 0)),
            source_sort_penalty(item),
            -int(item.get("chinaContextScore", 0)),
            -int(item.get("freshnessScore", 0)),
            str(item.get("title", "")),
        ),
    )


def apply_primary_limit(scored: list[dict[str, Any]], primary_limit: int = 10) -> list[dict[str, Any]]:
    if primary_limit <= 0:
        return [dict(item) for item in scored]
    primary = sort_primary_candidates([item for item in scored if item.get("decision") == "primary_material"])
    keep_ids = {item["sourceId"] for item in primary[:primary_limit]}
    limited: list[dict[str, Any]] = []
    for item in scored:
        next_item = dict(item)
        if item.get("decision") == "primary_material" and item.get("sourceId") not in keep_ids:
            next_item["decision"] = "uncertain"
            next_item["rejectReason"] = ""
            next_item["reviewReason"] = "需要人工复核：主素材数量控制，作为备选候选暂不进入 primary_material"
        limited.append(next_item)
    return limited


def grouped(candidates: list[dict[str, Any]], decision: str) -> list[dict[str, Any]]:
    decision_items = [item for item in candidates if item.get("decision") == decision]
    if decision == "primary_material":
        return sort_primary_candidates(decision_items)
    return sort_scored(decision_items)


def grouped_count(candidates: list[dict[str, Any]]) -> Counter:
    return Counter(item["decision"] for item in candidates)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def output_paths(root: Path, date_label: str, slug: str) -> dict[str, Path]:
    return {
        "primary": root / "selected" / f"{date_label}-{slug}-primary.json",
        "reference": root / "selected" / f"{date_label}-{slug}-reference.json",
        "rejected": root / "rejected" / f"{date_label}-{slug}-rejected.json",
        "markdown": root / "candidates" / f"{date_label}-{slug}-scored.md",
    }


def write_markdown(candidates: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    counts = Counter(item["decision"] for item in candidates)
    lines = [
        "# Milestone 29｜夏季跑步 knowledge_share 候选打分",
        "",
        "说明：本报告只基于搜索结果元数据打分，不抓全文、不改写、不发布。",
        "",
        "## 统计",
        "",
        f"- primary_material：{counts.get('primary_material', 0)}",
        f"- reference_support：{counts.get('reference_support', 0)}",
        f"- uncertain：{counts.get('uncertain', 0)}",
        f"- rejected：{counts.get('rejected', 0)}",
        "",
    ]
    headers = [
        "#",
        "标题链接",
        "语言",
        "sourceName",
        "query",
        "topicRelevance",
        "practicalValue",
        "evidenceQuality",
        "wechatRewritePotential",
        "chinaContextScore",
        "freshnessScore",
        "noiseScore",
        "decision",
        "rejectReason / reviewReason",
        "snippet",
    ]
    for decision in ["primary_material", "reference_support", "uncertain", "rejected"]:
        lines.append(f"## {decision}")
        lines.append("")
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for index, item in enumerate(grouped(candidates, decision), start=1):
            reason = item.get("rejectReason") or item.get("reviewReason") or ""
            title = escape_markdown(item.get("title", ""))
            url = item.get("url", "")
            row = [
                str(index),
                f"[{title}]({url})",
                escape_markdown(item.get("language", "")),
                escape_markdown(item.get("sourceName", "")),
                escape_markdown(item.get("query", "")),
                str(item.get("topicRelevance", "")),
                str(item.get("practicalValue", "")),
                str(item.get("evidenceQuality", "")),
                str(item.get("wechatRewritePotential", "")),
                str(item.get("chinaContextScore", "")),
                str(item.get("freshnessScore", "")),
                str(item.get("noiseScore", "")),
                escape_markdown(item.get("decision", "")),
                escape_markdown(reason),
                escape_markdown(item.get("snippet", "")),
            ]
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_outputs(scored: list[dict[str, Any]], root: Path, date_label: str, slug: str) -> dict[str, Path]:
    paths = output_paths(root, date_label, slug)
    write_json(paths["primary"], grouped(scored, "primary_material"))
    write_json(paths["reference"], grouped(scored, "reference_support"))
    write_json(paths["rejected"], grouped(scored, "rejected"))
    write_markdown(sort_scored(scored), paths["markdown"])
    return paths


def update_registry(scored: list[dict[str, Any]], registry_path: Path) -> Path:
    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    else:
        registry = {"version": 1, "description": "Web discovery source registry", "sources": []}
    by_id = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, dict) and item.get("sourceId")
    }
    scored_at = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    for item in scored:
        source_id = item["sourceId"]
        target = by_id.setdefault(source_id, {"sourceId": source_id})
        for key in [
            "title",
            "url",
            "sourceName",
            "language",
            "query",
            "intent",
            "subIntent",
            "topic",
            "style",
            *SCORE_FIELDS,
        ]:
            if key in item:
                target[key] = item[key]
        target["status"] = item.get("status", target.get("status", "candidate"))
        target["scoredAt"] = scored_at
    registry["sources"] = sorted(by_id.values(), key=lambda item: str(item.get("sourceId", "")))
    registry["updatedAt"] = scored_at
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return registry_path


def load_candidates(input_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload, {}
    if not isinstance(payload, dict):
        raise ValueError("candidate input must be a JSON object or array")
    candidates = payload.get("candidates", [])
    if not isinstance(candidates, list):
        raise ValueError("candidate input object must contain a candidates array")
    return candidates, payload


def infer_date_and_slug(input_path: Path) -> tuple[str, str]:
    match = re.match(r"(\d{4}-\d{2}-\d{2})-(.+?)-candidates\.json$", input_path.name)
    if match:
        return match.group(1), match.group(2)
    date_match = re.search(r"(\d{4}-\d{2}-\d{2})", input_path.name)
    return (date_match.group(1) if date_match else dt.date.today().isoformat(), "topic")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score topic-driven web-discovery candidates.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Candidate JSON input path.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Web source registry path.")
    parser.add_argument("--date", default="", help="Date label for output files.")
    parser.add_argument("--slug", default="", help="Slug for output files.")
    parser.add_argument("--primary-limit", type=int, default=10, help="Maximum primary_material candidates.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    input_path = Path(args.input).expanduser()
    registry_path = Path(args.registry).expanduser()
    inferred_date, inferred_slug = infer_date_and_slug(input_path)
    date_label = args.date or inferred_date
    slug = args.slug or inferred_slug
    root = input_path.parents[1]

    candidates, _payload = load_candidates(input_path)
    scored = apply_primary_limit(
        [score_candidate(candidate) for candidate in candidates],
        primary_limit=args.primary_limit,
    )
    paths = write_outputs(scored, root, date_label, slug)
    update_registry(scored, registry_path)

    counts = grouped_count(scored)
    print(f"input: {input_path}")
    print(f"scored: {len(scored)}")
    print(f"primary_material: {counts.get('primary_material', 0)}")
    print(f"reference_support: {counts.get('reference_support', 0)}")
    print(f"uncertain: {counts.get('uncertain', 0)}")
    print(f"rejected: {counts.get('rejected', 0)}")
    print(f"primaryFile: {paths['primary']}")
    print(f"referenceFile: {paths['reference']}")
    print(f"rejectedFile: {paths['rejected']}")
    print(f"markdownFile: {paths['markdown']}")
    print(f"registry: {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
