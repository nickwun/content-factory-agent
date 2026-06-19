#!/usr/bin/env python3
"""
Milestone 28 probe: topic-driven web discovery for running materials.

This script only reads search-result pages and stores metadata/snippets. It does
not fetch full articles, normalize source text, rewrite, generate images, update
registries, or publish anything.
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
from typing import Any


DEFAULT_VAULT = Path("/Users/hui/Documents/ContentFactoryVault")
DISCOVERY_RELATIVE_DIR = Path("01-Materials/web-discovery")
DISCOVERY_SUBDIRS = ("topic-requests", "topic-plans", "candidates", "selected", "rejected", "normalized")

DEFAULT_SUMMER_RUNNING_ZH_QUERIES = [
    "夏季跑步 注意事项",
    "夏天跑步 怎么跑",
    "高温 跑步 安全",
    "夏季跑步 补水",
    "夏天跑步 心率",
    "夏季跑步 中暑",
    "夏天晨跑 夜跑",
    "高温天气 跑步 配速",
    "夏季跑步 防晒",
    "中年人 夏天跑步",
    "三伏天 跑步 注意事项",
    "夏天跑步 出汗 多",
    "夏天跑步 晨跑 好还是夜跑好",
    "高温天 跑步 需要注意什么",
]

DEFAULT_SUMMER_RUNNING_EN_QUERIES = [
    "summer running tips",
    "running in hot weather",
    "running heat hydration",
    "summer running safety",
]

SOURCE_LABELS = [
    ("runnersworld.com", "Runner's World"),
    ("marathonhandbook.com", "Marathon Handbook"),
    ("trainingpeaks.com", "TrainingPeaks"),
    ("verywellfit.com", "Verywell Fit"),
    ("healthline.com", "Healthline"),
    ("clevelandclinic.org", "Cleveland Clinic"),
    ("mayoclinic.org", "Mayo Clinic"),
    ("fleetfeet.com", "Fleet Feet"),
    ("sina.cn", "新浪"),
    ("sina.com.cn", "新浪"),
    ("sohu.com", "搜狐"),
    ("qq.com", "腾讯"),
    ("163.com", "网易"),
    ("toutiao.com", "今日头条"),
    ("thepaper.cn", "澎湃"),
    ("people.com.cn", "人民网"),
    ("xinhuanet.com", "新华网"),
    ("cctv.com", "央视网"),
    ("baidu.com", "百度"),
    ("zhihu.com", "知乎"),
    ("bilibili.com", "哔哩哔哩"),
]

TRACKING_QUERY_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid", "spm"}
BLOCKED_OR_LOW_VALUE_HOSTS = {
    "wenku.baidu.com",
    "ximalaya.com",
    "www.ximalaya.com",
    "iqiyi.com",
    "www.iqiyi.com",
    "podwise.ai",
}
LOW_VALUE_PATH_PATTERNS = [
    re.compile(r"(^|/)search(/|$)", re.I),
    re.compile(r"(^|/)topic(/|$)", re.I),
    re.compile(r"(^|/)tag(/|$)", re.I),
]

SUMMER_TOPIC_TERMS = [
    "夏季",
    "夏天",
    "高温",
    "三伏",
    "炎热",
    "暑热",
    "hot weather",
    "summer",
    "heat",
]
RUNNING_TERMS = [
    "跑步",
    "跑者",
    "跑友",
    "慢跑",
    "晨跑",
    "夜跑",
    "马拉松",
    "running",
    "runner",
    "run",
    "jogging",
]
KNOWLEDGE_TERMS = [
    "注意事项",
    "怎么跑",
    "安全",
    "补水",
    "心率",
    "中暑",
    "防晒",
    "配速",
    "出汗",
    "晨跑",
    "夜跑",
    "建议",
    "指南",
    "tips",
    "safety",
    "hydration",
    "heart rate",
    "pace",
]

AD_TERMS = ["广告", "赞助", "带货", "购买", "优惠", "折扣", "跑鞋", "装备", "测评", "sale", "discount", "coupon", "gear"]
RACE_NEWS_TERMS = ["报名", "赛事", "开跑", "鸣枪", "成绩", "赛程", "中签", "马拉松赛", "race registration", "results"]
MEDICAL_FEAR_TERMS = ["猝死", "死亡", "致命", "千万别", "太可怕", "吓人", "热射病死亡", "要命", "fatal", "deadly"]
LOW_RELEVANCE_TERMS = ["running mate", "running for president", "running water", "running out", "running late"]


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


def clean_text(value: object) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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


def text_for_result(result: SearchResult | dict[str, Any]) -> str:
    if isinstance(result, SearchResult):
        return clean_text(f"{result.title} {result.snippet} {result.url}").lower()
    return clean_text(f"{result.get('title', '')} {result.get('snippet', '')} {result.get('url', '')}").lower()


def has_any(text: str, terms: list[str]) -> bool:
    return any(term.lower() in text for term in terms)


def is_usable_source_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    path = urllib.parse.unquote(parsed.path or "")
    if host in BLOCKED_OR_LOW_VALUE_HOSTS:
        return False
    if "douyin.com" in host and re.search(r"(^|/)search(/|$)", path, re.I):
        return False
    if "toutiao.com" in host and re.search(r"(^|/)topic(/|$)", path, re.I):
        return False
    for pattern in LOW_VALUE_PATH_PATTERNS:
        if pattern.search(path):
            return False
    return True


def knowledge_fit_score(result: SearchResult, request: dict[str, Any]) -> int:
    text = text_for_result(result)
    score = 0
    if has_any(text, RUNNING_TERMS):
        score += 2
    if has_any(text, SUMMER_TOPIC_TERMS) or clean_text(request.get("topic", "")) in text:
        score += 2
    if has_any(text, KNOWLEDGE_TERMS):
        score += 2
    if has_any(text, AD_TERMS):
        score -= 2
    if has_any(text, RACE_NEWS_TERMS):
        score -= 2
    if has_any(text, MEDICAL_FEAR_TERMS):
        score -= 1
    if has_any(text, LOW_RELEVANCE_TERMS):
        score -= 3
    return score


def is_likely_topic_candidate(result: SearchResult, request: dict[str, Any]) -> bool:
    return knowledge_fit_score(result, request) >= 3


def load_topic_request(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("topic request must be a JSON object")
    defaults = {
        "requestId": "topic-2026-05-26-summer-running",
        "targetAudience": "中文公众号普通跑者",
        "chinaContextRequired": True,
        "freshnessWindowDays": None,
        "candidateLimit": 80,
        "queryBudget": {"zh": 14, "en": 4},
        "sourcePreferences": ["中文跑步媒体", "运动医学或健康机构", "大众健康科普", "中文生活方式媒体"],
        "excludePatterns": ["广告", "带货", "赛事报名", "纯新闻通稿", "搜索页", "tag页"],
        "mustCover": [],
        "avoid": [],
    }
    request = {**defaults, **payload}
    request.setdefault("subIntent", "seasonal_advice")
    return request


def generate_queries(request: dict[str, Any]) -> dict[str, list[str]]:
    topic = clean_text(request.get("topic", ""))
    if topic == "夏季跑步" and request.get("intent") == "knowledge_share":
        return {
            "zh": DEFAULT_SUMMER_RUNNING_ZH_QUERIES[:],
            "en": DEFAULT_SUMMER_RUNNING_EN_QUERIES[:],
        }
    return {
        "zh": [
            f"{topic} 注意事项",
            f"{topic} 怎么做",
            f"{topic} 安全",
            f"{topic} 实用建议",
            f"中年人 {topic}",
        ],
        "en": [],
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
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) topic-material-discovery/0.1",
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


def probe_openable(
    url: str,
    *,
    opener=urllib.request.urlopen,
    timeout: int = 8,
) -> bool:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) topic-material-link-probe/0.1",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    methods = (
        ("HEAD", {}),
        ("GET", {"Range": "bytes=0-2047"}),
    )
    for method, extra_headers in methods:
        request = urllib.request.Request(url, headers={**headers, **extra_headers}, method=method)
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
    request: dict[str, Any],
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
        "language": detect_language(title, snippet, url),
        "intent": clean_text(request.get("intent", "")),
        "subIntent": clean_text(request.get("subIntent", "")),
        "topic": clean_text(request.get("topic", "")),
        "style": clean_text(request.get("style", "")),
        "discoveredAt": discovered_at,
        "status": "candidate",
    }


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


def collect_candidates(
    *,
    request: dict[str, Any],
    queries: dict[str, list[str]],
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

    query_pairs = [(query, "zh") for query in queries.get("zh", [])] + [
        (query, "en") for query in queries.get("en", [])
    ]
    for query, _language_hint in query_pairs:
        searched_queries.append(query)
        results = search_web(query, max_results_per_query)
        for result in results:
            url = canonical_url(result.url)
            if not is_usable_source_url(url):
                continue
            if not include_noisy and not is_likely_topic_candidate(result, request):
                continue
            candidate = make_candidate(result, query=query, request=request, discovered_at=discovered_at)
            if candidate["sourceId"] in seen_source_ids:
                continue
            if validate_openable and not probe_openable(candidate["url"]):
                continue
            seen_source_ids.add(candidate["sourceId"])
            candidates.append(candidate)
        time.sleep(sleep_seconds)

    return apply_language_priority(candidates, english_max_ratio), searched_queries


def noise_flags(candidate: dict[str, Any]) -> dict[str, bool]:
    text = text_for_result(candidate)
    low_relevance = not (has_any(text, RUNNING_TERMS) and has_any(text, SUMMER_TOPIC_TERMS + KNOWLEDGE_TERMS))
    return {
        "obvious_ads": has_any(text, AD_TERMS),
        "obvious_race_news": has_any(text, RACE_NEWS_TERMS),
        "obvious_medical_fear": has_any(text, MEDICAL_FEAR_TERMS),
        "obvious_low_relevance": low_relevance or has_any(text, LOW_RELEVANCE_TERMS),
    }


def build_run_summary(candidates: list[dict[str, Any]], searched_queries: list[str]) -> dict[str, Any]:
    zh_count = sum(1 for candidate in candidates if candidate.get("language") == "zh")
    en_count = sum(1 for candidate in candidates if candidate.get("language") == "en")
    unknown_count = sum(1 for candidate in candidates if candidate.get("language") == "unknown")
    total = len(candidates)
    zh_ratio = round(zh_count / total, 4) if total else 0.0
    flags = [noise_flags(candidate) for candidate in candidates]
    return {
        "total": total,
        "zh_count": zh_count,
        "en_count": en_count,
        "unknown_count": unknown_count,
        "zh_ratio": zh_ratio,
        "status": "needs_query_tuning" if zh_ratio < 0.7 else "ok",
        "searched_query_count": len(searched_queries),
        "searched_queries": searched_queries,
        "obvious_ads_count": sum(1 for item in flags if item["obvious_ads"]),
        "obvious_race_news_count": sum(1 for item in flags if item["obvious_race_news"]),
        "obvious_medical_fear_count": sum(1 for item in flags if item["obvious_medical_fear"]),
        "obvious_low_relevance_count": sum(1 for item in flags if item["obvious_low_relevance"]),
    }


def write_candidate_json(
    candidates: list[dict[str, str]],
    candidates_dir: Path,
    date_label: str,
    slug: str,
    summary: dict[str, Any],
    request: dict[str, Any],
) -> Path:
    candidates_dir.mkdir(parents=True, exist_ok=True)
    output_path = candidates_dir / f"{date_label}-{slug}-candidates.json"
    payload = {
        "type": "topic_discovery_candidates",
        "request": request,
        "summary": summary,
        "candidates": candidates,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output_path


def escape_markdown_cell(value: object) -> str:
    return clean_text(value).replace("|", "｜").replace("\n", " ")


def write_candidate_markdown(
    candidates: list[dict[str, str]],
    candidates_dir: Path,
    date_label: str,
    slug: str,
    summary: dict[str, Any],
    request: dict[str, Any],
) -> Path:
    candidates_dir.mkdir(parents=True, exist_ok=True)
    output_path = candidates_dir / f"{date_label}-{slug}-candidates.md"
    topic = clean_text(request.get("topic", ""))
    lines = [
        f"# {topic} 联网发现候选｜{date_label}",
        "",
        "说明：本文件只整理搜索结果页可见的标题、链接和摘要，不抓全文、不筛选 selected、不改写、不生成图片、不发布飞书。",
        "",
        "## Summary",
        "",
        f"- total：{summary.get('total', len(candidates))}",
        f"- 中文候选：{summary.get('zh_count', 0)}",
        f"- 英文候选：{summary.get('en_count', 0)}",
        f"- unknown：{summary.get('unknown_count', 0)}",
        f"- 中文比例：{summary.get('zh_ratio', 0)}",
        f"- 状态：{summary.get('status', '')}",
        f"- obvious_ads_count：{summary.get('obvious_ads_count', 0)}",
        f"- obvious_race_news_count：{summary.get('obvious_race_news_count', 0)}",
        f"- obvious_medical_fear_count：{summary.get('obvious_medical_fear_count', 0)}",
        f"- obvious_low_relevance_count：{summary.get('obvious_low_relevance_count', 0)}",
        "",
        "## Queries",
        "",
    ]
    for query in summary.get("searched_queries", []):
        lines.append(f"- {query}")

    lines.extend(["", "## 快速打开", ""])
    for index, candidate in enumerate(candidates, start=1):
        title = clean_text(candidate.get("title", ""))
        url = str(candidate.get("url", ""))
        source = clean_text(candidate.get("sourceName", ""))
        language = clean_text(candidate.get("language", ""))
        sub_intent = clean_text(candidate.get("subIntent", ""))
        lines.append(f"{index}. [{title}]({url})｜{source}｜{language}｜{sub_intent}")

    lines.extend(
        [
            "",
            "## 明细表",
            "",
            "| # | 语言 | 来源 | 标题链接 | Query | 摘要 |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
    )
    for index, candidate in enumerate(candidates, start=1):
        title = escape_markdown_cell(candidate.get("title", ""))
        row = [
            str(index),
            escape_markdown_cell(candidate.get("language", "")),
            escape_markdown_cell(candidate.get("sourceName", "")),
            f"[{title}]({candidate.get('url', '')})",
            escape_markdown_cell(candidate.get("query", "")),
            escape_markdown_cell(candidate.get("snippet", "")),
        ]
        lines.append("| " + " | ".join(row) + " |")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output_path


def ensure_discovery_dirs(discovery_dir: Path) -> None:
    for dirname in DISCOVERY_SUBDIRS:
        (discovery_dir / dirname).mkdir(parents=True, exist_ok=True)


def iso_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search topic-driven web material candidates.")
    parser.add_argument("--vault", default=str(DEFAULT_VAULT), help="ContentFactoryVault path.")
    parser.add_argument("--request", required=True, help="Topic request JSON path.")
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="Date label for output file.")
    parser.add_argument("--slug", default="summer-running", help="Safe slug for output files.")
    parser.add_argument("--max-results-per-query", type=int, default=8)
    parser.add_argument("--sleep", type=float, default=0.35)
    parser.add_argument("--include-noisy", action="store_true")
    parser.add_argument("--english-max-ratio", type=float, default=0.3)
    parser.add_argument("--no-validate-openable", dest="validate_openable", action="store_false")
    parser.set_defaults(validate_openable=True)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    vault = Path(args.vault).expanduser()
    discovery_dir = vault / DISCOVERY_RELATIVE_DIR
    ensure_discovery_dirs(discovery_dir)

    request = load_topic_request(Path(args.request).expanduser())
    queries = generate_queries(request)
    discovered_at = iso_now()
    candidates, searched_queries = collect_candidates(
        request=request,
        queries=queries,
        max_results_per_query=args.max_results_per_query,
        discovered_at=discovered_at,
        sleep_seconds=args.sleep,
        include_noisy=args.include_noisy,
        english_max_ratio=args.english_max_ratio,
        validate_openable=args.validate_openable,
    )
    summary = build_run_summary(candidates, searched_queries)
    candidate_path = write_candidate_json(
        candidates,
        discovery_dir / "candidates",
        args.date,
        args.slug,
        summary,
        request,
    )
    markdown_path = write_candidate_markdown(
        candidates,
        discovery_dir / "candidates",
        args.date,
        args.slug,
        summary,
        request,
    )

    print(f"Searched {len(searched_queries)} queries.")
    print(f"Collected {len(candidates)} candidates.")
    print(f"total: {summary['total']}")
    print(f"zh_count: {summary['zh_count']}")
    print(f"en_count: {summary['en_count']}")
    print(f"unknown_count: {summary['unknown_count']}")
    print(f"zh_ratio: {summary['zh_ratio']}")
    print(f"summaryStatus: {summary['status']}")
    print(f"obvious_ads_count: {summary['obvious_ads_count']}")
    print(f"obvious_race_news_count: {summary['obvious_race_news_count']}")
    print(f"obvious_medical_fear_count: {summary['obvious_medical_fear_count']}")
    print(f"obvious_low_relevance_count: {summary['obvious_low_relevance_count']}")
    print(f"candidateFile: {candidate_path}")
    print(f"markdownFile: {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
