import { NextRequest, NextResponse } from "next/server";

import {
  OpenRouterImageGenerationError,
  generateValidatedXiaohongshuImage,
} from "@/lib/generation/openrouter-image-generation-service";
import {
  buildRetriedXiaohongshuImagePrompt,
  buildXiaohongshuImagePrompt,
} from "@/lib/generation/xiaohongshu-image-prompt";

type GenerateImageRequestBody = {
  platform?: unknown;
  noteTitle?: unknown;
  noteCaption?: unknown;
  noteTags?: unknown;
  suggestion?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateImageRequestBody;

    if (body.platform !== "xiaohongshu") {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_image_request",
            message: "xiaohongshu platform is required",
          },
        },
        { status: 400 },
      );
    }

    const suggestion = normalizeSuggestion(body.suggestion);

    if (!suggestion) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_image_request",
            message: "suggestion is required",
          },
        },
        { status: 400 },
      );
    }

    const imagePrompt = buildXiaohongshuImagePrompt({
      noteTitle: typeof body.noteTitle === "string" ? body.noteTitle : "",
      noteCaption: typeof body.noteCaption === "string" ? body.noteCaption : "",
      noteTags: Array.isArray(body.noteTags)
        ? body.noteTags.filter((tag): tag is string => typeof tag === "string")
        : [],
      suggestionTitle: suggestion.title,
      suggestionDescription: suggestion.description,
    });
    const retryPrompt = buildRetriedXiaohongshuImagePrompt(imagePrompt);

    const generatedAt = new Date().toISOString();
    const image = await generateValidatedXiaohongshuImage({
      basePrompt: imagePrompt,
      retryPrompt,
    });

    return NextResponse.json({
      image: {
        suggestionId: suggestion.id,
        imageUrl: image.imageUrl,
        imagePrompt: image.imagePrompt,
        imageModel: image.imageModel,
        generatedAt,
      },
    });
  } catch (error) {
    if (error instanceof OpenRouterImageGenerationError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            failureReason: error.failureReason,
          },
        },
        {
          status:
            error.code === "missing_openrouter_image_config"
              ? 500
              : error.code === "image_quality_failed"
                ? 422
              : error.code === "generation_timeout"
                ? 504
                : 502,
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "generation_failed",
          message:
            error instanceof Error ? error.message : "Unexpected image generation error",
        },
      },
      { status: 502 },
    );
  }
}

function normalizeSuggestion(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id.trim() : "";
  const index = typeof source.index === "number" ? source.index : 0;
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const description =
    typeof source.description === "string" ? source.description.trim() : "";

  if (!id || !title || !description || index <= 0) {
    return null;
  }

  return {
    id,
    index,
    title,
    description,
  };
}
