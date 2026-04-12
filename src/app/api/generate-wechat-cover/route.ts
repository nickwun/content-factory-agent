import { NextRequest, NextResponse } from "next/server";

import {
  OpenRouterImageGenerationError,
  generateImageWithOpenRouter,
} from "@/lib/generation/openrouter-image-generation-service";
import { buildWechatCoverImagePrompt } from "@/lib/generation/wechat-cover-image-prompt";
import {
  PublicImageStorageError,
  uploadPublicImage,
} from "@/lib/images/public-image-storage";
import type { WechatBlock } from "@/lib/types/history";

type GenerateWechatCoverRequestBody = {
  articleTitle?: unknown;
  articleBlocks?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateWechatCoverRequestBody;
    const articleTitle =
      typeof body.articleTitle === "string" ? body.articleTitle.trim() : "";
    const articleBlocks = normalizeWechatBlocks(body.articleBlocks);

    if (!articleTitle && articleBlocks.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_wechat_cover_request",
            message: "articleTitle or articleBlocks is required",
          },
        },
        { status: 400 },
      );
    }

    const imagePrompt = buildWechatCoverImagePrompt({
      articleTitle,
      articleBlocks,
    });
    const image = await generateImageWithOpenRouter({
      prompt: imagePrompt,
      aspectRatio: "4:3",
    });
    const uploadedImage = await uploadPublicImage({
      dataUrl: image.dataUrl,
      folder: "wechat-covers",
      fileNamePrefix: "wechat-cover",
    });

    return NextResponse.json({
      image: {
        imageUrl: uploadedImage.publicUrl,
        prompt: imagePrompt,
        model: image.imageModel,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof OpenRouterImageGenerationError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "missing_openrouter_image_config"
              ? 500
              : error.code === "generation_timeout"
                ? 504
                : 502,
        },
      );
    }

    if (error instanceof PublicImageStorageError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "missing_public_image_storage_config" ? 503 : 502,
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "generation_failed",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected wechat cover generation error",
        },
      },
      { status: 502 },
    );
  }
}

function normalizeWechatBlocks(rawBlocks: unknown): WechatBlock[] {
  if (!Array.isArray(rawBlocks)) {
    return [];
  }

  const normalizedBlocks: WechatBlock[] = [];

  for (const rawBlock of rawBlocks) {
    if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
      continue;
    }

    const candidate = rawBlock as Record<string, unknown>;
    const type = candidate.type;

    if (type === "divider") {
      normalizedBlocks.push({
        id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
        type: "divider",
      });
      continue;
    }

    if (type === "list") {
      const items = Array.isArray(candidate.items)
        ? candidate.items
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      if (items.length === 0) {
        continue;
      }

      normalizedBlocks.push({
        id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
        type: "list",
        items,
      });
      continue;
    }

    const text =
      typeof candidate.text === "string" ? candidate.text.trim() : "";

    if (!text) {
      continue;
    }

    if (type === "heading") {
      normalizedBlocks.push({
        id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
        type: "heading",
        level: candidate.level === 3 ? 3 : 2,
        text,
      });
      continue;
    }

    if (type === "quote") {
      normalizedBlocks.push({
        id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
        type: "quote",
        text,
      });
      continue;
    }

    if (type === "paragraph") {
      normalizedBlocks.push({
        id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
        type: "paragraph",
        text,
      });
    }
  }

  return normalizedBlocks;
}
