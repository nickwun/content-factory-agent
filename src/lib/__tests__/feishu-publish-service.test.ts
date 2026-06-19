import assert from "node:assert/strict";
import test from "node:test";

import { parseFeishuPublishRequestPayload } from "../publish/feishu-publish-service.ts";

test("parseFeishuPublishRequestPayload validates wechat article snapshot with explicit cover image", () => {
  const parsed = parseFeishuPublishRequestPayload({
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "跑步之后，脑子会慢慢亮起来",
      markdownBody: "## 小标题\n\n正文内容",
      coverImageUrl: "/api/generated-images/cover.jpg",
      blocks: [{ id: "p-1", type: "paragraph", text: "正文内容" }],
    },
  });

  assert.equal(parsed.snapshot.platform, "wechat_article");
  assert.equal(parsed.snapshot.coverImageUrl, "/api/generated-images/cover.jpg");
  assert.equal(parsed.snapshot.blocks.length, 1);
});

test("parseFeishuPublishRequestPayload accepts legacy blocks-only snapshots", () => {
  const parsed = parseFeishuPublishRequestPayload({
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "跑步之后，脑子会慢慢亮起来",
      blocks: [{ id: "p-1", type: "paragraph", text: "正文内容" }],
    },
  });

  assert.equal(parsed.snapshot.markdownBody, undefined);
});

test("parseFeishuPublishRequestPayload rejects empty title and body", () => {
  assert.throws(() => {
    parseFeishuPublishRequestPayload({
      snapshot: {
        schemaVersion: "v1",
        platform: "wechat_article",
        recordId: "record-1",
        title: "",
        blocks: [],
      },
    });
  }, (error: unknown) => {
    assert.equal(error instanceof Error, true);
    assert.equal((error as { code?: string }).code, "validation_error");
    return true;
  });
});
