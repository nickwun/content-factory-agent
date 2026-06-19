import assert from "node:assert/strict";
import test from "node:test";

import {
  FetchTimeoutError,
  fetchWithTimeout,
} from "../publish/fetch-with-timeout.ts";

test("fetchWithTimeout passes an AbortSignal and returns the upstream response", async () => {
  let sawSignal = false;

  const response = await fetchWithTimeout(
    async (_input, init) => {
      sawSignal = init?.signal instanceof AbortSignal;
      return new Response("ok", { status: 200 });
    },
    "https://example.com/resource",
    { method: "POST" },
    { label: "example request", timeoutMs: 1000 },
  );

  assert.equal(await response.text(), "ok");
  assert.equal(sawSignal, true);
});

test("fetchWithTimeout aborts slow requests with a structured timeout error", async () => {
  await assert.rejects(
    async () => {
      await fetchWithTimeout(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
        "https://example.com/slow",
        {},
        { label: "slow request", timeoutMs: 5 },
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof FetchTimeoutError);
      assert.equal(error.label, "slow request");
      assert.equal(error.timeoutMs, 5);
      assert.match(error.message, /slow request timed out after 5ms/);
      return true;
    },
  );
});
