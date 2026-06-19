import type { HistoryRecord } from "../types/history.ts";
import { resolveWechatCoverImage } from "../workspace/wechat-cover-image.ts";
import type { FeishuPublishSnapshot } from "./types.ts";

export function createFeishuPublishSnapshot(
  record: HistoryRecord,
): FeishuPublishSnapshot {
  const article = record.content.wechat_article;

  if (!article) {
    throw new Error("Missing wechat article content");
  }

  const resolvedCoverImage = resolveWechatCoverImage(article.coverImage);

  return {
    schemaVersion: "v1",
    platform: "wechat_article",
    recordId: record.id,
    title: article.title,
    markdownBody: article.markdownBody,
    ...(resolvedCoverImage.imageUrl
      ? { coverImageUrl: resolvedCoverImage.imageUrl }
      : {}),
    blocks: article.blocks,
  };
}

export function buildFeishuPublishPreviewChecks(record: HistoryRecord) {
  const article = record.content.wechat_article;

  const items = [
    {
      id: "article_exists",
      label: "存在公众号正文",
      passed: Boolean(article),
    },
    {
      id: "title_exists",
      label: "标题非空",
      passed: Boolean(article?.title.trim()),
    },
    {
      id: "content_exists",
      label: "正文内容非空",
      passed: Boolean(
        article &&
          ((typeof article.markdownBody === "string" &&
            article.markdownBody.trim().length > 0) ||
            article.blocks.length > 0),
      ),
    },
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
  };
}
