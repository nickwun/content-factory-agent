import type { HistoryRecord } from "../types/history.ts";
import type { WechatPublishAccount, WechatPublishSnapshot } from "./types.ts";

export function createWechatPublishSnapshot(
  record: HistoryRecord,
): WechatPublishSnapshot {
  const article = record.content.wechat_article;

  if (!article) {
    throw new Error("Missing wechat article content");
  }

  const relatedXiaohongshu = record.content.xiaohongshu
    ? {
        title: record.content.xiaohongshu.title,
        caption: record.content.xiaohongshu.caption,
        tags: record.content.xiaohongshu.tags,
        imageUrls: record.content.xiaohongshu.imageSuggestions
          .filter((image) => image.status === "generated" && image.imageUrl)
          .sort((a, b) => a.index - b.index)
          .map((image) => image.imageUrl ?? ""),
      }
    : undefined;

  return {
    schemaVersion: "v1",
    platform: "wechat_article",
    recordId: record.id,
    title: article.title,
    blocks: article.blocks,
    relatedXiaohongshu,
  };
}

export function buildWechatPublishPreviewChecks(record: HistoryRecord) {
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
      id: "blocks_exists",
      label: "正文内容块非空",
      passed: Boolean(article && article.blocks.length > 0),
    },
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
  };
}

export function getWechatPublishTypeAvailability(
  record: HistoryRecord,
  account?: Pick<WechatPublishAccount, "status" | "supportedPublishTypes">,
) {
  const relatedXiaohongshu = record.content.xiaohongshu;
  const generatedImages =
    relatedXiaohongshu?.imageSuggestions.filter(
      (image) => image.status === "generated" && image.imageUrl,
    ) ?? [];

  const articleReasons: string[] = [];
  const xiaolvshuReasons: string[] = [];

  if (account?.status && account.status !== "active") {
    articleReasons.push("当前账号不可发布");
    xiaolvshuReasons.push("当前账号不可发布");
  }

  if (account && !account.supportedPublishTypes.includes("article")) {
    articleReasons.push("当前账号暂不支持普通文章发布");
  }

  if (account && !account.supportedPublishTypes.includes("xiaolvshu")) {
    xiaolvshuReasons.push("当前账号暂不支持小绿书模式");
  }

  if (!relatedXiaohongshu) {
    xiaolvshuReasons.push("当前记录缺少小红书内容");
  } else {
    if (!relatedXiaohongshu.title.trim()) {
      xiaolvshuReasons.push("小红书标题为空");
    }

    if (!relatedXiaohongshu.caption.trim()) {
      xiaolvshuReasons.push("小红书正文为空");
    }

    if (generatedImages.length === 0) {
      xiaolvshuReasons.push("至少需要 1 张已生成图片");
    }
  }

  return [
    {
      value: "article" as const,
      label: "普通公众号文章",
      description: "使用当前公众号长文内容发布到草稿箱。",
      enabled: articleReasons.length === 0,
      reasons: articleReasons,
    },
    {
      value: "xiaolvshu" as const,
      label: "小绿书（图文模式）",
      description: "优先使用当前记录里的小红书内容和图片。",
      enabled: xiaolvshuReasons.length === 0,
      reasons: xiaolvshuReasons,
    },
  ];
}
