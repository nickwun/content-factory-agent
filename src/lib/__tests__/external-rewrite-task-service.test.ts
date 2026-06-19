import assert from "node:assert/strict";
import test from "node:test";

import {
  createExternalRewriteTaskService,
  ExternalRewriteTaskError,
} from "../topics/external-rewrite-task-service.ts";
import type { ExternalWechatArticle } from "../topics/external-wechat-types.ts";

test("external rewrite task service creates a pending task and generate payload from selected success articles", () => {
  const service = createExternalRewriteTaskService({
    now: () => "2026-04-16T12:00:00.000Z",
    randomId: () => "external-task-1",
  });

  const result = service.createExternalRewriteTask({
    keyword: "马拉松",
    timeWindow: "7d",
    articles: [
      createArticle({ id: "article-1", contentFetchStatus: "success", content: "正文 1" }),
      createArticle({ id: "article-2", contentFetchStatus: "success", content: "正文 2" }),
      createArticle({ id: "article-3", contentFetchStatus: "failed" }),
    ],
    selectedArticleIds: ["article-1", "article-2"],
    insight: {
      id: "insight-1",
      keyword: "马拉松",
      timeWindow: "7d",
      articleIds: ["article-1", "article-2"],
      summary: "这批文章都在解决第一次全马前一周的焦虑。",
      titlePatterns: [
        "标题会把比赛阶段和最焦虑的问题直接并列出来。",
        "常用结果词把注意力拉到具体准备动作上。",
      ],
      demandDrivers: [
        "核心需求是缓解决策焦虑，并给出临近比赛的明确判断。",
      ],
      structurePatterns: [
        "常见骨架是结论前置，再按准备阶段拆成几段行动建议。",
      ],
      stylePatterns: [
        "更像过来人提醒，句子偏短，少讲大道理。",
      ],
      emotionalDrivers: [
        "先用赛前焦虑把人抓住，再用方法感把情绪稳下来。",
      ],
      rewritePotential: [
        "更值得学具体切口和结构骨架。",
        "原作者的个人比赛经历不能照搬，必须换成我们自己的表达场景。",
      ],
      whyViral: ["问题具体，决策压力强。"],
      characteristics: ["经验感强，建议可执行。"],
      references: ["可以参考它们如何拆准备动作。"],
      createdAt: "2026-04-16T11:00:00.000Z",
    },
    promptPresetInput: {
      presetId: "preset-1",
      name: "马拉松复盘提示词",
      platform: "wechat_article",
      promptTemplate: "写成一篇像长期跑者发给朋友的赛前提醒，少讲标准教程。",
      corpusCount: 2,
      hasCorpus: true,
      corpusSummary: {
        tone: ["像过来人提醒，短句偏多"],
        structure: ["结论前置，再按阶段拆动作"],
        lengthHint: "整体篇幅偏中等，收束要干净。",
        reusablePhrases: ["先稳住节奏", "别临时加码"],
      },
    },
  });

  assert.equal(result.externalRewriteTask.status, "pending");
  assert.equal(result.externalRewriteTask.selectedArticleIds.length, 2);
  assert.equal(result.externalRewriteTask.brief.keyword, "马拉松");
  assert.equal(result.externalRewriteTask.brief.sourceArticles.length, 2);
  assert.deepEqual(result.externalRewriteTask.brief.analysisHighlights, {
    titlePatterns: [
      "标题会把比赛阶段和最焦虑的问题直接并列出来。",
      "常用结果词把注意力拉到具体准备动作上。",
    ],
    structurePatterns: ["常见骨架是结论前置，再按准备阶段拆成几段行动建议。"],
    emotionalDrivers: ["先用赛前焦虑把人抓住，再用方法感把情绪稳下来。"],
    rewritePotential: [
      "原作者的个人比赛经历不能照搬，必须换成我们自己的表达场景。",
      "更值得学具体切口和结构骨架。",
    ],
    demandSummary: "核心需求是缓解决策焦虑，并给出临近比赛的明确判断。",
    styleHint: "更像过来人提醒，句子偏短，少讲大道理。",
  });
  assert.deepEqual(result.externalRewriteTask.brief.whyViral, ["问题具体，决策压力强。"]);
  assert.deepEqual(result.externalRewriteTask.brief.characteristics, [
    "经验感强，建议可执行。",
  ]);
  assert.deepEqual(result.externalRewriteTask.brief.references, [
    "可以参考它们如何拆准备动作。",
  ]);
  assert.equal(result.generatePayload.selectedPlatforms[0], "wechat_article");
  assert.equal(result.generatePayload.wechatFinalization?.enabled, true);
  assert.equal(
    result.generatePayload.rewriteSource?.extractedText.includes("## 外部爆款文章 1："),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes("这批文章都在解决第一次全马前一周的焦虑。"),
    true,
  );
  assertPromptOrder(result.generatePayload.userPrompt, [
    "提示词预设：",
    "预设提示词：",
    "语料参考：",
    "这些样本为什么容易爆：",
    "这些样本的共同特点：",
    "仿写时值得参考：",
    "仿写约束：",
    "结构参考：",
    "标题与开头：",
    "情绪推进：",
    "轻量提醒：",
  ]);
  assertPromptOrder(result.generatePayload.userPrompt, [
    "仿写约束：",
    "结构参考：",
    "标题与开头：",
    "情绪推进：",
    "轻量提醒：",
  ]);
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "- 不要照搬原作者的个人比赛经历，要换成我们自己的表达场景。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "- 优先学习具体切口和结构骨架。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "- 优先用“结论前置 → 分阶段展开”的骨架组织正文。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "- 标题优先把比赛阶段和最焦虑的问题直接并列出来。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "- 情绪上先给压力感，再给往前走的方法感。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "这批内容主要击中的是：核心需求是缓解决策焦虑，并给出临近比赛的明确判断。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "表达上只做轻提醒：更像过来人提醒，句子偏短，少讲大道理。",
    ),
    true,
  );
  assert.equal(
    result.generatePayload.userPrompt.includes(
      "参考 2 份绑定语料的整体语气：像过来人提醒，短句偏多。",
    ),
    true,
  );
});

test("external rewrite task service keeps insight optional and omits analysis highlights when insight is absent", () => {
  const service = createExternalRewriteTaskService({
    now: () => "2026-04-16T12:00:00.000Z",
    randomId: () => "external-task-2",
  });

  const result = service.createExternalRewriteTask({
    keyword: "马拉松",
    timeWindow: "7d",
    articles: [
      createArticle({ id: "article-1", contentFetchStatus: "success", content: "正文 1" }),
    ],
    selectedArticleIds: ["article-1"],
  });

  assert.equal(result.externalRewriteTask.status, "pending");
  assert.equal(result.externalRewriteTask.brief.analysisHighlights, undefined);
  assert.equal(result.externalRewriteTask.brief.insightSummary, undefined);
  assert.equal(result.externalRewriteTask.brief.whyViral, undefined);
  assert.equal(result.externalRewriteTask.brief.characteristics, undefined);
  assert.equal(result.externalRewriteTask.brief.references, undefined);
});

test("external rewrite task service rejects selections outside 1 to 5 articles", () => {
  const service = createExternalRewriteTaskService();
  const articles = [
    createArticle({ id: "article-1", contentFetchStatus: "success", content: "正文 1" }),
    createArticle({ id: "article-2", contentFetchStatus: "success", content: "正文 2" }),
    createArticle({ id: "article-3", contentFetchStatus: "success", content: "正文 3" }),
    createArticle({ id: "article-4", contentFetchStatus: "success", content: "正文 4" }),
    createArticle({ id: "article-5", contentFetchStatus: "success", content: "正文 5" }),
    createArticle({ id: "article-6", contentFetchStatus: "success", content: "正文 6" }),
  ];

  assert.throws(
    () =>
      service.createExternalRewriteTask({
        keyword: "马拉松",
        timeWindow: "7d",
        articles,
        selectedArticleIds: [],
      }),
    (error: unknown) =>
      error instanceof ExternalRewriteTaskError &&
      error.code === "invalid_selection_count",
  );

  assert.throws(
    () =>
      service.createExternalRewriteTask({
        keyword: "马拉松",
        timeWindow: "7d",
        articles,
        selectedArticleIds: articles.map((article) => article.id),
      }),
    (error: unknown) =>
      error instanceof ExternalRewriteTaskError &&
      error.code === "invalid_selection_count",
  );
});

test("external rewrite task service rejects articles without successful content", () => {
  const service = createExternalRewriteTaskService();

  assert.throws(
    () =>
      service.createExternalRewriteTask({
        keyword: "马拉松",
        timeWindow: "7d",
        articles: [
          createArticle({ id: "article-1", contentFetchStatus: "failed" }),
          createArticle({ id: "article-2", contentFetchStatus: "success", content: "正文 2" }),
        ],
        selectedArticleIds: ["article-1"],
      }),
    (error: unknown) =>
      error instanceof ExternalRewriteTaskError &&
      error.code === "invalid_selected_articles",
  );
});

function createArticle(
  overrides: Partial<ExternalWechatArticle> & Pick<ExternalWechatArticle, "id">,
): ExternalWechatArticle {
  return {
    id: overrides.id,
    keyword: overrides.keyword ?? "马拉松",
    timeWindow: overrides.timeWindow ?? "7d",
    title: overrides.title ?? `示例文章 ${overrides.id}`,
    accountName: overrides.accountName ?? "跑步长期主义",
    url: overrides.url ?? `https://mp.weixin.qq.com/s/${overrides.id}`,
    fetchedAt: overrides.fetchedAt ?? "2026-04-16T10:00:00.000Z",
    ...(overrides.publishTime ? { publishTime: overrides.publishTime } : {}),
    ...(overrides.content ? { content: overrides.content } : {}),
    ...(overrides.contentFetchStatus
      ? { contentFetchStatus: overrides.contentFetchStatus }
      : {}),
    ...(overrides.contentFetchError
      ? { contentFetchError: overrides.contentFetchError }
      : {}),
  };
}

function assertPromptOrder(prompt: string, markers: string[]) {
  let lastIndex = -1;

  for (const marker of markers) {
    const nextIndex = prompt.indexOf(marker);
    assert.notEqual(nextIndex, -1, `missing marker: ${marker}`);
    assert.equal(
      nextIndex > lastIndex,
      true,
      `marker ${marker} should appear after previous group`,
    );
    lastIndex = nextIndex;
  }
}
