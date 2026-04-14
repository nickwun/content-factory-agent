import { NextRequest, NextResponse } from "next/server.js";

import {
  createSourceAccount,
  listSourceAccounts,
  SourceAccountError,
} from "../../../../lib/topics/source-account-server.ts";

type CreateSourceAccountBody = {
  name?: unknown;
  handle?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  notes?: unknown;
};

export async function GET() {
  return NextResponse.json({
    sourceAccounts: listSourceAccounts(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateSourceAccountBody;

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const sourceAccount = createSourceAccount({
      name: body.name.trim(),
      ...(typeof body.handle === "string" ? { handle: body.handle } : {}),
      ...(typeof body.category === "string" ? { category: body.category } : {}),
      ...(typeof body.priority === "number" ? { priority: body.priority } : {}),
      ...(body.status === "active" || body.status === "paused"
        ? { status: body.status }
        : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    });

    return NextResponse.json({ sourceAccount }, { status: 201 });
  } catch (error) {
    if (error instanceof SourceAccountError) {
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
      { error: { code: "unexpected_error", message: "Unexpected source account error" } },
      { status: 500 },
    );
  }
}
