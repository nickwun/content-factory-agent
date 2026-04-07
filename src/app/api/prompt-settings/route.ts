import { NextRequest, NextResponse } from "next/server";

import { listPromptSettings } from "@/lib/settings/prompt-settings-server";
import { isPlatformType } from "@/lib/types/platform";

export async function GET(request: NextRequest) {
  const platformsParam = request.nextUrl.searchParams.get("platforms");
  const platforms = platformsParam
    ? platformsParam.split(",").filter(isPlatformType)
    : undefined;

  const settings = listPromptSettings(platforms);

  return NextResponse.json({ settings });
}
