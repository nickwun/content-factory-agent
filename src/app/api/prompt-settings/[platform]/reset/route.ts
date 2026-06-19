import { NextResponse } from "next/server";

import { resetPromptSetting } from "@/lib/settings/prompt-settings-server";
import { isPlatformType } from "@/lib/types/platform";

type RouteContext = {
  params: Promise<{
    platform: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { platform } = await context.params;

  if (!isPlatformType(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  const setting = resetPromptSetting(platform);
  return NextResponse.json({ setting });
}
