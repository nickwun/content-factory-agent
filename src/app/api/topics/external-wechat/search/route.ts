import { NextRequest, NextResponse } from "next/server.js";

import {
  ExternalWechatSearchError,
  searchExternalWechatArticles,
} from "../../../../../lib/topics/external-wechat-server.ts";

type SearchExternalWechatBody = {
  keyword?: unknown;
  timeWindow?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SearchExternalWechatBody;

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

    const articles = await searchExternalWechatArticles({
      keyword: body.keyword,
      timeWindow: body.timeWindow as "all" | "1d" | "7d" | "6m",
    });

    return NextResponse.json({ articles });
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
          message: "Unexpected external wechat search error",
        },
      },
      { status: 500 },
    );
  }
}
