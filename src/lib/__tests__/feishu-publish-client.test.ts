import assert from "node:assert/strict";
import test from "node:test";

import { PublishServiceError } from "../publish/publish-errors.ts";
import { publishFeishuDocument } from "../publish/feishu-publish-client.ts";

const credentials = {
  appId: "cli_app_id",
  appSecret: "app-secret",
};

test("publishFeishuDocument creates official feishu document and writes markdown blocks", async () => {
  const requests: Array<{ url: string; method: string; body: string | null }> = [];

  const result = await publishFeishuDocument(
    credentials,
    {
      title: "跑步之后，脑子会慢慢亮起来",
      blocks: [
        {
          block_type: 3,
          heading1: {
            elements: [{ text_run: { content: "跑步之后，脑子会慢慢亮起来" } }],
          },
        },
        {
          block_type: 2,
          text: {
            elements: [{ text_run: { content: "正文内容" } }],
          },
        },
      ],
    },
    {
      fetcher: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? init.body : null,
      });

      if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
        return new Response(
          JSON.stringify({
            code: 0,
            tenant_access_token: "tenant-token",
            expire: 7200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.endsWith("/docx/v1/documents")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              document: {
                document_id: "doccn123",
                title: "跑步之后，脑子会慢慢亮起来",
                url: "https://feishu.cn/docx/doccn123",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (
        url.includes("/docx/v1/documents/doccn123/blocks/doccn123/children")
      ) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              children: [{ block_id: "block-1" }, { block_id: "block-2" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

        throw new Error(`Unexpected request: ${url}`);
      },
      resolveTenantAccessToken: async () => "tenant-token",
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.documentId, "doccn123");
  assert.equal(result.documentUrl, "https://feishu.cn/docx/doccn123");
  assert.equal(result.bodyPublished, true);
  assert.equal(result.coverSyncStatus, "skipped");
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.method, "POST");
  assert.equal(requests[1]?.method, "POST");
  assert.match(requests[1]?.url ?? "", /document_revision_id=-1/);
});

test("publishFeishuDocument returns partial success when cover upload fails after body publish", async () => {
  const result = await publishFeishuDocument(
    credentials,
    {
      title: "跑步之后，脑子会慢慢亮起来",
      blocks: [
        {
          block_type: 3,
          heading1: {
            elements: [{ text_run: { content: "跑步之后，脑子会慢慢亮起来" } }],
          },
        },
      ],
      coverImageUrl: "https://content-agent.example.com/api/generated-images/cover.jpg",
    },
    {
      fetcher: async (input) => {
        const url = String(input);

        if (url.endsWith("/docx/v1/documents")) {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                document: {
                  document_id: "doccn123",
                  url: "https://feishu.cn/docx/doccn123",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (
          url.includes("/docx/v1/documents/doccn123/blocks/doccn123/children")
        ) {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                children: [{ block_id: "image-block-1" }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url === "https://content-agent.example.com/api/generated-images/cover.jpg") {
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          });
        }

        if (url.endsWith("/drive/v1/medias/upload_all")) {
          return new Response(
            JSON.stringify({
              code: 99991663,
              msg: "upload failed",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
      resolveTenantAccessToken: async () => "tenant-token",
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.coverSyncStatus, "failed");
  assert.equal(result.coverSyncFailureReason, "upload_failed");
  assert.equal(result.warningMessage, "文档已创建，正文已发布，头图未同步。");
});

test("publishFeishuDocument maps invalid credential response into invalid_api_key", async () => {
  await assert.rejects(
    async () => {
      await publishFeishuDocument(
        credentials,
        {
          title: "跑步之后，脑子会慢慢亮起来",
          blocks: [
            {
              block_type: 3,
              heading1: {
                elements: [{ text_run: { content: "跑步之后，脑子会慢慢亮起来" } }],
              },
            },
          ],
        },
        {
          fetcher: async () => {
            throw new Error("should not reach feishu api after auth failure");
          },
          resolveTenantAccessToken: async () => {
            throw new PublishServiceError(
              "invalid_api_key",
              "飞书鉴权失败，请检查 App ID 与 App Secret。",
              401,
            );
          },
        },
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "invalid_api_key");
      return true;
    },
  );
});

test("publishFeishuDocument maps document creation timeout into publish error", async () => {
  await assert.rejects(
    async () => {
      await publishFeishuDocument(
        credentials,
        {
          title: "跑步之后，脑子会慢慢亮起来",
          blocks: [
            {
              block_type: 3,
              heading1: {
                elements: [{ text_run: { content: "跑步之后，脑子会慢慢亮起来" } }],
              },
            },
          ],
        },
        {
          fetchTimeouts: {
            createDocumentMs: 5,
          },
          fetcher: (_input, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          resolveTenantAccessToken: async () => "tenant-token",
        },
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "upstream_timeout");
      assert.equal(error.status, 504);
      assert.match(error.message, /create document.*5ms/);
      return true;
    },
  );
});

test("publishFeishuDocument batches block writes to avoid feishu field validation limits", async () => {
  const childWriteRequests: Array<{ url: string; body: string }> = [];

  const blocks = Array.from({ length: 51 }, (_, index) => ({
    block_type: 2 as const,
    text: {
      elements: [{ text_run: { content: `第 ${index + 1} 段` } }],
    },
  }));

  const result = await publishFeishuDocument(
    credentials,
    {
      title: "很多段落的文档",
      blocks,
    },
    {
      fetcher: async (input, init) => {
        const url = String(input);

        if (url.endsWith("/docx/v1/documents")) {
          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                document: {
                  document_id: "doccn123",
                  url: "https://feishu.cn/docx/doccn123",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (
          url.includes("/docx/v1/documents/doccn123/blocks/doccn123/children")
        ) {
          childWriteRequests.push({
            url,
            body: typeof init?.body === "string" ? init.body : "",
          });

          return new Response(
            JSON.stringify({
              code: 0,
              data: {
                children: [{ block_id: `block-${childWriteRequests.length}` }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      },
      resolveTenantAccessToken: async () => "tenant-token",
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.coverSyncStatus, "skipped");
  assert.equal(childWriteRequests.length, 2);

  const firstRequestBody = JSON.parse(childWriteRequests[0]?.body ?? "{}") as {
    children?: unknown[];
  };
  const secondRequestBody = JSON.parse(childWriteRequests[1]?.body ?? "{}") as {
    children?: unknown[];
  };

  assert.equal(firstRequestBody.children?.length, 50);
  assert.equal(secondRequestBody.children?.length, 1);
});
