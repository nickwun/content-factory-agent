import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { chromium } from "playwright";

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
export const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER ?? "";
export const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD ?? "";
export const HISTORY_STORAGE_KEY = "content-agent-history";
export const PUBLISH_RESULT_STORAGE_KEY = "content-agent-publish-results";
export const EXECUTION_EVENT_STORAGE_KEY = "content-agent-observability-events";
export const DEFAULT_VIEWPORT = { width: 1440, height: 1100 };

export async function launchAcceptancePage(options = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: options.viewport ?? DEFAULT_VIEWPORT,
    ...(hasBasicAuth()
      ? {
          httpCredentials: {
            username: BASIC_AUTH_USER,
            password: BASIC_AUTH_PASSWORD,
          },
        }
      : {}),
  });
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
  };
}

export async function resetHistoryAndOpenComposer(page, options = {}) {
  await page.goto(options.baseUrl ?? BASE_URL, { waitUntil: "networkidle" });
  await clearLocalStorageKeys(page, [options.storageKey ?? HISTORY_STORAGE_KEY]);
  await page.reload({ waitUntil: "networkidle" });
  await waitForComposerReady(page);
}

export async function clearLocalStorageKeys(page, keys) {
  await page.evaluate((storageKeys) => {
    for (const key of storageKeys) {
      window.localStorage.removeItem(key);
    }
  }, keys);
}

export async function waitForComposerReady(page) {
  await page
    .getByRole("heading", {
      name: "放入素材，选择处理方式，再进入工作区继续编辑",
    })
    .waitFor({ timeout: 10000 });
}

export async function ensurePromptPreset(input) {
  const presetGroups = await listPromptPresetGroups(input.baseUrl);
  const currentGroup = presetGroups.find((group) => group.platform === input.platform);
  const existingPreset = currentGroup?.presets.find(
    (preset) =>
      preset.name === input.name && preset.processingMode === input.processingMode,
  );

  if (existingPreset) {
    return existingPreset;
  }

  const response = await fetchWithOptionalBasicAuth(
    `${input.baseUrl ?? BASE_URL}/api/prompt-presets`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      platform: input.platform,
      processingMode: input.processingMode,
      name: input.name,
      promptTemplate: input.promptTemplate,
    }),
    },
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to create preset ${input.name}: ${
        payload?.error?.message ?? payload?.error ?? "unknown error"
      }`,
    );
  }

  return payload.preset;
}

export async function listPromptPresetGroups(baseUrl = BASE_URL) {
  const response = await fetchWithOptionalBasicAuth(`${baseUrl}/api/prompt-presets`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Failed to list prompt presets");
  }

  return payload.presetGroups ?? [];
}

export async function installGenerateRouteMock(page, input) {
  const requestLog = [];

  await page.route("**/api/generate", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    requestLog.push(body);

    const mockResponse = input.respond(body);
    if (!mockResponse) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "invalid_generate_request",
            message: "Unexpected generate request in browser acceptance flow.",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: mockResponse.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(mockResponse.body),
    });
  });

  return requestLog;
}

export function buildGenerateSuccessPayload(input) {
  return {
    draft: {
      autoTitle: input.title,
      content: {
        wechat_article: {
          platform: "wechat_article",
          title: input.title,
          markdownBody: input.markdownBody,
          blocks: input.blocks,
        },
      },
      generatedPlatforms: ["wechat_article"],
      mockPlatforms: [],
      generationInfo: {
        generatorVersion: "phase5-browser-acceptance",
        modelProvider: "mock",
        modelName: "browser-flow-mock",
        rewriteMode: "short_source",
        usedLongformRewrite: false,
      },
    },
    promptSettings: [input.promptSetting],
  };
}

export async function selectProcessingMode(page, label) {
  await page
    .locator("button")
    .filter({ hasText: label })
    .first()
    .click();
}

export async function selectPlatform(page, label) {
  await page
    .locator("button")
    .filter({ hasText: label })
    .first()
    .click();
}

export async function loadRewriteSourceFromPaste(page, text) {
  await page.getByRole("button", { name: "直接粘贴文本", exact: true }).click();
  await page
    .getByPlaceholder("把原文粘贴到这里。系统会提取纯文本后参与仿写生成。")
    .fill(text);
  await page.getByRole("button", { name: "加载原文", exact: true }).click();
  await page.getByRole("button", { name: "替换", exact: true }).waitFor({
    timeout: 10000,
  });
}

export async function selectPromptPreset(page, platformLabel, presetName) {
  const selectorGroup = page
    .locator("label")
    .filter({ has: page.getByText(platformLabel, { exact: true }) })
    .filter({ has: page.locator("select") })
    .first();
  await selectorGroup.locator("select").selectOption({ label: presetName });
}

export async function readHistoryRecords(page, storageKey = HISTORY_STORAGE_KEY) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, storageKey);
}

export async function seedHistoryRecords(
  page,
  records,
  storageKey = HISTORY_STORAGE_KEY,
) {
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: storageKey,
      value: records,
    },
  );
}

export async function readPublishResults(
  page,
  storageKey = PUBLISH_RESULT_STORAGE_KEY,
) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, storageKey);
}

export async function openWorkspaceWithHistory(page, records, options = {}) {
  await page.goto(`${options.baseUrl ?? BASE_URL}/?view=workspace`, {
    waitUntil: "networkidle",
  });
  await clearLocalStorageKeys(page, [
    options.historyStorageKey ?? HISTORY_STORAGE_KEY,
    options.publishResultStorageKey ?? PUBLISH_RESULT_STORAGE_KEY,
    options.executionEventStorageKey ?? EXECUTION_EVENT_STORAGE_KEY,
  ]);
  await seedHistoryRecords(page, records, options.historyStorageKey);
  await page.reload({ waitUntil: "networkidle" });
  await expectWorkspaceReady(page);
}

export async function expectWorkspaceReady(page) {
  await page
    .getByRole("heading", { name: "内容来源与执行记录" })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "编辑", exact: true }).waitFor({
    timeout: 30000,
  });
}

export async function createFailureScreenshot(page, fileNamePrefix) {
  const screenshotDir = join(
    tmpdir(),
    "distributing-web-browser-acceptance-screenshots",
  );
  await mkdir(screenshotDir, { recursive: true });
  const filePath = join(
    screenshotDir,
    `${sanitizeSegment(fileNamePrefix)}-${Date.now()}.png`,
  );
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function hasBasicAuth() {
  return Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASSWORD);
}

function getBasicAuthHeader() {
  return `Basic ${Buffer.from(
    `${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}`,
  ).toString("base64")}`;
}

async function fetchWithOptionalBasicAuth(input, init = {}) {
  if (!hasBasicAuth()) {
    return fetch(input, init);
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", getBasicAuthHeader());

  return fetch(input, {
    ...init,
    headers,
  });
}

export function createFlowReport(flowName) {
  return {
    flowName,
    success: false,
    failureStep: null,
    screenshotPath: null,
  };
}

function sanitizeSegment(value) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}
