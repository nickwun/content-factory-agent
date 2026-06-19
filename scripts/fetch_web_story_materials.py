#!/usr/bin/env python3
"""
Milestone 21: fetch selected web story materials and normalize readable Markdown.

This stage only fetches selected source pages and standardizes source material.
It does not rewrite, generate images, publish, or enter the production pipeline.
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


DEFAULT_INPUT = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/selected/2026-05-22-selected.json"
)
DEFAULT_REGISTRY = Path(
    "/Users/hui/Documents/ContentFactoryVault/01-Materials/web-discovery/web-source-registry.json"
)
MIN_BODY_LENGTH = 600

RUNNING_TERMS = ["跑步", "跑者", "跑友", "跑马", "马拉松", "晨跑", "夜跑", "公里", "配速"]
ODDITY_TERMS = ["离奇", "奇葩", "怪", "突然", "无意识", "边拉肚子", "踢起正步", "跑偏", "尴尬"]
CELEBRITY_TERMS = [
    "冯唐",
    "许飞",
    "陈意涵",
    "陳意涵",
    "周润发",
    "周潤發",
    "任贤齐",
    "任賢齊",
    "张雨绮",
    "張雨綺",
    "张钧甯",
    "張鈞甯",
    "陈坤",
    "陳坤",
    "范逸臣",
]
COLLECTION_TERMS = ["17个", "108个", "35个", "多个故事", "故事合集", "盘点"]
PERSON_EVENT_TERMS = [
    "男子",
    "女子",
    "小伙",
    "妈妈",
    "夫妻",
    "中年",
    "岁",
    "第一次",
    "主人公",
    "老陈",
    "老吴",
    "冯唐",
    "许飞",
    "陈意涵",
    "陳意涵",
    "周润发",
    "周潤發",
    "任贤齐",
    "任賢齊",
    "张雨绮",
    "張雨綺",
    "张钧甯",
    "張鈞甯",
    "陈坤",
    "陳坤",
    "范逸臣",
    "吴浩然",
    "埃克瓦尔",
]
NOISE_TERMS = [
    "推荐阅读",
    "热门推荐",
    "广告推广",
    "作者其他文章",
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
]


@dataclass
class Article:
    title: str
    body: str
    extraction_method: str


@dataclass
class QualityEvaluation:
    can_normalize: bool
    reason: str
    has_noise: bool
    needs_manual_review: bool


@dataclass
class FetchResult:
    candidate: dict[str, Any]
    role: str
    fetch_status: str
    extracted_title: str
    body: str
    body_length: int
    is_video_page: bool
    is_scraped_page: bool
    has_noise: bool
    needs_manual_review: bool
    can_rewrite: bool
    reason: str
    normalized_path: Path | None
    fetch_note_path: Path | None
    fetched_at: str


class TextExtractor(HTMLParser):
    block_tags = {"p", "div", "section", "article", "br", "li", "h1", "h2", "h3", "h4", "blockquote"}
    skip_tags = {"script", "style", "noscript", "svg", "canvas", "iframe"}

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


def body_length(body: str) -> int:
    return len(re.sub(r"\s+", "", body or ""))


def is_video_candidate(candidate: dict[str, Any]) -> bool:
    url = str(candidate.get("url", "")).lower()
    source = str(candidate.get("sourceName", "")).lower()
    return any(
        needle in url or needle in source
        for needle in ["bilibili.com", "youtube.com", "youtu.be", "/video/", "toutiao.com/video"]
    )


def is_search_or_tag_page(candidate: dict[str, Any]) -> bool:
    url = str(candidate.get("url", "")).lower()
    return any(needle in url for needle in ["/search/", "/tag/", "/topic/"])


def is_celebrity_candidate(candidate: dict[str, Any]) -> bool:
    title = str(candidate.get("title", ""))
    snippet = str(candidate.get("snippet", ""))
    return any(term in title or term in snippet for term in CELEBRITY_TERMS)


def selection_score(candidate: dict[str, Any], role: str) -> int:
    text = " ".join([str(candidate.get("title", "")), str(candidate.get("snippet", "")), str(candidate.get("query", ""))])
    score = int(candidate.get("storyScore", 0))
    if role == "oddity":
        score += count_matches(text, ODDITY_TERMS) * 8
        score -= count_matches(text, COLLECTION_TERMS) * 12
    elif role == "human_story":
        score += count_matches(text, ["戒烟", "戒酒", "体检", "中年", "普通", "逆袭", "生活"]) * 4
    elif role == "celebrity":
        score += count_matches(text, CELEBRITY_TERMS) * 30
    if is_video_candidate(candidate) or is_search_or_tag_page(candidate):
        score -= 100
    return score


def pick_role(
    candidates: list[dict[str, Any]],
    role: str,
    count: int,
    used: set[str],
) -> list[dict[str, Any]]:
    if role == "celebrity":
        pool = [item for item in candidates if is_celebrity_candidate(item)]
    else:
        pool = [item for item in candidates if item.get("category") == role and not is_celebrity_candidate(item)]
    pool = [item for item in pool if item.get("sourceId") not in used]
    pool = sorted(pool, key=lambda item: (-selection_score(item, role), str(item.get("sourceId", ""))))
    picked = []
    for item in pool:
        if len(picked) >= count:
            break
        picked_item = dict(item)
        picked_item["_attemptRole"] = role
        picked.append(picked_item)
        used.add(str(item.get("sourceId")))
    return picked


def select_attempt_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    used: set[str] = set()
    attempts: list[dict[str, Any]] = []
    attempts.extend(pick_role(candidates, "oddity", 2, used))
    attempts.extend(pick_role(candidates, "human_story", 2, used))
    attempts.extend(pick_role(candidates, "celebrity", 1, used))
    if len(attempts) < 5:
        remaining = [
            item
            for item in sorted(candidates, key=lambda x: -int(x.get("storyScore", 0)))
            if item.get("sourceId") not in used
        ]
        for item in remaining:
            picked_item = dict(item)
            picked_item["_attemptRole"] = str(item.get("category") or "fallback")
            attempts.append(picked_item)
            used.add(str(item.get("sourceId")))
            if len(attempts) >= 5:
                break
    return attempts[:5]


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
    for line in re.split(r"\n+", raw):
        cleaned = re.sub(r"[ \t\u3000]+", " ", line).strip()
        if not cleaned:
            continue
        if any(needle in cleaned for needle in BOILERPLATE_LINES):
            continue
        if any(needle in cleaned for needle in NOISE_TERMS):
            continue
        if re.fullmatch(r"[\d\s.。]+", cleaned):
            continue
        lines.append(cleaned)
    deduped = []
    for line in lines:
        if not deduped or deduped[-1] != line:
            deduped.append(line)
    return "\n\n".join(deduped).strip()


def clean_title(title: str) -> str:
    value = html.unescape(clean_text(title))
    value = re.sub(r"_网易订阅$", "", value)
    value = re.sub(r"_腾讯新闻$", "", value)
    value = re.sub(r"\|[^|]*网易订阅$", "", value)
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
    title = meta_content(html_text, "og:title")
    if not title:
        match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.I | re.S)
        title = match.group(1) if match else ""
    return clean_title(title)


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


def extract_tag(html_text: str, tag_name: str) -> str:
    pattern = re.compile(rf"<{re.escape(tag_name)}\b[^>]*>", re.I)
    match = pattern.search(html_text)
    if not match:
        return ""
    start = match.end()
    pos = start
    depth = 1
    tag_pattern = re.compile(rf"</?{re.escape(tag_name)}\b[^>]*>", re.I)
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


def extract_tencent_origin_content(html_text: str) -> tuple[str, str]:
    marker = "window.DATA"
    index = html_text.find(marker)
    if index < 0:
        return "", ""
    equal_index = html_text.find("=", index)
    if equal_index < 0:
        return "", ""
    source = html_text[equal_index + 1 :].lstrip()
    try:
        data, _ = json.JSONDecoder().raw_decode(source)
    except json.JSONDecodeError:
        return "", ""
    title = clean_title(str(data.get("title", "")))
    origin_content = data.get("originContent") if isinstance(data, dict) else None
    text = ""
    if isinstance(origin_content, dict):
        text = str(origin_content.get("text", ""))
    return title, text


def extract_article(html_text: str, url: str) -> Article:
    title = extract_title(html_text)
    tencent_title, tencent_fragment = extract_tencent_origin_content(html_text)
    if tencent_fragment:
        return Article(title=tencent_title or title, body=html_fragment_to_text(tencent_fragment), extraction_method="tencent_originContent")

    fragments = []
    article_fragment = extract_tag(html_text, "article")
    if article_fragment:
        fragments.append(("article", article_fragment))
    for class_name in [
        "post_body",
        "rich_media_content",
        "post-content",
        "post_content",
        "entry-content",
        "entry_content",
        "article-content",
        "article_content",
        "article-body",
        "articleBody",
        "main-content",
        "content",
    ]:
        fragment = extract_div_by_class(html_text, class_name)
        if fragment:
            fragments.append((class_name, fragment))
    body_match = re.search(r"<body[^>]*>(.*?)</body>", html_text, flags=re.I | re.S)
    body_fragment = body_match.group(1) if body_match else html_text
    if not fragments:
        fragments.append(("body", body_fragment))

    best_method = ""
    best_body = ""
    for method, fragment in fragments:
        text = html_fragment_to_text(fragment)
        if body_length(text) > body_length(best_body):
            best_method = method
            best_body = text
    if body_length(best_body) < MIN_BODY_LENGTH:
        body_text = html_fragment_to_text(body_fragment)
        if body_length(body_text) > body_length(best_body):
            best_method = "body_fallback"
            best_body = body_text
    return Article(title=title, body=best_body, extraction_method=best_method or "generic")


def slice_lines(lines: list[str], start_markers: list[str], end_markers: list[str]) -> list[str]:
    start_index = 0
    for marker in start_markers:
        for index, line in enumerate(lines):
            if marker and marker in line:
                start_index = index
                break
        if start_index:
            break

    end_index = len(lines)
    for marker in end_markers:
        for index, line in enumerate(lines[start_index:], start=start_index):
            if marker and marker in line:
                end_index = min(end_index, index)
                break
    return lines[start_index:end_index]


def clean_extracted_body(candidate: dict[str, Any], body: str) -> str:
    source = str(candidate.get("sourceName", ""))
    title = str(candidate.get("title", ""))
    lines = [line.strip() for line in body.splitlines() if line.strip()]

    if "澎湃" in source:
        lines = slice_lines(lines, ["〖编者按〗", title], ["更多专业跑步健身内容", "澎湃新闻报料"])
    elif "UPower" in source:
        lines = slice_lines(lines, ["上周日(", "「中了慢跑毒"], ["Tagged:", "Facebook Conversations", "Next On News"])
    elif "Vogue" in source:
        lines = slice_lines(
            lines,
            ["陳意涵熱愛跑步", "陈意涵热爱跑步"],
            ["來源：", "来源：", "Vogue 推薦", "陳意涵：倒立", "陳意涵5怪癖"],
        )
    elif "联合早报" in source:
        lines = slice_lines(lines, ["（香港讯）", "（香港訊）"], ["上一篇", "下一篇", "明星周润发", "明星周潤發"])
    elif "中新网" in source:
        lines = slice_lines(lines, ["中新网北京", "中新網北京"], ["分享", "阅读推荐", "閱讀推薦"])

    cleaned = []
    extra_boilerplate = {
        "下载客户端",
        "登录",
        "无障碍",
        "+1",
        "简",
        "繁",
        "订阅",
        "小标准中大",
        "设为谷歌新闻首选来源",
        "首页",
        "新闻",
        "国际",
        "图片",
        "最新",
        "热门",
        "Loading...",
        "更多消息",
    }
    for line in lines:
        if line in extra_boilerplate:
            continue
        if any(needle in line for needle in BOILERPLATE_LINES):
            continue
        cleaned.append(line)
    return "\n\n".join(cleaned).strip()


def detect_noise(body: str) -> bool:
    return any(term in body for term in NOISE_TERMS)


def detect_scraped_page(candidate: dict[str, Any], body: str) -> bool:
    source = str(candidate.get("sourceName", "")).lower()
    url = str(candidate.get("url", "")).lower()
    return "采集" in body or any(host in source or host in url for host in ["360doc", "docin"])


def evaluate_quality(candidate: dict[str, Any], body: str) -> QualityEvaluation:
    length = body_length(body)
    has_noise = detect_noise(body)
    if length < MIN_BODY_LENGTH:
        if candidate.get("category") == "celebrity" and length >= 300:
            return QualityEvaluation(
                True,
                f"明星短轶文正文较短：{length} < {MIN_BODY_LENGTH}，建议人工复核或多源合并",
                has_noise,
                True,
            )
        return QualityEvaluation(False, f"正文长度不足：{length} < {MIN_BODY_LENGTH}", has_noise, True)
    if count_matches(body, RUNNING_TERMS) < 3:
        return QualityEvaluation(False, "跑步核心元素不足", has_noise, True)
    if count_matches(body, PERSON_EVENT_TERMS + ODDITY_TERMS) < 2:
        return QualityEvaluation(False, "具体人物或事件不足", has_noise, True)
    needs_manual_review = has_noise or count_matches(body, COLLECTION_TERMS) > 0
    return QualityEvaluation(True, "", has_noise, needs_manual_review)


def slugify(value: str, fallback: str) -> str:
    ascii_part = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    if ascii_part:
        return ascii_part[:60]
    return fallback


def yaml_quote(value: Any) -> str:
    if value is None:
        return "null"
    return json.dumps(str(value), ensure_ascii=False)


def markdown_for_result(result: FetchResult) -> str:
    item = result.candidate
    frontmatter = [
        "---",
        f"sourceId: {yaml_quote(item.get('sourceId'))}",
        "sourceType: web_story",
        f"url: {yaml_quote(item.get('url'))}",
        f"title: {yaml_quote(result.extracted_title or item.get('title'))}",
        f"sourceName: {yaml_quote(item.get('sourceName'))}",
        f"language: {yaml_quote(item.get('language'))}",
        f"category: {yaml_quote(item.get('category'))}",
        f"storyScore: {int(item.get('storyScore', 0))}",
        f"chinaContextScore: {int(item.get('chinaContextScore', 0))}",
        "status: normalized",
        f"fetchedAt: {yaml_quote(result.fetched_at)}",
        "usedAt: null",
        "usedByOutput: []",
        "---",
        "",
        f"# {result.extracted_title or item.get('title', '')}",
        "",
        f"> 原始链接：[{item.get('sourceName', 'source')}]({item.get('url', '')})",
        f"> 抓取状态：{result.fetch_status}；正文字数：{result.body_length}",
        "",
        "## 正文",
        "",
        result.body.strip(),
        "",
    ]
    return "\n".join(frontmatter)


def note_for_result(result: FetchResult) -> str:
    item = result.candidate
    lines = [
        f"# Fetch Note｜{result.extracted_title or item.get('title', '')}",
        "",
        f"- 原始 URL：{item.get('url', '')}",
        f"- sourceId：{item.get('sourceId', '')}",
        f"- 尝试角色：{result.role}",
        f"- 抓取状态：{result.fetch_status}",
        f"- 提取标题：{result.extracted_title}",
        f"- 正文字数：{result.body_length}",
        f"- 是否疑似视频页：{str(result.is_video_page).lower()}",
        f"- 是否疑似采集页：{str(result.is_scraped_page).lower()}",
        f"- 是否有广告/推荐阅读污染：{str(result.has_noise).lower()}",
        f"- 是否需要人工复核：{str(result.needs_manual_review).lower()}",
        f"- 是否可以进入改写：{str(result.can_rewrite).lower()}",
    ]
    if result.reason:
        lines.append(f"- 备注：{result.reason}")
    lines.append("")
    return "\n".join(lines)


def write_result_files(result: FetchResult, root: Path, date_label: str = "2026-05-22") -> FetchResult:
    normalized_dir = root / "normalized"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    source_id = str(result.candidate.get("sourceId", "source"))
    slug = slugify(source_id, source_id)
    base = normalized_dir / f"{date_label}-{slug}"
    if result.fetch_status == "normalized":
        result.normalized_path = base.with_suffix(".md")
        result.normalized_path.write_text(markdown_for_result(result), encoding="utf-8")
    result.fetch_note_path = normalized_dir / f"{date_label}-{slug}.fetch-note.md"
    result.fetch_note_path.write_text(note_for_result(result), encoding="utf-8")
    return result


def skipped_result(candidate: dict[str, Any], role: str, reason: str, fetched_at: str) -> FetchResult:
    return FetchResult(
        candidate=candidate,
        role=role,
        fetch_status="skipped",
        extracted_title=str(candidate.get("title", "")),
        body="",
        body_length=0,
        is_video_page=is_video_candidate(candidate),
        is_scraped_page=False,
        has_noise=False,
        needs_manual_review=True,
        can_rewrite=False,
        reason=reason,
        normalized_path=None,
        fetch_note_path=None,
        fetched_at=fetched_at,
    )


def process_candidate(candidate: dict[str, Any], timeout: int = 25) -> FetchResult:
    fetched_at = now_iso()
    role = str(candidate.get("_attemptRole") or candidate.get("category") or "unknown")
    if is_video_candidate(candidate):
        return skipped_result(candidate, role, "疑似视频页，本轮不强行提取正文", fetched_at)
    if is_search_or_tag_page(candidate):
        return skipped_result(candidate, role, "搜索/tag/topic 页面，本轮跳过", fetched_at)

    try:
        page_html = fetch_html(str(candidate.get("url", "")), timeout=timeout)
        article = extract_article(page_html, str(candidate.get("url", "")))
        article = Article(
            title=article.title,
            body=clean_extracted_body(candidate, article.body),
            extraction_method=article.extraction_method,
        )
        is_scraped = detect_scraped_page(candidate, article.body)
        quality = evaluate_quality(candidate, article.body)
        status = "normalized" if quality.can_normalize and not is_scraped else "failed"
        reason = quality.reason or ("疑似采集页" if is_scraped else "")
        return FetchResult(
            candidate=candidate,
            role=role,
            fetch_status=status,
            extracted_title=article.title or str(candidate.get("title", "")),
            body=article.body,
            body_length=body_length(article.body),
            is_video_page=False,
            is_scraped_page=is_scraped,
            has_noise=quality.has_noise,
            needs_manual_review=quality.needs_manual_review or is_scraped,
            can_rewrite=status == "normalized",
            reason=reason,
            normalized_path=None,
            fetch_note_path=None,
            fetched_at=fetched_at,
        )
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeError) as exc:
        return FetchResult(
            candidate=candidate,
            role=role,
            fetch_status="failed",
            extracted_title=str(candidate.get("title", "")),
            body="",
            body_length=0,
            is_video_page=False,
            is_scraped_page=False,
            has_noise=False,
            needs_manual_review=True,
            can_rewrite=False,
            reason=f"抓取失败：{exc}",
            normalized_path=None,
            fetch_note_path=None,
            fetched_at=fetched_at,
        )


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
        target["normalizedPath"] = str(result.normalized_path) if result.normalized_path else ""
        target["fetchedAt"] = result.fetched_at
        target["bodyLength"] = result.body_length
        target["fetchNotePath"] = str(result.fetch_note_path) if result.fetch_note_path else ""
        target["status"] = result.fetch_status
    registry["sources"] = sorted(by_id.values(), key=lambda item: str(item.get("sourceId", "")))
    registry["updatedAt"] = now_iso()
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def infer_date_label(input_path: Path) -> str:
    match = re.search(r"(\d{4}-\d{2}-\d{2})", input_path.name)
    return match.group(1) if match else dt.date.today().isoformat()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and normalize selected web story materials.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Selected JSON input path.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY), help="Web source registry path.")
    parser.add_argument("--date", default="", help="Date label for output files.")
    parser.add_argument("--timeout", type=int, default=25, help="HTTP timeout seconds.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    input_path = Path(args.input).expanduser()
    registry_path = Path(args.registry).expanduser()
    date_label = args.date or infer_date_label(input_path)
    root = input_path.parents[1]
    selected = json.loads(input_path.read_text(encoding="utf-8"))
    attempts = select_attempt_candidates(selected)

    results = []
    for candidate in attempts:
        result = process_candidate(candidate, timeout=args.timeout)
        result = write_result_files(result, root, date_label)
        results.append(result)
    update_registry(results, registry_path)

    print(f"input: {input_path}")
    print(f"attempted: {len(results)}")
    print("attemptSourceIds: " + ", ".join(str(result.candidate.get("sourceId", "")) for result in results))
    print(f"normalized: {sum(1 for result in results if result.fetch_status == 'normalized')}")
    print(f"failed: {sum(1 for result in results if result.fetch_status == 'failed')}")
    print(f"skipped: {sum(1 for result in results if result.fetch_status == 'skipped')}")
    for result in results:
        print(
            "result: "
            f"{result.candidate.get('sourceId')} "
            f"{result.fetch_status} "
            f"bodyLength={result.body_length} "
            f"normalizedPath={result.normalized_path or ''} "
            f"fetchNotePath={result.fetch_note_path or ''}"
        )
    print(f"registry: {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
