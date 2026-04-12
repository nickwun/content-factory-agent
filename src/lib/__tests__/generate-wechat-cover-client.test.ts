import assert from "node:assert/strict";
import test from "node:test";

import {
  GenerateWechatCoverRequestError,
  buildGenerateWechatCoverErrorMessage,
  requestGeneratedWechatCover,
} from "../generation/generate-wechat-cover-client.ts";

test("requestGeneratedWechatCover preserves server error code and message", async () => {
  await assert.rejects(
    () =>
      requestGeneratedWechatCover(
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
          articleTitle: "写作为什么能延缓衰老",
          articleBlocks: [
            {
              id: "p-1",
              type: "paragraph",
              text: "正文",
            },
          ],
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateWechatCoverRequestError);
      assert.equal(error.code, "generation_failed");
      assert.match(error.message, /provider unavailable/);
      return true;
    },
  );
});

test("requestGeneratedWechatCover aborts stalled requests and returns a timeout error", async () => {
  await assert.rejects(
    () =>
      requestGeneratedWechatCover(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
        {
          articleTitle: "写作为什么能延缓衰老",
          articleBlocks: [
            {
              id: "p-1",
              type: "paragraph",
              text: "正文",
            },
          ],
        },
        { timeoutMs: 10 },
      ),
    (error: unknown) => {
      assert.ok(error instanceof GenerateWechatCoverRequestError);
      assert.equal(error.code, "generation_timeout");
      return true;
    },
  );
});

test("buildGenerateWechatCoverErrorMessage returns an auth-specific message for invalid key failures", () => {
  const message = buildGenerateWechatCoverErrorMessage(
    new GenerateWechatCoverRequestError(
      "generation_failed",
      "401 Missing Authentication header",
    ),
  );

  assert.match(message, /API Key/);
});

test("buildGenerateWechatCoverErrorMessage returns a storage-specific message when public image storage is missing", () => {
  const message = buildGenerateWechatCoverErrorMessage(
    new GenerateWechatCoverRequestError(
      "missing_public_image_storage_config",
      "Missing public image storage config: SUPABASE_URL",
    ),
  );

  assert.match(message, /公网存储/);
});

test("buildGenerateWechatCoverErrorMessage returns an upload-specific message when public storage upload fails", () => {
  const message = buildGenerateWechatCoverErrorMessage(
    new GenerateWechatCoverRequestError(
      "public_image_upload_failed",
      "bucket not found",
    ),
  );

  assert.match(message, /上传到公网存储失败/);
});
