import { NextResponse } from "next/server.js";

import { handleWechatPublishRequest } from "@/lib/publish/publish-route-handlers";

export async function publishWechatArticle(request: Request) {
  const payload = await request.json().catch(() => undefined);
  const response = await handleWechatPublishRequest(payload);
  return NextResponse.json(response.body, { status: response.status });
}

export const POST = publishWechatArticle;
