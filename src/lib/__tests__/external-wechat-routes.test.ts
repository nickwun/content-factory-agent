import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { POST } from "../../app/api/topics/external-wechat/search/route.ts";
import {
  ExternalWechatSearchError,
  setExternalWechatServerDependenciesForTesting,
} from "../topics/external-wechat-server.ts";
import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository as createLegacyPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import { createPromptPresetService } from "../settings/prompt-preset-service.ts";
import { getDefaultPromptTemplates } from "../settings/prompt-settings-service.ts";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

afterEach(() => {
  setExternalWechatServerDependenciesForTesting(null);
  setAppDatabaseForTesting(null);
});

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("external wechat search route validates keyword and timeWindow", async () => {
  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: " ",
        timeWindow: "all",
      }),
    }) as never,
  );

  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "keyword is required");
});

test("external wechat search route returns normalized articles", async () => {
  setExternalWechatServerDependenciesForTesting({
    searchExternalWechatArticles: async () => [
      {
        id: "extwx-demo-1",
        keyword: "马拉松",
        timeWindow: "7d",
        title: "配速之外，第一次全马真正考的是节奏",
        accountName: "跑步长期主义",
        publishTime: "2026-04-16T09:00:00.000Z",
        url: "https://mp.weixin.qq.com/s/demo",
        fetchedAt: "2026-04-16T09:30:00.000Z",
        contentFetchStatus: "pending",
      },
    ],
  });

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "马拉松",
        timeWindow: "7d",
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    articles: Array<{ id: string; accountName: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.articles.length, 1);
  assert.equal(payload.articles[0]?.id, "extwx-demo-1");
  assert.equal(payload.articles[0]?.accountName, "跑步长期主义");
});

test("external wechat search route maps service errors to clear statuses", async () => {
  setExternalWechatServerDependenciesForTesting({
    searchExternalWechatArticles: async () => {
      throw new ExternalWechatSearchError(
        "missing_credentials",
        "未配置外部公众号抓取凭证。",
      );
    },
  });

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "马拉松",
        timeWindow: "all",
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "missing_credentials");
});

test("external wechat content route updates only current article batch", async () => {
  const { POST } = await import(
    "../../app/api/topics/external-wechat/fetch-content/route.ts"
  );

  setExternalWechatServerDependenciesForTesting({
    fetchExternalWechatArticleContents: async ({ articles }) =>
      articles.map((article) => ({
        ...article,
        content: `正文-${article.id}`,
        contentFetchStatus: "success",
      })),
  });

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/fetch-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articles: [
          {
            id: "extwx-demo-1",
            keyword: "马拉松",
            timeWindow: "7d",
            title: "示例文章",
            accountName: "跑步长期主义",
            url: "https://mp.weixin.qq.com/s/demo",
            fetchedAt: "2026-04-16T10:00:00.000Z",
            contentFetchStatus: "pending",
          },
        ],
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    articles: Array<{ id: string; content: string; contentFetchStatus: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.articles.length, 1);
  assert.equal(payload.articles[0]?.contentFetchStatus, "success");
  assert.equal(payload.articles[0]?.content, "正文-extwx-demo-1");
});

test("external wechat analyze route returns structured insight", async () => {
  const { POST } = await import("../../app/api/topics/external-wechat/analyze/route.ts");

  setExternalWechatServerDependenciesForTesting({
    analyzeExternalWechatArticles: async () => ({
      id: "insight-1",
      keyword: "马拉松",
      timeWindow: "7d",
      articleIds: ["extwx-demo-1", "extwx-demo-2"],
      summary: "这批文章集中命中第一次全马的临场焦虑。",
      titlePatterns: ["标题会把阶段性场景和核心冲突直接抛出来。"],
      demandDrivers: ["核心需求是缓解不确定性并给出决策判断。"],
      structurePatterns: ["常见结构是结论前置后再分段拆行动作。"],
      stylePatterns: ["表达像过来人提醒，口语感强于教程感。"],
      emotionalDrivers: ["焦虑先被点燃，再被方法感承接。"],
      rewritePotential: ["更适合作为结构参考和痛点切口参考，个人故事要改写。"],
      references: ["可以参考它们如何拆赛前准备动作。"],
      createdAt: "2026-04-16T11:00:00.000Z",
    }),
  });

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "马拉松",
        timeWindow: "7d",
        articles: [
          {
            id: "extwx-demo-1",
            keyword: "马拉松",
            timeWindow: "7d",
            title: "文章 1",
            accountName: "跑步长期主义",
            fetchedAt: "2026-04-16T10:00:00.000Z",
            contentFetchStatus: "success",
            content: "正文 1",
          },
          {
            id: "extwx-demo-2",
            keyword: "马拉松",
            timeWindow: "7d",
            title: "文章 2",
            accountName: "跑步长期主义",
            fetchedAt: "2026-04-16T10:00:00.000Z",
            contentFetchStatus: "success",
            content: "正文 2",
          },
        ],
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    insight: { id: string; summary: string; titlePatterns: string[] };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.insight.id, "insight-1");
  assert.equal(payload.insight.titlePatterns.length, 1);
});

test("external wechat rewrite task route validates selected article count and success-only samples", async () => {
  const { POST } = await import(
    "../../app/api/topics/external-wechat/rewrite-tasks/route.ts"
  );

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/rewrite-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "马拉松",
        timeWindow: "7d",
        selectedArticleIds: [],
        articles: [
          {
            id: "extwx-demo-1",
            keyword: "马拉松",
            timeWindow: "7d",
            title: "文章 1",
            accountName: "跑步长期主义",
            fetchedAt: "2026-04-16T10:00:00.000Z",
            contentFetchStatus: "success",
            content: "正文 1",
          },
        ],
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "invalid_selection_count");
});

test("external wechat rewrite task route can resolve prompt preset input", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);
  const preset = createPromptPreset(db, {
    name: "外部爆款复盘提示词",
    platform: "wechat_article",
    promptTemplate: "写成一篇更像公众号深度复盘的长文。",
  });

  const { POST } = await import(
    "../../app/api/topics/external-wechat/rewrite-tasks/route.ts"
  );

  setExternalWechatServerDependenciesForTesting({
    createExternalRewriteTask: async (input) => ({
      externalRewriteTask: {
        id: "external-task-1",
        keyword: input.keyword,
        timeWindow: input.timeWindow,
        selectedArticleIds: input.selectedArticleIds,
        brief: {
          keyword: input.keyword,
          sourceArticles: [],
          rewriteGoal: "goal",
          styleProfile: "style",
        },
        status: "pending",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
      },
      generatePayload: {
        userPrompt: input.promptPresetInput
          ? `当前使用提示词预设「${input.promptPresetInput.name}」。`
          : "no-profile",
        selectedPlatforms: ["wechat_article"],
        rewriteSource: {
          kind: "pasted_text",
          sourceName: "demo",
          extractedText: "正文",
        },
        wechatFinalization: {
          enabled: true,
        },
      },
    }),
  });

  const response = await POST(
    new Request("http://localhost/api/topics/external-wechat/rewrite-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: "马拉松",
        timeWindow: "7d",
        promptPresetId: preset.id,
        selectedArticleIds: ["extwx-demo-1"],
        articles: [
          {
            id: "extwx-demo-1",
            keyword: "马拉松",
            timeWindow: "7d",
            title: "文章 1",
            accountName: "跑步长期主义",
            fetchedAt: "2026-04-16T10:00:00.000Z",
            contentFetchStatus: "success",
            content: "正文 1",
          },
        ],
      }),
    }) as never,
  );

  const payload = (await response.json()) as {
    generatePayload: { userPrompt: string };
  };

  assert.equal(response.status, 200);
  assert.equal(
    payload.generatePayload.userPrompt.includes("当前使用提示词预设「外部爆款复盘提示词」。"),
    true,
  );
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-external-wechat-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}

function createPromptPreset(
  db: ReturnType<typeof openSqliteDatabase>,
  input: {
    name: string;
    platform: "wechat_article";
    promptTemplate: string;
  },
) {
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  const service = createPromptPresetService(repository);
  return service.createPromptPreset(input);
}
