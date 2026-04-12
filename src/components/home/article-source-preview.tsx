"use client";

import type { RewriteSource } from "@/lib/rewrite/rewrite-source";
import { buildArticleSourceSummary } from "@/lib/rewrite/article-source-ui";

type ArticleSourcePreviewProps = {
  source: RewriteSource;
  notice?: string | null;
  onReplace: () => void;
  onClear: () => void;
};

export function ArticleSourcePreview({
  source,
  notice,
  onReplace,
  onClear,
}: ArticleSourcePreviewProps) {
  const summary = buildArticleSourceSummary(source);

  return (
    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {summary.kindLabel}
            </span>
            <span className="text-xs text-slate-500">{summary.charCountLabel}</span>
          </div>
          <p className="mt-2 truncate text-sm font-medium text-slate-900">
            {summary.sourceLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onReplace}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-slate-600"
          >
            替换
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-slate-600"
          >
            清空
          </button>
        </div>
      </div>

      {notice ? (
        <p className="mt-3 text-xs leading-6 text-amber-700">{notice}</p>
      ) : null}
    </div>
  );
}
