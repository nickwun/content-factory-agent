import { NextResponse } from "next/server.js";

import { handleFeishuPublishRequest } from "@/lib/publish/publish-route-handlers";

export async function publishFeishuDocumentRoute(request: Request) {
  const payload = await request.json().catch(() => undefined);
  const response = await handleFeishuPublishRequest(
    payload,
    new URL(request.url).origin,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export const POST = publishFeishuDocumentRoute;
