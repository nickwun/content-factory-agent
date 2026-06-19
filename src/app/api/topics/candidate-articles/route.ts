import { NextRequest, NextResponse } from "next/server.js";

import {
  CandidateArticleError,
  createManualCandidateArticle,
  listCandidateArticles,
} from "../../../../lib/topics/candidate-article-server.ts";

type CreateCandidateArticleBody = {
  sourceAccountId?: unknown;
  title?: unknown;
  contentMarkdown?: unknown;
  authorName?: unknown;
  publishedAt?: unknown;
  url?: unknown;
};

export async function GET() {
  return NextResponse.json({
    candidateArticles: listCandidateArticles(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCandidateArticleBody;

    if (
      !body.sourceAccountId ||
      typeof body.sourceAccountId !== "string" ||
      !body.sourceAccountId.trim()
    ) {
      return NextResponse.json({ error: "sourceAccountId is required" }, { status: 400 });
    }

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (
      !body.contentMarkdown ||
      typeof body.contentMarkdown !== "string" ||
      !body.contentMarkdown.trim()
    ) {
      return NextResponse.json({ error: "contentMarkdown is required" }, { status: 400 });
    }

    const candidateArticle = createManualCandidateArticle({
      sourceAccountId: body.sourceAccountId.trim(),
      title: body.title,
      contentMarkdown: body.contentMarkdown,
      ...(typeof body.authorName === "string" ? { authorName: body.authorName } : {}),
      ...(typeof body.publishedAt === "string" ? { publishedAt: body.publishedAt } : {}),
      ...(typeof body.url === "string" ? { url: body.url } : {}),
    });

    return NextResponse.json({ candidateArticle }, { status: 201 });
  } catch (error) {
    if (error instanceof CandidateArticleError) {
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
      { error: { code: "unexpected_error", message: "Unexpected candidate article error" } },
      { status: 500 },
    );
  }
}
