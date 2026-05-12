## What's happening

"Net to Merchant" in the UI = `totalFunding × (1 − fee%)` = **$841,561.62**, which equals the sum of all included position balances (so cash-to-merchant is $0 — every dollar funded goes to pay off the existing positions).

When you sum the **Weekly Infusion** column in the exported Excel, you get **less than $841,561.62**. That's a bug in the export, not a math disagreement.

## Root cause (in `src/lib/exportUtils.ts`, `calculateSchedules`)

The daily/weekly schedule loop (lines ~126–173) does two things at once:

1. Computes `cashInfusion` — the dollars we send to funders each Monday to pay off positions.
2. Computes `dailyWithdrawal` — the dollars the merchant debits back to us.

It then exits the loop the moment **the merchant's RTR hits zero**:

```ts
if (rtrBalance <= 0) dealComplete = true;
```

But funder payoffs (cash infusions) almost always run **longer** than the merchant's RTR term — that's the whole point of a reverse. By killing the loop when RTR is paid off, every position payment scheduled after that day is silently dropped from the weekly schedule. Sum of weekly `cashInfusion` therefore < total included balances.

Other smaller contributors that can also cause a shortfall:

- `maxDays = 500` cap. Any position with `daysLeft > 500` gets its tail truncated.
- Cash infusions are bucketed into 5‑day Monday blocks `[day, day+4]`, so if the loop ends mid-week the partial week's remaining infusions are lost.

## Fix

Decouple "stop debiting" from "stop infusing" so the weekly tab always sums to total included balances.

1. **`src/lib/exportUtils.ts` → `calculateSchedules`**
   - Replace the single `dealComplete` early-exit with two flags:
     - `debitsComplete` (RTR ≤ 0) → after this, set `dailyWithdrawal = 0` for subsequent days but **keep iterating**.
     - `infusionsComplete` → true only when every included position has `balance` fully scheduled (i.e. day index > max `daysLeft` across included positions).
   - Loop continues until `infusionsComplete` is true (or a generous safety cap, e.g. `Math.max(500, maxDaysLeft + 5)` so we never truncate).
   - Bump/replace the hard `maxDays = 500` so a position with a long tail isn't cut off.
   - Keep `cashInfusion` math unchanged (the `remainder` logic already pays each position to the penny).

2. **Verify**
   - `sum(weeklySchedule[i].cashInfusion)` must equal `includedBalance` (= Net to Merchant when cash-to-merchant is $0). Add a dev-only `console.assert` or reconcile in a unit test.
   - Spot-check the affected merchant: weekly tab total should now read **$841,561.62**.

3. **No other changes**
   - "Net to Merchant", factor rate, payback, EPO, and PDF math are untouched.
   - The on-screen schedule breakdown already sums to the position balances (it iterates per position, not per day), so this is purely an export-side fix.

## Out of scope

- No changes to the merchant proposal PDF math, EPO tiers, or any UI metric.
- No backend / schema changes.
- No re-pricing or `dateUtils` changes.

## Acceptance

- Open the same deal, export Excel, sum the **Weekly Infusion** column → equals $841,561.62 (within $1 rounding).
- Daily tab's `Cash Infusion` column also sums to the same number.
- Existing weekly debits column behavior is preserved (debits stop on schedule; they don't keep going past RTR = 0).
