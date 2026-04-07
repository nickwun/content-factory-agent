export class MissingOpenRouterConfigError extends Error {
  missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Missing OpenRouter config: ${missingKeys.join(", ")}`);
    this.name = "MissingOpenRouterConfigError";
    this.missingKeys = missingKeys;
  }
}

export type OpenRouterConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type OpenRouterImageConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  aspectRatio: string;
  reviewModel: string;
};

export function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();

  const missingKeys = [
    !apiKey ? "OPENROUTER_API_KEY" : null,
    !baseUrl ? "OPENROUTER_BASE_URL" : null,
    !model ? "OPENROUTER_MODEL" : null,
  ].filter(Boolean) as string[];

  if (missingKeys.length > 0) {
    throw new MissingOpenRouterConfigError(missingKeys);
  }

  return {
    apiKey: apiKey!,
    baseUrl: baseUrl!,
    model: model!,
  };
}

export function getOpenRouterImageConfig(): OpenRouterImageConfig {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim();
  const model =
    process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
    "google/gemini-3.1-flash-image-preview";
  const aspectRatio =
    process.env.OPENROUTER_IMAGE_ASPECT_RATIO?.trim() || "4:5";
  const reviewModel =
    process.env.OPENROUTER_IMAGE_REVIEW_MODEL?.trim() || "openai/gpt-4.1-mini";

  const missingKeys = [
    !apiKey ? "OPENROUTER_API_KEY" : null,
    !baseUrl ? "OPENROUTER_BASE_URL" : null,
  ].filter(Boolean) as string[];

  if (missingKeys.length > 0) {
    throw new MissingOpenRouterConfigError(missingKeys);
  }

  return {
    apiKey: apiKey!,
    baseUrl: baseUrl!,
    model: model!,
    aspectRatio,
    reviewModel,
  };
}
