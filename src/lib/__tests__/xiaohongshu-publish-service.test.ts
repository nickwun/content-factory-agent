import assert from "node:assert/strict";
import test from "node:test";

import { PublishServiceError } from "../publish/publish-errors.ts";
import { parseXiaohongshuPublishRequestPayload } from "../publish/xiaohongshu-publish-service.ts";

test("parseXiaohongshuPublishRequestPayload validates a usable publish snapshot", () => {
  const parsed = parseXiaohongshuPublishRequestPayload({
    snapshot: {
      schemaVersion: "v1",
      platform: "xiaohongshu",
      recordId: "record-1",
      title: "高效办公桌面整理",
      caption: "把桌面整理得更干净一点。",
      tags: ["效率", "#桌面整理"],
      images: [
        {
          url: "/api/generated-images/asset-1",
          index: 1,
          isCover: true,
          source: "generated_image",
        },
      ],
    },
  });

  assert.equal(parsed.snapshot.platform, "xiaohongshu");
  assert.equal(parsed.snapshot.images.length, 1);
  assert.deepEqual(parsed.snapshot.tags, ["效率", "桌面整理"]);
});

test("parseXiaohongshuPublishRequestPayload rejects missing images", () => {
  assert.throws(
    () =>
      parseXiaohongshuPublishRequestPayload({
        snapshot: {
          schemaVersion: "v1",
          platform: "xiaohongshu",
          recordId: "record-1",
          title: "",
          caption: "正文",
          tags: [],
          images: [],
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "missing_images");
      return true;
    },
  );
});
