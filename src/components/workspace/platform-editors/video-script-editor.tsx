import type { VideoScriptContent } from "@/lib/types/history";
import {
  formatVideoScriptSceneLabel,
  getVideoScriptOverviewSummary,
} from "@/lib/workspace/video-script-editor";

type VideoScriptEditorProps = {
  content: VideoScriptContent;
  onChange: (content: VideoScriptContent) => void;
};

export function VideoScriptEditor({
  content,
  onChange,
}: VideoScriptEditorProps) {
  const overviewSummary = getVideoScriptOverviewSummary(
    content.scenes.length,
    content.duration,
  );

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-black/10 bg-white/88 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Script Overview
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              左侧分镜镜头，右侧旁白台词。适合继续细化成短视频拍摄脚本。
            </p>
          </div>
          <span className="self-start rounded-full border border-black/8 bg-stone-100/90 px-3 py-1 text-[11px] font-medium text-slate-500">
            {overviewSummary}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_176px]">
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              标题
            </span>
            <input
              value={content.title}
              onChange={(event) =>
                onChange({
                  ...content,
                  title: event.target.value,
                })
              }
              className="w-full rounded-[24px] border border-black/10 bg-white px-4 py-3 text-xl font-semibold outline-none transition focus:border-slate-300 focus:bg-white"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              时长
            </span>
            <input
              value={content.duration}
              onChange={(event) =>
                onChange({
                  ...content,
                  duration: event.target.value,
                })
              }
              className="w-full rounded-[24px] border border-black/10 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-slate-300 focus:bg-white"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {content.scenes.map((scene, index) => (
          <article
            key={scene.id}
            className="rounded-[24px] border border-black/10 bg-white/92 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)]"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-900/92 px-2 text-[11px] font-semibold tracking-[0.18em] text-white">
                {String(scene.index ?? index + 1).padStart(2, "0")}
              </span>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
                {formatVideoScriptSceneLabel(scene.index ?? index + 1)}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  分镜镜头
                </p>
                <textarea
                  value={scene.shot}
                  onChange={(event) =>
                    onChange({
                      ...content,
                      scenes: content.scenes.map((item) =>
                        item.id === scene.id
                          ? { ...item, shot: event.target.value }
                          : item,
                      ),
                    })
                  }
                  className="min-h-32 w-full resize-y rounded-[20px] border border-black/10 bg-stone-50/88 px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-slate-300 focus:bg-white"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  旁白台词
                </p>
                <textarea
                  value={scene.voiceover}
                  onChange={(event) =>
                    onChange({
                      ...content,
                      scenes: content.scenes.map((item) =>
                        item.id === scene.id
                          ? { ...item, voiceover: event.target.value }
                          : item,
                      ),
                    })
                  }
                  className="min-h-32 w-full resize-y rounded-[20px] border border-black/10 bg-stone-50/88 px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-slate-300 focus:bg-white"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
