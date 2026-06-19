"use client";

import type { RewriteSource } from "@/lib/rewrite/rewrite-source";
import { ArticleSourcePreview } from "./article-source-preview";

type ArticleSourcePanelProps = {
  source: RewriteSource | null;
  mode: "idle" | "paste" | "upload";
  pasteText: string;
  isParsingFile: boolean;
  errorMessage?: string | null;
  noticeMessage?: string | null;
  onModeChange: (mode: "paste" | "upload") => void;
  onPasteTextChange: (value: string) => void;
  onApplyPaste: () => void;
  onBrowseFile: () => void;
  onReplace: () => void;
  onClear: () => void;
};

export function ArticleSourcePanel({
  source,
  mode,
  pasteText,
  isParsingFile,
  errorMessage,
  noticeMessage,
  onModeChange,
  onPasteTextChange,
  onApplyPaste,
  onBrowseFile,
  onReplace,
  onClear,
}: ArticleSourcePanelProps) {
  return (
    <div className="mt-4 rounded-[24px] border border-slate-200 bg-stone-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            可选：上传原文仿写
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            你可以上传文章或直接粘贴原文。系统会提取纯文本，并按当前提示词生成平台草稿。
          </p>
        </div>
      </div>

      {source ? (
        <div className="mt-4">
          <ArticleSourcePreview
            source={source}
            notice={noticeMessage}
            onReplace={onReplace}
            onClear={onClear}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onModeChange("paste")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "paste"
                  ? "bg-slate-900 text-white"
                  : "border border-black/10 bg-white text-slate-600"
              }`}
            >
              直接粘贴文本
            </button>
            <button
              type="button"
              onClick={() => onModeChange("upload")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "upload"
                  ? "bg-slate-900 text-white"
                  : "border border-black/10 bg-white text-slate-600"
              }`}
            >
              上传文件
            </button>
          </div>

          {mode === "paste" ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={pasteText}
                onChange={(event) => onPasteTextChange(event.target.value)}
                placeholder="把原文粘贴到这里。系统会提取纯文本后参与仿写生成。"
                className="min-h-40 w-full rounded-[22px] border border-black/10 bg-white px-4 py-4 text-sm leading-7 outline-none placeholder:text-slate-300 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  当前只支持以纯文本方式参与仿写，不保留复杂版式。
                </p>
                <button
                  type="button"
                  onClick={onApplyPaste}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  加载原文
                </button>
              </div>
            </div>
          ) : null}

          {mode === "upload" ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-black/10 bg-white px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    上传 .txt、.md 或 .docx
                  </p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    文件会先在前端提取纯文本，再随本次生成请求一起提交。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onBrowseFile}
                  disabled={isParsingFile}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isParsingFile
                      ? "cursor-not-allowed border border-black/10 bg-stone-200 text-slate-400"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {isParsingFile ? "解析中..." : "选择文件"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {errorMessage ? (
        <p className="mt-3 text-sm text-rose-500">{errorMessage}</p>
      ) : null}
      {!source && noticeMessage ? (
        <p className="mt-3 text-sm text-amber-700">{noticeMessage}</p>
      ) : null}
    </div>
  );
}
