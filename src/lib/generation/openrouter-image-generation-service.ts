import {
  MissingOpenRouterConfigError,
  getOpenRouterImageConfig,
  type OpenRouterImageConfig,
} from "../env/openrouter.ts";
import {
  buildXiaohongshuImageReviewPrompt,
  parseXiaohongshuImageReviewResult,
  resolveXiaohongshuImageFailureReason,
  type XiaohongshuImageFailureReason,
} from "../images/generated-image-validation.ts";
import { getImageMetadataFromDataUrl } from "../images/image-metadata.ts";
import { saveGeneratedImageDataUrl } from "../images/generated-image-store.ts";
import {
  OpenRouterGenerationError,
  runOpenRouterRequest,
} from "./openrouter-generation-service.ts";

export class OpenRouterImageGenerationError extends Error {
  code:
    | "missing_openrouter_image_config"
    | "generation_failed"
    | "generation_timeout"
    | "image_quality_failed";
  failureReason?: XiaohongshuImageFailureReason;

  constructor(
    code:
      | "missing_openrouter_image_config"
      | "generation_failed"
      | "generation_timeout"
      | "image_quality_failed",
    message: string,
    failureReason?: XiaohongshuImageFailureReason,
  ) {
    super(message);
    this.name = "OpenRouterImageGenerationError";
    this.code = code;
    this.failureReason = failureReason;
  }
}

type GenerateImageInput = {
  prompt: string;
  aspectRatio?: string;
};

type GenerateImageResult = {
  dataUrl: string;
  imageUrl: string;
  imageModel: string;
};

const OPENROUTER_IMAGE_REQUEST_TIMEOUT_MS = 60_000;
const IMAGE_ONLY_MODELS = ["seedream", "flux-1-kontext", "recraft", "imagen"];
const OPENROUTER_IMAGE_REVIEW_TIMEOUT_MS = 30_000;

export async function generateImageWithOpenRouter(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const config = getValidatedOpenRouterImageConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterImageCompletion(
        config,
        input.prompt,
        input.aspectRatio ?? config.aspectRatio,
      ),
    );
    const dataUrl = completion.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!dataUrl) {
      throw new Error("No generated image returned");
    }

    const asset = await saveGeneratedImageDataUrl(dataUrl);

    return {
      dataUrl,
      imageUrl: `/api/generated-images/${asset.assetId}`,
      imageModel: config.model,
    };
  } catch (error) {
    if (error instanceof OpenRouterImageGenerationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Image generation failed";

    if (message.toLowerCase().includes("timed out")) {
      throw new OpenRouterImageGenerationError(
        "generation_timeout",
        "OpenRouter image request timed out",
      );
    }

    throw new OpenRouterImageGenerationError("generation_failed", message);
  }
}

export async function generateValidatedXiaohongshuImage(input: {
  basePrompt: string;
  retryPrompt: string;
}) {
  let lastFailureReason: XiaohongshuImageFailureReason = "failed_upstream_generation";

  for (const prompt of [input.basePrompt, input.retryPrompt]) {
    try {
      const image = await generateImageWithOpenRouter({ prompt });
      const validation = await validateGeneratedXiaohongshuImage(
        image.dataUrl,
        getValidatedOpenRouterImageConfig(),
      );

      if (!validation.failureReason) {
        return {
          imageUrl: image.imageUrl,
          imageModel: image.imageModel,
          imagePrompt: prompt,
          failureReason: null,
        };
      }

      lastFailureReason = validation.failureReason;
    } catch (error) {
      if (error instanceof OpenRouterImageGenerationError) {
        error.failureReason ??= "failed_upstream_generation";
      }
      throw error;
    }
  }

  throw new OpenRouterImageGenerationError(
    "image_quality_failed",
    "生成结果未通过图片质量检查，请重试。",
    lastFailureReason,
  );
}

export function getValidatedOpenRouterImageConfig() {
  try {
    return getOpenRouterImageConfig();
  } catch (error) {
    if (error instanceof MissingOpenRouterConfigError) {
      throw new OpenRouterImageGenerationError(
        "missing_openrouter_image_config",
        error.message,
      );
    }

    throw error;
  }
}

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: {
          url?: string;
        };
      }>;
    };
  }>;
};

async function requestOpenRouterImageCompletion(
  config: OpenRouterImageConfig,
  prompt: string,
  aspectRatio: string,
): Promise<OpenRouterImageResponse> {
  const initialModalities = resolveOpenRouterImageModalities(config.model);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OPENROUTER_IMAGE_REQUEST_TIMEOUT_MS,
  );

  try {
    try {
      return await postOpenRouterImageCompletion(
        config,
        prompt,
        initialModalities,
        aspectRatio,
        controller.signal,
      );
    } catch (error) {
      if (
        shouldRetryWithImageOnlyModalities(error, initialModalities)
      ) {
        return await postOpenRouterImageCompletion(
          config,
          prompt,
          ["image"],
          aspectRatio,
          controller.signal,
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function postOpenRouterImageCompletion(
  config: OpenRouterImageConfig,
  prompt: string,
  modalities: string[],
  aspectRatio: string,
  signal: AbortSignal,
) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities,
      image_config: {
        aspect_ratio: aspectRatio,
      },
    }),
    signal,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${extractOpenRouterImageErrorMessage(responseText)}`,
    );
  }

  return JSON.parse(responseText) as OpenRouterImageResponse;
}

export function resolveOpenRouterImageModalities(model: string) {
  const normalizedModel = model.toLowerCase();

  if (IMAGE_ONLY_MODELS.some((candidate) => normalizedModel.includes(candidate))) {
    return ["image"];
  }

  return ["image", "text"];
}

async function validateGeneratedXiaohongshuImage(
  dataUrl: string,
  config: OpenRouterImageConfig,
) {
  const metadata = getImageMetadataFromDataUrl(dataUrl);
  const review = await reviewGeneratedImage(dataUrl, config);

  return {
    metadata,
    review,
    failureReason: resolveXiaohongshuImageFailureReason({
      metadata,
      review,
    }),
  };
}

async function reviewGeneratedImage(
  dataUrl: string,
  config: OpenRouterImageConfig,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OPENROUTER_IMAGE_REVIEW_TIMEOUT_MS,
  );

  try {
    const responseText = await runOpenRouterRequest(() =>
      requestOpenRouterImageReview(config, dataUrl, controller.signal),
    );

    return parseXiaohongshuImageReviewResult(responseText);
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw new OpenRouterImageGenerationError(
        error.code === "missing_openrouter_config"
          ? "missing_openrouter_image_config"
          : error.code,
        error.message,
        "failed_upstream_generation",
      );
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OpenRouterImageGenerationError(
        "generation_timeout",
        "OpenRouter image review timed out",
        "failed_upstream_generation",
      );
    }

    throw new OpenRouterImageGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "Image review failed",
      "failed_upstream_generation",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestOpenRouterImageReview(
  config: OpenRouterImageConfig,
  dataUrl: string,
  signal: AbortSignal,
) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.reviewModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildXiaohongshuImageReviewPrompt(),
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
    }),
    signal,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${extractOpenRouterImageErrorMessage(responseText)}`,
    );
  }

  const json = JSON.parse(responseText) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return json.choices?.[0]?.message?.content ?? "";
}

export function shouldRetryWithImageOnlyModalities(
  error: unknown,
  currentModalities: string[],
) {
  if (!currentModalities.includes("text")) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(
    "No endpoints found that support the requested output modalities: image, text",
  );
}

function extractOpenRouterImageErrorMessage(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string };
    };

    return parsed.error?.message?.trim() || responseText;
  } catch {
    return responseText;
  }
}
