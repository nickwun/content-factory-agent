import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchWechatPublishAccounts,
  publishWechatArticle,
} from "../publish/wechat-publish-client.ts";
import { PublishServiceError } from "../publish/publish-errors.ts";

const credentials = {
  apiKey: "wechat-key",
  baseUrl: "https://wx.limyai.com/api/openapi",
};

test("fetchWechatPublishAccounts maps upstream rows into unified account shape", async () => {
  const accounts = await fetchWechatPublishAccounts(credentials, async (input, init) => {
    assert.equal(String(input), "https://wx.limyai.com/api/openapi/wechat-accounts");
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers instanceof Headers, false);
    assert.deepEqual(init?.headers, {
      "X-API-Key": "wechat-key",
      "Content-Type": "application/json",
      Accept: "application/json",
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          accounts: [
            {
              name: "效率研究所",
              wechatAppid: "wx1234567890",
              username: "gh_123",
              avatar: "https://example.com/avatar.jpg",
              type: "subscription",
              verified: true,
              status: "active",
            },
          ],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  assert.deepEqual(accounts, [
    {
      accountId: "wx1234567890",
      nickname: "效率研究所",
      principalName: "gh_123",
      avatarUrl: "https://example.com/avatar.jpg",
      verified: true,
      status: "active",
      supportedPublishTypes: ["article", "xiaolvshu"],
    },
  ]);
});

test("fetchWechatPublishAccounts converts 401 into invalid_api_key", async () => {
  await assert.rejects(async () => {
    await fetchWechatPublishAccounts(credentials, async () => {
      return new Response(
        JSON.stringify({ success: false, error: "API key invalid", code: "API_KEY_INVALID" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    });
  }, (error: unknown) => {
    assert.ok(error instanceof PublishServiceError);
    assert.equal(error.code, "invalid_api_key");
    return true;
  });
});

test("publishWechatArticle maps article publish payload and response", async () => {
  const result = await publishWechatArticle(
    credentials,
    {
      accountId: "gh_123",
      publishType: "article",
      snapshot: {
        schemaVersion: "v1",
        platform: "wechat_article",
        recordId: "record-1",
        title: "高效工作的 5 个方法",
        blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
      },
    },
    async (input, init) => {
      assert.equal(String(input), "https://wx.limyai.com/api/openapi/wechat-publish");
      assert.equal(init?.method, "POST");

      const payload = JSON.parse(String(init?.body)) as {
        wechatAppid: string;
        title: string;
        content: string;
        summary: string;
        contentFormat: string;
        articleType: string;
      };

      assert.equal(payload.wechatAppid, "gh_123");
      assert.equal(payload.title, "高效工作的 5 个方法");
      assert.match(payload.content, /<p>正文内容<\/p>/);
      assert.equal(payload.summary, "正文内容");
      assert.equal(payload.contentFormat, "html");
      assert.equal(payload.articleType, "news");

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            publicationId: "pub_123",
            materialId: "mat_123",
            mediaId: "media_123",
            status: "published",
            message: "文章已成功发布到公众号草稿箱",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );

  assert.deepEqual(result, {
    success: true,
    publicationId: "pub_123",
    materialId: "mat_123",
    status: "published",
    message: "文章已成功发布到公众号草稿箱",
  });
});

test("publishWechatArticle maps ACCOUNT_NOT_FOUND into account_not_found", async () => {
  await assert.rejects(
    async () => {
      await publishWechatArticle(
        credentials,
        {
          accountId: "gh_123",
          publishType: "article",
          snapshot: {
            schemaVersion: "v1",
            platform: "wechat_article",
            recordId: "record-1",
            title: "高效工作的 5 个方法",
            blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
          },
        },
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: "公众号不存在或未授权",
              code: "ACCOUNT_NOT_FOUND",
            }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          ),
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "account_not_found");
      return true;
    },
  );
});
