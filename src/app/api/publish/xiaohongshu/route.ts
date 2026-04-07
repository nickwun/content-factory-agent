import { NextResponse } from "next/server.js";

import { handleXiaohongshuPublishRequest } from "@/lib/publish/publish-route-handlers";

export async function publishXiaohongshuNote(request: Request) {
  const payload = await request.json().catch(() => undefined);
  const response = await handleXiaohongshuPublishRequest(
    payload,
    new URL(request.url).origin,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export const POST = publishXiaohongshuNote;
