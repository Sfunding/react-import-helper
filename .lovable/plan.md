## Goal

Stop losing work. Today the calculator only persists when the user clicks **Save**, and we only warn on in-app navigation — not on refresh, tab close, browser crash, or accidental "New". This plan adds two complementary safety nets.

## Layer 1 — Local Draft Auto-Backup (always on, zero friction)

Continuously snapshot the current calculator state (`merchant`, `settings`, `positions`) to `localStorage` so a refresh or crash never loses work.

**Behavior**
- Debounced write (~800ms after last change) to `localStorage` key `avion:draft:v1`.
- Stored payload: `{ merchant, settings, positions, loadedCalculationId, loadedCalculationName, savedAt }`.
- On app load (`Index.tsx` mount), if a draft exists AND it differs from the currently loaded calc (or no calc is loaded), show a small banner at the top:
  ```
  ⚠ Unsaved draft from 3 min ago — [Restore] [Discard]
  ```
- Draft is cleared automatically after a successful Save / Update, or after Discard.
- Also wire a `beforeunload` warning when `hasUnsavedChanges()` is true, so refresh/close prompts the browser-native "Leave site?" dialog.

**Why this matters**: Covers the worst cases (browser crash, accidental refresh, closed tab) without any server round-trips.

## Layer 2 — Cloud Auto-Save for Loaded Deals (opt-in toggle)

Once a calculation has been saved at least once (`loadedCalculationId` exists), enable an **Auto-save** toggle in the header next to the Save button.

**Behavior**
- When ON: any change triggers a debounced (~2s) silent `updateCalculation` call to the existing `saved_calculations` row.
- Tiny status indicator near the Save button:
  - `● Saved` (green, idle)
  - `… Saving` (during request)
  - `⚠ Save failed — Retry` (on error)
- Toggle state persisted per-user in `localStorage` (`avion:autosave-enabled`). Default: ON.
- Disabled (greyed out) for brand-new unsaved calcs — those rely on Layer 1 until the user clicks Save once to name the deal.

**Why opt-in for new calcs**: We don't want to auto-create rows for half-typed scratch work. The user names it first, then auto-save takes over.

## Files to touch

```text
src/pages/Index.tsx
  - Add useEffect: debounced localStorage write of draft
  - Add useEffect on mount: detect + offer to restore draft
  - Add beforeunload listener tied to hasUnsavedChanges()
  - Add auto-save toggle + status indicator UI in header
  - Add useEffect: debounced updateCalculation when toggle ON + loadedCalculationId set
  - Clear draft on successful save/update

src/hooks/useDraftBackup.ts                (new)
  - Encapsulates the debounced localStorage read/write + draft detection

src/hooks/useAutoSave.ts                   (new)
  - Encapsulates the debounced cloud update + saving/saved/error status

src/components/DraftRestoreBanner.tsx      (new)
  - The "Unsaved draft from X min ago" banner with Restore / Discard buttons

src/components/AutoSaveIndicator.tsx       (new)
  - "● Saved / … Saving / ⚠ Failed" pill next to Save button
```

## Out of scope
- No schema changes — we reuse `saved_calculations` and existing `updateCalculation` mutation.
- Leverage page and scenario builder are not touched in this pass (can extend later using the same hooks).
- No version history / undo stack — just last-draft recovery. Can layer a `draft_history` table on later if needed.

## Open question
Should auto-save default to **ON** or **OFF** for loaded deals? ON is safer but means edits push to the row without an explicit "Save" click — that may surprise users who use Save as a checkpoint. My recommendation: **ON by default**, with the toggle clearly visible.