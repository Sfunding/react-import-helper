## Root cause

When you "Commit straights" the dialog correctly saves `as_of_date = day-after-last-straight` (e.g. ~10 weeks in the future) and writes scenario positions with `fundedDate` set to each straight's fire date.

But the Calculator's load handler in `src/pages/Index.tsx` (the `sessionStorage.getItem('loadCalculation')` effect at ~L188–225) does two things that break this:

1. It computes `loadedAsOf` from the saved record (future date), then forces **`effectiveAsOf = todayISO`** at L224 and calls `setAsOfDate(effectiveAsOf)`. So the calculator opens at TODAY instead of day-after-last-straight.
2. Because `loadedAsOf !== todayISO`, it then runs the "project balances to today" block (L217–223) and reprices every position to today.

Consequence with your straights commit:
- **Scenario straight positions** carry `fundedDate` in the future. With `asOfDate = today`, `isBeforeISODate(today, fundedDate) = true` for every one of them → they all show grayed "Not started · funds …". That's exactly what you saw.
- **Original positions without a `fundedDate`** get a `manual` anchor at `loadedAsOf` (future). Repricing back to today is blocked by the cap in `repricedBalance` (`Math.min(anchorBal, raw)`), so their balance stays at the already-projected (10-weeks-down) number instead of being restored. That's the "balances of all the other positions came down by 10 weeks" symptom.

In short: the commit saves a future as-of date, but the loader throws it away and snaps to today, which both (a) makes future-funded straights look "not started" and (b) leaves manual-anchored originals stuck at the future-projected balance.

## Fix

Honor the saved as-of date on load. Don't force `effectiveAsOf = todayISO` and don't auto-reproject balances. The "Positions as of" calendar already lets the user move the date if they want.

### Change in `src/pages/Index.tsx` (load effect ~L188–228)

Replace this block:

```ts
// Project forward to today if the saved as-of date is in the past.
const todayISO = format(new Date(), 'yyyy-MM-dd');
if (loadedAsOf !== todayISO && loadedPositions.length > 0) {
  loadedPositions = loadedPositions.map(p => ({ ...p, balance: repricedBalance(p, todayISO) }));
  toast({ title: 'Balances projected to today', description: `Repriced from …` });
}
const effectiveAsOf = todayISO;
```

with:

```ts
// Use the saved as-of date as-is. Balances saved at loadedAsOf are already correct for that date,
// and `fundedDate` anchors will reprice on demand when the user moves the "Positions as of" picker.
const effectiveAsOf = loadedAsOf;
```

Then `setAsOfDate(effectiveAsOf)` and the `lastSavedState` snapshot below it (L260) already pick up `effectiveAsOf`, no further change needed.

### Why this works

- A straights commit saves `as_of_date = day-after-last-straight`. The calculator now opens at that date.
- Every scenario straight has `fundedDate ≤ asOfDate` (last straight's fundedDate = lastOffset, asOfDate = lastOffset+1) → none are grayed "not started".
- Original positions' saved balances are the checkpoint balances (already correct for that future date), so they don't get further reduced.
- If the user manually rolls the picker back to today (or May 11), the existing `handleAsOfDateChange` reprices funded-anchor positions from their `fundedDate` and grays the not-yet-started ones — which is the behavior you said you loved.

### What about loading non-scenario deals where the saved `as_of_date` is genuinely old?

Currently the auto-projection happens silently and is half-broken anyway (originals with funded anchors get restored, manual-anchor positions don't). Removing it makes load deterministic: open at the saved date, then let the user move the picker forward to today if they want — re-pricing then happens through `handleAsOfDateChange`, which is the same code path used everywhere else and is the one we actually trust.

## Files

- `src/pages/Index.tsx` — single edit in the load effect (~L215–224), drop the auto-projection block and set `effectiveAsOf = loadedAsOf`.

No backend / schema changes. No change to `CommitScenarioDialog`, `leverageMath`, or `dateUtils`.

## Acceptance

1. Commit straights → Calculator opens at day-after-last-straight. All scenario straights are active (none grayed). Original positions show their checkpoint balances unchanged.
2. Move the "Positions as of" picker back to May 11 → scenario straights gray out as "Not started · funds {date}", originals reprice from their funded anchor (manual-anchor positions stay put per existing rule).
3. Move the picker forward again → scenario straights re-activate at proper repriced balances.
4. Loading any non-scenario saved deal opens at its saved as-of date instead of silently jumping to today.