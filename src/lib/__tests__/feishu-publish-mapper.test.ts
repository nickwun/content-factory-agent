import assert from "node:assert/strict";
import test from "node:test";

import {
  mapFeishuSnapshotToPayload,
  renderFeishuMarkdownToBlockPlan,
} from "../publish/feishu-publish-mapper.ts";
import type { FeishuPublishSnapshot } from "../publish/types.ts";

const snapshot: FeishuPublishSnapshot = {
  schemaVersion: "v1",
  platform: "wechat_article",
  recordId: "record-1",
  title: "跑步之后，脑子会慢慢亮起来",
  markdownBody:
    "## 小标题\n\n这是一段正文。\n\n- 列表一\n- 列表二\n\n> 一段引用\n\n---\n\n1. 第一点",
  coverImageUrl: "/api/generated-images/cover.jpg",
  blocks: [{ id: "p-1", type: "paragraph", text: "这是 blocks 兜底正文。" }],
};

test("renderFeishuMarkdownToBlockPlan prepends title block and maps controlled markdown nodes", () => {
  const blocks = renderFeishuMarkdownToBlockPlan(
    snapshot.title,
    snapshot.markdownBody ?? "",
  );

  assert.equal(blocks[0]?.block_type, 3);
  assert.equal(blocks[1]?.block_type, 4);
  assert.equal(blocks[2]?.block_type, 2);
  assert.equal(blocks[3]?.block_type, 12);
  assert.equal(blocks[4]?.block_type, 12);
  assert.equal(blocks[5]?.block_type, 15);
  assert.equal(blocks[6]?.block_type, 22);
  assert.equal(blocks[7]?.block_type, 13);
});

test("mapFeishuSnapshotToPayload prefers markdownBody and keeps cover image explicit", () => {
  const payload = mapFeishuSnapshotToPayload(
    snapshot,
    "https://content-agent.example.com",
  );

  assert.equal(payload.title, snapshot.title);
  assert.equal(
    payload.coverImageUrl,
    "https://content-agent.example.com/api/generated-images/cover.jpg",
  );
  assert.equal(payload.blocks[0]?.block_type, 3);
  assert.equal(payload.blocks[1]?.block_type, 4);
  assert.equal(payload.blocks.at(-1)?.block_type, 13);
});
