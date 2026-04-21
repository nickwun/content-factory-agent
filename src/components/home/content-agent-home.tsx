"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ArticleSourcePanel } from "@/components/home/article-source-panel";
import { BatchRewritePanel } from "@/components/home/batch-rewrite-panel";
import { createHistoryRecord } from "@/lib/history/history-record-factory";
import {
  createCoverGenerationFailedEvent,
  createCoverGenerationSucceededEvent,
  createDraftGeneratedEvent,
  createFinalizationCompletedEvent,
  createExecutionEventStore,
  createRecordCreatedEvent,
  createRunId,
} from "@/lib/observability/execution-event-store";
import { PromptPresetSelector } from "@/components/home/prompt-preset-selector";
import { PublishQrDialog } from "@/components/publish/publish-qr-dialog";
import { FeishuPublishResultDialog } from "@/components/publish/feishu-publish-result-dialog";
import { WechatPublishDialog } from "@/components/publish/wechat-publish-dialog";
import { XiaohongshuPublishDialog } from "@/components/publish/xiaohongshu-publish-dialog";
import { WechatEditor } from "@/components/workspace/platform-editors/wechat-editor";
import { ContentTracePanel } from "@/components/workspace/content-trace-panel";
import { XiaohongshuEditor } from "@/components/workspace/platform-editors/xiaohongshu-editor";
import { TwitterEditor } from "@/components/workspace/platform-editors/twitter-editor";
import { VideoScriptEditor } from "@/components/workspace/platform-editors/video-script-editor";
import {
  buildGenerateImageErrorMessage,
  GenerateImageRequestError,
  requestGeneratedImage,
} from "@/lib/generation/generate-image-client";
import {
  buildGenerateWechatCoverErrorMessage,
  GenerateWechatCoverRequestError,
  requestGeneratedWechatCover,
} from "@/lib/generation/generate-wechat-cover-client";
import {
  buildGenerateErrorMessage,
  GenerateRequestError,
  getGeneratePendingMessage,
  requestGeneratedDraft,
} from "@/lib/generation/generate-client";
import type { GeneratedDraftResult } from "@/lib/generation/generation-service";
import { buildContentTraceSummary } from "@/lib/observability/trace-summary";
import { createPublishResultStore } from "@/lib/observability/publish-result-store";
import type { ContentTraceSummary } from "@/lib/observability/types";
import type {
  FeishuPublishResponse,
  XiaohongshuPublishResponse,
} from "@/lib/publish/types";
import {
  buildGenerateRequestPayload,
  buildRewriteSourceErrorMessage,
  buildRewriteSourceNotice,
} from "@/lib/rewrite/article-source-ui";
import { buildComposerRewriteUserPrompt } from "@/lib/rewrite/prompt-preset-input";
import { buildWechatFinalizationOptions } from "@/lib/generation/wechat-finalization";
import {
  buildBatchRewriteSelectionMessage,
  createBatchRewriteFailedItem,
  createBatchRewriteReadyItem,
  planBatchRewriteFileSelection,
  resolveSelectedPlatformsForRewriteMode,
  type BatchRewriteFileLike,
  type BatchRewriteItem,
  type RewriteComposerMode,
} from "@/lib/rewrite/batch-rewrite";
import {
  buildBatchRewriteProgress,
  getNextBatchRewriteReadyItem,
  markBatchRewriteGenerating,
  markBatchRewriteRunFailed,
  markBatchRewriteRunSucceeded,
} from "@/lib/rewrite/batch-rewrite-run";
import { parseRewriteFile } from "@/lib/rewrite/rewrite-file-parser";
import {
  buildRewriteSource,
  MAX_REWRITE_SOURCE_CHARS,
  type RewriteSource,
} from "@/lib/rewrite/rewrite-source";
import type { PlatformPromptSetting } from "@/lib/settings/prompt-settings-types";
import type {
  PlatformPromptPresetGroup,
  PromptPresetIdByPlatform,
} from "@/lib/settings/prompt-settings-types";
import { buildSelectedPromptPresetByPlatform } from "@/lib/settings/prompt-preset-selection";
import type { HistoryRecord } from "@/lib/types/history";
import type { PlatformType } from "@/lib/types/platform";
import {
  failXiaohongshuImageGeneration,
  finishXiaohongshuImageGeneration,
  startXiaohongshuImageGeneration,
} from "@/lib/workspace/xiaohongshu-images";
import {
  failWechatCoverImageGeneration,
  finishWechatCoverImageGeneration,
  startWechatCoverImageGeneration,
} from "@/lib/workspace/wechat-cover-image-workflow";
import {
  resolveHomeScreenMode,
  resolveMobileHistoryPanelState,
  resolveRequestedHomeScreenMode,
} from "@/lib/workspace/workspace-state";
import { getWorkspaceStatusLabel } from "@/lib/workspace/workspace-status";
import { useHistoryWorkspace } from "@/hooks/use-history-workspace";

const PLATFORM_OPTIONS: Array<{ value: PlatformType; label: string }> = [
  { value: "wechat_article", label: "公众号文章" },
  { value: "xiaohongshu", label: "小红书笔记" },
  { value: "twitter", label: "Twitter 推文" },
  { value: "video_script", label: "视频脚本" },
];

const PLATFORM_LABELS: Record<PlatformType, string> = {
  wechat_article: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  video_script: "视频脚本",
};

type ContentAgentHomeProps = {
  initialPromptPresetGroups: PlatformPromptPresetGroup[];
  initialRequestedHomeScreenMode?: string;
};

export function ContentAgentHome({
  initialPromptPresetGroups,
  initialRequestedHomeScreenMode,
}: ContentAgentHomeProps) {
  const router = useRouter();
  const {
    loaded,
    records,
    filteredRecords,
    activeRecord,
    activeRecordId,
    searchQuery,
    saveState,
    setSearchQuery,
    createRecord,
    renameRecord,
    deleteRecord,
    selectRecord,
    updateRecord,
    updateActiveContent,
    setActivePlatform,
  } = useHistoryWorkspace();

  const [screenMode, setScreenMode] = useState<"composer" | "workspace">(
    "composer",
  );
  const [composerPinned, setComposerPinned] = useState(false);
  const [rewriteComposerMode, setRewriteComposerMode] =
    useState<RewriteComposerMode>("single");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([]);
  const [promptPresetGroups, setPromptPresetGroups] = useState(
    initialPromptPresetGroups,
  );
  const [selectedPromptPresetByPlatform, setSelectedPromptPresetByPlatform] =
    useState<PromptPresetIdByPlatform>({});
  const [rewriteSource, setRewriteSource] = useState<RewriteSource | null>(null);
  const [articleSourceMode, setArticleSourceMode] = useState<
    "idle" | "paste" | "upload"
  >("idle");
  const [pastedSourceText, setPastedSourceText] = useState("");
  const [rewriteSourceError, setRewriteSourceError] = useState<string | null>(null);
  const [rewriteSourceNotice, setRewriteSourceNotice] = useState<string | null>(null);
  const [isParsingRewriteFile, setIsParsingRewriteFile] = useState(false);
  const [batchRewriteItems, setBatchRewriteItems] = useState<BatchRewriteItem[]>([]);
  const [batchRewriteSelectionMessage, setBatchRewriteSelectionMessage] =
    useState<string | null>(null);
  const [isParsingBatchFiles, setIsParsingBatchFiles] = useState(false);
  const [batchGenerateState, setBatchGenerateState] = useState<
    "idle" | "running" | "completed"
  >("idle");
  const [generateState, setGenerateState] = useState<
    "idle" | "generating" | "error"
  >("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [wechatFinalizationEnabled, setWechatFinalizationEnabled] =
    useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [wechatPublishDialogOpen, setWechatPublishDialogOpen] = useState(false);
  const [xiaohongshuPublishDialogOpen, setXiaohongshuPublishDialogOpen] =
    useState(false);
  const [publishQrDialog, setPublishQrDialog] =
    useState<XiaohongshuPublishResponse | null>(null);
  const [feishuPublishResult, setFeishuPublishResult] =
    useState<FeishuPublishResponse | null>(null);
  const [traceSummary, setTraceSummary] = useState<ContentTraceSummary | null>(
    null,
  );
  const [traceSummaryVersion, setTraceSummaryVersion] = useState(0);
  const [mobileHistoryPanelState, setMobileHistoryPanelState] = useState<
    "closed" | "open"
  >("closed");
  const editorFocusRef = useRef<HTMLDivElement | null>(null);
  const rewriteFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchRewriteFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchRewriteItemsRef = useRef<BatchRewriteItem[]>([]);
  const executionEventStore = useMemo(() => createExecutionEventStore(), []);
  const publishResultStore = useMemo(() => createPublishResultStore(), []);
  const requestedHomeScreenMode = resolveRequestedHomeScreenMode(
    initialRequestedHomeScreenMode,
  );

  async function recordGenerationLifecycle(
    nextRecord: HistoryRecord,
    runId: string,
  ) {
    try {
      const platform =
        nextRecord.traceContext?.createdFromPlatform ??
        nextRecord.selectedPlatforms[0];
      const events = [
        createRecordCreatedEvent({
          runId,
          recordId: nextRecord.id,
          createdAt: nextRecord.createdAt,
          platform,
          modelName: nextRecord.generation.modelName,
        }),
        createDraftGeneratedEvent({
          runId,
          recordId: nextRecord.id,
          createdAt: nextRecord.createdAt,
          platform,
          modelName: nextRecord.generation.modelName,
        }),
      ];

      if (nextRecord.generation.wechatFinalizationApplied === true) {
        events.push(
          createFinalizationCompletedEvent({
            runId,
            recordId: nextRecord.id,
            createdAt: nextRecord.createdAt,
            platform,
            modelName: nextRecord.generation.modelName,
          }),
        );
      }

      for (const event of events) {
        await executionEventStore.append(event);
      }
    } catch {
      // Keep the main creation flow usable even if observability persistence fails.
    }
  }

  function refreshTraceSummary() {
    setTraceSummaryVersion((current) => current + 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshPromptPresetGroups() {
      try {
        const response = await fetch("/api/prompt-presets");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          presetGroups: PlatformPromptPresetGroup[];
        };

        if (!cancelled) {
          setPromptPresetGroups(data.presetGroups);
        }
      } catch {
        // Keep the initial snapshot if refresh fails.
      }
    }

    void refreshPromptPresetGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!requestedHomeScreenMode) {
      return;
    }

    if (requestedHomeScreenMode === "composer") {
      setComposerPinned(true);
      setScreenMode("composer");
      return;
    }

    setComposerPinned(false);
    setScreenMode("workspace");
  }, [requestedHomeScreenMode]);

  useEffect(() => {
    if (!activeRecord) {
      setTraceSummary(null);
      return;
    }

    const record = activeRecord;
    let cancelled = false;

    async function loadTraceSummary() {
      const publishResults = await publishResultStore.listByRecordId(record.id);
      const historyEvents = await executionEventStore.listByEntity(
        "history_record",
        record.id,
      );
      const publishEvents = (
        await Promise.all(
          publishResults.map((result) =>
            executionEventStore.listByEntity("publish_result", result.id),
          ),
        )
      ).flat();

      if (cancelled) {
        return;
      }

      setTraceSummary(
        buildContentTraceSummary({
          record,
          publishResults,
          executionEvents: [...historyEvents, ...publishEvents],
        }),
      );
    }

    void loadTraceSummary();

    return () => {
      cancelled = true;
    };
  }, [activeRecord, executionEventStore, publishResultStore, traceSummaryVersion]);

  const hasHistory = records.length > 0;
  const resolvedScreenMode = resolveHomeScreenMode({
    screenMode,
    loaded,
    hasActiveRecord: Boolean(activeRecord),
    composerPinned,
  });
  const shouldShowWorkspace =
    resolvedScreenMode === "workspace" && Boolean(activeRecord && loaded);
  const composerSelectedPlatforms = resolveSelectedPlatformsForRewriteMode(
    rewriteComposerMode,
    selectedPlatforms,
  );
  const isBatchComposerMode = rewriteComposerMode === "batch";
  const wechatFinalization =
    composerSelectedPlatforms.includes("wechat_article")
      ? buildWechatFinalizationOptions(wechatFinalizationEnabled)
      : undefined;
  const executableBatchItems = batchRewriteItems.filter(
    (item) => item.parseStatus === "ready",
  );
  const batchProgress = buildBatchRewriteProgress(executableBatchItems);
  const hasRequiredRewriteSource = isBatchComposerMode
    ? executableBatchItems.length > 0
    : Boolean(rewriteSource);
  const hasRequiredPromptPresets =
    composerSelectedPlatforms.length > 0 &&
    composerSelectedPlatforms.every((platform) =>
      Boolean(selectedPromptPresetByPlatform[platform]),
    );

  useEffect(() => {
    batchRewriteItemsRef.current = batchRewriteItems;
  }, [batchRewriteItems]);

  const activePlatform = activeRecord?.workspace.activePlatform;

  const publishEnabled =
    activePlatform &&
    ["wechat_article", "xiaohongshu", "twitter"].includes(activePlatform);

  const currentPlatformContent = activeRecord?.content[activePlatform ?? "wechat_article"];
  const isVideoScriptWorkspace = activePlatform === "video_script";

  const saveStatusLabel = useMemo(
    () => getWorkspaceStatusLabel(saveState),
    [saveState],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  async function handleGenerate() {
    if (isBatchComposerMode) {
      await handleBatchGenerate();
      return;
    }

    if (
      !rewriteSource ||
      composerSelectedPlatforms.length === 0 ||
      !hasRequiredPromptPresets
    ) {
      return;
    }

    const resolvedPromptPresetSelection = buildSelectedPromptPresetByPlatform({
      selectedPlatforms: composerSelectedPlatforms,
      presetGroups: promptPresetGroups,
      selectedPresetIds: selectedPromptPresetByPlatform,
    });

    if (!resolvedPromptPresetSelection.ok) {
      setGenerateState("error");
      setGenerateMessage(resolvedPromptPresetSelection.errorMessage);
      return;
    }

    setGenerateState("generating");
    setGenerateMessage(null);

    try {
      const data = (await requestGeneratedDraft(
        fetch,
        buildGenerateRequestPayload({
          requestSource: "composer_rewrite",
          selectedPlatforms: composerSelectedPlatforms,
          rewriteSource,
          selectedPromptPresetByPlatform:
            resolvedPromptPresetSelection.selectedPromptPresetByPlatform,
          ...(wechatFinalization ? { wechatFinalization } : {}),
        }),
      )) as {
        draft: GeneratedDraftResult;
        promptSettings: PlatformPromptSetting[];
      };

      const now = new Date().toISOString();
      const runId = createRunId("generation");
      const resolvedUserPrompt = buildComposerRewriteUserPrompt({
        selectedPromptSettings: data.promptSettings,
        rewriteSource,
      });
      const nextRecord = createHistoryRecord({
        userPrompt: resolvedUserPrompt,
        selectedPlatforms: composerSelectedPlatforms,
        now,
        autoTitle: data.draft.autoTitle,
        content: data.draft.content,
        promptSettings: data.promptSettings,
        generationInfo: data.draft.generationInfo,
        rewriteSource,
      });

      await createRecord(nextRecord);
      await recordGenerationLifecycle(nextRecord, runId);
      setComposerPinned(false);
      setScreenMode("workspace");
      router.replace("/?view=workspace");
      resetRewriteSourceState();
      setGenerateState("idle");
      setGenerateMessage(null);
      setToast(
        getGenerationSuccessMessage(
          data.draft.generatedPlatforms,
          data.draft.mockPlatforms,
        ),
      );
    } catch (error) {
      setGenerateState("error");
      setGenerateMessage(
        error instanceof GenerateRequestError
          ? buildGenerateErrorMessage(error, composerSelectedPlatforms, {
              hasRewriteSource: Boolean(rewriteSource),
            })
          : "本次生成失败，请稍后重试。",
      );
    }
  }

  async function handleBatchGenerate() {
    if (executableBatchItems.length === 0) {
      setGenerateState("error");
      setGenerateMessage("先至少准备 1 篇可解析的素材，再开始批量仿写。");
      return;
    }

    if (composerSelectedPlatforms.length === 0) {
      setGenerateState("error");
      setGenerateMessage("先至少选择一个输出平台，再开始批量仿写。");
      return;
    }

    if (!hasRequiredPromptPresets) {
      setGenerateState("error");
      setGenerateMessage("先为当前批次要输出的平台选择提示词预设。");
      return;
    }

    const resolvedPromptPresetSelection = buildSelectedPromptPresetByPlatform({
      selectedPlatforms: composerSelectedPlatforms,
      presetGroups: promptPresetGroups,
      selectedPresetIds: selectedPromptPresetByPlatform,
    });

    if (!resolvedPromptPresetSelection.ok) {
      setGenerateState("error");
      setGenerateMessage(resolvedPromptPresetSelection.errorMessage);
      return;
    }

    setGenerateState("idle");
    setGenerateMessage(null);
    setBatchGenerateState("running");

    let succeededCount = 0;
    let failedCount = 0;

    for (;;) {
      const nextItem = getNextBatchRewriteReadyItem(batchRewriteItemsRef.current);
      if (!nextItem || !nextItem.rewriteSource) {
        break;
      }

      setBatchRewriteItems((current) =>
        markBatchRewriteGenerating(current, nextItem.id),
      );

      try {
        const data = (await requestGeneratedDraft(
          fetch,
          buildGenerateRequestPayload({
            requestSource: "composer_rewrite",
            selectedPlatforms: composerSelectedPlatforms,
            rewriteSource: nextItem.rewriteSource,
            selectedPromptPresetByPlatform:
              resolvedPromptPresetSelection.selectedPromptPresetByPlatform,
            ...(wechatFinalization ? { wechatFinalization } : {}),
          }),
        )) as {
          draft: GeneratedDraftResult;
          promptSettings: PlatformPromptSetting[];
        };

        const now = new Date().toISOString();
        const runId = createRunId("generation");
        const resolvedUserPrompt = buildComposerRewriteUserPrompt({
          selectedPromptSettings: data.promptSettings,
          rewriteSource: nextItem.rewriteSource,
        });
        const nextRecord = createHistoryRecord({
          userPrompt: resolvedUserPrompt,
          selectedPlatforms: composerSelectedPlatforms,
          now,
          autoTitle: data.draft.autoTitle,
          content: data.draft.content,
          promptSettings: data.promptSettings,
          generationInfo: data.draft.generationInfo,
          rewriteSource: nextItem.rewriteSource,
        });

        await createRecord(nextRecord, { activate: false });
        await recordGenerationLifecycle(nextRecord, runId);
        succeededCount += 1;
        setBatchRewriteItems((current) =>
          markBatchRewriteRunSucceeded(current, {
            itemId: nextItem.id,
            recordId: nextRecord.id,
            recordTitle: nextRecord.title,
          }),
        );
      } catch (error) {
        failedCount += 1;
        const message =
          error instanceof GenerateRequestError
            ? buildGenerateErrorMessage(error, composerSelectedPlatforms, {
                hasRewriteSource: true,
              })
            : "本篇仿写失败，请稍后重试。";

        setBatchRewriteItems((current) =>
          markBatchRewriteRunFailed(current, {
            itemId: nextItem.id,
            errorMessage: message,
          }),
        );
      }
    }

    setBatchGenerateState("completed");
    setToast(
      failedCount > 0
        ? `批量仿写完成：成功 ${succeededCount} 篇，失败 ${failedCount} 篇。`
        : `批量仿写完成：成功生成 ${succeededCount} 篇公众号草稿。`,
    );
  }

  async function handleGenerateWechatCoverImage() {
    if (
      !activeRecord ||
      activePlatform !== "wechat_article" ||
      currentPlatformContent?.platform !== "wechat_article"
    ) {
      return;
    }

    const runId = createRunId("generation");

    updateActiveContent((current) => {
      const article = current.wechat_article;

      if (!article) {
        return current;
      }

      return {
        ...current,
        wechat_article: startWechatCoverImageGeneration(article),
      };
    });

    try {
      const result = await requestGeneratedWechatCover(fetch, {
        articleTitle: currentPlatformContent.title,
        articleBlocks: currentPlatformContent.blocks,
      });

      updateActiveContent((current) => {
        const article = current.wechat_article;

        if (!article) {
          return current;
        }

        return {
          ...current,
          wechat_article: finishWechatCoverImageGeneration(
            article,
            result.image,
          ),
        };
      });
      try {
        await executionEventStore.append(
          createCoverGenerationSucceededEvent({
            runId,
            recordId: activeRecord.id,
            createdAt: new Date().toISOString(),
            platform: "wechat_article",
          }),
        );
      } catch {
        // Keep the cover flow usable even if observability persistence fails.
      }
      refreshTraceSummary();
      setToast("公众号头图已生成");
    } catch (error) {
      const errorMessage =
        error instanceof GenerateWechatCoverRequestError
          ? buildGenerateWechatCoverErrorMessage(error)
          : "公众号头图生成失败，请稍后重试。";

      updateActiveContent((current) => {
        const article = current.wechat_article;

        if (!article) {
          return current;
        }

        return {
          ...current,
          wechat_article: failWechatCoverImageGeneration(article, {
            error: errorMessage,
          }),
        };
      });
      try {
        await executionEventStore.append(
          createCoverGenerationFailedEvent({
            runId,
            recordId: activeRecord.id,
            createdAt: new Date().toISOString(),
            platform: "wechat_article",
            errorCode:
              error instanceof GenerateWechatCoverRequestError
                ? error.code
                : undefined,
            message: errorMessage,
          }),
        );
      } catch {
        // Keep the cover flow usable even if observability persistence fails.
      }
      refreshTraceSummary();
      setToast(errorMessage);
    }
  }

  function handleArticleSourceModeChange(mode: "paste" | "upload") {
    setArticleSourceMode(mode);
    setRewriteSourceError(null);
    setRewriteSourceNotice(null);
  }

  function handleApplyPastedSource() {
    try {
      const nextSource = buildRewriteSource({
        kind: "pasted_text",
        extractedText: pastedSourceText,
        maxChars: MAX_REWRITE_SOURCE_CHARS,
      });

      setRewriteSource(nextSource);
      setRewriteSourceNotice(buildRewriteSourceNotice(nextSource));
      setRewriteSourceError(null);
      setArticleSourceMode("idle");
      setPastedSourceText("");
    } catch (error) {
      setRewriteSource(null);
      setRewriteSourceNotice(null);
      setRewriteSourceError(buildRewriteSourceErrorMessage(error));
    }
  }

  async function handleRewriteFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsParsingRewriteFile(true);
    setRewriteSourceError(null);
    setRewriteSourceNotice(null);

    try {
      const nextSource = await parseRewriteFile(file, {
        maxChars: MAX_REWRITE_SOURCE_CHARS,
      });

      setRewriteSource(nextSource);
      setRewriteSourceNotice(buildRewriteSourceNotice(nextSource));
      setArticleSourceMode("idle");
      setPastedSourceText("");
    } catch (error) {
      setRewriteSource(null);
      setRewriteSourceNotice(null);
      setRewriteSourceError(buildRewriteSourceErrorMessage(error));
    } finally {
      setIsParsingRewriteFile(false);
      event.target.value = "";
    }
  }

  async function handleBatchRewriteFilesChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const incomingFiles = Array.from(
      event.target.files ?? [],
    ) as BatchRewriteFileLike[];

    if (incomingFiles.length === 0) {
      return;
    }

    const selection = planBatchRewriteFileSelection({
      existingItems: batchRewriteItems,
      incomingFiles,
    });
    setBatchRewriteSelectionMessage(
      buildBatchRewriteSelectionMessage(selection.rejectedFiles),
    );

    if (selection.acceptedFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setIsParsingBatchFiles(true);

    const nextItems: BatchRewriteItem[] = [];

    try {
      for (const file of selection.acceptedFiles) {
        try {
          const nextSource = await parseRewriteFile(file, {
            maxChars: MAX_REWRITE_SOURCE_CHARS,
          });
          nextItems.push(createBatchRewriteReadyItem(file, nextSource));
        } catch (error) {
          nextItems.push(
            createBatchRewriteFailedItem(
              file,
              buildRewriteSourceErrorMessage(error),
            ),
          );
        }
      }
    } finally {
      setIsParsingBatchFiles(false);
      event.target.value = "";
    }

    setBatchRewriteItems((current) => [...current, ...nextItems]);
  }

  function handleReplaceRewriteSource() {
    const nextMode = rewriteSource?.kind === "uploaded_file" ? "upload" : "paste";
    setRewriteSource(null);
    setRewriteSourceError(null);
    setRewriteSourceNotice(null);
    setArticleSourceMode(nextMode);
  }

  function clearRewriteSource() {
    resetRewriteSourceState();
  }

  function removeBatchRewriteItem(itemId: string) {
    setBatchRewriteItems((current) =>
      current.filter((item) => item.id !== itemId),
    );
    setBatchRewriteSelectionMessage(null);
  }

  function openBatchRewriteResult(recordId: string) {
    setComposerPinned(false);
    selectRecord(recordId);
    setScreenMode("workspace");
    router.replace("/?view=workspace");
  }

  function resetRewriteSourceState() {
    setRewriteSource(null);
    setArticleSourceMode("idle");
    setPastedSourceText("");
    setRewriteSourceError(null);
    setRewriteSourceNotice(null);
    if (rewriteFileInputRef.current) {
      rewriteFileInputRef.current.value = "";
    }
  }

  async function handleRenameSubmit(recordId: string) {
    if (!editingTitle.trim()) {
      setRenameError("标题不能为空");
      return;
    }

    await renameRecord(recordId, editingTitle);
    resetRenameState();
    setToast("标题已更新");
  }

  async function handleDeleteRecord(recordId: string) {
    if (!window.confirm("确认删除这条历史记录吗？")) {
      return;
    }

    await deleteRecord(recordId);
    setToast(
      records.length === 1 ? "最后一条记录已删除，已返回新建页" : "历史记录已删除",
    );
  }

  async function handleCopy() {
    if (!activeRecord || !activePlatform) {
      return;
    }

    await navigator.clipboard.writeText(
      formatPlatformContent(activeRecord, activePlatform),
    );
    setToast("已复制当前平台内容");
  }

  function handlePublish() {
    if (activePlatform === "wechat_article" && activeRecord) {
      setWechatPublishDialogOpen(true);
      return;
    }

    if (activePlatform === "xiaohongshu" && activeRecord) {
      setXiaohongshuPublishDialogOpen(true);
      return;
    }

    setToast("模拟发布成功");
  }

  function handleEditFocus() {
    editorFocusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setToast("已聚焦到当前平台编辑区");
  }

  async function handleGenerateXiaohongshuImage(suggestionId: string) {
    if (
      !activeRecord ||
      activePlatform !== "xiaohongshu" ||
      currentPlatformContent?.platform !== "xiaohongshu"
    ) {
      return;
    }

    const targetSuggestion = currentPlatformContent.imageSuggestions.find(
      (image) => image.id === suggestionId,
    );

    if (!targetSuggestion) {
      return;
    }

    updateRecord(activeRecord.id, (record) => ({
      ...record,
      updatedAt: new Date().toISOString(),
      content: {
        ...record.content,
        xiaohongshu: record.content.xiaohongshu
          ? startXiaohongshuImageGeneration(
              record.content.xiaohongshu,
              suggestionId,
            )
          : record.content.xiaohongshu,
      },
    }));

    try {
      const result = await requestGeneratedImage(fetch, {
        platform: "xiaohongshu",
        noteTitle: currentPlatformContent.title,
        noteCaption: currentPlatformContent.caption,
        noteTags: currentPlatformContent.tags,
        suggestion: {
          id: targetSuggestion.id,
          index: targetSuggestion.index,
          title: targetSuggestion.title,
          description: targetSuggestion.description,
        },
      });

      updateRecord(activeRecord.id, (record) => ({
        ...record,
        updatedAt: new Date().toISOString(),
        content: {
          ...record.content,
          xiaohongshu: record.content.xiaohongshu
            ? finishXiaohongshuImageGeneration(
                record.content.xiaohongshu,
                suggestionId,
                result.image,
              )
            : record.content.xiaohongshu,
        },
      }));
      setToast("配图已生成");
    } catch (error) {
      const message =
        error instanceof GenerateImageRequestError
          ? buildGenerateImageErrorMessage(error)
          : "图片生成失败，请稍后重试。";

      updateRecord(activeRecord.id, (record) => ({
        ...record,
        updatedAt: new Date().toISOString(),
        content: {
          ...record.content,
          xiaohongshu: record.content.xiaohongshu
            ? failXiaohongshuImageGeneration(
                record.content.xiaohongshu,
                suggestionId,
                {
                  imageError: message,
                  imageFailureReason:
                    error instanceof GenerateImageRequestError
                      ? error.failureReason
                      : "failed_upstream_generation",
                },
              )
            : record.content.xiaohongshu,
        },
      }));
    }
  }

  function startRename(recordId: string, title: string) {
    setEditingRecordId(recordId);
    setEditingTitle(title);
    setRenameError(null);
  }

  function resetRenameState() {
    setEditingRecordId(null);
    setEditingTitle("");
    setRenameError(null);
  }

  function openMobileHistoryPanel() {
    setMobileHistoryPanelState((current) =>
      resolveMobileHistoryPanelState(current, "open"),
    );
  }

  function closeMobileHistoryPanel() {
    setMobileHistoryPanelState((current) =>
      resolveMobileHistoryPanelState(current, "close"),
    );
  }

  function handleSelectRecord(recordId: string) {
    setComposerPinned(false);
    selectRecord(recordId);
    setScreenMode("workspace");
    router.replace("/?view=workspace");
    setMobileHistoryPanelState((current) =>
      resolveMobileHistoryPanelState(current, "select_record"),
    );
  }

  const historyPanelContent = (
    <div className="space-y-3">
      {filteredRecords.map((record) => (
        <article
          key={record.id}
          className={`rounded-[28px] border p-4 transition ${
            record.id === activeRecordId
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-black/8 bg-stone-100/80 text-slate-700"
          }`}
        >
          {editingRecordId === record.id ? (
            <div className="w-full text-left">
              <div className="space-y-3">
                <input
                  value={editingTitle}
                  onChange={(event) => {
                    setEditingTitle(event.target.value);
                    if (renameError) {
                      setRenameError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRenameSubmit(record.id);
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      resetRenameState();
                    }
                  }}
                  autoFocus
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold outline-none"
                />
                {renameError ? (
                  <p className="text-xs text-amber-200">{renameError}</p>
                ) : null}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRenameSubmit(record.id);
                    }}
                    className="rounded-full bg-white/15 px-3 py-1.5"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      resetRenameState();
                    }}
                    className="rounded-full border border-white/20 px-3 py-1.5"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleSelectRecord(record.id)}
              className="w-full text-left"
            >
              <h2 className="text-sm font-semibold">{record.title}</h2>
            </button>
          )}

          <p
            className={`mt-2 text-xs leading-6 ${
              record.id === activeRecordId ? "text-white/75" : "text-slate-500"
            }`}
          >
            {record.userPrompt}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {record.selectedPlatforms.map((platform) => (
              <span
                key={platform}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  record.id === activeRecordId
                    ? "bg-white/12 text-white"
                    : "bg-white text-slate-600"
                }`}
              >
                {PLATFORM_LABELS[platform]}
              </span>
            ))}
          </div>

          <div
            className={`mt-4 flex items-center justify-between text-xs ${
              record.id === activeRecordId ? "text-white/70" : "text-slate-500"
            }`}
          >
            <span>{new Date(record.updatedAt).toLocaleString()}</span>
            <div className="hidden items-center gap-3 sm:flex">
              <button
                type="button"
                onClick={() => startRename(record.id, record.title)}
              >
                重命名
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteRecord(record.id)}
              >
                删除
              </button>
            </div>
          </div>

          {editingRecordId !== record.id && record.id === activeRecordId ? (
            <div
              className={`mt-3 flex items-center gap-3 text-xs sm:hidden ${
                record.id === activeRecordId ? "text-white/70" : "text-slate-500"
              }`}
            >
              <button
                type="button"
                onClick={() => startRename(record.id, record.title)}
                className="rounded-full border border-white/15 px-3 py-1.5"
              >
                重命名
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteRecord(record.id)}
                className="rounded-full border border-white/15 px-3 py-1.5"
              >
                删除
              </button>
            </div>
          ) : null}
        </article>
      ))}

      {!hasHistory ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-stone-50/80 px-4 py-5 text-sm leading-7 text-slate-500">
          这里会保存你的生成记录、最近编辑进度和平台内容快照。
        </div>
      ) : null}

      {hasHistory && filteredRecords.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-stone-50/80 px-4 py-5 text-sm leading-7 text-slate-500">
          没有找到匹配 “{searchQuery}” 的历史记录。
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="ml-2 font-medium text-slate-900 underline underline-offset-4"
          >
            清空搜索
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <AppShell
      currentCenter="creative"
      currentPath="/"
      showUtilityNav={false}
      secondaryNavItems={[
        {
          id: "composer",
          label: "新建内容",
          href: "/?view=composer",
        },
        activeRecord
          ? {
              id: "workspace",
              label: "文章编辑",
              href: "/?view=workspace",
            }
          : {
              id: "workspace",
              label: "文章编辑",
              href: "/?view=workspace",
              disabled: true,
              title: "暂无可编辑文章",
            },
        {
          id: "settings",
          label: "设置",
          href: "/settings",
        },
      ]}
      currentSecondaryId={shouldShowWorkspace ? "workspace" : "composer"}
    >
      {toast ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-full bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white shadow-lg sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:text-left">
          {toast}
        </div>
      ) : null}

      <WechatPublishDialog
        open={wechatPublishDialogOpen}
        record={activeRecord ?? null}
        onClose={() => setWechatPublishDialogOpen(false)}
        onPublishRecorded={refreshTraceSummary}
        onWechatSuccess={(result) => {
          setToast(result.message || "公众号文章已提交到草稿箱");
        }}
        onFeishuSuccess={(result) => {
          setFeishuPublishResult(result);
        }}
      />
      <XiaohongshuPublishDialog
        open={xiaohongshuPublishDialogOpen}
        record={activeRecord ?? null}
        onClose={() => setXiaohongshuPublishDialogOpen(false)}
        onPublishRecorded={refreshTraceSummary}
        onSuccess={(result) => {
          setPublishQrDialog(result);
        }}
      />
      <PublishQrDialog
        open={Boolean(publishQrDialog)}
        publishUrl={publishQrDialog?.publishUrl ?? ""}
        qrcodeUrl={publishQrDialog?.qrcodeUrl ?? ""}
        onClose={() => setPublishQrDialog(null)}
      />
      <FeishuPublishResultDialog
        open={Boolean(feishuPublishResult)}
        result={feishuPublishResult}
        onClose={() => setFeishuPublishResult(null)}
      />

      <div className="mb-5 rounded-[24px] border border-black/8 bg-white/78 px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.04)]">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Creative Center
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {shouldShowWorkspace ? "创作中心 / 工作台" : "创作中心 / 新建内容"}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          {shouldShowWorkspace
            ? "这里承接内容生成后的编辑、保存与发布。选题相关能力已经归到选题中心，不再混在当前工作台里。"
            : "这里负责内容生成入口和创作配置。选题池、候选文章与主题簇将继续独立长在选题中心。"}
        </p>
      </div>

      {!shouldShowWorkspace ? (
        <section className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
          <div className="w-full max-w-5xl rounded-[40px] border border-black/10 bg-white/88 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-600">
                创作中心 / 新建内容
              </p>
              <h1 className="mt-3 max-w-3xl text-[2.6rem] font-semibold tracking-tight text-slate-900 md:text-[3rem] md:leading-[1.1]">
                先仿写，再进入多平台工作区继续编辑
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-8 text-slate-600">
                本页只支持基于素材仿写。先上传原文或素材，再选择提示词预设，系统会自动带入 preset 的 prompt 和语料摘要开始仿写。
              </p>

              <div className="mt-8 space-y-5">
                <div className="rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(247,242,234,0.95))] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 1
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">
                        先准备素材，再进入仿写
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-slate-400">
                      本页只支持基于素材仿写，不支持无素材直接生成。
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={batchGenerateState === "running"}
                      onClick={() => setRewriteComposerMode("single")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        rewriteComposerMode === "single"
                          ? "bg-slate-900 text-white"
                          : "border border-black/10 bg-white text-slate-600"
                      }`}
                    >
                      单篇仿写
                    </button>
                    <button
                      type="button"
                      disabled={batchGenerateState === "running"}
                      onClick={() => setRewriteComposerMode("batch")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        rewriteComposerMode === "batch"
                          ? "bg-slate-900 text-white"
                          : "border border-black/10 bg-white text-slate-600"
                      }`}
                    >
                      批量仿写
                    </button>
                  </div>

                  {isBatchComposerMode ? (
                    <>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        批量模式第一版固定为“多篇素材到多篇公众号仿写”。当前先完成素材准备层，不会一次性切到多平台。
                      </p>
                      <BatchRewritePanel
                        items={batchRewriteItems}
                        isParsingFiles={isParsingBatchFiles}
                        isRunning={batchGenerateState === "running"}
                        message={batchRewriteSelectionMessage}
                        onBrowseFiles={() =>
                          batchRewriteFileInputRef.current?.click()
                        }
                        onRemoveItem={removeBatchRewriteItem}
                        onOpenResult={openBatchRewriteResult}
                      />
                      <input
                        ref={batchRewriteFileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => {
                          void handleBatchRewriteFilesChange(event);
                        }}
                        className="hidden"
                      />
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        先上传原文或素材，再选择提示词预设。系统会自动带入该预设的 prompt 和绑定语料摘要开始仿写。
                      </p>

                      <ArticleSourcePanel
                        source={rewriteSource}
                        mode={articleSourceMode}
                        pasteText={pastedSourceText}
                        isParsingFile={isParsingRewriteFile}
                        errorMessage={rewriteSourceError}
                        noticeMessage={rewriteSourceNotice}
                        onModeChange={handleArticleSourceModeChange}
                        onPasteTextChange={setPastedSourceText}
                        onApplyPaste={handleApplyPastedSource}
                        onBrowseFile={() => rewriteFileInputRef.current?.click()}
                        onReplace={handleReplaceRewriteSource}
                        onClear={clearRewriteSource}
                      />
                      <input
                        ref={rewriteFileInputRef}
                        type="file"
                        accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => {
                          void handleRewriteFileChange(event);
                        }}
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                <div className="rounded-[34px] border border-slate-200 bg-white/94 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 2
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">
                        选择输出平台和提示词预设
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-slate-500">
                      先选平台，再为当前已选平台明确指定要使用的提示词预设。
                    </p>
                  </div>

                  {isBatchComposerMode ? (
                    <div className="mt-4 rounded-[24px] border border-slate-900 bg-slate-900 px-4 py-4 text-sm font-medium text-white shadow-[0_18px_36px_rgba(15,23,42,0.22)]">
                      批量模式第一版固定生成公众号文章
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {PLATFORM_OPTIONS.map((platform) => {
                        const selected = selectedPlatforms.includes(platform.value);

                        return (
                          <button
                            key={platform.value}
                            type="button"
                            onClick={() =>
                              setSelectedPlatforms((current) =>
                                current.includes(platform.value)
                                  ? current.filter((item) => item !== platform.value)
                                  : [...current, platform.value],
                              )
                            }
                            className={`flex items-center justify-between rounded-[24px] border px-4 py-4 text-left text-sm font-medium transition ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_36px_rgba(15,23,42,0.22)]"
                                : "border-black/10 bg-stone-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                            }`}
                          >
                            <span>{platform.label}</span>
                            <span
                              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                selected
                                  ? "bg-white/18 text-white"
                                  : "border border-black/10 bg-white text-slate-400"
                              }`}
                            >
                              {selected ? "已选" : "+"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <PromptPresetSelector
                    selectedPlatforms={composerSelectedPlatforms}
                    presetGroups={promptPresetGroups}
                    selectedPresetIds={selectedPromptPresetByPlatform}
                    disabled={batchGenerateState === "running"}
                    onChange={(platform, presetId) =>
                      setSelectedPromptPresetByPlatform((current) => ({
                        ...current,
                        [platform]: presetId,
                      }))
                    }
                  />

                  {composerSelectedPlatforms.includes("wechat_article") ? (
                    <div className="mt-4 rounded-[24px] border border-black/8 bg-white/92 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                            公众号成稿模式
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-500">
                            开启后会在公众号初稿生成后，按系统默认规则进入一次成稿整理。当前内部目标区间为正文 1100-1200 字，用于更保守地收束段落和章节结构。
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setWechatFinalizationEnabled((current) => !current)
                          }
                          disabled={batchGenerateState === "running"}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                            wechatFinalizationEnabled
                              ? "bg-slate-900 text-white"
                              : "border border-black/10 bg-white text-slate-600"
                          } ${
                            batchGenerateState === "running"
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          <span>公众号成稿模式</span>
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-inherit">
                            {wechatFinalizationEnabled ? "开" : "关"}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,240,233,0.96))] p-5 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 3
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        开始仿写并进入工作区继续编辑
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        只要素材和提示词预设都准备好，就可以直接开始仿写并进入后续编辑。
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[300px]">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={
                          !hasRequiredRewriteSource ||
                          !hasRequiredPromptPresets ||
                          composerSelectedPlatforms.length === 0 ||
                          (isBatchComposerMode
                            ? executableBatchItems.length === 0 ||
                              batchGenerateState === "running"
                            : generateState === "generating")
                        }
                        className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-base font-semibold transition ${
                          !hasRequiredRewriteSource ||
                          !hasRequiredPromptPresets ||
                          composerSelectedPlatforms.length === 0 ||
                          (isBatchComposerMode
                            ? executableBatchItems.length === 0 ||
                              batchGenerateState === "running"
                            : generateState === "generating")
                            ? "cursor-not-allowed border border-slate-200 bg-stone-200 text-slate-400"
                            : "bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                        }`}
                      >
                        {isBatchComposerMode
                          ? batchGenerateState === "running"
                            ? "批量仿写中..."
                            : "开始批量仿写"
                          : generateState === "generating"
                          ? "仿写中..."
                          : "开始仿写"}
                      </button>
                      <p
                        className={`text-sm ${
                          generateState === "error"
                            ? "text-rose-500"
                            : "text-slate-500"
                        }`}
                      >
                        {isBatchComposerMode
                          ? batchGenerateState === "running"
                            ? `正在顺序生成第 ${batchProgress.currentIndex ?? 1} 篇 / 共 ${batchProgress.total} 篇：${batchProgress.activeFileName ?? "当前素材"}。已成功 ${batchProgress.successCount} 篇，已失败 ${batchProgress.failedCount} 篇。`
                            : batchGenerateState === "completed"
                              ? `本批次执行完成。成功 ${batchProgress.successCount} 篇，失败 ${batchProgress.failedCount} 篇。成功结果已进入现有工作台历史记录。`
                              : "当前阶段已接入顺序逐篇执行。开始后会锁定本批次素材和提示词预设，按公众号单篇链路逐篇仿写。"
                          : generateState === "error"
                          ? generateMessage
                          : generateState === "generating"
                            ? getGeneratePendingMessage(composerSelectedPlatforms)
                          : hasRequiredRewriteSource &&
                              hasRequiredPromptPresets &&
                              composerSelectedPlatforms.length > 0
                            ? getGeneratePendingMessage(composerSelectedPlatforms)
                            : !hasRequiredRewriteSource
                              ? "先上传原文或素材"
                              : !hasRequiredPromptPresets
                                ? "再为已选平台选择提示词预设"
                                : composerSelectedPlatforms.length === 0
                                  ? "再至少选择一个平台"
                                  : "准备开始仿写"
                              }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!hasHistory ? (
                <div className="mt-8 rounded-[28px] border border-dashed border-black/10 bg-stone-50/80 px-5 py-4 text-sm leading-7 text-slate-500">
                  这里很快会出现你的第一条仿写草稿。先上传原文或素材，再选择提示词预设，我们就从第一篇开始。
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4 lg:grid lg:gap-6 lg:space-y-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          {activeRecord ? (
            <div className="sticky top-3 z-20 flex items-center gap-3 rounded-[26px] border border-black/10 bg-white/92 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={openMobileHistoryPanel}
                className="inline-flex shrink-0 items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                草稿箱
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {activeRecord.title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {records.length} 条记录 · {activePlatform ? PLATFORM_LABELS[activePlatform] : "继续编辑"}
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                {saveStatusLabel}
              </span>
            </div>
          ) : null}

          {shouldShowWorkspace && activeRecord && mobileHistoryPanelState === "open" ? (
            <div
              className="fixed inset-0 z-40 bg-slate-950/28 lg:hidden"
              onClick={closeMobileHistoryPanel}
            >
              <div
                className="absolute inset-x-0 top-0 max-h-[85vh] overflow-y-auto rounded-b-[32px] border-b border-black/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.99),_rgba(247,242,234,0.97))] p-4 shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                      History
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      快速切换草稿，继续当前工作区编辑。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeMobileHistoryPanel}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    关闭
                  </button>
                </div>

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索标题或需求"
                  className="mb-4 w-full rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none"
                />

                {historyPanelContent}
              </div>
            </div>
          ) : null}

          <aside className="hidden rounded-[32px] border border-black/10 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:block">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                History
              </p>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索标题或需求"
                className="mt-3 w-full rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm outline-none"
              />
            </div>

            {historyPanelContent}
          </aside>

          {activeRecord ? (
            <div className="rounded-[32px] border border-black/10 bg-white/92 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
              <div
                className={`border-b border-black/8 ${isVideoScriptWorkspace ? "pb-3 sm:pb-4" : "pb-4 sm:pb-5"}`}
              >
                <div className={isVideoScriptWorkspace ? "space-y-3" : "space-y-4"}>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Workspace
                      </p>
                      <h1
                        className={`mt-2 font-semibold text-slate-900 ${isVideoScriptWorkspace ? "text-2xl sm:text-[2rem]" : "text-2xl sm:text-3xl"}`}
                      >
                        {activeRecord.title}
                      </h1>
                    </div>

                    <div className="self-start text-[10px] font-medium text-slate-400 whitespace-nowrap sm:text-[11px]">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300/70" />
                        {saveStatusLabel}
                      </span>
                    </div>
                  </div>

                  <div className={isVideoScriptWorkspace ? "space-y-2.5" : "space-y-3"}>
                    <p
                      className={`max-w-4xl text-sm text-slate-500 ${isVideoScriptWorkspace ? "line-clamp-1 leading-6" : "line-clamp-2 leading-7"}`}
                    >
                      {activeRecord.userPrompt}
                    </p>
                    {activeRecord.selectedPlatforms.length > 1 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeRecord.selectedPlatforms.map((platform) => (
                          <span
                            key={`${platform}-overview`}
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-[11px] ${
                              platform === activePlatform
                                ? "bg-slate-900/88 text-white"
                                : "border border-black/6 bg-stone-100/80 text-slate-500"
                            }`}
                          >
                            {PLATFORM_LABELS[platform]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`flex flex-col ${isVideoScriptWorkspace ? "gap-2.5" : "gap-3"} lg:flex-row lg:items-start lg:justify-between`}
                  >
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:hidden">
                        平台可左右滑动切换
                      </p>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-[linear-gradient(90deg,_rgba(255,255,255,0.96),_rgba(255,255,255,0))] sm:hidden" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-[linear-gradient(270deg,_rgba(255,255,255,0.96),_rgba(255,255,255,0))] sm:hidden" />
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                          {activeRecord.selectedPlatforms.map((platform) => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => setActivePlatform(platform)}
                              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                                platform === activePlatform
                                  ? "bg-slate-900 text-white"
                                  : "border border-black/10 bg-stone-100 text-slate-700"
                              }`}
                            >
                              {PLATFORM_LABELS[platform]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:hidden">
                        操作区可左右滑动
                      </p>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-[linear-gradient(90deg,_rgba(255,255,255,0.96),_rgba(255,255,255,0))] sm:hidden" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-[linear-gradient(270deg,_rgba(255,255,255,0.96),_rgba(255,255,255,0))] sm:hidden" />
                        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0">
                          <button
                            type="button"
                            onClick={handleEditFocus}
                            className="h-10 shrink-0 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-slate-700 whitespace-nowrap"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="h-10 shrink-0 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-slate-700 whitespace-nowrap"
                          >
                            复制
                          </button>
                          {publishEnabled ? (
                            <button
                              type="button"
                              onClick={handlePublish}
                              className="h-10 shrink-0 rounded-full bg-amber-500 px-4 text-sm font-semibold text-slate-950 whitespace-nowrap"
                            >
                              发布
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 sm:mt-6">
                <ContentTracePanel summary={traceSummary} />
              </div>

              <div className="mt-5 sm:mt-6">
                <div ref={editorFocusRef}>
                  {activePlatform === "wechat_article" &&
                  currentPlatformContent?.platform === "wechat_article" ? (
                    <WechatEditor
                      content={currentPlatformContent}
                      generation={activeRecord?.generation}
                      onGenerateCoverImage={handleGenerateWechatCoverImage}
                      onChange={(content) =>
                        updateActiveContent((current) => ({
                          ...current,
                          wechat_article: content,
                        }))
                      }
                    />
                  ) : null}

                  {activePlatform === "xiaohongshu" &&
                  currentPlatformContent?.platform === "xiaohongshu" ? (
                    <XiaohongshuEditor
                      content={currentPlatformContent}
                      onChange={(content) =>
                        updateActiveContent((current) => ({
                          ...current,
                          xiaohongshu: content,
                        }))
                      }
                      onGenerateImage={handleGenerateXiaohongshuImage}
                    />
                  ) : null}

                  {activePlatform === "twitter" &&
                  currentPlatformContent?.platform === "twitter" ? (
                    <TwitterEditor
                      content={currentPlatformContent}
                      onChange={(content) =>
                        updateActiveContent((current) => ({
                          ...current,
                          twitter: content,
                        }))
                      }
                    />
                  ) : null}

                  {activePlatform === "video_script" &&
                  currentPlatformContent?.platform === "video_script" ? (
                    <VideoScriptEditor
                      content={currentPlatformContent}
                      onChange={(content) =>
                        updateActiveContent((current) => ({
                          ...current,
                          video_script: content,
                        }))
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}

function getGenerationSuccessMessage(
  generatedPlatforms: PlatformType[],
  mockPlatforms: PlatformType[],
) {
  if (generatedPlatforms.length === 0) {
    return `当前阶段所选平台仍为模拟草稿。`;
  }

  if (mockPlatforms.length === 0) {
    return `已使用真实 AI 生成${formatPlatformNames(generatedPlatforms)}草稿。`;
  }

  return `已使用真实 AI 生成${formatPlatformNames(generatedPlatforms)}草稿，${formatPlatformNames(mockPlatforms)}仍为模拟草稿。`;
}

function formatPlatformNames(platforms: PlatformType[]) {
  return platforms.map((platform) => PLATFORM_LABELS[platform]).join("、");
}

function formatPlatformContent(record: HistoryRecord, platform: PlatformType) {
  if (platform === "wechat_article" && record.content.wechat_article) {
    return [
      record.content.wechat_article.title,
      ...record.content.wechat_article.blocks.map((block) => {
        if (block.type === "divider") {
          return "---";
        }

        if (block.type === "list") {
          return block.items.map((item) => `- ${item}`).join("\n");
        }

        return block.text;
      }),
    ].join("\n\n");
  }

  if (platform === "xiaohongshu" && record.content.xiaohongshu) {
    return [
      record.content.xiaohongshu.title,
      record.content.xiaohongshu.caption,
      record.content.xiaohongshu.tags.map((tag) => `#${tag}`).join(" "),
    ].join("\n\n");
  }

  if (platform === "twitter" && record.content.twitter) {
    return record.content.twitter.mode === "single"
      ? record.content.twitter.singleDraft
      : record.content.twitter.threadDraft.join("\n\n");
  }

  if (platform === "video_script" && record.content.video_script) {
    return [
      record.content.video_script.title,
      ...record.content.video_script.scenes.map(
        (scene, index) =>
          `Scene ${index + 1}\n镜头：${scene.shot}\n旁白：${scene.voiceover}`,
      ),
    ].join("\n\n");
  }

  return "";
}
