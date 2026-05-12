Root cause: date changes are mutating `position.balance`, but manual-anchor positions keep the old `balanceAsOfDate`. On the next date change, the app treats the already-mutated balance as if it still belonged to the old anchor date, so moving May -> July -> May compounds the math instead of restoring the May values.

Plan:
1. Make as-of-date repricing reversible
   - In `src/pages/Index.tsx`, update `handleAsOfDateChange` so every repriced position saves the new balance together with the new `balanceAsOfDate`.
   - That makes the next move calculate from the actual date the current balance represents, not from a stale date.

2. Preserve not-started scenario behavior
   - Keep future-funded scenario positions grayed out when the selected as-of date is before their `fundedDate`.
   - Do not force those balances into calculator math while they are not started yet.

3. Prevent future anchor confusion
   - Tighten `repricedBalance` comments/logic so manual anchors mean: “this current balance is true as of `balanceAsOfDate`.”
   - Funded anchors still use `fundedDate + amountFunded` as the stable source for scenario/newly funded positions.

Acceptance check:
- Commit all straights.
- Move the as-of date from May 11 to July.
- Move it back to May 11.
- Original positions return to their May 11 balances and weeks left instead of drifting lower/higher.
- Scenario straights that had not started by May 11 remain grayed out as “scenario did not start yet.”