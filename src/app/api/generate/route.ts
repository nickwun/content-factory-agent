import { NextRequest, NextResponse } from "next/server";

import { buildGenerationContext } from "@/lib/generation/generation-context";
import { generateDraft } from "@/lib/generation/generation-service";
import {
  OpenRouterGenerationError,
  generateVideoScriptWithOpenRouter,
  generateXiaohongshuDraftWithOpenRouter,
  generateTwitterDraftWithOpenRouter,
  generateWechatArticleWithOpenRouter,
  getValidatedOpenRouterConfig,
} from "@/lib/generation/openrouter-generation-service";
import { listPromptSettings } from "@/lib/settings/prompt-settings-server";
import { isPlatformType, type PlatformType } from "@/lib/types/platform";

type GenerateRequestBody = {
  userPrompt?: unknown;
  selectedPlatforms?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const userPrompt =
      typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";
    const selectedPlatforms = Array.isArray(body.selectedPlatforms)
      ? body.selectedPlatforms.filter(
          (platform): platform is PlatformType =>
            typeof platform === "string" && isPlatformType(platform),
        )
      : [];

    if (!userPrompt || selectedPlatforms.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_request",
            message: "userPrompt and selectedPlatforms are required",
          },
        },
        { status: 400 },
      );
    }

    const promptSettings = listPromptSettings(selectedPlatforms);
    const context = buildGenerationContext({
      userPrompt,
      selectedPlatforms,
      promptSettings,
      now: new Date().toISOString(),
      generatorVersion: "phase2-openrouter-v1",
    });

    const openRouterConfig = selectedPlatforms.some((platform) =>
      ["wechat_article", "twitter", "xiaohongshu", "video_script"].includes(platform),
    )
      ? getValidatedOpenRouterConfig()
      : null;

    const draft = await generateDraft(context, {
      modelProvider: "openrouter",
      modelName: openRouterConfig?.model ?? "not-used",
      generateWechatArticle: generateWechatArticleWithOpenRouter,
      generateTwitterDraft: generateTwitterDraftWithOpenRouter,
      generateXiaohongshuDraft: generateXiaohongshuDraftWithOpenRouter,
      generateVideoScript: generateVideoScriptWithOpenRouter,
    });

    return NextResponse.json({
      draft,
      promptSettings,
    });
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status:
            error.code === "missing_openrouter_config"
              ? 500
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
            error instanceof Error ? error.message : "Unexpected generation error",
        },
      },
      { status: 502 },
    );
  }
}
