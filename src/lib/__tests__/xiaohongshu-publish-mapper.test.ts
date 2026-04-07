import assert from "node:assert/strict";
import test from "node:test";

import {
  buildXiaohongshuPublishContent,
  mapXiaohongshuSnapshotToPayload,
  normalizePlainText,
  resolveAbsoluteImageUrl,
  renderXiaohongshuTags,
} from "../publish/xiaohongshu-publish-mapper.ts";
import type { XiaohongshuPublishSnapshot } from "../publish/types.ts";

const snapshot: XiaohongshuPublishSnapshot = {
  schemaVersion: "v1",
  platform: "xiaohongshu",
  recordId: "record-1",
  title: "早晨 30 分钟打开效率开关",
  caption: "先做一件最重要的事。\n\n\n别让消息把你带走。",
  tags: ["工作效率", "#时间管理", "自我提升"],
  images: [
    {
      url: "https://example.com/cover.jpg",
      index: 1,
      isCover: true,
      source: "generated_image",
    },
    {
      url: "https://example.com/detail.jpg",
      index: 2,
      isCover: false,
      source: "generated_image",
    },
  ],
};

test("normalizePlainText collapses excessive blank lines", () => {
  assert.equal(
    normalizePlainText(snapshot.caption),
    "先做一件最重要的事。\n\n别让消息把你带走。",
  );
});

test("renderXiaohongshuTags adds hashtags for presentation", () => {
  assert.equal(
    renderXiaohongshuTags(["工作效率", "时间管理"]),
    "#工作效率 #时间管理",
  );
});

test("mapXiaohongshuSnapshotToPayload selects cover and body images", () => {
  const payload = mapXiaohongshuSnapshotToPayload(
    snapshot,
    "https://app.example.com",
  );

  assert.equal(payload.coverImageUrl, "https://example.com/cover.jpg");
  assert.deepEqual(payload.bodyImageUrls, ["https://example.com/detail.jpg"]);
  assert.deepEqual(payload.tags, ["工作效率", "时间管理", "自我提升"]);
  assert.equal(payload.plainText, "先做一件最重要的事。\n\n别让消息把你带走。");
});

test("resolveAbsoluteImageUrl expands relative site image urls", () => {
  assert.equal(
    resolveAbsoluteImageUrl("/api/generated-images/asset-1", "https://app.example.com"),
    "https://app.example.com/api/generated-images/asset-1",
  );
});

test("buildXiaohongshuPublishContent appends rendered tags to note text", () => {
  assert.equal(
    buildXiaohongshuPublishContent({
      title: "标题",
      plainText: "正文",
      coverImageUrl: "https://example.com/cover.jpg",
      bodyImageUrls: [],
      tags: ["效率", "桌面整理"],
    }),
    "正文\n\n#效率 #桌面整理",
  );
});
