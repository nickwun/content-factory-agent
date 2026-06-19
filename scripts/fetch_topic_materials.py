#!/usr/bin/env python3
"""
Milestone 30: fetch and normalize topic-driven knowledge-share materials.

This stage builds a multi-source material package. It does not rewrite,
generate articles, generate images, publish, or enter the production pipeline.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


DEFAULT_PRIMARY = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/selected/"
    "2026-05-26-summer-running-primary.json"
)
DEFAULT_REFERENCE = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/selected/"
    "2026-05-26-summer-running-reference.json"
)
DEFAULT_REGISTRY = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/web-source-registry.json"
)
DEFAULT_PACKAGE_DIR = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/topic-materials/"
    "2026-05-26-summer-running"
)

MIN_BODY_LENGTH = 500

COVERAGE_TAGS = [
    "高温风险",
    "补水",
    "配速调整",
    "心率管理",
    "时间选择",
    "防晒",
    "中暑预防",
    "恢复与降强度",
]

SELECTION_TAG_ORDER = [
    "心率管理",
    "中暑预防",
    "补水",
    "配速调整",
    "时间选择",
    "防晒",
    "高温风险",
    "恢复与降强度",
]

COVERAGE_TERMS = {
    "高温风险": ["高温", "炎热", "酷暑", "三伏", "热天", "热浪", "heat", "hot weather"],
    "补水": ["补水", "饮水", "喝水", "水分", "脱水", "电解质", "hydration"],
    "配速调整": ["配速", "速度", "节奏", "放慢", "慢跑", "降速", "pace"],
    "心率管理": ["心率", "心跳", "最大心率", "心肺", "heart rate"],
    "时间选择": ["晨跑", "夜跑", "清晨", "傍晚", "晚上", "时段", "时间", "避开", "早上"],
    "防晒": ["防晒", "晒伤", "紫外线", "遮阳", "太阳镜", "树荫", "皮肤癌", "sunscreen"],
    "中暑预防": ["中暑", "热射病", "热衰竭", "暑热", "heat stroke", "heat illness"],
    "恢复与降强度": ["恢复", "降强度", "降低强度", "减少运动量", "休息", "降温", "停止跑步", "调整训练"],
}

RUNNING_TERMS = ["跑步", "跑者", "跑友", "慢跑", "晨跑", "夜跑", "长跑", "路跑", "马拉松", "running", "runner"]
PRACTICAL_TERMS = ["注意", "建议", "指南", "方法", "补水", "配速", "心率", "中暑", "防晒", "时间", "安全"]

AD_TERMS = ["广告", "赞助", "带货", "优惠", "折扣", "福利", "新品", "门店", "跑鞋推荐"]
SELECTION_PENALTY_TERMS = ["TB", "JD", "PDD", "电商平台", "搜索一下", "优惠", "折扣", "带货", "跑鞋推荐"]
RACE_TERMS = ["赛事报名", "报名开启", "路线公布", "成绩查询", "成绩报道", "鸣枪", "中签"]
MEDICAL_FEAR_TERMS = ["猝死", "千万别", "太可怕", "吓人", "会要命", "跑步会死"]
LOW_SEO_TERMS = ["99%的人不知道", "看完吓一跳", "轻松甩肉", "暴瘦", "不苦熬", "秘籍", "秘诀", "神奇"]
PLATFORM_TERMS = ["搜索结果", "相关搜索", "话题页", "tag页", "专题页"]
NOISE_TERMS = [
    "推荐阅读",
    "热门推荐",
    "相关推荐",
    "广告推广",
    "下载APP",
    "下载今日头条APP",
    "扫码下载",
    "用微信扫码二维码",
    "分享至好友和朋友圈",
]
BOILERPLATE_LINES = [
    "用微信扫码二维码",
    "分享至好友和朋友圈",
    "特别声明",
    "Notice: The content above",
    "返回搜狐",
    "责任编辑",
    "举报/反馈",
    "打开APP",
    "下载APP",
    "相关阅读",
    "热门推荐",
    "相关推荐",
]


@dataclass
class Article:
    title: str
    body: str
    extraction_method: str


@dataclass
class QualityFlags:
    has_ad_pollution: bool
    has_medical_fear: bool
    has_race_news: bool
    has_low_quality_seo: bool
    has_page_noise: bool


@dataclass
class QualityEvaluation:
    can_normalize: bool
    reason: str
    usable_for_fact_bank: bool
    needs_manual_review: bool
    flags: QualityFlags


@dataclass
class FetchResult:
    candidate: dict[str, Any]
    material_role: str
    fetch_status: str
    extracted_title: str
    body: str
    body_length: int
    coverage_tags: list[str]
    quality_flags: QualityFlags
    usable_for_fact_bank: bool
    needs_manual_review: bool
    reason: str
    normalized_path: Path | None
    fetch_note_path: Path | None
    fetched_at: str


class TextExtractor(HTMLParser):
    block_tags = {"p", "div", "section", "article", "br", "li", "h1", "h2", "h3", "h4", "blockquote"}
    skip_tags = {"script", "style", "noscript", "svg", "canvas", "iframe", "nav", "footer", "header"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.skip_tags:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.skip_tags and self.skip_depth:
            self.skip_depth -= 1
            return
        if self.skip_depth:
            return
        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth and data:
            self.parts.append(data)

    def text(self) -> str:
        return "".join(self.parts)


def now_iso() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def count_matches(text: str, terms: list[str]) -> int:
    lowered = text.lower()
    return sum(lowered.count(term.lower()) for term in terms)


def has_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def body_length(body: str) -> int:
    return len(re.sub(r"\s+", "", body or ""))


def candidate_text(candidate: dict[str, Any]) -> str:
    return clean_text(
        " ".join(
            [
                str(candidate.get("title", "")),
                str(candidate.get("snippet", "")),
                str(candidate.get("query", "")),
                str(candidate.get("sourceName", "")),
                urllib.parse.unquote(str(candidate.get("url", ""))),
            ]
        )
    )


def detect_coverage_tags(text: str) -> list[str]:
    tags = []
    for tag in COVERAGE_TAGS:
        if has_any(text, COVERAGE_TERMS[tag]):
            tags.append(tag)
    return tags


def coverage_tags_for_candidate(candidate: dict[str, Any]) -> list[str]:
    return detect_coverage_tags(candidate_text(candidate))


def coverage_tags_for_selection(candidate: dict[str, Any]) -> list[str]:
    text = clean_text(
        " ".join(
            [
                str(candidate.get("title", "")),
                str(candidate.get("snippet", "")),
                str(candidate.get("query", "")),
                str(candidate.get("sourceName", "")),
                urllib.parse.unquote(str(candidate.get("url", ""))),
            ]
        )
    )
    return detect_coverage_tags(text)


def direct_coverage_tags_for_selection(candidate: dict[str, Any]) -> list[str]:
    text = clean_text(
        " ".join(
            [
                str(candidate.get("title", "")),
                str(candidate.get("query", "")),
                urllib.parse.unquote(str(candidate.get("url", ""))),
            ]
        )
    )
    return detect_coverage_tags(text)


def source_rank(candidate: dict[str, Any]) -> int:
    text = candidate_text(candidate)
    if has_any(text, ["国家体育总局", "央视网", "有来医生", "百度健康", "春雨医生"]):
        return 0
    if has_any(text, ["网易", "搜狐", "知乎", "咕咚", "Codoon", "跑滴答"]):
        return 1
    if has_any(text, ["新浪", "今日头条"]):
        return 2
    return 3


def candidate_score(candidate: dict[str, Any], uncovered: set[str]) -> tuple[int, int, int, int]:
    tags = set(coverage_tags_for_selection(candidate))
    direct_tags = set(direct_coverage_tags_for_selection(candidate))
    penalty = count_matches(candidate_text(candidate), SELECTION_PENALTY_TERMS)
    return (
        len(direct_tags & uncovered) * 3 + len(tags & uncovered) - penalty,
        int(candidate.get("topicRelevance", 0)) + int(candidate.get("practicalValue", 0)),
        int(candidate.get("evidenceQuality", 0)) + int(candidate.get("wechatRewritePotential", 0)),
        -source_rank(candidate),
    )


def select_for_role(candidates: list[dict[str, Any]], material_role: str, count: int) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    used: set[str] = set()
    covered: set[str] = set()
    for tag in SELECTION_TAG_ORDER:
        if len(selected) >= count:
            break
        if tag in covered:
            continue
        pool = [
            item
            for item in candidates
            if item.get("sourceId") not in used and tag in coverage_tags_for_selection(item)
        ]
        if not pool:
            continue
        best = sorted(pool, key=lambda item: candidate_score(item, {tag}), reverse=True)[0]
        best = dict(best)
        best["_materialRole"] = material_role
        selected.append(best)
        used.add(str(best.get("sourceId")))
        covered.update(coverage_tags_for_selection(best))

    while len(selected) < count:
        uncovered = set(COVERAGE_TAGS)
        for item in selected:
            uncovered -= set(coverage_tags_for_selection(item))
        pool = [item for item in candidates if item.get("sourceId") not in used]
        if not pool:
            break
        best = sorted(pool, key=lambda item: candidate_score(item, uncovered), reverse=True)[0]
        best = dict(best)
        best["_materialRole"] = material_role
        selected.append(best)
        used.add(str(best.get("sourceId")))
        covered.update(coverage_tags_for_selection(best))
    return selected[:count]


def select_attempt_candidates(
    primary: list[dict[str, Any]],
    reference: list[dict[str, Any]],
    per_role: int = 5,
) -> dict[str, list[dict[str, Any]]]:
    return {
        "primary_material": select_for_role(primary, "primary_material", per_role),
        "reference_support": select_for_role(reference, "reference_support", per_role),
    }


def fetch_html(url: str, timeout: int = 25) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        content_type = response.headers.get("content-type", "")
    charset_match = re.search(r"charset=([\w.-]+)", content_type, flags=re.I)
    if charset_match:
        encoding = charset_match.group(1)
    else:
        head = raw[:4096].decode("utf-8", errors="ignore")
        meta = re.search(r"charset=[\"']?([\w.-]+)", head, flags=re.I)
        encoding = meta.group(1) if meta else "utf-8"
    return raw.decode(encoding, errors="replace")


def html_fragment_to_text(fragment: str) -> str:
    fragment = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    parser = TextExtractor()
    parser.feed(fragment)
    raw = html.unescape(parser.text())
    lines = []
    seen: set[str] = set()
    for line in re.split(r"\n+", raw):
        cleaned = re.sub(r"[ \t\u3000]+", " ", line).strip()
        if not cleaned:
            continue
        if len(cleaned) <= 1:
            continue
        if any(needle in cleaned for needle in BOILERPLATE_LINES):
            continue
        if re.fullmatch(r"[\d\s.。:/-]+", cleaned):
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        lines.append(cleaned)
    return "\n\n".join(lines).strip()


def clean_title(title: str) -> str:
    value = html.unescape(clean_text(title))
    value = re.sub(r"_网易订阅$", "", value)
    value = re.sub(r"_腾讯新闻$", "", value)
    value = re.sub(r"_搜狐体育_搜狐网$", "", value)
    value = re.sub(r"\|[^|]*网易订阅$", "", value)
    value = re.sub(r"\|[^|]*新浪.*$", "", value)
    return value.strip()


def meta_content(html_text: str, key: str) -> str:
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(key)}["\']',
        rf'<meta[^>]+name=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text, flags=re.I | re.S)
        if match:
            return html.unescape(match.group(1))
    return ""


def extract_title(html_text: str) -> str:
    title = meta_content(html_text, "og:title") or meta_content(html_text, "title")
    if not title:
        match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.I | re.S)
        title = match.group(1) if match else ""
    return clean_title(title)


def extract_tag_fragment(html_text: str, tag_name: str) -> str:
    match = re.search(rf"<{tag_name}\b[^>]*>(.*?)</{tag_name}>", html_text, flags=re.I | re.S)
    return match.group(1) if match else ""


def extract_div_by_class(html_text: str, class_name: str) -> str:
    pattern = re.compile(rf'<div\b[^>]*class=["\'][^"\']*\b{re.escape(class_name)}\b[^"\']*["\'][^>]*>', re.I)
    match = pattern.search(html_text)
    if not match:
        return ""
    start = match.end()
    pos = start
    depth = 1
    tag_pattern = re.compile(r"</?div\b[^>]*>", re.I)
    for tag_match in tag_pattern.finditer(html_text, start):
        tag = tag_match.group(0)
        if tag.startswith("</"):
            depth -= 1
            if depth == 0:
                return html_text[start : tag_match.start()]
        else:
            depth += 1
        pos = tag_match.end()
    return html_text[start:pos]


def decode_json_string(value: str) -> str:
    try:
        decoded = json.loads(f'"{value}"')
        return decoded if isinstance(decoded, str) else value
    except json.JSONDecodeError:
        return value


def extract_json_article_body(html_text: str) -> str:
    candidates = []
    for key in ["articleContent", "content", "originContent", "body", "text"]:
        for match in re.finditer(rf'"{key}"\s*:\s*"((?:\\.|[^"\\])*)"', html_text, flags=re.S):
            value = decode_json_string(match.group(1))
            if "<" in value:
                value = html_fragment_to_text(value)
            else:
                value = clean_text(value)
            if body_length(value) > 200:
                candidates.append(value)
    return max(candidates, key=body_length) if candidates else ""


def extract_article(html_text: str, url: str) -> Article:
    title = extract_title(html_text)
    fragments: list[tuple[str, str]] = []
    for tag in ["article", "main"]:
        fragment = extract_tag_fragment(html_text, tag)
        if fragment:
            fragments.append((tag, fragment))
    for class_name in [
        "post_body",
        "rich_media_content",
        "article-content",
        "article_content",
        "article",
        "content",
        "text",
        "main-content",
    ]:
        fragment = extract_div_by_class(html_text, class_name)
        if fragment:
            fragments.append((class_name, fragment))
    json_body = extract_json_article_body(html_text)
    if json_body:
        fragments.append(("json_article", json_body))
    if not fragments:
        body_match = re.search(r"<body[^>]*>(.*?)</body>", html_text, flags=re.I | re.S)
        fragments.append(("body", body_match.group(1) if body_match else html_text))

    best_method = ""
    best_body = ""
    for method, fragment in fragments:
        text = fragment if method == "json_article" and "<" not in fragment else html_fragment_to_text(fragment)
        if body_length(text) > body_length(best_body):
            best_method = method
            best_body = text
    return Article(title=title, body=best_body, extraction_method=best_method or "generic")


def detect_quality_flags(text: str) -> QualityFlags:
    lowered = text.lower()
    explicit_commercial = has_any(text, AD_TERMS) or (
        "购买" in text and any(term in text for term in ["优惠", "折扣", "带货", "下单", "店铺"])
    )
    return QualityFlags(
        has_ad_pollution=explicit_commercial or has_any(text, NOISE_TERMS),
        has_medical_fear=has_any(text, MEDICAL_FEAR_TERMS),
        has_race_news=has_any(text, RACE_TERMS),
        has_low_quality_seo=has_any(text, LOW_SEO_TERMS),
        has_page_noise=has_any(text, PLATFORM_TERMS),
    )


def is_search_or_platform_page(candidate: dict[str, Any]) -> bool:
    url = str(candidate.get("url", "")).lower()
    return any(needle in url for needle in ["/search/", "/tag/", "/topic/"])


def evaluate_quality(candidate: dict[str, Any], body: str) -> QualityEvaluation:
    length = body_length(body)
    flags = detect_quality_flags(candidate_text(candidate) + " " + body)
    if length < MIN_BODY_LENGTH:
        return QualityEvaluation(False, f"正文长度不足：{length} < {MIN_BODY_LENGTH}", False, True, flags)
    if is_search_or_platform_page(candidate) or flags.has_page_noise:
        return QualityEvaluation(False, "疑似搜索页/平台页", False, True, flags)
    if flags.has_ad_pollution:
        return QualityEvaluation(False, "疑似广告/软广污染", False, True, flags)
    if flags.has_race_news:
        return QualityEvaluation(False, "疑似赛事报道倾向", False, True, flags)
    if flags.has_medical_fear:
        return QualityEvaluation(False, "疑似医疗恐吓倾向", False, True, flags)
    if flags.has_low_quality_seo:
        return QualityEvaluation(False, "疑似低质SEO水文", False, True, flags)
    candidate_role = str(candidate.get("_materialRole") or candidate.get("decision") or "")
    reference_context = candidate_role == "reference_support" and count_matches(candidate_text(candidate), RUNNING_TERMS) >= 1
    if count_matches(body, RUNNING_TERMS) < 2 and not reference_context:
        return QualityEvaluation(False, "跑步主题不足", False, True, flags)
    tags = detect_coverage_tags(body)
    if len(tags) < 2 or count_matches(body, PRACTICAL_TERMS) < 3:
        return QualityEvaluation(False, "实用建议或事实参考价值不足", False, True, flags)
    needs_manual_review = length < 900 or len(tags) < 3
    return QualityEvaluation(True, "", True, needs_manual_review, flags)


def slugify(value: str, fallback: str) -> str:
    ascii_part = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    if ascii_part:
        return ascii_part[:70]
    return fallback


def yaml_quote(value: Any) -> str:
    if value is None:
        return "null"
    return json.dumps(str(value), ensure_ascii=False)


def yaml_list(values: list[str]) -> list[str]:
    if not values:
        return ["coverageTags: []"]
    lines = ["coverageTags:"]
    lines.extend(f"  - {yaml_quote(value)}" for value in values)
    return lines


def markdown_for_result(result: FetchResult) -> str:
    item = result.candidate
    frontmatter = [
        "---",
        f"sourceId: {yaml_quote(item.get('sourceId'))}",
        "sourceType: topic_material",
        f"topic: {yaml_quote(item.get('topic') or '夏季跑步')}",
        f"intent: {yaml_quote(item.get('intent') or 'knowledge_share')}",
        f"materialRole: {result.material_role}",
        f"url: {yaml_quote(item.get('url'))}",
        f"title: {yaml_quote(result.extracted_title or item.get('title'))}",
        f"sourceName: {yaml_quote(item.get('sourceName'))}",
        f"language: {yaml_quote(item.get('language'))}",
        f"topicRelevance: {int(item.get('topicRelevance', 0))}",
        f"practicalValue: {int(item.get('practicalValue', 0))}",
        f"evidenceQuality: {int(item.get('evidenceQuality', 0))}",
        f"wechatRewritePotential: {int(item.get('wechatRewritePotential', 0))}",
        f"chinaContextScore: {int(item.get('chinaContextScore', 0))}",
        f"fetchedAt: {yaml_quote(result.fetched_at)}",
        f"bodyLength: {result.body_length}",
        *yaml_list(result.coverage_tags),
        "status: normalized",
        "---",
        "",
        f"# {result.extracted_title or item.get('title', '')}",
        "",
        f"> 原始链接：[{item.get('sourceName', 'source')}]({item.get('url', '')})",
        f"> 素材角色：{result.material_role}；正文字数：{result.body_length}",
        f"> 覆盖主题：{', '.join(result.coverage_tags) if result.coverage_tags else '未识别'}",
        "",
        "## 正文",
        "",
        result.body.strip(),
        "",
    ]
    return "\n".join(frontmatter)


def note_for_result(result: FetchResult) -> str:
    item = result.candidate
    flags = result.quality_flags
    lines = [
        f"# Fetch Note｜{result.extracted_title or item.get('title', '')}",
        "",
        f"- 原始 URL：{item.get('url', '')}",
        f"- sourceId：{item.get('sourceId', '')}",
        f"- materialRole：{result.material_role}",
        f"- 抓取状态：{result.fetch_status}",
        f"- 提取标题：{result.extracted_title}",
        f"- 正文字数：{result.body_length}",
        f"- 是否有广告/软广污染：{str(flags.has_ad_pollution).lower()}",
        f"- 是否有医疗恐吓倾向：{str(flags.has_medical_fear).lower()}",
        f"- 是否有赛事报道倾向：{str(flags.has_race_news).lower()}",
        f"- 是否有低质 SEO 痕迹：{str(flags.has_low_quality_seo).lower()}",
        f"- 是否适合进入 fact bank：{str(result.usable_for_fact_bank).lower()}",
        f"- 是否需要人工复核：{str(result.needs_manual_review).lower()}",
        f"- coverageTags：{', '.join(result.coverage_tags) if result.coverage_tags else '未识别'}",
    ]
    if result.reason:
        lines.append(f"- 备注：{result.reason}")
    lines.append("")
    return "\n".join(lines)


def write_result_files(result: FetchResult, package_dir: Path) -> FetchResult:
    role_dir = package_dir / ("primary" if result.material_role == "primary_material" else "reference")
    notes_dir = package_dir / "fetch-notes"
    role_dir.mkdir(parents=True, exist_ok=True)
    notes_dir.mkdir(parents=True, exist_ok=True)
    source_id = str(result.candidate.get("sourceId", "source"))
    slug = slugify(source_id, source_id)
    if result.fetch_status == "normalized":
        result.normalized_path = role_dir / f"{slug}.md"
        result.normalized_path.write_text(markdown_for_result(result), encoding="utf-8")
    result.fetch_note_path = notes_dir / f"{slug}.fetch-note.md"
    result.fetch_note_path.write_text(note_for_result(result), encoding="utf-8")
    return result


def skipped_result(candidate: dict[str, Any], material_role: str, reason: str, fetched_at: str) -> FetchResult:
    return FetchResult(
        candidate=candidate,
        material_role=material_role,
        fetch_status="skipped",
        extracted_title=str(candidate.get("title", "")),
        body="",
        body_length=0,
        coverage_tags=coverage_tags_for_candidate(candidate),
        quality_flags=detect_quality_flags(candidate_text(candidate)),
        usable_for_fact_bank=False,
        needs_manual_review=True,
        reason=reason,
        normalized_path=None,
        fetch_note_path=None,
        fetched_at=fetched_at,
    )


def failed_result(candidate: dict[str, Any], material_role: str, reason: str, fetched_at: str) -> FetchResult:
    return FetchResult(
        candidate=candidate,
        material_role=material_role,
        fetch_status="failed",
        extracted_title=str(candidate.get("title", "")),
        body="",
        body_length=0,
        coverage_tags=coverage_tags_for_candidate(candidate),
        quality_flags=detect_quality_flags(candidate_text(candidate)),
        usable_for_fact_bank=False,
        needs_manual_review=True,
        reason=reason,
        normalized_path=None,
        fetch_note_path=None,
        fetched_at=fetched_at,
    )


def process_candidate(candidate: dict[str, Any], timeout: int = 25) -> FetchResult:
    fetched_at = now_iso()
    material_role = str(candidate.get("_materialRole") or candidate.get("decision") or "topic_material")
    if is_search_or_platform_page(candidate):
        return skipped_result(candidate, material_role, "疑似搜索页/tag/topic页，本轮跳过", fetched_at)
    try:
        page_html = fetch_html(str(candidate.get("url", "")), timeout=timeout)
        article = extract_article(page_html, str(candidate.get("url", "")))
        evaluation = evaluate_quality(candidate, article.body)
        tags = detect_coverage_tags(candidate_text(candidate) + " " + article.body)
        if evaluation.can_normalize:
            return FetchResult(
                candidate=candidate,
                material_role=material_role,
                fetch_status="normalized",
                extracted_title=article.title or str(candidate.get("title", "")),
                body=article.body,
                body_length=body_length(article.body),
                coverage_tags=tags,
                quality_flags=evaluation.flags,
                usable_for_fact_bank=evaluation.usable_for_fact_bank,
                needs_manual_review=evaluation.needs_manual_review,
                reason="",
                normalized_path=None,
                fetch_note_path=None,
                fetched_at=fetched_at,
            )
        return FetchResult(
            candidate=candidate,
            material_role=material_role,
            fetch_status="failed",
            extracted_title=article.title or str(candidate.get("title", "")),
            body=article.body,
            body_length=body_length(article.body),
            coverage_tags=tags,
            quality_flags=evaluation.flags,
            usable_for_fact_bank=False,
            needs_manual_review=True,
            reason=evaluation.reason,
            normalized_path=None,
            fetch_note_path=None,
            fetched_at=fetched_at,
        )
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeError) as exc:
        return failed_result(candidate, material_role, f"抓取失败：{exc}", fetched_at)


def markdown_link(path: Path, label: str, base_dir: Path) -> str:
    try:
        rel = path.relative_to(base_dir)
    except ValueError:
        rel = path
    return f"[{label}]({urllib.parse.quote(str(rel), safe='/.-_')})"


def write_source_index(results: list[FetchResult], package_dir: Path) -> Path:
    package_dir.mkdir(parents=True, exist_ok=True)
    path = package_dir / "source-index.md"
    lines = [
        "# 夏季跑步主题素材包索引",
        "",
        "说明：本索引仅记录本轮抓取和标准化结果，不代表已经进入改写。",
        "",
    ]
    for role, title in [("primary_material", "Primary materials"), ("reference_support", "Reference support")]:
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| 标题链接 | 来源 | 角色 | 抓取状态 | 正文字数 | coverageTags | fact bank | fetch-note |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for result in [item for item in results if item.material_role == role]:
            candidate = result.candidate
            note_link = (
                markdown_link(result.fetch_note_path, "fetch-note", package_dir)
                if result.fetch_note_path
                else ""
            )
            title_link = f"[{clean_text(result.extracted_title or candidate.get('title'))}]({candidate.get('url', '')})"
            lines.append(
                "| "
                + " | ".join(
                    [
                        title_link.replace("|", "｜"),
                        clean_text(candidate.get("sourceName", "")).replace("|", "｜"),
                        result.material_role,
                        result.fetch_status,
                        str(result.body_length),
                        ", ".join(result.coverage_tags),
                        str(result.usable_for_fact_bank).lower(),
                        note_link,
                    ]
                )
                + " |"
            )
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_coverage_matrix(results: list[FetchResult], package_dir: Path) -> Path:
    package_dir.mkdir(parents=True, exist_ok=True)
    path = package_dir / "coverage-matrix.md"
    lines = [
        "# 夏季跑步素材 Coverage Matrix",
        "",
        "| sourceId | 角色 | 标题 | 状态 | 正文字数 | " + " | ".join(COVERAGE_TAGS) + " |",
        "| --- | --- | --- | --- | --- | " + " | ".join(["---"] * len(COVERAGE_TAGS)) + " |",
    ]
    for result in results:
        candidate = result.candidate
        marks = ["Y" if tag in result.coverage_tags else "" for tag in COVERAGE_TAGS]
        title = clean_text(result.extracted_title or candidate.get("title", "")).replace("|", "｜")
        lines.append(
            "| "
            + " | ".join(
                [
                    str(candidate.get("sourceId", "")),
                    result.material_role,
                    title,
                    result.fetch_status,
                    str(result.body_length),
                    *marks,
                ]
            )
            + " |"
        )
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def update_registry(results: list[FetchResult], registry_path: Path) -> None:
    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    else:
        registry = {"version": 1, "sources": []}
    by_id = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, dict) and item.get("sourceId")
    }
    for result in results:
        source_id = str(result.candidate.get("sourceId", ""))
        target = by_id.setdefault(source_id, {"sourceId": source_id})
        target["fetchStatus"] = result.fetch_status
        target["materialRole"] = result.material_role
        target["normalizedPath"] = str(result.normalized_path) if result.normalized_path else ""
        target["fetchNotePath"] = str(result.fetch_note_path) if result.fetch_note_path else ""
        target["bodyLength"] = result.body_length
        target["coverageTags"] = result.coverage_tags
        target["usableForFactBank"] = result.usable_for_fact_bank
        if result.fetch_status == "skipped":
            target["skipReason"] = result.reason
            target.pop("failureReason", None)
        elif result.fetch_status == "failed":
            target["failureReason"] = result.reason
            target.pop("skipReason", None)
        else:
            target.pop("skipReason", None)
            target.pop("failureReason", None)
        target["status"] = result.fetch_status
        target["fetchedAt"] = result.fetched_at
    registry["sources"] = sorted(by_id.values(), key=lambda item: str(item.get("sourceId", "")))
    registry["updatedAt"] = now_iso()
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json_array(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array")
    return data


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and normalize topic material package sources.")
    parser.add_argument("--primary", default=str(DEFAULT_PRIMARY), help="Primary material JSON path.")
    parser.add_argument("--reference", default=str(DEFAULT_REFERENCE), help="Reference support JSON path.")
    parser.add_argument("--package-dir", default=str(DEFAULT_PACKAGE_DIR), help="Topic material package output directory.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Web source registry path.")
    parser.add_argument("--per-role", type=int, default=5, help="Number of primary/reference candidates to attempt.")
    parser.add_argument("--timeout", type=int, default=25, help="HTTP timeout seconds.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    primary_path = Path(args.primary).expanduser()
    reference_path = Path(args.reference).expanduser()
    package_dir = Path(args.package_dir).expanduser()
    registry_path = Path(args.registry).expanduser()

    primary = load_json_array(primary_path)
    reference = load_json_array(reference_path)
    attempts = select_attempt_candidates(primary, reference, per_role=args.per_role)

    results: list[FetchResult] = []
    for material_role in ["primary_material", "reference_support"]:
        for candidate in attempts[material_role]:
            result = process_candidate(candidate, timeout=args.timeout)
            write_result_files(result, package_dir)
            results.append(result)

    index_path = write_source_index(results, package_dir)
    matrix_path = write_coverage_matrix(results, package_dir)
    update_registry(results, registry_path)

    print(f"primaryInput: {primary_path}")
    print(f"referenceInput: {reference_path}")
    print(f"packageDir: {package_dir}")
    print(f"primaryAttempted: {len(attempts['primary_material'])}")
    print("primarySourceIds: " + ", ".join(str(item.get("sourceId", "")) for item in attempts["primary_material"]))
    print(f"referenceAttempted: {len(attempts['reference_support'])}")
    print("referenceSourceIds: " + ", ".join(str(item.get("sourceId", "")) for item in attempts["reference_support"]))
    print(f"normalized: {sum(1 for result in results if result.fetch_status == 'normalized')}")
    print(f"failed: {sum(1 for result in results if result.fetch_status == 'failed')}")
    print(f"skipped: {sum(1 for result in results if result.fetch_status == 'skipped')}")
    for result in results:
        print(
            "result: "
            f"{result.candidate.get('sourceId')} "
            f"{result.material_role} "
            f"{result.fetch_status} "
            f"bodyLength={result.body_length} "
            f"coverageTags={','.join(result.coverage_tags)} "
            f"normalizedPath={result.normalized_path or ''} "
            f"fetchNotePath={result.fetch_note_path or ''}"
        )
    print(f"sourceIndex: {index_path}")
    print(f"coverageMatrix: {matrix_path}")
    print(f"registry: {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
