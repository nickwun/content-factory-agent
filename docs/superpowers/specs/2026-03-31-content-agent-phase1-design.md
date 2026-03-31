# Content Agent Phase 1 Design

**Date:** 2026-03-31
**Status:** Approved for implementation
**Scope:** First-phase prototype for a multi-platform content creation and simulated distribution agent built with Next.js and SQLite

---

## 1. Goal

Build a first-phase prototype that lets a user:

- enter a content request
- choose one or more target platforms
- generate mock drafts
- move into a two-panel workspace
- review and edit platform-specific drafts
- persist editing history locally
- manage platform prompt settings in SQLite
- simulate publish feedback

This phase explicitly prioritizes:

- page prototype and visual structure
- page transitions
- history sidebar and editor workspace
- mock generation
- prompt settings CRUD via server-side SQLite access
- simulated publish feedback

This phase explicitly excludes:

- real LLM integration
- real platform publish APIs
- login or user system
- cloud sync
- advanced rich text or media management

---

## 2. Product Definition

The product is a multi-platform content creation workspace. A user starts from a single prompt, selects target channels, and gets platform-specific drafts in one editing environment.

Supported platforms:

- `wechat_article`
- `xiaohongshu`
- `twitter`
- `video_script`

Primary flow:

1. User enters a request
2. User selects one or more platforms
3. User clicks generate
4. System creates mock content for each selected platform
5. UI switches into a dual-pane workspace
6. User edits drafts with autosave
7. User can copy or simulate publish where applicable

---

## 3. Architecture Boundaries

The system is divided into four layers.

### 3.1 App UI

Responsible for:

- page layout
- tabs
- editors
- sidebar
- toasts and dialogs
- local save state display

The UI layer does not read or write `localStorage` directly and does not access SQLite directly.

### 3.2 Client Application Layer

Responsible for:

- current workspace state
- active history record
- active platform tab
- generate flow orchestration
- autosave state machine
- copy and simulated publish interactions

Key abstractions:

- `historyStorageAdapter`
- `mockGenerationService`
- `generationContext` builder

### 3.3 Server Configuration Layer

Responsible for platform prompt setting reads and writes through server-only code.

Responsibilities:

- load all platform prompt settings for settings page
- load selected platform prompt settings for generation
- update one platform prompt setting
- reset one platform prompt setting

This layer must use server actions or route handlers. No fake client-side prompt storage.

### 3.4 Persistence Layer

Split by purpose:

- history records use browser `localStorage` through an adapter
- platform prompt settings use SQLite through server-only access

---

## 4. Routes and Page Model

### 4.1 Home Route `/`

This route contains two page states.

#### Generate State

Centered creation form with:

- large prompt textarea
- multi-select platform chips
- primary generate button

Behavior:

- generate button disabled when prompt is empty
- generate button disabled when no platform is selected
- submission enters generating state
- success switches to workspace state
- failure keeps form input intact and shows feedback
- failure must not create an empty history record

#### Workspace State

Persistent two-column layout:

- left sidebar for history records
- right pane for current record workspace

### 4.2 Settings Route `/settings`

Prompt setting management page with:

- platform switcher
- prompt editor for current platform
- save button
- reset button

Data loading rule:

- first render reads all platform prompt settings in one server request
- edits save only the current platform
- reset only affects the current platform

---

## 5. Workspace Information Architecture

### 5.1 Left Sidebar

Responsibilities:

- local history search
- list history records
- switch active record
- rename record
- delete record

Search rules:

- search is fully client-side
- search only inspects records already loaded from `localStorage`
- no server search

Each history item displays:

- display title
- selected platform tags
- updated time
- prompt summary

### 5.2 Right Workspace Header

The header contains:

- record title
- prompt summary
- timestamps
- platform overview tags

Platform tags are functional, not decorative. They must help the user quickly see:

- which platforms exist in the current record
- which platform tab is currently active

### 5.3 Right Workspace Actions

Global actions shown in the workspace:

- `编辑`
- `复制`
- `发布`

Rules:

- content is editable by default
- `编辑` is not a mode toggle
- clicking `编辑` only focuses the active editor and shows a light helper message
- `复制` copies content for the currently active platform
- `发布` only appears for `wechat_article`, `xiaohongshu`, and `twitter`
- `video_script` does not show `发布`

### 5.4 Platform Tabs

The tab bar shows only the platforms included in the current record.

Switching tabs:

- changes the active editor view
- updates workspace snapshot state
- is restored after page refresh

---

## 6. Platform Editor Scope

### 6.1 WeChat Article

Use a lightweight block editor model.

Supported content capabilities in phase 1:

- title
- paragraph
- subheading
- bold text via lightweight inline markers
- quote
- divider
- list

Do not introduce a complex rich text stack in phase 1.

### 6.2 Xiaohongshu

Use a split content model:

- image suggestion cards
- caption editor

Phase 1 priorities:

- clear information structure
- easy text editing
- up to 9 image suggestions

Do not prioritize complex carousel behavior in phase 1.

### 6.3 Twitter

Explicitly support:

- `single`
- `thread`

Rules:

- system can auto-detect an initial mode during generation
- once the user manually switches mode, user choice becomes authoritative
- future visits must preserve that choice
- switching modes must not discard previously entered content

### 6.4 Video Script

Use a structured text-style editor for:

- title
- duration
- scene list
- shot description
- voiceover

No publish action in phase 1.

---

## 7. Persistence Strategy

### 7.1 History Records

History records are stored in browser `localStorage` through a dedicated adapter.

Rules:

- UI must not call `localStorage` directly
- autosave writes the entire `HistoryRecord`
- first phase does not use partial patch persistence
- page refresh must restore:
  - current history record
  - last active platform tab for that record

### 7.2 Prompt Settings

Prompt settings are stored in SQLite and accessed through server-only reads and writes.

Rules:

- settings page uses first-load full fetch
- homepage generation fetches selected platform settings in batch
- no per-platform serial fetches during generation

---

## 8. Core Data Structures

### 8.1 History Storage Adapter

The history adapter must expose:

- `list()`
- `getById(id)`
- `create(record)`
- `save(record)`
- `rename(id, title)`
- `remove(id)`
- `search(query)`

Purpose of `save(record)`:

- explicit full-record replacement for autosave and editor persistence

### 8.2 HistoryRecord

`HistoryRecord` must include:

- `id`
- `schemaVersion`
- `autoTitle`
- `title`
- `isCustomTitle`
- `userPrompt`
- `selectedPlatforms`
- `createdAt`
- `updatedAt`
- `generation`
- `content`
- `workspace`

Title rules:

- `autoTitle` stores the system-generated title
- `title` stores the current display title
- `isCustomTitle` marks whether the user renamed it

### 8.3 WorkspaceSnapshot

`WorkspaceSnapshot` must include:

- `activePlatform`
- `platformOrder`
- `lastViewedAt`

### 8.4 GenerationMetadata

`GenerationMetadata` must include:

- `generatorVersion`
- `generatedAt`
- `selectedPlatformsSnapshot`
- `promptSnapshotByPlatform`
- optional `settingsVersionByPlatform`

This metadata exists to preserve the exact generation context of a record, even if settings later change.

### 8.5 Platform Content Types

#### WeChat

Use:

- `title`
- `blocks`

Block types:

- `heading`
- `paragraph`
- `quote`
- `divider`
- `list`

#### Xiaohongshu

Use:

- `title`
- `caption`
- `imageSuggestions`
- `tags`

Each image suggestion should include:

- `id`
- `index`
- `title`
- `description`
- `status`

#### Twitter

Use a dual-draft strategy:

- `mode`
- `userLockedMode`
- `autoDetectedMode`
- `singleDraft`
- `threadDraft`

Switching between `single` and `thread` preserves both drafts. The current mode only controls which draft is shown and used for copy/publish.

#### Video Script

Use:

- `title`
- `duration`
- `scenes`

Each scene should include:

- `id`
- `shot`
- `voiceover`

---

## 9. Generation Flow

Generation must be split into two steps.

### 9.1 Build Generation Context

Inputs:

- user prompt
- selected platforms
- prompt settings fetched in batch
- generator version
- current timestamp

### 9.2 Generate Draft

The generation service consumes a normalized `generationContext` and returns structured platform content.

Rules:

- do not mix prompt-setting fetch logic into generator implementation
- do not mix record creation responsibilities into generator implementation

Phase 1 implementation:

- fixed mock templates
- one strong example content path is sufficient
- no attempt to make mock generation overly intelligent

---

## 10. Autosave Model

Autosave uses a lightweight state machine:

- `idle`
- `dirty`
- `saving`
- `saved`
- `error`

Rules:

- editing updates in-memory record state immediately
- persistence is debounced
- persistence writes the full `HistoryRecord`
- save failures do not roll back in-memory user edits
- after a failed save, the user can continue editing and trigger another autosave attempt
- phase 1 does not implement before-unload interception or blocking prompts

---

## 11. SQLite Schema

Phase 1 requires one table.

### `platform_prompt_settings`

Columns:

- `id TEXT PRIMARY KEY`
- `platform TEXT NOT NULL UNIQUE`
- `prompt_template TEXT NOT NULL`
- `default_template TEXT NOT NULL`
- `version TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

---

## 12. Server Interface Contract

The server configuration layer must provide:

- full prompt settings read for settings page
- selected prompt settings batch read for generation
- single-platform save
- single-platform reset

Behavior rules:

- settings page initial load is full fetch
- settings page save is single-platform only
- settings page reset is single-platform only
- generation prompt reads are batched by selected platform set

---

## 13. Milestones and Freeze Points

Each milestone must end at a freeze point where:

- the app runs
- the current main interaction path is clickable end-to-end
- there are no obvious runtime errors
- the state is demoable as a stage version

### Milestone 1

Project scaffold, routes, layout skeleton, feedback primitives

Freeze point:

- pages render cleanly
- route navigation works
- no broken shell states

### Milestone 2

Domain model, adapters, generation boundaries

Freeze point:

- types compile
- storage and service boundaries are wired
- placeholder flows can run without console failures

### Milestone 3

Generate flow end-to-end

Freeze point:

- success path creates a record and enters workspace
- failure path shows feedback
- failure path preserves input
- failure path creates no empty record

### Milestone 4

History workspace behavior

Freeze point:

- history list, search, rename, delete, and record switching all work
- refresh restores current record

### Milestone 5

Editing and autosave

Freeze point:

- content edits are possible
- autosave status transitions are visible
- refresh restores current record and current active tab
- save failure shows error without losing in-memory edits

### Milestone 6

Platform-specific editors

Freeze point:

- all four platform tabs support meaningful editing
- Twitter mode switching preserves content

### Milestone 7

SQLite-backed prompt settings

Freeze point:

- settings load from SQLite
- single-platform save works
- single-platform reset works

### Milestone 8

Demo polish

Freeze point:

- copy works
- simulated publish works
- one fixed strong demo scenario works consistently

---

## 14. MVP Acceptance Criteria

The MVP is acceptable only if all of the following are true:

- user can enter a request and select multiple platforms
- user can generate mock drafts and move into the workspace
- left sidebar supports view, local search, rename, and delete
- right pane supports per-platform tab switching and editing
- content is editable by default
- `编辑` only focuses the current editor
- autosave persists the full record through the history adapter
- save state visibly reflects editing lifecycle
- settings page reads from and writes to SQLite through server-only code
- publish is simulated only for WeChat, Xiaohongshu, and Twitter
- video script does not show publish
- refresh restores the current history record
- refresh restores the last active platform tab of that record

---

## 15. Non-Goals

The following are deliberately out of scope for phase 1:

- real AI generation
- real social platform integrations
- login
- cloud persistence for history
- advanced rich text layout
- asset upload pipeline
- advanced image carousel interactions
- before-unload edit interception

