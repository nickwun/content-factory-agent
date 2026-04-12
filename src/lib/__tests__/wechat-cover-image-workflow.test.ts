import test from "node:test";
import assert from "node:assert/strict";

import type { WechatArticleContent } from "../types/history.ts";
import {
  failWechatCoverImageGeneration,
  finishWechatCoverImageGeneration,
  startWechatCoverImageGeneration,
} from "../workspace/wechat-cover-image-workflow.ts";

function createArticle(
  coverImage: WechatArticleContent["coverImage"] = {
    status: "idle",
  },
): WechatArticleContent {
  return {
    platform: "wechat_article",
    title: "测试标题",
    coverImage,
    blocks: [
      {
        id: "p-1",
        type: "paragraph",
        text: "测试正文",
      },
    ],
  };
}

test("startWechatCoverImageGeneration keeps the existing image visible while generating", () => {
  const next = startWechatCoverImageGeneration(
    createArticle({
      status: "generated",
      imageUrl: "/api/generated-images/existing-cover",
      model: "old-model",
      prompt: "old prompt",
      generatedAt: "2026-04-08T12:00:00.000Z",
      previousImage: {
        imageUrl: "/api/generated-images/older-cover",
        model: "older-model",
        prompt: "older prompt",
        generatedAt: "2026-04-08T11:00:00.000Z",
      },
    }),
  );

  assert.deepEqual(next.coverImage, {
    status: "generating",
    imageUrl: "/api/generated-images/existing-cover",
    model: "old-model",
    prompt: "old prompt",
    generatedAt: "2026-04-08T12:00:00.000Z",
    previousImage: {
      imageUrl: "/api/generated-images/older-cover",
      model: "older-model",
      prompt: "older prompt",
      generatedAt: "2026-04-08T11:00:00.000Z",
    },
    error: undefined,
  });
});

test("finishWechatCoverImageGeneration replaces the old image only after success", () => {
  const next = finishWechatCoverImageGeneration(createArticle(), {
    imageUrl: "/api/generated-images/new-cover",
    model: "new-model",
    prompt: "new prompt",
    generatedAt: "2026-04-08T13:00:00.000Z",
  });

  assert.deepEqual(next.coverImage, {
    status: "generated",
    imageUrl: "/api/generated-images/new-cover",
    model: "new-model",
    prompt: "new prompt",
    generatedAt: "2026-04-08T13:00:00.000Z",
  });
});

test("finishWechatCoverImageGeneration preserves the previous current image for comparison after regenerate success", () => {
  const next = finishWechatCoverImageGeneration(
    createArticle({
      status: "generated",
      imageUrl: "/api/generated-images/existing-cover",
      model: "old-model",
      prompt: "old prompt",
      generatedAt: "2026-04-08T12:00:00.000Z",
    }),
    {
      imageUrl: "/api/generated-images/new-cover",
      model: "new-model",
      prompt: "new prompt",
      generatedAt: "2026-04-08T13:00:00.000Z",
    },
  );

  assert.deepEqual(next.coverImage, {
    status: "generated",
    imageUrl: "/api/generated-images/new-cover",
    model: "new-model",
    prompt: "new prompt",
    generatedAt: "2026-04-08T13:00:00.000Z",
    previousImage: {
      imageUrl: "/api/generated-images/existing-cover",
      model: "old-model",
      prompt: "old prompt",
      generatedAt: "2026-04-08T12:00:00.000Z",
    },
  });
});

test("failWechatCoverImageGeneration preserves the previous image and records the error", () => {
  const next = failWechatCoverImageGeneration(
    createArticle({
      status: "generated",
      imageUrl: "/api/generated-images/existing-cover",
      model: "old-model",
      prompt: "old prompt",
      generatedAt: "2026-04-08T12:00:00.000Z",
      previousImage: {
        imageUrl: "/api/generated-images/older-cover",
        model: "older-model",
        prompt: "older prompt",
        generatedAt: "2026-04-08T11:00:00.000Z",
      },
    }),
    {
      error: "上游图片服务失败",
    },
  );

  assert.deepEqual(next.coverImage, {
    status: "failed",
    imageUrl: "/api/generated-images/existing-cover",
    model: "old-model",
    prompt: "old prompt",
    generatedAt: "2026-04-08T12:00:00.000Z",
    previousImage: {
      imageUrl: "/api/generated-images/older-cover",
      model: "older-model",
      prompt: "older prompt",
      generatedAt: "2026-04-08T11:00:00.000Z",
    },
    error: "上游图片服务失败",
  });
});
