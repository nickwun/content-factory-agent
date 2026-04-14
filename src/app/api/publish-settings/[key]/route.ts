import { NextRequest, NextResponse } from "next/server.js";

import { updatePublishSetting } from "@/lib/settings/publish-settings-server";
import type { PublishCredentialKey } from "@/lib/settings/publish-settings-types";

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

const PUBLISH_KEYS: PublishCredentialKey[] = [
  "wechat_publish_api_key",
  "wechat_publish_base_url",
  "xiaohongshu_publish_api_key",
  "xiaohongshu_publish_base_url",
  "feishu_app_id",
  "feishu_app_secret",
];

export async function PUT(request: NextRequest, context: RouteContext) {
  const { key } = await context.params;

  if (!PUBLISH_KEYS.includes(key as PublishCredentialKey)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }

  const body = (await request.json()) as { value?: string };

  if (typeof body.value !== "string") {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const setting = updatePublishSetting(key as PublishCredentialKey, body.value);
  return NextResponse.json({ setting });
}
