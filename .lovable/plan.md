## Fix plan

The problem is that committed original positions are saved only with their future checkpoint balance. When the calculator date is moved backward, those positions only have a manual anchor at the future commit date, so the current repricing function caps the balance at that future amount instead of restoring the larger balance they had on May 11.

### What I’ll change

1. **Preserve original funding anchors during scenario commit**
   - In `checkpointToPositions`, when carrying over an original position, keep its original `fundedDate`, `amountFunded`, and funded anchor metadata instead of treating it like a manual snapshot.
   - If an original position already had `fundedDate + amountFunded`, it will reprice from that true funding point.

2. **Allow backward repricing to increase balances for funded positions**
   - Update `repricedBalance` so funded-anchor positions can move both ways by date:
     - moving forward lowers balance
     - moving backward raises balance up to the original `amountFunded`
   - Keep manual-anchor positions capped at their stored manual balance, because we do not know their true original funding amount.

3. **Hydrate loaded positions correctly**
   - In the calculator load effect, only assign a manual anchor when a position lacks a valid funded anchor.
   - This avoids accidentally freezing carried-over original positions at the commit-date balance.

4. **Expected behavior after the fix**
   - Commit all straights opens on the day after the last straight.
   - Scenario straights are active when the as-of date is after they funded.
   - Moving date back to May 11 grays out future straights as “not started yet.”
   - Original positions with funding data restore their May 11 balances and weeks left.
   - Moving date forward again lowers those balances again.

### Technical scope

Files to update:
- `src/lib/leverageMath.ts`
- `src/lib/dateUtils.ts`
- `src/pages/Index.tsx`

No backend/schema changes are needed.