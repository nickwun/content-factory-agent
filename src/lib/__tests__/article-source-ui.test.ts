import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArticleSourceSummary,
  buildGenerateRequestPayload,
  buildRewriteSourceErrorMessage,
  buildRewriteSourceNotice,
} from "../rewrite/article-source-ui.ts";
import { RewriteSourceParseError } from "../rewrite/rewrite-source.ts";

test("buildArticleSourceSummary returns a lightweight summary for uploaded files", () => {
  const summary = buildArticleSourceSummary({
    kind: "uploaded_file",
    sourceName: "sample.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extractedText: "原文内容",
    charCount: 1234,
  });

  assert.equal(summary.sourceLabel, "sample.docx");
  assert.equal(summary.charCountLabel, "1234 字");
  assert.equal(summary.kindLabel, "上传文件");
});

test("buildRewriteSourceNotice returns a truncation warning when source was truncated", () => {
  const notice = buildRewriteSourceNotice({
    kind: "pasted_text",
    extractedText: "原文内容",
    charCount: 32000,
    truncated: true,
  });

  assert.match(notice ?? "", /已截取前 30000 字/);
});

test("buildRewriteSourceErrorMessage maps unsupported file type and parse failures", () => {
  const unsupported = buildRewriteSourceErrorMessage(
    new RewriteSourceParseError(
      "unsupported_file_type",
      "当前仅支持 .txt、.md、.docx 或直接粘贴文本。",
    ),
  );
  const parseFailed = buildRewriteSourceErrorMessage(
    new RewriteSourceParseError(
      "parse_failed",
      "原文解析失败，请换一个文件或直接粘贴文本。",
    ),
  );

  assert.match(unsupported, /\.txt、\.md、\.docx/);
  assert.match(parseFailed, /原文解析失败/);
});

test("buildGenerateRequestPayload only includes rewriteSource when present", () => {
  const withoutRewrite = buildGenerateRequestPayload({
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article"],
  });
  const withRewrite = buildGenerateRequestPayload({
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article", "twitter"],
    selectedPromptPresetByPlatform: {
      wechat_article: "wechat-preset-1",
    },
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
  });

  assert.deepEqual(withoutRewrite, {
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article"],
  });
  assert.deepEqual(withRewrite, {
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article", "twitter"],
    selectedPromptPresetByPlatform: {
      wechat_article: "wechat-preset-1",
    },
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 12,
    },
  });
});

test("buildGenerateRequestPayload includes wechatFinalization when provided", () => {
  const payload = buildGenerateRequestPayload({
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article"],
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
  });

  assert.deepEqual(payload, {
    requestSource: "composer_rewrite",
    selectedPlatforms: ["wechat_article"],
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
  });
});

test("buildGenerateRequestPayload includes explicit processingMode when provided", () => {
  const payload = buildGenerateRequestPayload({
    requestSource: "composer_rewrite",
    processingMode: "translate_to_zh_article",
    selectedPlatforms: ["wechat_article"],
    selectedPromptPresetByPlatform: {
      wechat_article: "translate-preset",
    },
    rewriteSource: {
      kind: "pasted_text",
      extractedText: "This is an English transcript.",
      charCount: 30,
    },
  });

  assert.equal(payload.processingMode, "translate_to_zh_article");
});
