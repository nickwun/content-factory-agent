import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const PROMPT =
  "写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬。";
const APPEND_TEXT = " 验收修改。";
const PLACEHOLDER_TEXT = "这是一篇新生成的公众号草稿，请继续完善具体内容。";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1100,
    },
  });
  const page = await context.newPage();

  const report = {
    pageLoaded: false,
    generatedIntoWorkspace: false,
    historyCreated: false,
    generationMetaCaptured: false,
    articleLooksReal: false,
    autosaveWorked: false,
    reloadRestoreWorked: false,
    activeModelName: null,
    activeModelProvider: null,
    recordCount: 0,
    recordTitle: null,
    firstBlockPreview: null,
    saveStateAfterEdit: null,
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    report.pageLoaded = await page
      .getByRole("heading", { name: "一次输入，生成四种平台内容草稿" })
      .isVisible();

    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, HISTORY_STORAGE_KEY);
    await page.reload({ waitUntil: "networkidle" });

    const promptTextarea = page.locator("textarea").first();
    await promptTextarea.evaluate((element, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;

      setter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, PROMPT);
    await page.locator("button").filter({ hasText: "公众号文章" }).first().click();

    const generateButton = page.getByRole("button", { name: "生成内容" });
    await generateButton.waitFor({ timeout: 10000 });
    await expectButtonEnabled(page, generateButton);
    await generateButton.click();

    await page.waitForURL("**/", { timeout: 180000 });
    await page
      .getByRole("button", { name: "编辑" })
      .first()
      .waitFor({ timeout: 180000 });

    report.generatedIntoWorkspace = await page
      .getByRole("button", { name: "编辑" })
      .first()
      .isVisible();

    const firstEditor = page.locator("textarea").first();
    await firstEditor.waitFor({ timeout: 10000 });
    const firstValue = await firstEditor.inputValue();
    report.firstBlockPreview = firstValue;
    report.articleLooksReal =
      Boolean(firstValue.trim()) && firstValue !== PLACEHOLDER_TEXT;

    const historyPayload = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    }, HISTORY_STORAGE_KEY);

    report.recordCount = historyPayload.length;
    report.historyCreated = historyPayload.length > 0;

    const firstRecord = historyPayload[0] ?? null;
    if (firstRecord) {
      report.recordTitle = firstRecord.title;
      report.activeModelName = firstRecord.generation?.modelName ?? null;
      report.activeModelProvider = firstRecord.generation?.modelProvider ?? null;
      report.generationMetaCaptured =
        Boolean(firstRecord.generation?.modelName) &&
        Boolean(firstRecord.generation?.modelProvider);
    }

    await firstEditor.fill(`${firstValue}${APPEND_TEXT}`);
    await page.waitForTimeout(1600);

    const persistedAfterEdit = await page.evaluate(
      ({ storageKey, appendedText }) => {
        const raw = window.localStorage.getItem(storageKey);

        if (!raw) {
          return { matched: false, saveLabel: null };
        }

        const records = JSON.parse(raw);
        const firstRecord = records[0];
        const blocks = firstRecord?.content?.wechat_article?.blocks ?? [];
        const matched = blocks.some(
          (block) =>
            typeof block?.text === "string" &&
            block.text.endsWith(appendedText),
        );

        return {
          matched,
          saveLabel: firstRecord ? "persisted" : null,
        };
      },
      { storageKey: HISTORY_STORAGE_KEY, appendedText: APPEND_TEXT },
    );

    report.saveStateAfterEdit = persistedAfterEdit.saveLabel;
    report.autosaveWorked = persistedAfterEdit.matched;

    await page.reload({ waitUntil: "networkidle" });
    const reloadedEditor = page.locator("textarea").first();
    await reloadedEditor.waitFor({ timeout: 10000 });
    const reloadedValue = await reloadedEditor.inputValue();
    report.reloadRestoreWorked = reloadedValue.endsWith(APPEND_TEXT);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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
