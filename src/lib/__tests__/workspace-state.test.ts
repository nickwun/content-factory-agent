import test from "node:test";
import assert from "node:assert/strict";

import {
  getVisibleSaveState,
  resolveMobileHistoryPanelState,
  resolveHomeScreenMode,
  resolveRequestedHomeScreenMode,
} from "../workspace/workspace-state.ts";

test("resolveHomeScreenMode keeps composer open when user explicitly starts a new draft", () => {
  assert.equal(
    resolveHomeScreenMode({
      screenMode: "composer",
      loaded: true,
      hasActiveRecord: true,
      composerPinned: true,
    }),
    "composer",
  );
});

test("resolveHomeScreenMode auto-opens workspace only when composer is not pinned", () => {
  assert.equal(
    resolveHomeScreenMode({
      screenMode: "composer",
      loaded: true,
      hasActiveRecord: true,
      composerPinned: false,
    }),
    "workspace",
  );
});

test("resolveHomeScreenMode falls back to composer when no active record remains", () => {
  assert.equal(
    resolveHomeScreenMode({
      screenMode: "workspace",
      loaded: true,
      hasActiveRecord: false,
      composerPinned: false,
    }),
    "composer",
  );
});

test("getVisibleSaveState only surfaces dirty and saving states for edit changes", () => {
  assert.equal(getVisibleSaveState("saved", "view", "queued"), "saved");
  assert.equal(getVisibleSaveState("saved", "view", "saving"), "saved");
  assert.equal(getVisibleSaveState("saved", "edit", "queued"), "dirty");
  assert.equal(getVisibleSaveState("saved", "edit", "saving"), "saving");
  assert.equal(getVisibleSaveState("saving", "edit", "saved"), "saved");
  assert.equal(getVisibleSaveState("saving", "edit", "error"), "error");
});

test("resolveMobileHistoryPanelState opens and closes when the user toggles the history drawer", () => {
  assert.equal(resolveMobileHistoryPanelState("closed", "open"), "open");
  assert.equal(resolveMobileHistoryPanelState("open", "close"), "closed");
});

test("resolveMobileHistoryPanelState closes after a record is selected", () => {
  assert.equal(resolveMobileHistoryPanelState("open", "select_record"), "closed");
});

test("resolveMobileHistoryPanelState falls back to closed when workspace context disappears", () => {
  assert.equal(resolveMobileHistoryPanelState("open", "no_active_record"), "closed");
});

test("resolveRequestedHomeScreenMode accepts supported query values", () => {
  assert.equal(resolveRequestedHomeScreenMode("composer"), "composer");
  assert.equal(resolveRequestedHomeScreenMode("workspace"), "workspace");
});

test("resolveRequestedHomeScreenMode ignores unsupported query values", () => {
  assert.equal(resolveRequestedHomeScreenMode("other"), null);
  assert.equal(resolveRequestedHomeScreenMode(""), null);
  assert.equal(resolveRequestedHomeScreenMode(undefined), null);
});
