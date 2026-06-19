import assert from "node:assert/strict";
import test from "node:test";

import {
  getTwitterModeStatusLabel,
  getTwitterThreadOverview,
} from "../workspace/twitter-thread.ts";
import type { TwitterContent } from "../types/history.ts";

const threadContent: TwitterContent = {
  platform: "twitter",
  mode: "thread",
  autoDetectedMode: "thread",
  userLockedMode: false,
  singleDraft: "单条草稿",
  threadDraft: ["第一条", "第二条", "第三条"],
};

test("getTwitterThreadOverview only returns items in thread mode", () => {
  const overview = getTwitterThreadOverview(
    {
      ...threadContent,
      mode: "single",
    },
    0,
  );

  assert.equal(overview, null);
});

test("getTwitterThreadOverview clamps the active index and marks the active item", () => {
  const overview = getTwitterThreadOverview(threadContent, 99);

  assert.ok(overview);
  assert.equal(overview.count, 3);
  assert.equal(overview.activeIndex, 2);
  assert.deepEqual(
    overview.items.map((item) => item.isActive),
    [false, false, true],
  );
});

test("getTwitterModeStatusLabel preserves auto recommendation semantics", () => {
  assert.equal(getTwitterModeStatusLabel(threadContent), "推荐：Thread");
  assert.equal(
    getTwitterModeStatusLabel({
      ...threadContent,
      userLockedMode: true,
    }),
    "手动锁定",
  );
});
