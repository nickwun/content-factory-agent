import { NextResponse } from "next/server.js";

import { handleWechatAccountsRequest } from "@/lib/publish/publish-route-handlers";

export async function getWechatPublishAccounts() {
  const response = await handleWechatAccountsRequest();
  return NextResponse.json(response.body, { status: response.status });
}

export const GET = getWechatPublishAccounts;
