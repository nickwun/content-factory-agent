import assert from "node:assert/strict";
import test from "node:test";

import {
  PublishServiceError,
  toPublishErrorResponse,
} from "../publish/publish-errors.ts";

test("toPublishErrorResponse serializes publish service errors", () => {
  const error = new PublishServiceError(
    "missing_credentials",
    "未配置公众号发布凭证",
    503,
  );

  assert.deepEqual(toPublishErrorResponse(error), {
    status: 503,
    body: {
      error: {
        code: "missing_credentials",
        message: "未配置公众号发布凭证",
      },
    },
  });
});

test("toPublishErrorResponse falls back for unknown errors", () => {
  const response = toPublishErrorResponse(new Error("boom"));

  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, "upstream_publish_failed");
});
