import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const PROMPT =
  "写一篇关于提高工作效率的小红书笔记，面向 25-35 岁职场人，语气专业但不生硬，要有生活化经验感。";
const APPEND_TEXT = " 验收修改。";
const PLACEHOLDER_TEXT =
  "这是一篇新生成的小红书草稿，请继续补充你的真实经验和表达。";

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
    contentLooksReal: false,
    autosaveWorked: false,
    reloadRestoreWorked: false,
    activeModelName: null,
    activeModelProvider: null,
    generatedPlatforms: [],
    titleValue: null,
    captionPreview: null,
    imageSuggestionCount: 0,
    tagsValue: null,
    saveStateAfterEdit: null,
    recordTitle: null,
    recordCaption: null,
    recordTags: [],
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

    await page.locator("button").filter({ hasText: "小红书笔记" }).first().click();

    const generateButton = page.getByRole("button", { name: "生成内容" });
    await expectButtonEnabled(page, generateButton);
    await generateButton.click();

    await page
      .getByRole("button", { name: "编辑" })
      .first()
      .waitFor({ timeout: 180000 });

    report.generatedIntoWorkspace = await page
      .getByRole("button", { name: "编辑" })
      .first()
      .isVisible();

    const captionCard = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "正文文案区" }) })
      .first();
    const titleInput = captionCard.locator("input").first();
    const captionTextarea = captionCard.locator("textarea").first();
    const tagsInput = captionCard.locator("input").nth(1);

    await titleInput.waitFor({ timeout: 10000 });
    await captionTextarea.waitFor({ timeout: 10000 });

    const titleValue = await titleInput.inputValue();
    const captionValue = await captionTextarea.inputValue();
    const tagsValue = await tagsInput.inputValue();

    report.titleValue = titleValue;
    report.captionPreview = captionValue;
    report.tagsValue = tagsValue;
    report.contentLooksReal =
      Boolean(titleValue.trim()) &&
      Boolean(captionValue.trim()) &&
      captionValue !== PLACEHOLDER_TEXT;

    report.imageSuggestionCount = await page
      .locator("article")
      .filter({ hasText: "图片建议" })
      .count();

    const historyPayload = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    }, HISTORY_STORAGE_KEY);

    report.historyCreated = historyPayload.length > 0;

    const firstRecord = historyPayload[0] ?? null;
    if (firstRecord) {
      report.generatedPlatforms = firstRecord.generation?.selectedPlatformsSnapshot ?? [];
      report.activeModelName = firstRecord.generation?.modelName ?? null;
      report.activeModelProvider = firstRecord.generation?.modelProvider ?? null;
      report.recordTitle = firstRecord.content?.xiaohongshu?.title ?? null;
      report.recordCaption = firstRecord.content?.xiaohongshu?.caption ?? null;
      report.recordTags = firstRecord.content?.xiaohongshu?.tags ?? [];
      report.generationMetaCaptured =
        Boolean(firstRecord.generation?.modelName) &&
        Boolean(firstRecord.generation?.modelProvider);
      report.contentLooksReal =
        Boolean(firstRecord.content?.xiaohongshu?.title?.trim()) &&
        Boolean(firstRecord.content?.xiaohongshu?.caption?.trim()) &&
        firstRecord.content?.xiaohongshu?.caption !== PLACEHOLDER_TEXT &&
        Array.isArray(firstRecord.content?.xiaohongshu?.imageSuggestions) &&
        firstRecord.content?.xiaohongshu?.imageSuggestions.length >= 3;
    }

    await captionTextarea.fill(`${captionValue}${APPEND_TEXT}`);
    await page.waitForTimeout(1600);

    const persistedAfterEdit = await page.evaluate(
      ({ storageKey, appendedText }) => {
        const raw = window.localStorage.getItem(storageKey);

        if (!raw) {
          return { matched: false, saveLabel: null };
        }

        const records = JSON.parse(raw);
        const firstRecord = records[0];
        const caption = firstRecord?.content?.xiaohongshu?.caption ?? "";

        return {
          matched:
            typeof caption === "string" && caption.endsWith(appendedText),
          saveLabel: firstRecord ? "persisted" : null,
        };
      },
      { storageKey: HISTORY_STORAGE_KEY, appendedText: APPEND_TEXT },
    );

    report.saveStateAfterEdit = persistedAfterEdit.saveLabel;
    report.autosaveWorked = persistedAfterEdit.matched;

    await page.reload({ waitUntil: "networkidle" });
    const reloadedCaption = await page.locator("textarea").first().inputValue();
    report.reloadRestoreWorked = reloadedCaption.endsWith(APPEND_TEXT);
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
