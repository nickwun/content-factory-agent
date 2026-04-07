import { NextResponse } from "next/server.js";

import { listPublishSettings } from "@/lib/settings/publish-settings-server";

export async function GET() {
  const settings = listPublishSettings();
  return NextResponse.json({ settings });
}
