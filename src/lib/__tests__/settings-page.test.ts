import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const SETTINGS_PAGE_PATH =
  "/Users/hui/Documents/distributing-web/src/app/settings/page.tsx";
const REWRITE_PROFILE_ROUTE_PATH =
  "/Users/hui/Documents/distributing-web/src/app/api/rewrite-profiles/route.ts";

test("settings page only mounts prompt settings as the primary configuration entry", () => {
  const source = readFileSync(SETTINGS_PAGE_PATH, "utf8");

  assert.match(source, /PromptSettingsScreen/);
  assert.doesNotMatch(source, /RewriteProfilesScreen/);
});

test("legacy rewrite profile api entry is removed", () => {
  assert.equal(existsSync(REWRITE_PROFILE_ROUTE_PATH), false);
});
