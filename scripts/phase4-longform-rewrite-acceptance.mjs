import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const XHS_PLATFORM = "小红书笔记";

const SHORT_SOURCE_TEXT = [
  "写作并不是为了立刻产出多厉害的作品，而是为了让思考慢慢变得有结构。",
  "如果一个人愿意每天写一点点，他会更快发现自己真正关心的问题。",
].join("\n\n");

const LONG_SOURCE_TEXT = [
  "很多人把写作理解成创作天赋的外显，但真正稳定发生作用的，往往不是作品本身，而是写作过程中持续组织信息、回看经验、筛选表达的动作。",
  "",
  "当一个人进入中年以后，他常常会感觉自己知道很多道理，却越来越难把它们真正说清楚、想明白、执行下去。这并不一定是能力突然退化，而更像是大脑长期缺少主动整理材料的训练。",
  "",
  "一、写作为什么会延缓衰老",
  "",
  "第一，写作会迫使人不断回忆、筛选和重组信息。日常生活里，很多经验只是匆匆经过，但一旦开始写，你就必须决定什么重要、什么不重要、什么应该先说、什么应该后说。",
  "",
  "第二，写作会让语言、判断、记忆和情绪调节同步运转。一个人要把一件事说明白，就不能只靠直觉，他必须把模糊感受翻译成清楚表达，这本身就是一种高强度但温和的认知训练。",
  "",
  "第三，写作能够帮助人建立持续的观察力。很多人在工作和生活里不断接收信息，却很少停下来把信息真正变成自己的理解，所以越忙越空，越看越乱。",
  "",
  "接下来要讨论的是，为什么稳定写作比偶尔写一篇更重要。",
  "",
  "二、稳定输出如何改变日常节奏",
  "",
  "当一个人每天都写一点，他会更容易发现自己在想什么、忽略了什么、真正关心什么。写作会像一个缓慢但准确的镜子，把那些原本在脑子里一闪而过的念头留下来，让人重新看到自己的思路走向。",
  "",
  "很多人总以为写作必须一次写得很好，所以迟迟不开始。其实稳定输出比偶尔输出更重要，因为频率决定了整理能力会不会留在日常生活里，而不是只在某个特殊时刻短暂出现。",
  "",
  "比如每天记录三百字，也足够形成持续感。它未必要变成公开文章，更重要的是让大脑反复经历提取、排列、判断、收束的过程。日积月累之后，人会发现自己说话更清楚、判断更稳、记忆也更有抓手。",
  "",
  "三、为什么写作不是额外负担，而是认知训练",
  "",
  "很多人把写作当成任务，所以一想到写作就联想到压力、表达焦虑和输出考核。但如果换个角度，它更像是一种给大脑做长期训练的方法：不追求一次完成多大成果，而是通过重复的小输出，让大脑维持活跃、敏感和有秩序的状态。",
  "",
  "写作真正珍贵的地方，不是它让人显得会表达，而是它会让人持续思考、持续筛选、持续更新自己。一个持续写作的人，往往不是记住了更多材料，而是更擅长从复杂经验里找出重点，再重新组织成可以行动的理解。",
  "",
  "最后，不要把写作理解成创作压力，更像是给大脑做长期训练。你不需要一下子写出伟大的作品，只需要让自己保持稳定输出，让大脑始终处在可整理、可反思、可表达的工作状态里。",
  "",
  "补充说明：这种训练并不要求统一格式，也不要求必须写成长文。日记、卡片、随笔、工作复盘都可以成为材料。关键不是形式，而是那个持续回看、辨认、重组的过程。".repeat(
    60,
  ),
].join("\n");

const PLAIN_PROMPT = "生成一篇关于如何提高工作效率的小红书图文笔记，语气清晰自然。";
const SHORT_REWRITE_PROMPT = "请把原文仿写成更适合小红书图文发布的内容，语气更生活化。";
const LONG_WECHAT_PROMPT =
  "仿写一篇关于写作延缓衰老的公众号文章，保持完整论证和清晰结构。";
const LONG_XHS_PROMPT =
  "请把这篇长文仿写成一篇完整的小红书图文笔记，语气自然，适合普通读者阅读。";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  const report = {
    plainGeneration: {
      succeeded: false,
      enteredWorkspace: false,
      autosaveWorked: false,
      reloadRestoreWorked: false,
      rewriteMode: null,
    },
    shortRewrite: {
      succeeded: false,
      rewriteMode: null,
      hasRewriteSource: null,
      usedLongformRewrite: null,
    },
    longRewriteWechat: {
      succeeded: false,
      error: null,
      rewriteMode: null,
      usedLongformRewrite: null,
      rewriteChunkCount: null,
      rewriteBriefVersion: null,
      title: null,
      blockCount: null,
      totalTextLength: null,
      looksLikeFullArticle: false,
      preservesCorePoints: false,
    },
    longRewriteXiaohongshu: {
      succeeded: false,
      error: null,
      rewriteMode: null,
      usedLongformRewrite: null,
      rewriteChunkCount: null,
      rewriteBriefVersion: null,
      title: null,
      captionLength: null,
      imageSuggestionCount: null,
      looksLikeFullNote: false,
      preservesCorePoints: false,
    },
    promptVariation: {
      wechatChanged: false,
      xiaohongshuChanged: false,
      defaultWechatTitle: null,
      altWechatTitle: null,
      defaultXiaohongshuTitle: null,
      altXiaohongshuTitle: null,
    },
  };

  let originalWechatPrompt = null;
  let originalXiaohongshuPrompt = null;

  try {
    originalWechatPrompt = await getPromptTemplate("wechat_article");
    originalXiaohongshuPrompt = await getPromptTemplate("xiaohongshu");

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await resetHistoryAndReload(page);

    await withRetry("普通生成", () => runPlainGeneration(page, report));
    await withRetry("短文仿写", () => runShortRewriteGeneration(page, report));

    let defaultWechat = null;
    try {
      defaultWechat = await withRetry("公众号长文仿写", () =>
        requestGenerateDraft({
          userPrompt: LONG_WECHAT_PROMPT,
          selectedPlatforms: ["wechat_article"],
          rewriteSource: {
            kind: "pasted_text",
            extractedText: LONG_SOURCE_TEXT,
            charCount: LONG_SOURCE_TEXT.length,
            truncated: false,
          },
        }),
      );
      fillWechatLongformReport(defaultWechat, report.longRewriteWechat);
    } catch (error) {
      report.longRewriteWechat.error =
        error instanceof Error ? error.message : String(error);
    }

    let defaultXhs = null;
    try {
      defaultXhs = await withRetry("小红书长文仿写", () =>
        requestGenerateDraft({
          userPrompt: LONG_XHS_PROMPT,
          selectedPlatforms: ["xiaohongshu"],
          rewriteSource: {
            kind: "pasted_text",
            extractedText: LONG_SOURCE_TEXT,
            charCount: LONG_SOURCE_TEXT.length,
            truncated: false,
          },
        }),
      );
      fillXiaohongshuLongformReport(defaultXhs, report.longRewriteXiaohongshu);
    } catch (error) {
      report.longRewriteXiaohongshu.error =
        error instanceof Error ? error.message : String(error);
    }

    if (defaultWechat) {
      await updatePromptTemplate(
        "wechat_article",
        "你是一名擅长中文公众号创作的资深内容策划，请输出更有故事开场、更强调情绪带入、句子更有节奏感的深度文章。",
      );
      const altWechat = await withRetry("公众号提示词差异验证", () =>
        requestGenerateDraft({
          userPrompt: LONG_WECHAT_PROMPT,
          selectedPlatforms: ["wechat_article"],
          rewriteSource: {
            kind: "pasted_text",
            extractedText: LONG_SOURCE_TEXT,
            charCount: LONG_SOURCE_TEXT.length,
            truncated: false,
          },
        }),
      );

      report.promptVariation.defaultWechatTitle =
        defaultWechat.draft.content.wechat_article?.title ?? null;
      report.promptVariation.altWechatTitle =
        altWechat.draft.content.wechat_article?.title ?? null;
      report.promptVariation.wechatChanged =
        report.promptVariation.defaultWechatTitle !== report.promptVariation.altWechatTitle;

      await updatePromptTemplate("wechat_article", originalWechatPrompt);
      originalWechatPrompt = null;
    }

    if (defaultXhs) {
      await updatePromptTemplate(
        "xiaohongshu",
        "你是一名擅长中文小红书图文创作的资深作者，请输出更有第一人称经验感、开头更有钩子、句子更短更轻快的内容草稿。",
      );
      const altXhs = await withRetry("小红书提示词差异验证", () =>
        requestGenerateDraft({
          userPrompt: LONG_XHS_PROMPT,
          selectedPlatforms: ["xiaohongshu"],
          rewriteSource: {
            kind: "pasted_text",
            extractedText: LONG_SOURCE_TEXT,
            charCount: LONG_SOURCE_TEXT.length,
            truncated: false,
          },
        }),
      );

      report.promptVariation.defaultXiaohongshuTitle =
        defaultXhs.draft.content.xiaohongshu?.title ?? null;
      report.promptVariation.altXiaohongshuTitle =
        altXhs.draft.content.xiaohongshu?.title ?? null;
      report.promptVariation.xiaohongshuChanged =
        report.promptVariation.defaultXiaohongshuTitle !==
        report.promptVariation.altXiaohongshuTitle;

      await updatePromptTemplate("xiaohongshu", originalXiaohongshuPrompt);
      originalXiaohongshuPrompt = null;
    }
  } finally {
    if (originalWechatPrompt !== null) {
      await updatePromptTemplate("wechat_article", originalWechatPrompt).catch(() => {});
    }
    if (originalXiaohongshuPrompt !== null) {
      await updatePromptTemplate("xiaohongshu", originalXiaohongshuPrompt).catch(() => {});
    }
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

async function runPlainGeneration(page, report) {
  await startNewDraft(page);
  await fillMainPrompt(page, PLAIN_PROMPT);
  await togglePlatform(page, XHS_PLATFORM);
  await clickGenerate(page);
  await ensureWorkspace(page, "普通生成");

  const records = await readHistoryRecords(page);
  const first = records[0];
  const editorSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "正文文案区" }) })
    .first();
  const captionTextarea = editorSection.locator("textarea").first();
  await captionTextarea.waitFor({ timeout: 10000 });
  const originalValue = await captionTextarea.inputValue();
  await captionTextarea.fill(`${originalValue} 联调普通生成已保存。`);
  await page.waitForTimeout(1600);

  report.plainGeneration.succeeded = Boolean(first?.content?.xiaohongshu);
  report.plainGeneration.enteredWorkspace = true;
  report.plainGeneration.rewriteMode = first?.generation?.rewriteMode ?? null;
  report.plainGeneration.autosaveWorked = await page.evaluate(
    ({ storageKey }) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      const firstRecord = JSON.parse(raw)[0];
      return firstRecord?.content?.xiaohongshu?.caption?.includes("联调普通生成已保存。");
    },
    { storageKey: HISTORY_STORAGE_KEY },
  );

  await page.reload({ waitUntil: "networkidle" });
  const reloadedSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "正文文案区" }) })
    .first();
  const reloadedTextarea = reloadedSection.locator("textarea").first();
  await reloadedTextarea.waitFor({ timeout: 10000 });
  const reloadedValue = await reloadedTextarea.inputValue();
  report.plainGeneration.reloadRestoreWorked =
    reloadedValue.includes("联调普通生成已保存。");
}

async function runShortRewriteGeneration(page, report) {
  await resetHistoryAndReload(page);
  await fillMainPrompt(page, SHORT_REWRITE_PROMPT);
  await loadRewriteSourceFromPaste(page, SHORT_SOURCE_TEXT);
  await togglePlatform(page, XHS_PLATFORM);
  await clickGenerate(page);
  await ensureWorkspace(page, "短文仿写");

  const records = await readHistoryRecords(page);
  const first = records[0];
  report.shortRewrite.succeeded = Boolean(first?.content?.xiaohongshu);
  report.shortRewrite.rewriteMode = first?.generation?.rewriteMode ?? null;
  report.shortRewrite.hasRewriteSource = first?.generation?.hasRewriteSource ?? null;
  report.shortRewrite.usedLongformRewrite =
    first?.generation?.usedLongformRewrite ?? null;
}

function fillWechatLongformReport(payload, target) {
  const article = payload.draft.content.wechat_article;
  const generationInfo = payload.draft.generationInfo;
  const combinedText = [
    article?.title ?? "",
    ...(article?.blocks ?? []).flatMap((block) =>
      block.type === "list" ? block.items : "text" in block ? [block.text] : [],
    ),
  ].join("\n");

  target.succeeded = Boolean(article);
  target.rewriteMode = generationInfo?.rewriteMode ?? null;
  target.usedLongformRewrite = generationInfo?.usedLongformRewrite ?? null;
  target.rewriteChunkCount = generationInfo?.rewriteChunkCount ?? null;
  target.rewriteBriefVersion = generationInfo?.rewriteBriefVersion ?? null;
  target.title = article?.title ?? null;
  target.blockCount = article?.blocks?.length ?? null;
  target.totalTextLength = combinedText.length;
  target.looksLikeFullArticle =
    (article?.blocks?.length ?? 0) >= 5 && combinedText.length > 700;
  target.preservesCorePoints =
    combinedText.includes("稳定输出比偶尔输出更重要") &&
    (combinedText.includes("长期训练") || combinedText.includes("认知训练"));
}

function fillXiaohongshuLongformReport(payload, target) {
  const note = payload.draft.content.xiaohongshu;
  const generationInfo = payload.draft.generationInfo;
  const combinedText = `${note?.title ?? ""}\n${note?.caption ?? ""}`;

  target.succeeded = Boolean(note);
  target.rewriteMode = generationInfo?.rewriteMode ?? null;
  target.usedLongformRewrite = generationInfo?.usedLongformRewrite ?? null;
  target.rewriteChunkCount = generationInfo?.rewriteChunkCount ?? null;
  target.rewriteBriefVersion = generationInfo?.rewriteBriefVersion ?? null;
  target.title = note?.title ?? null;
  target.captionLength = note?.caption?.length ?? null;
  target.imageSuggestionCount = note?.imageSuggestions?.length ?? null;
  target.looksLikeFullNote =
    (note?.caption?.length ?? 0) > 180 && (note?.imageSuggestions?.length ?? 0) >= 3;
  target.preservesCorePoints =
    combinedText.includes("稳定输出") &&
    (combinedText.includes("长期训练") || combinedText.includes("认知训练"));
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

async function startNewDraft(page) {
  const newDraftButton = page.getByRole("button", { name: "新建内容" });
  if (await newDraftButton.isVisible().catch(() => false)) {
    await newDraftButton.click();
  }
  await page
    .getByPlaceholder(
      "例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬，同时生成公众号长文、小红书笔记和 Twitter thread。",
    )
    .waitFor({ timeout: 10000 });
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
}

async function fillMainPrompt(page, prompt) {
  const promptTextarea = page.getByPlaceholder(
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

async function ensureWorkspace(page, label) {
  const outcome = await Promise.race([
    page
      .getByRole("button", { name: "编辑" })
      .first()
      .waitFor({ timeout: 180000 })
      .then(() => ({ kind: "workspace" })),
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
