import assert from "node:assert/strict";
import test from "node:test";

import { PublishServiceError } from "../publish/publish-errors.ts";
import { publishXiaohongshuNote } from "../publish/xiaohongshu-publish-client.ts";

const credentials = {
  apiKey: "xhs-key",
  baseUrl: "https://publisher.example.com/xiaohongshu",
};

test("publishXiaohongshuNote maps publish url and qrcode", async () => {
  const result = await publishXiaohongshuNote(
    credentials,
    {
      title: "高效办公桌面整理",
      plainText: "正文内容",
      coverImageUrl: "https://example.com/cover.jpg",
      bodyImageUrls: ["https://example.com/detail.jpg"],
      tags: ["效率", "桌面整理"],
    },
    async (input, init) => {
      assert.equal(
        String(input),
        "https://publisher.example.com/xiaohongshu/publish",
      );

      const payload = JSON.parse(String(init?.body)) as {
        title: string;
        content: string;
        images: string[];
      };

      assert.equal(payload.title, "高效办公桌面整理");
      assert.match(payload.content, /#效率 #桌面整理/);
      assert.deepEqual(payload.images, [
        "https://example.com/cover.jpg",
        "https://example.com/detail.jpg",
      ]);

      return new Response(
        JSON.stringify({
          publish_url: "https://xhs.example.com/publish/1",
          qrcode_url: "https://xhs.example.com/qr/1.png",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  );

  assert.deepEqual(result, {
    publishUrl: "https://xhs.example.com/publish/1",
    qrcodeUrl: "https://xhs.example.com/qr/1.png",
  });
});

test("publishXiaohongshuNote maps bad image response into invalid_image_url", async () => {
  await assert.rejects(
    async () => {
      await publishXiaohongshuNote(
        credentials,
        {
          title: "高效办公桌面整理",
          plainText: "正文内容",
          coverImageUrl: "https://example.com/cover.jpg",
          bodyImageUrls: [],
          tags: [],
        },
        async () =>
          new Response(JSON.stringify({ message: "image url invalid" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "invalid_image_url");
      return true;
    },
  );
});
