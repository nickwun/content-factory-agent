import { NextRequest, NextResponse } from "next/server.js";

import {
  deleteSourceAccount,
  SourceAccountError,
  updateSourceAccount,
} from "../../../../../lib/topics/source-account-server.ts";
import type { SourceAccount } from "../../../../../lib/topics/types.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateSourceAccountBody = {
  name?: unknown;
  handle?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  notes?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as UpdateSourceAccountBody;
    const nextInput: Partial<
      Pick<SourceAccount, "name" | "handle" | "category" | "priority" | "status" | "notes">
    > = {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.handle === "string" ? { handle: body.handle } : {}),
      ...(typeof body.category === "string" ? { category: body.category } : {}),
      ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
      ...(body.status === "active" || body.status === "paused"
        ? { status: body.status }
        : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    };

    if (Object.keys(nextInput).length === 0) {
      return NextResponse.json(
        { error: "at least one field is required" },
        { status: 400 },
      );
    }

    const sourceAccount = updateSourceAccount(id, nextInput);
    return NextResponse.json({ sourceAccount });
  } catch (error) {
    if (error instanceof SourceAccountError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.code === "source_account_not_found" ? 404 : 400,
        },
      );
    }

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected source account error" } },
      { status: 500 },
    );
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    deleteSourceAccount(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SourceAccountError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.code === "source_account_not_found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected source account error" } },
      { status: 500 },
    );
  }
}
