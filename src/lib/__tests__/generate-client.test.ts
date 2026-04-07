import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GENERATION_TIMEOUT_MS,
  GenerateRequestError,
  buildGenerateErrorMessage,
  getGeneratePendingMessage,
  requestGeneratedDraft,
} from "../generation/generate-client.ts";

test("buildGenerateErrorMessage returns a dynamic missing-config message for twitter", () => {
  const message = buildGenerateErrorMessage(
    new GenerateRequestError(
      "missing_openrouter_config",
      "Missing OpenRouter config: OPENROUTER_API_KEY",
    ),
    ["twitter"],
  );

  assert.match(message, /Twitter/);
  assert.doesNotMatch(message, /公众号/);
});

test("buildGenerateErrorMessage returns an auth-specific message for invalid key failures", () => {
  const message = buildGenerateErrorMessage(
    new GenerateRequestError(
      "generation_failed",
      "401 Missing Authentication header",
    ),
    ["twitter"],
  );

  assert.match(message, /API Key/);
});

test("requestGeneratedDraft throws the server error code and message for non-ok responses", async () => {
  await assert.rejects(
    () =>
      requestGeneratedDraft(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "generation_failed",
                message: "401 Missing Authentication header",
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
          userPrompt: "写一条 Twitter 内容",
          selectedPlatforms: ["twitter"],
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateRequestError);
      assert.equal(error.code, "generation_failed");
      assert.match(error.message, /401/);
      return true;
    },
  );
});

test("requestGeneratedDraft aborts stalled requests and returns a timeout error", async () => {
  await assert.rejects(
    () =>
      requestGeneratedDraft(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
        {
          userPrompt: "写一条 Twitter 内容",
          selectedPlatforms: ["twitter"],
        },
        { timeoutMs: 10 },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateRequestError);
      assert.equal(error.code, "generation_timeout");
      return true;
    },
  );
});

test("generate client uses a longer default timeout for slower real AI generations", () => {
  assert.equal(DEFAULT_GENERATION_TIMEOUT_MS, 80000);
});

test("getGeneratePendingMessage warns when multiple real AI platforms are selected", () => {
  const message = getGeneratePendingMessage(["wechat_article", "twitter"]);

  assert.match(message, /真实 AI/);
  assert.match(message, /30-60 秒/);
  assert.match(message, /单平台/);
});

test("buildGenerateErrorMessage suggests single-platform generation after timeout on multiple real platforms", () => {
  const message = buildGenerateErrorMessage(
    new GenerateRequestError(
      "generation_timeout",
      "Generation request timed out",
    ),
    ["wechat_article", "twitter"],
  );

  assert.match(message, /超时/);
  assert.match(message, /单平台/);
});
