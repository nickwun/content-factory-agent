import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveOpenRouterImageModalities,
  shouldRetryWithImageOnlyModalities,
} from "../generation/openrouter-image-generation-service.ts";

test("resolveOpenRouterImageModalities uses image-only output for seedream models", () => {
  assert.deepEqual(
    resolveOpenRouterImageModalities("bytedance-seed/seedream-4.5"),
    ["image"],
  );
});

test("resolveOpenRouterImageModalities keeps image+text for multimodal image models", () => {
  assert.deepEqual(
    resolveOpenRouterImageModalities("google/gemini-2.5-flash-image-preview"),
    ["image", "text"],
  );
});

test("shouldRetryWithImageOnlyModalities only retries image+text incompatibility once", () => {
  assert.equal(
    shouldRetryWithImageOnlyModalities(
      new Error(
        "404 No endpoints found that support the requested output modalities: image, text",
      ),
      ["image", "text"],
    ),
    true,
  );

  assert.equal(
    shouldRetryWithImageOnlyModalities(
      new Error("404 some other provider failure"),
      ["image", "text"],
    ),
    false,
  );

  assert.equal(
    shouldRetryWithImageOnlyModalities(
      new Error(
        "404 No endpoints found that support the requested output modalities: image, text",
      ),
      ["image"],
    ),
    false,
  );
});
