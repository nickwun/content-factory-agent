import test from "node:test";
import assert from "node:assert/strict";

import { createLocalHistoryStorage } from "../history/local-history-storage.ts";
import type { HistoryRecord } from "../types/history.ts";

test("local history storage creates, saves, renames, removes, and restores records", async () => {
  const adapter = createLocalHistoryStorage({
    storage: createMemoryStorage(),
    now: () => "2026-03-31T12:30:00.000Z",
  });

  const original = createRecord({
    id: "record-1",
    autoTitle: "高效工作的 5 个底层逻辑",
    title: "高效工作的 5 个底层逻辑",
    isCustomTitle: false,
  });

  await adapter.create(original);

  const created = await adapter.getById("record-1");
  assert.equal(created?.schemaVersion, 1);
  assert.equal(created?.workspace.activePlatform, "wechat_article");
  assert.equal(created?.workspace.lastViewedAt, "2026-03-31T12:00:00.000Z");
  assert.equal(created?.content.wechat_article?.coverImage?.status, "idle");
  assert.equal(
    created?.content.wechat_article?.markdownBody,
    "这是一段公众号正文。",
  );

  await adapter.save({
    ...original,
    updatedAt: "2026-03-31T12:15:00.000Z",
    content: {
      ...original.content,
      wechat_article: {
        ...original.content.wechat_article!,
        coverImage: {
          status: "generated",
          imageUrl: "/api/generated-images/cover-1",
          prompt: "wechat cover prompt",
          model: "mock-image-model",
          generatedAt: "2026-03-31T12:14:00.000Z",
          previousImage: {
            imageUrl: "/api/generated-images/cover-0",
            prompt: "older cover prompt",
            model: "mock-image-model",
            generatedAt: "2026-03-31T12:10:00.000Z",
          },
        },
      },
    },
    workspace: {
      ...original.workspace,
      activePlatform: "twitter",
      platformOrder: ["wechat_article", "twitter"],
      lastViewedAt: "2026-03-31T12:15:00.000Z",
    },
  });

  const saved = await adapter.getById("record-1");
  assert.equal(saved?.workspace.activePlatform, "twitter");
  assert.deepEqual(saved?.workspace.platformOrder, [
    "wechat_article",
    "twitter",
  ]);
  assert.equal(
    saved?.content.wechat_article?.coverImage?.imageUrl,
    "/api/generated-images/cover-1",
  );
  assert.equal(
    saved?.content.wechat_article?.coverImage?.status,
    "generated",
  );
  assert.equal(
    saved?.content.wechat_article?.coverImage?.previousImage?.imageUrl,
    "/api/generated-images/cover-0",
  );

  const renamed = await adapter.rename("record-1", "效率系统升级版");
  assert.equal(renamed?.title, "效率系统升级版");
  assert.equal(renamed?.isCustomTitle, true);
  assert.equal(renamed?.updatedAt, "2026-03-31T12:30:00.000Z");

  const listed = await adapter.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.title, "效率系统升级版");

  const searchResults = await adapter.search("升级版");
  assert.deepEqual(searchResults.map((record) => record.id), ["record-1"]);

  await adapter.remove("record-1");
  assert.equal(await adapter.getById("record-1"), null);
  assert.deepEqual(await adapter.list(), []);
});

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();

  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function createRecord(
  overrides: Pick<
    HistoryRecord,
    "id" | "autoTitle" | "title" | "isCustomTitle"
  >,
): HistoryRecord {
  return {
    id: overrides.id,
    schemaVersion: 1,
    autoTitle: overrides.autoTitle,
    title: overrides.title,
    isCustomTitle: overrides.isCustomTitle,
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: ["wechat_article", "twitter"],
    createdAt: "2026-03-31T12:00:00.000Z",
    updatedAt: "2026-03-31T12:00:00.000Z",
    generation: {
      generatorVersion: "mock-v1",
      modelProvider: "mock",
      modelName: "mock-v1",
      generatedAt: "2026-03-31T12:00:00.000Z",
      selectedPlatformsSnapshot: ["wechat_article", "twitter"],
      promptSnapshotByPlatform: {
        wechat_article: "wechat prompt",
        twitter: "twitter prompt",
      },
    },
    content: {
      wechat_article: {
        platform: "wechat_article",
        title: overrides.title,
        markdownBody: "这是一段公众号正文。",
        coverImage: {
          status: "idle",
        },
        blocks: [
          {
            id: "wechat-p-1",
            type: "paragraph",
            text: "这是一段公众号正文。",
          },
        ],
      },
    },
    workspace: {
      activePlatform: "wechat_article",
      platformOrder: ["wechat_article", "twitter"],
      lastViewedAt: "2026-03-31T12:00:00.000Z",
    },
  };
}

test("local history storage normalizes legacy wechat records without markdownBody on read", async () => {
  const storage = createMemoryStorage();
  storage.setItem(
    "content-agent-history",
    JSON.stringify([
      {
        id: "legacy-1",
        schemaVersion: 1,
        autoTitle: "旧记录",
        title: "旧记录",
        isCustomTitle: false,
        userPrompt: "旧提示词",
        selectedPlatforms: ["wechat_article"],
        createdAt: "2026-03-31T12:00:00.000Z",
        updatedAt: "2026-03-31T12:00:00.000Z",
        generation: {
          generatorVersion: "mock-v1",
          modelProvider: "mock",
          modelName: "mock-v1",
          generatedAt: "2026-03-31T12:00:00.000Z",
          selectedPlatformsSnapshot: ["wechat_article"],
          promptSnapshotByPlatform: {
            wechat_article: "wechat prompt",
          },
        },
        content: {
          wechat_article: {
            platform: "wechat_article",
            title: "旧记录",
            blocks: [
              {
                id: "legacy-heading-1",
                type: "heading",
                level: 2,
                text: "旧小标题",
              },
              {
                id: "legacy-paragraph-1",
                type: "paragraph",
                text: "旧正文第一段。",
              },
              {
                id: "legacy-list-1",
                type: "list",
                items: ["第一项", "第二项"],
              },
            ],
          },
        },
        workspace: {
          activePlatform: "wechat_article",
          platformOrder: ["wechat_article"],
          lastViewedAt: "2026-03-31T12:00:00.000Z",
        },
      },
    ]),
  );

  const adapter = createLocalHistoryStorage({ storage });
  const record = await adapter.getById("legacy-1");

  assert.equal(
    record?.content.wechat_article?.markdownBody,
    "## 旧小标题\n\n旧正文第一段。\n\n- 第一项\n- 第二项",
  );
});
