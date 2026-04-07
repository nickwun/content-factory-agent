import assert from "node:assert/strict";
import test from "node:test";

import {
  buildXiaohongshuImageReviewPrompt,
  parseXiaohongshuImageReviewResult,
  resolveXiaohongshuImageFailureReason,
  validateXiaohongshuImageRatio,
} from "../images/generated-image-validation.ts";

test("validateXiaohongshuImageRatio passes near-4:5 portrait images", () => {
  const result = validateXiaohongshuImageRatio({ width: 928, height: 1152 });
  assert.equal(result.passed, true);
});

test("validateXiaohongshuImageRatio rejects square images", () => {
  const result = validateXiaohongshuImageRatio({ width: 1024, height: 1024 });
  assert.equal(result.passed, false);
});

test("buildXiaohongshuImageReviewPrompt stays narrow and JSON-only", () => {
  const prompt = buildXiaohongshuImageReviewPrompt();
  assert.match(prompt, /只返回 JSON/);
  assert.match(prompt, /hasReadableText/);
  assert.match(prompt, /hasUiLikeElements/);
  assert.match(prompt, /hasSignageOrLogo/);
  assert.doesNotMatch(prompt, /小红书/);
});

test("parseXiaohongshuImageReviewResult extracts booleans from JSON text", () => {
  const parsed = parseXiaohongshuImageReviewResult(
    'result: {"hasReadableText":true,"hasUiLikeElements":false,"hasSignageOrLogo":false}',
  );

  assert.deepEqual(parsed, {
    hasReadableText: true,
    hasUiLikeElements: false,
    hasSignageOrLogo: false,
  });
});

test("resolveXiaohongshuImageFailureReason prioritizes ratio failure before text/ui review", () => {
  assert.equal(
    resolveXiaohongshuImageFailureReason({
      metadata: { width: 1024, height: 1024 },
      review: {
        hasReadableText: false,
        hasUiLikeElements: false,
        hasSignageOrLogo: false,
      },
    }),
    "failed_ratio_check",
  );

  assert.equal(
    resolveXiaohongshuImageFailureReason({
      metadata: { width: 928, height: 1152 },
      review: {
        hasReadableText: true,
        hasUiLikeElements: false,
        hasSignageOrLogo: false,
      },
    }),
    "failed_text_ui_check",
  );

  assert.equal(
    resolveXiaohongshuImageFailureReason({
      metadata: { width: 928, height: 1152 },
      review: {
        hasReadableText: false,
        hasUiLikeElements: false,
        hasSignageOrLogo: false,
      },
    }),
    null,
  );
});
