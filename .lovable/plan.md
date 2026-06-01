## Fix: Excel export values don't match the on-screen calculator to the cent

### Root cause
The Excel export's `calculateSchedules` re-derives the funder payoff timeline (`daysLeft`) with the **old** formula, while the on-screen calculator uses the epsilon-tolerant version that was fixed earlier.

- On screen (`src/pages/Index.tsx`): `Math.ceil(balance / dailyPayment - 1e-6)`
- Excel (`src/lib/exportUtils.ts`, line 53): `Math.ceil(balance / dailyPayment)`

When `balance / dailyPayment` produces floating-point noise (e.g. `110.0000001`), the Excel rounds a position's payoff up by one extra day. That shifts the position's final partial payment into a different week, which cascades through the whole simulation: cash-infusion totals, weekly debits, exposure, RTR balance, and profit all drift by a few cents to a few dollars versus the screen.

A second, smaller inconsistency: the weekly payment is computed as `newDailyPayment * 5` on screen but as `newClip` directly in the Excel export. These differ by a fraction of a cent due to the intermediate `/5` then `*5`.

### Changes (all in `src/lib/exportUtils.ts`)
1. **Match the `daysLeft` formula** (line 53): change `Math.ceil(effectiveBalance / effectiveDaily)` to `Math.ceil(effectiveBalance / effectiveDaily - 1e-6)` so the export computes the exact same payoff day count as the screen.

2. **Match the weekly payment derivation** (lines 105-106): compute it the same way the screen does so the displayed weekly clip is byte-for-byte identical:
   - `newDailyPayment = cadenceWeekly ? newClip / 5 : newClip`
   - `newWeeklyPayment = newDailyPayment * 5`

### Notes / scope
- The closed-form headline numbers (Total Funding, Total Payback, factor rate, savings) are already identical between the two paths and are not changed.
- The export's schedule loop intentionally runs longer than the on-screen one (it pays off the full funder tail instead of stopping when debits finish). That behavior is preserved — the only change is making the per-position day counts match so the overlapping rows agree to the cent.

### Verification
- Open the deal in question (the weekly-cadence one), export to Excel, and compare the Deal Summary and weekly schedule against the on-screen values; confirm cash infusion, debits, exposure, and the new weekly/daily payment now match to the cent.
- Spot-check a daily-cadence deal to confirm no regression.
