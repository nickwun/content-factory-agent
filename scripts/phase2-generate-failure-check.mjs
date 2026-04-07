import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const HISTORY_STORAGE_KEY = "content-agent-history";
const PROMPT =
  "写一篇关于提高工作效率的小红书笔记，面向 25-35 岁职场人，语气专业但不生硬，要有生活化经验感。";

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
    errorVisible: false,
    errorText: null,
    inputRetained: false,
    buttonRecovered: false,
    historyCount: 0,
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
      .getByRole("button", { name: "生成内容" })
      .waitFor({ timeout: 120000 });

    report.buttonRecovered = await page
      .getByRole("button", { name: "生成内容" })
      .isVisible();

    const promptValue = await promptTextarea.inputValue();
    report.inputRetained = promptValue.includes("提高工作效率");

    const bodyText = await page.locator("body").textContent();
    const errorText = bodyText
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => /无法生成|失败|超时|鉴权/.test(line));

    report.errorVisible = Boolean(errorText);
    report.errorText = errorText ?? null;

    report.historyCount = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw).length : 0;
    }, HISTORY_STORAGE_KEY);
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
