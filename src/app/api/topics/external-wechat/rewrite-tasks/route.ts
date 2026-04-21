import { NextRequest, NextResponse } from "next/server.js";

import {
  createExternalRewriteTask,
  ExternalRewriteTaskError,
  PromptPresetError,
} from "../../../../../lib/topics/external-wechat-server.ts";
import type {
  ExternalTopicInsight,
  ExternalWechatArticle,
} from "../../../../../lib/topics/external-wechat-types.ts";

type CreateExternalRewriteTaskBody = {
  keyword?: unknown;
  timeWindow?: unknown;
  promptPresetId?: unknown;
  selectedArticleIds?: unknown;
  articles?: unknown;
  insight?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateExternalRewriteTaskBody;

    if (!body.keyword || typeof body.keyword !== "string" || !body.keyword.trim()) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    if (
      !body.timeWindow ||
      typeof body.timeWindow !== "string" ||
      !["all", "1d", "7d", "6m"].includes(body.timeWindow)
    ) {
      return NextResponse.json({ error: "timeWindow is invalid" }, { status: 400 });
    }

    if (!Array.isArray(body.selectedArticleIds)) {
      return NextResponse.json({ error: "selectedArticleIds is required" }, { status: 400 });
    }

    if (!Array.isArray(body.articles)) {
      return NextResponse.json({ error: "articles is required" }, { status: 400 });
    }

    if (
      body.promptPresetId !== undefined &&
      (typeof body.promptPresetId !== "string" || !body.promptPresetId.trim())
    ) {
      return NextResponse.json({ error: "promptPresetId is invalid" }, { status: 400 });
    }

    const selectedArticleIds = body.selectedArticleIds.filter(
      (value): value is string => typeof value === "string",
    );
    const articles = body.articles.filter(isExternalWechatArticle);

    if (
      selectedArticleIds.length !== body.selectedArticleIds.length ||
      articles.length !== body.articles.length
    ) {
      return NextResponse.json(
        { error: "rewrite task payload is invalid" },
        { status: 400 },
      );
    }

    const result = await createExternalRewriteTask({
      keyword: body.keyword,
      timeWindow: body.timeWindow as "all" | "1d" | "7d" | "6m",
      selectedArticleIds,
      articles,
      ...(isExternalTopicInsight(body.insight) ? { insight: body.insight } : {}),
      ...(typeof body.promptPresetId === "string"
        ? { promptPresetId: body.promptPresetId.trim() }
        : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PromptPresetError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.code === "preset_not_found" ? 404 : 400 },
      );
    }

    if (error instanceof ExternalRewriteTaskError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "unexpected_error",
          message: "Unexpected external rewrite task error",
        },
      },
      { status: 500 },
    );
  }
}

function isExternalWechatArticle(value: unknown): value is ExternalWechatArticle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "keyword" in value &&
    typeof value.keyword === "string" &&
    "timeWindow" in value &&
    typeof value.timeWindow === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "accountName" in value &&
    typeof value.accountName === "string" &&
    "fetchedAt" in value &&
    typeof value.fetchedAt === "string"
  );
}

function isExternalTopicInsight(value: unknown): value is ExternalTopicInsight {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "keyword" in value &&
    typeof value.keyword === "string" &&
    "timeWindow" in value &&
    typeof value.timeWindow === "string" &&
    "summary" in value &&
    typeof value.summary === "string" &&
    "whyViral" in value &&
    Array.isArray(value.whyViral) &&
    "characteristics" in value &&
    Array.isArray(value.characteristics) &&
    "references" in value &&
    Array.isArray(value.references) &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}
