import { NextRequest, NextResponse } from "next/server.js";

import {
  CandidateArticleError,
  ingestCandidateArticleFiles,
} from "../../../../../lib/topics/candidate-article-server.ts";
import { RewriteSourceParseError } from "../../../../../lib/rewrite/rewrite-source.ts";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sourceAccountId = formData.get("sourceAccountId");
    const files = formData.getAll("file");

    if (typeof sourceAccountId !== "string" || !sourceAccountId.trim()) {
      return NextResponse.json({ error: "sourceAccountId is required" }, { status: 400 });
    }

    const validFiles = files.filter((file): file is File => file instanceof File);

    if (validFiles.length === 0) {
      return NextResponse.json({ error: "at least one file is required" }, { status: 400 });
    }

    const result = await ingestCandidateArticleFiles({
      sourceAccountId: sourceAccountId.trim(),
      files: validFiles,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CandidateArticleError || error instanceof RewriteSourceParseError) {
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
