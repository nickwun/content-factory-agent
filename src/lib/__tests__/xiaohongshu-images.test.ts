import assert from "node:assert/strict";
import test from "node:test";

import type { XiaohongshuContent } from "../types/history.ts";
import {
  failXiaohongshuImageGeneration,
  finishXiaohongshuImageGeneration,
  startXiaohongshuImageGeneration,
} from "../workspace/xiaohongshu-images.ts";

function createContent(): XiaohongshuContent {
  return {
    platform: "xiaohongshu",
    title: "效率提升日常笔记",
    caption: "把工作节奏拆成更小的步骤，会明显轻松很多。",
    tags: ["效率提升", "时间管理"],
    imageSuggestions: [
      {
        id: "image-1",
        index: 1,
        title: "清晨工作桌",
        description: "整洁桌面与晨光。",
        status: "suggested",
      },
      {
        id: "image-2",
        index: 2,
        title: "番茄钟专注",
        description: "定时器和安静工作区。",
        status: "suggested",
      },
    ],
  };
}

test("startXiaohongshuImageGeneration moves a suggestion from suggested to generating", () => {
  const updated = startXiaohongshuImageGeneration(createContent(), "image-1");
  const current = updated.imageSuggestions[0];
  const untouched = updated.imageSuggestions[1];

  assert.equal(current?.status, "generating");
  assert.equal(current?.imageError, undefined);
  assert.equal(current?.imageUrl, undefined);
  assert.equal(untouched?.status, "suggested");
});

test("finishXiaohongshuImageGeneration stores the image result on the current suggestion only", () => {
  const generating = startXiaohongshuImageGeneration(createContent(), "image-1");

  const updated = finishXiaohongshuImageGeneration(generating, "image-1", {
    imagePrompt: "真实摄影感的办公桌，4:5，无文字",
    imageUrl: "/api/generated-images/image-1.png",
    imageModel: "google/gemini-2.5-flash-image",
    generatedAt: "2026-04-03T12:00:00.000Z",
  });

  assert.equal(updated.imageSuggestions[0]?.status, "generated");
  assert.equal(
    updated.imageSuggestions[0]?.imageUrl,
    "/api/generated-images/image-1.png",
  );
  assert.equal(updated.imageSuggestions[0]?.imageError, undefined);
  assert.equal(updated.imageSuggestions[1]?.status, "suggested");
});

test("failXiaohongshuImageGeneration marks only the current suggestion as failed and keeps others untouched", () => {
  const generating = startXiaohongshuImageGeneration(createContent(), "image-2");
  const updated = failXiaohongshuImageGeneration(
    generating,
    "image-2",
    {
      imageError: "OpenRouter request timed out",
      imageFailureReason: "failed_upstream_generation",
    },
  );

  assert.equal(updated.imageSuggestions[1]?.status, "failed");
  assert.equal(updated.imageSuggestions[1]?.imageError, "OpenRouter request timed out");
  assert.equal(
    updated.imageSuggestions[1]?.imageFailureReason,
    "failed_upstream_generation",
  );
  assert.equal(updated.imageSuggestions[0]?.status, "suggested");
});

test("startXiaohongshuImageGeneration allows retry from failed and regenerate from generated", () => {
  const failed = failXiaohongshuImageGeneration(
    startXiaohongshuImageGeneration(createContent(), "image-1"),
    "image-1",
    {
      imageError: "temporary failure",
      imageFailureReason: "failed_upstream_generation",
    },
  );
  const retrying = startXiaohongshuImageGeneration(failed, "image-1");

  assert.equal(retrying.imageSuggestions[0]?.status, "generating");
  assert.equal(retrying.imageSuggestions[0]?.imageError, undefined);

  const generated = finishXiaohongshuImageGeneration(retrying, "image-1", {
    imagePrompt: "真实摄影感的办公桌，4:5，无文字",
    imageUrl: "/api/generated-images/image-1.png",
    imageModel: "google/gemini-2.5-flash-image",
    generatedAt: "2026-04-03T12:00:00.000Z",
  });
  const regenerating = startXiaohongshuImageGeneration(generated, "image-1");

  assert.equal(regenerating.imageSuggestions[0]?.status, "generating");
  assert.equal(regenerating.imageSuggestions[0]?.imageUrl, undefined);
});

test("invalid image state transitions are rejected", () => {
  const content = createContent();

  assert.throws(
    () => finishXiaohongshuImageGeneration(content, "image-1", {
      imagePrompt: "prompt",
      imageUrl: "/api/generated-images/image-1.png",
      imageModel: "model",
      generatedAt: "2026-04-03T12:00:00.000Z",
    }),
    /Invalid xiaohongshu image state transition/,
  );

  assert.throws(
    () =>
      failXiaohongshuImageGeneration(content, "image-1", {
        imageError: "failed",
      }),
    /Invalid xiaohongshu image state transition/,
  );
});
