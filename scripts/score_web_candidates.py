#!/usr/bin/env python3
"""
Milestone 20: score web-discovery running story candidates.

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
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/candidates/2026-05-22-running-stories.json"
)
DEFAULT_REGISTRY = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/web-source-registry.json"
)

SCORE_FIELDS = [
    "storyScore",
    "runningRelevance",
    "humanStoryScore",
    "oddityScore",
    "chinaContextScore",
    "noiseScore",
    "decision",
    "rejectReason",
    "reviewReason",
]


REJECT_PATTERNS = [
    (
        "游戏",
        [
            "洛克王国",
            "手游",
            "游戏",
            "跑酷",
            "奇遇精灵",
            "捕捉攻略",
            "赛季",
            "剑网3",
            "魔盒",
            "短片",
            "ai视频",
            "动漫",
            "影视",
            "电影解说",
            "凶杀案",
        ],
    ),
    (
        "虚构故事",
        [
            "小说",
            "虚构",
            "短篇故事",
            "absurdshortstories",
            "fiction",
            "substack publication",
            "ai短片",
            "神傳文化",
        ],
    ),
    (
        "搜索页",
        [
            "/search/",
            "/topic/",
            "/tag/",
            "搜索结果",
            "专题",
            "话题",
        ],
    ),
    (
        "训练科普",
        [
            "训练计划",
            "训练方法",
            "教程",
            "指南",
            "如何正确跑步",
            "伤病预防",
            "恢复指南",
            "健康科普",
            "医学科普",
            "运动科普",
            "科普",
            "百度健康",
            "国家体育总局",
            "5招教你",
            "全攻略",
            "身体出现这些情况",
            "千万别大意",
            "身体会发生",
            "身体会发生什么变化",
            "经常跑步，身体会发生",
            "长期坚持跑步的人，你会收获",
            "跑步别太猛",
            "胸外按压",
            "aed",
            "急救",
            "猝死",
            "心脏骤停",
            "心脏真有可能",
            "该如何应对",
            "如何应对",
            "突发状况",
            "科学家给出答案",
            "科学拆解",
            "研究表明",
            "医学研究",
            "内啡肽",
            "多巴胺",
            "小步慢跑",
            "燃烧体内的脂肪",
            "腿越来越粗",
            "跑步的好处",
            "减肥真相",
            "跑步减肥",
            "减肥误区",
            "体脂",
            "配速",
            "跑量",
            "zone 2",
            "workout",
            "training plan",
        ],
    ),
    (
        "装备广告",
        [
            "跑鞋",
            "装备",
            "带货",
            "优惠",
            "限时",
            "购买",
            "门店",
            "品牌",
            "福利",
            "上市",
            "gear",
            "shoes",
            "coupon",
            "discount",
            "sale",
        ],
    ),
    (
        "赛事通稿",
        [
            "报名",
            "成绩报道",
            "成绩查询",
            "官方通稿",
            "通稿",
            "路线公布",
            "赛事报名",
            "开跑",
            "圆满成功",
            "快讯",
            "发布会",
            "冠军，跑步途中突然倒地",
            "女子冠军",
        ],
    ),
    (
        "纯鸡汤",
        [
            "遇见更好的自己",
            "深度好文",
            "文案",
            "朋友圈",
            "人生智慧",
            "生活的修行",
            "坚持就是",
            "正能量",
            "改变的不仅是身材",
            "转运最好的方式",
        ],
    ),
    (
        "弱相关",
        [
            "跑步机",
            "邓超",
            "刘亦菲",
            "投资建议",
            "小面",
            "水银泻地",
            "夜哀鸣",
            "王国",
        ],
    ),
]

SOFT_REVIEW_PATTERNS = [
    (
        "多故事/盘点类候选，需要人工确认是否能拆出具体人物或事件",
        [
            "108个",
            "35个真实跑步故事",
            "100个",
            "一百余位",
            "系列故事书",
            "故事书",
            "盘点",
            "细数",
            "那些\"奇葩怪事\"",
            "那些“奇葩怪事”",
            "你知道几个",
            "怪现象",
            "怪象",
            "三个故事",
            "几个故事",
            "多位跑者",
            "多个故事",
            "故事合集",
        ],
    ),
    (
        "泛观点/原因列表类候选，需要人工确认是否有具体人物事件",
        [
            "说明了这4个原因",
            "这4个原因",
            "4个原因",
            "四个原因",
            "4层深意",
            "背后藏着的4层深意",
        ],
    ),
]

RUNNING_TERMS = [
    "跑步",
    "跑者",
    "跑友",
    "跑马",
    "马拉松",
    "越野跑",
    "晨跑",
    "夜跑",
    "慢跑",
    "running",
    "runner",
    "jogger",
    "marathon",
    "ultramarathon",
    "5公里",
    "五公里",
    "10公里",
    "42.195",
    "100英里",
    "英里",
    "跑道",
]

STRONG_HUMAN_TERMS = [
    "没有背景",
    "无人指导",
    "艰辛",
    "限制",
    "逆袭",
    "走出低谷",
    "走出阴霾",
    "救了我",
    "戒酒",
    "胃出血",
    "体检报告",
    "戒烟戒酒",
    "戒烟",
    "抽烟喝酒",
    "透支的人生",
    "第一次挑战",
    "从冰毒成瘾",
    "成瘾",
    "人生低谷",
    "每周跑100英里",
    "大器晚成",
    "退休一年后",
    "一发不可收拾",
    "人生转折点",
    "情绪出口",
    "失眠",
    "焦虑",
    "减了20斤",
    "20斤",
    "15年夫妻",
    "6年跑友",
    "首个全马",
    "真实记录",
    "普通人的非凡",
    "心路历程",
    "三次命",
    "老陈",
    "吴浩然",
    "冯唐",
    "中年妈妈",
    "52岁",
    "47岁",
    "32岁",
]

STRONG_ODDITY_TERMS = [
    "名叫",
    "边拉肚子边跑",
    "满腿",
    "踢起正步",
    "无意识",
    "偏离赛道",
    "蹭跑",
    "号码布",
    "社死",
    "尴尬",
]

PERSON_EVENT_TERMS = [
    "男子",
    "女子",
    "小伙",
    "阿姨",
    "大叔",
    "妈妈",
    "夫妻",
    "中年",
    "退休",
    "医生",
    "选手",
    "跑者",
    "跑友",
    "ordinary",
    "amateur",
    "runner",
    "coach",
    "我",
    "他",
    "她",
    "他们",
]

CONFLICT_TERMS = [
    "突然",
    "意外",
    "离奇",
    "奇葩",
    "奇闻",
    "怪事",
    "反转",
    "糗事",
    "尴尬",
    "社死",
    "抢救",
    "休克",
    "无意识",
    "抑郁",
    "低谷",
    "戒酒",
    "减肥",
    "改变人生",
    "改变生活",
    "救了我",
    "重生",
    "crisis",
    "saved my life",
    "changed my life",
    "bizarre",
    "strange",
    "weird",
    "absurd",
]

DETAIL_TERMS = [
    "岁",
    "年",
    "公里",
    "第一次",
    "三次",
    "五公里",
    "全程",
    "途中",
    "赛道",
    "医生",
    "故事",
    "经历",
    "发生",
    "12小时",
    "100公里",
    "100英里",
    "miles",
    "year",
    "years",
    "marathon",
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


def count_matches(text: str, terms: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for term in terms if term.lower() in lowered)


def clamp(value: int, lower: int = 0, upper: int = 10) -> int:
    return max(lower, min(upper, value))


def reject_reasons(candidate: dict[str, Any]) -> list[str]:
    text = candidate_text(candidate)
    lowered = text.lower()
    reasons = []
    for reason, needles in REJECT_PATTERNS:
        if any(needle.lower() in lowered for needle in needles):
            reasons.append(reason)
    if count_matches(text, RUNNING_TERMS) <= 0:
        reasons.append("弱相关")
    return list(dict.fromkeys(reasons))


def soft_review_reasons(candidate: dict[str, Any]) -> list[str]:
    text = candidate_text(candidate)
    lowered = text.lower()
    reasons = []
    for reason, needles in SOFT_REVIEW_PATTERNS:
        if any(needle.lower() in lowered for needle in needles):
            reasons.append(reason)
    return list(dict.fromkeys(reasons))


def score_running_relevance(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    title = str(candidate.get("title", ""))
    score = count_matches(text, RUNNING_TERMS) * 2
    if count_matches(title, RUNNING_TERMS):
        score += 4
    if candidate.get("category") in {"oddity", "human_story"}:
        score += 1
    return clamp(score)


def score_human_story(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    score = count_matches(text, PERSON_EVENT_TERMS) + count_matches(text, DETAIL_TERMS)
    score += min(count_matches(text, STRONG_HUMAN_TERMS), 3)
    if any(term in text for term in ["故事", "经历", "自白", "人生", "生活", "低谷", "戒酒", "抑郁"]):
        score += 3
    if candidate.get("category") == "human_story":
        score += 2
    return clamp(score)


def score_oddity(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    score = count_matches(text, CONFLICT_TERMS) * 2
    if candidate.get("category") == "oddity":
        score += 2
    return clamp(score)


def score_china_context(candidate: dict[str, Any]) -> int:
    language = candidate.get("language")
    source = str(candidate.get("sourceName", ""))
    url = str(candidate.get("url", ""))
    if language == "zh":
        score = 7
    elif language == "en":
        score = 2
    else:
        score = 4
    if any(host in source for host in ["网易", "腾讯", "搜狐", "新浪", "今日头条", "澎湃", "中新网", "百度"]):
        score += 2
    if ".cn" in url or "163.com" in url or "qq.com" in url or "sohu.com" in url:
        score += 1
    return clamp(score)


def score_noise(candidate: dict[str, Any], reasons: list[str]) -> int:
    if not reasons:
        return 0
    severe = {"游戏", "虚构故事", "搜索页", "训练科普", "装备广告", "赛事通稿", "弱相关"}
    score = 0
    for reason in reasons:
        score += 8 if reason in severe else 6
    return clamp(score)


def combined_story_score(
    running_relevance: int,
    human_story_score: int,
    oddity_score: int,
    china_context_score: int,
    noise_score: int,
) -> int:
    score = (
        running_relevance * 2.5
        + human_story_score * 2.0
        + oddity_score * 1.8
        + china_context_score * 1.2
        - noise_score * 4.5
    )
    return max(0, min(100, round(score)))


def decision_for(candidate: dict[str, Any], scores: dict[str, int], reasons: list[str]) -> tuple[str, str, str]:
    if reasons:
        return "rejected", "；".join(reasons), ""

    soft_reasons = soft_review_reasons(candidate)
    if soft_reasons:
        return "uncertain", "", "需要人工复核：" + "；".join(soft_reasons)

    has_story_signal = scores["humanStoryScore"] >= 5 or scores["oddityScore"] >= 5
    selected_threshold = 55 if candidate.get("language") == "zh" else 65
    text = candidate_text(candidate)
    strong_human_signal = (
        candidate.get("language") == "zh"
        and scores["humanStoryScore"] >= 8
        and scores["storyScore"] >= 50
        and count_matches(text, STRONG_HUMAN_TERMS) >= 1
    )
    strong_oddity_signal = (
        candidate.get("language") == "zh"
        and scores["oddityScore"] >= 7
        and scores["runningRelevance"] >= 7
        and scores["storyScore"] >= 50
        and count_matches(text, STRONG_ODDITY_TERMS) >= 1
    )

    if (
        (scores["storyScore"] >= selected_threshold or strong_human_signal or strong_oddity_signal)
        and scores["runningRelevance"] >= 7
        and has_story_signal
        and scores["noiseScore"] <= 3
    ):
        return "selected", "", "适合进入正文抓取前的人工确认"

    if scores["runningRelevance"] >= 5 and scores["storyScore"] >= 35:
        return "uncertain", "", "需要人工复核：搜索摘要显示一定故事性，但人物/事件/冲突细节不足"

    return "rejected", "跑步只是弱相关或故事性不足", ""


def score_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    reasons = reject_reasons(candidate)
    running_relevance = score_running_relevance(candidate)
    human_story_score = score_human_story(candidate)
    oddity_score = score_oddity(candidate)
    china_context_score = score_china_context(candidate)
    noise_score = score_noise(candidate, reasons)
    story_score = combined_story_score(
        running_relevance,
        human_story_score,
        oddity_score,
        china_context_score,
        noise_score,
    )
    scores = {
        "storyScore": story_score,
        "runningRelevance": running_relevance,
        "humanStoryScore": human_story_score,
        "oddityScore": oddity_score,
        "chinaContextScore": china_context_score,
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
    decision_rank = {"selected": 0, "uncertain": 1, "rejected": 2}
    return sorted(
        candidates,
        key=lambda item: (
            decision_rank.get(str(item.get("decision")), 9),
            -int(item.get("storyScore", 0)),
            int(item.get("noiseScore", 0)),
            str(item.get("language")) != "zh",
            str(item.get("title", "")),
        ),
    )


def grouped(candidates: list[dict[str, Any]], decision: str) -> list[dict[str, Any]]:
    return [item for item in sort_scored(candidates) if item.get("decision") == decision]


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_markdown(candidates: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    counts = Counter(item["decision"] for item in candidates)
    lines = [
        "# Milestone 20｜Web Discovery 跑步故事候选打分",
        "",
        "说明：本报告只基于搜索结果元数据打分，不抓全文、不改写、不发布。",
        "",
        "## 统计",
        "",
        f"- selected：{counts.get('selected', 0)}",
        f"- uncertain：{counts.get('uncertain', 0)}",
        f"- rejected：{counts.get('rejected', 0)}",
        "",
    ]
    headers = [
        "#",
        "标题链接",
        "语言",
        "类别",
        "sourceName",
        "query",
        "storyScore",
        "noiseScore",
        "decision",
        "rejectReason / reviewReason",
        "snippet",
    ]
    for decision in ["selected", "uncertain", "rejected"]:
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
                escape_markdown(item.get("category", "")),
                escape_markdown(item.get("sourceName", "")),
                escape_markdown(item.get("query", "")),
                str(item.get("storyScore", "")),
                str(item.get("noiseScore", "")),
                escape_markdown(item.get("decision", "")),
                escape_markdown(reason),
                escape_markdown(item.get("snippet", "")),
            ]
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def output_paths(root: Path, date_label: str) -> dict[str, Path]:
    return {
        "selected": root / "selected" / f"{date_label}-selected.json",
        "rejected": root / "rejected" / f"{date_label}-rejected.json",
        "markdown": root / "candidates" / f"{date_label}-scored.md",
    }


def write_outputs(scored: list[dict[str, Any]], root: Path, date_label: str) -> dict[str, Path]:
    paths = output_paths(root, date_label)
    write_json(paths["selected"], grouped(scored, "selected"))
    write_json(paths["rejected"], grouped(scored, "rejected"))
    write_markdown(sort_scored(scored), paths["markdown"])
    return paths


def update_registry(scored: list[dict[str, Any]], registry_path: Path) -> Path:
    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    else:
        registry = {"version": 1, "sources": []}
    by_id = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, dict) and item.get("sourceId")
    }
    for item in scored:
        source_id = item["sourceId"]
        target = by_id.setdefault(source_id, {"sourceId": source_id})
        for key in [
            "title",
            "url",
            "sourceName",
            "language",
            "category",
            "query",
            *SCORE_FIELDS,
        ]:
            if key in item:
                target[key] = item[key]
        target["scoredAt"] = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    registry["sources"] = sorted(by_id.values(), key=lambda item: str(item.get("sourceId", "")))
    registry["updatedAt"] = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return registry_path


def infer_date_label(input_path: Path) -> str:
    match = re.search(r"(\d{4}-\d{2}-\d{2})", input_path.name)
    return match.group(1) if match else dt.date.today().isoformat()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score web-discovery running story candidates.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Candidate JSON input path.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Web source registry path.")
    parser.add_argument("--date", default="", help="Date label for output files.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    input_path = Path(args.input).expanduser()
    registry_path = Path(args.registry).expanduser()
    date_label = args.date or infer_date_label(input_path)
    root = input_path.parents[1]

    candidates = json.loads(input_path.read_text(encoding="utf-8"))
    scored = [score_candidate(candidate) for candidate in candidates]
    paths = write_outputs(scored, root, date_label)
    update_registry(scored, registry_path)

    counts = Counter(item["decision"] for item in scored)
    selected_zh = sum(1 for item in scored if item["decision"] == "selected" and item.get("language") == "zh")
    print(f"input: {input_path}")
    print(f"scored: {len(scored)}")
    print(f"selected: {counts.get('selected', 0)}")
    print(f"uncertain: {counts.get('uncertain', 0)}")
    print(f"rejected: {counts.get('rejected', 0)}")
    print(f"selected_zh: {selected_zh}")
    print(f"selectedFile: {paths['selected']}")
    print(f"rejectedFile: {paths['rejected']}")
    print(f"markdownFile: {paths['markdown']}")
    print(f"registry: {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
