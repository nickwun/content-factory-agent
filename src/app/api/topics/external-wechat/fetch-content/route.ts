import { NextRequest, NextResponse } from "next/server.js";

import {
  ExternalWechatSearchError,
  fetchExternalWechatArticleContents,
} from "../../../../../lib/topics/external-wechat-server.ts";
import type { ExternalWechatArticle } from "../../../../../lib/topics/external-wechat-types.ts";

type FetchExternalWechatContentBody = {
  articles?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FetchExternalWechatContentBody;

    if (!Array.isArray(body.articles)) {
      return NextResponse.json({ error: "articles is required" }, { status: 400 });
    }

    const articles = body.articles.filter(isExternalWechatArticle);

    if (articles.length !== body.articles.length) {
      return NextResponse.json({ error: "articles payload is invalid" }, { status: 400 });
    }

    const hydratedArticles = await fetchExternalWechatArticleContents({
      articles,
    });

    return NextResponse.json({ articles: hydratedArticles });
  } catch (error) {
    if (error instanceof ExternalWechatSearchError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "missing_credentials"
              ? 503
              : error.code === "upstream_error"
                ? 502
                : 400,
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "unexpected_error",
          message: "Unexpected external wechat content fetch error",
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
