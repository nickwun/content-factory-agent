"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PublishQrDialog } from "@/components/publish/publish-qr-dialog";
import { WechatPublishDialog } from "@/components/publish/wechat-publish-dialog";
import { XiaohongshuPublishDialog } from "@/components/publish/xiaohongshu-publish-dialog";
import { WechatEditor } from "@/components/workspace/platform-editors/wechat-editor";
import { XiaohongshuEditor } from "@/components/workspace/platform-editors/xiaohongshu-editor";
import { TwitterEditor } from "@/components/workspace/platform-editors/twitter-editor";
import { VideoScriptEditor } from "@/components/workspace/platform-editors/video-script-editor";
import {
  buildGenerateImageErrorMessage,
  GenerateImageRequestError,
  requestGeneratedImage,
} from "@/lib/generation/generate-image-client";
import {
  buildGenerateErrorMessage,
  GenerateRequestError,
  getGeneratePendingMessage,
  requestGeneratedDraft,
} from "@/lib/generation/generate-client";
import type { DraftGenerationInfo, GeneratedDraftResult } from "@/lib/generation/generation-service";
import type { XiaohongshuPublishResponse } from "@/lib/publish/types";
import type { PlatformPromptSetting } from "@/lib/settings/prompt-settings-types";
import type { HistoryRecord } from "@/lib/types/history";
import type { PlatformType } from "@/lib/types/platform";
import {
  failXiaohongshuImageGeneration,
  finishXiaohongshuImageGeneration,
  startXiaohongshuImageGeneration,
} from "@/lib/workspace/xiaohongshu-images";
import {
  resolveHomeScreenMode,
  resolveMobileHistoryPanelState,
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

export function ContentAgentHome() {
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
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([]);
  const [generateState, setGenerateState] = useState<
    "idle" | "generating" | "error"
  >("idle");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [wechatPublishDialogOpen, setWechatPublishDialogOpen] = useState(false);
  const [xiaohongshuPublishDialogOpen, setXiaohongshuPublishDialogOpen] =
    useState(false);
  const [publishQrDialog, setPublishQrDialog] =
    useState<XiaohongshuPublishResponse | null>(null);
  const [mobileHistoryPanelState, setMobileHistoryPanelState] = useState<
    "closed" | "open"
  >("closed");
  const editorFocusRef = useRef<HTMLDivElement | null>(null);

  const hasHistory = records.length > 0;
  const resolvedScreenMode = resolveHomeScreenMode({
    screenMode,
    loaded,
    hasActiveRecord: Boolean(activeRecord),
    composerPinned,
  });
  const shouldShowWorkspace =
    resolvedScreenMode === "workspace" && Boolean(activeRecord && loaded);

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
    if (!userPrompt.trim() || selectedPlatforms.length === 0) {
      return;
    }

    setGenerateState("generating");
    setGenerateMessage(null);

    try {
      const data = (await requestGeneratedDraft(fetch, {
        userPrompt,
        selectedPlatforms,
      })) as {
        draft: GeneratedDraftResult;
        promptSettings: PlatformPromptSetting[];
      };

      const now = new Date().toISOString();
      const nextRecord = createHistoryRecord({
        userPrompt,
        selectedPlatforms,
        now,
        autoTitle: data.draft.autoTitle,
        content: data.draft.content,
        promptSettings: data.promptSettings,
        generationInfo: data.draft.generationInfo,
      });

      await createRecord(nextRecord);
      setComposerPinned(false);
      setScreenMode("workspace");
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
          ? buildGenerateErrorMessage(error, selectedPlatforms)
          : "本次生成失败，请稍后重试。",
      );
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

  function startNewDraft() {
    setComposerPinned(true);
    setScreenMode("composer");
    setUserPrompt("");
    setSelectedPlatforms([]);
    setGenerateState("idle");
    setGenerateMessage(null);
    resetRenameState();
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
      currentPath="/"
      actions={
        shouldShowWorkspace ? (
          <button
            type="button"
            onClick={startNewDraft}
            className="rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            新建内容
          </button>
        ) : null
      }
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
        onSuccess={(result) => {
          setToast(result.message || "公众号文章已提交到草稿箱");
        }}
      />
      <XiaohongshuPublishDialog
        open={xiaohongshuPublishDialogOpen}
        record={activeRecord ?? null}
        onClose={() => setXiaohongshuPublishDialogOpen(false)}
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

      {!shouldShowWorkspace ? (
        <section className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
          <div className="w-full max-w-5xl rounded-[40px] border border-black/10 bg-white/88 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-600">
                Phase 1 Prototype
              </p>
              <h1 className="mt-3 max-w-3xl text-[2.6rem] font-semibold tracking-tight text-slate-900 md:text-[3rem] md:leading-[1.1]">
                一次输入，生成四种平台内容草稿
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-8 text-slate-600">
                把你想写的主题、目标受众、风格和用途告诉系统，再选择目标平台，
                它会为你生成可继续编辑的多平台草稿。
              </p>

              <div className="mt-8 space-y-5">
                <div className="rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(247,242,234,0.95))] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 1
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">
                        输入你的创作需求
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-slate-400">
                      主题、受众、风格、用途都可以直接写进需求里
                    </p>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    可以直接写一句需求，也可以补充平台语气、适用场景和期望长度。
                  </p>

                  <textarea
                    value={userPrompt}
                    onChange={(event) => setUserPrompt(event.target.value)}
                    placeholder={
                      "例如：写一篇关于如何提高工作效率的内容，面向 25-35 岁职场人，语气专业但不生硬，同时生成公众号长文、小红书笔记和 Twitter thread。"
                    }
                    className="mt-4 min-h-64 w-full resize-y rounded-[30px] border border-slate-200 bg-white px-6 py-5 text-lg leading-8 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-300 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                </div>

                <div className="rounded-[34px] border border-slate-200 bg-white/94 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 2
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">
                        选择要生成的平台
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-slate-500">
                      可多选，系统会同时生成对应平台草稿。
                    </p>
                  </div>

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
                </div>

                <div className="rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,240,233,0.96))] p-5 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                        Step 3
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        生成多平台内容草稿
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        满足条件后，系统会立即进入双栏工作区，并把本次生成保存进草稿箱。
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[300px]">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={
                          !userPrompt.trim() ||
                          selectedPlatforms.length === 0 ||
                          generateState === "generating"
                        }
                        className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-base font-semibold transition ${
                          !userPrompt.trim() ||
                          selectedPlatforms.length === 0 ||
                          generateState === "generating"
                            ? "cursor-not-allowed border border-slate-200 bg-stone-200 text-slate-400"
                            : "bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800"
                        }`}
                      >
                        {generateState === "generating"
                          ? "生成中..."
                          : "生成内容"}
                      </button>
                      <p
                        className={`text-sm ${
                          generateState === "error"
                            ? "text-rose-500"
                            : "text-slate-500"
                        }`}
                      >
                        {generateState === "error"
                          ? generateMessage
                          : generateState === "generating"
                            ? getGeneratePendingMessage(selectedPlatforms)
                          : userPrompt.trim() && selectedPlatforms.length > 0
                            ? getGeneratePendingMessage(selectedPlatforms)
                            : !userPrompt.trim()
                              ? "先输入需求内容"
                              : "再至少选择一个平台即可生成"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!hasHistory ? (
                <div className="mt-8 rounded-[28px] border border-dashed border-black/10 bg-stone-50/80 px-5 py-4 text-sm leading-7 text-slate-500">
                  这里很快会出现你的第一条草稿。先写下一个主题，我们就从它开始。
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
                <div ref={editorFocusRef}>
                  {activePlatform === "wechat_article" &&
                  currentPlatformContent?.platform === "wechat_article" ? (
                    <WechatEditor
                      content={currentPlatformContent}
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

function createHistoryRecord(input: {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  now: string;
  autoTitle: string;
  content: HistoryRecord["content"];
  promptSettings: PlatformPromptSetting[];
  generationInfo: DraftGenerationInfo;
}): HistoryRecord {
  const settingsByPlatform = Object.fromEntries(
    input.promptSettings.map((setting) => [setting.platform, setting]),
  );

  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    autoTitle: input.autoTitle,
    title: input.autoTitle,
    isCustomTitle: false,
    userPrompt: input.userPrompt,
    selectedPlatforms: input.selectedPlatforms,
    createdAt: input.now,
    updatedAt: input.now,
    generation: {
      generatorVersion: input.generationInfo.generatorVersion,
      modelProvider: input.generationInfo.modelProvider,
      modelName: input.generationInfo.modelName,
      generatedAt: input.now,
      selectedPlatformsSnapshot: input.selectedPlatforms,
      promptSnapshotByPlatform: Object.fromEntries(
        input.selectedPlatforms.map((platform) => [
          platform,
          settingsByPlatform[platform]?.promptTemplate ?? "",
        ]),
      ),
      settingsVersionByPlatform: Object.fromEntries(
        input.selectedPlatforms
          .filter((platform) => settingsByPlatform[platform]?.version)
          .map((platform) => [platform, settingsByPlatform[platform]?.version]),
      ),
    },
    content: input.content,
    workspace: {
      activePlatform: input.selectedPlatforms[0] ?? "wechat_article",
      platformOrder: input.selectedPlatforms,
      lastViewedAt: input.now,
    },
  };
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
