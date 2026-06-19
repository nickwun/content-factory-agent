import { useRef, useState } from "react";

import type { TwitterContent } from "@/lib/types/history";
import {
  getTwitterModeStatusLabel,
  getTwitterThreadOverview,
} from "@/lib/workspace/twitter-thread";

type TwitterEditorProps = {
  content: TwitterContent;
  onChange: (content: TwitterContent) => void;
};

export function TwitterEditor({ content, onChange }: TwitterEditorProps) {
  const [activeThreadIndex, setActiveThreadIndex] = useState(0);
  const tweetRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const modeStatusLabel = getTwitterModeStatusLabel(content);
  const threadOverview = getTwitterThreadOverview(content, activeThreadIndex);
  const currentThreadIndex = threadOverview?.activeIndex ?? 0;

  function jumpToTweet(index: number) {
    setActiveThreadIndex(index);
    const target = tweetRefs.current[index];
    target?.focus();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="space-y-3">
      <div className="rounded-[22px] border border-black/8 bg-white/88 px-4 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {[
              { label: "Single", value: "single" as const },
              { label: "Thread", value: "thread" as const },
            ].map((modeOption) => (
              <button
                key={modeOption.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...content,
                    mode: modeOption.value,
                    userLockedMode: true,
                  })
                }
                className={`h-8 rounded-full px-3 text-sm font-medium transition ${
                  content.mode === modeOption.value
                    ? "bg-slate-900 text-white"
                    : "border border-black/10 bg-stone-50 text-slate-700"
                }`}
              >
                {modeOption.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                content.userLockedMode
                  ? "bg-stone-100 text-slate-600"
                  : "border border-sky-100 bg-sky-50 text-sky-700"
              }`}
            >
              {modeStatusLabel}
            </span>
          </div>
        </div>

        <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
          切换模式不会丢内容，系统会同时保留 single 和 thread 草稿。
        </p>

        {threadOverview ? (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-black/6 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-medium text-slate-500">
              当前共 {threadOverview.count} 条 tweet
            </p>
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
              {threadOverview.items.map((item) => (
                <button
                  key={`overview-${item.label}`}
                  type="button"
                  onClick={() => jumpToTweet(item.index)}
                  className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition ${
                    item.isActive
                      ? "bg-slate-900 text-white shadow-[0_6px_14px_rgba(15,23,42,0.14)]"
                      : "border border-black/8 bg-stone-50 text-slate-500 hover:border-slate-300"
                  }`}
                  aria-label={`跳转到第 ${item.label} 条 tweet`}
                  aria-current={item.isActive ? "true" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {content.mode === "single" ? (
        <textarea
          value={content.singleDraft}
          onChange={(event) =>
            onChange({
              ...content,
              singleDraft: event.target.value,
            })
          }
          className="min-h-56 w-full resize-y rounded-[28px] border border-black/10 bg-white/92 px-5 py-4 text-base leading-7 outline-none shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
        />
      ) : (
        <div className="space-y-2.5">
          {content.threadDraft.map((tweet, index) => (
            <article
              key={`tweet-${index + 1}`}
              className={`rounded-[22px] border bg-white/86 p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.035)] transition ${
                currentThreadIndex === index
                  ? "border-slate-300 bg-white"
                  : "border-black/8"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                    currentThreadIndex === index
                      ? "bg-slate-900 text-white"
                      : "bg-stone-100 text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
              </div>
              <textarea
                ref={(node) => {
                  tweetRefs.current[index] = node;
                }}
                value={tweet}
                onFocus={() => setActiveThreadIndex(index)}
                onChange={(event) =>
                  onChange({
                    ...content,
                    threadDraft: content.threadDraft.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  })
                }
                className="min-h-24 w-full resize-y rounded-[18px] border border-black/8 bg-stone-50/70 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-300 focus:bg-white"
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
