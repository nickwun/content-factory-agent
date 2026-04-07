"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildWechatPublishErrorMessage,
  PublishRequestError,
  requestWechatArticlePublish,
  requestWechatPublishAccounts,
} from "@/lib/publish/publish-client";
import type { WechatPublishAccount, WechatPublishResponse } from "@/lib/publish/types";
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
  onSuccess: (result: WechatPublishResponse) => void;
};

export function WechatPublishDialog({
  open,
  record,
  onClose,
  onSuccess,
}: WechatPublishDialogProps) {
  const [accounts, setAccounts] = useState<WechatPublishAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [publishType, setPublishType] = useState<"article" | "xiaolvshu">("article");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => (record ? buildWechatPublishPreviewChecks(record) : null),
    [record],
  );

  useEffect(() => {
    if (!open || !record) {
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
  }, [open, record]);

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

  async function handleSubmit() {
    if (
      !record ||
      !preview?.ready ||
      !selectedAccountId ||
      !selectedPublishTypeOption?.enabled
    ) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await requestWechatArticlePublish(fetch, {
        accountId: selectedAccountId,
        publishType,
        snapshot: createWechatPublishSnapshot(record),
      });

      onSuccess(result);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof PublishRequestError
          ? buildWechatPublishErrorMessage(error)
          : "公众号发布失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/32 p-4">
      <div className="w-full max-w-3xl rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Wechat Publish
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              发布到公众号草稿箱
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              普通文章使用当前公众号长文内容；小绿书模式优先使用当前记录里的小红书文案与图片。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
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
          </div>

          <div className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4">
            <p className="text-sm font-semibold text-slate-900">发布预检查</p>
            <div className="mt-4 space-y-2.5">
              {preview?.items.map((item) => (
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

            {selectedAccount ? (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                当前将发布到：{selectedAccount.nickname} · {selectedPublishTypeOption?.label}
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
                disabled={
                  submitting ||
                  loadingAccounts ||
                  !preview?.ready ||
                  !selectedAccountId ||
                  !selectedPublishTypeOption?.enabled
                }
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  submitting ||
                  loadingAccounts ||
                  !preview?.ready ||
                  !selectedAccountId ||
                  !selectedPublishTypeOption?.enabled
                    ? "cursor-not-allowed bg-stone-200 text-slate-500"
                    : "bg-slate-900 text-white"
                }`}
              >
                {submitting ? "发布中..." : "发布到草稿箱"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
