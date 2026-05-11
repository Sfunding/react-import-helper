## Goal

When the user moves the "Positions as of" date back to a day *before* a position's funding (anchor start) date, that position should be **automatically excluded and visually grayed out** with a "Scenario not started yet" marker — instead of having its balance re-priced past its origin (which produces a fake / too-high balance).

This restores the magic of the first commit flow: after committing straights, the as-of date jumps to "day after last straight"; rolling it back to May 11 should make the not-yet-funded positions vanish from the math and show a clear "not started yet" badge.

## Behavior

For each position, define `notStartedYet` = `fundedDate && asOfDate < fundedDate` (strict, business-day-aware compare on ISO dates).

When `notStartedYet`:
- Row renders grayed out (opacity-40 + line-through on entity), with a small badge: **"Not started · funds {fundedDate}"**.
- The `I` (include in reverse) checkbox is auto-unchecked and disabled while in this state.
- The position is excluded from every downstream calculation: `includedBalance`, `includedDailyPayment`, schedule, exposure, EPO, PDF — same effect as `includeInReverse = false` today.
- We do **not** mutate `includeInReverse` in state; we compute an `effectiveIncludeInReverse` so flipping the date forward again re-includes the position automatically (no lost user intent).
- Balance is displayed as the **anchor balance** (the original funded amount) with a muted label "as of {fundedDate}", not a re-priced value. Re-pricing only runs once the as-of date is ≥ fundedDate.

When the as-of date is moved back past the funded date:
- `handleAsOfDateChange` skips re-pricing for any position where `newDate < fundedDate` (just leaves the stored balance alone; effective balance will be presented as the anchor amount via the not-started rendering anyway).
- When the date is moved forward again past the funded date, normal re-pricing resumes from the funded anchor.

## Files

- **`src/lib/dateUtils.ts`** — add `isBeforeISODate(a, b)` helper (local-midnight compare).
- **`src/pages/Index.tsx`**
  - In `handleAsOfDateChange`, skip the `repricedBalance` call when `newDate < p.fundedDate`.
  - Derive `notStartedYet` per row inside the `positions.map` render at ~L1501 and inside `positionsWithDays` at ~L305.
  - In `positionsWithDays`, when `notStartedYet`, treat the position as `includeInReverse: false` and `isOurPosition: false`-ish for math (force `balance = 0` for schedule purposes, set a `notStartedYet` flag carried on the object).
  - Every consumer that filters by `includeInReverse !== false` already excludes it because we override that flag in the derived array. Double-check the four filter sites (L379, L447, L597, L2074/2086/2133) — no further edits needed if we filter in `positionsWithDays`.
  - Render: add badge + disable the `I` checkbox + grayed wrapper when `notStartedYet`. Show "as of {fundedDate}" caption under balance.

- **`src/components/leverage/CommitScenarioDialog.tsx`** — no change. Committed straight positions already carry `fundedDate`; that's exactly the anchor we key on.

## Out of scope

- No backend / schema change.
- No change to scenario math, EPO, PDF formulas (positions just drop out of the included set, which is already supported).
- No "snap to last straight" automatic date jump on rollback — only on the initial commit, which already works.
- Manual-anchor positions (no `fundedDate`) are unaffected; only funded-anchor positions can be "not started yet".

## Acceptance

1. Commit straights → as-of date jumps to day-after-last-straight; new positions appear normally.
2. Manually change as-of date back to May 11 (or any date before the straights' funding date): each straight row goes opacity-40, shows "Not started · funds {date}", `I` checkbox disables, schedule + exposure + totals recompute as if those positions don't exist.
3. Move as-of date forward to / past the funded date again: positions become active, balances re-price from the funded anchor, `I` checkbox re-enables and reflects its prior value.
4. No regression to existing positions without a `fundedDate` (manual-anchor positions never trigger "not started yet").
