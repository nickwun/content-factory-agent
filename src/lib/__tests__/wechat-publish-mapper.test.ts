import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWechatDigest,
  mapWechatSnapshotToArticlePayload,
  mapWechatSnapshotToXiaolvshuPayload,
  renderWechatBlocksToHtml,
} from "../publish/wechat-publish-mapper.ts";
import type { WechatPublishSnapshot } from "../publish/types.ts";

const snapshot: WechatPublishSnapshot = {
  schemaVersion: "v1",
  platform: "wechat_article",
  recordId: "record-1",
  title: "高效工作的 5 个方法",
  blocks: [
    { id: "heading-1", type: "heading", level: 2, text: "先做最重要的事" },
    {
      id: "paragraph-1",
      type: "paragraph",
      text: "把精力先给最重要的任务，而不是先清空所有消息。",
    },
    {
      id: "list-1",
      type: "list",
      items: ["每天只选 1 个关键目标", "给任务设置明确完成标准"],
    },
  ],
};

test("renderWechatBlocksToHtml converts structured blocks to html", () => {
  const html = renderWechatBlocksToHtml(snapshot.blocks);

  assert.match(html, /<h2>先做最重要的事<\/h2>/);
  assert.match(html, /<p>把精力先给最重要的任务/);
  assert.match(html, /<ul><li>每天只选 1 个关键目标<\/li>/);
});

test("buildWechatDigest creates a compact summary from blocks", () => {
  const digest = buildWechatDigest(snapshot.blocks);

  assert.match(digest, /先做最重要的事/);
  assert.ok(digest.length <= 120);
});

test("mapWechatSnapshotToArticlePayload returns title, html content and summary", () => {
  const payload = mapWechatSnapshotToArticlePayload(snapshot);

  assert.equal(payload.title, snapshot.title);
  assert.match(payload.content, /<h2>/);
  assert.ok(payload.summary.length > 0);
  assert.equal(payload.contentFormat, "html");
  assert.equal(payload.articleType, "news");
});

test("mapWechatSnapshotToXiaolvshuPayload uses related xiaohongshu content and images", () => {
  const payload = mapWechatSnapshotToXiaolvshuPayload({
    ...snapshot,
    relatedXiaohongshu: {
      title: "小绿书标题",
      caption: "第一段文案\n\n第二段文案",
      tags: ["效率", "桌面整理"],
      imageUrls: ["https://example.com/cover.jpg", "https://example.com/detail.jpg"],
    },
  });

  assert.equal(payload.title, "小绿书标题");
  assert.equal(payload.coverImage, "https://example.com/cover.jpg");
  assert.deepEqual(payload.mainImages, ["https://example.com/detail.jpg"]);
  assert.match(payload.content, /第一段文案/);
  assert.match(payload.content, /#效率 #桌面整理/);
  assert.equal(payload.articleType, "newspic");
});
