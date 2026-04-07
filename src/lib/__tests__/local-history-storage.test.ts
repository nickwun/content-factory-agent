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

  await adapter.save({
    ...original,
    updatedAt: "2026-03-31T12:15:00.000Z",
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
    content: {},
    workspace: {
      activePlatform: "wechat_article",
      platformOrder: ["wechat_article", "twitter"],
      lastViewedAt: "2026-03-31T12:00:00.000Z",
    },
  };
}
