import {
  BASE_URL,
  buildGenerateSuccessPayload,
  createFailureScreenshot,
  createFlowReport,
  ensurePromptPreset,
  expectWorkspaceReady,
  installGenerateRouteMock,
  launchAcceptancePage,
  loadRewriteSourceFromPaste,
  readHistoryRecords,
  resetHistoryAndOpenComposer,
  selectPlatform,
  selectProcessingMode,
  selectPromptPreset,
} from "./helpers/browser-flow-fixtures.mjs";

const REWRITE_SOURCE_TEXT = [
  "很多人总以为写作效率低，是因为自己不够自律。",
  "但真正卡住人的，往往是素材没有被提前分层，写的时候总在来回切换注意力。",
  "如果能先把当天最重要的一件事单独拎出来，再留一段不被打断的时间，执行感通常会好很多。",
].join("\n\n");

const TRANSLATE_SOURCE_TEXT = [
  "Most people think they need more willpower to stay productive.",
  "But the real issue is usually context switching and the lack of a clear structure before they begin.",
  "If you can isolate the one task that matters most and protect an uninterrupted block for it, the work becomes much easier to move forward.",
].join("\n\n");

async function main() {
  const rewritePreset = await ensurePromptPreset({
    baseUrl: BASE_URL,
    platform: "wechat_article",
    processingMode: "rewrite",
    name: "Phase5 浏览器仿写预设",
    promptTemplate: "把素材改写成适合公众号发布的中文文章。",
  });
  const translatePreset = await ensurePromptPreset({
    baseUrl: BASE_URL,
    platform: "wechat_article",
    processingMode: "translate_to_zh_article",
    name: "Phase5 浏览器翻译预设",
    promptTemplate: "把英文文稿翻译并整理成自然中文文章。",
  });

  const browserSession = await launchAcceptancePage();
  const { browser, page } = browserSession;
  const rewriteFlow = createFlowReport("rewrite_flow");
  const translateFlow = createFlowReport("translate_flow");

  const generateRequests = await installGenerateRouteMock(page, {
    respond(body) {
      if (body.processingMode === "rewrite") {
        return {
          body: buildGenerateSuccessPayload({
            title: "把注意力收回来，效率才会重新回来",
            markdownBody: [
              "很多人把效率低理解成自律不够，但真正的问题，往往是事情没有先被整理清楚。",
              "",
              "当任务切换太频繁，人的注意力会一直停留在重新进入状态的成本上，而不是推进真正重要的工作。",
              "",
              "如果能先把最重要的一件事单独拎出来，再给它留一个不被打断的时间块，执行感会明显回来。",
            ].join("\n"),
            blocks: [
              {
                id: "p-1",
                type: "paragraph",
                text: "很多人把效率低理解成自律不够，但真正的问题，往往是事情没有先被整理清楚。",
              },
              {
                id: "p-2",
                type: "paragraph",
                text: "当任务切换太频繁，人的注意力会一直停留在重新进入状态的成本上，而不是推进真正重要的工作。",
              },
              {
                id: "p-3",
                type: "paragraph",
                text: "如果能先把最重要的一件事单独拎出来，再给它留一个不被打断的时间块，执行感会明显回来。",
              },
            ],
            promptSetting: rewritePreset,
          }),
        };
      }

      if (body.processingMode === "translate_to_zh_article") {
        return {
          body: buildGenerateSuccessPayload({
            title: "真正拖慢效率的，不是意志力，而是切换成本",
            markdownBody: [
              "很多人以为想提高效率，关键是逼自己更自律。",
              "",
              "但真正让工作停滞的，通常不是意志力不足，而是频繁切换任务、开始前又没有先把结构理顺。",
              "",
              "如果能先明确当天最重要的一件事，再为它留出一段不被打断的时间，推进感往往会自然出现。",
            ].join("\n"),
            blocks: [
              {
                id: "p-1",
                type: "paragraph",
                text: "很多人以为想提高效率，关键是逼自己更自律。",
              },
              {
                id: "p-2",
                type: "paragraph",
                text: "但真正让工作停滞的，通常不是意志力不足，而是频繁切换任务、开始前又没有先把结构理顺。",
              },
              {
                id: "p-3",
                type: "paragraph",
                text: "如果能先明确当天最重要的一件事，再为它留出一段不被打断的时间，推进感往往会自然出现。",
              },
            ],
            promptSetting: translatePreset,
          }),
        };
      }

      return null;
    },
  });

  try {
    await runRewriteFlow(page, rewriteFlow, rewritePreset);
    await runTranslateFlow(page, translateFlow, translatePreset);
  } finally {
    await browser.close();
  }

  const report = {
    flowName: "composer_processing_acceptance",
    success: rewriteFlow.success && translateFlow.success,
    failureStep:
      rewriteFlow.failureStep || translateFlow.failureStep || null,
    requestCount: generateRequests.length,
    rewrite_flow: rewriteFlow,
    translate_flow: translateFlow,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.success) {
    process.exitCode = 1;
  }
}

async function runRewriteFlow(page, report, rewritePreset) {
  try {
    await resetHistoryAndOpenComposer(page);

    report.startDisabledWithoutSource = await isStartButtonDisabled(page, "rewrite");
    report.failureStep = report.startDisabledWithoutSource
      ? null
      : "rewrite_button_should_be_disabled_without_source";
    if (report.failureStep) {
      throw new Error("Rewrite start button should be disabled before source is loaded.");
    }

    await loadRewriteSourceFromPaste(page, REWRITE_SOURCE_TEXT);
    report.startDisabledWithoutPreset = await isStartButtonDisabled(page, "rewrite");
    report.failureStep = report.startDisabledWithoutPreset
      ? null
      : "rewrite_button_should_be_disabled_without_preset";
    if (report.failureStep) {
      throw new Error("Rewrite start button should stay disabled before preset selection.");
    }

    await selectPlatform(page, "公众号文章");
    await selectPromptPreset(page, "公众号", rewritePreset.name);
    report.startEnabledWithPreset = !(await isStartButtonDisabled(page, "rewrite"));
    report.failureStep = report.startEnabledWithPreset
      ? null
      : "rewrite_button_should_be_enabled_with_source_and_preset";
    if (report.failureStep) {
      throw new Error("Rewrite start button did not become enabled after source and preset were ready.");
    }

    await page.getByRole("button", { name: "开始仿写", exact: true }).click();
    await expectWorkspaceReady(page);

    report.workspaceOpened = true;
    report.workspaceProcessingLabelVisible = await page
      .getByText("处理方式")
      .first()
      .isVisible();
    report.workspaceRewriteLabelVisible = await page
      .getByText("仿写", { exact: true })
      .first()
      .isVisible();

    const records = await readHistoryRecords(page);
    const record = records[0];
    report.historyRecordCreated = Boolean(record?.content?.wechat_article);
    report.recordProcessingMode = record?.generation?.processingMode ?? null;
    report.requestProcessingMode = "rewrite";
    report.success =
      report.workspaceOpened &&
      report.historyRecordCreated &&
      report.recordProcessingMode === "rewrite";
  } catch (error) {
    report.success = false;
    report.failureStep = report.failureStep ?? "rewrite_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

async function runTranslateFlow(page, report, translatePreset) {
  try {
    await resetHistoryAndOpenComposer(page);
    await selectProcessingMode(page, "翻译成中文文章");

    report.translationCopyVisible = await page
      .getByText("上传或粘贴英文文稿，再选择翻译类提示词预设。")
      .isVisible();
    report.batchButtonHidden = (await page.getByRole("button", { name: "批量仿写", exact: true }).count()) === 0;
    report.failureStep =
      report.translationCopyVisible && report.batchButtonHidden
        ? null
        : "translate_mode_ui_should_switch";
    if (report.failureStep) {
      throw new Error("Translate mode did not switch copy or hide the batch entry.");
    }

    await selectPlatform(page, "公众号文章");
    const presetSelect = page
      .locator("label")
      .filter({ has: page.getByText("公众号", { exact: true }) })
      .filter({ has: page.locator("select") })
      .first()
      .locator("select");
    const optionTexts = await presetSelect.locator("option").allTextContents();
    report.onlyTranslationPresetShown =
      optionTexts.some((option) => option.includes(translatePreset.name)) &&
      !optionTexts.some((option) => option.includes("Phase5 浏览器仿写预设"));
    report.failureStep = report.onlyTranslationPresetShown
      ? null
      : "translate_mode_should_filter_prompt_presets";
    if (report.failureStep) {
      throw new Error("Translate mode still exposed rewrite presets in the selector.");
    }

    report.startDisabledWithoutSource = await isStartButtonDisabled(
      page,
      "translate",
    );
    await loadRewriteSourceFromPaste(page, TRANSLATE_SOURCE_TEXT);
    report.startDisabledWithoutPreset = await isStartButtonDisabled(
      page,
      "translate",
    );
    report.failureStep =
      report.startDisabledWithoutSource && report.startDisabledWithoutPreset
        ? null
        : "translate_button_state_should_be_guarded";
    if (report.failureStep) {
      throw new Error("Translate start button state was not guarded before preset selection.");
    }

    await selectPromptPreset(page, "公众号", translatePreset.name);
    report.startEnabledWithPreset = !(await isStartButtonDisabled(
      page,
      "translate",
    ));
    report.failureStep = report.startEnabledWithPreset
      ? null
      : "translate_button_should_be_enabled_with_source_and_preset";
    if (report.failureStep) {
      throw new Error("Translate start button did not become enabled after source and preset were ready.");
    }

    await page.getByRole("button", { name: "开始翻译整理", exact: true }).click();
    await expectWorkspaceReady(page);

    report.workspaceOpened = true;
    report.workspaceTranslateLabelVisible = await page
      .getByText("翻译整理", { exact: true })
      .first()
      .isVisible();

    const records = await readHistoryRecords(page);
    const record = records[0];
    report.historyRecordCreated = Boolean(record?.content?.wechat_article);
    report.recordProcessingMode = record?.generation?.processingMode ?? null;
    report.requestProcessingMode = "translate_to_zh_article";
    report.success =
      report.workspaceOpened &&
      report.historyRecordCreated &&
      report.recordProcessingMode === "translate_to_zh_article";
  } catch (error) {
    report.success = false;
    report.failureStep = report.failureStep ?? "translate_flow_unexpected_error";
    report.errorMessage = error instanceof Error ? error.message : String(error);
    report.screenshotPath = await createFailureScreenshot(page, report.flowName);
  }
}

async function isStartButtonDisabled(page, mode) {
  const buttonName =
    mode === "translate" ? "开始翻译整理" : "开始仿写";
  return page.getByRole("button", { name: buttonName, exact: true }).isDisabled();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
