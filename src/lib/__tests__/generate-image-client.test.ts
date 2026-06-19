import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
  GenerateImageRequestError,
  buildGenerateImageErrorMessage,
  requestGeneratedImage,
} from "../generation/generate-image-client.ts";

test("requestGeneratedImage throws the server error code and message for non-ok responses", async () => {
  await assert.rejects(
    () =>
      requestGeneratedImage(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "generation_failed",
                message: "image provider unavailable",
              },
            }),
            {
              status: 502,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        {
          platform: "xiaohongshu",
          noteTitle: "效率提升",
          noteCaption: "正文",
          noteTags: ["效率"],
          suggestion: {
            id: "image-1",
            index: 1,
            title: "桌面场景",
            description: "整洁桌面",
          },
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateImageRequestError);
      assert.equal(error.code, "generation_failed");
      assert.match(error.message, /provider unavailable/);
      return true;
    },
  );
});

test("requestGeneratedImage aborts stalled requests and returns a timeout error", async () => {
  await assert.rejects(
    () =>
      requestGeneratedImage(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
        {
          platform: "xiaohongshu",
          noteTitle: "效率提升",
          noteCaption: "正文",
          noteTags: ["效率"],
          suggestion: {
            id: "image-1",
            index: 1,
            title: "桌面场景",
            description: "整洁桌面",
          },
        },
        { timeoutMs: 10 },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateImageRequestError);
      assert.equal(error.code, "generation_timeout");
      return true;
    },
  );
});

test("buildGenerateImageErrorMessage returns a specific missing-image-model message", () => {
  const message = buildGenerateImageErrorMessage(
    new GenerateImageRequestError(
      "missing_openrouter_image_config",
      "Missing OpenRouter config: OPENROUTER_IMAGE_MODEL",
    ),
  );

  assert.match(message, /图片生成模型/);
});

test("buildGenerateImageErrorMessage returns an auth-specific message for invalid key failures", () => {
  const message = buildGenerateImageErrorMessage(
    new GenerateImageRequestError(
      "generation_failed",
      "401 Missing Authentication header",
    ),
  );

  assert.match(message, /API Key/);
});

test("generate image client keeps a longer timeout budget for image generation", () => {
  assert.equal(DEFAULT_IMAGE_GENERATION_TIMEOUT_MS, 120000);
});
