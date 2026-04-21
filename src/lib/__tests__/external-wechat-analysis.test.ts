import assert from "node:assert/strict";
import test from "node:test";

import {
  ExternalWechatAnalysisError,
  createExternalWechatAnalysisService,
} from "../topics/external-wechat-analysis.ts";
import type { ExternalWechatArticle } from "../topics/external-wechat-types.ts";

test("external wechat analysis only uses articles with successful content fetch", async () => {
  const capturedSampleIds: string[][] = [];
  const service = createExternalWechatAnalysisService({
    analyzer: async (input) => {
      capturedSampleIds.push(input.articles.map((article) => article.id));

      return {
        summary: "最近这批文章集中命中第一次全马的赛前焦虑与准备决策。",
        titlePatterns: ["标题直接点出跑者最担心的具体环节。"],
        demandDrivers: ["命中了高频且临近比赛的实际问题。"],
        structurePatterns: ["主体常用清单式和分阶段建议推进。"],
        stylePatterns: ["整体更像过来人提醒，语气克制但不冷。"],
        emotionalDrivers: ["先用赛前焦虑打开注意力，再用方法感稳住情绪。"],
        rewritePotential: ["更值得学习具体痛点切口和结构骨架，作者个人经历要改写。"],
        references: ["参考它们如何把经验拆成可执行的准备动作。"],
      };
    },
    now: () => "2026-04-16T11:00:00.000Z",
  });

  const insight = await service.analyzeExternalWechatArticles({
    keyword: "马拉松",
    timeWindow: "7d",
    articles: [
      createArticle({
        id: "success-1",
        contentFetchStatus: "success",
        content: "正文1",
      }),
      createArticle({
        id: "failed-1",
        contentFetchStatus: "failed",
        contentFetchError: "正文补拉失败，请稍后重试。",
      }),
      createArticle({
        id: "success-2",
        contentFetchStatus: "success",
        content: "正文2",
      }),
    ],
  });

  assert.deepEqual(capturedSampleIds, [["success-1", "success-2"]]);
  assert.deepEqual(insight.articleIds, ["success-1", "success-2"]);
  assert.equal(insight.sampleNotice, undefined);
  assert.equal(insight.summary.includes("第一次全马"), true);
  assert.deepEqual(insight.titlePatterns, ["标题直接点出跑者最担心的具体环节。"]);
  assert.deepEqual(insight.demandDrivers, ["命中了高频且临近比赛的实际问题。"]);
  assert.deepEqual(insight.structurePatterns, ["主体常用清单式和分阶段建议推进。"]);
  assert.deepEqual(insight.stylePatterns, ["整体更像过来人提醒，语气克制但不冷。"]);
  assert.deepEqual(insight.emotionalDrivers, ["先用赛前焦虑打开注意力，再用方法感稳住情绪。"]);
  assert.deepEqual(insight.rewritePotential, ["更值得学习具体痛点切口和结构骨架，作者个人经历要改写。"]);
});

test("external wechat analysis returns a low-confidence result when successful samples are fewer than two", async () => {
  const service = createExternalWechatAnalysisService({
    analyzer: async () => {
      throw new Error("analyzer should not be called");
    },
    now: () => "2026-04-16T11:00:00.000Z",
  });

  const insight = await service.analyzeExternalWechatArticles({
    keyword: "马拉松",
    timeWindow: "7d",
    articles: [
      createArticle({
        id: "success-1",
        contentFetchStatus: "success",
        content: "正文1",
      }),
    ],
  });

  assert.equal(insight.sampleNotice, "成功补正文样本少于 2 篇，分析结果仅供参考。");
  assert.equal(insight.summary, "成功补正文样本少于 2 篇，暂不输出完整爆款分析。");
  assert.deepEqual(insight.titlePatterns, []);
  assert.deepEqual(insight.demandDrivers, []);
  assert.deepEqual(insight.structurePatterns, []);
  assert.deepEqual(insight.stylePatterns, []);
  assert.deepEqual(insight.emotionalDrivers, []);
  assert.deepEqual(insight.rewritePotential, []);
  assert.deepEqual(insight.references, []);
});

test("external wechat analysis normalizes analyzer failure without leaking raw upstream payloads", async () => {
  const service = createExternalWechatAnalysisService({
    analyzer: async () => {
      throw new Error("502 bad gateway from upstream model");
    },
  });

  await assert.rejects(
    () =>
      service.analyzeExternalWechatArticles({
        keyword: "马拉松",
        timeWindow: "7d",
        articles: [
          createArticle({
            id: "success-1",
            contentFetchStatus: "success",
            content: "正文1",
          }),
          createArticle({
            id: "success-2",
            contentFetchStatus: "success",
            content: "正文2",
          }),
        ],
      }),
    (error: unknown) =>
      error instanceof ExternalWechatAnalysisError &&
      error.code === "analysis_failed" &&
      error.message === "爆款分析失败，请稍后重试。",
  );
});

function createArticle(
  overrides: Partial<ExternalWechatArticle> & Pick<ExternalWechatArticle, "id">,
): ExternalWechatArticle {
  return {
    id: overrides.id,
    keyword: overrides.keyword ?? "马拉松",
    timeWindow: overrides.timeWindow ?? "7d",
    title: overrides.title ?? "第一次全马前一周应该怎么吃",
    accountName: overrides.accountName ?? "跑步老王",
    url: overrides.url ?? `https://mp.weixin.qq.com/s/${overrides.id}`,
    fetchedAt: overrides.fetchedAt ?? "2026-04-16T10:00:00.000Z",
    ...(overrides.publishTime ? { publishTime: overrides.publishTime } : {}),
    ...(overrides.metrics ? { metrics: overrides.metrics } : {}),
    ...(overrides.content ? { content: overrides.content } : {}),
    ...(overrides.contentFetchStatus
      ? { contentFetchStatus: overrides.contentFetchStatus }
      : {}),
    ...(overrides.contentFetchError
      ? { contentFetchError: overrides.contentFetchError }
      : {}),
  };
}
