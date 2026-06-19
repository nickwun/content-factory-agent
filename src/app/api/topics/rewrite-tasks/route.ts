import { NextRequest, NextResponse } from "next/server.js";

import {
  listRewriteTasks,
  PromptPresetError,
  RewriteTaskError,
  startRewriteTaskFromCluster,
} from "../../../../lib/topics/rewrite-task-server.ts";

type CreateRewriteTaskBody = {
  clusterId?: unknown;
  promptPresetId?: unknown;
};

export async function GET() {
  return NextResponse.json({
    rewriteTasks: listRewriteTasks(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateRewriteTaskBody;

    if (!body.clusterId || typeof body.clusterId !== "string" || !body.clusterId.trim()) {
      return NextResponse.json({ error: "clusterId is required" }, { status: 400 });
    }

    if (
      body.promptPresetId !== undefined &&
      (typeof body.promptPresetId !== "string" || !body.promptPresetId.trim())
    ) {
      return NextResponse.json({ error: "promptPresetId is invalid" }, { status: 400 });
    }

    const result = startRewriteTaskFromCluster(
      body.clusterId.trim(),
      typeof body.promptPresetId === "string" ? body.promptPresetId.trim() : undefined,
    );

    return NextResponse.json(result, { status: 201 });
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

    if (error instanceof RewriteTaskError) {
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
      { error: { code: "unexpected_error", message: "Unexpected rewrite task error" } },
      { status: 500 },
    );
  }
}
