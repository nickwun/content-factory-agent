import Link from "next/link";
import type { ReactNode } from "react";

export const APP_SHELL_NAV_BUTTON_CLASS =
  "inline-flex h-14 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/10 bg-white/75 px-6 text-[15px] font-medium text-slate-700 transition hover:border-slate-300";

export const APP_SHELL_NAV_BUTTON_DISABLED_CLASS =
  `${APP_SHELL_NAV_BUTTON_CLASS} cursor-not-allowed opacity-45 hover:border-black/10`;

type AppShellProps = {
  currentPath: "/" | "/settings";
  actions?: ReactNode;
  rightNavLabel?: string;
  rightNavHref?: string;
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
            className={APP_SHELL_NAV_BUTTON_CLASS}
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
