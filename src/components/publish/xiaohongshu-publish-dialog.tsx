"use client";

import { useMemo, useState } from "react";

import {
  buildXiaohongshuPublishErrorMessage,
  PublishRequestError,
  requestXiaohongshuPublish,
} from "@/lib/publish/publish-client";
import type { XiaohongshuPublishResponse } from "@/lib/publish/types";
import {
  buildXiaohongshuPublishPreviewChecks,
  createXiaohongshuPublishSnapshot,
} from "@/lib/publish/xiaohongshu-publish-ui";
import type { HistoryRecord } from "@/lib/types/history";

type XiaohongshuPublishDialogProps = {
  open: boolean;
  record: HistoryRecord | null;
  onClose: () => void;
  onSuccess: (result: XiaohongshuPublishResponse) => void;
};

export function XiaohongshuPublishDialog({
  open,
  record,
  onClose,
  onSuccess,
}: XiaohongshuPublishDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => (record ? buildXiaohongshuPublishPreviewChecks(record) : null),
    [record],
  );

  if (!open || !record) {
    return null;
  }

  async function handleSubmit() {
    if (!record || !preview?.ready) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await requestXiaohongshuPublish(fetch, {
        snapshot: createXiaohongshuPublishSnapshot(record),
      });

      onSuccess(result);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof PublishRequestError
          ? buildXiaohongshuPublishErrorMessage(error)
          : "小红书发布失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/32 p-4">
      <div className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Xiaohongshu Publish
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              发布到小红书
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              首版会先生成手机扫码链接。本地 localhost 只能验证二维码流程，不完全代表生产环境图片抓取成功。
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

          {errorMessage ? (
            <p className="mt-4 text-sm leading-6 text-rose-500">{errorMessage}</p>
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
              disabled={submitting || !preview?.ready}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                submitting || !preview?.ready
                  ? "cursor-not-allowed bg-stone-200 text-slate-500"
                  : "bg-slate-900 text-white"
              }`}
            >
              {submitting ? "发布中..." : "生成发布二维码"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
