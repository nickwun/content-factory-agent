#!/usr/bin/env python3
"""
Milestone 19 probe: discover running-related story candidates from web search.

This script only reads search-result pages and stores metadata/snippets. It does
not fetch full articles, normalize source text, rewrite, generate images, or
publish anything.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path


DEFAULT_VAULT = Path("/Users/hui/Documents/ContentFactoryVault")
DISCOVERY_RELATIVE_DIR = Path("01-Materials/web-discovery")
DISCOVERY_SUBDIRS = ("candidates", "selected", "rejected", "normalized")

ENGLISH_QUERIES = {
    "oddity": [
        "runner bizarre story",
        "running strange incident",
        "marathon weird story",
        "jogger strange story",
    ],
    "human_story": [
        "ordinary runner story",
        "amateur runner story",
        "running changed his life",
    ],
}

CHINESE_QUERIES = {
    "oddity": [
        "跑步 奇闻",
        "跑步 奇葩 故事",
        "跑步 离奇 事件",
        "跑者 奇闻",
        "跑者 离奇",
        "马拉松 奇葩",
        "跑步 怪事",
        "马拉松 奇葩事",
        "跑步 意外 反转",
        "跑步 路上 遇到",
        "跑步 途中 发生",
        "夜跑 奇遇",
        "晨跑 奇遇",
    ],
    "human_story": [
        "普通人 跑步 故事",
        "中年人 跑步 故事",
        "跑步 改变生活",
        "跑步 改变人生",
        "跑步 后 变化",
        "跑步 救了我",
        "跑步 走出低谷",
        "跑步 遇见",
        "跑步 坚持 多年",
        "跑步 与生活",
        "50岁 跑步 故事",
        "退休后 跑步",
        "中年男人 跑步",
        "中年女人 跑步",
        "夫妻 跑步 故事",
        "跑步 减肥 真实经历",
        "跑步 戒酒",
        "跑步 抑郁",
        "跑步 独处",
        "跑步 不发朋友圈",
    ],
}

SEARCH_QUERIES = {
    category: CHINESE_QUERIES[category] + ENGLISH_QUERIES[category]
    for category in CHINESE_QUERIES
}

SOURCE_LABELS = [
    ("runnersworld.com", "Runner's World"),
    ("womensrunning.com", "Women's Running"),
    ("runningmagazine.ca", "Canadian Running"),
    ("marathonhandbook.com", "Marathon Handbook"),
    ("runkeeper.com", "Runkeeper"),
    ("runstreet.com", "Runstreet"),
    ("fleetfeet.com", "Fleet Feet"),
    ("reddit.com", "Reddit"),
    ("youtube.com", "YouTube"),
    ("youtu.be", "YouTube"),
    ("sina.cn", "新浪"),
    ("sina.com.cn", "新浪"),
    ("sohu.com", "搜狐"),
    ("qq.com", "腾讯"),
    ("163.com", "网易"),
    ("toutiao.com", "今日头条"),
    ("douyin.com", "抖音"),
    ("bilibili.com", "哔哩哔哩"),
    ("zhihu.com", "知乎"),
    ("baidu.com", "百度"),
    ("sportsv.net", "运动视界"),
    ("sbs.com.au", "SBS"),
]

RUNNING_TERMS = [
    "run",
    "runner",
    "running",
    "jogger",
    "jogging",
    "marathon",
    "ultramarathon",
    "race",
    "跑步",
    "跑者",
    "跑友",
    "慢跑",
    "晨跑",
    "夜跑",
    "马拉松",
]

STORY_TERMS = {
    "oddity": [
        "bizarre",
        "strange",
        "weird",
        "odd",
        "unusual",
        "incident",
        "mystery",
        "caught",
        "viral",
        "奇闻",
        "离奇",
        "奇葩",
        "荒诞",
        "怪事",
        "不可思议",
        "奇遇",
        "意外",
        "反转",
        "遇到",
        "途中",
        "发生",
    ],
    "human_story": [
        "story",
        "ordinary",
        "amateur",
        "changed my life",
        "changed his life",
        "changed her life",
        "transformation",
        "journey",
        "ordinary runner",
        "普通人",
        "中年人",
        "故事",
        "改变人生",
        "改变生活",
        "坚持",
        "人生",
        "生活",
        "变化",
        "救了我",
        "低谷",
        "遇见",
        "多年",
        "退休",
        "夫妻",
        "减肥",
        "真实经历",
        "戒酒",
        "抑郁",
        "独处",
        "朋友圈",
    ],
}

NOISE_TERMS = [
    "running red light",
    "running a red light",
    "running for president",
    "running mate",
    "running late",
    "running out",
    "running water",
    "running away",
    "runaway train",
    "runaway-train",
    "locomotive",
    "railroad",
    "railway",
    "csx 8888",
    "crazy eights incident",
    "head-on collision",
    "training plan",
    "workout",
    "best shoes",
    "running shoes",
    "shoe review",
    "gear",
    "watch review",
    "registration",
    "race calendar",
    "results",
    "coupon",
    "discount",
    "sale",
    "训练计划",
    "训练方法",
    "配速表",
    "跑鞋",
    "装备",
    "报名",
    "成绩查询",
    "赛历",
    "优惠",
    "广告",
]

TRACKING_QUERY_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid", "spm"}
BLOCKED_OR_LOW_VALUE_HOSTS = {
    "zhihu.com",
    "zhuanlan.zhihu.com",
    "www.zhihu.com",
    "wenku.baidu.com",
    "ximalaya.com",
    "www.ximalaya.com",
    "iqiyi.com",
    "www.iqiyi.com",
    "xiaoyuzhoufm.com",
    "www.xiaoyuzhoufm.com",
    "podwise.ai",
}
LOW_VALUE_PATH_PATTERNS = [
    (re.compile(r"(^|/)search(/|$)", re.I), "search page"),
    (re.compile(r"(^|/)topic(/|$)", re.I), "topic page"),
    (re.compile(r"(^|/)tag(/|$)", re.I), "tag page"),
]


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    snippet: str = ""


class SearchResultParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.results: list[SearchResult] = []
        self._current_url = ""
        self._title_parts: list[str] = []
        self._snippet_parts: list[str] = []
        self._in_title = False
        self._in_snippet = False
        self._in_bing_result = False
        self._in_bing_h2 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key: value or "" for key, value in attrs}
        class_name = attrs_dict.get("class", "")

        if tag == "a" and "result__a" in class_name:
            self._flush()
            self._current_url = attrs_dict.get("href", "")
            self._title_parts = []
            self._snippet_parts = []
            self._in_title = True
            return

        if tag in {"a", "div"} and "result__snippet" in class_name:
            self._in_snippet = True
            return

        if tag == "li" and "b_algo" in class_name:
            self._flush()
            self._in_bing_result = True
            self._title_parts = []
            self._snippet_parts = []
            return

        if self._in_bing_result and tag == "h2":
            self._in_bing_h2 = True
            return

        if self._in_bing_h2 and tag == "a" and attrs_dict.get("href"):
            self._current_url = attrs_dict["href"]
            self._in_title = True
            return

        if self._in_bing_result and tag == "p" and self._current_url:
            self._in_snippet = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._in_title:
            self._in_title = False
            return

        if tag in {"a", "div", "p"} and self._in_snippet:
            self._in_snippet = False
            return

        if tag == "h2" and self._in_bing_h2:
            self._in_bing_h2 = False
            return

        if tag == "li" and self._in_bing_result:
            self._in_bing_result = False
            self._flush()

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)
        elif self._in_snippet:
            self._snippet_parts.append(data)

    def close(self) -> None:
        super().close()
        self._flush()

    def _flush(self) -> None:
        title = clean_text(" ".join(self._title_parts))
        if not title or not self._current_url:
            return
        self.results.append(
            SearchResult(
                title=title,
                url=normalize_search_url(self._current_url),
                snippet=clean_text(" ".join(self._snippet_parts)),
            )
        )
        self._current_url = ""
        self._title_parts = []
        self._snippet_parts = []
        self._in_title = False
        self._in_snippet = False


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def contains_cjk(value: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", value or ""))


def detect_language(title: str, snippet: str = "", url: str = "") -> str:
    text = urllib.parse.unquote(clean_text(f"{title} {snippet} {url}"))
    cjk_count = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin_count = len(re.findall(r"[A-Za-z]", text))
    if cjk_count >= 2:
        return "zh"
    if latin_count >= 12:
        return "en"
    return "unknown"


def normalize_search_url(url: str) -> str:
    url = html.unescape(url)
    if url.startswith("//duckduckgo.com/l/?") or url.startswith("https://duckduckgo.com/l/?"):
        parsed = urllib.parse.urlparse(f"https:{url}" if url.startswith("//") else url)
        query = urllib.parse.parse_qs(parsed.query)
        if query.get("uddg"):
            return query["uddg"][0]
    return url


def canonical_url(url: str) -> str:
    normalized = normalize_search_url(url)
    parsed = urllib.parse.urlparse(normalized)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or "/"
    query_pairs = []
    for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=False):
        lowered = key.lower()
        if lowered.startswith("utm_") or lowered in TRACKING_QUERY_KEYS:
            continue
        query_pairs.append((key, value))
    query = urllib.parse.urlencode(query_pairs)
    return urllib.parse.urlunparse((scheme, netloc, path, "", query, ""))


def source_name_for(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    for needle, label in SOURCE_LABELS:
        if needle in host:
            return label
    return host.removeprefix("www.") or "Web"


def source_id_for(url: str) -> str:
    digest = hashlib.sha256(canonical_url(url).encode("utf-8")).hexdigest()[:16]
    return f"web-source-{digest}"


def is_usable_source_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    path = urllib.parse.unquote(parsed.path or "")
    if host in BLOCKED_OR_LOW_VALUE_HOSTS:
        return False
    if host.endswith(".zhihu.com"):
        return False
    if "douyin.com" in host and re.search(r"(^|/)search(/|$)", path, re.I):
        return False
    if "toutiao.com" in host and re.search(r"(^|/)topic(/|$)", path, re.I):
        return False
    for pattern, _reason in LOW_VALUE_PATH_PATTERNS:
        if pattern.search(path):
            return False
    return True


def is_usable_source_result(result: SearchResult) -> bool:
    return is_usable_source_url(canonical_url(result.url))


def probe_openable(
    url: str,
    *,
    opener=urllib.request.urlopen,
    timeout: int = 8,
) -> bool:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) running-story-link-probe/0.1",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    methods = (
        ("HEAD", {}),
        ("GET", {"Range": "bytes=0-2047"}),
    )
    for method, extra_headers in methods:
        request = urllib.request.Request(
            url,
            headers={**headers, **extra_headers},
            method=method,
        )
        try:
            with opener(request, timeout=timeout) as response:
                if method == "GET":
                    response.read(2048)
                return 200 <= getattr(response, "status", 200) < 400
        except urllib.error.HTTPError as exc:
            try:
                exc.close()
            except Exception:
                pass
            if exc.code in {401, 403, 404, 410, 451}:
                return False
            continue
        except (urllib.error.URLError, TimeoutError, OSError):
            continue
    return False


def make_candidate(
    result: SearchResult,
    *,
    query: str,
    category: str,
    discovered_at: str,
) -> dict[str, str]:
    url = canonical_url(result.url)
    title = clean_text(result.title)
    snippet = clean_text(result.snippet)
    return {
        "sourceId": source_id_for(url),
        "title": title,
        "url": url,
        "sourceName": source_name_for(url),
        "snippet": snippet,
        "query": query,
        "category": category,
        "language": detect_language(title, snippet, url),
        "discoveredAt": discovered_at,
        "status": "candidate",
    }


def parse_search_results(body: str) -> list[SearchResult]:
    parser = SearchResultParser()
    parser.feed(body)
    parser.close()
    return parser.results


def request_text(url: str, *, timeout: int = 25) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) running-story-discovery/0.1",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def duckduckgo_search(query: str, max_results: int) -> list[SearchResult]:
    params = urllib.parse.urlencode({"q": query, "kl": "cn-zh" if contains_cjk(query) else "us-en"})
    body = request_text(f"https://duckduckgo.com/html/?{params}")
    return parse_search_results(body)[:max_results]


def bing_search(query: str, max_results: int) -> list[SearchResult]:
    params = urllib.parse.urlencode({"q": query, "setlang": "zh-CN"})
    body = request_text(f"https://www.bing.com/search?{params}")
    return parse_search_results(body)[:max_results]


def search_web(query: str, max_results: int) -> list[SearchResult]:
    results: list[SearchResult] = []
    seen: set[str] = set()
    providers = (("duckduckgo", duckduckgo_search), ("bing", bing_search))
    for provider_name, provider in providers:
        try:
            provider_results = provider(query, max_results)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"[warn] {provider_name} failed for {query!r}: {exc}", file=sys.stderr)
            continue
        except Exception as exc:
            print(f"[warn] {provider_name} parser failed for {query!r}: {exc}", file=sys.stderr)
            continue

        for result in provider_results:
            key = canonical_url(result.url)
            if key in seen:
                continue
            seen.add(key)
            results.append(result)
            if len(results) >= max_results:
                return results
    return results


def story_fit_score(result: SearchResult, category: str) -> int:
    text = f"{result.title} {result.snippet} {result.url}".lower()
    score = 0
    if any(term.lower() in text for term in RUNNING_TERMS):
        score += 2
    if any(term.lower() in text for term in STORY_TERMS[category]):
        score += 2
    if "reddit.com" in text:
        score += 1
    if any(term.lower() in text for term in NOISE_TERMS):
        score -= 2
    if any(
        phrase in text
        for phrase in (
            "running red light",
            "running a red light",
            "running for president",
            "running mate",
            "running late",
            "running out",
            "running water",
            "running away",
            "runaway train",
            "runaway-train",
            "locomotive",
            "railroad",
            "railway",
            "csx 8888",
            "crazy eights incident",
            "head-on collision",
        )
    ):
        score -= 3
    if category == "oddity" and any(term in text for term in ("results", "registration", "赛程", "报名")):
        score -= 2
    return score


def is_likely_story_candidate(result: SearchResult, category: str) -> bool:
    return story_fit_score(result, category) >= 2


def collect_candidates(
    *,
    max_results_per_query: int,
    discovered_at: str,
    sleep_seconds: float,
    include_noisy: bool,
    english_max_ratio: float,
    validate_openable: bool,
) -> tuple[list[dict[str, str]], list[str]]:
    candidates: list[dict[str, str]] = []
    searched_queries: list[str] = []
    seen_source_ids: set[str] = set()

    for category, queries in SEARCH_QUERIES.items():
        for query in queries:
            searched_queries.append(query)
            results = search_web(query, max_results_per_query)
            for result in results:
                if not is_usable_source_result(result):
                    continue
                if not include_noisy and not is_likely_story_candidate(result, category):
                    continue
                candidate = make_candidate(
                    result,
                    query=query,
                    category=category,
                    discovered_at=discovered_at,
                )
                if candidate["sourceId"] in seen_source_ids:
                    continue
                if validate_openable and not probe_openable(candidate["url"]):
                    continue
                seen_source_ids.add(candidate["sourceId"])
                candidates.append(candidate)
            time.sleep(sleep_seconds)

    return apply_language_priority(candidates, english_max_ratio), searched_queries


def apply_language_priority(candidates: list[dict[str, str]], english_max_ratio: float) -> list[dict[str, str]]:
    zh = [candidate for candidate in candidates if candidate.get("language") == "zh"]
    unknown = [candidate for candidate in candidates if candidate.get("language") == "unknown"]
    en = [candidate for candidate in candidates if candidate.get("language") == "en"]
    other = [
        candidate
        for candidate in candidates
        if candidate.get("language") not in {"zh", "en", "unknown"}
    ]
    non_english_count = len(zh) + len(unknown) + len(other)
    if english_max_ratio <= 0:
        en = []
    elif non_english_count:
        max_english = math.floor((english_max_ratio * non_english_count) / (1 - english_max_ratio))
        en = en[:max_english]
    return zh + unknown + other + en


def build_run_summary(candidates: list[dict[str, str]], searched_queries: list[str]) -> dict[str, object]:
    zh_count = sum(1 for candidate in candidates if candidate.get("language") == "zh")
    en_count = sum(1 for candidate in candidates if candidate.get("language") == "en")
    unknown_count = sum(1 for candidate in candidates if candidate.get("language") == "unknown")
    total_count = len(candidates)
    zh_ratio = round(zh_count / total_count, 4) if total_count else 0.0
    return {
        "total_count": total_count,
        "zh_count": zh_count,
        "en_count": en_count,
        "unknown_count": unknown_count,
        "zh_ratio": zh_ratio,
        "status": "needs_query_tuning" if zh_ratio < 0.6 else "ok",
        "searched_query_count": len(searched_queries),
        "searched_queries": searched_queries,
    }


def ensure_discovery_dirs(discovery_dir: Path) -> None:
    for dirname in DISCOVERY_SUBDIRS:
        (discovery_dir / dirname).mkdir(parents=True, exist_ok=True)


def write_candidate_file(candidates: list[dict[str, str]], candidates_dir: Path, date_label: str) -> Path:
    candidates_dir.mkdir(parents=True, exist_ok=True)
    output_path = candidates_dir / f"{date_label}-running-stories.json"
    output_path.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output_path


def escape_markdown_cell(value: object) -> str:
    return clean_text(str(value or "")).replace("|", "｜").replace("\n", " ")


def write_candidate_markdown(
    candidates: list[dict[str, str]],
    candidates_dir: Path,
    date_label: str,
    run_summary: dict[str, object],
) -> Path:
    candidates_dir.mkdir(parents=True, exist_ok=True)
    output_path = candidates_dir / f"{date_label}-running-stories.md"
    lines = [
        f"# 跑步故事联网发现候选｜{date_label}",
        "",
        "说明：本文件只整理搜索结果页可见的标题、链接和摘要，不抓全文、不改写、不筛选为正式素材。",
        "",
        "## 统计",
        "",
        f"- 总候选：{run_summary.get('total_count', len(candidates))}",
        f"- 中文候选：{run_summary.get('zh_count', 0)}",
        f"- 英文候选：{run_summary.get('en_count', 0)}",
        f"- unknown：{run_summary.get('unknown_count', 0)}",
        f"- 中文比例：{run_summary.get('zh_ratio', 0)}",
        f"- 状态：{run_summary.get('status', '')}",
        "",
        "## 候选链接",
        "",
        "### 快速打开",
        "",
    ]

    for index, candidate in enumerate(candidates, start=1):
        title = clean_text(candidate.get("title", ""))
        url = str(candidate.get("url", ""))
        source = clean_text(candidate.get("sourceName", ""))
        language = clean_text(candidate.get("language", ""))
        category = clean_text(candidate.get("category", ""))
        lines.append(f"{index}. [{title}]({url})｜{source}｜{language}｜{category}")

    lines.extend(
        [
            "",
            "### 明细表",
            "",
        "| # | 语言 | 类别 | 来源 | 标题链接 | Query | 摘要 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )

    for index, candidate in enumerate(candidates, start=1):
        title = escape_markdown_cell(candidate.get("title", ""))
        url = str(candidate.get("url", ""))
        row = [
            str(index),
            escape_markdown_cell(candidate.get("language", "")),
            escape_markdown_cell(candidate.get("category", "")),
            escape_markdown_cell(candidate.get("sourceName", "")),
            f"[{title}]({url})",
            escape_markdown_cell(candidate.get("query", "")),
            escape_markdown_cell(candidate.get("snippet", "")),
        ]
        lines.append("| " + " | ".join(row) + " |")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output_path


def update_registry(
    candidates: list[dict[str, str]],
    registry_path: Path,
    discovered_at: str,
    run_summary: dict[str, object] | None = None,
) -> Path:
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    if registry_path.exists():
        try:
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            registry = {}
    else:
        registry = {}

    sources_by_id = {
        item.get("sourceId"): item
        for item in registry.get("sources", [])
        if isinstance(item, dict) and item.get("sourceId")
    }

    for candidate in candidates:
        source_id = candidate["sourceId"]
        existing = sources_by_id.get(source_id)
        if existing:
            existing["title"] = candidate["title"]
            existing["url"] = candidate["url"]
            existing["sourceName"] = candidate["sourceName"]
            existing["language"] = candidate.get("language", "unknown")
            existing["lastDiscoveredAt"] = discovered_at
            existing["status"] = existing.get("status") or "candidate"
            existing["categories"] = sorted(set(existing.get("categories", [])) | {candidate["category"]})
            existing["queries"] = sorted(set(existing.get("queries", [])) | {candidate["query"]})
            existing.setdefault("chinaContextScore", preliminary_china_context_score(candidate))
            existing.setdefault("storyScore", None)
            existing.setdefault("rejectReason", "")
            continue

        sources_by_id[source_id] = {
            "sourceId": source_id,
            "title": candidate["title"],
            "url": candidate["url"],
            "sourceName": candidate["sourceName"],
            "language": candidate.get("language", "unknown"),
            "status": "candidate",
            "firstDiscoveredAt": discovered_at,
            "lastDiscoveredAt": discovered_at,
            "categories": [candidate["category"]],
            "queries": [candidate["query"]],
            "chinaContextScore": preliminary_china_context_score(candidate),
            "storyScore": None,
            "rejectReason": "",
        }

    for source in sources_by_id.values():
        source.setdefault("language", detect_language(source.get("title", ""), "", source.get("url", "")))
        source.setdefault("chinaContextScore", preliminary_china_context_score(source))
        source.setdefault("storyScore", None)
        source.setdefault("rejectReason", "")

    next_registry = {
        "version": 1,
        "description": "Milestone 19.1 web-discovery registry. Stores search metadata only, not full source text.",
        "updatedAt": discovered_at,
        "lastRunSummary": run_summary or {},
        "sources": sorted(sources_by_id.values(), key=lambda item: (item.get("status", ""), item.get("sourceId", ""))),
    }
    registry_path.write_text(json.dumps(next_registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return registry_path


def preliminary_china_context_score(candidate: dict[str, str]) -> int:
    if candidate.get("language") == "zh":
        return 3
    if candidate.get("language") == "unknown":
        return 1
    return 0


def iso_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search running story material candidates for Milestone 19.")
    parser.add_argument("--vault", default=str(DEFAULT_VAULT), help="ContentFactoryVault path.")
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="Date label for output file.")
    parser.add_argument("--max-results-per-query", type=int, default=8, help="Search results to inspect per query.")
    parser.add_argument("--sleep", type=float, default=0.4, help="Delay between queries.")
    parser.add_argument("--include-noisy", action="store_true", help="Keep obvious news/training/advertising noise.")
    parser.add_argument(
        "--english-max-ratio",
        type=float,
        default=0.3,
        help="Maximum English share after language prioritization.",
    )
    parser.add_argument(
        "--no-validate-openable",
        dest="validate_openable",
        action="store_false",
        help="Skip lightweight HEAD/ranged-GET link validation.",
    )
    parser.set_defaults(validate_openable=True)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    vault = Path(args.vault).expanduser()
    discovery_dir = vault / DISCOVERY_RELATIVE_DIR
    ensure_discovery_dirs(discovery_dir)

    discovered_at = iso_now()
    candidates, searched_queries = collect_candidates(
        max_results_per_query=args.max_results_per_query,
        discovered_at=discovered_at,
        sleep_seconds=args.sleep,
        include_noisy=args.include_noisy,
        english_max_ratio=args.english_max_ratio,
        validate_openable=args.validate_openable,
    )
    run_summary = build_run_summary(candidates, searched_queries)
    candidate_path = write_candidate_file(candidates, discovery_dir / "candidates", args.date)
    markdown_path = write_candidate_markdown(candidates, discovery_dir / "candidates", args.date, run_summary)
    registry_path = update_registry(
        candidates,
        discovery_dir / "web-source-registry.json",
        discovered_at,
        run_summary,
    )

    counts = {category: 0 for category in SEARCH_QUERIES}
    for candidate in candidates:
        counts[candidate["category"]] += 1

    print(f"Searched {len(searched_queries)} queries.")
    print(f"Collected {len(candidates)} candidates.")
    for category, count in counts.items():
        print(f"{category}: {count}")
    print(f"zh_count: {run_summary['zh_count']}")
    print(f"en_count: {run_summary['en_count']}")
    print(f"unknown_count: {run_summary['unknown_count']}")
    print(f"zh_ratio: {run_summary['zh_ratio']}")
    print(f"summaryStatus: {run_summary['status']}")
    print(f"candidateFile: {candidate_path}")
    print(f"markdownFile: {markdown_path}")
    print(f"registry: {registry_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
