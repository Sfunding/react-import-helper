Why the round-trip drifts:
- On commit, original positions keep their old `fundedDate`/`amountFunded` and old `balanceAsOfDate` (May 11), but `balance` is overwritten with the July-projected value.
- `repricedBalance` picks the funded anchor first, so moving back to May 11 reconstructs the balance from `amountFunded − days × daily`, not from the actual May 11 number the user had entered.

Fix plan:

1. Lock a manual anchor at commit time
   - In `src/lib/leverageMath.ts` `checkpointToPositions`, when emitting an `original`-sourced position, also set:
     - `balanceAsOfDate = <commit asOfDate>` (the checkpoint date)
     - `balanceAnchor = 'manual'`
   - This says: “this projected balance is true on the commit date,” which is exactly what the schedule produced.

2. Make the manual anchor authoritative when present
   - In `src/lib/dateUtils.ts` `repricedBalance`, prefer the manual anchor when `balanceAnchor === 'manual'` (or when `balanceAsOfDate` is set and is newer than `fundedDate`).
   - Funded anchor stays the fallback for positions that only have funding metadata (e.g., scenario straights with no manual snapshot yet).

3. Hydration alignment
   - In `src/pages/Index.tsx` load effect, when a position has `balanceAnchor === 'manual'` and a `balanceAsOfDate`, keep it as manual (don't promote to `funded`).

Acceptance:
- Open a deal on May 11 with manually-entered balances.
- Commit straights → child opens at the day-after-last-straight with projected balances.
- Move as-of date to July, then back to May 11.
- Original positions show the exact May 11 balances and weeks left from before commit.
- Scenario straights with `fundedDate` after May 11 still gray out as “not started yet.”
- Forward-then-back moves on the same deal remain stable (no cumulative drift).