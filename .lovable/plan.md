## Improve Excel Export — Positions Tab

Scope: only the "Positions" sheet in `src/lib/exportUtils.ts` (around lines 308–352). No other exports, PDFs, or UI affected.

### New column layout

Replace current headers:
`Ours | Include | Entity | Funded Date | Amount Funded | Balance | Daily Payment | Days Left | Last Payment Date`

With:
`Ours | Include | Entity | Frequency | Pull Day | Funded Date | Amount Funded | Balance | Payment | Time Remaining | Last Payment Date`

### Per-row behavior

- **Frequency**: "Daily" or "Weekly" (from `p.frequency`, default `Daily`).
- **Pull Day**: weekly → `p.weeklyPullDay` (e.g. "Monday"); daily → `-`.
- **Payment**:
  - daily → `p.dailyPayment` (labeled by header as the daily amount)
  - weekly → `p.dailyPayment * 5` (one weekly clip)
- **Time Remaining**:
  - daily → `"{daysLeft} days"`
  - weekly → `"{ceil(daysLeft / 5)} weeks"`
  - unknown balance → `"?"`
- **Last Payment Date**: unchanged (already business-day based).

### Totals row

Update the `REVERSING X of Y` summary row to align with the new column count, putting:
- total balance under **Balance**
- total daily payment (sum of `dailyPayment`, kept as daily for apples-to-apples) under **Payment**, with a note in the header cell or footer that this column mixes daily/weekly amounts. Simpler: leave the total blank under Payment to avoid mixing units, and instead place `Total Daily Equivalent: $X` text in the trailing cell. Recommendation: **leave Payment total blank, add a "Total Daily Equivalent" line below** so weekly+daily aren't summed misleadingly.

### Formatting

- Update `!cols` widths to match 11 columns.
- Update `applyCurrencyFormat` to target columns `F` (Amount Funded), `G` (no — that's now Pull Day)… recompute: currency cols become `G` (Amount Funded), `H` (Balance), `I` (Payment). Pass `['G','H','I']`.

### Out of scope

No changes to PDF export, schedule tabs, or on-screen positions table.