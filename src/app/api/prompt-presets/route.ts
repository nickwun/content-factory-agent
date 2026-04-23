import { NextRequest, NextResponse } from "next/server.js";

import {
  createPromptPreset,
  listPromptPresetGroups,
  PromptPresetError,
} from "../../../lib/settings/prompt-settings-server.ts";
import { isContentProcessingMode } from "../../../lib/settings/prompt-settings-types.ts";
import { isPlatformType } from "../../../lib/types/platform.ts";

type CreatePromptPresetBody = {
  platform?: unknown;
  processingMode?: unknown;
  name?: unknown;
  promptTemplate?: unknown;
};

export async function GET(request: NextRequest) {
  const platformsParam = request.nextUrl.searchParams.get("platforms");
  const platforms = platformsParam
    ? platformsParam.split(",").filter(isPlatformType)
    : undefined;

  return NextResponse.json({
    presetGroups: listPromptPresetGroups(platforms),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePromptPresetBody;

    if (
      !body.platform ||
      typeof body.platform !== "string" ||
      !isPlatformType(body.platform)
    ) {
      return NextResponse.json({ error: "invalid platform" }, { status: 400 });
    }

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (
      !body.promptTemplate ||
      typeof body.promptTemplate !== "string" ||
      !body.promptTemplate.trim()
    ) {
      return NextResponse.json(
        { error: "promptTemplate is required" },
        { status: 400 },
      );
    }

    if (
      body.processingMode !== undefined &&
      !isContentProcessingMode(body.processingMode)
    ) {
      return NextResponse.json(
        { error: "processingMode is invalid" },
        { status: 400 },
      );
    }

    const preset = createPromptPreset({
      platform: body.platform,
      ...(isContentProcessingMode(body.processingMode)
        ? { processingMode: body.processingMode }
        : {}),
      name: body.name.trim(),
      promptTemplate: body.promptTemplate.trim(),
    });

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
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: { code: "unexpected_error", message: "Unexpected preset error" } },
      { status: 500 },
    );
  }
}
