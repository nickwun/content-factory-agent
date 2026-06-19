import { NextResponse } from "next/server.js";

import {
  duplicatePromptPreset,
  PromptPresetError,
} from "../../../../../lib/settings/prompt-settings-server.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const preset = duplicatePromptPreset(id);
    return NextResponse.json({ preset }, { status: 201 });
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

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected preset error" } },
      { status: 500 },
    );
  }
}
