import test from "node:test";
import assert from "node:assert/strict";

import { searchHistoryRecords } from "../history/history-search.ts";
import type { HistoryRecord } from "../types/history.ts";

test("searchHistoryRecords matches title and prompt summary locally", () => {
  const records: HistoryRecord[] = [
    createRecord({
      id: "record-a",
      title: "高效工作的 5 个底层逻辑",
      userPrompt: "写一篇关于如何提高工作效率的内容",
    }),
    createRecord({
      id: "record-b",
      title: "短视频脚本草稿",
      userPrompt: "写一个关于晨间习惯的短视频",
    }),
  ];

  assert.deepEqual(
    searchHistoryRecords(records, "效率").map((record) => record.id),
    ["record-a"],
  );
  assert.deepEqual(
    searchHistoryRecords(records, "晨间").map((record) => record.id),
    ["record-b"],
  );
});

function createRecord(
  overrides: Partial<HistoryRecord> & Pick<HistoryRecord, "id" | "title" | "userPrompt">,
): HistoryRecord {
  return {
    id: overrides.id,
    schemaVersion: 1,
    autoTitle: overrides.title,
    title: overrides.title,
    isCustomTitle: false,
    userPrompt: overrides.userPrompt,
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
    content: {},
    workspace: {
      activePlatform: "wechat_article",
      platformOrder: ["wechat_article"],
      lastViewedAt: "2026-03-31T12:00:00.000Z",
    },
  };
}
