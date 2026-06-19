import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const SOURCE_TEXT = [
  "很多人总觉得效率低，是因为不够自律。",
  "但真正让人卡住的，往往不是意志力，而是任务切换太频繁、信息堆在一起没有层次。",
  "如果能先把当天最重要的一件事单独拎出来，再给它留出不被打断的时间块，执行感就会好很多。",
].join("\n\n");
const PLAIN_PROMPT = "生成一篇关于如何提高工作效率的小红书图文笔记，语气清晰自然。";
const XHS_REWRITE_PROMPT = "请把原文仿写成更适合小红书图文发布的内容，语气更生活化。";
const XHS_REWRITE_PROMPT_ALT = "请把原文仿写成更适合小红书图文发布的版本，标题更有钩子，正文更像经验分享。";
const AUTOSAVE_APPEND_TEXT = " 验收编辑已保存。";
const XHS_PLATFORM = "小红书笔记";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

const report = {
  plainGeneration: {
    succeeded: false,
      hasRewriteSource: null,
      rewriteSourceKind: null,
      platform: null,
  },
  rewriteWorkspace: {
    succeeded: false,
    generationMetaCaptured: false,
    hasRewriteSource: null,
    rewriteSourceKind: null,
    rewriteSourceName: null,
    rewriteSourceCharCount: null,
    rewriteSourceTruncated: null,
    autosaveWorked: false,
    reloadRestoreWorked: false,
    platform: null,
    title: null,
    contentPreview: null,
  },
    rewritePromptVariation: {
      changed: false,
      defaultTitle: null,
      altTitle: null,
      defaultCaption: null,
      altCaption: null,
    },
    rewriteXiaohongshu: {
      succeeded: false,
      hasRewriteSource: null,
      title: null,
      captionPreview: null,
    },
  };

  let originalWechatPrompt = null;
  let originalXiaohongshuPrompt = null;

  try {
    originalWechatPrompt = await getPromptTemplate("wechat_article");
    originalXiaohongshuPrompt = await getPromptTemplate("xiaohongshu");

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, HISTORY_STORAGE_KEY);
    await page.reload({ waitUntil: "networkidle" });

    await withRetry("普通小红书生成", () =>
      runPlainXiaohongshuGeneration(page, report),
    );
    await withRetry("小红书仿写工作区生成", () =>
      resetHistoryAndReload(page).then(() =>
        runRewriteXiaohongshuWorkspaceGeneration(page, XHS_REWRITE_PROMPT, report),
      ),
    );

    const defaultXiaohongshuSnapshot = await withRetry(
      "小红书仿写接口生成",
      () => runRewriteXiaohongshuGeneration(report, XHS_REWRITE_PROMPT),
    );

    await updatePromptTemplate(
      "xiaohongshu",
      "你是一名擅长中文小红书图文创作的作者，请输出更有开场钩子、更强个人经验感、句子更短更轻快的内容草稿。",
    );
    const altXiaohongshuSnapshot = await withRetry(
      "小红书提示词差异生成",
      () => runRewriteXiaohongshuGeneration(null, XHS_REWRITE_PROMPT_ALT),
    );

    report.rewritePromptVariation.defaultTitle = defaultXiaohongshuSnapshot.title;
    report.rewritePromptVariation.altTitle = altXiaohongshuSnapshot.title;
    report.rewritePromptVariation.defaultCaption =
      defaultXiaohongshuSnapshot.caption;
    report.rewritePromptVariation.altCaption = altXiaohongshuSnapshot.caption;
    report.rewritePromptVariation.changed =
      defaultXiaohongshuSnapshot.title !== altXiaohongshuSnapshot.title ||
      defaultXiaohongshuSnapshot.caption !== altXiaohongshuSnapshot.caption;

    if (originalXiaohongshuPrompt !== null) {
      await updatePromptTemplate("xiaohongshu", originalXiaohongshuPrompt);
      originalXiaohongshuPrompt = null;
    }
  } finally {
    if (originalWechatPrompt !== null) {
      await updatePromptTemplate("wechat_article", originalWechatPrompt).catch(() => {});
    }
    if (originalXiaohongshuPrompt !== null) {
      await updatePromptTemplate("xiaohongshu", originalXiaohongshuPrompt).catch(
        () => {},
      );
    }

    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

async function runPlainXiaohongshuGeneration(page, report) {
  await startNewDraft(page);
  await fillMainPrompt(page, PLAIN_PROMPT);
  await togglePlatform(page, XHS_PLATFORM);
  await clickGenerate(page);
  await waitForGeneratedRecord(page, "xiaohongshu", "普通小红书生成");

  const records = await readHistoryRecords(page);
  const firstRecord = records[0];
  report.plainGeneration.succeeded = Boolean(firstRecord?.content?.xiaohongshu);
  report.plainGeneration.hasRewriteSource =
    firstRecord?.generation?.hasRewriteSource ?? null;
  report.plainGeneration.rewriteSourceKind =
    firstRecord?.generation?.rewriteSourceKind ?? null;
  report.plainGeneration.platform = firstRecord?.content?.xiaohongshu?.platform ?? null;
}

async function runRewriteXiaohongshuWorkspaceGeneration(page, prompt, report = null) {
  await fillMainPrompt(page, prompt);
  await loadRewriteSourceFromPaste(page, SOURCE_TEXT);
  await togglePlatform(page, XHS_PLATFORM);
  await clickGenerate(page);
  await ensureWorkspace(page, "小红书仿写工作区生成");

  const editorSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "正文文案区" }) })
    .first();
  const titleInput = editorSection.locator("input").first();
  const captionTextarea = editorSection.locator("textarea").first();
  await titleInput.waitFor({ timeout: 10000 });
  const title = await titleInput.inputValue();
  const caption = await captionTextarea.inputValue();

  if (report) {
    const records = await readHistoryRecords(page);
    const firstRecord = records[0];

    report.rewriteWorkspace.succeeded = Boolean(firstRecord?.content?.xiaohongshu);
    report.rewriteWorkspace.generationMetaCaptured = Boolean(
      firstRecord?.generation?.hasRewriteSource &&
        firstRecord?.generation?.rewriteSourceKind &&
        typeof firstRecord?.generation?.rewriteSourceCharCount === "number",
    );
    report.rewriteWorkspace.hasRewriteSource =
      firstRecord?.generation?.hasRewriteSource ?? null;
    report.rewriteWorkspace.rewriteSourceKind =
      firstRecord?.generation?.rewriteSourceKind ?? null;
    report.rewriteWorkspace.rewriteSourceName =
      firstRecord?.generation?.rewriteSourceName ?? null;
    report.rewriteWorkspace.rewriteSourceCharCount =
      firstRecord?.generation?.rewriteSourceCharCount ?? null;
    report.rewriteWorkspace.rewriteSourceTruncated =
      firstRecord?.generation?.rewriteSourceTruncated ?? null;
    report.rewriteWorkspace.platform =
      firstRecord?.content?.xiaohongshu?.platform ?? null;
    report.rewriteWorkspace.title = title;
    report.rewriteWorkspace.contentPreview = caption.slice(0, 160);

    await captionTextarea.fill(`${caption}${AUTOSAVE_APPEND_TEXT}`);
    await page.waitForTimeout(1600);

    const persistedAfterEdit = await page.evaluate(
      ({ storageKey, appendedText }) => {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return false;
        }

        const records = JSON.parse(raw);
        const first = records[0];
        const text = first?.content?.xiaohongshu?.caption;
        return typeof text === "string" && text.endsWith(appendedText);
      },
      { storageKey: HISTORY_STORAGE_KEY, appendedText: AUTOSAVE_APPEND_TEXT },
    );

    report.rewriteWorkspace.autosaveWorked = persistedAfterEdit;

    await page.reload({ waitUntil: "networkidle" });
    const reloadedEditorSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "正文文案区" }) })
      .first();
    const reloadedTextarea = reloadedEditorSection.locator("textarea").first();
    await reloadedTextarea.waitFor({ timeout: 10000 });
    const reloadedValue = await reloadedTextarea.inputValue();
    report.rewriteWorkspace.reloadRestoreWorked =
      reloadedValue.endsWith(AUTOSAVE_APPEND_TEXT);
  }

  return { title, caption };
}

async function runRewriteXiaohongshuGeneration(report = null, prompt) {
  const payload = await requestGenerateDraft({
    userPrompt: prompt,
    selectedPlatforms: ["xiaohongshu"],
    rewriteSource: {
      kind: "pasted_text",
      extractedText: SOURCE_TEXT,
      charCount: SOURCE_TEXT.length,
      truncated: false,
    },
  });

  const firstRecord = {
    generation: {
      hasRewriteSource: true,
    },
    content: {
      xiaohongshu: payload.draft.content.xiaohongshu,
    },
  };
  const title = firstRecord?.content?.xiaohongshu?.title ?? null;
  const caption = firstRecord?.content?.xiaohongshu?.caption ?? null;
  if (report) {
    report.rewriteXiaohongshu.succeeded = Boolean(firstRecord?.content?.xiaohongshu);
    report.rewriteXiaohongshu.hasRewriteSource =
      firstRecord?.generation?.hasRewriteSource ?? null;
    report.rewriteXiaohongshu.title = title;
    report.rewriteXiaohongshu.captionPreview = caption?.slice(0, 120) ?? null;
  }

  return { title, caption: caption?.slice(0, 160) ?? null };
}

async function loadRewriteSourceFromPaste(page, text) {
  await page.getByRole("button", { name: "直接粘贴文本" }).click();
  const pasteTextarea = page.getByPlaceholder(
    "把原文粘贴到这里。系统会提取纯文本后参与仿写生成。",
  );
  await pasteTextarea.fill(text);
  await page.getByRole("button", { name: "加载原文" }).click();
  await page.getByRole("button", { name: "替换" }).waitFor({ timeout: 10000 });
}

async function fillMainPrompt(page, prompt) {
  const promptTextarea = page
    .getByPlaceholder(
      "例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬，同时生成公众号长文、小红书笔记和 Twitter thread。",
    );
  await promptTextarea.fill(prompt);
}

async function togglePlatform(page, platformLabel) {
  await page.getByRole("button", { name: new RegExp(platformLabel) }).first().click();
}

async function clickGenerate(page) {
  const generateButton = page.getByRole("button", { name: "生成内容" });
  await expectButtonEnabled(page, generateButton);
  await generateButton.click();
}

async function waitForWorkspace(page) {
  await page.getByRole("button", { name: "编辑" }).first().waitFor({
    timeout: 180000,
  });
}

async function ensureWorkspace(page, label) {
  const outcome = await Promise.race([
    waitForWorkspace(page).then(() => ({ kind: "workspace" })),
    page
      .locator("text=/无法生成|生成失败|请求超时|鉴权失败|环境变量/")
      .first()
      .waitFor({ timeout: 180000 })
      .then(async () => ({
        kind: "error",
        message: (await page
          .locator("text=/无法生成|生成失败|请求超时|鉴权失败|环境变量/")
          .first()
          .textContent())?.trim(),
      })),
  ]);

  if (outcome.kind === "error") {
    throw new Error(`${label} failed: ${outcome.message ?? "unknown error"}`);
  }
}

async function waitForGeneratedRecord(page, platform, label) {
  const timeoutAt = Date.now() + 180000;

  while (Date.now() < timeoutAt) {
    const records = await readHistoryRecords(page);
    const firstRecord = records[0];

    if (firstRecord?.content?.[platform]) {
      return firstRecord;
    }

    const errorMessage = await page
      .locator("text=/无法生成|生成失败|请求超时|鉴权失败|环境变量/")
      .first()
      .textContent()
      .catch(() => null);

    if (errorMessage) {
      throw new Error(`${label} failed: ${errorMessage.trim()}`);
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`${label} timed out waiting for generated record`);
}

async function startNewDraft(page) {
  const newDraftButton = page.getByRole("button", { name: "新建内容" });
  if (await newDraftButton.isVisible().catch(() => false)) {
    await newDraftButton.click();
    await page
      .getByPlaceholder(
        "例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬，同时生成公众号长文、小红书笔记和 Twitter thread。",
      )
      .waitFor({ timeout: 10000 });
  }
}

async function resetHistoryAndReload(page) {
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, HISTORY_STORAGE_KEY);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page
    .getByPlaceholder(
      "例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬，同时生成公众号长文、小红书笔记和 Twitter thread。",
    )
    .waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "直接粘贴文本" }).waitFor({
    timeout: 10000,
  });
}

async function readHistoryRecords(page) {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  }, HISTORY_STORAGE_KEY);
}

async function getPromptTemplate(platform) {
  const response = await fetch(
    `${BASE_URL}/api/prompt-settings?platforms=${encodeURIComponent(platform)}`,
  );
  const payload = await response.json();
  return payload.settings?.[0]?.promptTemplate ?? null;
}

async function updatePromptTemplate(platform, promptTemplate) {
  const response = await fetch(`${BASE_URL}/api/prompt-settings/${platform}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ promptTemplate }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update ${platform} prompt setting`);
  }
}

async function requestGenerateDraft(payload) {
  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "generate request failed");
  }

  return data;
}

async function withRetry(label, task, attempts = 2) {
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (index === attempts - 1) {
        break;
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function expectButtonEnabled(page, locator) {
  const timeoutAt = Date.now() + 10000;

  while (Date.now() < timeoutAt) {
    if (await locator.isEnabled()) {
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error("Generate button did not become enabled");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
