import { NextRequest, NextResponse } from "next/server";

import { buildGenerationContext } from "@/lib/generation/generation-context";
import {
  GenerateRequestValidationError,
  parseGenerateRequestPayload,
  prepareRewriteGeneration,
} from "@/lib/generation/generate-route";
import { generateDraft } from "@/lib/generation/generation-service";
import {
  OpenRouterGenerationError,
  extractRewriteBriefWithOpenRouter,
  generateVideoScriptWithOpenRouter,
  generateXiaohongshuDraftWithOpenRouter,
  generateTwitterDraftWithOpenRouter,
  generateWechatArticleWithOpenRouter,
  getValidatedOpenRouterConfig,
} from "@/lib/generation/openrouter-generation-service";
import {
  listPromptSettings,
  PromptPresetError,
} from "@/lib/settings/prompt-settings-server";

type GenerateRequestBody = {
  userPrompt?: unknown;
  selectedPlatforms?: unknown;
  rewriteSource?: unknown;
  selectedPromptPresetByPlatform?: unknown;
  wechatFinalization?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const {
      userPrompt,
      selectedPlatforms,
      rewriteSource,
      selectedPromptPresetByPlatform,
      wechatFinalization,
    } =
      parseGenerateRequestPayload(body);
    const preparedRewrite = await prepareRewriteGeneration(rewriteSource, {
      extractRewriteBrief: extractRewriteBriefWithOpenRouter,
    });

    const promptSettings = listPromptSettings(
      selectedPlatforms,
      selectedPromptPresetByPlatform,
    );
    const context = buildGenerationContext({
      userPrompt,
      selectedPlatforms,
      promptSettings,
      rewriteSource: preparedRewrite.rewriteSource,
      rewriteMode: preparedRewrite.rewriteMode,
      rewriteBrief: preparedRewrite.rewriteBrief,
      rewriteChunkCount: preparedRewrite.rewriteChunkCount,
      wechatFinalization,
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
    if (error instanceof GenerateRequestValidationError) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_request",
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof PromptPresetError) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_generate_request",
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

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
