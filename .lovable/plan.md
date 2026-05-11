## Goal

Add a new commit action that produces a child deal containing the **parent's original positions** (projected to the right date) plus every **straight (and recurring-straight) position** from the scenario — and **excludes any reverse consolidation**. The snapshot date is the **business day immediately after the last straight fires**, so balances and daily payments are honest at the moment the user will structure the new reverse.

## Why the current "Commit final state" is wrong

`Commit final state` uses `checkpoints[last]`, which is the state **after every reverse has fired**. Reverses consolidate prior straights into a single reverse RTR, so the individual straights disappear and the user can't build a new reverse on top of them. The user wants the straights intact, no reverse, and balances accurate to the moment the last straight has landed.

## New behavior — "Commit straights to Calculator"

Replace the existing "Commit final state" button with **"Commit straights"** (same `GitBranch` icon, same location). Clicking it opens the dialog in a new `mode='straights'` that:

1. Hides the Before/After radio (not relevant).
2. Title: "Commit straights to Calculator". Description: "Snapshot the day after the last straight fires — all straights kept, reverses skipped."
3. Default name: `${originalCalc.name} — With Straights`.
4. Carryover defaults to `all` settings from the parent, with reverse-param overrides **off** (user will configure a new reverse from scratch).

### Snapshot logic

- Find `lastStraightIdx` = highest step index where `kind === 'straight' || kind === 'recurring-straight'`. If none exists, disable the button.
- Target checkpoint = `scenarioRun.checkpoints[lastStraightIdx + 1]` (state **after** that step fires).
- `asOfDate` = `addBusinessDays(today, checkpoint.dayOffset + 1)` — the next business day after the last straight, formatted `yyyy-MM-dd`. This is the "honest balance" date.
- Walk `checkpoint.activePositions` and emit positions via the existing `checkpointToPositions` rules, but **filter out any `ap.source === 'reverse-rtr'`** entries. Everything else (originals projected to that day, straights at their post-funding partial-paydown balance, outside-added positions) passes through unchanged.
- If a reverse fires **between** straights, the originals it consumed are already gone from the active set at the snapshot checkpoint — that's correct, the user explicitly chose to model that consolidation in the scenario; we just don't carry the resulting reverse RTR into the child.

### Settings

- `carryover === 'all'`: copy parent's `originalCalc.settings` verbatim. Do NOT apply any reverse-step overrides (`rate`, `feePercent`, `dailyPaymentDecrease` stay parent's). The "custom" branch's reverse-key auto-toggle is also skipped in straights mode.

## Files to change

- `src/components/leverage/CommitScenarioDialog.tsx`
  - Extend `mode` union to `'step' | 'final' | 'straights'`.
  - In the reset `useEffect`: when straights mode, set default name, force `carryover='all'`, set all `customKeys` to `false`.
  - Update title/description and submit-button label for straights mode.
  - In `handleCommit`, when straights mode:
    1. Compute `lastStraightIdx` from `scenario.steps`.
    2. Get `checkpoint = scenarioRun.checkpoints[lastStraightIdx + 1]`.
    3. Build a filtered checkpoint (omit `reverse-rtr` active positions) and pass to `checkpointToPositions`.
    4. Override `asOfDate` to `addBusinessDays(today, checkpoint.dayOffset + 1)`.
    5. Build settings with no reverse overrides (treat `isReverse` as false in `buildSettings`).
  - Disable Commit button when no straight exists in the scenario.

- `src/pages/DealLab.tsx`
  - Rename handler `openFinalCommit` → `openStraightsCommit`; set `commitMode = 'straights'`, `commitStepIndex = lastStraightIdx` (or `steps.length - 1` — dialog computes its own target).
  - Update button label "Commit straights" and hint "Add scenario straights to a new deal (no reverse); dated the day after the last straight."
  - Disable when scenario has zero straights.

- `src/lib/leverageMath.ts`
  - Ensure `addBusinessDays` is exported (it already is via the dialog's import path — confirm during implementation; no logic change).

## Acceptance

- Scenario with parent positions A, B, C + 5 straights spread over 8 weeks + 1 reverse at week 6 → click "Commit straights" → child deal has:
  - A, B, C projected to "day after last straight" balances/dailies (paid down realistically).
  - S1..S5 at their balance/daily on that same date (early straights partially paid, late straight nearly full).
  - No reverse RTR.
  - `asOfDate` = business day after S5's funding day.
- Settings = parent's settings, reverse params untouched.
- Per-step "Commit to Calculator" continues to work exactly as before. Parent scenarios still auto-clone into the child.

## Out of scope

- Picking a subset of straights to include.
- Forcing straights to "full RTR" (we use honest post-paydown balance).
- Auto-creating a placeholder reverse in the child.