import { NextResponse } from "next/server";

import { readGeneratedImageAsset } from "@/lib/images/generated-image-store";

type RouteContext = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const asset = await readGeneratedImageAsset(assetId);

    return new NextResponse(asset.bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
