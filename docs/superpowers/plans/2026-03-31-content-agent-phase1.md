# Content Agent Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-phase Next.js + SQLite prototype for multi-platform content generation, editing, local history persistence, and SQLite-backed prompt settings.

**Architecture:** Use a single Next.js App Router app with a client-side history storage adapter, a mock generation service with a normalized generation context, and a server-only SQLite settings layer. Keep editing lightweight and structured so the prototype is stable now and easy to evolve later.

**Tech Stack:** Next.js App Router, TypeScript, React, SQLite, `better-sqlite3`, browser `localStorage`

---

## File Structure

Planned files and responsibilities:

- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/app/actions/prompt-settings.ts`
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/home/generation-form.tsx`
- Create: `src/components/workspace/workspace-screen.tsx`
- Create: `src/components/workspace/history-sidebar.tsx`
- Create: `src/components/workspace/workspace-header.tsx`
- Create: `src/components/workspace/platform-tabs.tsx`
- Create: `src/components/workspace/platform-editors/wechat-editor.tsx`
- Create: `src/components/workspace/platform-editors/xiaohongshu-editor.tsx`
- Create: `src/components/workspace/platform-editors/twitter-editor.tsx`
- Create: `src/components/workspace/platform-editors/video-script-editor.tsx`
- Create: `src/components/settings/prompt-settings-screen.tsx`
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/confirm-dialog.tsx`
- Create: `src/lib/types/platform.ts`
- Create: `src/lib/types/history.ts`
- Create: `src/lib/history/history-storage.ts`
- Create: `src/lib/history/local-history-storage.ts`
- Create: `src/lib/history/history-search.ts`
- Create: `src/lib/generation/generation-context.ts`
- Create: `src/lib/generation/mock-generation-service.ts`
- Create: `src/lib/generation/default-prompts.ts`
- Create: `src/lib/db/sqlite.ts`
- Create: `src/lib/settings/prompt-settings-repository.ts`
- Create: `src/lib/settings/prompt-settings-service.ts`
- Create: `src/lib/settings/prompt-settings-types.ts`
- Create: `src/lib/utils/time.ts`
- Create: `src/lib/utils/id.ts`
- Create: `src/hooks/use-history-workspace.ts`
- Create: `src/hooks/use-debounced-autosave.ts`
- Create: `src/hooks/use-toast.ts`
- Create: `scripts/init-prompt-settings.ts`
- Create: `data/.gitkeep`
- Create: `src/lib/__tests__/history-search.test.ts`
- Create: `src/lib/__tests__/generation-context.test.ts`
- Create: `src/lib/__tests__/mock-generation-service.test.ts`
- Create: `src/lib/__tests__/local-history-storage.test.ts`
- Create: `src/lib/__tests__/prompt-settings-service.test.ts`

---

## Chunk 1: Scaffold and App Shell

### Task 1: Create the Next.js project foundation

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/app/settings/page.tsx`

- [ ] Step 1: Scaffold the Next.js app files for an App Router TypeScript project.
- [ ] Step 2: Add base layout, metadata, and global styles with a desktop-first two-state layout.
- [ ] Step 3: Render placeholder home and settings routes with no runtime errors.
- [ ] Step 4: Run the app locally and verify both routes render.
- [ ] Step 5: Commit the scaffold if git is available.

Run:

```bash
npm install
npm run lint
```

Expected:

- dependencies install successfully
- lint completes without errors

### Task 2: Add shared shell and feedback primitives

**Files:**
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/confirm-dialog.tsx`
- Modify: `src/app/layout.tsx`

- [ ] Step 1: Build a simple app shell with top navigation and settings entry.
- [ ] Step 2: Add lightweight toast and confirmation primitives.
- [ ] Step 3: Mount the feedback layer globally in the root layout.
- [ ] Step 4: Verify route navigation and feedback rendering remain stable.
- [ ] Step 5: Commit if git is available.

Freeze point for Chunk 1:

- app runs
- home and settings routes render
- shell is navigable
- no obvious runtime errors

---

## Chunk 2: Domain Types and Adapter Boundaries

### Task 3: Define platform and history domain types

**Files:**
- Create: `src/lib/types/platform.ts`
- Create: `src/lib/types/history.ts`

- [ ] Step 1: Define `PlatformType`, save status types, and editor-facing platform models.
- [ ] Step 2: Define `HistoryRecord`, `WorkspaceSnapshot`, `GenerationMetadata`, and platform content types.
- [ ] Step 3: Include `autoTitle`, `title`, `isCustomTitle`, `schemaVersion`, `selectedPlatformsSnapshot`, `lastViewedAt`, `list` blocks, Xiaohongshu `tags`, and image `status`.
- [ ] Step 4: Run TypeScript checking through lint or build to verify type integrity.
- [ ] Step 5: Commit if git is available.

### Task 4: Create storage and generation interfaces

**Files:**
- Create: `src/lib/history/history-storage.ts`
- Create: `src/lib/generation/generation-context.ts`
- Create: `src/lib/generation/mock-generation-service.ts`
- Create: `src/lib/generation/default-prompts.ts`

- [ ] Step 1: Define the `HistoryStorageAdapter` interface with `save(record)`.
- [ ] Step 2: Define the generation context builder contract and generator input/output types.
- [ ] Step 3: Stub the mock generation service with typed placeholder returns.
- [ ] Step 4: Add default prompt templates keyed by platform.
- [ ] Step 5: Verify imports compile cleanly.

### Task 5: Add first domain tests

**Files:**
- Create: `src/lib/__tests__/generation-context.test.ts`
- Create: `src/lib/__tests__/mock-generation-service.test.ts`

- [ ] Step 1: Write a failing test for generation context assembly from prompt, platform set, and prompt settings.
- [ ] Step 2: Write a failing test for structured mock generation output across selected platforms.
- [ ] Step 3: Run the tests to confirm they fail for the intended reason.
- [ ] Step 4: Implement the minimal code to make them pass.
- [ ] Step 5: Re-run tests and commit if git is available.

Run:

```bash
node --test --experimental-strip-types src/lib/__tests__/generation-context.test.ts src/lib/__tests__/mock-generation-service.test.ts
```

Expected:

- tests pass

Freeze point for Chunk 2:

- types compile
- core interfaces exist
- generation boundary is test-covered
- no placeholder import errors

---

## Chunk 3: Local History Storage and Search

### Task 6: Implement local history adapter

**Files:**
- Create: `src/lib/history/local-history-storage.ts`
- Modify: `src/lib/history/history-storage.ts`
- Create: `src/lib/utils/id.ts`
- Create: `src/lib/utils/time.ts`

- [ ] Step 1: Write failing tests for record create, list ordering, save replacement, rename, and remove behavior.
- [ ] Step 2: Implement a browser-safe local storage adapter with a single storage key.
- [ ] Step 3: Ensure `save(record)` replaces the full record without partial merge semantics.
- [ ] Step 4: Add helpers for ids and timestamps where needed.
- [ ] Step 5: Re-run tests and commit if git is available.

### Task 7: Implement local history search

**Files:**
- Create: `src/lib/history/history-search.ts`
- Create: `src/lib/__tests__/history-search.test.ts`

- [ ] Step 1: Write a failing test for local search by title and prompt summary.
- [ ] Step 2: Implement a pure search helper over already loaded records.
- [ ] Step 3: Verify search does not depend on any server code.
- [ ] Step 4: Re-run tests.
- [ ] Step 5: Commit if git is available.

### Task 8: Add local storage adapter tests

**Files:**
- Create: `src/lib/__tests__/local-history-storage.test.ts`

- [ ] Step 1: Add tests covering `schemaVersion`, title semantics, and workspace snapshot persistence.
- [ ] Step 2: Cover refresh-safe restoration inputs such as `activePlatform` and `lastViewedAt`.
- [ ] Step 3: Run the full history test set.
- [ ] Step 4: Fix any adapter edge cases.
- [ ] Step 5: Commit if git is available.

Run:

```bash
node --test --experimental-strip-types src/lib/__tests__/history-search.test.ts src/lib/__tests__/local-history-storage.test.ts
```

Expected:

- tests pass

Freeze point for Chunk 3:

- local adapter works
- local search works
- save and restore semantics are stable

---

## Chunk 4: Prompt Settings SQLite Layer

### Task 9: Set up SQLite connection and repository

**Files:**
- Create: `src/lib/db/sqlite.ts`
- Create: `src/lib/settings/prompt-settings-types.ts`
- Create: `src/lib/settings/prompt-settings-repository.ts`
- Create: `scripts/init-prompt-settings.ts`
- Create: `data/.gitkeep`

- [ ] Step 1: Write a failing test for prompt setting initialization and read behavior.
- [ ] Step 2: Set up SQLite database access using `better-sqlite3`.
- [ ] Step 3: Implement table initialization and default row seeding.
- [ ] Step 4: Implement repository functions for list, filtered batch read, update, and reset.
- [ ] Step 5: Re-run tests and commit if git is available.

### Task 10: Add settings service and server actions

**Files:**
- Create: `src/lib/settings/prompt-settings-service.ts`
- Create: `src/app/actions/prompt-settings.ts`
- Create: `src/lib/__tests__/prompt-settings-service.test.ts`

- [ ] Step 1: Write failing tests for full-read, selected-platform batch-read, single save, and single reset.
- [ ] Step 2: Implement the service layer over the repository.
- [ ] Step 3: Expose server actions for UI consumption.
- [ ] Step 4: Ensure settings page contract stays as full initial fetch plus single-platform save/reset.
- [ ] Step 5: Re-run tests and commit if git is available.

Run:

```bash
node --test --experimental-strip-types src/lib/__tests__/prompt-settings-service.test.ts
```

Expected:

- tests pass

Freeze point for Chunk 4:

- SQLite table exists
- seed data is available
- service and server actions work for required operations

---

## Chunk 5: Home Generate Flow

### Task 11: Build the generate form UI

**Files:**
- Create: `src/components/home/generation-form.tsx`
- Modify: `src/app/page.tsx`

- [ ] Step 1: Render the large prompt input, multi-select platform chips, and primary generate button.
- [ ] Step 2: Add client validation for empty prompt and empty platform selection.
- [ ] Step 3: Show loading state during generation.
- [ ] Step 4: Preserve form input in failure cases.
- [ ] Step 5: Commit if git is available.

### Task 12: Wire generate flow orchestration

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/generation/generation-context.ts`
- Modify: `src/lib/generation/mock-generation-service.ts`
- Modify: `src/lib/history/local-history-storage.ts`

- [ ] Step 1: Batch-load selected prompt settings through server actions.
- [ ] Step 2: Build the normalized generation context.
- [ ] Step 3: Generate structured mock content for the selected platforms.
- [ ] Step 4: Create a `HistoryRecord` with metadata snapshots and persist it through the history adapter.
- [ ] Step 5: Switch into the workspace state on success.

### Task 13: Add minimum failure-path handling

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ui/toast.tsx`

- [ ] Step 1: Simulate or surface generation failure in a controlled path.
- [ ] Step 2: Show user-facing failure feedback.
- [ ] Step 3: Verify the prompt text and selected platforms remain intact after failure.
- [ ] Step 4: Verify no empty history record is created on failure.
- [ ] Step 5: Commit if git is available.

Freeze point for Chunk 5:

- generate success path works end-to-end
- minimum failure path works
- no empty records are created on failure
- transition into workspace is demoable

---

## Chunk 6: Workspace and History Sidebar

### Task 14: Build the workspace shell and sidebar

**Files:**
- Create: `src/components/workspace/workspace-screen.tsx`
- Create: `src/components/workspace/history-sidebar.tsx`
- Create: `src/components/workspace/workspace-header.tsx`
- Create: `src/components/workspace/platform-tabs.tsx`
- Create: `src/hooks/use-history-workspace.ts`
- Modify: `src/app/page.tsx`

- [ ] Step 1: Render the dual-pane workspace shell from the active record.
- [ ] Step 2: Build the left sidebar with list, active item state, and local search.
- [ ] Step 3: Add rename and delete flows with confirmation.
- [ ] Step 4: Add header platform tags that show all included platforms and highlight the active one.
- [ ] Step 5: Persist and restore the active record and active platform snapshot.

### Task 15: Wire workspace actions

**Files:**
- Modify: `src/components/workspace/workspace-header.tsx`
- Modify: `src/components/workspace/workspace-screen.tsx`
- Create: `src/hooks/use-toast.ts`

- [ ] Step 1: Implement `编辑` as focus helper only.
- [ ] Step 2: Implement copy behavior for the active platform.
- [ ] Step 3: Implement simulated publish for allowed platforms only.
- [ ] Step 4: Ensure video script never shows publish.
- [ ] Step 5: Commit if git is available.

Freeze point for Chunk 6:

- history sidebar is usable
- local search works
- rename/delete work
- active record and active tab restore correctly after refresh

---

## Chunk 7: Platform Editors and Autosave

### Task 16: Implement autosave hook and state machine

**Files:**
- Create: `src/hooks/use-debounced-autosave.ts`
- Modify: `src/hooks/use-history-workspace.ts`
- Modify: `src/lib/history/history-storage.ts`

- [ ] Step 1: Implement autosave states `idle`, `dirty`, `saving`, `saved`, and `error`.
- [ ] Step 2: Debounce full-record saves through `historyStorageAdapter.save(record)`.
- [ ] Step 3: Ensure save failures do not revert in-memory edits.
- [ ] Step 4: Allow later edits to retry saving naturally.
- [ ] Step 5: Commit if git is available.

### Task 17: Implement WeChat and Xiaohongshu editors

**Files:**
- Create: `src/components/workspace/platform-editors/wechat-editor.tsx`
- Create: `src/components/workspace/platform-editors/xiaohongshu-editor.tsx`
- Modify: `src/components/workspace/workspace-screen.tsx`

- [ ] Step 1: Build the lightweight WeChat block editor UI for title and supported block types.
- [ ] Step 2: Build Xiaohongshu image suggestion cards and caption editor.
- [ ] Step 3: Preserve `tags` and image suggestion `status` in the editor model.
- [ ] Step 4: Connect edits to in-memory record updates and autosave.
- [ ] Step 5: Commit if git is available.

### Task 18: Implement Twitter and video script editors

**Files:**
- Create: `src/components/workspace/platform-editors/twitter-editor.tsx`
- Create: `src/components/workspace/platform-editors/video-script-editor.tsx`
- Modify: `src/components/workspace/workspace-screen.tsx`

- [ ] Step 1: Build Twitter single/thread mode UI with dual-draft preservation.
- [ ] Step 2: Ensure manual mode switching sets `userLockedMode` and stops auto override.
- [ ] Step 3: Build the structured video script editor with scenes and voiceover fields.
- [ ] Step 4: Connect edits to autosave.
- [ ] Step 5: Commit if git is available.

Freeze point for Chunk 7:

- all four editors are usable
- autosave works with visible state
- refresh restores current record and active tab
- failed saves do not discard user input

---

## Chunk 8: Settings Screen and Demo Polish

### Task 19: Build the settings page UI

**Files:**
- Create: `src/components/settings/prompt-settings-screen.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] Step 1: Load all platform prompt settings on initial settings page render.
- [ ] Step 2: Build the platform switcher and editor panel.
- [ ] Step 3: Wire single-platform save and single-platform reset.
- [ ] Step 4: Show save feedback states in the page.
- [ ] Step 5: Commit if git is available.

### Task 20: Polish fixed demo scenario and final verification

**Files:**
- Modify: `src/lib/generation/mock-generation-service.ts`
- Modify: `src/components/home/generation-form.tsx`
- Modify: `src/components/workspace/*`
- Modify: `src/app/globals.css`

- [ ] Step 1: Add one fixed strong demo scenario matching the efficiency example.
- [ ] Step 2: Keep mock logic simple and deterministic rather than overly smart.
- [ ] Step 3: Verify the home flow, workspace flow, settings flow, copy, and simulated publish.
- [ ] Step 4: Run lint and targeted tests.
- [ ] Step 5: Commit if git is available.

Run:

```bash
npm run lint
node --test --experimental-strip-types src/lib/__tests__/history-search.test.ts src/lib/__tests__/generation-context.test.ts src/lib/__tests__/mock-generation-service.test.ts src/lib/__tests__/local-history-storage.test.ts src/lib/__tests__/prompt-settings-service.test.ts
```

Expected:

- lint passes
- targeted tests pass
- app is demoable end-to-end

Freeze point for Chunk 8:

- one strong example scenario works reliably
- settings page is functional
- workspace is editable and persistent
- app is ready for prototype demo

---

Plan complete and saved to `docs/superpowers/plans/2026-03-31-content-agent-phase1.md`. Ready to execute?
