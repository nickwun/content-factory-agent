import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WECHAT_COVER_IMAGE,
  getWechatCoverImageStatusLabel,
  hasWechatCoverImageComparison,
  resolveWechatCoverImage,
} from "../workspace/wechat-cover-image.ts";

test("resolveWechatCoverImage falls back to idle for old records without cover image", () => {
  assert.deepEqual(resolveWechatCoverImage(undefined), DEFAULT_WECHAT_COVER_IMAGE);
  assert.deepEqual(resolveWechatCoverImage(null), DEFAULT_WECHAT_COVER_IMAGE);
});

test("resolveWechatCoverImage preserves generated cover image fields", () => {
  assert.deepEqual(
    resolveWechatCoverImage({
      status: "generated",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        model: "old-model",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    }),
    {
      status: "generated",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        model: "old-model",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    },
  );
});

test("resolveWechatCoverImage preserves an existing image during generating and failed states", () => {
  assert.deepEqual(
    resolveWechatCoverImage({
      status: "generating",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      error: "old error",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    }),
    {
      status: "generating",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      error: "old error",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    },
  );

  assert.deepEqual(
    resolveWechatCoverImage({
      status: "failed",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      error: "generation failed",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    }),
    {
      status: "failed",
      imageUrl: "/api/generated-images/cover-1",
      model: "test-model",
      generatedAt: "2026-04-08T10:00:00.000Z",
      error: "generation failed",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
        generatedAt: "2026-04-08T09:00:00.000Z",
      },
    },
  );
});

test("getWechatCoverImageStatusLabel returns stable labels for all cover image states", () => {
  assert.equal(getWechatCoverImageStatusLabel("idle"), "尚未生成");
  assert.equal(getWechatCoverImageStatusLabel("generating"), "正在生成");
  assert.equal(getWechatCoverImageStatusLabel("generated"), "已生成");
  assert.equal(getWechatCoverImageStatusLabel("failed"), "生成失败");
});

test("hasWechatCoverImageComparison only returns true for a generated current image with a previous image", () => {
  assert.equal(
    hasWechatCoverImageComparison({
      status: "generated",
      imageUrl: "/api/generated-images/cover-1",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
      },
    }),
    true,
  );

  assert.equal(
    hasWechatCoverImageComparison({
      status: "failed",
      imageUrl: "/api/generated-images/cover-1",
      previousImage: {
        imageUrl: "/api/generated-images/cover-0",
      },
    }),
    false,
  );

  assert.equal(
    hasWechatCoverImageComparison({
      status: "generated",
      imageUrl: "/api/generated-images/cover-1",
    }),
    false,
  );
});
