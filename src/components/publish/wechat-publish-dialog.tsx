"use client";

import { useEffect, useMemo, useState } from "react";

import {
  createPublishFailedEvent,
  createPublishPartiallySucceededEvent,
  createPublishStartedEvent,
  createPublishSucceededEvent,
  createRunId,
  createExecutionEventStore,
} from "@/lib/observability/execution-event-store";
import {
  createFailedPublishResult,
  normalizeFeishuPublishResult,
  normalizeWechatPublishResult,
  resolveWechatPublishDestination,
} from "@/lib/observability/publish-observability";
import { createPublishResultStore } from "@/lib/observability/publish-result-store";
import {
  buildFeishuPublishErrorMessage,
  buildWechatPublishErrorMessage,
  PublishRequestError,
  requestFeishuPublish,
  requestWechatArticlePublish,
  requestWechatPublishAccounts,
} from "@/lib/publish/publish-client";
import type {
  FeishuPublishResponse,
  WechatPublishAccount,
  WechatPublishResponse,
} from "@/lib/publish/types";
import {
  buildFeishuPublishPreviewChecks,
  createFeishuPublishSnapshot,
} from "@/lib/publish/feishu-publish-ui";
import {
  buildWechatPublishPreviewChecks,
  createWechatPublishSnapshot,
  getWechatPublishTypeAvailability,
} from "@/lib/publish/wechat-publish-ui";
import type { HistoryRecord } from "@/lib/types/history";

type WechatPublishDialogProps = {
  open: boolean;
  record: HistoryRecord | null;
  onClose: () => void;
  onWechatSuccess: (result: WechatPublishResponse) => void;
  onFeishuSuccess: (result: FeishuPublishResponse) => void;
  onPublishRecorded?: () => void;
};

export function WechatPublishDialog({
  open,
  record,
  onClose,
  onWechatSuccess,
  onFeishuSuccess,
  onPublishRecorded,
}: WechatPublishDialogProps) {
  const [accounts, setAccounts] = useState<WechatPublishAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [publishType, setPublishType] = useState<"article" | "xiaolvshu">("article");
  const [publishTarget, setPublishTarget] = useState<"wechat" | "feishu">("wechat");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wechatPreview = useMemo(
    () => (record ? buildWechatPublishPreviewChecks(record) : null),
    [record],
  );
  const feishuPreview = useMemo(
    () => (record ? buildFeishuPublishPreviewChecks(record) : null),
    [record],
  );
  const executionEventStore = useMemo(() => createExecutionEventStore(), []);
  const publishResultStore = useMemo(() => createPublishResultStore(), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPublishTarget("wechat");
    setErrorMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open || !record || publishTarget !== "wechat") {
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      setLoadingAccounts(true);
      setErrorMessage(null);

      try {
        const nextAccounts = await requestWechatPublishAccounts(fetch);

        if (cancelled) {
          return;
        }

        setAccounts(nextAccounts);
        setSelectedAccountId(
          nextAccounts.find((account) => account.status === "active")?.accountId ?? "",
        );
        setPublishType("article");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof PublishRequestError
            ? buildWechatPublishErrorMessage(error)
            : "公众号账号列表加载失败，请稍后重试。",
        );
      } finally {
        if (!cancelled) {
          setLoadingAccounts(false);
        }
      }
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [open, publishTarget, record]);

  if (!open || !record) {
    return null;
  }

  const selectedAccount = accounts.find(
    (account) => account.accountId === selectedAccountId,
  );
  const publishTypeOptions = getWechatPublishTypeAvailability(
    record,
    selectedAccount,
  );
  const selectedPublishTypeOption = publishTypeOptions.find(
    (option) => option.value === publishType,
  );
  const activePreview = publishTarget === "feishu" ? feishuPreview : wechatPreview;
  const canSubmit =
    publishTarget === "feishu"
      ? Boolean(activePreview?.ready) && !submitting
      : !submitting &&
        !loadingAccounts &&
        Boolean(activePreview?.ready) &&
        Boolean(selectedAccountId) &&
        Boolean(selectedPublishTypeOption?.enabled);

  async function handleSubmit() {
    if (!record || !activePreview?.ready) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    if (publishTarget !== "feishu" && (!selectedAccountId || !selectedPublishTypeOption?.enabled)) {
      setSubmitting(false);
      return;
    }

    const runId = createRunId("publish");
    const publishResultId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const destination =
      publishTarget === "feishu"
        ? "feishu_doc"
        : resolveWechatPublishDestination(publishType);

    try {
      await executionEventStore.append(
        createPublishStartedEvent({
          runId,
          publishResultId,
          destination,
          createdAt: startedAt,
        }),
      );
    } catch {
      // Keep publish usable even if observability persistence fails.
    }

    try {
      if (publishTarget === "feishu") {
        const result = await requestFeishuPublish(fetch, {
          snapshot: createFeishuPublishSnapshot(record),
        });

        const normalizedResult = normalizeFeishuPublishResult({
          publishResultId,
          runId,
          recordId: record.id,
          response: result,
          createdAt: new Date().toISOString(),
        });

        try {
          await publishResultStore.append(normalizedResult);
          await executionEventStore.append(
            result.coverSyncStatus === "failed"
              ? createPublishPartiallySucceededEvent({
                  runId,
                  publishResultId,
                  destination: "feishu_doc",
                  createdAt: normalizedResult.createdAt,
                  coverSyncStatus: result.coverSyncStatus,
                  message: normalizedResult.message,
                })
              : createPublishSucceededEvent({
                  runId,
                  publishResultId,
                  destination: "feishu_doc",
                  createdAt: normalizedResult.createdAt,
                }),
          );
        } catch {
          // Keep publish usable even if observability persistence fails.
        }

        onFeishuSuccess(result);
      } else {
        if (!selectedAccountId || !selectedPublishTypeOption?.enabled) {
          return;
        }

        const result = await requestWechatArticlePublish(fetch, {
          accountId: selectedAccountId,
          publishType,
          snapshot: createWechatPublishSnapshot(record),
        });

        const normalizedResult = normalizeWechatPublishResult({
          publishResultId,
          runId,
          recordId: record.id,
          publishType,
          response: result,
          createdAt: new Date().toISOString(),
        });

        try {
          await publishResultStore.append(normalizedResult);
          await executionEventStore.append(
            createPublishSucceededEvent({
              runId,
              publishResultId,
              destination: normalizedResult.destination,
              createdAt: normalizedResult.createdAt,
            }),
          );
        } catch {
          // Keep publish usable even if observability persistence fails.
        }

        onWechatSuccess(result);
      }

      onClose();
    } catch (error) {
      const nextErrorMessage =
        publishTarget === "feishu"
          ? error instanceof PublishRequestError
            ? buildFeishuPublishErrorMessage(error)
            : "飞书文档发布失败，请稍后重试。"
          : error instanceof PublishRequestError
            ? buildWechatPublishErrorMessage(error)
            : "公众号发布失败，请稍后重试。";

      setErrorMessage(nextErrorMessage);

      try {
        const failedResult = createFailedPublishResult({
          publishResultId,
          runId,
          recordId: record.id,
          destination,
          createdAt: new Date().toISOString(),
          errorCode:
            error instanceof PublishRequestError ? error.code : undefined,
          errorMessage: nextErrorMessage,
        });

        await publishResultStore.append(failedResult);
        await executionEventStore.append(
          createPublishFailedEvent({
            runId,
            publishResultId,
            destination,
            createdAt: failedResult.createdAt,
            errorCode:
              error instanceof PublishRequestError ? error.code : undefined,
            message: nextErrorMessage,
          }),
        );
      } catch {
        // Keep publish usable even if observability persistence fails.
      }
    } finally {
      setSubmitting(false);
      onPublishRecorded?.();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/32 p-4">
      <div className="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Content Publish
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {publishTarget === "feishu" ? "发布到飞书文档" : "发布到公众号草稿箱"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {publishTarget === "feishu"
                ? "首版会创建新的飞书文档，正文优先取当前 markdownBody；如果已有头图，会尝试按头图、标题、正文顺序同步。"
                : "普通文章使用当前公众号长文内容；小绿书模式优先使用当前记录里的小红书文案与图片。"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-w-[88px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
              <p className="text-sm font-semibold text-slate-900">发布去向</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    value: "wechat" as const,
                    label: "公众号草稿箱",
                    description: "继续沿用公众号发布凭证，支持普通文章和小绿书模式。",
                  },
                  {
                    value: "feishu" as const,
                    label: "飞书文档",
                    description: "创建新的飞书文档，便于协作、审稿和继续沉淀。",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPublishTarget(option.value);
                      setErrorMessage(null);
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      publishTarget === option.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/8 bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="text-[11px] opacity-75">
                        {publishTarget === option.value ? "当前选择" : "可用"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-6 opacity-80">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {publishTarget === "wechat" ? (
              <>
            <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">目标公众号</p>
                  <p className="mt-1 text-sm text-slate-500">
                    选择当前 API Key 下可发布的公众号账号。
                  </p>
                </div>
                {loadingAccounts ? (
                  <span className="text-xs text-slate-400">加载中...</span>
                ) : null}
              </div>

              <div className="mt-4 space-y-2.5">
                {accounts.map((account) => {
                  const disabled = account.status !== "active";

                  return (
                    <label
                      key={account.accountId}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                        selectedAccountId === account.accountId
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-black/8 bg-white text-slate-700"
                      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
                    >
                      <input
                        type="radio"
                        name="wechat-account"
                        value={account.accountId}
                        disabled={disabled}
                        checked={selectedAccountId === account.accountId}
                        onChange={() => setSelectedAccountId(account.accountId)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {account.nickname}
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          {account.principalName || "未提供主体信息"}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.16em] opacity-70">
                          {account.status === "active"
                            ? "ACTIVE"
                            : account.status === "invalid"
                              ? "INVALID"
                              : "DISABLED"}
                        </p>
                      </div>
                    </label>
                  );
                })}

                {!loadingAccounts && accounts.length === 0 && !errorMessage ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-5 text-sm text-slate-500">
                    当前还没有可选公众号账号。
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
              <p className="text-sm font-semibold text-slate-900">发布类型</p>
              <div className="mt-3 space-y-3">
                {publishTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!option.enabled}
                    onClick={() => setPublishType(option.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      publishType === option.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/8 bg-white text-slate-700"
                    } ${!option.enabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="text-[11px] opacity-75">
                        {option.enabled ? "可用" : "不可用"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-6 opacity-80">
                      {option.description}
                    </p>
                    {!option.enabled && option.reasons.length > 0 ? (
                      <p className="mt-2 text-xs leading-6 text-amber-200">
                        {option.reasons.join(" · ")}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
                <p className="text-sm font-semibold text-slate-900">飞书文档写入方式</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  <p>将基于当前文章标题创建一篇新的飞书文档。</p>
                  <p>正文优先使用当前 markdownBody，如果没有 markdownBody 再回退 blocks。</p>
                  <p>
                    {createFeishuPublishSnapshot(record).coverImageUrl
                      ? "当前记录已检测到头图，会尽量按“头图 → 标题 → 正文”的顺序同步。"
                      : "当前记录未检测到头图，本次将只发布标题与正文。"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
            <p className="text-sm font-semibold text-slate-900">发布预检查</p>
            <div className="mt-4 space-y-2.5">
              {activePreview?.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"
                >
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      item.passed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {item.passed ? "通过" : "未通过"}
                  </span>
                </div>
              ))}
            </div>

            {publishTarget === "wechat" && selectedAccount ? (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                当前将发布到：{selectedAccount.nickname} · {selectedPublishTypeOption?.label}
              </p>
            ) : null}

            {publishTarget === "feishu" ? (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                将创建新的飞书文档，并优先同步当前文章成稿内容。
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-4 text-sm leading-6 text-rose-500">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  !canSubmit
                    ? "cursor-not-allowed bg-stone-200 text-slate-500"
                    : "bg-slate-900 text-white"
                }`}
              >
                {submitting
                  ? "发布中..."
                  : publishTarget === "feishu"
                    ? "发布到飞书文档"
                    : "发布到草稿箱"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
