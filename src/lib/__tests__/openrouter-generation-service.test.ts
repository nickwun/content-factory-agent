import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENROUTER_MAX_ATTEMPTS,
  OPENROUTER_REQUEST_TIMEOUT_MS,
  OpenRouterGenerationError,
  runOpenRouterRequest,
} from "../generation/openrouter-generation-service.ts";

test("runOpenRouterRequest retries once after a timeout-classified failure", async () => {
  let attempts = 0;

  const result = await runOpenRouterRequest(async () => {
    attempts += 1;

    if (attempts === 1) {
      throw new Error("Request timed out");
    }

    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("runOpenRouterRequest throws generation_timeout after exhausting retries on timeout failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runOpenRouterRequest(async () => {
        attempts += 1;
        throw new Error("Request timed out");
      }),
    (error: unknown) => {
      assert.ok(error instanceof OpenRouterGenerationError);
      assert.equal(error.code, "generation_timeout");
      return true;
    },
  );

  assert.equal(attempts, OPENROUTER_MAX_ATTEMPTS);
});

test("runOpenRouterRequest does not retry authentication failures", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      runOpenRouterRequest(async () => {
        attempts += 1;
        throw new Error("401 Missing Authentication header");
      }),
    (error: unknown) => {
      assert.ok(error instanceof OpenRouterGenerationError);
      assert.equal(error.code, "generation_failed");
      assert.match((error as Error).message, /401/);
      return true;
    },
  );

  assert.equal(attempts, 1);
});

test("OpenRouter request timeout stays comfortably below client timeout budget", () => {
  assert.equal(OPENROUTER_REQUEST_TIMEOUT_MS, 35_000);
  assert.equal(OPENROUTER_MAX_ATTEMPTS, 2);
});
