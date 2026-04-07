import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  currentPath: "/" | "/settings";
  actions?: ReactNode;
  rightNavLabel?: string;
  rightNavHref?: "/" | "/settings";
  children: ReactNode;
};

export function AppShell({
  currentPath,
  actions,
  rightNavLabel,
  rightNavHref,
  children,
}: AppShellProps) {
  const navLabel =
    rightNavLabel ?? (currentPath === "/settings" ? "返回工作台" : "设置");
  const navHref =
    rightNavHref ?? (currentPath === "/settings" ? "/" : "/settings");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,242,232,0.82)_45%,_rgba(235,226,213,0.65))] text-slate-900">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-stone-100">
              CA
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                Content Agent
              </p>
              <p className="text-base font-semibold text-slate-900">
                内容创作与自动分发工作台
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <Link
            href={navHref}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              currentPath === "/settings"
                ? "border-black/10 bg-white/75 text-slate-700 hover:border-slate-300"
                : "border-black/10 bg-white/75 text-slate-700 hover:border-slate-300"
            }`}
          >
            {navLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
