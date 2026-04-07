import assert from "node:assert/strict";
import test from "node:test";

import {
  MissingOpenRouterConfigError,
  getOpenRouterImageConfig,
  getOpenRouterConfig,
} from "../env/openrouter.ts";

test("getOpenRouterConfig throws a clear error when api key is missing", () => {
  const previousApiKey = process.env.OPENROUTER_API_KEY;
  const previousBaseUrl = process.env.OPENROUTER_BASE_URL;
  const previousModel = process.env.OPENROUTER_MODEL;

  delete process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.OPENROUTER_MODEL = "openai/gpt-4.1-mini";

  assert.throws(() => getOpenRouterConfig(), MissingOpenRouterConfigError);

  restoreEnv(previousApiKey, previousBaseUrl, previousModel);
});

test("getOpenRouterImageConfig defaults image and review models when image model is missing", () => {
  const previousApiKey = process.env.OPENROUTER_API_KEY;
  const previousBaseUrl = process.env.OPENROUTER_BASE_URL;
  const previousImageModel = process.env.OPENROUTER_IMAGE_MODEL;
  const previousAspectRatio = process.env.OPENROUTER_IMAGE_ASPECT_RATIO;

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  delete process.env.OPENROUTER_IMAGE_MODEL;
  delete process.env.OPENROUTER_IMAGE_ASPECT_RATIO;

  const config = getOpenRouterImageConfig();
  assert.equal(config.model, "google/gemini-3.1-flash-image-preview");
  assert.equal(config.reviewModel, "openai/gpt-4.1-mini");

  restoreImageEnv(
    previousApiKey,
    previousBaseUrl,
    previousImageModel,
    previousAspectRatio,
  );
});

test("getOpenRouterImageConfig defaults aspect ratio to 4:5", () => {
  const previousApiKey = process.env.OPENROUTER_API_KEY;
  const previousBaseUrl = process.env.OPENROUTER_BASE_URL;
  const previousImageModel = process.env.OPENROUTER_IMAGE_MODEL;
  const previousAspectRatio = process.env.OPENROUTER_IMAGE_ASPECT_RATIO;

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image";
  delete process.env.OPENROUTER_IMAGE_ASPECT_RATIO;

  assert.equal(getOpenRouterImageConfig().aspectRatio, "4:5");

  restoreImageEnv(
    previousApiKey,
    previousBaseUrl,
    previousImageModel,
    previousAspectRatio,
  );
});

function restoreEnv(
  apiKey: string | undefined,
  baseUrl: string | undefined,
  model: string | undefined,
) {
  if (apiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = apiKey;
  }

  if (baseUrl === undefined) {
    delete process.env.OPENROUTER_BASE_URL;
  } else {
    process.env.OPENROUTER_BASE_URL = baseUrl;
  }

  if (model === undefined) {
    delete process.env.OPENROUTER_MODEL;
  } else {
    process.env.OPENROUTER_MODEL = model;
  }
}

function restoreImageEnv(
  apiKey: string | undefined,
  baseUrl: string | undefined,
  imageModel: string | undefined,
  aspectRatio: string | undefined,
) {
  if (apiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = apiKey;
  }

  if (baseUrl === undefined) {
    delete process.env.OPENROUTER_BASE_URL;
  } else {
    process.env.OPENROUTER_BASE_URL = baseUrl;
  }

  if (imageModel === undefined) {
    delete process.env.OPENROUTER_IMAGE_MODEL;
  } else {
    process.env.OPENROUTER_IMAGE_MODEL = imageModel;
  }

  if (aspectRatio === undefined) {
    delete process.env.OPENROUTER_IMAGE_ASPECT_RATIO;
  } else {
    process.env.OPENROUTER_IMAGE_ASPECT_RATIO = aspectRatio;
  }
}
