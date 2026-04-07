import type { EditorSaveState } from "../types/platform.ts";

export type HomeScreenMode = "composer" | "workspace";
export type PersistenceSource = "view" | "edit";
export type PersistencePhase = "queued" | "saving" | "saved" | "error";
export type MobileHistoryPanelState = "closed" | "open";
export type MobileHistoryPanelEvent =
  | "open"
  | "close"
  | "select_record"
  | "no_active_record";

type ResolveHomeScreenModeInput = {
  screenMode: HomeScreenMode;
  loaded: boolean;
  hasActiveRecord: boolean;
  composerPinned: boolean;
};

export function resolveHomeScreenMode({
  screenMode,
  loaded,
  hasActiveRecord,
  composerPinned,
}: ResolveHomeScreenModeInput): HomeScreenMode {
  if (!loaded) {
    return screenMode;
  }

  if (!hasActiveRecord) {
    return "composer";
  }

  if (screenMode === "workspace") {
    return "workspace";
  }

  return composerPinned ? "composer" : "workspace";
}

export function getVisibleSaveState(
  current: EditorSaveState,
  source: PersistenceSource,
  phase: PersistencePhase,
): EditorSaveState {
  if (source === "view") {
    return current;
  }

  if (phase === "queued") {
    return "dirty";
  }

  if (phase === "saving") {
    return "saving";
  }

  if (phase === "saved") {
    return "saved";
  }

  return "error";
}

export function resolveMobileHistoryPanelState(
  current: MobileHistoryPanelState,
  event: MobileHistoryPanelEvent,
): MobileHistoryPanelState {
  if (event === "open") {
    return "open";
  }

  if (event === "close" || event === "select_record" || event === "no_active_record") {
    return "closed";
  }

  return current;
}
