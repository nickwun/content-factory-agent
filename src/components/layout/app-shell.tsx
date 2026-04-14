"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export const APP_SHELL_NAV_BUTTON_CLASS =
  "inline-flex h-14 min-w-[128px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-black/10 bg-white/75 px-6 text-[15px] font-medium text-slate-700 transition hover:border-slate-300";

export const APP_SHELL_NAV_BUTTON_DISABLED_CLASS =
  `${APP_SHELL_NAV_BUTTON_CLASS} cursor-not-allowed opacity-45 hover:border-black/10`;

type AppShellProps = {
  currentCenter: "creative" | "topics";
  currentPath: "/" | "/settings" | "/topics" | "/topics/sources" | "/topics/articles";
  secondaryNavItems?: Array<{
    id: string;
    label: string;
    href: string;
    disabled?: boolean;
    title?: string;
  }>;
  currentSecondaryId?: string;
  syncSecondaryNavWithHash?: boolean;
  showUtilityNav?: boolean;
  actions?: ReactNode;
  rightNavLabel?: string;
  rightNavHref?: string;
  children: ReactNode;
};

export function AppShell({
  currentCenter,
  currentPath,
  secondaryNavItems = [],
  currentSecondaryId,
  syncSecondaryNavWithHash = false,
  showUtilityNav = true,
  actions,
  rightNavLabel,
  rightNavHref,
  children,
}: AppShellProps) {
  const navLabel =
    rightNavLabel
    ?? (currentPath === "/settings"
      ? "返回工作台"
      : currentPath.startsWith("/topics")
        ? "设置"
        : "设置");
  const navHref =
    rightNavHref
    ?? (currentPath === "/settings"
      ? "/"
      : currentPath.startsWith("/topics")
        ? "/settings"
        : "/settings");
  const [hashValue, setHashValue] = useState("");

  useEffect(() => {
    if (!syncSecondaryNavWithHash || typeof window === "undefined") {
      return;
    }

    const handleHashChange = () => {
      setHashValue(window.location.hash);
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [syncSecondaryNavWithHash]);

  const activeSecondaryId = useMemo(() => {
    if (syncSecondaryNavWithHash && hashValue) {
      const matched = secondaryNavItems.find((item) => {
        const hashIndex = item.href.indexOf("#");
        return hashIndex >= 0 && item.href.slice(hashIndex) === hashValue;
      });

      if (matched) {
        return matched.id;
      }
    }

    return currentSecondaryId;
  }, [currentSecondaryId, hashValue, secondaryNavItems, syncSecondaryNavWithHash]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,242,232,0.82)_45%,_rgba(235,226,213,0.65))] text-slate-900">
      <header className="mx-auto w-full max-w-7xl px-6 py-5 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center justify-end gap-3">
          <nav
            aria-label="中心导航"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-2 py-2"
          >
            <Link
              href="/?view=composer"
              aria-current={currentCenter === "creative" ? "page" : undefined}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition ${
                currentCenter === "creative"
                  ? "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              创作中心
            </Link>
            <Link
              href="/topics"
              aria-current={currentCenter === "topics" ? "page" : undefined}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition ${
                currentCenter === "topics"
                  ? "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              选题中心
            </Link>
          </nav>
          {showUtilityNav ? (
            <>
              {actions}
              <Link
                href={navHref}
                className={APP_SHELL_NAV_BUTTON_CLASS}
              >
                {navLabel}
              </Link>
            </>
          ) : null}
        </div>
        </div>

        {secondaryNavItems.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[28px] border border-black/8 bg-white/72 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            {secondaryNavItems.map((item) =>
              item.disabled ? (
                <span
                  key={item.id}
                  title={item.title}
                  aria-disabled="true"
                  className={`${APP_SHELL_NAV_BUTTON_DISABLED_CLASS} min-w-0 px-5 py-2.5 text-sm`}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={activeSecondaryId === item.id ? "page" : undefined}
                  className={`inline-flex h-11 min-w-[112px] items-center justify-center whitespace-nowrap rounded-full border px-5 text-sm font-medium transition ${
                    activeSecondaryId === item.id
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]"
                      : "border-black/10 bg-white/85 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
