"use client";

type PublishQrDialogProps = {
  open: boolean;
  publishUrl: string;
  qrcodeUrl: string;
  onClose: () => void;
};

export function PublishQrDialog({
  open,
  publishUrl,
  qrcodeUrl,
  onClose,
}: PublishQrDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/38 p-4">
      <div className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Publish QR
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              请使用手机继续发布
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              扫码后在小红书 App 中继续完成发布。
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

        <div className="mt-6 rounded-[28px] border border-black/8 bg-stone-50/80 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrcodeUrl}
            alt="小红书发布二维码"
            className="mx-auto h-56 w-56 rounded-2xl border border-black/6 bg-white object-contain"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(publishUrl)}
            className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            复制链接
          </button>
          <button
            type="button"
            onClick={() => window.open(publishUrl, "_blank", "noopener,noreferrer")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            新窗口打开
          </button>
        </div>
      </div>
    </div>
  );
}
