Your screenshots changed the diagnosis: this is not only an anchor drift bug. On May 11, the totals are still including future straight positions that should not exist yet.

Evidence from screenshots:
- Original May 11 total balance: $53,927,892 and current daily about $478,998.
- After committing straights and returning to May 11: $65,267,892 and current daily about $685,998.
- The increase is about $11.34M balance and $207K daily, which matches future scenario straight positions being counted on May 11.

Plan:

1. Fix total calculations to exclude not-started positions
   - In `src/pages/Index.tsx`, build `positionsWithDays` before totals.
   - Use `positionsWithDays` for `allExternalPositions`, `includedPositions`, `totalBalance`, and `totalCurrentDailyPayment`.
   - This ensures any position with `fundedDate > asOfDate` contributes $0 balance and $0 daily to all header totals, savings, schedules, advance amount, and deal summary.

2. Fix the date-change anchor precedence
   - In `handleAsOfDateChange`, check manual anchors before funded metadata.
   - If `balanceAnchor === 'manual'`, update the position’s `balance`, `balanceAsOfDate`, and `balanceAnchor` together on every date move.
   - Only funded-only positions keep using the funded-date anchor.
   - This prevents the original carried-over positions from drifting when moving May → July → May.

3. Preserve “not started yet” behavior for scenario straights
   - Keep future-funded scenario straight rows visually marked as not started when `asOfDate` is before their `fundedDate`.
   - Make sure they are excluded from totals and reverse calculations while not started, but still remain stored in the deal so they reappear when the as-of date moves forward.

4. Fix Deal Lab projection consistency
   - In `src/lib/leverageMath.ts`, remove the weekly-position projection exception in `projectStackToDate`.
   - The app’s math treats `dailyPayment` as the daily-equivalent value even for weekly positions, so Deal Lab should project them the same way before running/committing scenarios.

5. Add regression tests for the exact flow
   - Test a manual-anchored original position that also has funded metadata.
   - Test May 11 → future commit date → back to May 11 → forward again.
   - Test future-funded straight positions are excluded from May 11 totals and included only once their funded date arrives.

Acceptance:
- After committing all straights, moving the child deal back to May 11 shows the same total balance/current daily as before the commit, not the inflated $65.27M/$685.99K values.
- Future straight rows remain present but inactive/gray/not-started on May 11.
- Moving forward to July and back to May 11 repeatedly gives stable totals with no compounding drift.