## What's actually happening

I checked the database for this deal: there are two scenario rows, both with **0 steps** and the default name "Untitled Scenario". The session replay shows you clicking the inline scenario tab and typing into it — but the manual **"Save to Deal"** button (buried in the builder header next to "Add Step / Export PDF") never gets clicked.

So the bug is: scenario edits are *not* auto-saved. Renaming the tab saves only the tab name. Every time you switch scenarios, click "New scenario", or refresh, your unsaved steps silently disappear and you're left with an empty row.

## Fix

### 1. Auto-save scenario edits (no more manual Save button)
- Add a debounced auto-save (~800ms) in `DealLab.tsx`: whenever `scenario` changes and `activeScenarioId` is set, call `updateScenarioRow(activeScenarioId, { scenario, name: scenario.name })`.
- Replace the dirty-dot + "Save to Deal" button with a small status pill: **Saving… / Saved / Save failed — Retry** (mirrors the pattern already in `AutoSaveIndicator.tsx`).
- Keep a manual "Save now" only as a tiny retry hook on error.

### 2. Flush before switching
- Before `handleSelectScenario`, `handleCreateScenario`, `handleDuplicateScenario`, `handleDeleteScenario` swap state, await the pending save (or run it inline). This kills the "switching tabs nuked my work" failure mode.

### 3. One name, not two
- Inline rename on the tab currently writes only the row's `name` column; the scenario JSON keeps its own `name`. Sync them: rename updates both `name` (column) and `scenario.name`. Remove the redundant "Scenario Name" input inside the builder panel.

### 4. Drop Compare for now
- Remove the Compare button, the compare select, and the `compareScenarioId`/`compareRow`/`compareRun` branch from `DealLab.tsx`.
- Remove the `compareId` / `onSetCompare` props and the right-side compare cluster from `ScenarioTabs.tsx`. The file stays — just slimmer.
- The split-view rendering block in the Builder tab collapses to a single `ScenarioBuilderPanel` + `ScenarioStory`.

### 5. Cleanup
- Remove the now-unused `Save to Deal` button + `canSave`/`onSave` props from `ScenarioBuilderPanel`.
- Keep "Export PDF" and "Add Step" exactly where they are.
- Leave the existing two empty rows in the DB alone — they'll just show up as two scenarios you can rename or delete.

## Out of scope
- No math changes. No changes to Deal Lab Compare tab (the top "compare" tab between reverse / straight / hybrid is unrelated). No changes to scenario step UI.

## Acceptance
- Open Deal Lab → builder tab shows the active scenario with a "Saved" pill.
- Add a step → pill flips to "Saving…" then "Saved" within ~1s; refresh the page → the step is still there.
- Rename the tab inline → name persists everywhere; no second name field in the panel.
- "New scenario" / switching tabs → previous edits are flushed first, never lost.
- No Compare button anywhere in the builder.
