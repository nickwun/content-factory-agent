import { NextRequest, NextResponse } from "next/server";

import {
  deletePromptPreset,
  PromptPresetError,
  updatePromptPreset,
} from "@/lib/settings/prompt-settings-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdatePromptPresetBody = {
  name?: unknown;
  promptTemplate?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = (await request.json()) as UpdatePromptPresetBody;
    const nextName =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
    const nextPromptTemplate =
      typeof body.promptTemplate === "string" && body.promptTemplate.trim()
        ? body.promptTemplate.trim()
        : undefined;

    if (!nextName && !nextPromptTemplate) {
      return NextResponse.json(
        { error: "name or promptTemplate is required" },
        { status: 400 },
      );
    }

    const preset = updatePromptPreset(id, {
      ...(nextName ? { name: nextName } : {}),
      ...(nextPromptTemplate ? { promptTemplate: nextPromptTemplate } : {}),
    });

    return NextResponse.json({ preset });
  } catch (error) {
    if (error instanceof PromptPresetError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.code === "preset_not_found" ? 404 : 400,
        },
      );
    }

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected preset error" } },
      { status: 500 },
    );
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    deletePromptPreset(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PromptPresetError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "preset_not_found"
              ? 404
              : error.code === "last_preset_for_platform"
                ? 409
                : 400,
        },
      );
    }

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected preset error" } },
      { status: 500 },
    );
  }
}
