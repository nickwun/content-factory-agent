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

test("renderFeishuMarkdownToBlockPlan converts markdown bold markers into feishu bold text runs", () => {
  const blocks = renderFeishuMarkdownToBlockPlan(
    "跑步不内卷",
    "这是一段普通说明。\n\n**训练上：渐进式减负。**\n\n- **营养上：** 碳水是好朋友。\n\n> **提醒：** 不要临时换装备",
  );

  assert.equal(blocks[1]?.block_type, 2);
  assert.deepEqual((blocks[2] as { text: { elements: Array<unknown> } }).text.elements, [
    {
      text_run: {
        content: "训练上：渐进式减负。",
        text_element_style: {
          bold: true,
        },
      },
    },
  ]);
  assert.deepEqual((blocks[3] as { bullet: { elements: Array<unknown> } }).bullet.elements, [
    {
      text_run: {
        content: "营养上：",
        text_element_style: {
          bold: true,
        },
      },
    },
    {
      text_run: {
        content: " 碳水是好朋友。",
      },
    },
  ]);
  assert.deepEqual((blocks[4] as { quote: { elements: Array<unknown> } }).quote.elements, [
    {
      text_run: {
        content: "提醒：",
        text_element_style: {
          bold: true,
        },
      },
    },
    {
      text_run: {
        content: " 不要临时换装备",
      },
    },
  ]);
});
