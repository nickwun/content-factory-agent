import { NextRequest, NextResponse } from "next/server.js";

import {
  analyzeExternalWechatArticles,
  ExternalWechatAnalysisError,
} from "../../../../../lib/topics/external-wechat-server.ts";
import type { ExternalWechatArticle } from "../../../../../lib/topics/external-wechat-types.ts";

type AnalyzeExternalWechatBody = {
  keyword?: unknown;
  timeWindow?: unknown;
  articles?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeExternalWechatBody;

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

    if (!Array.isArray(body.articles)) {
      return NextResponse.json({ error: "articles is required" }, { status: 400 });
    }

    const articles = body.articles.filter(isExternalWechatArticle);

    if (articles.length !== body.articles.length) {
      return NextResponse.json({ error: "articles payload is invalid" }, { status: 400 });
    }

    const insight = await analyzeExternalWechatArticles({
      keyword: body.keyword,
      timeWindow: body.timeWindow as "all" | "1d" | "7d" | "6m",
      articles,
    });

    return NextResponse.json({ insight });
  } catch (error) {
    if (error instanceof ExternalWechatAnalysisError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "missing_analysis_config"
              ? 503
              : error.code === "analysis_failed"
                ? 502
                : 400,
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "unexpected_error",
          message: "Unexpected external wechat analysis error",
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
