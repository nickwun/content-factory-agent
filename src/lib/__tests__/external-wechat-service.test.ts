import assert from "node:assert/strict";
import test from "node:test";

import {
  ExternalWechatSearchError,
  createExternalWechatService,
} from "../topics/external-wechat-service.ts";
import type { ExternalWechatArticle } from "../topics/external-wechat-types.ts";

test("external wechat service maps fixed time windows and normalizes article list", async () => {
  const capturedRequests: Array<Record<string, unknown>> = [];
  const service = createExternalWechatService({
    client: {
      async searchArticles(payload) {
        capturedRequests.push(payload);

        return {
          data: [
            {
              items: [
                {
                  docID: "18061095893751878019",
                  doc_url:
                    "http://mp.weixin.qq.com/s?__biz=MzkzMDQ5MTk0OA==&mid=2247513490",
                  timestamp: 1740470930,
                  title: "〖<em class=\"highlight\">人民日报</em>〗“空中校车”系列报道",
                  source: {
                    title: "宣威教体",
                  },
                },
              ],
            },
          ],
        };
      },
    },
    credentialsProvider: () => ({
      apiKey: "demo-key",
      verifyCode: "demo-verify",
    }),
    now: () => "2026-04-16T09:00:00.000Z",
  });

  const articles = await service.searchExternalWechatArticles({
    keyword: "人民日报",
    timeWindow: "7d",
  });

  assert.equal(capturedRequests.length, 1);
  assert.deepEqual(capturedRequests[0], {
    mode: 1,
    keyword: "人民日报",
    search_type: 1,
    publish_time_type: 2,
    sort_type: 2,
    currentPage: 1,
    offset: 0,
    cookies_buffer: "",
    key: "demo-key",
    verifycode: "demo-verify",
  });
  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.id, "extwx-360ee8051326");
  assert.equal(articles[0]?.title, "〖人民日报〗“空中校车”系列报道");
  assert.equal(articles[0]?.accountName, "宣威教体");
  assert.equal(
    articles[0]?.url,
    "http://mp.weixin.qq.com/s?__biz=MzkzMDQ5MTk0OA==&mid=2247513490",
  );
  assert.equal(articles[0]?.contentFetchStatus, "pending");
});

test("external wechat service keeps article ids stable across repeated searches", async () => {
  const service = createExternalWechatService({
    client: {
      async searchArticles() {
        return {
          result: {
            list: [
              {
                items: [
                  {
                    title: "<em class=\"highlight\">马拉松</em>赛前一周怎么吃",
                    source: {
                      title: "跑步老王",
                    },
                    doc_url: "https://mp.weixin.qq.com/s/example",
                    timestamp: 1740470930,
                  },
                ],
              },
            ],
          },
        };
      },
    },
    credentialsProvider: () => ({
      apiKey: "demo-key",
    }),
    now: () => "2026-04-16T09:00:00.000Z",
  });

  const first = await service.searchExternalWechatArticles({
    keyword: "马拉松",
    timeWindow: "all",
  });
  const second = await service.searchExternalWechatArticles({
    keyword: "马拉松",
    timeWindow: "all",
  });

  assert.equal(first[0]?.id, second[0]?.id);
});

test("external wechat service fails clearly when server credentials are missing", async () => {
  const service = createExternalWechatService({
    client: {
      async searchArticles() {
        return {};
      },
    },
    credentialsProvider: () => null,
  });

  await assert.rejects(
    () =>
      service.searchExternalWechatArticles({
        keyword: "跑步",
        timeWindow: "1d",
      }),
    (error: unknown) =>
      error instanceof ExternalWechatSearchError &&
      error.code === "missing_credentials",
  );
});

test("external wechat service hydrates current article batch with plain text content and bounded concurrency", async () => {
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const service = createExternalWechatService({
    client: {
      async searchArticles() {
        return {};
      },
      async fetchArticleDetail(payload) {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeRequests -= 1;

        return {
          code: 0,
          title: `详情-${payload.url.split("/").pop()}`,
          nick_name: "跑步老王",
          url: payload.url,
          pubtime: 1740470930,
          content: `正文-${payload.url.split("/").pop()}`,
        };
      },
    },
    credentialsProvider: () => ({
      apiKey: "demo-key",
      verifyCode: "demo-verify",
    }),
  });

  const articles = createPendingArticles(4);
  const hydrated = await service.fetchExternalWechatArticleContents({
    articles,
  });

  assert.equal(maxActiveRequests, 3);
  assert.equal(hydrated.length, 4);
  assert.equal(hydrated.every((article) => article.contentFetchStatus === "success"), true);
  assert.equal(hydrated[0]?.content, "正文-1");
  assert.equal(hydrated[0]?.accountName, "跑步老王");
});

test("external wechat service normalizes content fetch failures without leaking raw upstream errors", async () => {
  const service = createExternalWechatService({
    client: {
      async searchArticles() {
        return {};
      },
      async fetchArticleDetail(payload) {
        if (payload.url.includes("deleted")) {
          return {
            code: 101,
            msg: "文章被删除或违规或公众号已迁移",
          };
        }

        if (payload.url.includes("broken")) {
          throw new Error("socket hang up from upstream");
        }

        return {
          code: 0,
          url: payload.url,
          content: "可用正文",
        };
      },
    },
    credentialsProvider: () => ({
      apiKey: "demo-key",
    }),
  });

  const hydrated = await service.fetchExternalWechatArticleContents({
    articles: [
      {
        id: "extwx-deleted",
        keyword: "跑步",
        timeWindow: "7d",
        title: "已删除文章",
        accountName: "跑步长期主义",
        url: "https://mp.weixin.qq.com/s/deleted",
        fetchedAt: "2026-04-16T10:00:00.000Z",
        contentFetchStatus: "pending",
      },
      {
        id: "extwx-broken",
        keyword: "跑步",
        timeWindow: "7d",
        title: "解析失败文章",
        accountName: "跑步长期主义",
        url: "https://mp.weixin.qq.com/s/broken",
        fetchedAt: "2026-04-16T10:00:00.000Z",
        contentFetchStatus: "pending",
      },
    ],
  });

  assert.equal(hydrated[0]?.contentFetchStatus, "failed");
  assert.equal(hydrated[0]?.contentFetchError, "文章已删除、违规或公众号已迁移。");
  assert.equal(hydrated[1]?.contentFetchStatus, "failed");
  assert.equal(hydrated[1]?.contentFetchError, "正文补拉失败，请稍后重试。");
});

function createPendingArticles(count: number): ExternalWechatArticle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `extwx-${index + 1}`,
    keyword: "马拉松",
    timeWindow: "7d",
    title: `文章 ${index + 1}`,
    accountName: "跑步长期主义",
    url: `https://mp.weixin.qq.com/s/${index + 1}`,
    fetchedAt: "2026-04-16T10:00:00.000Z",
    contentFetchStatus: "pending",
  }));
}
