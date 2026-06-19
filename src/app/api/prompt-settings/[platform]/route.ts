import { NextRequest, NextResponse } from "next/server";

import { updatePromptSetting } from "@/lib/settings/prompt-settings-server";
import { isPlatformType } from "@/lib/types/platform";

type RouteContext = {
  params: Promise<{
    platform: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { platform } = await context.params;

  if (!isPlatformType(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  const body = (await request.json()) as { promptTemplate?: string };

  if (!body.promptTemplate?.trim()) {
    return NextResponse.json(
      { error: "promptTemplate is required" },
      { status: 400 },
    );
  }

  const setting = updatePromptSetting(platform, body.promptTemplate.trim());
  return NextResponse.json({ setting });
}
