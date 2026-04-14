import { NextRequest, NextResponse } from "next/server.js";

import {
  completeRewriteTask,
  failRewriteTask,
  RewriteTaskError,
} from "../../../../../lib/topics/rewrite-task-server.ts";

type UpdateRewriteTaskBody = {
  status?: unknown;
  generatedRecordId?: unknown;
  error?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateRewriteTaskBody;

    if (body.status === "succeeded") {
      if (
        !body.generatedRecordId ||
        typeof body.generatedRecordId !== "string" ||
        !body.generatedRecordId.trim()
      ) {
        return NextResponse.json(
          { error: "generatedRecordId is required" },
          { status: 400 },
        );
      }

      const rewriteTask = completeRewriteTask({
        taskId: id,
        generatedRecordId: body.generatedRecordId.trim(),
      });

      return NextResponse.json({ rewriteTask });
    }

    if (body.status === "failed") {
      const rewriteTask = failRewriteTask({
        taskId: id,
        errorMessage:
          typeof body.error === "string" && body.error.trim()
            ? body.error.trim()
            : "多篇仿写失败。",
      });

      return NextResponse.json({ rewriteTask });
    }

    return NextResponse.json({ error: "unsupported status" }, { status: 400 });
  } catch (error) {
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
